"""Самообучение на позах: маскируем кадры, учимся их восстанавливать.

Рецепт SignBERT/MASA/BEST, урезанный до того, что реально нужно здесь.
Идея этих работ: разметка дорогая, а последовательностей поз много — пусть
модель сначала выучит, как вообще устроено движение рук, без единой метки, и
только потом получит 20 клипов на класс. OpenHands показывает на этом
кросс-языковой перенос +2..18 пунктов, и тем больше, чем меньше разметки.
У нас 20 клипов на класс — низкоресурсный случай в чистом виде.

Два решения, отличающих это от статей:

1. Ствол берём СВОЙ, из model_def.build_model, слой в слой. Предобученные веса
   должны лечь в ту же модель, которая уезжает в браузер. Чужая архитектура
   дала бы красивую цифру и неконвертируемый граф.
2. Предобучаемся ТОЛЬКО на train-сплите. Взять ещё и test было бы соблазнительно
   (меток-то не надо), но тогда честная метрика на невиданных подписантах
   перестанет быть честной.

Задача: 15% кадров зануляются целыми отрезками (одиночные кадры
восстанавливаются интерполяцией соседей и ничему не учат), модель
предсказывает их канонизированные координаты. Голова-декодер после
предобучения выбрасывается.

Запуск: ml/venv/bin/python ml/pretrain_masked.py [--epochs 60]
Результат: ml/checkpoints/pretrained_trunk.weights.npz
"""
import argparse
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

import keras  # noqa: E402

from features import featurize, T, OUT_DIM  # noqa: E402
from model_def import build_model  # noqa: E402
from export_tfjs import save_weights_npz  # noqa: E402

ML = os.path.dirname(os.path.abspath(__file__))
CKPT = os.path.join(ML, "checkpoints")
LMH = os.path.join(ML, "landmarks_holistic")
COORD_DIM = 255      # канонизированные координаты; 4 флага присутствия не цель
MASK_RATIO = 0.15
SPAN = (3, 8)        # длина маскируемого отрезка в кадрах
BATCH = 128


def load_train_features():
    """Канонизированные окна train-сплита. Кэшируем — featurize не бесплатен."""
    cache = os.path.join(CKPT, "pretrain_feats.npy")
    if os.path.exists(cache):
        X = np.load(cache, mmap_mode="r")
        print(f"кэш признаков: {X.shape}")
        return X
    idx = json.load(open(os.path.join(LMH, "file_index.json")))
    ids = sorted(k for k, v in idx.items() if v["split"] == "train")
    X = np.empty((len(ids), T, OUT_DIM), dtype=np.float32)
    for i, k in enumerate(ids):
        X[i] = featurize(np.load(os.path.join(LMH, "train", k + ".npy")).astype(np.float32))
        if i % 2000 == 0:
            print(f"  канонизация {i}/{len(ids)}", flush=True)
    os.makedirs(CKPT, exist_ok=True)
    np.save(cache, X)
    print(f"признаки: {X.shape} -> {cache}")
    return X


class MaskedFrames(keras.utils.PyDataset):
    """Вход с занулёнными отрезками, цель — исходные координаты + карта маски."""

    def __init__(self, X, seed=42, **kw):
        super().__init__(**kw)
        self.X = X
        self.seed = seed
        self.epoch = 0
        self.order = np.arange(len(X))

    def __len__(self):
        return int(np.ceil(len(self.X) / BATCH))

    def on_epoch_end(self):
        self.epoch += 1
        self.order = np.random.default_rng(self.seed * 1000 + self.epoch).permutation(len(self.X))

    def __getitem__(self, b):
        rng = np.random.default_rng((self.epoch * 100003 + b) * 7 + 1 + self.seed)
        ids = self.order[b * BATCH:(b + 1) * BATCH]
        xb = np.array(self.X[np.sort(ids)], dtype=np.float32)
        target = xb[:, :, :COORD_DIM].copy()
        mask = np.zeros((len(xb), T), dtype=np.float32)
        want = max(1, int(MASK_RATIO * T))
        for j in range(len(xb)):
            # кадры-паддинг (полностью нулевые) маскировать бессмысленно
            valid = int((np.abs(xb[j]).sum(1) > 0).sum())
            if valid < SPAN[1] * 2:
                continue
            covered = 0
            while covered < want:
                L = int(rng.integers(SPAN[0], SPAN[1] + 1))
                s = int(rng.integers(0, max(1, valid - L)))
                mask[j, s:s + L] = 1.0
                covered = int(mask[j].sum())
            xb[j][mask[j] > 0] = 0.0
        # маску отдаём вместе с целью: лосс считается только по закрытым кадрам
        return xb, np.concatenate([target, mask[:, :, None]], axis=-1)


def masked_mse(y_true, y_pred):
    import tensorflow as tf
    target = y_true[:, :, :COORD_DIM]
    mask = y_true[:, :, COORD_DIM:]
    err = tf.square(y_pred - target) * mask
    return tf.reduce_sum(err) / (tf.reduce_sum(mask) * COORD_DIM + 1e-6)


def build_pretrainer(num_classes=1001):
    """Ствол из build_model + временный декодер поверх выхода bilstm_2."""
    base = build_model(keras, num_classes=num_classes)
    L = keras.layers
    h = base.get_layer("bilstm_2").output          # (30, 320) — после MaxPooling1D
    d = L.UpSampling1D(2, name="dec_up")(h)        # обратно к 60 кадрам
    d = L.Conv1D(256, 3, padding="same", activation="swish", name="dec_conv")(d)
    d = L.Conv1D(COORD_DIM, 1, padding="same", name="dec_out")(d)
    return base, keras.Model(base.input, d, name="masked_pose_pretrainer")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--smoke", action="store_true")
    args = ap.parse_args()

    X = load_train_features()
    if args.smoke:
        X = np.array(X[:512])
        args.epochs = 2

    base, pre = build_pretrainer()
    n_enc = sum(1 for l in base.layers if l.weights and l.name != "logits")
    print(f"ствол: {n_enc} слоёв со весами | предобучаемых параметров: "
          f"{pre.count_params():,}")

    data = MaskedFrames(X, workers=6, use_multiprocessing=False, max_queue_size=8)
    steps = len(data)
    pre.compile(
        optimizer=keras.optimizers.AdamW(
            learning_rate=keras.optimizers.schedules.CosineDecay(
                1e-3, decay_steps=args.epochs * steps, warmup_target=None),
            weight_decay=1e-4, clipnorm=1.0),
        loss=masked_mse)

    log = os.path.join(CKPT, "pretrain_log.csv")
    with open(log, "w") as fh:
        fh.write("epoch,time,masked_mse\n")

    class Log(keras.callbacks.Callback):
        def on_epoch_end(self, e, logs=None):
            with open(log, "a") as fh:
                fh.write(f"{e},{time.strftime('%H:%M:%S')},{logs.get('loss', 0):.6f}\n")

    t0 = time.time()
    print(f"предобучение: {len(X)} последовательностей, {steps} шагов/эпоху", flush=True)
    pre.fit(data, epochs=args.epochs, callbacks=[Log()], verbose=2)

    # декодер выбрасываем, сохраняем ровно ствол развёрнутой модели
    out = os.path.join(CKPT, "pretrained_trunk.weights.npz")
    save_weights_npz(base, out)
    print(f"\nготово за {(time.time() - t0) / 3600:.2f}ч -> {out}")
    print("голова logits в этом файле случайная — её обучает следующий шаг")


if __name__ == "__main__":
    main()

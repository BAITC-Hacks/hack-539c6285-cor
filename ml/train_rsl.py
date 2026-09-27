"""Тренировка распознавателя РЖЯ на SLOVO (1001 класс, лэндмарки 60x255 -> 60x259).

Рецепт: геометрическая канонизация, window-sim аугментация, синтетические
негативы no_event, Conv+BiLSTM ~4M параметров, AdamW + warmup/cosine, EMA,
подписант-дизъюнктная валидация. Запуск:
  ml/venv/bin/python ml/train_rsl.py [--epochs N] [--smoke]
"""
import argparse
import csv as csvmod
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

import keras  # noqa: E402

from augment import augment_sign, _valid_rows  # noqa: E402
from features import normalize_window_fast, T, OUT_DIM  # noqa: E402
from model_def import build_model, NUM_CLASSES  # noqa: E402

ML = os.path.dirname(os.path.abspath(__file__))
CKPT = os.path.join(ML, "checkpoints")
SEED = 42  # сид СПЛИТА — всегда 42, чтобы валидация совпадала между прогонами
BATCH = 128
NO_EVENT_WEIGHT = 0.2
SYNTH_NEG_P = 0.10

RECIPE = os.environ.get("QYRAN_RECIPE", "v2")
WD = 3e-4 if RECIPE == "v3" else 1e-4
SMOOTH = 0.2 if RECIPE == "v3" else 0.1
DACTYL_WEIGHT = 1.5 if RECIPE == "v3" else 1.0


# ---------------------------------------------------------------- данные
def load_corpus():
    idx = json.load(open(os.path.join(ML, "landmarks_holistic", "file_index.json")))
    lm = json.load(open(os.path.join(ML, "landmarks_holistic", "label_map.json")))
    no_event_id = lm["no_event"]
    # длины исходных видео
    lens = {}
    for r in csvmod.DictReader(open(os.path.join(ML, "annotations.csv")), delimiter="\t"):
        lens[r["attachment_id"]] = float(r["length"])

    train_ids = sorted(k for k, v in idx.items() if v["split"] == "train")
    X = np.empty((len(train_ids), T, 255), dtype=np.float32)
    y = np.empty(len(train_ids), dtype=np.int64)
    users = []
    raw_len = np.empty(len(train_ids), dtype=np.float32)
    for i, k in enumerate(train_ids):
        X[i] = np.load(os.path.join(ML, "landmarks_holistic", "train", k + ".npy"))
        y[i] = idx[k]["label"]
        users.append(idx[k]["user"])
        raw_len[i] = lens.get(k, 0.0)
    users = np.array(users)

    # выбрасываем знаковые сэмплы, где руки не детектились ни разу
    hands = np.abs(X[:, :, 129:255]).sum(axis=(1, 2)) > 0
    junk = (~hands) & (y != no_event_id)
    keep = ~junk
    print(f"corpus: {len(train_ids)} train, выброшено без рук: {int(junk.sum())}")
    return X[keep], y[keep], users[keep], raw_len[keep], no_event_id, lm


def signer_disjoint_val(y, users, no_event_id, target_clips=1400, max_loss=3,
                        restarts=300, num_classes=None, out_path=None):
    """Подписант-дизъюнктная валидация: многостартовый жадный отбор.

    Максимизируем размер val при ограничении: каждый знаковый класс
    теряет из train не больше max_loss клипов.
    """
    nc = NUM_CLASSES if num_classes is None else num_classes
    uniq = np.unique(users)
    sign_classes = np.arange(nc) != no_event_id
    per_user = {u: np.bincount(y[users == u], minlength=nc) for u in uniq}
    best_chosen, best_n = [], 0
    for r in range(restarts):
        rng = np.random.default_rng(SEED + r)
        order = rng.permutation(uniq)
        class_loss = np.zeros(nc, dtype=np.int64)
        chosen, n_val = [], 0
        for u in order:
            losses = per_user[u]
            test = class_loss + losses
            if (test[sign_classes] <= max_loss).all() and n_val + int(losses.sum()) <= int(target_clips * 1.3):
                chosen.append(str(u))
                class_loss = test
                n_val += int(losses.sum())
                if n_val >= target_clips:
                    break
        if n_val > best_n:
            best_chosen, best_n = chosen, n_val
    val_mask = np.isin(users, best_chosen)
    json.dump({"val_signers": best_chosen, "n_val": int(val_mask.sum())},
              open(out_path or os.path.join(ML, "eval_split.json"), "w"))
    print(f"val: {len(best_chosen)} подписантов, {int(val_mask.sum())} клипов")
    return val_mask


# ---------------------------------------------------------------- генератор
class TrainData(keras.utils.PyDataset):
    def __init__(self, X, y, raw_len, no_event_id, no_event_pool, dactyl_ids,
                 run_seed=42, num_classes=None, **kw):
        super().__init__(**kw)
        self.X, self.y, self.raw_len = X, y, raw_len
        self.num_classes = NUM_CLASSES if num_classes is None else num_classes
        self.no_event_id = no_event_id
        self.pool = no_event_pool
        self.dactyl = dactyl_ids  # set label-id букв дактиля
        self.sign_ids = np.nonzero(y != no_event_id)[0]
        self.run_seed = run_seed
        self.epoch = 0
        self.order = np.arange(len(y))

    def __len__(self):
        return int(np.ceil(len(self.y) / BATCH))

    def on_epoch_end(self):
        self.epoch += 1
        rng = np.random.default_rng(self.run_seed * 1000 + self.epoch)
        self.order = rng.permutation(len(self.y))

    def __getitem__(self, b):
        rng = np.random.default_rng(
            (self.epoch * 100003 + b) * 7 + 1 + self.run_seed * 17)
        ids = self.order[b * BATCH:(b + 1) * BATCH]
        xb = np.empty((len(ids), T, OUT_DIM), dtype=np.float32)
        yb = np.zeros((len(ids), self.num_classes), dtype=np.float32)
        wb = np.empty(len(ids), dtype=np.float32)
        for j, i in enumerate(ids):
            is_ne = self.y[i] == self.no_event_id
            if not is_ne and rng.random() < SYNTH_NEG_P:
                from augment import synth_negative, raw_dropouts, post_norm_aug, mirror
                from features import append_relational
                raw = synth_negative(self.X, self.raw_len, self.sign_ids, rng, self.pool)
                if rng.random() < 0.3:
                    raw = mirror(raw)
                x = append_relational(
                    post_norm_aug(normalize_window_fast(raw_dropouts(raw, rng)), rng))
                label = self.no_event_id
            else:
                is_dact = int(self.y[i]) in self.dactyl
                x = augment_sign(self.X[i], float(self.raw_len[i]), rng, self.pool,
                                 is_no_event=bool(is_ne), is_dactyl=is_dact)
                label = int(self.y[i])
            xb[j] = x
            yb[j, label] = 1.0
            if label == self.no_event_id:
                wb[j] = NO_EVENT_WEIGHT
            elif label in self.dactyl:
                wb[j] = DACTYL_WEIGHT
            else:
                wb[j] = 1.0
        return xb, yb, wb


# ---------------------------------------------------------------- EMA + чекпойнты
class EMACheckpoint(keras.callbacks.Callback):
    def __init__(self, x_val, y_val, x_wval, y_wval, patience=25, momentum=0.998,
                 tag=""):
        super().__init__()
        self.xv, self.yv, self.xw, self.yw = x_val, y_val, x_wval, y_wval
        self.patience = patience
        self.m = momentum
        self.tag = tag
        self.shadow = None
        self.best = -1.0
        self.best_w = -1.0
        self.wait = 0
        self.log_path = os.path.join(CKPT, f"train_log{tag}.csv")

    def on_train_batch_end(self, batch, logs=None):
        if batch % 2 == 1 and self.shadow is not None:
            return  # обновляем тень раз в 2 батча (даёт ~тот же охват, вдвое дешевле)
        ws = self.model.get_weights()
        if self.shadow is None:
            self.shadow = [w.copy() for w in ws]
        else:
            for s, w in zip(self.shadow, ws):
                s *= self.m
                s += (1.0 - self.m) * w

    def _acc(self, x, y):
        p = self.model.predict(x, batch_size=256, verbose=0)
        top1 = float((p.argmax(1) == y).mean())
        top5 = float(np.mean([yy in row for yy, row in
                              zip(y, np.argsort(p, axis=1)[:, -5:])]))
        return top1, top5

    def on_epoch_end(self, epoch, logs=None):
        cur = self.model.get_weights()
        self.model.set_weights(self.shadow)
        v1, v5 = self._acc(self.xv, self.yv)
        w1, w5 = self._acc(self.xw, self.yw)
        from export_tfjs import save_weights_npz
        improved = v1 > self.best
        if improved:
            self.best = v1
            self.wait = 0
            save_weights_npz(self.model, os.path.join(CKPT, f"best{self.tag}.weights.npz"))
        else:
            self.wait += 1
        if w1 > self.best_w:
            self.best_w = w1
            save_weights_npz(self.model, os.path.join(CKPT, f"best_windowed{self.tag}.weights.npz"))
        self.model.set_weights(cur)
        line = (f"{epoch},{time.strftime('%H:%M:%S')},{logs.get('loss', 0):.4f},"
                f"{logs.get('categorical_accuracy', 0):.4f},{v1:.4f},{v5:.4f},{w1:.4f},{w5:.4f},"
                f"{self.best:.4f},{self.wait}")
        with open(self.log_path, "a") as fh:
            fh.write(line + "\n")
        print(f"  [EMA] val {v1:.3f}/{v5:.3f} | windowed {w1:.3f}/{w5:.3f} | "
              f"best {self.best:.3f} | wait {self.wait}/{self.patience}")
        if self.wait >= self.patience:
            self.model.stop_training = True
            print("  early stop")


class WarmupCosine(keras.optimizers.schedules.LearningRateSchedule):
    def __init__(self, peak=8e-4, floor=1e-5, warmup_steps=5 * 112, total_steps=150 * 112):
        self.peak, self.floor = peak, floor
        self.warm, self.total = float(warmup_steps), float(total_steps)

    def __call__(self, step):
        import tensorflow as tf
        s = tf.cast(step, tf.float32)
        warm_lr = self.floor + (self.peak - self.floor) * (s / self.warm)
        prog = tf.clip_by_value((s - self.warm) / (self.total - self.warm), 0.0, 1.0)
        cos_lr = self.floor + 0.5 * (self.peak - self.floor) * (1.0 + tf.cos(np.pi * prog))
        return tf.where(s < self.warm, warm_lr, cos_lr)

    def get_config(self):
        return {"peak": self.peak, "floor": self.floor,
                "warmup_steps": self.warm, "total_steps": self.total}


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=120)
    ap.add_argument("--seed", type=int, default=42, help="сид инициализации/шаффла (сплит всегда 42)")
    ap.add_argument("--tag", default="", help="суффикс имён чекпойнтов")
    ap.add_argument("--smoke", action="store_true", help="крошечный прогон для проверки")
    ap.add_argument("--init", default=None,
                    help="стартовать с весов из checkpoints/<файл>.npz "
                         "(например pretrained_trunk.weights.npz после самообучения)")
    args = ap.parse_args()

    os.makedirs(CKPT, exist_ok=True)
    keras.utils.set_random_seed(args.seed)
    print(f"recipe={RECIPE} wd={WD} smooth={SMOOTH} seed={args.seed} tag='{args.tag}'")

    X, y, users, raw_len, no_event_id, lm = load_corpus()
    val_mask = signer_disjoint_val(y, users, no_event_id)
    tr = ~val_mask

    # пул no_event для паддинга окон (только тренировочные подписанты)
    pool = [X[i][: _valid_rows(X[i])].copy()
            for i in np.nonzero((y == no_event_id) & tr)[0]
            if _valid_rows(X[i]) >= 8]
    print(f"no_event pool: {len(pool)}")

    # валидация: обычная + window-simmed (фиксированный seed)
    Xv_raw, yv = X[val_mask], y[val_mask]
    from features import featurize
    x_val = np.stack([featurize(a) for a in Xv_raw])
    rng = np.random.default_rng(123)
    from augment import window_sim
    x_wval = np.stack([
        featurize(window_sim(a, float(L), rng, pool,
                             cover_min=0.0 if yy == no_event_id else 0.7))
        for a, L, yy in zip(Xv_raw, raw_len[val_mask], yv)])
    print(f"val tensors: {x_val.shape}, windowed: {x_wval.shape}")

    if args.smoke:
        keep = np.nonzero(tr)[0][:2000]
        tr = np.zeros_like(tr)
        tr[keep] = True
        args.epochs = 2

    # дактильные буквы: одиночные символы алфавита (включая строчные дубли)
    dactyl_ids = {v for k, v in lm.items() if len(k) == 1 and k.isalpha()}
    data = TrainData(X[tr], y[tr], raw_len[tr], no_event_id, pool, dactyl_ids,
                     run_seed=args.seed,
                     workers=6, use_multiprocessing=False, max_queue_size=8)
    steps = len(data)
    print(f"train: {int(tr.sum())} сэмплов, {steps} шагов/эпоху, дактильных классов: {len(dactyl_ids)}")

    model = build_model(keras)
    if args.init:
        from export_tfjs import load_weights_npz
        load_weights_npz(model, os.path.join(CKPT, args.init))
        print(f"старт с весов {args.init} (голова logits там необученная)")
    opt = keras.optimizers.AdamW(
        learning_rate=WarmupCosine(warmup_steps=5 * steps, total_steps=args.epochs * steps),
        weight_decay=WD, clipnorm=1.0)
    try:
        opt.exclude_from_weight_decay(var_names=["bias", "gamma", "beta"])
    except Exception:
        pass
    model.compile(
        optimizer=opt,
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=SMOOTH),
        metrics=[keras.metrics.CategoricalAccuracy(),
                 keras.metrics.TopKCategoricalAccuracy(k=5, name="top5")],
    )

    if not os.path.exists(os.path.join(CKPT, "train_log.csv")):
        with open(os.path.join(CKPT, "train_log.csv"), "w") as fh:
            fh.write("epoch,time,loss,train_acc,val1,val5,wval1,wval5,best,wait\n")

    cb = EMACheckpoint(x_val, yv, x_wval, yv, tag=args.tag)
    t0 = time.time()
    model.fit(data, epochs=args.epochs, callbacks=[cb], verbose=2)
    print(f"done in {(time.time() - t0) / 3600:.2f}h | best val top1 {cb.best:.4f} "
          f"| best windowed {cb.best_w:.4f}")


if __name__ == "__main__":
    main()

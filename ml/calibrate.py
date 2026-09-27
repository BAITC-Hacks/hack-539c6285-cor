"""Калибровка температуры для любого чекпойнта, без побочных эффектов.

Та же процедура, что в конце evaluate.py, но:
  * имя выходного файла задаётся явно — evaluate.py всегда пишет
    calibrated.weights.npz, то есть затирает развёрнутую модель;
  * ничего кроме калибровки не считает.

Зачем это нужно. В логиты развёрнутой модели вжата температура 0.8 (проверяется
нормой слоя: 50.07 у best против 62.59 у calibrated, ровно 1/0.8). Пороги
тишины в приложении настроены на эту шкалу уверенности. Если подменить модель
некалиброванной, шкала поедет, и пороги начнут значить не то — при той же
точности распознавания.

Температура подбирается на подписант-дизъюнктной валидации, прогнанной через
симуляцию боевого окна: минимизируется правдоподобие, не точность. Точность от
температуры не меняется вообще — меняется только осмысленность процентов.

Запуск: ml/venv/bin/python ml/calibrate.py best_ssl.weights.npz calibrated_ssl.weights.npz
"""
import argparse
import csv as csvmod
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

import keras  # noqa: E402

from augment import window_sim, _valid_rows  # noqa: E402
from features import featurize  # noqa: E402
from model_def import build_model  # noqa: E402
from export_tfjs import load_weights_npz  # noqa: E402

ML = os.path.dirname(os.path.abspath(__file__))
CKPT = os.path.join(ML, "checkpoints")
LMH = os.path.join(ML, "landmarks_holistic")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", help="чекпойнт для калибровки")
    ap.add_argument("dst", help="куда сохранить откалиброванный")
    ap.add_argument("--repeats", type=int, default=3)
    args = ap.parse_args()

    assert args.dst != "calibrated.weights.npz" or os.environ.get("QYRAN_OVERWRITE"), \
        "calibrated.weights.npz — это развёрнутая модель; задай другое имя"

    idx = json.load(open(os.path.join(LMH, "file_index.json")))
    lm = json.load(open(os.path.join(LMH, "label_map.json")))
    ne = lm["no_event"]
    lens = {r["attachment_id"]: float(r["length"])
            for r in csvmod.DictReader(open(os.path.join(ML, "annotations.csv")),
                                       delimiter="\t")}

    val_signers = set(json.load(open(os.path.join(ML, "eval_split.json")))["val_signers"])
    val_ids = sorted(k for k, v in idx.items()
                     if v["split"] == "train" and v["user"] in val_signers)
    Xv = np.stack([np.load(os.path.join(LMH, "train", k + ".npy"))
                   for k in val_ids]).astype(np.float32)
    yv = np.array([idx[k]["label"] for k in val_ids])
    lv = np.array([lens.get(k, 0.0) for k in val_ids], dtype=np.float32)
    print(f"валидация: {len(yv)} клипов от {len(val_signers)} подписантов")

    # пул тишины для паддинга окон — из тех же валидационных клипов
    pool = [Xv[i][: _valid_rows(Xv[i])].copy()
            for i in np.nonzero(yv == ne)[0] if _valid_rows(Xv[i]) >= 8]

    model = build_model(keras)
    load_weights_npz(model, os.path.join(CKPT, args.src))

    rng = np.random.default_rng(123)
    Xvw = np.concatenate([
        np.stack([featurize(window_sim(a, float(L), rng, pool,
                                       cover_min=0.0 if yy == ne else 0.7))
                  for a, L, yy in zip(Xv, lv, yv)])
        for _ in range(args.repeats)])
    yvw = np.tile(yv, args.repeats)

    pv = model.predict(Xvw, batch_size=256, verbose=0)
    logits = np.log(np.clip(pv, 1e-12, 1.0))   # softmax монотонен: log p ~ логиты + const
    best_T, best_nll = 1.0, np.inf
    for Tt in np.arange(0.8, 3.01, 0.05):
        z = logits / Tt
        z -= z.max(1, keepdims=True)
        p = np.exp(z); p /= p.sum(1, keepdims=True)
        nll = -float(np.mean(np.log(np.clip(p[np.arange(len(yvw)), yvw], 1e-12, 1))))
        if nll < best_nll:
            best_nll, best_T = nll, float(Tt)
    print(f"температура: {best_T:.2f} (правдоподобие {best_nll:.3f})")

    data = dict(np.load(os.path.join(CKPT, args.src)))
    data["logits/0"] = data["logits/0"] / best_T
    data["logits/1"] = data["logits/1"] / best_T
    out = os.path.join(CKPT, args.dst)
    np.savez(out, **data)
    print(f"-> {out}")

    meta = os.path.join(CKPT, args.dst.replace(".npz", ".json"))
    json.dump({"source": args.src, "temperature": best_T, "nll": best_nll,
               "n_val": int(len(yv)), "repeats": args.repeats},
              open(meta, "w"), indent=1)


if __name__ == "__main__":
    main()

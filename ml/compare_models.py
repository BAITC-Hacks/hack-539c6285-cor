"""Очная ставка всех кандидатов на одном протоколе, без побочных эффектов.

Зачем отдельно от evaluate.py: тот в конце калибрует температуру и
ПЕРЕЗАПИСЫВАЕТ calibrated.weights.npz — а это файл, из которого собрана
развёрнутая модель. Сравнивать кандидатов, попутно затирая действующую
модель, нельзя. Здесь только чтение.

Протокол — тот же, что дал опубликованные 58.5%:
  * 1652 клипа официального теста от подписантов, которых не было в train;
  * классы-дубли С/с и Я/я слиты при декодировании;
  * отдельно симуляция скользящего окна (5 сидов) — то, что видит браузер;
  * поведение на тишине: как часто молчание выдаётся за знак.

Запуск: ml/venv/bin/python ml/compare_models.py best.weights.npz best_ssl.weights.npz
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

from augment import _valid_rows, window_sim  # noqa: E402
from features import featurize  # noqa: E402
from model_def import build_model  # noqa: E402
from export_tfjs import load_weights_npz  # noqa: E402
from evaluate import twin_pairs, pool_twins, top15  # noqa: E402

ML = os.path.dirname(os.path.abspath(__file__))
CKPT = os.path.join(ML, "checkpoints")
LMH = os.path.join(ML, "landmarks_holistic")


def load_eval():
    idx = json.load(open(os.path.join(LMH, "file_index.json")))
    lens = {r["attachment_id"]: float(r["length"])
            for r in csvmod.DictReader(open(os.path.join(ML, "annotations.csv")),
                                       delimiter="\t")}
    train_users = {v["user"] for v in idx.values() if v["split"] == "train"}
    ids = sorted(k for k, v in idx.items() if v["split"] == "test")
    X = np.stack([np.load(os.path.join(LMH, "test", k + ".npy")) for k in ids]).astype(np.float32)
    y = np.array([idx[k]["label"] for k in ids])
    users = np.array([idx[k]["user"] for k in ids])
    L = np.array([lens.get(k, 0.0) for k in ids], dtype=np.float32)
    unseen = ~np.isin(users, sorted(train_users))
    return X, y, L, unseen


def evaluate_one(ckpt, X, Xn, y, L, unseen, lm, pairs, ne):
    model = build_model(keras)
    load_weights_npz(model, os.path.join(CKPT, ckpt))
    probs, y2 = pool_twins(model.predict(Xn, batch_size=256, verbose=0), y.copy(), pairs)
    t1, t5 = top15(probs[unseen], y2[unseen])

    pool = [X[i][: _valid_rows(X[i])].copy()
            for i in np.nonzero(y2 == ne)[0] if _valid_rows(X[i]) >= 8]
    rows = np.nonzero(unseen)[0]
    w1 = []
    for s in range(5):
        rng = np.random.default_rng(1000 + s)
        Xw = np.stack([featurize(window_sim(X[i], float(L[i]), rng, pool,
                                            cover_min=0.0 if y2[i] == ne else 0.7))
                       for i in rows])
        p, _ = pool_twins(model.predict(Xw, batch_size=256, verbose=0), y2[rows].copy(), pairs)
        w1.append(top15(p, y2[rows])[0])

    idle = probs[unseen][y2[unseen] == ne]
    sign_cols = np.delete(idle, ne, axis=1) if len(idle) else np.zeros((0, 1))
    ff = float((sign_cols.max(1) >= 0.6).mean()) if len(idle) else float("nan")

    # дактиль: буквы алфавита как отдельная группа
    letters = {v for k, v in lm.items() if len(k) == 1 and k.isalpha()}
    dac = np.isin(y2[unseen], sorted(letters))
    d1 = float((probs[unseen][dac].argmax(1) == y2[unseen][dac]).mean()) if dac.any() else float("nan")

    del model
    keras.backend.clear_session()
    return {"top1": t1, "top5": t5, "windowed_top1": float(np.mean(w1)),
            "windowed_std": float(np.std(w1)), "false_fire@0.6": ff,
            "dactyl_top1": d1}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ckpts", nargs="+")
    args = ap.parse_args()

    lm = json.load(open(os.path.join(LMH, "label_map.json")))
    ne, pairs = lm["no_event"], twin_pairs(lm)
    X, y, L, unseen = load_eval()
    Xn = np.stack([featurize(a) for a in X])
    n = int(unseen.sum())
    print(f"невиданных подписантов: {n} клипов\n")

    res = {}
    for c in args.ckpts:
        if not os.path.exists(os.path.join(CKPT, c)):
            print(f"пропуск, нет файла: {c}")
            continue
        res[c] = evaluate_one(c, X, Xn, y, L, unseen, lm, pairs, ne)
        print(f"  посчитан {c}", flush=True)

    print(f"\n{'чекпойнт':34} {'top-1':>7} {'top-5':>7} {'стрим':>7} {'дактиль':>8} {'ложн@0.6':>9}")
    for c, r in res.items():
        print(f"{c:34} {r['top1']:7.4f} {r['top5']:7.4f} {r['windowed_top1']:7.4f} "
              f"{r['dactyl_top1']:8.3f} {r['false_fire@0.6']:9.3f}")
    if len(res) == 2:
        a, b = list(res.values())
        d = b["top1"] - a["top1"]
        se = (b["top1"] * (1 - b["top1"]) / n) ** 0.5
        print(f"\nразница top-1: {d:+.4f} при стандартной ошибке ±{se:.4f}")
        print("вывод:", "значимо" if abs(d) > 2 * se else "в пределах шума")

    out = os.path.join(CKPT, "compare_models.json")
    json.dump({"n_unseen": n, "results": res}, open(out, "w"), ensure_ascii=False, indent=1)
    print(f"-> {out}")


if __name__ == "__main__":
    main()

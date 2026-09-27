"""Очная ставка: маска на 1001-классовой против дообученной на словаре сценария.

Обе модели меряются на ОДНИХ клипах одним протоколом — невиданные подписанты
официального теста, дубли С/с и Я/я сведены, классы ограничены словарём.

Ложное срабатывание считается правильно: на клипах ТИШИНЫ смотрим максимум
вероятности по ЗНАКОВЫМ классам. Если он выше порога — система заговорит,
когда никто не показывает. Это, а не путаница слов, ломает работу за стойкой.

Запуск: ml/venv/bin/python ml/compare_scenario.py --scenario counter_lean
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
from train_scenario import scenario_classes  # noqa: E402

ML = os.path.dirname(os.path.abspath(__file__))
CKPT = os.path.join(ML, "checkpoints")
LMH = os.path.join(ML, "landmarks_holistic")
THRESHOLDS = (0.5, 0.6, 0.7, 0.8)


def silence_metrics(p, y, ne_local):
    """Поведение на тишине. p — вероятности уже в локальных классах словаря."""
    idle = p[y == ne_local]
    if len(idle) == 0:
        return {}
    sign = np.delete(idle, ne_local, axis=1)     # только знаковые столбцы
    loudest = sign.max(1)
    out = {"n_idle": int(len(idle)),
           "idle_argmax_ok": float((idle.argmax(1) == ne_local).mean())}
    for t in THRESHOLDS:
        out[f"false_fire@{t}"] = float((loudest >= t).mean())
    return out


def load_eval(keep_global, lm):
    idx = json.load(open(os.path.join(LMH, "file_index.json")))
    lens = {r["attachment_id"]: float(r["length"])
            for r in csvmod.DictReader(open(os.path.join(ML, "annotations.csv")),
                                       delimiter="\t")}
    canon = {b: a for a, b in twin_pairs(lm)}
    g2l = {g: i for i, g in enumerate(keep_global)}
    train_users = {v["user"] for v in idx.values() if v["split"] == "train"}
    ids = sorted(k for k, v in idx.items()
                 if v["split"] == "test" and v["user"] not in train_users
                 and canon.get(v["label"], v["label"]) in g2l)
    X = np.stack([np.load(os.path.join(LMH, "test", k + ".npy")) for k in ids]).astype(np.float32)
    y = np.array([g2l[canon.get(idx[k]["label"], idx[k]["label"])] for k in ids])
    L = np.array([lens.get(k, 0.0) for k in ids], dtype=np.float32)
    return X, y, L


def streamed(model, X, y, L, ne_local, to_local=None, seeds=5):
    pool = [X[i][: _valid_rows(X[i])].copy()
            for i in np.nonzero(y == ne_local)[0] if _valid_rows(X[i]) >= 8]
    t1 = []
    for s in range(seeds):
        rng = np.random.default_rng(1000 + s)
        Xw = np.stack([featurize(window_sim(X[i], float(L[i]), rng, pool,
                                            cover_min=0.0 if y[i] == ne_local else 0.7))
                       for i in range(len(y))])
        p = model.predict(Xw, batch_size=256, verbose=0)
        if to_local is not None:
            p = to_local(p)
        t1.append(top15(p, y)[0])
    return float(np.mean(t1)), float(np.std(t1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenario", default="counter_lean")
    args = ap.parse_args()

    lm = json.load(open(os.path.join(LMH, "label_map.json")))
    keep_global, _ = scenario_classes(args.scenario, lm)
    K = len(keep_global)
    ne_local = keep_global.index(lm["no_event"])
    X, y, L = load_eval(keep_global, lm)
    Xn = np.stack([featurize(a) for a in X])
    print(f"словарь {args.scenario}: {K} классов | клипов {len(y)} "
          f"(из них тишины {int((y == ne_local).sum())})\n")

    rows = {}

    # ---- А: 1001-классовая с маской
    big = build_model(keras, num_classes=1001)
    load_weights_npz(big, os.path.join(CKPT, "calibrated.weights.npz"))
    pairs = twin_pairs(lm)
    cols = np.asarray(keep_global)

    def mask_to_local(p):
        p, _ = pool_twins(p, np.zeros(len(p), dtype=np.int64), pairs)
        return p[:, cols]

    pm = mask_to_local(big.predict(Xn, batch_size=256, verbose=0))
    t1, t5 = top15(pm, y)
    w1, wsd = streamed(big, X, y, L, ne_local, to_local=mask_to_local)
    rows["маска на 1001"] = {"top1": t1, "top5": t5, "windowed_top1": w1,
                             "windowed_std": wsd, **silence_metrics(pm, y, ne_local)}
    del big

    # ---- Б: дообученная на словаре
    small = build_model(keras, num_classes=K)
    load_weights_npz(small, os.path.join(CKPT, f"best_{args.scenario}.weights.npz"))
    ps = small.predict(Xn, batch_size=256, verbose=0)
    t1, t5 = top15(ps, y)
    w1, wsd = streamed(small, X, y, L, ne_local)
    rows["дообученная"] = {"top1": t1, "top5": t5, "windowed_top1": w1,
                           "windowed_std": wsd, **silence_metrics(ps, y, ne_local)}

    # ---- вес головы: сколько весит лишний словарь
    head = 512 * 4 / 1e6
    rows["маска на 1001"]["logits_MB"] = round(head * 1001, 2)
    rows["дообученная"]["logits_MB"] = round(head * K, 2)

    n = len(y)
    se = lambda a: (a * (1 - a) / n) ** 0.5
    print(f"{'':16} {'top-1':>8} {'top-5':>8} {'стрим':>8} {'тишина ok':>10} {'ложн@0.6':>9} {'голова МБ':>10}")
    for name, r in rows.items():
        print(f"{name:16} {r['top1']:8.4f} {r['top5']:8.4f} {r['windowed_top1']:8.4f} "
              f"{r['idle_argmax_ok']:10.3f} {r['false_fire@0.6']:9.3f} {r['logits_MB']:10.2f}")
    d = rows["дообученная"]["top1"] - rows["маска на 1001"]["top1"]
    print(f"\nразница top-1: {d:+.4f} при стандартной ошибке ±{se(rows['дообученная']['top1']):.4f} "
          f"(n={n})")
    print("вывод:", "дообучение выигрывает" if d > 2 * se(rows["дообученная"]["top1"])
          else "разница в пределах шума — сужение словаря решает, а не способ")

    out = os.path.join(CKPT, f"compare_{args.scenario}.json")
    json.dump({"n_clips": n, "num_classes": K, "results": rows}, open(out, "w"),
              ensure_ascii=False, indent=1)
    print(f"-> {out}")


if __name__ == "__main__":
    main()

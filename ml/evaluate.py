"""Финальная оценка обученной модели + калибровка температуры.

Протокол:
  1. Официальный тест (5100) — top-1/top-5 (сравнимость со SLOVO paper, «с утечкой»).
  2. Невиданные подписанты (1652) — ЧЕСТНАЯ главная метрика.
  3. Window-simulated стриминг на невиданных (5 сидов/клип).
  4. Рабочая точка no_event: recall на 100 реальных idle-клипах,
     false-fire на синтетических переходах из ТЕСТОВЫХ клипов.
  5. Температурная калибровка на подписант-дизъюнктной валидации (window-simmed),
     T вжигается в веса логитов -> итоговый npz.
  6. Per-class recall дактильных букв.

Запуск: ml/venv/bin/python ml/evaluate.py [--ckpt best.weights.npz]
Результат: ml/checkpoints/eval_report.json + calibrated.weights.npz
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

from augment import window_sim, synth_negative, _valid_rows  # noqa: E402
from features import featurize, T  # noqa: E402
from model_def import build_model, NUM_CLASSES  # noqa: E402
from export_tfjs import load_weights_npz, save_weights_npz  # noqa: E402

ML = os.path.dirname(os.path.abspath(__file__))
CKPT = os.path.join(ML, "checkpoints")


RUS_ALPHABET = list("АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ")


def twin_pairs(lm):
    """Пары классов-дублей по casefold (С/с, Я/я): [(канонический, дубль), ...]."""
    by_fold = {}
    pairs = []
    for text, i in sorted(lm.items(), key=lambda kv: kv[1]):
        f = text.casefold()
        if f in by_fold:
            pairs.append((by_fold[f], i))
        else:
            by_fold[f] = i
    return pairs


def pool_twins(p, y, pairs):
    """Слить вероятность дублей в канонический класс; перемапить истину."""
    p2 = p.copy()
    y2 = y.copy()
    for a, b in pairs:
        p2[:, a] += p2[:, b]
        p2[:, b] = 0.0
        y2[y2 == b] = a
    return p2, y2


def top15(p, y):
    top1 = float((p.argmax(1) == y).mean())
    top5 = float(np.mean([yy in row for yy, row in zip(y, np.argsort(p, 1)[:, -5:])]))
    return top1, top5


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", default="best.weights.npz")
    args = ap.parse_args()

    idx = json.load(open(os.path.join(ML, "landmarks_holistic", "file_index.json")))
    lm = json.load(open(os.path.join(ML, "landmarks_holistic", "label_map.json")))
    ne = lm["no_event"]
    inv = {v: k for k, v in lm.items()}
    lens = {r["attachment_id"]: float(r["length"])
            for r in csvmod.DictReader(open(os.path.join(ML, "annotations.csv")), delimiter="\t")}

    model = build_model(keras)
    load_weights_npz(model, os.path.join(CKPT, args.ckpt))
    report = {"checkpoint": args.ckpt}

    # ---- тест
    test_ids = sorted(k for k, v in idx.items() if v["split"] == "test")
    Xt = np.stack([np.load(os.path.join(ML, "landmarks_holistic", "test", k + ".npy"))
                   for k in test_ids]).astype(np.float32)
    yt = np.array([idx[k]["label"] for k in test_ids])
    users_t = np.array([idx[k]["user"] for k in test_ids])
    train_users = {v["user"] for v in idx.values() if v["split"] == "train"}
    unseen = ~np.isin(users_t, sorted(train_users))
    lt = np.array([lens.get(k, 0.0) for k in test_ids], dtype=np.float32)

    Xn = np.stack([featurize(a) for a in Xt])
    probs_raw = model.predict(Xn, batch_size=256, verbose=0)
    # пул вероятностей классов-дублей (С/с, Я/я) при декодировании
    pairs = twin_pairs(lm)
    probs, yt = pool_twins(probs_raw, yt, pairs)
    report["twin_pairs_merged"] = [[inv[a], inv[b]] for a, b in pairs]
    report["official_test"] = dict(zip(("top1", "top5"), top15(probs, yt)))
    report["unseen_signers"] = dict(zip(("top1", "top5"), top15(probs[unseen], yt[unseen])))
    report["seen_signers"] = dict(zip(("top1", "top5"), top15(probs[~unseen], yt[~unseen])))
    report["n_unseen"] = int(unseen.sum())
    print("official:", report["official_test"], "| unseen:", report["unseen_signers"])

    # ---- стриминг-проба (5 сидов, невиданные)
    pool = [Xt[i][: _valid_rows(Xt[i])].copy()
            for i in np.nonzero(yt == ne)[0] if _valid_rows(Xt[i]) >= 8]
    uns_ids = np.nonzero(unseen)[0]
    accs = []
    for seed in range(5):
        rng = np.random.default_rng(1000 + seed)
        Xw = np.stack([
            featurize(window_sim(Xt[i], float(lt[i]), rng, pool,
                                             cover_min=0.0 if yt[i] == ne else 0.7))
            for i in uns_ids])
        pw = model.predict(Xw, batch_size=256, verbose=0)
        pw, _ = pool_twins(pw, yt[uns_ids], pairs)
        accs.append(top15(pw, yt[uns_ids]))
    report["windowed_unseen"] = {
        "top1_mean": float(np.mean([a[0] for a in accs])),
        "top5_mean": float(np.mean([a[1] for a in accs])),
    }
    print("windowed unseen:", report["windowed_unseen"])

    # ---- температура на train-side val (window-simmed)
    val_signers = set(json.load(open(os.path.join(ML, "eval_split.json")))["val_signers"])
    val_ids = sorted(k for k, v in idx.items()
                     if v["split"] == "train" and v["user"] in val_signers)
    Xv = np.stack([np.load(os.path.join(ML, "landmarks_holistic", "train", k + ".npy"))
                   for k in val_ids]).astype(np.float32)
    yv = np.array([idx[k]["label"] for k in val_ids])
    lv = np.array([lens.get(k, 0.0) for k in val_ids], dtype=np.float32)
    rng = np.random.default_rng(123)
    Xvw = np.concatenate([
        np.stack([featurize(window_sim(a, float(L), rng, pool,
                                                   cover_min=0.0 if yy == ne else 0.7))
                  for a, L, yy in zip(Xv, lv, yv)])
        for _ in range(3)])
    yvw = np.tile(yv, 3)
    pv = model.predict(Xvw, batch_size=256, verbose=0)
    logits = np.log(np.clip(pv, 1e-12, 1.0))  # softmax монотонен: log(p) ~ логиты + const
    best_T, best_nll = 1.0, np.inf
    for Tt in np.arange(0.8, 3.01, 0.05):
        z = logits / Tt
        z -= z.max(1, keepdims=True)
        p = np.exp(z)
        p /= p.sum(1, keepdims=True)
        nll = -float(np.mean(np.log(np.clip(p[np.arange(len(yvw)), yvw], 1e-12, 1))))
        if nll < best_nll:
            best_nll, best_T = nll, float(Tt)
    report["temperature"] = best_T
    print(f"temperature: {best_T:.2f} (nll {best_nll:.3f})")

    # ---- рабочая точка no_event (с температурой)
    def with_T(p):
        z = np.log(np.clip(p, 1e-12, 1.0)) / best_T
        z -= z.max(1, keepdims=True)
        e = np.exp(z)
        return e / e.sum(1, keepdims=True)

    ne_mask = yt == ne
    p_ne = with_T(probs[ne_mask])
    sign_ids_t = np.nonzero(~ne_mask)[0]
    rng = np.random.default_rng(77)
    Xneg = np.stack([synth_negative(Xt, lt, sign_ids_t, rng, pool) for _ in range(500)])
    p_neg = with_T(model.predict(np.stack([featurize(a) for a in Xneg]),
                                 batch_size=256, verbose=0))
    op = {}
    for thr in (0.5, 0.6, 0.7):
        # recall: idle-клип не даёт уверенного знака
        sign_conf = np.delete(p_ne, ne, axis=1).max(1)
        op[f"idle_ok@{thr}"] = float((sign_conf < thr).mean())
        neg_conf = np.delete(p_neg, ne, axis=1).max(1)
        op[f"false_fire@{thr}"] = float((neg_conf >= thr).mean())
    report["no_event_operating"] = op
    print("no_event:", op)

    # ---- дактиль: явный список 33 букв русского алфавита (после слияния дублей)
    dactyl = [k for k in RUS_ALPHABET if k in lm]
    rec = {}
    for d in sorted(dactyl):
        m = yt == lm[d]
        if m.any():
            rec[d] = float((probs[m].argmax(1) == lm[d]).mean())
    report["dactyl_recall_mean"] = float(np.mean(list(rec.values()))) if rec else None
    report["dactyl_recall"] = rec
    print(f"dactyl mean recall: {report['dactyl_recall_mean']:.3f} ({len(rec)} букв)")

    # ---- вжигаем температуру в логиты и сохраняем калиброванный чекпойнт
    data = dict(np.load(os.path.join(CKPT, args.ckpt)))
    data["logits/0"] = data["logits/0"] / best_T
    data["logits/1"] = data["logits/1"] / best_T
    np.savez(os.path.join(CKPT, "calibrated.weights.npz"), **data)
    print("calibrated.weights.npz сохранён")

    json.dump(report, open(os.path.join(CKPT, "eval_report.json"), "w"),
              ensure_ascii=False, indent=2)
    print("report -> ml/checkpoints/eval_report.json")


if __name__ == "__main__":
    main()

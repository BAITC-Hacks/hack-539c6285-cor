"""Сколько даёт сужение словаря — БЕЗ переобучения.

Идея: обученная модель на 1001 класс уже знает, что видит; ошибается она,
выбирая между похожими знаками. Если в сценарии допустимы только N знаков,
лишние классы можно просто занулить на выходе. Это бесплатно и обратимо.

Протокол оценки совпадает с evaluate.py, чтобы числа были сравнимы:
невиданные подписанты (1652 клипа), дубли С/с и Я/я слиты.

Меряем две вещи:
  1. кривая «размер словаря -> точность» на случайных подсловарях
     (несколько розыгрышей на размер, чтобы не поймать удачную выборку);
  2. точность на curated-словаре из vocab_scenario.json, если он есть.

no_event всегда остаётся в словаре: без него в проде некому молчать.

Запуск: ml/venv/bin/python ml/vocab_experiment.py [--ckpt calibrated.weights.npz]
Результат: ml/checkpoints/vocab_report.json
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

from features import featurize  # noqa: E402
from model_def import build_model  # noqa: E402
from export_tfjs import load_weights_npz  # noqa: E402
from evaluate import twin_pairs, pool_twins, top15  # noqa: E402

ML = os.path.dirname(os.path.abspath(__file__))
CKPT = os.path.join(ML, "checkpoints")
SIZES = [50, 100, 150, 200, 300, 500, 1001]
DRAWS = 5  # розыгрышей случайного подсловаря на каждый размер


def restricted(probs, y, keep):
    """Точность, когда допустимы только классы keep.

    Строки берём те, чья истина попала в словарь: остальные знаки в этом
    сценарии просто не показывают. Колонки вне словаря зануляем.
    """
    keep = np.asarray(sorted(keep))
    rows = np.isin(y, keep)
    if rows.sum() == 0:
        return None
    sub = probs[rows][:, keep]
    ytrue = y[rows]
    # истину переводим в локальные индексы подсловаря
    remap = {g: i for i, g in enumerate(keep)}
    ylocal = np.array([remap[v] for v in ytrue])
    return top15(sub, ylocal) + (int(rows.sum()),)


def confusions(probs, y, keep, inv):
    """Пары «истина -> что предсказано вместо неё» внутри словаря, по убыванию."""
    keep = np.asarray(sorted(keep))
    rows = np.isin(y, keep)
    pred = keep[probs[rows][:, keep].argmax(1)]
    true = y[rows]
    total = {g: int((true == g).sum()) for g in keep}
    pairs = {}
    for t, p in zip(true, pred):
        if t != p:
            pairs[(t, p)] = pairs.get((t, p), 0) + 1
    out = [{"true": inv[t], "pred": inv[p], "n": n, "total": total[t]}
           for (t, p), n in pairs.items()]
    return sorted(out, key=lambda d: -d["n"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", default="calibrated.weights.npz")
    args = ap.parse_args()

    idx = json.load(open(os.path.join(ML, "landmarks_holistic", "file_index.json")))
    lm = json.load(open(os.path.join(ML, "landmarks_holistic", "label_map.json")))
    inv = {v: k for k, v in lm.items()}
    ne = lm["no_event"]

    # ---- невиданные подписанты, тот же отбор, что в evaluate.py
    test_ids = sorted(k for k, v in idx.items() if v["split"] == "test")
    Xt = np.stack([np.load(os.path.join(ML, "landmarks_holistic", "test", k + ".npy"))
                   for k in test_ids]).astype(np.float32)
    yt = np.array([idx[k]["label"] for k in test_ids])
    users_t = np.array([idx[k]["user"] for k in test_ids])
    train_users = {v["user"] for v in idx.values() if v["split"] == "train"}
    unseen = ~np.isin(users_t, sorted(train_users))

    print(f"невиданных клипов: {unseen.sum()}", flush=True)
    model = build_model(keras)
    load_weights_npz(model, os.path.join(CKPT, args.ckpt))

    Xn = np.stack([featurize(a) for a in Xt])
    probs_raw = model.predict(Xn, batch_size=256, verbose=0)
    pairs = twin_pairs(lm)
    probs, yt = pool_twins(probs_raw, yt, pairs)
    dup = {b for _, b in pairs}  # классы-дубли из словаря исключаем

    P, Y = probs[unseen], yt[unseen]
    report = {"checkpoint": args.ckpt, "n_unseen": int(unseen.sum())}

    base = restricted(P, Y, [c for c in range(probs.shape[1]) if c not in dup])
    report["baseline_1001"] = {"top1": base[0], "top5": base[1], "n": base[2]}
    print(f"базовая линия, 1001 класс: top1={base[0]:.4f} top5={base[1]:.4f}", flush=True)

    # ---- кривая по случайным подсловарям
    pool = [c for c in range(probs.shape[1]) if c not in dup and c != ne]
    curve = []
    for n in SIZES:
        if n > len(pool):
            continue
        runs = []
        for d in range(DRAWS):
            rng = np.random.default_rng(500 + d)
            keep = list(rng.choice(pool, size=min(n, len(pool)), replace=False)) + [ne]
            r = restricted(P, Y, keep)
            if r:
                runs.append(r)
        if not runs:
            continue
        t1 = [r[0] for r in runs]
        t5 = [r[1] for r in runs]
        curve.append({"size": n, "top1_mean": float(np.mean(t1)),
                      "top1_std": float(np.std(t1)), "top5_mean": float(np.mean(t5)),
                      "n_clips_mean": float(np.mean([r[2] for r in runs]))})
        print(f"словарь {n:5}: top1={np.mean(t1):.4f} ±{np.std(t1):.4f}  "
              f"top5={np.mean(t5):.4f}  клипов≈{np.mean([r[2] for r in runs]):.0f}", flush=True)
    report["random_vocab_curve"] = curve

    # ---- curated словари сценариев
    scen_path = os.path.join(ML, "vocab_scenario.json")
    if os.path.exists(scen_path):
        scen = json.load(open(scen_path))["scenarios"]
        report["scenarios"] = {}
        for name, cfg in scen.items():
            words = list(cfg["words"])
            if cfg.get("extends"):
                words += scen[cfg["extends"]]["words"]
            words = [w for w in words if w not in set(cfg.get("excludes", []))]
            missing = sorted({w for w in words if w not in lm})
            keep = sorted({lm[w] for w in words if w in lm} | {ne})
            r = restricted(P, Y, keep)
            report["scenarios"][name] = {
                "about": cfg.get("_about", ""),
                "n_words_requested": len(set(words)), "n_words_found": len(keep) - 1,
                "missing": missing,
                "top1": r[0], "top5": r[1], "n_clips": r[2],
            }
            print(f"\n[{name}] {len(keep)-1} знаков: top1={r[0]:.4f} "
                  f"top5={r[1]:.4f} на {r[2]} клипах", flush=True)
            if missing:
                print(f"  нет в SLOVO ({len(missing)}): {', '.join(missing)}", flush=True)

            # какие знаки внутри словаря съедают друг друга
            conf = confusions(P, Y, keep, inv)
            report["scenarios"][name]["top_confusions"] = conf[:15]
            if conf:
                print("  чаще всего путается:", flush=True)
                for c in conf[:8]:
                    print(f"    {c['true']:24} -> {c['pred']:24} {c['n']}/{c['total']}",
                          flush=True)

    out = os.path.join(CKPT, "vocab_report.json")
    json.dump(report, open(out, "w"), ensure_ascii=False, indent=1)
    print(f"\n-> {out}")


if __name__ == "__main__":
    main()

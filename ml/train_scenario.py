"""Дообучение распознавателя на словаре сценария (перенос весов с 1001-классовой).

Зачем не с нуля: в SLOVO ровно 20 клипов на класс, после подписант-дизъюнктного
отбора в train остаётся ~15. Учить 4M параметров с нуля на таком объёме — верный
оверфит. Ствол уже видел тысячу знаков и умеет извлекать признаки; меняется
только голова.

Что делаем:
  1. фильтруем корпус до классов сценария, метки перенумеровываем в 0..K-1;
  2. строим модель на K классов, переносим ВСЕ веса кроме logits;
  3. учим в два этапа: сначала только голова (ствол заморожен), потом весь
     ствол на низком LR — стандартный протокол переноса, ствол не разносит
     случайной головой на первых шагах;
  4. меряем тем же протоколом, что vocab_experiment.py, чтобы сравнение с
     маской было честным.

Сравниваем ровно с одним числом: точность 1001-классовой модели, у которой
на выходе оставлены только классы сценария (маска). Если дообучение её не
бьёт — значит маски достаточно, и это тоже результат.

Запуск: ml/venv/bin/python ml/train_scenario.py --scenario counter_lean
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

from augment import _valid_rows, window_sim  # noqa: E402
from features import featurize  # noqa: E402
from model_def import build_model  # noqa: E402
from export_tfjs import load_weights_npz, save_weights_npz  # noqa: E402
from train_rsl import (TrainData, EMACheckpoint, WarmupCosine,  # noqa: E402
                       signer_disjoint_val, BATCH, WD, SMOOTH)
from evaluate import twin_pairs, top15  # noqa: E402

ML = os.path.dirname(os.path.abspath(__file__))
CKPT = os.path.join(ML, "checkpoints")
LMH = os.path.join(ML, "landmarks_holistic")


def scenario_classes(name, lm):
    """Глобальные id классов сценария, дубли сведены к каноническому.

    Дубли (С/с, Я/я) — это один и тот же знак, записанный дважды. Если оставить
    оба id, часть клипов класса уедет в другой столбец и метрика поедет.
    """
    scen = json.load(open(os.path.join(ML, "vocab_scenario.json")))["scenarios"]
    cfg = scen[name]
    words = list(cfg["words"])
    if cfg.get("extends"):
        words += scen[cfg["extends"]]["words"]
    words = [w for w in words if w not in set(cfg.get("excludes", []))]
    canon = {b: a for a, b in twin_pairs(lm)}  # дубль -> канонический
    ids = {canon.get(lm[w], lm[w]) for w in words if w in lm}
    ids.add(lm["no_event"])
    missing = sorted({w for w in words if w not in lm})
    return sorted(ids), missing


def load_subset(keep_global, lm):
    """Корпус train, отфильтрованный до классов сценария, метки локальные."""
    idx = json.load(open(os.path.join(LMH, "file_index.json")))
    lens = {r["attachment_id"]: float(r["length"])
            for r in csvmod.DictReader(open(os.path.join(ML, "annotations.csv")),
                                       delimiter="\t")}
    canon = {b: a for a, b in twin_pairs(lm)}
    g2l = {g: i for i, g in enumerate(keep_global)}

    ids = sorted(k for k, v in idx.items()
                 if v["split"] == "train"
                 and canon.get(v["label"], v["label"]) in g2l)
    X = np.empty((len(ids), 60, 255), dtype=np.float32)
    y = np.empty(len(ids), dtype=np.int64)
    users, raw_len = [], np.empty(len(ids), dtype=np.float32)
    for i, k in enumerate(ids):
        X[i] = np.load(os.path.join(LMH, "train", k + ".npy"))
        y[i] = g2l[canon.get(idx[k]["label"], idx[k]["label"])]
        users.append(idx[k]["user"])
        raw_len[i] = lens.get(k, 0.0)
    users = np.array(users)

    # знаковые клипы, где руки не нашлись ни разу, — мусор
    hands = np.abs(X[:, :, 129:255]).sum(axis=(1, 2)) > 0
    ne_local = g2l[lm["no_event"]]
    keep = hands | (y == ne_local)
    print(f"корпус сценария: {len(ids)} клипов, выброшено без рук: {int((~keep).sum())}")
    return X[keep], y[keep], users[keep], raw_len[keep], ne_local


def eval_unseen(model, keep_global, lm, ne_local):
    """Тот же протокол, что в vocab_experiment.py: невиданные подписанты."""
    idx = json.load(open(os.path.join(LMH, "file_index.json")))
    lens = {r["attachment_id"]: float(r["length"])
            for r in csvmod.DictReader(open(os.path.join(ML, "annotations.csv")),
                                       delimiter="\t")}
    canon = {b: a for a, b in twin_pairs(lm)}
    g2l = {g: i for i, g in enumerate(keep_global)}
    train_users = {v["user"] for v in idx.values() if v["split"] == "train"}

    ids = sorted(k for k, v in idx.items()
                 if v["split"] == "test"
                 and v["user"] not in train_users
                 and canon.get(v["label"], v["label"]) in g2l)
    X = np.stack([np.load(os.path.join(LMH, "test", k + ".npy")) for k in ids]).astype(np.float32)
    y = np.array([g2l[canon.get(idx[k]["label"], idx[k]["label"])] for k in ids])
    L = np.array([lens.get(k, 0.0) for k in ids], dtype=np.float32)

    p = model.predict(np.stack([featurize(a) for a in X]), batch_size=256, verbose=0)
    t1, t5 = top15(p, y)

    # стриминг: то же окно, что видит браузер
    pool = [X[i][: _valid_rows(X[i])].copy()
            for i in np.nonzero(y == ne_local)[0] if _valid_rows(X[i]) >= 8]
    w1s, w5s = [], []
    for seed in range(5):
        rng = np.random.default_rng(1000 + seed)
        Xw = np.stack([featurize(window_sim(X[i], float(L[i]), rng, pool,
                                            cover_min=0.0 if y[i] == ne_local else 0.7))
                       for i in range(len(y))])
        a, b = top15(model.predict(Xw, batch_size=256, verbose=0), y)
        w1s.append(a); w5s.append(b)

    # рабочая точка тишины: как часто молчание читается как знак
    ne_rows = y == ne_local
    conf = p[~ne_rows].max(1)
    ff = {f"false_fire@{t}": float((conf >= t).mean()) for t in (0.5, 0.6, 0.7)}
    idle = p[ne_rows]
    ok = {f"idle_ok@{t}": float((idle.argmax(1) == ne_local).mean())
          for t in (0.5, 0.6, 0.7)}
    return {"n": int(len(y)), "top1": t1, "top5": t5,
            "windowed_top1": float(np.mean(w1s)), "windowed_top5": float(np.mean(w5s)),
            **ff, **ok}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenario", default="counter_lean")
    ap.add_argument("--init", default="best.weights.npz")
    ap.add_argument("--head-epochs", type=int, default=25)
    ap.add_argument("--full-epochs", type=int, default=120)
    ap.add_argument("--smoke", action="store_true")
    args = ap.parse_args()

    lm = json.load(open(os.path.join(LMH, "label_map.json")))
    keep_global, missing = scenario_classes(args.scenario, lm)
    K = len(keep_global)
    tag = f"_{args.scenario}"
    print(f"сценарий {args.scenario}: {K} классов (включая no_event)")
    if missing:
        print(f"нет в SLOVO: {', '.join(missing)}")

    X, y, users, raw_len, ne_local = load_subset(keep_global, lm)
    val_mask = signer_disjoint_val(
        y, users, ne_local, target_clips=max(300, int(0.12 * len(y))),
        num_classes=K, out_path=os.path.join(ML, f"eval_split{tag}.json"))
    tr = ~val_mask

    pool = [X[i][: _valid_rows(X[i])].copy()
            for i in np.nonzero((y == ne_local) & tr)[0] if _valid_rows(X[i]) >= 8]
    Xv, yv = X[val_mask], y[val_mask]
    x_val = np.stack([featurize(a) for a in Xv])
    rng = np.random.default_rng(123)
    x_wval = np.stack([featurize(window_sim(a, float(L), rng, pool,
                                            cover_min=0.0 if yy == ne_local else 0.7))
                       for a, L, yy in zip(Xv, raw_len[val_mask], yv)])
    print(f"train {int(tr.sum())}, val {int(val_mask.sum())}, no_event pool {len(pool)}")

    if args.smoke:
        args.head_epochs, args.full_epochs = 1, 1

    # ---- модель: перенос всего, кроме головы
    model = build_model(keras, num_classes=K)
    src = build_model(keras, num_classes=1001)
    load_weights_npz(src, os.path.join(CKPT, args.init))
    moved = 0
    for dst_l in model.layers:
        if dst_l.name == "logits" or not dst_l.weights:
            continue
        src_l = src.get_layer(dst_l.name)
        dst_l.set_weights(src_l.get_weights())
        moved += 1
    del src
    print(f"перенесено слоёв: {moved}, голова logits инициализирована заново")

    dactyl_ids = {i for i, g in enumerate(keep_global)
                  if len({k for k, v in lm.items() if v == g and len(k) == 1 and k.isalpha()})}
    data = TrainData(X[tr], y[tr], raw_len[tr], ne_local, pool, dactyl_ids,
                     run_seed=42, num_classes=K,
                     workers=6, use_multiprocessing=False, max_queue_size=8)
    steps = len(data)

    def compile_with(peak, epochs):
        opt = keras.optimizers.AdamW(
            learning_rate=WarmupCosine(peak=peak, warmup_steps=max(1, 2 * steps),
                                       total_steps=max(2, epochs * steps)),
            weight_decay=WD, clipnorm=1.0)
        try:
            opt.exclude_from_weight_decay(var_names=["bias", "gamma", "beta"])
        except Exception:
            pass
        model.compile(optimizer=opt,
                      loss=keras.losses.CategoricalCrossentropy(label_smoothing=SMOOTH),
                      metrics=[keras.metrics.CategoricalAccuracy()])

    with open(os.path.join(CKPT, f"train_log{tag}.csv"), "w") as fh:
        fh.write("epoch,time,loss,train_acc,val1,val5,wval1,wval5,best,wait\n")

    t0 = time.time()
    # этап 1: только голова, ствол заморожен
    for l in model.layers:
        l.trainable = (l.name == "logits")
    compile_with(3e-3, args.head_epochs)
    print(f"\n=== этап 1: голова, {args.head_epochs} эпох, {steps} шагов ===", flush=True)
    cb1 = EMACheckpoint(x_val, yv, x_wval, yv, patience=999, tag=tag)
    model.fit(data, epochs=args.head_epochs, callbacks=[cb1], verbose=2)

    # этап 2: весь ствол на низком LR
    for l in model.layers:
        l.trainable = True
    compile_with(2e-4, args.full_epochs)
    print(f"\n=== этап 2: весь ствол, до {args.full_epochs} эпох ===", flush=True)
    cb2 = EMACheckpoint(x_val, yv, x_wval, yv, patience=25, tag=tag)
    cb2.best, cb2.best_w = cb1.best, cb1.best_w
    model.fit(data, epochs=args.full_epochs, callbacks=[cb2], verbose=2)
    hours = (time.time() - t0) / 3600

    # ---- честная оценка лучшего чекпойнта
    load_weights_npz(model, os.path.join(CKPT, f"best{tag}.weights.npz"))
    res = eval_unseen(model, keep_global, lm, ne_local)
    report = {
        "scenario": args.scenario, "num_classes": K, "init": args.init,
        "missing_words": missing, "hours": round(hours, 2),
        "val_best_top1": cb2.best, "val_best_windowed_top1": cb2.best_w,
        "unseen_signers": res,
        "classes": [k for g in keep_global
                    for k, v in [min(((k, v) for k, v in lm.items() if v == g),
                                     key=lambda kv: len(kv[0]))]],
    }
    out = os.path.join(CKPT, f"scenario_report{tag}.json")
    json.dump(report, open(out, "w"), ensure_ascii=False, indent=1)
    print(f"\n=== дообучено за {hours:.2f}ч ===")
    print(f"невиданные подписанты: top1={res['top1']:.4f} top5={res['top5']:.4f} "
          f"(n={res['n']})")
    print(f"стриминг: top1={res['windowed_top1']:.4f}")
    print(f"ложные срабатывания @0.6: {res['false_fire@0.6']:.3f} | "
          f"тишина распознана @0.6: {res['idle_ok@0.6']:.3f}")
    print(f"-> {out}")


if __name__ == "__main__":
    main()

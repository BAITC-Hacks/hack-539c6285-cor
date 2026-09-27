"""Сравнение моделей при ОДИНАКОВОМ бюджете ложных срабатываний.

Голая точность обманывает, когда модели по-разному разговорчивы. Модель,
которая чаще выкрикивает слова в тишину, набирает лишние попадания на
знаковых клипах — и выглядит точнее, будучи в работе хуже.

Поэтому меряем так: подбираем каждой модели свой порог уверенности, при
котором доля ложных срабатываний на клипах ТИШИНЫ одинакова, и только потом
смотрим, кто больше знаков узнал. За стойкой это и есть рабочая точка:
сколько слов система поймает, если ей разрешено ошибаться в тишину не чаще
чем в N% случаев.

Запуск: ml/venv/bin/python ml/operating_point.py best.weights.npz best_ssl.weights.npz
"""
import argparse
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
from evaluate import twin_pairs, pool_twins  # noqa: E402
from compare_models import load_eval  # noqa: E402

ML = os.path.dirname(os.path.abspath(__file__))
CKPT = os.path.join(ML, "checkpoints")
BUDGETS = [0.02, 0.05, 0.10, 0.15]


def curve(probs, y, ne):
    """Порог -> (доля ложных в тишину, доля верно узнанных знаков)."""
    idle = probs[y == ne]
    sign = probs[y != ne]
    ysign = y[y != ne]
    idle_loud = np.delete(idle, ne, axis=1).max(1)
    sign_conf = np.delete(sign, ne, axis=1).max(1)
    sign_pred = np.delete(sign, ne, axis=1).argmax(1)
    sign_pred[sign_pred >= ne] += 1                # вернуть исходную нумерацию
    hit = sign_pred == ysign
    ts = np.unique(np.concatenate([idle_loud, [0.0, 1.01]]))
    return ts, idle_loud, sign_conf, hit


def at_budget(ts, idle_loud, sign_conf, hit, budget):
    """Наименьший порог, удерживающий ложные в пределах бюджета."""
    ok = [t for t in ts if (idle_loud >= t).mean() <= budget]
    if not ok:
        return None
    t = min(ok)
    fired = sign_conf >= t
    return {"threshold": float(t),
            "false_fire": float((idle_loud >= t).mean()),
            "recall": float((hit & fired).mean()),
            "fire_rate": float(fired.mean())}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ckpts", nargs="+")
    ap.add_argument("--scenario", default=None,
                    help="ограничить классы словарём сценария из vocab_scenario.json")
    ap.add_argument("--stream", action="store_true",
                    help="прогнать знаковые клипы через симуляцию боевого окна: окно режет таймер, а не человек")
    ap.add_argument("--n-synth", type=int, default=1200,
                    help="сколько синтетических негативов достроить")
    args = ap.parse_args()

    lm = json.load(open(os.path.join(ML, "landmarks_holistic", "label_map.json")))
    ne, pairs = lm["no_event"], twin_pairs(lm)
    X, y, L, unseen = load_eval()
    Xn = np.stack([featurize(a) for a in X])

    # Настоящих клипов тишины в тесте всего 42 — на них разницу в ложных
    # срабатываниях не измерить: 2 промаха против 6 неотличимы от случайности.
    # Достраиваем негативы так же, как evaluate.py: обрывки знаков, переходы
    # между знаками и стоп-кадры, собранные ИЗ ТЕСТОВЫХ клипов. Именно на них
    # система и должна молчать в работе.
    keep, ne_local = None, ne
    if args.scenario:
        from train_scenario import scenario_classes
        keep, _miss = scenario_classes(args.scenario, lm)
        keep = np.asarray(keep)
        ne_local = int(np.nonzero(keep == ne)[0][0])
        print(f"словарь {args.scenario}: {len(keep)} классов (включая тишину)")

    from augment import synth_negative, _valid_rows, window_sim
    real_idle = np.nonzero((y == ne) & unseen)[0]
    pool = [X[i][: _valid_rows(X[i])].copy() for i in real_idle if _valid_rows(X[i]) >= 8]
    sign_rows = np.nonzero((y != ne) & unseen)[0]
    rng = np.random.default_rng(7)
    synth = np.stack([featurize(synth_negative(X, L, sign_rows, rng, pool))
                      for _ in range(args.n_synth)])
    print(f"синтетических негативов: {len(synth)} (настоящей тишины было {len(real_idle)})")

    if args.stream:
        # Клипы теста нарезаны по знаку человеком. В работе окно режет таймер:
        # знак попадает в него частично и со сдвигом. Без этого число завышено.
        rng2 = np.random.default_rng(11)
        Xn = np.stack([featurize(window_sim(X[i], float(L[i]), rng2, pool,
                                            cover_min=0.0 if y[i] == ne else 0.7))
                       for i in range(len(y))])
        print("знаковые клипы прогнаны через симуляцию боевого окна")

    res = {}
    for c in args.ckpts:
        m = build_model(keras)
        load_weights_npz(m, os.path.join(CKPT, c))
        p, y2 = pool_twins(m.predict(Xn, batch_size=256, verbose=0), y.copy(), pairs)
        ps, _ = pool_twins(m.predict(synth, batch_size=256, verbose=0),
                           np.full(len(synth), ne), pairs)
        # тишину подменяем объединением настоящей и синтетической
        p_all = np.concatenate([p[unseen], ps])
        y_all = np.concatenate([y2[unseen], np.full(len(ps), ne)])
        if keep is not None:
            # строки: только знаки словаря (плюс вся тишина); столбцы: только словарь
            rows = np.isin(y_all, keep)
            p_all, y_all = p_all[rows][:, keep], y_all[rows]
            remap = {g: i for i, g in enumerate(keep)}
            y_all = np.array([remap[v] for v in y_all])
        res[c] = curve(p_all, y_all, ne_local)
        del m
        keras.backend.clear_session()
        print(f"  посчитан {c}", flush=True)

    n_idle = int((y_all == ne_local).sum())
    n_sign = int((y_all != ne_local).sum())
    print(f"\nневиданные: {n_sign} знаковых клипов, {n_idle} клипов тишины")
    print(f"\n{'бюджет ложных':>14} | " + " | ".join(f"{c[:26]:>26}" for c in res))
    print("-" * (16 + 29 * len(res)))
    for b in BUDGETS:
        cells = []
        for c in res:
            r = at_budget(*res[c], b)
            cells.append(f"{'—':>26}" if not r else
                         f"порог {r['threshold']:.2f}, узнано {r['recall']:.3f}".rjust(26))
        print(f"{b:>13.0%} | " + " | ".join(cells))

    out = os.path.join(CKPT, "operating_point.json")
    json.dump({"n_sign": n_sign, "n_idle": n_idle,
               "results": {c: {f"{b}": at_budget(*res[c], b) for b in BUDGETS}
                           for c in res}},
              open(out, "w"), ensure_ascii=False, indent=1)
    print(f"\n-> {out}")


if __name__ == "__main__":
    main()

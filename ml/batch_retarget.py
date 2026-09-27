"""Массовый ретаргетинг SLOVO -> библиотека жестов аватара.

Для каждого словесного класса (без no_event и дактильных букв — буквы
покрывает процедурный dactyl.ts) выбирает лучший клип по покрытию рук
и стабильности трекинга, конвертирует в gesture JSON и пишет индекс.

Выход: public/gestures/slovo/<файл>.json + public/gestures/slovo/index.json
        (маппинг «нормализованный текст -> имя файла», фразы отдельно)
"""
import json
import os
import re
import sys
import csv as csvmod

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from retarget import retarget  # noqa: E402

ML = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ML, "..", "public", "gestures", "slovo")


def norm_key(text: str) -> str:
    """Нормализация текста в ключ индекса: нижний регистр, без пунктуации."""
    t = text.lower().strip()
    t = re.sub(r"[!?.,:—-]+", "", t)
    return re.sub(r"\s+", " ", t).strip()


def file_key(text: str) -> str:
    """Ключ -> имя файла (пробелы в подчёркивания)."""
    return norm_key(text).replace(" ", "_")


def clip_score(a: np.ndarray) -> float:
    """Качество клипа: покрытие рук + штраф за рывки запястья."""
    alive = np.abs(a).sum(1) > 0
    if not alive.any():
        return -1.0
    hands = (np.abs(a[:, 129:255]).sum(1) > 0) & alive
    cover = hands.sum() / max(alive.sum(), 1)
    # рывки: дисперсия скачков правого запястья (pose 16)
    wr = a[alive][:, 16 * 3:16 * 3 + 2]
    jump = float(np.abs(np.diff(wr, axis=0)).max()) if alive.sum() > 2 else 1.0
    return float(cover) - min(jump, 0.5) * 0.3


def main():
    os.makedirs(OUT, exist_ok=True)
    idx = json.load(open(os.path.join(ML, "landmarks_holistic", "file_index.json")))
    lm = json.load(open(os.path.join(ML, "landmarks_holistic", "label_map.json")))
    lens = {r["attachment_id"]: float(r["length"])
            for r in csvmod.DictReader(open(os.path.join(ML, "annotations.csv")),
                                       delimiter="\t")}

    skip = {"no_event"} | {k for k in lm if len(k) == 1 and k.isalpha()}
    words = [k for k in lm if k not in skip]
    print(f"классов к конвертации: {len(words)}")

    by_label = {}
    for k, v in idx.items():
        by_label.setdefault(v["text"], []).append((k, v["split"]))

    index = {}
    phrases = {}
    done = fail = 0
    for w in sorted(words):
        clips = by_label.get(w, [])
        best, best_s = None, -2.0
        for k, split in clips:
            a = np.load(os.path.join(ML, "landmarks_holistic", split, k + ".npy"))
            s = clip_score(a.astype(np.float32))
            if s > best_s:
                best, best_s = (k, split, a.astype(np.float32)), s
        if best is None or best_s < 0.2:
            fail += 1
            continue
        k, split, a = best
        try:
            g = retarget(a, w, lens.get(k, 0.0), f"SLOVO {k[:8]} score={best_s:.2f}")
        except Exception as e:
            print(f"  ! {w}: {e}")
            fail += 1
            continue
        fk = file_key(w)
        json.dump(g, open(os.path.join(OUT, fk + ".json"), "w"),
                  ensure_ascii=False, separators=(",", ":"))
        key = norm_key(w)
        if " " in key:
            phrases[key] = fk
        else:
            index[key] = fk
        done += 1
        if done % 100 == 0:
            print(f"  {done}/{len(words)}")

    json.dump({"words": index, "phrases": phrases},
              open(os.path.join(OUT, "index.json"), "w"),
              ensure_ascii=False, separators=(",", ":"))
    total_mb = sum(os.path.getsize(os.path.join(OUT, f))
                   for f in os.listdir(OUT)) / 1e6
    print(f"готово: {done} жестов ({len(phrases)} фраз), пропущено {fail}, "
          f"{total_mb:.1f} MB в {OUT}")


if __name__ == "__main__":
    main()

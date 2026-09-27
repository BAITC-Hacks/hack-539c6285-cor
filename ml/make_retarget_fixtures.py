"""Генератор фикстур паритета для ретаргетинга: ml/fixtures/retarget_fixtures.json.

Берёт несколько реальных клипов SLOVO (сырые 60x255) и складывает рядом
эталонный выход ml/retarget.py. Проверка TS-порта: scripts/check-retarget-parity.mjs.

Запуск из корня репозитория: ml/venv/bin/python3 ml/make_retarget_fixtures.py
"""
import csv
import json
import os

import numpy as np

from retarget import retarget

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# клипы подобраны так, чтобы задеть все ветки: обе кисти видны; провал трекинга
# левой кисти (forward/backward fill); левой кисти нет вовсе (твист из плоскости
# локтя); хвостовой паддинг нулями (nv < 60) и клампы длительности.
PICKS = [
    "d3776bf0-31a9-4908-8304-1269419fb589",  # обе кисти, nv=60
    "d91a297a-e8f1-4c90-8095-4e02dc7094b1",  # провал левой кисти, nv=39
    "44e8d2a0-7e01-450b-90b0-beb7400d2c1e",  # левой кисти нет, nv=60
]


def main() -> None:
    idx = json.load(open(f"{ROOT}/ml/landmarks_holistic/file_index.json"))
    lens = {r["attachment_id"]: float(r["length"]) for r in
            csv.DictReader(open(f"{ROOT}/ml/annotations.csv"), delimiter="\t")}

    out = []
    for cid in PICKS:
        meta = idx[cid]
        arr = np.load(
            f"{ROOT}/ml/landmarks_holistic/{meta['split']}/{cid}.npy"
        ).astype(np.float32)
        raw_len = lens.get(cid, 0.0)
        name = meta["text"]
        expected = retarget(arr, name, raw_len, f"SLOVO {cid[:8]}")
        out.append({
            "id": cid,
            "name": name,
            "raw_len": raw_len,
            "raw": arr.tolist(),
            "expected": expected,
        })
        print(f"{cid} [{name}] raw_len={raw_len} -> {len(expected['frames'])} ключей")

    os.makedirs(f"{ROOT}/ml/fixtures", exist_ok=True)
    dst = f"{ROOT}/ml/fixtures/retarget_fixtures.json"
    json.dump(out, open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"-> {dst} ({os.path.getsize(dst) // 1024}KB)")


if __name__ == "__main__":
    main()

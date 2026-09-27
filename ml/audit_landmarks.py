"""Аудит качества извлечённых лэндмарков SLOVO (60x255).

Раскладка признаков на кадр: pose 33*3=99 | face 10*3=30 | lhand 21*3=63 | rhand 21*3=63.
Считает: доли кадров без рук/позы, полностью нулевые последовательности,
NaN/Inf, распределение "живых" кадров, худшие классы по наличию рук.
"""
import json
import os
import sys
from collections import defaultdict

import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "landmarks_holistic")
POSE = slice(0, 99)
FACE = slice(99, 129)
LH = slice(129, 192)
RH = slice(192, 255)

label_map = json.load(open(os.path.join(ROOT, "label_map.json")))
inv = {v: k for k, v in label_map.items()}


def audit_split(split):
    d = os.path.join(ROOT, split)
    files = sorted(os.listdir(d))
    n = len(files)
    stats = {
        "n": n, "all_zero_seq": 0, "nan_inf": 0,
        "frames_total": 0, "frames_zero": 0,
        "frames_no_pose": 0, "frames_no_lh": 0, "frames_no_rh": 0, "frames_no_hands": 0,
        "seq_never_any_hand": 0,
    }
    per_class_nohands = defaultdict(lambda: [0, 0])  # class -> [seqs_without_hands, total]
    live_frac = []
    for i, f in enumerate(files):
        a = np.load(os.path.join(d, f))
        if not np.isfinite(a).all():
            stats["nan_inf"] += 1
            a = np.nan_to_num(a)
        # класс из имени файла: <attachment_id>_<label>.npy или как сохранено
        frame_alive = np.abs(a).sum(axis=1) > 0
        pose_alive = np.abs(a[:, POSE]).sum(axis=1) > 0
        lh_alive = np.abs(a[:, LH]).sum(axis=1) > 0
        rh_alive = np.abs(a[:, RH]).sum(axis=1) > 0
        T = a.shape[0]
        stats["frames_total"] += T
        stats["frames_zero"] += int((~frame_alive).sum())
        stats["frames_no_pose"] += int((frame_alive & ~pose_alive).sum())
        stats["frames_no_lh"] += int((frame_alive & ~lh_alive).sum())
        stats["frames_no_rh"] += int((frame_alive & ~rh_alive).sum())
        no_hands = frame_alive & ~lh_alive & ~rh_alive
        stats["frames_no_hands"] += int(no_hands.sum())
        if not frame_alive.any():
            stats["all_zero_seq"] += 1
        any_hand_ever = bool((lh_alive | rh_alive).any())
        if not any_hand_ever:
            stats["seq_never_any_hand"] += 1
        live_frac.append(frame_alive.mean())
        # метка: имя файла содержит id; сопоставим через отдельный маппинг не будем — грубо по индексному файлу нет.
        if i % 4000 == 0:
            print(f"  {split}: {i}/{n}", file=sys.stderr)
    lf = np.array(live_frac)
    stats["live_frac_p5"] = float(np.percentile(lf, 5))
    stats["live_frac_p50"] = float(np.percentile(lf, 50))
    return stats


out = {}
for split in ("train", "test"):
    out[split] = audit_split(split)

# нормировки: диапазоны значений по небольшой выборке
sample = []
d = os.path.join(ROOT, "train")
for f in sorted(os.listdir(d))[::200]:
    sample.append(np.load(os.path.join(d, f)))
s = np.concatenate(sample)
alive = np.abs(s).sum(axis=1) > 0
s = s[alive]
out["value_ranges"] = {
    "pose_x_minmax": [float(s[:, 0:99:3].min()), float(s[:, 0:99:3].max())],
    "pose_y_minmax": [float(s[:, 1:99:3].min()), float(s[:, 1:99:3].max())],
    "pose_z_minmax": [float(s[:, 2:99:3].min()), float(s[:, 2:99:3].max())],
    "lh_x_minmax": [float(s[:, 129:192:3].min()), float(s[:, 129:192:3].max())],
    "rh_x_minmax": [float(s[:, 192:255:3].min()), float(s[:, 192:255:3].max())],
}

print(json.dumps(out, indent=2, ensure_ascii=False))
with open(os.path.join(os.path.dirname(__file__), "audit_report.json"), "w") as fh:
    json.dump(out, fh, indent=2, ensure_ascii=False)

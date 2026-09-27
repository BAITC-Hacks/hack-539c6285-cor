"""Ретаргетинг лэндмарков MediaPipe (60x255) -> gesture JSON для 3D-аватара.

Вход: сохранённые лэндмарки SLOVO (pose 33x3 | face 10x3 | lh 21x3 | rh 21x3,
сырые координаты изображения [0..1], отсутствие = нули).
Выход: формат gesturePlayer.ts — Euler XYZ дельты (радианы) от rest-позы
(руки опущены после applyNaturalStance) для 34 костей mixamorig.

Конвенции (см. отчёт реверса рига):
  Arm:  -X подъём вбок, +Y внешняя ротация, -Z вперёд (ИСПРАВЛЕНО: старый
        рекордер использовал +Z «назад» — выглядело верно только спереди).
  ForeArm: -Z сгиб локтя, +Y супинация (ладонь к зрителю), X вне плоскости.
  Пальцы: знаки дактиля — сгиб +Z правая / -Z левая (согласовано с
        процедурным fingerspelling, который пользователи уже видят).
  Левая сторона = (x, -y, -z) от правой.

Координаты: P = (x, -y, -z) от MediaPipe -> y вверх, персона лицом к +Z —
совпадает с мировыми осями аватара; правая рука персоны -> RightArm.
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

T = 60
POSE = slice(0, 99)
LH = slice(129, 192)
RH = slice(192, 255)

# индексы pose MediaPipe
L_SH, R_SH = 11, 12
L_EL, R_EL = 13, 14
L_WR, R_WR = 15, 16
L_HIP, R_HIP = 23, 24

# пальцы: (MCP, PIP, DIP, TIP)
FINGERS = {
    "Thumb": (1, 2, 3, 4),
    "Index": (5, 6, 7, 8),
    "Middle": (9, 10, 11, 12),
    "Ring": (13, 14, 15, 16),
    "Pinky": (17, 18, 19, 20),
}
# клампы по наблюдаемым диапазонам реальных файлов
CLAMP = {"F1": 2.0, "F2": 2.6, "F3": 1.6, "T1": 0.8, "T2": 1.0, "T3": 0.9,
         "ArmX": 2.2, "ArmZ": 1.8, "ForeY": 1.6, "ForeZ": 2.4, "ForeX": 0.9}


Z_DAMP_POSE = 0.25   # MediaPipe завышает глубину позы в разы (эмпирически)
Z_DAMP_HAND = 0.5


def _p_space(raw_block: np.ndarray, z_damp: float = 1.0) -> np.ndarray:
    """(N,3) MediaPipe -> P-space: y вверх, z вперёд (к зрителю), глубина погашена."""
    out = raw_block.copy()
    out[:, 1] = -out[:, 1]
    out[:, 2] = -out[:, 2] * z_damp
    return out


def _angle(u, v):
    nu, nv = np.linalg.norm(u), np.linalg.norm(v)
    if nu < 1e-6 or nv < 1e-6:
        return 0.0
    c = float(np.dot(u, v) / (nu * nv))
    return float(np.arccos(np.clip(c, -1.0, 1.0)))


def _norm(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-6 else v


def solve_frame(pose_p: np.ndarray, lh_p, rh_p, lh_ok: bool, rh_ok: bool):
    """Один кадр -> {имя кости: [x,y,z]}. pose_p/*_p уже в P-space."""
    bones = {}
    # телесная система
    rsh, lsh = pose_p[R_SH], pose_p[L_SH]
    mid_sh = (rsh + lsh) / 2
    mid_hip = (pose_p[R_HIP] + pose_p[L_HIP]) / 2
    ex = _norm(lsh - rsh)                    # к левому плечу (+X мира)
    ey = _norm(mid_sh - mid_hip)             # вверх
    ez = _norm(np.cross(ex, ey))             # вперёд (к зрителю)
    ey = _norm(np.cross(ez, ex))             # ортогонализация
    R = np.stack([ex, ey, ez])               # строки -> body coords: R @ v
    scale = max(float(np.linalg.norm(lsh - rsh)), 1e-3)

    def to_body(p, origin):
        return R @ ((p - origin) / scale)

    for side, sh_i, el_i, wr_i, hand_p, hand_ok in (
        ("Right", R_SH, R_EL, R_WR, rh_p, rh_ok),
        ("Left", L_SH, L_EL, L_WR, lh_p, lh_ok),
    ):
        s = 1.0 if side == "Right" else -1.0
        sh = pose_p[sh_i]
        d1 = _norm(to_body(pose_p[el_i], sh))
        d2 = _norm(to_body(pose_p[wr_i], sh) - to_body(pose_p[el_i], sh))

        # плечевая кость: разложение подъёма на фронтальную/сагиттальную части
        theta = _angle(d1, np.array([0.0, -1.0, 0.0]))
        lat = -d1[0] * s            # вбок от корпуса (для правой = -X тела)
        fwd = d1[2]                 # вперёд
        h = np.hypot(lat, fwd)
        if h < 1e-6:
            arm_x, arm_z = 0.0, 0.0
        else:
            arm_x = -theta * (lat / h)
            arm_z = -theta * (fwd / h) * s
        arm_x = float(np.clip(arm_x, -CLAMP["ArmX"], 0.6))
        arm_z = float(np.clip(arm_z, -CLAMP["ArmZ"], CLAMP["ArmZ"]))

        # локоть
        alpha = _angle(d1, d2)
        fore_z = float(np.clip(-alpha * s if s > 0 else alpha * s,
                               -CLAMP["ForeZ"], CLAMP["ForeZ"]))
        # для левой: зеркало (x, -y, -z) => сгиб локтя тоже -Z у правой, +Z у левой
        fore_z = float(np.clip(-alpha, -CLAMP["ForeZ"], 0.0)) if s > 0 else \
                 float(np.clip(alpha, 0.0, CLAMP["ForeZ"]))

        # супинация: нормаль ладони (если кисть видна) против направления "вбок"
        fore_y = 0.0
        fore_x = 0.0
        if hand_ok:
            w0 = to_body(hand_p[0], sh)
            i5 = to_body(hand_p[5], sh)
            p17 = to_body(hand_p[17], sh)
            palm_n = _norm(np.cross(i5 - w0, p17 - w0)) * s  # наружу от ладони
            # ладонь к зрителю (+Z тела) => супинация ~ +Y правой
            fore_y = float(np.clip(np.arcsin(np.clip(palm_n[2], -1, 1)),
                                   -CLAMP["ForeY"], CLAMP["ForeY"])) * s
        else:
            # руки нет — плоскость сгиба локтя как приближение твиста
            m = np.cross(d1, d2)
            if np.linalg.norm(m) > 1e-4:
                m = _norm(m)
                fore_y = float(np.clip(np.arctan2(m[2], -m[0] * s), -1.0, 1.0)) * 0.4 * s

        bones[f"mixamorig:{side}Arm"] = [round(arm_x, 4),
                                         round(0.15 * s, 4),
                                         round(arm_z, 4)]
        bones[f"mixamorig:{side}ForeArm"] = [round(fore_x, 4),
                                             round(fore_y, 4),
                                             round(fore_z, 4)]

        # пальцы
        if hand_ok:
            hp = np.array([to_body(p, sh) for p in hand_p])
            wrist = hp[0]
            for fname, (m_i, p_i, d_i, t_i) in FINGERS.items():
                if fname == "Thumb":
                    b1 = _angle(hp[m_i] - wrist, hp[p_i] - hp[m_i])
                    b2 = _angle(hp[p_i] - hp[m_i], hp[d_i] - hp[p_i])
                    b3 = _angle(hp[d_i] - hp[p_i], hp[t_i] - hp[d_i])
                    v1 = np.clip(0.6 * b1, 0, CLAMP["T1"])
                    v2 = np.clip(0.9 * b2, 0, CLAMP["T2"])
                    v3 = np.clip(0.9 * b3, 0, CLAMP["T3"])
                else:
                    palm_dir = _norm((hp[9] - wrist))
                    b1 = _angle(palm_dir, hp[p_i] - hp[m_i])
                    b2 = _angle(hp[p_i] - hp[m_i], hp[d_i] - hp[p_i])
                    b3 = _angle(hp[d_i] - hp[p_i], hp[t_i] - hp[d_i])
                    v1 = np.clip(1.1 * b1, 0, CLAMP["F1"])
                    v2 = np.clip(1.05 * b2, 0, CLAMP["F2"])
                    v3 = np.clip(0.95 * b3, 0, CLAMP["F3"])
                # знаки дактиля: правая +Z, левая -Z
                for j, v in ((1, v1), (2, v2), (3, v3)):
                    bones[f"mixamorig:{side}Hand{fname}{j}"] = [
                        0.0, 0.0, round(float(v) * s, 4)]
        else:
            for fname in FINGERS:
                for j in (1, 2, 3):
                    bones[f"mixamorig:{side}Hand{fname}{j}"] = [0.0, 0.0, 0.0]
    return bones


def _smooth(arr: np.ndarray, w: int = 5) -> np.ndarray:
    """Скользящее среднее по времени (N,K)."""
    if len(arr) < w:
        return arr
    pad = w // 2
    ext = np.concatenate([arr[:1].repeat(pad, 0), arr, arr[-1:].repeat(pad, 0)])
    ker = np.ones(w) / w
    out = np.stack([np.convolve(ext[:, k], ker, mode="valid")
                    for k in range(arr.shape[1])], axis=1)
    return out


def _forward_fill_block(seq: np.ndarray, sl: slice) -> np.ndarray:
    """Протянуть последний живой блок через провалы трекинга."""
    out = seq.copy()
    alive = np.abs(seq[:, sl]).sum(1) > 0
    last = None
    for t in range(len(seq)):
        if alive[t]:
            last = seq[t, sl].copy()
        elif last is not None:
            out[t, sl] = last
    # и назад — если провал в начале
    nxt = None
    for t in range(len(seq) - 1, -1, -1):
        if alive[t]:
            nxt = out[t, sl].copy()
        elif np.abs(out[t, sl]).sum() == 0 and nxt is not None:
            out[t, sl] = nxt
    return out


def retarget(seq: np.ndarray, name: str, raw_len: float,
             description: str = "") -> dict:
    """(60,255) -> gesture JSON dict."""
    alive = np.abs(seq).sum(1) > 0
    nv = int(np.max(np.nonzero(alive)) + 1) if alive.any() else 0
    if nv < 4:
        raise ValueError("слишком короткий клип")
    seq = seq[:nv]
    seq = _forward_fill_block(seq, LH)
    seq = _forward_fill_block(seq, RH)
    seq = _smooth(seq, 5)

    # тайминг: длительность из исходного видео (30 fps), клип растянут на nv кадров
    dur = float(np.clip((raw_len if raw_len >= 4 else nv) / 30.0, 1.2, 5.0))
    ease = 0.5

    body = []
    step = 2  # прореживание до ~15 ключей/сек
    for i in range(0, nv, step):
        fr = seq[i]
        pose_p = _p_space(fr[POSE].reshape(33, 3), Z_DAMP_POSE)
        lh_ok = bool(np.abs(fr[LH]).sum() > 0)
        rh_ok = bool(np.abs(fr[RH]).sum() > 0)
        lh_p = _p_space(fr[LH].reshape(21, 3), Z_DAMP_HAND)
        rh_p = _p_space(fr[RH].reshape(21, 3), Z_DAMP_HAND)
        bones = solve_frame(pose_p, lh_p, rh_p, lh_ok, rh_ok)
        t = ease + (i / max(nv - 1, 1)) * dur
        body.append({"t": round(t, 3), "bones": bones})

    # rest-опоры: ЯВНЫЕ нули для всех костей (плеер интерполирует только кости,
    # присутствующие в раннем кадре пары — пустой кадр даёт рывок вместо ease)
    all_bones = set()
    for f in body:
        all_bones.update(f["bones"].keys())
    zeros = {b: [0.0, 0.0, 0.0] for b in sorted(all_bones)}
    frames = ([{"t": 0.0, "bones": zeros}] + body +
              [{"t": round(ease + dur + ease, 3), "bones": zeros}])

    return {
        "name": name,
        "fps_target": 30,
        "rotation_order": "XYZ",
        "unit": "radians",
        "description": description or f"SLOVO retarget: {name}",
        "frames": frames,
    }


if __name__ == "__main__":
    # прогон золотых пар
    idx = json.load(open("ml/landmarks_holistic/file_index.json"))
    import csv as csvmod
    lens = {r["attachment_id"]: float(r["length"])
            for r in csvmod.DictReader(open("ml/annotations.csv"), delimiter="\t")}
    picks = json.load(open(
        "/private/tmp/claude-501/-Users-bakzhan-Downloads-qyran-web/"
        "cbe99e35-7e08-4667-97e6-5662c442e851/scratchpad/golden_picks.json"))
    os.makedirs("public/gestures/slovo", exist_ok=True)
    for word, (clip, score, split) in picks.items():
        a = np.load(f"ml/landmarks_holistic/{split}/{clip}.npy").astype(np.float32)
        g = retarget(a, word, lens.get(clip, 0.0), f"SLOVO {clip[:8]}")
        out = f"public/gestures/slovo/_golden_{word.rstrip('!').lower()}.json"
        json.dump(g, open(out, "w"), ensure_ascii=False,
                  separators=(",", ":"))
        kb = os.path.getsize(out) // 1024
        print(f"{word}: {len(g['frames'])} ключей, {kb}KB -> {out}")

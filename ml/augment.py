"""Аугментация лэндмарков SLOVO (сырое пространство 255 + пост-нормализационное 259).

Порядок на сэмпл: [window-sim ИЛИ synthetic-negative] -> mirror -> дропауты (raw)
-> normalize_window (255->259) -> rotation -> scale/shift -> jitter.
Валидация/тест — только normalize_window.

QYRAN_RECIPE=v2|v3 переключает рецепт (v3 не прошёл честный гейт — см. eval):
  v2: без тайм-масок, масштаб ±15%, без дактиль-спецрежима.
  v3: тайм-маски, масштаб ±5%, щадящий дактиль.
"""
import os

import numpy as np

RECIPE = os.environ.get("QYRAN_RECIPE", "v2")
TIME_MASK_P = 0.5 if RECIPE == "v3" else 0.0
SCALE_RANGE = (0.95, 1.05) if RECIPE == "v3" else (0.85, 1.15)

from features import normalize_window_fast as normalize_window
from features import append_relational, POSE, FACE, LH, RH, T

# пары индексов pose для зеркала (левое<->правое по разметке MediaPipe Pose)
POSE_SWAP = [(1, 4), (2, 5), (3, 6), (7, 8), (9, 10), (11, 12), (13, 14), (15, 16),
             (17, 18), (19, 20), (21, 22), (23, 24), (25, 26), (27, 28), (29, 30), (31, 32)]
# пары слотов face (наши 10 точек: [0,13,14,61,291,33,263,159,386,152])
FACE_SWAP = [(3, 4), (5, 6), (7, 8)]

NO_EVENT_JITTER = 0.004


def _valid_rows(seq: np.ndarray) -> int:
    """Число значащих кадров (отрезаем нулевой хвост-паддинг)."""
    alive = np.abs(seq).sum(axis=1) > 0
    if not alive.any():
        return 0
    return int(np.max(np.nonzero(alive)) + 1)


def _resample(rows: np.ndarray, target: int) -> np.ndarray:
    """Линейный ресемпл (n,255) -> (target,255)."""
    n = rows.shape[0]
    if n == target:
        return rows.copy()
    if n == 1:
        return np.repeat(rows, target, axis=0)
    pos = np.linspace(0.0, n - 1.0, target)
    lo = np.floor(pos).astype(np.int64)
    hi = np.minimum(lo + 1, n - 1)
    w = (pos - lo)[:, None].astype(np.float32)
    return rows[lo] * (1.0 - w) + rows[hi] * w


def _edge_hold(frame: np.ndarray, n: int, rng) -> np.ndarray:
    """Повтор кадра с лёгким дрожанием по присутствующим координатам."""
    out = np.repeat(frame[None, :], n, axis=0)
    mask = np.abs(out) > 0
    out += rng.normal(0.0, NO_EVENT_JITTER, out.shape).astype(np.float32) * mask
    return out


def _place_in_window(body: np.ndarray, rng, no_event_pool,
                     pad_edge_p: float = 0.60) -> np.ndarray:
    """Разместить body (<=60 кадров) в 60-кадровом окне со случайным сдвигом и паддингом."""
    L2 = body.shape[0]
    out = np.zeros((T, 255), dtype=np.float32)
    o = int(rng.integers(0, T - L2 + 1)) if L2 < T else 0
    out[o:o + L2] = body
    pads = []
    if o > 0:
        pads.append((0, o, body[0]))
    if o + L2 < T:
        pads.append((o + L2, T, body[-1]))
    for (a, b, edge) in pads:
        u = rng.random()
        if u < pad_edge_p:
            out[a:b] = _edge_hold(edge, b - a, rng)
        elif u < pad_edge_p + 0.25 and no_event_pool:
            src = no_event_pool[int(rng.integers(0, len(no_event_pool)))]
            if src.shape[0] >= b - a:
                st = int(rng.integers(0, src.shape[0] - (b - a) + 1))
                out[a:b] = src[st:st + (b - a)]
            else:
                out[a:b] = _edge_hold(edge, b - a, rng)
        # иначе — нули
    return out


def window_sim(seq: np.ndarray, raw_len: float, rng, no_event_pool,
               cover_min: float = 0.7, speed=(0.75, 1.3),
               pad_edge_p: float = 0.60) -> np.ndarray:
    """Симуляция боевого скользящего окна. seq: (60,255), raw_len — длина исходного видео."""
    nv = _valid_rows(seq)
    if nv < 2:
        return seq.copy()
    valid = seq[:nv]
    L = raw_len if raw_len and raw_len >= 2 else float(nv)
    u = rng.uniform(*speed)
    L2 = int(np.clip(round(L * u), 20, 90))
    body = _resample(valid, L2)
    if L2 <= T:
        return _place_in_window(body, rng, no_event_pool, pad_edge_p=pad_edge_p)
    # длиннее окна: случайный кроп с покрытием >= cover_min знака
    max_lost = int((1.0 - cover_min) * L2)
    start = int(rng.integers(0, min(max_lost, L2 - T) + 1))
    return body[start:start + T].copy()


def synth_negative(all_seqs, all_lens, sign_ids, rng, no_event_pool) -> np.ndarray:
    """Синтетический no_event: частичный знак / переход между знаками / стоп-кадр."""
    u = rng.random()
    if u < 0.45:
        # частичный знак: покрытие < 40%
        i = sign_ids[int(rng.integers(0, len(sign_ids)))]
        seq, L = all_seqs[i], all_lens[i]
        nv = _valid_rows(seq)
        if nv < 4:
            return _edge_hold(seq[0], T, rng)
        valid = seq[:nv]
        L2 = int(np.clip(round(max(L, nv) * rng.uniform(0.75, 1.3)), 20, 90))
        body = _resample(valid, L2)
        take = max(4, int(L2 * rng.uniform(0.15, 0.38)))
        piece = body[:take] if rng.random() < 0.5 else body[-take:]
        return _place_in_window(piece[:T], rng, no_event_pool)
    if u < 0.90:
        # переход: конец знака X + пауза + начало знака Y
        i = sign_ids[int(rng.integers(0, len(sign_ids)))]
        j = sign_ids[int(rng.integers(0, len(sign_ids)))]
        a, b = all_seqs[i], all_seqs[j]
        na, nb = _valid_rows(a), _valid_rows(b)
        if na < 4 or nb < 4:
            return _edge_hold(a[0], T, rng)
        ta = max(3, int(na * 0.3))
        tb = max(3, int(nb * 0.3))
        gap = int(rng.integers(4, 16))
        parts = [a[na - ta:na], _edge_hold(a[na - 1], gap, rng), b[:tb]]
        body = np.concatenate(parts)[:T]
        return _place_in_window(body, rng, no_event_pool)
    # стоп-кадр
    i = sign_ids[int(rng.integers(0, len(sign_ids)))]
    seq = all_seqs[i]
    nv = _valid_rows(seq)
    fr = seq[int(rng.integers(0, max(nv, 1)))]
    return _edge_hold(fr, T, rng)


def mirror(seq: np.ndarray) -> np.ndarray:
    """Зеркало по x в сыром пространстве + обмен левое/правое."""
    out = seq.copy()
    for sl, npts in ((POSE, 33), (FACE, 10), (LH, 21), (RH, 21)):
        block = out[:, sl]
        present = np.abs(block).sum(axis=1) > 0
        pts = block.reshape(seq.shape[0], npts, 3)
        pts[present, :, 0] = 1.0 - pts[present, :, 0]
    # обмен блоков кистей
    lh = out[:, LH].copy()
    out[:, LH] = out[:, RH]
    out[:, RH] = lh
    # пары pose
    pose = out[:, POSE].reshape(seq.shape[0], 33, 3)
    for (a, b) in POSE_SWAP:
        pose[:, [a, b]] = pose[:, [b, a]]
    face = out[:, FACE].reshape(seq.shape[0], 10, 3)
    for (a, b) in FACE_SWAP:
        face[:, [a, b]] = face[:, [b, a]]
    return out


def raw_dropouts(seq: np.ndarray, rng) -> np.ndarray:
    """Дропауты трекинга: кисть/лицо на непрерывном отрезке, статтер, тайм-маски."""
    out = seq.copy()
    if rng.random() < 0.15:
        sl = LH if rng.random() < 0.5 else RH
        span = int(rng.integers(4, 16))
        st = int(rng.integers(0, T - span + 1))
        out[st:st + span, sl] = 0.0
    if rng.random() < 0.05:
        span = int(rng.integers(5, 21))
        st = int(rng.integers(0, T - span + 1))
        out[st:st + span, FACE] = 0.0
    stut = rng.random(T) < 0.05
    stut[0] = False
    for t in np.nonzero(stut)[0]:
        out[t] = out[t - 1]
    # тайм-маскинг: 1-2 сплошных провала по 4-8 кадров (обнуление всего кадра)
    if rng.random() < TIME_MASK_P:
        for _ in range(int(rng.integers(1, 3))):
            span = int(rng.integers(4, 9))
            st = int(rng.integers(0, T - span + 1))
            out[st:st + span] = 0.0
    return out


def post_norm_aug(x: np.ndarray, rng, gentle_hands: bool = False) -> np.ndarray:
    """Аугментация после нормализации (259): поворот, масштаб/сдвиг, шум. Флаги не трогаем.

    gentle_hands: вдвое меньший шум на форме кистей (для дактиля — статичные
    конфигурации пальцев, где шум 0.008 сопоставим с межбуквенной разницей).
    """
    out = x.copy()
    coords = out[:, :255]
    flags = out[:, 255:]
    # маска присутствия по блокам, размноженная на координаты
    present = np.concatenate([
        np.repeat(flags[:, 0:1], 99, axis=1),
        np.repeat(flags[:, 1:2], 30, axis=1),
        np.repeat(flags[:, 2:3], 63, axis=1),
        np.repeat(flags[:, 3:4], 63, axis=1),
    ], axis=1)
    if rng.random() < 0.5:
        th = np.deg2rad(rng.uniform(-12.0, 12.0))
        c, s = np.cos(th), np.sin(th)
        xs = coords[:, 0::3].copy()
        ys = coords[:, 1::3].copy()
        coords[:, 0::3] = xs * c - ys * s
        coords[:, 1::3] = xs * s + ys * c
    if rng.random() < 0.5:
        coords *= rng.uniform(*SCALE_RANGE)
        # сдвиг только телесных координат: pose, face, запястья кистей
        dx, dy = rng.uniform(-0.08, 0.08, 2)
        for (a, b) in ((0, 99), (99, 129), (129, 132), (192, 195)):
            coords[:, a:b:3] += dx
            coords[:, a + 1:b:3] += dy
    if rng.random() < 0.7:
        noise = rng.normal(0.0, 0.008, coords.shape).astype(np.float32)
        if gentle_hands:
            noise[:, 132:192] *= 0.5  # форма левой кисти (слоты 1..20)
            noise[:, 195:255] *= 0.5  # форма правой
        coords += noise * present
    coords *= (present > 0)  # отсутствующие блоки остаются нулями
    out[:, :255] = coords
    return out


def augment_sign(seq, raw_len, rng, no_event_pool, is_no_event=False,
                 is_dactyl=False):
    """Полный пайплайн для одного сэмпла: сырое (60,255) -> нормализованное (60,319).

    is_dactyl: буквы — статичные удержания, чувствительные к руке исполнения:
    без зеркала, узкий диапазон скорости, паддинг преимущественно edge-hold,
    щадящий шум на форме кистей.
    """
    dact = is_dactyl and RECIPE == "v3"
    x = seq
    if rng.random() < 0.8 or is_no_event:
        x = window_sim(x, raw_len, rng, no_event_pool,
                       cover_min=0.0 if is_no_event else 0.7,
                       speed=(0.9, 1.15) if dact else (0.75, 1.3),
                       pad_edge_p=0.85 if dact else 0.60)
    else:
        x = x.copy()
    if not dact and rng.random() < 0.3:
        x = mirror(x)
    x = raw_dropouts(x, rng)
    x = normalize_window(x)
    return append_relational(post_norm_aug(x, rng, gentle_hands=dact))

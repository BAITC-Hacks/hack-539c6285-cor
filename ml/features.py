"""Геометрическая канонизация лэндмарков SLOVO: (60,255) -> (60,259).

ЭТАЛОННАЯ СПЕЦИФИКАЦИЯ. TypeScript-порт: src/lib/features.ts — оба должны
давать побитово согласованный результат (паритет проверяется фикстурами
public/model/parity_fixtures.json, max|diff| < 1e-5).

Вход: 60 кадров по 255 float — сырые координаты MediaPipe [0..1]:
  pose 33*3 = 0:99 | face 10*3 = 99:129 | left hand 21*3 = 129:192 | right hand 21*3 = 192:255
Отсутствующий блок = нули. Кадры-паддинг = полностью нулевые.

Выход на кадр (259): pose 99 | face 30 | lh 63 | rh 63 | флаги [p, f, l, r].

Алгоритм (без состояния между окнами, carry-forward якоря только внутри окна):
1. Флаги присутствия блока: 1, если в сыром блоке есть ненулевой элемент.
2. Телесная система координат: центр c = середина плеч (pose 11,12) по xyz,
   масштаб s = max(расстояние между плечами по xy, 1e-3). Если поза отсутствует —
   последние валидные (c,s) этого окна, иначе дефолт c=(0.5,0.5,0), s=0.25.
3. Присутствующие блоки: (v - c) / s покомпонентно (z делится на тот же s).
4. Кисти: слот 0 = запястье в телесных координатах; слоты 1..20 =
   (lm_i - запястье)/hscale в телесных координатах, hscale = max(|lm9-lm0|_3d, 1e-3).
   Отделяет форму кисти от позиции руки.
5. Отсутствующие блоки остаются нулями; нулевые кадры дают нулевой выход с флагами 0.
"""
import numpy as np

RAW_DIM = 255
BASE_DIM = 259   # канонизированные координаты + 4 флага
REL_DIM = 60     # реляционный блок v2 (дистанции/углы/нормали/скорости)
OUT_DIM = BASE_DIM + REL_DIM  # 319
T = 60
POSE = slice(0, 99)
FACE = slice(99, 129)
LH = slice(129, 192)
RH = slice(192, 255)
# индексы плеч в pose
L_SHOULDER = 11
R_SHOULDER = 12
EPS_S = 1e-3
DEFAULT_C = np.array([0.5, 0.5, 0.0], dtype=np.float32)
DEFAULT_S = 0.25


def _norm_hand(hand_bf: np.ndarray) -> np.ndarray:
    """hand_bf: (21,3) в телесных координатах -> (21,3): запястье + форма."""
    out = np.empty_like(hand_bf)
    wrist = hand_bf[0]
    hscale = max(float(np.linalg.norm(hand_bf[9] - wrist)), EPS_S)
    out[0] = wrist
    out[1:] = (hand_bf[1:] - wrist) / hscale
    return out


def normalize_window(raw: np.ndarray) -> np.ndarray:
    """raw: (T,255) float32 -> (T,259) float32."""
    assert raw.shape[1] == RAW_DIM, raw.shape
    out = np.zeros((raw.shape[0], BASE_DIM), dtype=np.float32)
    c = DEFAULT_C.copy()
    s = DEFAULT_S
    have_anchor = False
    for t in range(raw.shape[0]):
        fr = raw[t]
        p = float(np.abs(fr[POSE]).sum()) > 0
        f = float(np.abs(fr[FACE]).sum()) > 0
        l = float(np.abs(fr[LH]).sum()) > 0
        r = float(np.abs(fr[RH]).sum()) > 0
        if p:
            pose = fr[POSE].reshape(33, 3)
            ls, rs = pose[L_SHOULDER], pose[R_SHOULDER]
            c = (ls + rs) / 2.0
            s = max(float(np.hypot(ls[0] - rs[0], ls[1] - rs[1])), EPS_S)
            have_anchor = True
        elif not have_anchor:
            c = DEFAULT_C.copy()
            s = DEFAULT_S
        if p:
            out[t, 0:99] = ((fr[POSE].reshape(33, 3) - c) / s).reshape(-1)
        if f:
            out[t, 99:129] = ((fr[FACE].reshape(10, 3) - c) / s).reshape(-1)
        if l:
            bf = (fr[LH].reshape(21, 3) - c) / s
            out[t, 129:192] = _norm_hand(bf).reshape(-1)
        if r:
            bf = (fr[RH].reshape(21, 3) - c) / s
            out[t, 192:255] = _norm_hand(bf).reshape(-1)
        out[t, 255] = 1.0 if p else 0.0
        out[t, 256] = 1.0 if f else 0.0
        out[t, 257] = 1.0 if l else 0.0
        out[t, 258] = 1.0 if r else 0.0
    return out


def normalize_window_fast(raw: np.ndarray) -> np.ndarray:
    """Векторизованный эквивалент normalize_window (для тренировки).

    Семантика обязана совпадать с эталоном бит-в-бит (проверяется тестом).
    """
    n = raw.shape[0]
    out = np.zeros((n, BASE_DIM), dtype=np.float32)
    pose = raw[:, POSE].reshape(n, 33, 3)
    face = raw[:, FACE].reshape(n, 10, 3)
    lh = raw[:, LH].reshape(n, 21, 3)
    rh = raw[:, RH].reshape(n, 21, 3)
    p = np.abs(raw[:, POSE]).sum(axis=1) > 0
    f = np.abs(raw[:, FACE]).sum(axis=1) > 0
    l = np.abs(raw[:, LH]).sum(axis=1) > 0
    r = np.abs(raw[:, RH]).sum(axis=1) > 0

    ls, rs = pose[:, L_SHOULDER], pose[:, R_SHOULDER]
    c_now = (ls + rs) / 2.0
    s_now = np.maximum(np.hypot(ls[:, 0] - rs[:, 0], ls[:, 1] - rs[:, 1]), EPS_S)
    # carry-forward индекса последнего кадра с позой
    idx = np.arange(n)
    last = np.maximum.accumulate(np.where(p, idx, -1))
    has = last >= 0
    c = np.where(has[:, None], c_now[np.maximum(last, 0)], DEFAULT_C[None, :]).astype(np.float32)
    s = np.where(has, s_now[np.maximum(last, 0)], DEFAULT_S).astype(np.float32)

    cs = c[:, None, :]
    ss = s[:, None, None]
    out[:, 0:99] = np.where(p[:, None, None], (pose - cs) / ss, 0.0).reshape(n, -1)
    out[:, 99:129] = np.where(f[:, None, None], (face - cs) / ss, 0.0).reshape(n, -1)
    for (block, mask, sl) in ((lh, l, slice(129, 192)), (rh, r, slice(192, 255))):
        bf = (block - cs) / ss
        wrist = bf[:, 0:1, :]
        hscale = np.maximum(np.linalg.norm(bf[:, 9] - bf[:, 0], axis=1), EPS_S)
        shape = (bf - wrist) / hscale[:, None, None]
        shape[:, 0, :] = bf[:, 0, :]
        out[:, sl] = np.where(mask[:, None, None], shape, 0.0).reshape(n, -1)
    out[:, 255] = p
    out[:, 256] = f
    out[:, 257] = l
    out[:, 258] = r
    return out


def append_relational(x: np.ndarray) -> np.ndarray:
    """Реляционный блок v2: (T,259) -> (T,319).

    Все новые размерности считаются ИЗ канонизированного 259-вектора,
    гейтятся флагами присутствия (отсутствие => ровно 0), нулевые кадры
    остаются нулевыми. Вычисление в float64, запись во float32 —
    зеркально TS-порту (там double -> Float32Array).

    Раскладка 259..318 (60 дим):
      259:280 левая кисть: 8 дистанций + 5 вытянутостей + 5 косинусов сгиба + нормаль ладони(3)
      280:301 правая кисть: то же
      301:305 межкистевой вектор wR-wL (3) + его длина (1)      [гейт l&r]
      305:313 дистанции запястье-лицо: wL/wR x (губы, подбородок, глазL, глазR) [гейт руки&f]
      313:319 скорости запястий wL(t)-wL(t-1), wR (по 3)        [гейт руки в t и t-1]
    """
    n = x.shape[0]
    xd = x.astype(np.float64)
    out = np.zeros((n, REL_DIM), dtype=np.float64)
    f_f = xd[:, 256] > 0
    l_f = xd[:, 257] > 0
    r_f = xd[:, 258] > 0

    def hand_block(off, flag, dst):
        """off: начало блока кисти (129/192); dst: смещение в out (0/21)."""
        h = xd[:, off:off + 63].reshape(n, 21, 3)  # slot0 = запястье (body), 1..20 shape
        # дистанции между точками формы
        PAIRS = [(4, 8), (4, 12), (4, 16), (4, 20), (8, 12), (12, 16), (16, 20), (4, 17)]
        for k, (a, b) in enumerate(PAIRS):
            out[:, dst + k] = np.linalg.norm(h[:, a] - h[:, b], axis=1)
        # вытянутости пальцев
        for k, i in enumerate((4, 8, 12, 16, 20)):
            out[:, dst + 8 + k] = np.linalg.norm(h[:, i], axis=1)
        # косинусы сгиба
        TRIPLES = [(2, 3, 4), (5, 6, 7), (9, 10, 11), (13, 14, 15), (17, 18, 19)]
        for k, (a, b, c) in enumerate(TRIPLES):
            u = h[:, b] - h[:, a]
            v = h[:, c] - h[:, b]
            out[:, dst + 13 + k] = (u * v).sum(1) / (
                np.linalg.norm(u, axis=1) * np.linalg.norm(v, axis=1) + 1e-6)
        # нормаль ладони
        nrm = np.cross(h[:, 5], h[:, 17])
        out[:, dst + 18:dst + 21] = nrm / (np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-6)
        out[~flag, dst:dst + 21] = 0.0

    hand_block(129, l_f, 0)
    hand_block(192, r_f, 21)

    wL = xd[:, 129:132]
    wR = xd[:, 192:195]
    both = l_f & r_f
    dw = wR - wL
    out[:, 42:45] = np.where(both[:, None], dw, 0.0)
    out[:, 45] = np.where(both, np.linalg.norm(dw, axis=1), 0.0)

    # якоря лица (body frame): губы = (slot1+slot2)/2, подбородок slot9, глаза slot5/6
    lips = (xd[:, 102:105] + xd[:, 105:108]) / 2.0
    chin = xd[:, 126:129]
    eyeL = xd[:, 114:117]
    eyeR = xd[:, 117:120]
    for k, (w, wf) in enumerate(((wL, l_f), (wR, r_f))):
        g = wf & f_f
        for j, anchor in enumerate((lips, chin, eyeL, eyeR)):
            out[:, 46 + k * 4 + j] = np.where(g, np.linalg.norm(w - anchor, axis=1), 0.0)

    # скорости запястий
    for k, (w, wf) in enumerate(((wL, l_f), (wR, r_f))):
        v = np.zeros((n, 3))
        g = np.zeros(n, dtype=bool)
        g[1:] = wf[1:] & wf[:-1]
        v[1:] = w[1:] - w[:-1]
        out[:, 54 + k * 3:57 + k * 3] = np.where(g[:, None], v, 0.0)

    return np.concatenate([x, out.astype(np.float32)], axis=1)


def featurize(raw: np.ndarray) -> np.ndarray:
    """Полный путь для val/test: (T,255) -> (T,319)."""
    return append_relational(normalize_window_fast(raw))


if __name__ == "__main__":
    # самопроверка на реальном файле
    import json, os, sys
    root = os.path.join(os.path.dirname(__file__), "landmarks_holistic")
    fn = sorted(os.listdir(os.path.join(root, "train")))[0]
    a = np.load(os.path.join(root, "train", fn)).astype(np.float32)
    o = normalize_window(a)
    print("in", a.shape, "-> out", o.shape, o.dtype)
    alive = np.abs(a).sum(axis=1) > 0
    print("zero frames stay zero:", bool((o[~alive] == 0).all()))
    print("flags on live frames:", o[alive][:3, 255:])
    print("pose range after norm: [%.2f, %.2f]" % (o[alive][:, :99].min(), o[alive][:, :99].max()))
    print("hand shape range: [%.2f, %.2f]" % (o[alive][:, 130:192].min(), o[alive][:, 130:192].max()))

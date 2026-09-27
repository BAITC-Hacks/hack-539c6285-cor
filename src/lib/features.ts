/**
 * Геометрическая канонизация лэндмарков: (60,255) -> (60,259).
 *
 * ТОЧНЫЙ ПОРТ эталона ml/features.py — любое изменение семантики требует
 * синхронного изменения питон-версии и регенерации ml/fixtures/parity_fixtures.json.
 * Паритет проверяется скриптом scripts/check-feature-parity.mjs (max|diff| < 1e-5).
 *
 * Вход: кадры по 255 float — сырые координаты MediaPipe [0..1]:
 *   pose 33*3 = 0:99 | face 10*3 = 99:129 | left hand 21*3 = 129:192 | right hand 21*3 = 192:255
 * Отсутствующий блок = нули; кадры-паддинг = полностью нулевые.
 * Выход на кадр (259): pose 99 | face 30 | lh 63 | rh 63 | флаги [p, f, l, r].
 */

export const RAW_DIM = 255;
export const BASE_DIM = 259;         // канонизация + флаги
export const REL_DIM = 60;           // реляционный блок v2
export const OUT_DIM = BASE_DIM + REL_DIM; // 319
export const WINDOW = 60;

const EPS_S = 1e-3;
const DEFAULT_C: [number, number, number] = [0.5, 0.5, 0];
const DEFAULT_S = 0.25;

const POSE_OFF = 0;
const FACE_OFF = 99;
const LH_OFF = 129;
const RH_OFF = 192;
const L_SHOULDER = 11;
const R_SHOULDER = 12;

function blockPresent(fr: Float32Array | number[], off: number, len: number): boolean {
  for (let i = off; i < off + len; i++) {
    if (fr[i] !== 0) return true;
  }
  return false;
}

/** Кисть в телесных координатах -> запястье + форма (нормированная размером кисти). */
function normHand(
  fr: Float32Array | number[], off: number,
  cx: number, cy: number, cz: number, s: number,
  out: Float32Array, outOff: number,
) {
  // телесные координаты запястья и среднего сустава среднего пальца (lm9)
  const wx = (fr[off] - cx) / s;
  const wy = (fr[off + 1] - cy) / s;
  const wz = (fr[off + 2] - cz) / s;
  const mx = (fr[off + 27] - cx) / s; // lm9 * 3 = 27
  const my = (fr[off + 28] - cy) / s;
  const mz = (fr[off + 29] - cz) / s;
  const hscale = Math.max(
    Math.sqrt((mx - wx) ** 2 + (my - wy) ** 2 + (mz - wz) ** 2),
    EPS_S,
  );
  out[outOff] = wx;
  out[outOff + 1] = wy;
  out[outOff + 2] = wz;
  for (let j = 1; j < 21; j++) {
    const bx = (fr[off + j * 3] - cx) / s;
    const by = (fr[off + j * 3 + 1] - cy) / s;
    const bz = (fr[off + j * 3 + 2] - cz) / s;
    out[outOff + j * 3] = (bx - wx) / hscale;
    out[outOff + j * 3 + 1] = (by - wy) / hscale;
    out[outOff + j * 3 + 2] = (bz - wz) / hscale;
  }
}

/**
 * Нормализация окна кадров (базовые 259). Вход: массив кадров по 255 float.
 * Выход: Float32Array длиной frames.length * 259 (кадры подряд).
 * Без состояния между вызовами: carry-forward якоря только внутри окна.
 */
export function normalizeWindow(frames: ReadonlyArray<Float32Array | number[]>): Float32Array {
  const n = frames.length;
  const out = new Float32Array(n * BASE_DIM);
  let cx = DEFAULT_C[0];
  let cy = DEFAULT_C[1];
  let cz = DEFAULT_C[2];
  let s = DEFAULT_S;
  let haveAnchor = false;

  for (let t = 0; t < n; t++) {
    const fr = frames[t];
    const o = t * BASE_DIM;
    const p = blockPresent(fr, POSE_OFF, 99);
    const f = blockPresent(fr, FACE_OFF, 30);
    const l = blockPresent(fr, LH_OFF, 63);
    const r = blockPresent(fr, RH_OFF, 63);

    if (p) {
      const lsx = fr[L_SHOULDER * 3];
      const lsy = fr[L_SHOULDER * 3 + 1];
      const lsz = fr[L_SHOULDER * 3 + 2];
      const rsx = fr[R_SHOULDER * 3];
      const rsy = fr[R_SHOULDER * 3 + 1];
      const rsz = fr[R_SHOULDER * 3 + 2];
      cx = (lsx + rsx) / 2;
      cy = (lsy + rsy) / 2;
      cz = (lsz + rsz) / 2;
      s = Math.max(Math.hypot(lsx - rsx, lsy - rsy), EPS_S);
      haveAnchor = true;
    } else if (!haveAnchor) {
      cx = DEFAULT_C[0];
      cy = DEFAULT_C[1];
      cz = DEFAULT_C[2];
      s = DEFAULT_S;
    }

    if (p) {
      for (let j = 0; j < 33; j++) {
        out[o + j * 3] = (fr[j * 3] - cx) / s;
        out[o + j * 3 + 1] = (fr[j * 3 + 1] - cy) / s;
        out[o + j * 3 + 2] = (fr[j * 3 + 2] - cz) / s;
      }
    }
    if (f) {
      for (let j = 0; j < 10; j++) {
        out[o + FACE_OFF + j * 3] = (fr[FACE_OFF + j * 3] - cx) / s;
        out[o + FACE_OFF + j * 3 + 1] = (fr[FACE_OFF + j * 3 + 1] - cy) / s;
        out[o + FACE_OFF + j * 3 + 2] = (fr[FACE_OFF + j * 3 + 2] - cz) / s;
      }
    }
    if (l) normHand(fr, LH_OFF, cx, cy, cz, s, out, o + LH_OFF);
    if (r) normHand(fr, RH_OFF, cx, cy, cz, s, out, o + RH_OFF);
    out[o + 255] = p ? 1 : 0;
    out[o + 256] = f ? 1 : 0;
    out[o + 257] = l ? 1 : 0;
    out[o + 258] = r ? 1 : 0;
  }
  return out;
}

const PAIRS: ReadonlyArray<[number, number]> = [
  [4, 8], [4, 12], [4, 16], [4, 20], [8, 12], [12, 16], [16, 20], [4, 17],
];
const TIPS = [4, 8, 12, 16, 20] as const;
const TRIPLES: ReadonlyArray<[number, number, number]> = [
  [2, 3, 4], [5, 6, 7], [9, 10, 11], [13, 14, 15], [17, 18, 19],
];

/**
 * Реляционный блок v2 поверх нормализованного окна: (n,259) -> (n,319).
 * ТОЧНЫЙ ПОРТ ml/features.py append_relational — та же раскладка 259..318,
 * тот же гейтинг флагами, нулевые кадры остаются нулевыми.
 * Вычисления в double поверх float32-значений base — зеркально питону
 * (float64 из float32 с финальным кастом во float32).
 */
export function featurizeWindow(frames: ReadonlyArray<Float32Array | number[]>): Float32Array {
  const base = normalizeWindow(frames);
  const n = frames.length;
  const out = new Float32Array(n * OUT_DIM);

  const hx = new Float64Array(63); // рабочая копия блока кисти

  for (let t = 0; t < n; t++) {
    const b = t * BASE_DIM;
    const o = t * OUT_DIM;
    out.set(base.subarray(b, b + BASE_DIM), o);

    const fF = base[b + 256] > 0;
    const lF = base[b + 257] > 0;
    const rF = base[b + 258] > 0;

    // --- кисти: дистанции, вытянутости, косинусы, нормаль ладони
    for (let hand = 0; hand < 2; hand++) {
      const flag = hand === 0 ? lF : rF;
      const off = hand === 0 ? 129 : 192;
      const dst = o + 259 + hand * 21;
      if (!flag) continue; // нули уже в out
      for (let i = 0; i < 63; i++) hx[i] = base[b + off + i];
      for (let k = 0; k < 8; k++) {
        const [a, c] = PAIRS[k];
        const dx = hx[a * 3] - hx[c * 3];
        const dy = hx[a * 3 + 1] - hx[c * 3 + 1];
        const dz = hx[a * 3 + 2] - hx[c * 3 + 2];
        out[dst + k] = Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      for (let k = 0; k < 5; k++) {
        const i = TIPS[k];
        out[dst + 8 + k] = Math.sqrt(
          hx[i * 3] ** 2 + hx[i * 3 + 1] ** 2 + hx[i * 3 + 2] ** 2,
        );
      }
      for (let k = 0; k < 5; k++) {
        const [a, m, c] = TRIPLES[k];
        const ux = hx[m * 3] - hx[a * 3];
        const uy = hx[m * 3 + 1] - hx[a * 3 + 1];
        const uz = hx[m * 3 + 2] - hx[a * 3 + 2];
        const vx = hx[c * 3] - hx[m * 3];
        const vy = hx[c * 3 + 1] - hx[m * 3 + 1];
        const vz = hx[c * 3 + 2] - hx[m * 3 + 2];
        const nu = Math.sqrt(ux * ux + uy * uy + uz * uz);
        const nv = Math.sqrt(vx * vx + vy * vy + vz * vz);
        out[dst + 13 + k] = (ux * vx + uy * vy + uz * vz) / (nu * nv + 1e-6);
      }
      // нормаль ладони: cross(h5, h17), нормированная
      const ax = hx[15], ay = hx[16], az = hx[17];       // h5
      const bx2 = hx[51], by2 = hx[52], bz2 = hx[53];    // h17
      const cx2 = ay * bz2 - az * by2;
      const cy2 = az * bx2 - ax * bz2;
      const cz2 = ax * by2 - ay * bx2;
      const cn = Math.sqrt(cx2 * cx2 + cy2 * cy2 + cz2 * cz2) + 1e-6;
      out[dst + 18] = cx2 / cn;
      out[dst + 19] = cy2 / cn;
      out[dst + 20] = cz2 / cn;
    }

    // --- межкистевой вектор (гейт l && r)
    const wLx = base[b + 129], wLy = base[b + 130], wLz = base[b + 131];
    const wRx = base[b + 192], wRy = base[b + 193], wRz = base[b + 194];
    if (lF && rF) {
      const dx = wRx - wLx, dy = wRy - wLy, dz = wRz - wLz;
      out[o + 301] = dx;
      out[o + 302] = dy;
      out[o + 303] = dz;
      out[o + 304] = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    // --- запястье-лицо (гейт руки && f)
    if (fF && (lF || rF)) {
      const lipsX = (base[b + 102] + base[b + 105]) / 2;
      const lipsY = (base[b + 103] + base[b + 106]) / 2;
      const lipsZ = (base[b + 104] + base[b + 107]) / 2;
      const anchors: ReadonlyArray<[number, number, number]> = [
        [lipsX, lipsY, lipsZ],
        [base[b + 126], base[b + 127], base[b + 128]],
        [base[b + 114], base[b + 115], base[b + 116]],
        [base[b + 117], base[b + 118], base[b + 119]],
      ];
      for (let hand = 0; hand < 2; hand++) {
        const flag = hand === 0 ? lF : rF;
        if (!flag) continue;
        const wx = hand === 0 ? wLx : wRx;
        const wy = hand === 0 ? wLy : wRy;
        const wz = hand === 0 ? wLz : wRz;
        for (let j = 0; j < 4; j++) {
          const [ax2, ay2, az2] = anchors[j];
          const dx = wx - ax2, dy = wy - ay2, dz = wz - az2;
          out[o + 305 + hand * 4 + j] = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
      }
    }

    // --- скорости запястий (гейт: рука в t и t-1; кадр 0 -> 0)
    if (t > 0) {
      const pb = (t - 1) * BASE_DIM;
      if (lF && base[pb + 257] > 0) {
        out[o + 313] = wLx - base[pb + 129];
        out[o + 314] = wLy - base[pb + 130];
        out[o + 315] = wLz - base[pb + 131];
      }
      if (rF && base[pb + 258] > 0) {
        out[o + 316] = wRx - base[pb + 192];
        out[o + 317] = wRy - base[pb + 193];
        out[o + 318] = wRz - base[pb + 194];
      }
    }
  }
  return out;
}

/**
 * Линейный ресемпл буфера кадров с таймстемпами к ровно `target` кадрам,
 * равномерно покрывающим последние windowMs миллисекунд.
 * Совпадает с семейством ресемплинга, применявшимся при обучении (linspace).
 */
export function resampleWindow(
  buf: ReadonlyArray<{ t: number; frame: Float32Array }>,
  nowMs: number,
  windowMs = 2000,
  target = WINDOW,
): Float32Array[] | null {
  const from = nowMs - windowMs;
  const inWin = buf.filter((e) => e.t >= from);
  if (inWin.length < 8) return null; // слишком мало данных
  const outFrames: Float32Array[] = [];
  const n = inWin.length;
  for (let i = 0; i < target; i++) {
    const pos = (i / (target - 1)) * (n - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, n - 1);
    const w = pos - lo;
    if (w === 0) {
      outFrames.push(inWin[lo].frame);
    } else {
      const a = inWin[lo].frame;
      const b = inWin[hi].frame;
      const mixed = new Float32Array(RAW_DIM);
      for (let j = 0; j < RAW_DIM; j++) mixed[j] = a[j] * (1 - w) + b[j] * w;
      outFrames.push(mixed);
    }
  }
  return outFrames;
}

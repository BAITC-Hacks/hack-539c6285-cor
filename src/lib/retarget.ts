/**
 * Ретаргетинг лэндмарков MediaPipe -> gesture JSON для 3D-аватара.
 *
 * ТОЧНЫЙ ПОРТ эталона ml/retarget.py — любое изменение семантики требует
 * синхронного изменения питон-версии и регенерации ml/fixtures/retarget_fixtures.json
 * (генератор: ml/make_retarget_fixtures.py).
 * Паритет проверяется скриптом scripts/check-retarget-parity.mjs (max|diff| < 1e-4).
 *
 * Вход: кадры по 255 float — сырые координаты MediaPipe [0..1]:
 *   pose 33*3 = 0:99 | face 10*3 = 99:129 | left hand 21*3 = 129:192 | right hand 21*3 = 192:255
 * Отсутствующий блок = нули; кадры-паддинг = полностью нулевые.
 * В отличие от питон-версии (фиксированное окно SLOVO 60x255) принимает любое
 * число кадров — рекордер пишет живую запись произвольной длины.
 *
 * Выход: формат gesturePlayer.ts — Euler XYZ дельты (радианы) от rest-позы
 * (руки опущены после applyNaturalStance) для 34 костей mixamorig.
 *
 * Конвенции (см. отчёт реверса рига):
 *   Arm:  -X подъём вбок, +Y внешняя ротация, -Z вперёд.
 *   ForeArm: -Z сгиб локтя, +Y супинация (ладонь к зрителю), X вне плоскости.
 *   Пальцы: знаки дактиля — сгиб +Z правая / -Z левая.
 *   Левая сторона = (x, -y, -z) от правой.
 *
 * Координаты: P = (x, -y, -z) от MediaPipe -> y вверх, персона лицом к +Z —
 * совпадает с мировыми осями аватара; правая рука персоны -> RightArm.
 */

/** Кадр анимации: время в секундах + дельты поворотов костей. */
export interface GestureFrame {
  t: number;
  bones: Record<string, [number, number, number]>;
}

/** Формат public/gestures/*.json (надмножество GestureJSON плеера). */
export interface GestureJSON {
  name: string;
  fps_target: number;
  rotation_order: string;
  unit: string;
  description: string;
  frames: GestureFrame[];
}

export interface RetargetOptions {
  name: string;
  description?: string;
  /** Длительность исходного видео, сек. Нет — берём nv/30 (питон: raw_len/30). */
  durationSec?: number;
}

export const RAW_DIM = 255;
export const T = 60;                 // окно SLOVO (живая запись не обязана совпадать)

const POSE_OFF = 0;
const LH_OFF = 129;
const RH_OFF = 192;
const HAND_LEN = 63;

// индексы pose MediaPipe
const L_SH = 11, R_SH = 12;
const L_EL = 13, R_EL = 14;
const L_WR = 15, R_WR = 16;
const L_HIP = 23, R_HIP = 24;

// пальцы: (MCP, PIP, DIP, TIP)
const FINGERS: ReadonlyArray<readonly [string, readonly [number, number, number, number]]> = [
  ['Thumb', [1, 2, 3, 4]],
  ['Index', [5, 6, 7, 8]],
  ['Middle', [9, 10, 11, 12]],
  ['Ring', [13, 14, 15, 16]],
  ['Pinky', [17, 18, 19, 20]],
];

// клампы по наблюдаемым диапазонам реальных файлов
const CLAMP = {
  F1: 2.0, F2: 2.6, F3: 1.6, T1: 0.8, T2: 1.0, T3: 0.9,
  ArmX: 2.2, ArmZ: 1.8, ForeY: 1.6, ForeZ: 2.4, ForeX: 0.9,
};

const Z_DAMP_POSE = 0.25;  // MediaPipe завышает глубину позы в разы (эмпирически)
const Z_DAMP_HAND = 0.5;

const SMOOTH_W = 5;        // окно скользящего среднего
const STEP = 2;            // прореживание до ~15 ключей/сек
const EASE = 0.5;          // подводка/отводка от rest-позы, сек

type Vec3 = [number, number, number];

// --- мини-векторная алгебра (без зависимостей, аналог numpy в питоне) ---

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(a: Vec3, k: number): Vec3 {
  return [a[0] * k, a[1] * k, a[2] * k];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function len3(a: Vec3): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

function clip(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** np.linalg.norm-нормировка: короткие векторы возвращаются как есть. */
function normVec(v: Vec3): Vec3 {
  const n = len3(v);
  return n > 1e-6 ? [v[0] / n, v[1] / n, v[2] / n] : [v[0], v[1], v[2]];
}

/** Угол между векторами; вырожденные -> 0 (как _angle в питоне). */
function angle(u: Vec3, v: Vec3): number {
  const nu = len3(u);
  const nv = len3(v);
  if (nu < 1e-6 || nv < 1e-6) return 0.0;
  const c = dot(u, v) / (nu * nv);
  return Math.acos(clip(c, -1.0, 1.0));
}

/**
 * Округление как питоновский round(x, nd) — half-to-even по точному двоичному
 * значению. Точные «половинки» на nd знаках существуют только для двоичных
 * дробей вида odd/2^(nd+1) (0.03125 для nd=4, 0.0625 для nd=3) — их и ловим
 * отдельно; в остальных случаях toFixed уже даёт корректное округление.
 */
function roundTo(x: number, nd: number): number {
  const pow = 10 ** nd;
  const b = x * 2 ** (nd + 1);              // умножение на степень двойки точное
  if (Number.isInteger(b) && Math.abs(b % 2) === 1) {
    const lo = Math.floor(x * pow);         // x * pow — ровно k + 0.5
    const k = lo % 2 === 0 ? lo : lo + 1;   // к чётному
    return k / pow;
  }
  return Number(x.toFixed(nd));
}

const round4 = (x: number) => roundTo(x, 4);
const round3 = (x: number) => roundTo(x, 3);

// --- препроцессинг последовательности ---

/** Блок (N,3) MediaPipe -> P-space: y вверх, z вперёд (к зрителю), глубина погашена. */
function pSpace(fr: Float64Array, off: number, count: number, zDamp: number): Vec3[] {
  const out: Vec3[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const o = off + i * 3;
    out[i] = [fr[o], -fr[o + 1], -fr[o + 2] * zDamp];
  }
  return out;
}

/** Есть ли в блоке хоть один ненулевой элемент (питон: sum|x| > 0). */
function blockAlive(fr: Float64Array, off: number, len: number): boolean {
  for (let i = off; i < off + len; i++) {
    if (fr[i] !== 0) return true;
  }
  return false;
}

/** Протянуть последний живой блок через провалы трекинга (вперёд, затем назад). */
function forwardFillBlock(seq: Float64Array[], off: number, len: number): void {
  const alive = seq.map((fr) => blockAlive(fr, off, len));
  let last: Float64Array | null = null;
  for (let t = 0; t < seq.length; t++) {
    if (alive[t]) {
      last = seq[t].slice(off, off + len);
    } else if (last) {
      seq[t].set(last, off);
    }
  }
  // и назад — если провал в начале
  let nxt: Float64Array | null = null;
  for (let t = seq.length - 1; t >= 0; t--) {
    if (alive[t]) {
      nxt = seq[t].slice(off, off + len);
    } else if (nxt && !blockAlive(seq[t], off, len)) {
      seq[t].set(nxt, off);
    }
  }
}

/** Скользящее среднее по времени с краевым padding (питон: _smooth). */
function smooth(seq: Float64Array[], w: number): Float64Array[] {
  const n = seq.length;
  if (n < w) return seq;
  const pad = Math.floor(w / 2);
  const ker = 1 / w;
  const out: Float64Array[] = new Array(n);
  for (let t = 0; t < n; t++) {
    const dst = new Float64Array(RAW_DIM);
    for (let k = 0; k < w; k++) {
      // ext = [seq[0]]*pad + seq + [seq[-1]]*pad, valid-свёртка ядром 1/w
      const src = seq[clip(t + k - pad, 0, n - 1)];
      for (let j = 0; j < RAW_DIM; j++) dst[j] += src[j] * ker;
    }
    out[t] = dst;
  }
  return out;
}

// --- решатель кадра ---

/** Один кадр -> {имя кости: [x,y,z]}. poseP/*P уже в P-space. */
export function solveFrame(
  poseP: Vec3[], lhP: Vec3[], rhP: Vec3[], lhOk: boolean, rhOk: boolean,
): Record<string, [number, number, number]> {
  const bones: Record<string, [number, number, number]> = {};

  // телесная система
  const rsh = poseP[R_SH];
  const lsh = poseP[L_SH];
  const midSh = scale3([rsh[0] + lsh[0], rsh[1] + lsh[1], rsh[2] + lsh[2]], 0.5);
  const rhip = poseP[R_HIP];
  const lhip = poseP[L_HIP];
  const midHip = scale3([rhip[0] + lhip[0], rhip[1] + lhip[1], rhip[2] + lhip[2]], 0.5);
  const ex = normVec(sub(lsh, rsh));            // к левому плечу (+X мира)
  let ey = normVec(sub(midSh, midHip));         // вверх
  const ez = normVec(cross(ex, ey));            // вперёд (к зрителю)
  ey = normVec(cross(ez, ex));                  // ортогонализация
  const scale = Math.max(len3(sub(lsh, rsh)), 1e-3);

  const toBody = (p: Vec3, origin: Vec3): Vec3 => {
    const q: Vec3 = [
      (p[0] - origin[0]) / scale,
      (p[1] - origin[1]) / scale,
      (p[2] - origin[2]) / scale,
    ];
    return [dot(ex, q), dot(ey, q), dot(ez, q)];
  };

  const sides: ReadonlyArray<[string, number, number, number, Vec3[], boolean]> = [
    ['Right', R_SH, R_EL, R_WR, rhP, rhOk],
    ['Left', L_SH, L_EL, L_WR, lhP, lhOk],
  ];

  for (const [side, shI, elI, wrI, handP, handOk] of sides) {
    const s = side === 'Right' ? 1.0 : -1.0;
    const sh = poseP[shI];
    const el = toBody(poseP[elI], sh);
    const d1 = normVec(el);
    const d2 = normVec(sub(toBody(poseP[wrI], sh), el));

    // плечевая кость: разложение подъёма на фронтальную/сагиттальную части
    const theta = angle(d1, [0.0, -1.0, 0.0]);
    const lat = -d1[0] * s;                     // вбок от корпуса (для правой = -X тела)
    const fwd = d1[2];                          // вперёд
    const h = Math.hypot(lat, fwd);
    let armX = 0.0;
    let armZ = 0.0;
    if (h >= 1e-6) {
      armX = -theta * (lat / h);
      armZ = -theta * (fwd / h) * s;
    }
    armX = clip(armX, -CLAMP.ArmX, 0.6);
    armZ = clip(armZ, -CLAMP.ArmZ, CLAMP.ArmZ);

    // локоть: зеркало (x, -y, -z) => сгиб -Z у правой, +Z у левой
    // (в питоне fore_z присваивается дважды, вторая строка перекрывает первую)
    const alpha = angle(d1, d2);
    const foreZ = s > 0 ? clip(-alpha, -CLAMP.ForeZ, 0.0) : clip(alpha, 0.0, CLAMP.ForeZ);

    // супинация: нормаль ладони (если кисть видна) против направления "вбок"
    let foreY = 0.0;
    const foreX = 0.0;
    if (handOk) {
      const w0 = toBody(handP[0], sh);
      const i5 = toBody(handP[5], sh);
      const p17 = toBody(handP[17], sh);
      const palmN = scale3(normVec(cross(sub(i5, w0), sub(p17, w0))), s); // наружу от ладони
      // ладонь к зрителю (+Z тела) => супинация ~ +Y правой
      foreY = clip(Math.asin(clip(palmN[2], -1, 1)), -CLAMP.ForeY, CLAMP.ForeY) * s;
    } else {
      // руки нет — плоскость сгиба локтя как приближение твиста
      let m = cross(d1, d2);
      if (len3(m) > 1e-4) {
        m = normVec(m);
        foreY = clip(Math.atan2(m[2], -m[0] * s), -1.0, 1.0) * 0.4 * s;
      }
    }

    bones[`mixamorig:${side}Arm`] = [round4(armX), round4(0.15 * s), round4(armZ)];
    bones[`mixamorig:${side}ForeArm`] = [round4(foreX), round4(foreY), round4(foreZ)];

    // пальцы
    if (handOk) {
      const hp = handP.map((p) => toBody(p, sh));
      const wrist = hp[0];
      for (const [fname, [mI, pI, dI, tI]] of FINGERS) {
        let v1: number;
        let v2: number;
        let v3: number;
        if (fname === 'Thumb') {
          const b1 = angle(sub(hp[mI], wrist), sub(hp[pI], hp[mI]));
          const b2 = angle(sub(hp[pI], hp[mI]), sub(hp[dI], hp[pI]));
          const b3 = angle(sub(hp[dI], hp[pI]), sub(hp[tI], hp[dI]));
          v1 = clip(0.6 * b1, 0, CLAMP.T1);
          v2 = clip(0.9 * b2, 0, CLAMP.T2);
          v3 = clip(0.9 * b3, 0, CLAMP.T3);
        } else {
          const palmDir = normVec(sub(hp[9], wrist));
          const b1 = angle(palmDir, sub(hp[pI], hp[mI]));
          const b2 = angle(sub(hp[pI], hp[mI]), sub(hp[dI], hp[pI]));
          const b3 = angle(sub(hp[dI], hp[pI]), sub(hp[tI], hp[dI]));
          v1 = clip(1.1 * b1, 0, CLAMP.F1);
          v2 = clip(1.05 * b2, 0, CLAMP.F2);
          v3 = clip(0.95 * b3, 0, CLAMP.F3);
        }
        // знаки дактиля: правая +Z, левая -Z
        const vs = [v1, v2, v3];
        for (let j = 1; j <= 3; j++) {
          bones[`mixamorig:${side}Hand${fname}${j}`] = [0.0, 0.0, round4(vs[j - 1] * s)];
        }
      }
    } else {
      for (const [fname] of FINGERS) {
        for (let j = 1; j <= 3; j++) {
          bones[`mixamorig:${side}Hand${fname}${j}`] = [0.0, 0.0, 0.0];
        }
      }
    }
  }
  return bones;
}

// --- публичный вход ---

/**
 * Последовательность сырых кадров (по 255 float) -> gesture JSON.
 * Хвостовые пустые кадры отбрасываются, провалы трекинга кистей протягиваются,
 * последовательность сглаживается и прореживается вдвое.
 */
export function retargetSequence(
  frames: ReadonlyArray<Float32Array | number[]>, opts: RetargetOptions,
): GestureJSON {
  // копия в double: дальше всё считается как в numpy после _smooth
  let seq: Float64Array[] = frames.map((fr) => {
    if (fr.length !== RAW_DIM) {
      throw new Error(`кадр длины ${fr.length}, ожидалось ${RAW_DIM}`);
    }
    const dst = new Float64Array(RAW_DIM);
    for (let j = 0; j < RAW_DIM; j++) dst[j] = fr[j];
    return dst;
  });

  // nv — индекс последнего непустого кадра + 1 (SLOVO дополняет нулями до 60)
  let nv = 0;
  for (let t = 0; t < seq.length; t++) {
    if (blockAlive(seq[t], 0, RAW_DIM)) nv = t + 1;
  }
  if (nv < 4) throw new Error('слишком короткий клип');
  seq = seq.slice(0, nv);
  forwardFillBlock(seq, LH_OFF, HAND_LEN);
  forwardFillBlock(seq, RH_OFF, HAND_LEN);
  seq = smooth(seq, SMOOTH_W);

  // тайминг: длительность из исходного видео, клип растянут на nv кадров
  // (питон: raw_len/30, где raw_len — кадры оригинала при 30 fps)
  const srcSec = opts.durationSec !== undefined && opts.durationSec >= 4 / 30
    ? opts.durationSec
    : nv / 30;
  const dur = clip(srcSec, 1.2, 5.0);

  const body: GestureFrame[] = [];
  for (let i = 0; i < nv; i += STEP) {
    const fr = seq[i];
    const poseP = pSpace(fr, POSE_OFF, 33, Z_DAMP_POSE);
    const lhOk = blockAlive(fr, LH_OFF, HAND_LEN);
    const rhOk = blockAlive(fr, RH_OFF, HAND_LEN);
    const lhP = pSpace(fr, LH_OFF, 21, Z_DAMP_HAND);
    const rhP = pSpace(fr, RH_OFF, 21, Z_DAMP_HAND);
    const bones = solveFrame(poseP, lhP, rhP, lhOk, rhOk);
    const t = EASE + (i / Math.max(nv - 1, 1)) * dur;
    body.push({ t: round3(t), bones });
  }

  // rest-опоры: ЯВНЫЕ нули для всех костей (плеер интерполирует только кости,
  // присутствующие в раннем кадре пары — пустой кадр даёт рывок вместо ease)
  const allBones = new Set<string>();
  for (const f of body) for (const b of Object.keys(f.bones)) allBones.add(b);
  const names = Array.from(allBones).sort();
  const makeZeros = (): Record<string, [number, number, number]> => {
    const z: Record<string, [number, number, number]> = {};
    for (const b of names) z[b] = [0.0, 0.0, 0.0];
    return z;
  };
  const outFrames: GestureFrame[] = [
    { t: 0.0, bones: makeZeros() },
    ...body,
    { t: round3(EASE + dur + EASE), bones: makeZeros() },
  ];

  return {
    name: opts.name,
    fps_target: 30,
    rotation_order: 'XYZ',
    unit: 'radians',
    description: opts.description || `SLOVO retarget: ${opts.name}`,
    frames: outFrames,
  };
}

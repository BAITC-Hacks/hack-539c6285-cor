// Дактильная азбука РЖЯ — процедурная генерация жестов для GesturePlayer.
//
// Каждая буква описана формой кисти (HandShape): степень сгиба пальцев,
// растопырка, поправки запястья и простое движение (для букв с динамикой:
// Й, Ё, З, Ц, Щ...). Из слова строится GestureJSON: рука поднимается в
// базовую позу у плеча, буквы сменяют друг друга, рука опускается.
//
// ВНИМАНИЕ: формы — приближение к дактилю РЖЯ; сверка с носителем РЖЯ
// желательна. Все значения — дельты против rest-позы в радианах (XYZ),
// оси рига измерены эмпирически: сгиб пальца = +Z (правая рука),
// твист ладони = Y запястья.

import type { GestureJSON, GestureFrame } from './gesturePlayer';

export type Vec3 = [number, number, number];

// Базовая поза дактиля: кисть у плеча, пальцы вверх, ладонь к зрителю.
const BASE_ARM: Vec3 = [-0.35, 0, -0.6];
const BASE_FOREARM: Vec3 = [0, 0, -2.1];
const BASE_WRIST: Vec3 = [-0.1, 1.2, -0.9];

const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'] as const;

export interface HandShape {
  /** Сгиб пальцев 0..1: [большой, указательный, средний, безымянный, мизинец] */
  curl: [number, number, number, number, number];
  /** Растопырка пальцев 0..1 */
  spread?: number;
  /** Большой палец отведён в сторону (0..1) */
  thumbOut?: number;
  /** Дополнительная дельта запястья поверх базовой */
  wrist?: Vec3;
  /** Дополнительная дельта предплечья */
  forearm?: Vec3;
  /** Дополнительная дельта плеча */
  arm?: Vec3;
  /** Точечные поправки отдельных суставов, ключ без префикса mixamorig: */
  override?: Record<string, Vec3>;
  /** Простое движение при показе буквы */
  motion?: 'shake' | 'down' | 'circle' | 'twist';
}

// ——— Формы букв (приближение) ———
export const DACTYL_SHAPES: Record<string, HandShape> = {
  а: { curl: [0.25, 1, 1, 1, 1] },
  б: { curl: [0.85, 0.1, 0.1, 0.1, 0.1] },
  в: { curl: [0.15, 0, 0, 0, 0] },
  г: { curl: [0, 0, 1, 1, 1], thumbOut: 1, wrist: [0, 0, 0.4] },
  д: { curl: [0.6, 0, 0, 1, 1], motion: 'down' },
  е: { curl: [0.45, 0.55, 0.55, 0.55, 0.55] },
  ё: { curl: [0.45, 0.55, 0.55, 0.55, 0.55], motion: 'shake' },
  ж: { curl: [0.5, 0.35, 0.35, 0.35, 0.35], spread: 1 },
  з: { curl: [0.6, 0, 1, 1, 1], motion: 'circle' },
  и: { curl: [0.6, 0, 0, 1, 1], spread: 0.7 },
  й: { curl: [0.6, 0, 0, 1, 1], spread: 0.7, motion: 'shake' },
  к: { curl: [0.2, 0, 0, 1, 1], thumbOut: 0.6 },
  л: { curl: [0.6, 0, 0, 1, 1], spread: 1, wrist: [0.5, 0, 0] },
  м: { curl: [0.6, 0, 0, 0, 1], wrist: [0.5, 0, 0] },
  н: { curl: [0.25, 0, 0, 0, 1], thumbOut: 0.5 },
  о: { curl: [0.5, 0.7, 0.15, 0.15, 0.15] },
  п: { curl: [0.6, 0, 0, 1, 1], wrist: [0.7, 0, 0] },
  р: { curl: [0.35, 0.1, 1, 1, 1], wrist: [0.4, 0, 0] },
  с: { curl: [0.4, 0.45, 0.45, 0.45, 0.45] },
  т: { curl: [0.75, 0, 0, 0, 1], wrist: [0.6, 0, 0] },
  у: { curl: [0, 1, 1, 1, 0], thumbOut: 1 },
  ф: { curl: [0.5, 0.65, 0, 0, 0], spread: 0.4 },
  х: {
    curl: [0.6, 0.35, 1, 1, 1],
    override: { RightHandIndex2: [0, 0, 1.1], RightHandIndex3: [0, 0, 0.9] },
  },
  ц: { curl: [0.6, 0, 0, 1, 1], motion: 'down' },
  ч: { curl: [0.25, 0, 0, 1, 1], wrist: [0, 0, 0.35] },
  ш: { curl: [0.75, 0, 0, 0, 1], spread: 0.9 },
  щ: { curl: [0.75, 0, 0, 0, 1], spread: 0.9, motion: 'down' },
  ъ: { curl: [0.55, 0.4, 1, 1, 1], motion: 'twist' },
  ы: { curl: [0.75, 1, 1, 1, 0] },
  ь: { curl: [0.55, 0.4, 1, 1, 1], wrist: [0.3, 0, 0] },
  э: { curl: [0.45, 0.4, 1, 1, 1] },
  ю: { curl: [0.5, 0.7, 0.15, 0.15, 0], motion: 'twist' },
  я: { curl: [0.35, 0.2, 0.2, 1, 1], spread: 0.5, wrist: [0, 0, 0.3] },
};

export const DACTYL_LETTERS = Object.keys(DACTYL_SHAPES);

// Растопырка: X-повороты проксимальных суставов (веер от указательного к мизинцу)
const SPREAD_X: Record<(typeof FINGERS)[number], number> = {
  Index: -0.22,
  Middle: -0.07,
  Ring: 0.1,
  Pinky: 0.24,
};

/**
 * Кости пальцев для формы кисти. Риг зеркальный: сгиб пальцев правой руки
 * = +Z, левой = −Z (эмпирически), поэтому для левой стороны Z-компоненты
 * инвертируются (и X растопырки тоже).
 */
export function fingerJoints(
  shape: HandShape,
  side: 'Right' | 'Left' = 'Right',
): Record<string, Vec3> {
  const s = side === 'Right' ? 1 : -1;
  const bones: Record<string, Vec3> = {};
  const [thumbC, ...fingerC] = shape.curl;
  const spread = shape.spread ?? 0;

  FINGERS.forEach((f, i) => {
    const c = fingerC[i];
    const sx = spread * SPREAD_X[f] * s;
    bones[`mixamorig:${side}Hand${f}1`] = [sx, 0, 1.45 * c * s];
    bones[`mixamorig:${side}Hand${f}2`] = [0, 0, 1.3 * c * s];
    bones[`mixamorig:${side}Hand${f}3`] = [0, 0, 0.9 * c * s];
  });

  // Большой палец: сгиб поперёк ладони; thumbOut отводит его в сторону
  const out = shape.thumbOut ?? 0;
  bones[`mixamorig:${side}HandThumb1`] = [
    -0.3 * out * s,
    0,
    (0.5 * thumbC - 0.25 * out) * s,
  ];
  bones[`mixamorig:${side}HandThumb2`] = [0, 0, 0.8 * thumbC * s];
  bones[`mixamorig:${side}HandThumb3`] = [0, 0, 0.6 * thumbC * s];
  return bones;
}

/** Кости кадра для данной формы кисти (только правая рука + плечо/предплечье). */
function shapeBones(shape: HandShape): Record<string, Vec3> {
  const add = (a: Vec3, b?: Vec3): Vec3 =>
    b ? [a[0] + b[0], a[1] + b[1], a[2] + b[2]] : [...a];

  const bones: Record<string, Vec3> = {
    'mixamorig:RightArm': add(BASE_ARM, shape.arm),
    'mixamorig:RightForeArm': add(BASE_FOREARM, shape.forearm),
    'mixamorig:RightHand': add(BASE_WRIST, shape.wrist),
    ...fingerJoints(shape, 'Right'),
  };

  if (shape.override) {
    for (const [k, v] of Object.entries(shape.override)) {
      bones[`mixamorig:${k}`] = v;
    }
  }
  return bones;
}

/** Нулевой кадр — рука опущена (rest). */
function restBones(): Record<string, Vec3> {
  const bones: Record<string, Vec3> = {
    'mixamorig:RightArm': [0, 0, 0],
    'mixamorig:RightForeArm': [0, 0, 0],
    'mixamorig:RightHand': [0, 0, 0],
  };
  for (const f of FINGERS) {
    for (const j of [1, 2, 3]) bones[`mixamorig:RightHand${f}${j}`] = [0, 0, 0];
  }
  for (const j of [1, 2, 3]) bones[`mixamorig:RightHandThumb${j}`] = [0, 0, 0];
  return bones;
}

const RAISE = 0.5; // подъём руки, с
const TRANSITION = 0.24; // переход между буквами, с
const HOLD = 0.55; // удержание буквы, с
const LOWER = 0.5; // опускание руки, с

/** Кадры движения буквы поверх её статичной формы (между tA и tB). */
function motionFrames(
  shape: HandShape,
  tA: number,
  tB: number,
): GestureFrame[] {
  if (!shape.motion) return [];
  const mid = (tA + tB) / 2;
  const q1 = tA + (tB - tA) * 0.25;
  const q3 = tA + (tB - tA) * 0.75;
  const withDelta = (part: 'wrist' | 'arm', d: Vec3): Record<string, Vec3> => {
    const m: HandShape = { ...shape, motion: undefined };
    const base = (part === 'wrist' ? shape.wrist : shape.arm) ?? [0, 0, 0];
    m[part] = [base[0] + d[0], base[1] + d[1], base[2] + d[2]];
    return shapeBones(m);
  };
  switch (shape.motion) {
    case 'shake':
      return [
        { t: q1, bones: withDelta('wrist', [0, 0, 0.22]) },
        { t: mid, bones: withDelta('wrist', [0, 0, -0.22]) },
        { t: q3, bones: withDelta('wrist', [0, 0, 0.22]) },
      ];
    case 'down':
      return [{ t: mid, bones: withDelta('arm', [0.3, 0, 0.15]) }];
    case 'circle':
      return [
        { t: q1, bones: withDelta('wrist', [0.25, 0, 0]) },
        { t: mid, bones: withDelta('wrist', [0.25, 0, 0.3]) },
        { t: q3, bones: withDelta('wrist', [0, 0, 0.3]) },
      ];
    case 'twist':
      return [{ t: mid, bones: withDelta('wrist', [0, -0.7, 0]) }];
  }
}

/**
 * Собирает жест-дактиль для слова: последовательный показ букв правой рукой.
 * Буквы не из алфавита (латиница, цифры, дефисы) пропускаются.
 */
export function buildFingerspellGesture(word: string): GestureJSON | null {
  const letters = word
    .toLowerCase()
    .split('')
    .filter((ch) => DACTYL_SHAPES[ch]);
  if (letters.length === 0) return null;

  const frames: GestureFrame[] = [{ t: 0, bones: restBones() }];
  let t = RAISE;

  for (const ch of letters) {
    const shape = DACTYL_SHAPES[ch];
    const bones = shapeBones(shape);
    frames.push({ t, bones });
    const tEnd = t + HOLD;
    frames.push(...motionFrames(shape, t, tEnd));
    frames.push({ t: tEnd, bones });
    t = tEnd + TRANSITION;
  }

  frames.push({ t: t - TRANSITION + LOWER, bones: restBones() });

  return {
    name: `дактиль:${word}`,
    rotation_order: 'XYZ',
    unit: 'radians',
    description: `Дактиль РЖЯ: ${letters.join('-').toUpperCase()}`,
    frames,
  };
}

/** Жест одной буквы (для панели алфавита). */
export function buildLetterGesture(letter: string): GestureJSON | null {
  return buildFingerspellGesture(letter);
}

import * as THREE from 'three';
import {
  LEFT_HAND_OFFSET, RIGHT_HAND_OFFSET, NUM_HAND,
} from '@/lib/landmarks';

/**
 * Прямое сопоставление точек MediaPipe костям скелета (aim-ретаргетинг).
 *
 * В отличие от прежнего решателя, который считал углы эвристиками и клампами,
 * здесь каждая кость просто нацеливается на свой дочерний сустав: направление
 * «сустав -> следующий сустав» у человека становится направлением кости.
 *
 * Опора — измеренная геометрия avatar.glb:
 *  - bind-поза скелета это чистая T-поза (руки строго вдоль мировых ±X);
 *  - у костей рук и пальцев локальная ось +Y направлена ПОЧТИ вдоль кости,
 *    поэтому нацеливание сводится к одному кватерниону на кость. «Почти» —
 *    потому что скелет пересажен: базисы костей исходные, а позиции суставов
 *    от нового тела, и у плечевой кости ребёнок-локоть отстоит от +Y на ~12°.
 *    Целиться надо фактическим направлением на ребёнка, иначе локоть сходит
 *    с окружности IK-решений и весь промах оседает в запястье;
 *  - у кисти локальная +Z — наружная нормаль ладони (ей задаём доворот вокруг
 *    оси кости, который одним лишь нацеливанием не определяется).
 *
 * Имена костей рук в риге минифицированы (см. таблицу ниже) — они приходят из
 * исходного Mixamo-ассета и на них ссылается библиотека готовых жестов,
 * поэтому переименовывать их нельзя.
 */

/** Кость -> её имя в риге. Левая сторона персонажа = +X мира. */
export const ARM_BONES = {
  left: { shoulder: '14', arm: '13', foreArm: '12', hand: 'z' },
  right: { shoulder: 'j', arm: 'i', foreArm: 'h', hand: 'g' },
} as const;

/** Пальцы: три фаланги от пясти к кончику. */
export const FINGER_BONES = {
  left: {
    thumb: ['m', 'l', 'k'], index: ['p', 'o', 'n'], middle: ['s', 'r', 'q'],
    ring: ['v', 'u', 't'], pinky: ['y', 'x', 'w'],
  },
  right: {
    thumb: ['3', '2', '1'], index: ['6', '5', '4'], middle: ['9', '8', '7'],
    ring: ['c', 'b', 'a'], pinky: ['f', 'e', 'd'],
  },
} as const;

/** Индексы точек MediaPipe Hands по фалангам: MCP, PIP, DIP, TIP. */
const FINGER_LANDMARKS = {
  thumb: [1, 2, 3, 4], index: [5, 6, 7, 8], middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16], pinky: [17, 18, 19, 20],
} as const;

// Индексы pose MediaPipe
const P_L_SH = 11, P_R_SH = 12;
const P_L_EL = 13, P_R_EL = 14;
const P_L_WR = 15, P_R_WR = 16;
const P_L_HIP = 23, P_R_HIP = 24;

/** MediaPipe завышает глубину позы в разы — гасим, иначе локти «схлопываются». */
const Z_DAMP_POSE = 0.25;
/**
 * Кисть MediaPipe отдаёт в собственном масштабе, её глубина куда честнее
 * позы. Сильное гашение здесь недосгибало пальцы — «кулак» получался вялым.
 */
const Z_DAMP_HAND = 0.9;

/** Пальцы отслеживаем отзывчивее корпуса — конфигурация кисти меняется резко. */
const FINGER_SMOOTH_SCALE = 1.8;

/**
 * Начиная с какой доли вытянутости руки человека мы перестаём держать
 * запястье в точке и начинаем беречь угол в локте. См. solveArmIK.
 */
const REACH_BLEND_FROM = 0.85;
const REACH_BLEND_TO = 0.99;

const BONE_AXIS = new THREE.Vector3(0, 1, 0);   // локальная ось вдоль кости
const PALM_AXIS = new THREE.Vector3(0, 0, 1);   // локальная нормаль ладони

type Side = 'left' | 'right';

/** Телесная система координат: оси совпадают с мировыми осями аватара. */
interface BodyFrame {
  origin: THREE.Vector3;
  basis: THREE.Matrix3;   // строки — ex/ey/ez, переводит мир MediaPipe в тело
  scale: number;
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

function readPoint(frame: ArrayLike<number>, offset: number, idx: number, zDamp: number): THREE.Vector3 {
  const i = offset + idx * 3;
  // MediaPipe: y растёт вниз, z — от камеры. Приводим к «y вверх, z вперёд».
  return new THREE.Vector3(frame[i], -frame[i + 1], -frame[i + 2] * zDamp);
}

function isHandVisible(frame: ArrayLike<number>, offset: number): boolean {
  for (let i = 0; i < NUM_HAND * 3; i++) {
    if (frame[offset + i] !== 0) return true;
  }
  return false;
}

/**
 * Строит систему координат тела по плечам и бёдрам: +X к левому плечу,
 * +Y вверх, +Z вперёд. Ровно те же оси, что у аватара, поэтому направления,
 * посчитанные в ней, можно применять к костям напрямую.
 *
 * ВАЖНО про зеркало. Кадр с камеры отражают по X (иначе человек видит себя
 * не как в зеркале), и отражение делает систему координат ЛЕВОсторонней.
 * Векторное произведение в ней даёт «вперёд» с обратным знаком: голова и
 * стороны совпадают, а движения рук к себе/от себя идут наоборот, будто
 * человек стоит спиной. Поэтому при mirrored ось вперёд строится как ey × ex.
 */
function buildBodyFrame(frame: ArrayLike<number>, mirrored: boolean): BodyFrame | null {
  const lsh = readPoint(frame, 0, P_L_SH, Z_DAMP_POSE);
  const rsh = readPoint(frame, 0, P_R_SH, Z_DAMP_POSE);
  const lhip = readPoint(frame, 0, P_L_HIP, Z_DAMP_POSE);
  const rhip = readPoint(frame, 0, P_R_HIP, Z_DAMP_POSE);

  const midSh = lsh.clone().add(rsh).multiplyScalar(0.5);
  const midHip = lhip.clone().add(rhip).multiplyScalar(0.5);

  const ex = lsh.clone().sub(rsh);
  const shoulderWidth = ex.length();
  if (shoulderWidth < 1e-4) return null;
  ex.divideScalar(shoulderWidth);

  const ey = midSh.clone().sub(midHip);
  if (ey.lengthSq() < 1e-8) return null;
  ey.normalize();

  // Отражённый кадр = левосторонняя система, поэтому знак «вперёд» другой.
  const ez = mirrored
    ? ey.clone().cross(ex).normalize()
    : ex.clone().cross(ey).normalize();
  // Ортогонализация — тоже с учётом знака, иначе «вверх» уедет назад.
  ey.copy(mirrored
    ? ex.clone().cross(ez).normalize()
    : ez.clone().cross(ex).normalize());

  const basis = new THREE.Matrix3().set(
    ex.x, ex.y, ex.z,
    ey.x, ey.y, ey.z,
    ez.x, ez.y, ez.z,
  );
  return { origin: midSh, basis, scale: shoulderWidth };
}

function toBody(p: THREE.Vector3, bf: BodyFrame): THREE.Vector3 {
  return p.clone().sub(bf.origin).divideScalar(bf.scale).applyMatrix3(bf.basis);
}

/**
 * Нацеливает кость так, чтобы её локальная +Y смотрела в мировом направлении
 * dirWorld. Родитель к этому моменту должен быть уже повёрнут и его мировая
 * матрица обновлена.
 */
function aimBone(
  bone: THREE.Bone,
  dirWorld: THREE.Vector3,
  rollTarget?: THREE.Vector3,
  aimAxis: THREE.Vector3 = BONE_AXIS,
) {
  const parent = bone.parent;
  if (!parent) return;
  parent.updateMatrixWorld();
  const parentQuat = parent.getWorldQuaternion(_q).clone();
  const inv = parentQuat.clone().invert();

  const dirLocal = dirWorld.clone().normalize().applyQuaternion(inv);
  bone.quaternion.setFromUnitVectors(aimAxis, dirLocal);

  // Доворот вокруг оси кости: нацеливание оставляет его свободным.
  if (rollTarget) {
    bone.updateMatrixWorld();
    const worldQuat = bone.getWorldQuaternion(_q).clone();
    const currentPalm = PALM_AXIS.clone().applyQuaternion(worldQuat);
    const axis = dirWorld.clone().normalize();

    // Проекции на плоскость, перпендикулярную кости.
    const cur = currentPalm.clone().projectOnPlane(axis);
    const tgt = rollTarget.clone().projectOnPlane(axis);
    if (cur.lengthSq() > 1e-8 && tgt.lengthSq() > 1e-8) {
      cur.normalize();
      tgt.normalize();
      let angle = Math.acos(THREE.MathUtils.clamp(cur.dot(tgt), -1, 1));
      if (cur.clone().cross(tgt).dot(axis) < 0) angle = -angle;
      const roll = new THREE.Quaternion().setFromAxisAngle(aimAxis, angle);
      bone.quaternion.multiply(roll);
    }
  }
  bone.updateMatrixWorld();
}

/**
 * Мерки скелета аватара: где плечи и какой длины кости руки.
 *
 * Длины считаются по мировым позициям суставов и от позы не зависят —
 * поворот кости не меняет расстояния до её ребёнка.
 */
interface RigMetrics {
  shoulderMid: THREE.Vector3;
  shoulderWidth: number;
  upper: number;    // плечо: сустав плеча -> локоть
  fore: number;     // предплечье: локоть -> запястье
}

function measureRig(bones: Map<string, THREE.Bone>, side: Side): RigMetrics | null {
  const armL = bones.get(ARM_BONES.left.arm);
  const armR = bones.get(ARM_BONES.right.arm);
  const arm = bones.get(ARM_BONES[side].arm);
  const fore = bones.get(ARM_BONES[side].foreArm);
  const hand = bones.get(ARM_BONES[side].hand);
  if (!armL || !armR || !arm || !fore || !hand) return null;

  const pL = armL.getWorldPosition(new THREE.Vector3());
  const pR = armR.getWorldPosition(new THREE.Vector3());
  const shoulderWidth = pL.distanceTo(pR);
  if (shoulderWidth < 1e-6) return null;

  return {
    shoulderMid: pL.clone().add(pR).multiplyScalar(0.5),
    shoulderWidth,
    upper: arm.getWorldPosition(new THREE.Vector3())
      .distanceTo(fore.getWorldPosition(new THREE.Vector3())),
    fore: fore.getWorldPosition(new THREE.Vector3())
      .distanceTo(hand.getWorldPosition(new THREE.Vector3())),
  };
}

/**
 * Куда поставить запястье аватара и куда отвести локоть.
 *
 * ЗАЧЕМ IK. Раньше кости просто повторяли направления человека. Но пропорции
 * разные: у аватара рука длиннее ширины плеч в 1.85 раза, у человека — в 1.27.
 * При одинаковых углах кисть аватара улетает дальше настоящей (промах ~0.43
 * ширины плеч), и жест «ладони вместе» ломается: обе руки проскакивают среднюю
 * линию и кисти въезжают друг в друга. Для жестового языка это фатально —
 * место кисти относительно тела и контакт кистей несут смысл, а угол в локте
 * нет. Поэтому целимся в ТОЧКУ, а не в направление.
 *
 * Точка берётся в долях ширины плеч (bodyframe уже нормирован), поэтому
 * средняя линия у человека и у аватара совпадает и ладони сходятся.
 *
 * Компромисс: чтобы у почти прямой руки локоть не оставался полусогнутым
 * (аватар дотягивается дальше человека), у вытянутой руки цель плавно
 * переезжает с «точки» на «ту же долю вытянутости». Жест обычно идёт близко к
 * телу — там работает точное попадание.
 */
function solveArmIK(
  rig: RigMetrics,
  sh: THREE.Vector3, el: THREE.Vector3, wr: THREE.Vector3,   // человек, в долях ширины плеч
): { target: THREE.Vector3; pole: THREE.Vector3; shoulder: THREE.Vector3 } | null {
  const toWorld = (p: THREE.Vector3) =>
    rig.shoulderMid.clone().addScaledVector(p, rig.shoulderWidth);

  const shoulder = toWorld(sh);
  const wrWorld = toWorld(wr);
  const pole = toWorld(el).sub(shoulder);

  const v = wrWorld.clone().sub(shoulder);
  const dist = v.length();
  if (dist < 1e-6) return null;

  const humanReach = sh.distanceTo(el) + el.distanceTo(wr);
  const rigReach = rig.upper + rig.fore;
  const frac = humanReach > 1e-6 ? sh.distanceTo(wr) / humanReach : 1;

  // Плавный переход «точка» -> «доля вытянутости» у почти прямой руки.
  const t = THREE.MathUtils.clamp(
    (frac - REACH_BLEND_FROM) / (REACH_BLEND_TO - REACH_BLEND_FROM), 0, 1);
  const w = t * t * (3 - 2 * t);
  const radius = THREE.MathUtils.clamp(
    dist * (1 - w) + frac * rigReach * w,
    Math.abs(rig.upper - rig.fore) + 1e-4,
    rigReach * 0.999,
  );

  return { target: shoulder.clone().addScaledVector(v.divideScalar(dist), radius), pole, shoulder };
}

/**
 * Аналитический двухкостный IK: возвращает мировую точку локтя.
 * Локоть кладётся на окружность решений в ту сторону, куда его отвёл человек.
 */
function elbowPosition(
  shoulder: THREE.Vector3, target: THREE.Vector3, pole: THREE.Vector3,
  upper: number, fore: number,
): THREE.Vector3 {
  const axis = target.clone().sub(shoulder);
  const dist = axis.length();
  axis.divideScalar(dist);

  const cos = THREE.MathUtils.clamp(
    (upper * upper + dist * dist - fore * fore) / (2 * upper * dist), -1, 1);
  const sin = Math.sqrt(1 - cos * cos);

  // Направление отведения локтя — то же, что у человека, но строго поперёк руки.
  let perp = pole.clone().projectOnPlane(axis);
  if (perp.lengthSq() < 1e-10) {
    perp = new THREE.Vector3(0, 0, -1).projectOnPlane(axis);
    if (perp.lengthSq() < 1e-10) perp = new THREE.Vector3(0, -1, 0).projectOnPlane(axis);
  }
  perp.normalize();

  return shoulder.clone()
    .addScaledVector(axis, upper * cos)
    .addScaledVector(perp, upper * sin);
}

/**
 * Порог достоверности сустава. Ниже него MediaPipe не «видит» точку, а
 * достраивает её — по таким координатам двигать руку нельзя.
 */
const MIN_VISIBILITY = 0.65;

export interface SolveOptions {
  /** Достоверность точек позы (33 значения) — из extractPoseVisibility. */
  visibility?: ArrayLike<number>;
  /** Сглаживание между кадрами: 0 — без него, 0.75 — сильное. */
  smoother?: PoseSmoother;
  /**
   * Кадр отражён по X (так снимает студия — человек видит себя как в зеркале).
   * От этого зависит знак оси «вперёд», см. buildBodyFrame.
   */
  mirrored?: boolean;
}

/**
 * Сглаживание позы по времени. Трекинг с одной камеры всегда дрожит, и без
 * фильтра аватар мелко трясётся даже когда человек стоит неподвижно.
 */
export class PoseSmoother {
  private prev = new Map<string, THREE.Quaternion>();
  /** Доля новой позы в кадре: меньше — плавнее, но с задержкой. */
  constructor(public alpha = 0.45) {}

  /** scale > 1 ослабляет сглаживание для этой кости (быстрее отклик). */
  apply(bone: THREE.Bone, name: string, scale = 1) {
    const prev = this.prev.get(name);
    const a = Math.min(this.alpha * scale, 1);
    if (prev) bone.quaternion.slerp(prev, 1 - a);
    this.prev.set(name, bone.quaternion.clone());
  }

  /** Сбросить историю — например, при потере и повторном захвате руки. */
  forget(names: string[]) {
    for (const n of names) this.prev.delete(n);
  }
}

/** Все кости одной руки — для сброса истории сглаживания. */
function armBoneNames(side: Side): string[] {
  const a = ARM_BONES[side];
  const out = [a.arm, a.foreArm, a.hand];
  for (const chain of Object.values(FINGER_BONES[side])) out.push(...chain);
  return out;
}

/**
 * Ставит скелет в позу одного кадра лэндмарков.
 *
 * Рука, которой не видно, НЕ трогается вовсе — кости остаются там, где были.
 * Это осознанно: замереть в последней позе гораздо лучше, чем махать руками
 * по выдуманным координатам.
 *
 * Возвращает false, если кадр непригоден (не видно корпуса).
 */
export function solvePose(
  frame: ArrayLike<number>,
  bones: Map<string, THREE.Bone>,
  opts: SolveOptions = {},
): boolean {
  const mirrored = opts.mirrored ?? true;
  const bf = buildBodyFrame(frame, mirrored);
  if (!bf) return false;
  const vis = opts.visibility;
  const smoother = opts.smoother;

  const visible = (idx: number) => !vis || (vis[idx] ?? 0) >= MIN_VISIBILITY;

  for (const side of ['left', 'right'] as Side[]) {
    const names = ARM_BONES[side];
    const armBone = bones.get(names.arm);
    const foreBone = bones.get(names.foreArm);
    const handBone = bones.get(names.hand);
    if (!armBone || !foreBone) continue;

    const shIdx = side === 'left' ? P_L_SH : P_R_SH;
    const elIdx = side === 'left' ? P_L_EL : P_R_EL;
    const wrIdx = side === 'left' ? P_L_WR : P_R_WR;

    // Не видно плеча, локтя или запястья — рука замирает.
    if (!visible(shIdx) || !visible(elIdx) || !visible(wrIdx)) {
      smoother?.forget(armBoneNames(side));
      continue;
    }

    const sh = toBody(readPoint(frame, 0, shIdx, Z_DAMP_POSE), bf);
    const el = toBody(readPoint(frame, 0, elIdx, Z_DAMP_POSE), bf);
    const wr = toBody(readPoint(frame, 0, wrIdx, Z_DAMP_POSE), bf);

    const upperDir = el.clone().sub(sh);
    const foreDir = wr.clone().sub(el);
    if (upperDir.lengthSq() < 1e-8 || foreDir.lengthSq() < 1e-8) continue;

    // Плечо ведём по IK, если риг промерился; иначе — прежним нацеливанием.
    // Ось нацеливания — фактическое направление на локоть в осях кости:
    // у пересаженного скелета оно не совпадает с +Y (см. шапку файла).
    const elbowAxis = foreBone.position.lengthSq() > 1e-10
      ? foreBone.position.clone().normalize()
      : undefined;
    const rig = handBone ? measureRig(bones, side) : null;
    const ik = rig ? solveArmIK(rig, sh, el, wr) : null;
    if (ik) {
      const elbow = elbowPosition(ik.shoulder, ik.target, ik.pole, rig!.upper, rig!.fore);
      aimBone(armBone, elbow.clone().sub(ik.shoulder), undefined, elbowAxis);
    } else {
      aimBone(armBone, upperDir, undefined, elbowAxis);
    }
    smoother?.apply(armBone, names.arm);

    // Кисть и пальцы — только если рука реально видна.
    const handOffset = side === 'left' ? LEFT_HAND_OFFSET : RIGHT_HAND_OFFSET;
    const handTracked = !!handBone && isHandVisible(frame, handOffset);

    let palmNormal: THREE.Vector3 | undefined;
    let hp: THREE.Vector3[] = [];
    if (handTracked) {
      // ВАЖНО: точки кисти НЕ смешиваются с телесной системой координат.
      //
      // MediaPipe гасит глубину позы и кисти по-разному (поза врёт куда
      // сильнее), и если проецировать кисть на базис, построенный по позе,
      // глубина пальцев оказывается растянутой в разы относительно ширины.
      // Пальцы тогда преувеличенно «ныряют» к камере, а разведение вбок
      // почти пропадает — ровно то, что видно как «сжимаются, но не двигаются».
      // Поэтому кисть живёт в СВОЁМ масштабе: масштаб задаёт сама ладонь.
      const rawHand: THREE.Vector3[] = [];
      for (let i = 0; i < NUM_HAND; i++) {
        rawHand.push(readPoint(frame, handOffset, i, Z_DAMP_HAND));
      }
      const wrist = rawHand[0];
      const palmLen = Math.max(rawHand[9].distanceTo(wrist), 1e-6);
      hp = rawHand.map((p) => p.clone().sub(wrist).divideScalar(palmLen));

      // Кисть измерена в осях кадра, а не тела: доворачиваем в телесные оси,
      // чтобы ориентация ладони и пальцев совпала с остальным скелетом.
      hp = hp.map((p) => p.applyMatrix3(bf.basis));

      // Нормаль ладони считаем УЖЕ в телесных осях. Переносить её из осей
      // кадра нельзя: нормаль — псевдовектор, а зеркальный кадр даёт
      // левостороннюю систему, и знак при переносе теряется.
      const acrossPalm = hp[17].clone().sub(hp[5]);       // от указательного к мизинцу
      const alongPalm = hp[9].clone().sub(hp[0]);         // от запястья к средней пясти
      const n = alongPalm.clone().cross(acrossPalm);
      if (n.lengthSq() > 1e-10) {
        palmNormal = n.normalize();
        // Знак зависит только от стороны: обход пясти у левой и правой кисти
        // зеркальный.
        //
        // Сверено с bind-позой avatar.glb, где ладони смотрят ВНИЗ (большой
        // палец вперёд), а локальная +Z костей кисти и предплечья — тоже вниз,
        // то есть +Z действительно наружная нормаль. По той же геометрии:
        //   левая  кисть: (пясть-запястье) x (мизинец-указательный) — ВНУТРЬ
        //   правая кисть: то же произведение — НАРУЖУ
        // Поэтому переворачивать нужно левую. Раньше здесь стояла правая, и
        // обе кисти уезжали на 180° вокруг своей оси: пальцы нацеливались
        // верно, но их основания оказывались на противоположной стороне —
        // кулак выглядел вывернутым, а разведённые пальцы скрещивались.
        if (side === 'left') palmNormal.negate();
      }
    }

    // Предплечье несёт супинацию: именно поворот предплечья разворачивает
    // ладонь. Без него весь разворот сваливался на кисть и её выкручивало.
    //
    // Направление берём от РЕАЛЬНОГО локтя, уже после сглаживания плеча:
    // сглаживание тянет плечо назад, и если целиться от расчётного локтя,
    // запястье промахивается мимо цели на быстром движении.
    if (ik) {
      armBone.updateMatrixWorld(true);
      const elbowNow = foreBone.getWorldPosition(new THREE.Vector3());
      aimBone(foreBone, ik.target.clone().sub(elbowNow), palmNormal);
    } else {
      aimBone(foreBone, foreDir, palmNormal);
    }
    smoother?.apply(foreBone, names.foreArm);

    if (!handTracked || !handBone) continue;

    // Кисть и пальцы целимся ФАКТИЧЕСКОЙ осью на дочерний сустав — как и
    // локоть выше. У исходного скелета (Адам) ребёнок лежит ровно на +Y и
    // ось совпадает; у пересаженного (Ева) суставы сдвинуты на 12–40°, и
    // нацеливание осью +Y растопыривало пальцы — зазор между сомкнутыми
    // пальцами человека на аватаре превращался в веер.
    const childAxis = (parent: THREE.Bone, childName: string): THREE.Vector3 | undefined => {
      const child = bones.get(childName);
      if (child && child.parent === parent && child.position.lengthSq() > 1e-10) {
        return child.position.clone().normalize();
      }
      return undefined;
    };

    // Кисть смотрит на пясть среднего пальца, доворот — по той же нормали.
    const handDir = hp[9].clone().sub(hp[0]);
    if (handDir.lengthSq() > 1e-8) {
      aimBone(handBone, handDir, palmNormal,
        childAxis(handBone, FINGER_BONES[side].middle[0]));
      smoother?.apply(handBone, names.hand);
    }

    for (const [fname, lms] of Object.entries(FINGER_LANDMARKS)) {
      const boneNames = FINGER_BONES[side][fname as keyof typeof FINGER_LANDMARKS];
      for (let j = 0; j < 3; j++) {
        const bone = bones.get(boneNames[j]);
        if (!bone) continue;
        const dir = hp[lms[j + 1]].clone().sub(hp[lms[j]]);
        if (dir.lengthSq() < 1e-10) continue;
        // У последней фаланги дочерней кости нет — она остаётся на +Y.
        aimBone(bone, dir, undefined, j < 2 ? childAxis(bone, boneNames[j + 1]) : undefined);
        // Пальцы двигаются быстро и мелко — сглаживаем слабее, иначе
        // смена конфигурации кисти «залипает».
        smoother?.apply(bone, boneNames[j], FINGER_SMOOTH_SCALE);
      }
    }
  }
  return true;
}

/** Видна ли рука целиком: и суставы позы, и сама кисть. */
export function isArmTracked(
  frame: ArrayLike<number>,
  side: Side,
  visibility?: ArrayLike<number>,
): boolean {
  const idx = side === 'left' ? [P_L_SH, P_L_EL, P_L_WR] : [P_R_SH, P_R_EL, P_R_WR];
  if (visibility) {
    for (const i of idx) {
      if ((visibility[i] ?? 0) < MIN_VISIBILITY) return false;
    }
  }
  return isHandVisible(frame, side === 'left' ? LEFT_HAND_OFFSET : RIGHT_HAND_OFFSET);
}

/**
 * Локальные повороты костей после solvePose как дельты от rest-позы —
 * формат, который играет gesturePlayer.
 */
export function readBoneDeltas(
  bones: Map<string, THREE.Bone>,
  rest: Map<string, THREE.Euler>,
): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {};
  const names: string[] = [];
  for (const side of ['left', 'right'] as Side[]) {
    names.push(ARM_BONES[side].arm, ARM_BONES[side].foreArm, ARM_BONES[side].hand);
    for (const chain of Object.values(FINGER_BONES[side])) names.push(...chain);
  }
  for (const name of names) {
    const bone = bones.get(name);
    const r = rest.get(name);
    if (!bone || !r) continue;
    const e = new THREE.Euler().setFromQuaternion(bone.quaternion, 'XYZ');
    out[name] = [
      round4(e.x - r.x),
      round4(e.y - r.y),
      round4(e.z - r.z),
    ];
  }
  return out;
}

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}

/** Снимок rest-поворотов — нужен для вычисления дельт. */
export function captureRest(bones: Map<string, THREE.Bone>): Map<string, THREE.Euler> {
  const rest = new Map<string, THREE.Euler>();
  for (const [name, bone] of bones) {
    rest.set(name, new THREE.Euler().setFromQuaternion(bone.quaternion, 'XYZ'));
  }
  return rest;
}

export { _v, _m };

/**
 * Набор для построения знаков на Елнаре: обе руки, формы кисти, касания, голова.
 *
 * Знак задаётся так, как его видит собеседник: где кисть относительно тела,
 * куда смотрят пальцы и ладонь, какая форма кисти, куда смотрит локоть.
 * Углы костей считает IK (armIK.mjs) — поэтому пропорции аватара не искажают знак.
 *
 * ЕДИНИЦЫ. Положения задаются в ширинах плеч (между плечевыми суставами) от
 * середины плеч: x — к ЛЕВОЙ руке аватара, y — вверх, z — вперёд, к зрителю.
 * Так же записаны замеры носителей (scripts/lib/phraseRefs.mjs), поэтому числа
 * из эталона переносятся без пересчёта.
 *
 * ЛЕВАЯ РУКА. Риг Елнара зеркально симметричен (проверено: локальные
 * кватернионы левой руки = отражению правых, расхождение 0.00°). Левая рука
 * решается как отражённая правая: цель отражается по X, решается правая рука,
 * локальные повороты отражаются обратно — q(x, y, z, w) → q(x, −y, −z, w).
 */
import { THREE, applyFrame, wpos, wquat, ARM, JSON_NAME, STANCE_ARM_X, IDLE_ARM_X } from './rig.mjs';
import { solveRightArm, handFrame, deltaFromLocal } from './armIK.mjs';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rad = THREE.MathUtils.degToRad;

export const mirV = (v) => V(-v.x, v.y, v.z);
export const mirQ = (q) => new THREE.Quaternion(q.x, -q.y, -q.z, q.w);

/** Имя кости правой руки → имя парной кости левой. */
const R2L = {};
for (const k of ['shoulder', 'arm', 'fore', 'hand']) R2L[ARM.right[k]] = ARM.left[k];
for (const f of ['thumb', 'index', 'middle', 'ring', 'pinky']) ARM.right[f].forEach((n, i) => { R2L[n] = ARM.left[f][i]; });

const FINGERS = ['index', 'middle', 'ring', 'pinky'];

/**
 * Форма кисти — числа, а не кватернионы: так её можно плавно смешивать.
 *   curl  — сгиб трёх фаланг (°), вокруг локальной +X фаланги (к ладони);
 *   spread — веер у основания (°), вокруг локальной +Z: плюс — от большого пальца;
 *   thumb: abd — вокруг +Z первой кости (плюс — к указательному, минус — прочь),
 *          f1/f2/f3 — сгиб трёх костей вокруг их +X (к ладони).
 * Нули = покой рига: пальцы прямые, большой отведён перед ладонью (~40°).
 */
export const SHAPES = {
  rest: {
    index: { curl: [0, 0, 0], spread: 0 }, middle: { curl: [0, 0, 0], spread: 0 },
    ring: { curl: [0, 0, 0], spread: 0 }, pinky: { curl: [0, 0, 0], spread: 0 },
    thumb: { abd: 0, f1: 0, f2: 0, f3: 0 },
  },
};

/** Удобная запись формы: пальцы по отдельности, недостающее — из покоя. */
export function shape(spec) {
  const out = structuredClone(SHAPES.rest);
  for (const [k, v] of Object.entries(spec)) Object.assign(out[k], v);
  return out;
}

/** Смешать две формы: k=0 — a, k=1 — b. */
export function mixShape(a, b, k) {
  const out = structuredClone(a);
  for (const f of FINGERS) {
    out[f].curl = a[f].curl.map((x, i) => x + (b[f].curl[i] - x) * k);
    out[f].spread = a[f].spread + (b[f].spread - a[f].spread) * k;
  }
  for (const p of ['abd', 'f1', 'f2', 'f3']) out.thumb[p] = a.thumb[p] + (b.thumb[p] - a.thumb[p]) * k;
  return out;
}

export function createKit(rig) {
  const R = ARM.right, L = ARM.left;
  const S_R = wpos(rig.bones.get(R.arm)), S_L = wpos(rig.bones.get(L.arm));
  const MID = S_R.clone().add(S_L).multiplyScalar(0.5);
  const SW = S_R.distanceTo(S_L);
  const restQ = (bone) => new THREE.Quaternion().setFromEuler(rig.rest.get(bone));

  /** Точка из единиц эталона (ширины плеч от середины плеч) в мир рига. */
  const ref = (x, y, z) => MID.clone().add(V(x, y, z).multiplyScalar(SW));
  /** Обратно: мир → единицы эталона. */
  const toRef = (p) => p.clone().sub(MID).multiplyScalar(1 / SW);

  /** Локальные повороты пальцев ПРАВОЙ кисти по форме. */
  function shapeLocalsRight(sh) {
    const out = {};
    for (const f of FINGERS) {
      const [b1, b2, b3] = R[f];
      const [c1, c2, c3] = sh[f].curl;
      out[b1] = restQ(b1)
        .multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), rad(sh[f].spread)))
        .multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), rad(c1)));
      out[b2] = restQ(b2).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), rad(c2)));
      out[b3] = restQ(b3).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), rad(c3)));
    }
    const [t1, t2, t3] = R.thumb;
    const th = sh.thumb;
    out[t1] = restQ(t1)
      .multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), rad(th.abd)))
      .multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), rad(th.f1)));
    out[t2] = restQ(t2).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), rad(th.f2)));
    out[t3] = restQ(t3).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), rad(th.f3)));
    return out;
  }

  /** Локальные повороты для стороны: у левой — отражённые правые под левыми именами. */
  function toSide(side, localsRight) {
    if (side === 'right') return localsRight;
    const out = {};
    for (const [n, q] of Object.entries(localsRight)) out[R2L[n]] = mirQ(q);
    return out;
  }

  /**
   * Ориентация кисти в мире по направлению пальцев (пястья) и нормали ладони.
   * Для левой кисти — отражение правой: так оси рига совпадают сами.
   */
  function handQuat(side, fingers, palm) {
    if (side === 'right') return handFrame(fingers, palm);
    return mirQ(handFrame(mirV(fingers), mirV(palm)));
  }

  /** IK руки стороны. Всё в мире; левая решается через отражение. */
  function solveArm(side, { wrist, pole, hand, foreTwist = 0.6 }) {
    if (side === 'right') {
      const s = solveRightArm(rig, { wrist, pole, hand, foreTwist });
      return { locals: s.local, neutralHand: s.neutralHand, flexDeg: s.flexDeg, twistDeg: s.twistDeg, reach: s.wrist.distanceTo(wrist) };
    }
    const s = solveRightArm(rig, { wrist: mirV(wrist), pole: mirV(pole), hand: mirQ(hand), foreTwist });
    return {
      locals: toSide('left', s.local), neutralHand: mirQ(s.neutralHand),
      flexDeg: s.flexDeg, twistDeg: s.twistDeg, reach: s.wrist.distanceTo(mirV(wrist)),
    };
  }

  /** Покой стороны (как у плеера в простое): рука висит, кисть прямая. */
  function idleLocals(side) {
    const B = ARM[side];
    const out = {};
    for (const n of [B.arm, B.fore, B.hand, ...B.thumb, ...B.index, ...B.middle, ...B.ring, ...B.pinky]) {
      const e = rig.rest.get(n).clone();
      if (n === B.arm) e.x += IDLE_ARM_X - STANCE_ARM_X;
      out[n] = new THREE.Quaternion().setFromEuler(e);
    }
    return out;
  }

  /** Где запястье, как повёрнута кисть и куда смотрит локоть в покое. */
  function idleTargets(side) {
    const B = ARM[side];
    applyFrame(rig, localsToDeltas({ ...idleLocals('right'), ...idleLocals('left') }));
    // Локоть прямой руки смотрит назад: против направления сгиба предплечья
    // (+X плеча правой руки). Левая — отражение правой.
    const rightPole = V(1, 0, 0).applyQuaternion(wquat(rig.bones.get(R.arm))).negate();
    const out = {
      wrist: wpos(rig.bones.get(B.hand)),
      hand: wquat(rig.bones.get(B.hand)),
      pole: side === 'right' ? rightPole : mirV(rightPole),
    };
    applyFrame(rig, {});
    return out;
  }

  /** Локальные кватернионы (имена рига) → дельты GestureJSON. */
  function localsToDeltas(locals) {
    const out = {};
    for (const [bone, q] of Object.entries(locals)) out[JSON_NAME[bone] ?? bone] = deltaFromLocal(rig, bone, q);
    return out;
  }

  /**
   * Голова и шея: подбородок вверх — положительный pitchDeg (кость: минус по X);
   * наклон к левому плечу — положительный rollDeg (кость: минус по Z, проверено
   * числом: +Z уводит макушку к правому плечу); поворот лица к левой руке аватара —
   * положительный yawDeg (кость: плюс по Y, проверено числом 26.09: +0.3 рад уводит
   * нос на 3.5 см к левой руке). Поровну не делим: шея берёт 40 %.
   */
  function headDeltas(pitchDeg = 0, rollDeg = 0, yawDeg = 0) {
    const a = -rad(pitchDeg), r = -rad(rollDeg), y = rad(yawDeg);
    return { 'mixamorig:Neck': [a * 0.4, y * 0.4, r * 0.4], 'mixamorig:Head': [a * 0.6, y * 0.6, r * 0.6] };
  }

  /** Кончики пальцев и центр ладони стороны в мире (кадр уже наложен applyFrame). */
  function handPoints(side) {
    const B = ARM[side];
    const tipOf = (f) => {
      const [, b2, b3] = B[f].map((n) => rig.bones.get(n));
      const p2 = wpos(b2), p3 = wpos(b3);
      // концевой кости у рига нет: кончик — продолжение третьей фаланги (~0.85 её длины)
      return p3.clone().add(p3.clone().sub(p2).multiplyScalar(0.85));
    };
    const hand = rig.bones.get(B.hand);
    const hq = wquat(hand), hp = wpos(hand);
    // центр ладони: середина между запястьем и основанием среднего, чуть к ладонной стороне
    const mcp = wpos(rig.bones.get(B.middle[0]));
    const palmN = V(0, 0, 1).applyQuaternion(hq); // +Z кисти — нормаль ладони (у левой тоже: отражение сохраняет Z)
    const palmCenter = hp.clone().lerp(mcp, 0.55).add(palmN.clone().multiplyScalar(0.012));
    // основание ладони со стороны мизинца (гипотенар): чуть выше запястья, к мизинцу, на коже ладони
    const pinkyMcp = wpos(rig.bones.get(B.pinky[0]));
    const heel = hp.clone().lerp(pinkyMcp, 0.3).add(palmN.clone().multiplyScalar(0.012));
    return {
      index: tipOf('index'), middle: tipOf('middle'), ring: tipOf('ring'), pinky: tipOf('pinky'),
      thumb: (() => { const [, b2, b3] = B.thumb.map((n) => rig.bones.get(n)); const p2 = wpos(b2), p3 = wpos(b3); return p3.clone().add(p3.clone().sub(p2).multiplyScalar(0.85)); })(),
      wrist: hp, palmCenter, palmNormal: palmN, heel,
    };
  }

  /**
   * Кратчайшее расстояние кожа к коже между кистями (кадр уже наложен): фаланги
   * и пясти как отрезки-цилиндры, толщина пальца ~16 мм на двоих, пясти ~30 мм.
   * Минус — кисти проходят друг сквозь друга.
   */
  function handsGap() {
    const segs = (side) => {
      const B = ARM[side];
      const out = [];
      for (const f of ['index', 'middle', 'ring', 'pinky', 'thumb']) {
        const bs = B[f].map((n) => wpos(rig.bones.get(n)));
        const tip = bs[2].clone().add(bs[2].clone().sub(bs[1]).multiplyScalar(0.85));
        out.push([bs[0], bs[1], 0.008], [bs[1], bs[2], 0.008], [bs[2], tip, 0.007]);
      }
      const w = wpos(rig.bones.get(B.hand));
      for (const f of ['index', 'middle', 'ring', 'pinky']) out.push([w, wpos(rig.bones.get(B[f][0])), 0.012]);
      return out;
    };
    const dist = (a1, a2, b1, b2) => {
      let best = Infinity;
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) best = Math.min(best, a1.clone().lerp(a2, i / 8).distanceTo(b1.clone().lerp(b2, j / 8)));
      return best;
    };
    let best = { gap: Infinity };
    for (const [a1, a2, ra] of segs('right')) for (const [b1, b2, rb] of segs('left')) {
      const gap = dist(a1, a2, b1, b2) - ra - rb;
      if (gap < best.gap) best = { gap };
    }
    return best.gap;
  }

  /**
   * Лицо для касаний: передние вершины головы (тело выше плеч) в осях кости
   * головы. Лицо у рига привязано к голове жёстко, поэтому в любой позе его
   * вершины = мировая матрица головы × эти точки — кивок и наклон учтены.
   */
  let faceLocal = null;
  const spotLocal = {};
  /**
   * vertsBind — вершины тела в bind-позе (мир); spotsBind — именованные точки
   * лица в bind-позе ({ лоб: V(...), ... }) для прицеливания кисти.
   */
  function setFaceMesh(vertsBind, spotsBind = {}) {
    const hb = rig.bones.get('mixamorigHead');
    applyFrame(rig, {});
    const inv = hb.matrixWorld.clone().invert();
    faceLocal = vertsBind
      .filter((p) => p[1] > 1.45 && p[2] > 0.02 && Math.abs(p[0]) < 0.1)
      .map((p) => V(p[0], p[1], p[2]).applyMatrix4(inv));
    for (const [k, p] of Object.entries(spotsBind)) spotLocal[k] = p.clone().applyMatrix4(inv);
  }
  /** Вершины лица в мире для уже наложенного кадра. */
  function facePoints() {
    const m = rig.bones.get('mixamorigHead').matrixWorld;
    return faceLocal.map((p) => p.clone().applyMatrix4(m));
  }
  /** Именованная точка лица в мире для уже наложенного кадра (голова может быть наклонена). */
  function faceSpot(name) {
    return spotLocal[name].clone().applyMatrix4(rig.bones.get('mixamorigHead').matrixWorld);
  }
  /**
   * Корпус для касаний (грудь): передняя поверхность тела и одежды между
   * плечами. Корпус в жестах не двигается, поэтому точки — прямо в мире.
   */
  let torsoPts = null;
  const bodySpots = {};
  function setBodyMesh(vertsBind, spots = {}) {
    torsoPts = vertsBind
      .filter((p) => p[1] > 1.0 && p[1] < 1.47 && Math.abs(p[0]) < 0.2 && p[2] > 0.0)
      .map((p) => V(p[0], p[1], p[2]));
    Object.assign(bodySpots, spots);
  }
  const bodySpot = (name) => bodySpots[name].clone();
  /** Кратчайшее расстояние кожа к коже от кисти стороны до груди (кадр уже наложен). */
  function bodyGap(side) {
    return pointsGap(side, torsoPts);
  }

  /**
   * Кратчайшее расстояние кожа к коже от кисти стороны до лица (кадр уже
   * наложен): фаланги и пясти — отрезки-цилиндры, как в handsGap, лицо — его
   * вершины. Минус — кисть в лице.
   */
  function faceGap(side) {
    return pointsGap(side, facePoints());
  }

  function pointsGap(side, pts) {
    const B = ARM[side];
    const segs = [];
    for (const f of ['index', 'middle', 'ring', 'pinky', 'thumb']) {
      const bs = B[f].map((n) => wpos(rig.bones.get(n)));
      const tip = bs[2].clone().add(bs[2].clone().sub(bs[1]).multiplyScalar(0.85));
      segs.push([bs[0], bs[1], 0.008], [bs[1], bs[2], 0.008], [bs[2], tip, 0.007]);
    }
    const w = wpos(rig.bones.get(B.hand));
    for (const f of ['index', 'middle', 'ring', 'pinky']) segs.push([w, wpos(rig.bones.get(B[f][0])), 0.012]);
    let best = Infinity;
    const tmp = new THREE.Line3();
    const q = new THREE.Vector3();
    for (const [a, b, r] of segs) {
      tmp.set(a, b);
      for (const p of pts) {
        tmp.closestPointToPoint(p, true, q);
        const d = q.distanceTo(p) - r;
        if (d < best) best = d;
      }
    }
    return best;
  }

  return {
    rig, MID, SW, ref, toRef, restQ, R, L, handsGap, setFaceMesh, faceGap, faceSpot, facePoints,
    setBodyMesh, bodyGap, bodySpot,
    shapeLocals: (side, sh) => toSide(side, shapeLocalsRight(sh)),
    handQuat, solveArm, idleLocals, idleTargets, localsToDeltas, headDeltas, handPoints,
  };
}

/** Сглаживания. */
export const ease = {
  lin: (k) => k,
  io: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  sine: (k) => 0.5 - 0.5 * Math.cos(Math.PI * k),
  out: (k) => 1 - Math.pow(1 - k, 3),
  in: (k) => k * k * k,
};
export const smoothstep = (k, a = 0, b = 1) => THREE.MathUtils.smoothstep(k, a, b);
export { V, rad };

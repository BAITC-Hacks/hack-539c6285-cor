/**
 * Поза руки по цели: где запястье, куда смотрит ладонь.
 *
 * Жест задаётся тем, что видит собеседник, — положением кисти и ориентацией
 * ладони, а не углами суставов. Углы считаются отсюда для конкретного рига,
 * поэтому пропорции аватара не искажают знак.
 *
 * Оси рига (проверены на avatar_elnar.glb, правая рука, база жестов):
 *   плечо/предплечье: +Y вдоль кости, сгиб локтя — поворот вокруг локальной Z,
 *     отрицательный угол сгибает руку (предплечье уходит в сторону локальной +X);
 *   кисть: +Y вдоль пальцев, +X к большому пальцу, +Z — нормаль ладони.
 * Для левой руки рига оси отражены, поэтому модуль пока работает только с правой.
 */
import { THREE, ARM, JSON_NAME, wpos, wquat } from './rig.mjs';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Ортонормированный базис (столбцы X, Y, Z) → кватернион. */
export function quatFromAxes(x, y, z) {
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/**
 * Ориентация кисти в мире: пальцы по `fingers`, ладонь смотрит по `palm`.
 * `palm` ортогонализуется к пальцам (пальцы главнее).
 */
export function handFrame(fingers, palm) {
  const y = fingers.clone().normalize();
  const z = palm.clone().sub(y.clone().multiplyScalar(palm.dot(y))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return quatFromAxes(x, y, z);
}

/** Угол скручивания кватерниона вокруг оси (swing-twist). */
function twistAngle(q, axis) {
  const p = axis.clone().multiplyScalar(axis.dot(V(q.x, q.y, q.z)));
  const t = new THREE.Quaternion(p.x, p.y, p.z, q.w).normalize();
  let a = 2 * Math.atan2(V(t.x, t.y, t.z).dot(axis), t.w);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Решить правую руку.
 *
 * @param rig       из loadRig(); кости должны стоять в базе
 * @param wrist     цель запястья (мир)
 * @param pole      куда смотрит локоть (мир, направление)
 * @param hand      кватернион кисти в мире (см. handFrame)
 * @param foreTwist доля пронации/супинации, которую берёт предплечье (остальное — кисть)
 * @returns локальные кватернионы костей плеча, предплечья и кисти
 */
export function solveRightArm(rig, { wrist, pole, hand, foreTwist = 0.6 }) {
  const B = ARM.right;
  const bArm = rig.bones.get(B.arm), bFore = rig.bones.get(B.fore), bHand = rig.bones.get(B.hand);
  const parentQ = wquat(bArm.parent);
  const S = wpos(bArm);
  const L1 = wpos(bFore).distanceTo(S);
  const L2 = wpos(bHand).distanceTo(wpos(bFore));

  // Локоть: треугольник плечо–локоть–запястье, плоскость задаёт pole
  const toW = wrist.clone().sub(S);
  const d = Math.min(toW.length(), L1 + L2 - 1e-4);
  const a = toW.clone().normalize();
  const cosA = THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  const p = pole.clone().sub(a.clone().multiplyScalar(pole.dot(a))).normalize();
  const E = S.clone()
    .add(a.clone().multiplyScalar(L1 * cosA))
    .add(p.clone().multiplyScalar(L1 * Math.sqrt(1 - cosA * cosA)));
  const W = S.clone().add(a.clone().multiplyScalar(d));

  const u = E.clone().sub(S).normalize();   // плечо
  const f = W.clone().sub(E).normalize();   // предплечье
  // Плечо: +Y вдоль кости, +X — куда сгибается предплечье, Z — ось локтя.
  // У прямой руки плоскость сгиба не определена — берём её от pole:
  // локоть смотрит на pole, значит предплечье сгибается в обратную сторону.
  let xi = f.clone().sub(u.clone().multiplyScalar(f.dot(u)));
  if (xi.lengthSq() < 1e-6) xi = pole.clone().sub(u.clone().multiplyScalar(pole.dot(u))).negate();
  xi.normalize();
  const zi = new THREE.Vector3().crossVectors(xi, u);
  const qArmW = quatFromAxes(xi, u, zi);
  // Предплечье без скручивания: та же ось локтя Z, +Y вдоль предплечья
  const xh = new THREE.Vector3().crossVectors(f, zi);
  let qForeW = quatFromAxes(xh, f, zi);

  // Пронацию делим между предплечьем и кистью: запястье не скручивается целиком
  const qHandLocal0 = qForeW.clone().invert().multiply(hand);
  const tw = twistAngle(qHandLocal0, V(0, 1, 0));
  const qTwist = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), tw * foreTwist);
  qForeW = qForeW.clone().multiply(qTwist);

  const local = {
    [B.arm]: parentQ.clone().invert().multiply(qArmW),
    [B.fore]: qArmW.clone().invert().multiply(qForeW),
    [B.hand]: qForeW.clone().invert().multiply(hand),
  };
  const flex = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(u.dot(f), -1, 1)));
  return {
    local, elbow: E, wrist: W, flexDeg: flex, twistDeg: THREE.MathUtils.radToDeg(tw),
    /** Кисть, продолжающая предплечье (прямое запястье, без пронации) — мир. */
    neutralHand: quatFromAxes(xh, f, zi).multiply(new THREE.Quaternion().setFromEuler(rig.rest.get(B.hand))),
  };
}

/** Локальный кватернион → дельта Эйлера XYZ против базы (формат жестов). */
export function deltaFromLocal(rig, boneName, qLocal) {
  const e = new THREE.Euler().setFromQuaternion(qLocal, 'XYZ');
  const r = rig.rest.get(boneName);
  return [e.x - r.x, e.y - r.y, e.z - r.z];
}

/** Кадр в формате GestureJSON: { 'mixamorig:RightArm': [dx,dy,dz], ... } */
export function frameFromLocals(rig, locals) {
  const out = {};
  for (const [bone, q] of Object.entries(locals)) {
    out[JSON_NAME[bone] ?? bone] = deltaFromLocal(rig, bone, q);
  }
  return out;
}

/**
 * Дельты непрерывны во времени: убираем скачки на 2π, иначе линейная
 * интерполяция плеера провернёт кость через полный оборот.
 */
export function unwrapFrames(frames) {
  for (let i = 1; i < frames.length; i++) {
    for (const [n, d] of Object.entries(frames[i].bones)) {
      const prev = frames[i - 1].bones[n];
      if (!prev) continue;
      for (let k = 0; k < 3; k++) {
        while (d[k] - prev[k] > Math.PI) d[k] -= 2 * Math.PI;
        while (d[k] - prev[k] < -Math.PI) d[k] += 2 * Math.PI;
      }
    }
  }
  return frames;
}

/**
 * Скелет аватара в node — ровно так, как его видит приложение.
 *
 * Разбираем узлы GLB в иерархию THREE.Bone, имена чистим тем же правилом, что
 * GLTFLoader (PropertyBinding.sanitizeNodeName: «mixamorig:Hips» →
 * «mixamorigHips»), затем кладём ту же стойку, что avatarLoader.applyNaturalStance.
 * После этого `bone.rotation` каждой кости совпадает с restRotations плеера —
 * базой, относительно которой в жестах записаны дельты.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

export { THREE };

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Константы из src/lib/avatarLoader.ts — держать в синхроне. */
export const STANCE_ARM_X = 1.25;
export const IDLE_ARM_X = 1.45;

/** Правая и левая рука: плечо, предплечье, кисть и фаланги (минифицированные имена рига). */
export const ARM = {
  right: {
    shoulder: 'j', arm: 'i', fore: 'h', hand: 'g',
    thumb: ['3', '2', '1'], index: ['6', '5', '4'], middle: ['9', '8', '7'],
    ring: ['c', 'b', 'a'], pinky: ['f', 'e', 'd'],
  },
  left: {
    shoulder: '14', arm: '13', fore: '12', hand: 'z',
    thumb: ['m', 'l', 'k'], index: ['p', 'o', 'n'], middle: ['s', 'r', 'q'],
    ring: ['v', 'u', 't'], pinky: ['y', 'x', 'w'],
  },
};

/** Имя кости рига → имя, под которым её пишут жесты (обратная карта avatarBoneMap.ts). */
export const JSON_NAME = {
  j: 'mixamorig:RightShoulder', i: 'mixamorig:RightArm', h: 'mixamorig:RightForeArm', g: 'mixamorig:RightHand',
  3: 'mixamorig:RightHandThumb1', 2: 'mixamorig:RightHandThumb2', 1: 'mixamorig:RightHandThumb3',
  6: 'mixamorig:RightHandIndex1', 5: 'mixamorig:RightHandIndex2', 4: 'mixamorig:RightHandIndex3',
  9: 'mixamorig:RightHandMiddle1', 8: 'mixamorig:RightHandMiddle2', 7: 'mixamorig:RightHandMiddle3',
  c: 'mixamorig:RightHandRing1', b: 'mixamorig:RightHandRing2', a: 'mixamorig:RightHandRing3',
  f: 'mixamorig:RightHandPinky1', e: 'mixamorig:RightHandPinky2', d: 'mixamorig:RightHandPinky3',
  14: 'mixamorig:LeftShoulder', 13: 'mixamorig:LeftArm', 12: 'mixamorig:LeftForeArm', z: 'mixamorig:LeftHand',
  m: 'mixamorig:LeftHandThumb1', l: 'mixamorig:LeftHandThumb2', k: 'mixamorig:LeftHandThumb3',
  p: 'mixamorig:LeftHandIndex1', o: 'mixamorig:LeftHandIndex2', n: 'mixamorig:LeftHandIndex3',
  s: 'mixamorig:LeftHandMiddle1', r: 'mixamorig:LeftHandMiddle2', q: 'mixamorig:LeftHandMiddle3',
  v: 'mixamorig:LeftHandRing1', u: 'mixamorig:LeftHandRing2', t: 'mixamorig:LeftHandRing3',
  y: 'mixamorig:LeftHandPinky1', x: 'mixamorig:LeftHandPinky2', w: 'mixamorig:LeftHandPinky3',
};

const sanitize = (name) => name.replace(/\s/g, '_').replace(/[[\].:/]/g, '');

/** Кости GLB в bind-позе; с `stance` (по умолчанию) — в базе жестов, как в приложении. */
export function loadRig(file = 'public/avatar_elnar.glb', { stance = true } = {}) {
  const buf = fs.readFileSync(path.resolve(ROOT, file));
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
  const objs = json.nodes.map((n) => {
    const o = n.mesh !== undefined ? new THREE.Object3D() : new THREE.Bone();
    o.name = sanitize(n.name || '');
    if (n.matrix) new THREE.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
    else {
      if (n.translation) o.position.fromArray(n.translation);
      if (n.rotation) o.quaternion.fromArray(n.rotation);
      if (n.scale) o.scale.fromArray(n.scale);
    }
    return o;
  });
  const isChild = new Set();
  json.nodes.forEach((n, i) => (n.children || []).forEach((c) => { objs[i].add(objs[c]); isChild.add(c); }));
  const root = new THREE.Object3D();
  objs.forEach((o, i) => { if (!isChild.has(i)) root.add(o); });
  const bones = new Map(objs.filter((o) => o.isBone && o.name).map((o) => [o.name, o]));
  if (stance) {
    bones.get(ARM.right.arm).rotation.x += STANCE_ARM_X;
    bones.get(ARM.left.arm).rotation.x += STANCE_ARM_X;
  }
  root.updateMatrixWorld(true);
  /** База жестов: Эйлеры XYZ каждой кости, как restRotations в GesturePlayer. */
  const rest = new Map([...bones].map(([n, b]) => [n, b.rotation.clone()]));
  return { root, bones, rest, json };
}

/** Вернуть все кости в базу. */
export function resetToRest(rig) {
  for (const [n, b] of rig.bones) b.rotation.copy(rig.rest.get(n));
  rig.root.updateMatrixWorld(true);
}

/**
 * Положить кадр жеста ровно так, как это делает GesturePlayer.update:
 * rotation = rest + дельта, порядок XYZ, кости вне кадра — в базе.
 */
export function applyFrame(rig, bonesDelta) {
  for (const [n, b] of rig.bones) b.rotation.copy(rig.rest.get(n));
  for (const [jsonName, d] of Object.entries(bonesDelta)) {
    const target = Object.entries(JSON_NAME).find(([, v]) => v === jsonName)?.[0] ?? jsonName.replace(/:/g, '');
    const b = rig.bones.get(target);
    if (!b) continue;
    const r = rig.rest.get(target);
    b.rotation.set(r.x + d[0], r.y + d[1], r.z + d[2], 'XYZ');
  }
  rig.root.updateMatrixWorld(true);
}

/** Кадр жеста в момент t с линейной интерполяцией дельт — как в плеере. */
export function sampleGesture(gesture, t) {
  const fr = gesture.frames;
  let i = 0;
  while (i < fr.length - 1 && fr[i + 1].t <= t) i++;
  const a = fr[i], b = fr[Math.min(i + 1, fr.length - 1)];
  const k = Math.min(Math.max((t - a.t) / Math.max(b.t - a.t, 1e-6), 0), 1);
  const out = {};
  for (const n of Object.keys(a.bones)) {
    const ra = a.bones[n], rb = b.bones[n] ?? ra;
    out[n] = [0, 1, 2].map((j) => ra[j] + (rb[j] - ra[j]) * k);
  }
  return out;
}

export const wpos = (b) => b.getWorldPosition(new THREE.Vector3());
export const wquat = (b) => b.getWorldQuaternion(new THREE.Quaternion());
/** Локальная ось кости в мировых координатах. */
export const waxis = (b, x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(wquat(b));

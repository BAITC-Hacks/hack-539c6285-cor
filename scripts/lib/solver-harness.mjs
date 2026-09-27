/**
 * Обвязка для offline-проверок решателя póz.
 *
 * Камеру в браузерной панели не потрогать, поэтому решатель гоняется в node:
 * настоящий скелет разбирается из public/avatar.glb, настоящие кадры берутся
 * из ml/landmarks_holistic (раскладка SLOVO, 255 чисел на кадр).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const FRAMES_DIR = path.join(ROOT, 'ml/landmarks_holistic/test');

/** poseSolver написан на TS и импортирует по алиасу @ — собираем esbuild-ом. */
export async function loadSolver() {
  // Сборка кладётся внутрь проекта: снаружи не разрешится импорт three.
  const cacheDir = path.join(ROOT, 'node_modules/.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const bundle = path.join(cacheDir, 'qyran-posesolver.mjs');
  execFileSync(path.join(ROOT, 'node_modules/.bin/esbuild'), [
    path.join(ROOT, 'src/lib/poseSolver.ts'),
    '--bundle', '--format=esm', '--platform=node', '--external:three',
    `--alias:@=${path.join(ROOT, 'src')}`, `--outfile=${bundle}`,
  ], { stdio: 'pipe' });
  // Метка времени в запросе — иначе node отдаст сборку из кэша модулей.
  return import(`${bundle}?v=${fs.statSync(bundle).mtimeMs}`);
}

/** Кости avatar.glb как настоящая иерархия THREE.Bone в bind-позе. */
export function loadSkeleton() {
  const buf = fs.readFileSync(path.join(ROOT, 'public/avatar.glb'));
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
  const objs = json.nodes.map((n) => {
    const bone = new THREE.Bone();
    bone.name = n.name || '';
    if (n.matrix) {
      new THREE.Matrix4().fromArray(n.matrix).decompose(bone.position, bone.quaternion, bone.scale);
    } else {
      if (n.translation) bone.position.fromArray(n.translation);
      if (n.rotation) bone.quaternion.fromArray(n.rotation);
      if (n.scale) bone.scale.fromArray(n.scale);
    }
    return bone;
  });
  const isChild = new Set();
  json.nodes.forEach((n, i) => (n.children || []).forEach((c) => {
    objs[i].add(objs[c]);
    isChild.add(c);
  }));
  const root = new THREE.Object3D();
  objs.forEach((o, i) => { if (!isChild.has(i)) root.add(o); });
  root.updateMatrixWorld(true);
  const bones = new Map(objs.filter((o) => o.name).map((o) => [o.name, o]));
  return { root, bones, worldPos: (name) => bones.get(name).getWorldPosition(new THREE.Vector3()) };
}

function loadNpy(file) {
  const buf = fs.readFileSync(file);
  const headLen = buf.readUInt16LE(8);
  const header = buf.subarray(10, 10 + headLen).toString('latin1');
  const shape = header.match(/'shape':\s*\(([^)]*)\)/)[1]
    .split(',').map((s) => s.trim()).filter(Boolean).map(Number);
  const descr = header.match(/'descr':\s*'([^']+)'/)[1];
  const count = shape.reduce((a, b) => a * b, 1);
  const start = 10 + headLen;
  const data = descr.includes('f4')
    ? new Float32Array(buf.buffer, buf.byteOffset + start, count)
    : new Float64Array(buf.buffer, buf.byteOffset + start, count);
  return { data, shape };
}

/** Кадры из клипов SLOVO: каждый step-й кадр, пока не наберётся limit. */
export function* frames({ step = 7, limit = 400, mirrored = false } = {}) {
  if (!fs.existsSync(FRAMES_DIR)) {
    throw new Error(`Нет кадров: ${FRAMES_DIR}. Нужны ландмарки SLOVO.`);
  }
  let given = 0;
  for (const name of fs.readdirSync(FRAMES_DIR).filter((n) => n.endsWith('.npy'))) {
    const { data, shape } = loadNpy(path.join(FRAMES_DIR, name));
    if (shape[1] !== 255) continue;
    for (let fi = 0; fi < shape[0]; fi += step) {
      const src = data.subarray(fi * 255, (fi + 1) * 255);
      let frame = src;
      if (mirrored) {
        // Так снимает студия при включённом зеркале: X отражается, кисти нет.
        frame = Float32Array.from(src);
        for (let i = 0; i < 255; i += 3) {
          if (src[i] !== 0 || src[i + 1] !== 0) frame[i] = 1 - src[i];
        }
      }
      yield frame;
      if (++given >= limit) return;
    }
  }
}

// --- геометрия кадра, посчитанная НЕЗАВИСИМО от решателя ---

export const Z_DAMP_POSE = 0.25;
export const Z_DAMP_HAND = 0.9;
export const LEFT_HAND_OFFSET = 129, RIGHT_HAND_OFFSET = 192;
export const handOffset = (side) => (side === 'left' ? LEFT_HAND_OFFSET : RIGHT_HAND_OFFSET);

/** Точка кадра в осях «y вверх, z вперёд». */
export const pt = (f, off, i, damp) =>
  new THREE.Vector3(f[off + i * 3], -f[off + i * 3 + 1], -f[off + i * 3 + 2] * damp);

/** Телесный базис и его масштаб (ширина плеч) — как в buildBodyFrame. */
export function bodyFrame(f, mirrored = false) {
  const lsh = pt(f, 0, 11, Z_DAMP_POSE), rsh = pt(f, 0, 12, Z_DAMP_POSE);
  const lhip = pt(f, 0, 23, Z_DAMP_POSE), rhip = pt(f, 0, 24, Z_DAMP_POSE);
  const origin = lsh.clone().add(rsh).multiplyScalar(0.5);
  const ex = lsh.clone().sub(rsh);
  const scale = ex.length();
  ex.divideScalar(scale);
  const ey = origin.clone().sub(lhip.clone().add(rhip).multiplyScalar(0.5)).normalize();
  const ez = mirrored ? ey.clone().cross(ex).normalize() : ex.clone().cross(ey).normalize();
  ey.copy(mirrored ? ex.clone().cross(ez).normalize() : ez.clone().cross(ex).normalize());
  const basis = new THREE.Matrix3().set(ex.x, ex.y, ex.z, ey.x, ey.y, ey.z, ez.x, ez.y, ez.z);
  return {
    origin, basis, scale,
    /** Точка позы в долях ширины плеч от центра плеч. */
    pose: (i) => pt(f, 0, i, Z_DAMP_POSE).sub(origin).divideScalar(scale).applyMatrix3(basis),
    /** Точка кисти в тех же осях, но в собственном масштабе кисти. */
    hand: (side, i) => pt(f, handOffset(side), i, Z_DAMP_HAND).applyMatrix3(basis),
  };
}

export function handAlive(f, side) {
  const off = handOffset(side);
  for (let i = 0; i < 63; i++) if (f[off + i] !== 0) return true;
  return false;
}

// --- мелочи для отчётов ---
export const deg = (a, b) => Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) * 180 / Math.PI;
export const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? NaN;
export const percentile = (a, p) =>
  a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] ?? NaN;
export const worldAxis = (bone, axis) => {
  bone.updateMatrixWorld(true);
  return axis.clone().applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()));
};
export const SIDES = ['left', 'right'];

/**
 * Технический аудит всех анимаций жестов на Елнаре: какие клипы физически сломаны.
 *
 *   node scripts/audit-gestures.mjs [--out <папка>] [--hz 15] [--only <часть пути>] [--group slovo,old,verified] [--exact] [--top 20]
 *   node scripts/audit-gestures.mjs --selftest     — сначала проверить сам аудит (см. внизу)
 *
 * Правильность знака здесь НЕ проверяется — только физика показа:
 *   1. кисть в лице/голове: кожа к коже до лица < −3 мм (K.faceGap — тот же замер, что в
 *      check-phrases) или точка кисти глубже 3 мм внутри головы (знаковый тест по мешу головы);
 *   2. кисть в корпусе/одежде: точка кисти (сустав или кончик пальца) глубже 1 см внутри
 *      неподвижной одежды — свитер, брюки, обувь (знаковый тест: ближайшая вершина и её
 *      нормаль). Рядом — «запас до корпуса» ровно как в check-phrases (torsoClearance);
 *   3. кисти проходят друг сквозь друга: K.handsGap < −3 мм (как в check-phrases);
 *   4. локоть за спиной: z локтя от середины плеч < −0.25 ширины плеч (как fitArm/fitPole);
 *   5. рывок/телепорт: угловая скорость кости руки (плечо, предплечье, кисть) между
 *      соседними отсчётами > 1500 °/с; пальцы, шея/голова и скорость по ключам — справочно;
 *   6. старт/финиш дальше 10° от покоя на кости руки — мелочь: плеер входит и выходит смешиванием;
 *   7. длительность, число кадров, файлы, которые не читаются или битые по структуре.
 *
 * ПРОИГРЫВАНИЕ — как GesturePlayer.update: имя кости и разворот осей — resolveBone из
 * src/lib/avatarBoneMap.ts (импортируется сам файл), кости берутся только те, что
 * GLTFLoader делает THREE.Bone (суставы скина), кадр = rest + дельта (Эйлер XYZ), дельты
 * интерполируются линейно, кость, которой нет в текущем ключе, стоит в базе.
 * Не моделируются: смешивание на входе/выходе (BLEND_IN/OUT) и дыхание avatarLife (≤ 1°).
 *
 * МЕШИ. У Елнара под одеждой тела нет: Qyran_Body — это стопы, руки (в T-позе), шея и
 * голова, а корпус и ноги — только Qyran_Outfit (свитер, брюки, обувь). Поэтому «корпус» —
 * вершины одежды, на которые не влияют двигающиеся кости (вес ≤ 0.02). Проймы рукавов и
 * ворот при этом — дыры; точка кисти в дыре внутрь не засчитывается (осторожный отказ).
 *
 * Вывод: <out>/audit_technical.json (по файлам) и <out>/audit_technical.md (сводка).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { THREE, ROOT, loadRig, applyFrame, sampleGesture, wpos, ARM, JSON_NAME, STANCE_ARM_X, IDLE_ARM_X } from './lib/rig.mjs';
import { createKit } from './lib/signKit.mjs';
import { readMeshPositions } from './lib/glbMesh.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const HZ = Number(arg('--hz', 15));
const ONLY = arg('--only', null);
const GROUP = arg('--group', null); // slovo | old | verified — только эта группа
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), 'qyran-gesture-audit')));
const EXACT = args.includes('--exact');
const TOP = Number(arg('--top', 20));
const SELFTEST = args.includes('--selftest');

const AVATAR = 'public/avatar_elnar.glb';
const GESTURES = 'public/gestures';
/** Шесть старых файлов, сделанных до проверенной библиотеки (запись с камеры и ручной «Мама»). */
const OLD_HANDMADE = new Set(['igrat', 'koshka', 'magazin', 'mama', 'moloko', 'sobaka']);
const GROUPS = { slovo: 'SLOVO', old: 'старые ручные', verified: 'проверенная библиотека' };

/** Пороги. Все — из задания и из check-phrases / author-phrases. */
const TH = {
  faceGapMm: -3, // кожа к коже до лица (минус — в лице)
  headDepthMm: 3, // точка кисти внутри головы
  torsoDepthCm: 1, // точка кисти внутри одежды
  handsGapMm: -3, // кожа к коже между кистями
  elbowZ: -0.25, // локоть за спиной, ширины плеч от середины плеч
  speedDegS: 1500, // угловая скорость кости
  startEndDeg: 10, // старт/финиш от покоя
};
/** Предотбор дорогих замеров: дальше этих зазоров точное значение не считается. */
const FACE_MARGIN = 0.05;
const HANDS_MARGIN = 0.05;
/** Знаковый тест «внутри меша»: ближайшая вершина дальше SD_MAX — точка снаружи. */
const SD_MAX = 0.15;
const LAT_MIN = 0.015, LAT_K = 0.75;

const deg = (r) => (r * 180) / Math.PI;
const round = (x, n = 1) => (x === null || x === undefined || !Number.isFinite(x) ? x ?? null : Number(x.toFixed(n)));

// ——— сопоставление имён костей: сам avatarBoneMap.ts ———
let resolveBone, resolverSource;
try {
  ({ resolveBone } = await import(pathToFileURL(path.join(ROOT, 'src/lib/avatarBoneMap.ts')).href));
  resolverSource = 'импорт src/lib/avatarBoneMap.ts';
} catch (e) {
  // Node без снятия типов: разбираем текст файла (MAP и AXIS там — простые литералы)
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/avatarBoneMap.ts'), 'utf8');
  const body = (re) => src.match(re)?.[1] ?? '';
  const MAP = Object.fromEntries([...body(/const MAP[^=]*=\s*\{([\s\S]*?)\n\};/).matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
  const AXIS = Object.fromEntries([...body(/const AXIS[^=]*=\s*\{([\s\S]*?)\};/).matchAll(/'([^']+)'\s*:\s*\[([^\]]+)\]/g)].map((m) => [m[1], m[2].split(',').map(Number)]));
  resolveBone = (n) => (MAP[n] ? { target: MAP[n], axisFlip: AXIS[n] ?? [1, 1, 1] } : { target: n.replace(/:/g, ''), axisFlip: AXIS[n] ?? [1, 1, 1] });
  resolverSource = `разбор текста src/lib/avatarBoneMap.ts (импорт не удался: ${e.message.split('\n')[0]})`;
}

// ——— скелет и набор замеров ———
const rig = loadRig(AVATAR);
const K = createKit(rig);
K.setFaceMesh(readMeshPositions(AVATAR, 'Qyran_Body'));
const REST = rig.rest;
const san = (n) => THREE.PropertyBinding.sanitizeNodeName(n || '');
/** Кости плеера: GLTFLoader делает THREE.Bone только из суставов скина. */
const JOINT_NAMES = rig.json.skins[0].joints.map((i) => san(rig.json.nodes[i].name));
const PLAYER_BONES = new Set(rig.json.skins.flatMap((s) => s.joints.map((i) => san(rig.json.nodes[i].name))));
const HEAD = rig.bones.get('mixamorigHead');
const ARM_BONES = { right: ['shoulder', 'arm', 'fore', 'hand'].map((k) => ARM.right[k]), left: ['shoulder', 'arm', 'fore', 'hand'].map((k) => ARM.left[k]) };
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const FINGER_BONES = new Set(['right', 'left'].flatMap((s) => FINGERS.flatMap((f) => ARM[s][f])));
const SPEED_ARM = new Set(['right', 'left'].flatMap((s) => ARM_BONES[s]));
const boneLabel = Object.fromEntries(Object.entries(JSON_NAME).map(([k, v]) => [k, v.replace('mixamorig:', '')]));
const label = (n) => boneLabel[n] ?? n.replace('mixamorig', '');

/** Поза покоя для показа (как idleRotations плеера) и база жестов (restRotations). */
const Q_BASE = new Map([...REST].map(([n, e]) => [n, new THREE.Quaternion().setFromEuler(e)]));
const Q_IDLE = new Map([...REST].map(([n, e]) => {
  const x = e.clone();
  if (n === ARM.right.arm || n === ARM.left.arm) x.x += IDLE_ARM_X - STANCE_ARM_X;
  return [n, new THREE.Quaternion().setFromEuler(x)];
}));

/** Дельты костей в момент t — построчно как GesturePlayer.update. Ключ — кость плеера. */
function playerDeltas(g, t) {
  const frames = g.frames;
  let i = 0;
  while (i < frames.length - 1 && frames[i + 1].t <= t) i++;
  const a = frames[i];
  const b = frames[Math.min(i + 1, frames.length - 1)];
  const span = Math.max(b.t - a.t, 1e-6);
  const alpha = Math.min(Math.max((t - a.t) / span, 0), 1);
  const out = new Map();
  for (const jsonName of Object.keys(a.bones)) {
    const entry = resolveBone(jsonName);
    if (!PLAYER_BONES.has(entry.target)) continue;
    const ra = a.bones[jsonName];
    const rb = b.bones[jsonName] ?? ra;
    const [fx, fy, fz] = entry.axisFlip ?? [1, 1, 1];
    out.set(entry.target, [(ra[0] + (rb[0] - ra[0]) * alpha) * fx, (ra[1] + (rb[1] - ra[1]) * alpha) * fy, (ra[2] + (rb[2] - ra[2]) * alpha) * fz]);
  }
  return out;
}

/** Положить дельты: все кости в базу, затем rest + дельта (XYZ), как resetToRest + update. */
function applyPose(deltas) {
  for (const [n, b] of rig.bones) b.rotation.copy(REST.get(n));
  for (const [n, d] of deltas) {
    const r = REST.get(n);
    rig.bones.get(n).rotation.set(r.x + d[0], r.y + d[1], r.z + d[2], 'XYZ');
  }
  rig.root.updateMatrixWorld(true);
}

// ——— меши: вершины, нормали, веса ———
const GLB = (() => {
  const buf = fs.readFileSync(path.resolve(ROOT, AVATAR));
  const jsonLen = buf.readUInt32LE(12);
  return { buf, json: JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')), bin: 20 + jsonLen + 8 };
})();
function meshAttr(meshName, attr) {
  const { buf, json, bin } = GLB;
  const mesh = json.meshes.find((m) => m.name === meshName);
  if (!mesh) throw new Error(`в ${AVATAR} нет меша ${meshName}`);
  const out = [];
  for (const prim of mesh.primitives) {
    const acc = json.accessors[prim.attributes[attr]];
    const view = json.bufferViews[acc.bufferView];
    const nc = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
    const [cs, read, max] = { 5126: [4, 'readFloatLE', 1], 5123: [2, 'readUInt16LE', 65535], 5121: [1, 'readUInt8', 255] }[acc.componentType];
    const stride = view.byteStride || nc * cs;
    const off = bin + (view.byteOffset || 0) + (acc.byteOffset || 0);
    for (let i = 0; i < acc.count; i++) {
      const row = new Array(nc);
      for (let c = 0; c < nc; c++) {
        const v = buf[read](off + i * stride + c * cs);
        row[c] = acc.normalized && acc.componentType !== 5126 ? v / max : v;
      }
      out.push(row);
    }
  }
  return out;
}

/** k-d дерево по точкам: ближайшая вершина с ограничением радиуса. */
class KDTree {
  constructor(pts) {
    this.n = pts.length;
    this.p = new Float64Array(this.n * 3);
    pts.forEach((q, i) => { this.p[i * 3] = q[0]; this.p[i * 3 + 1] = q[1]; this.p[i * 3 + 2] = q[2]; });
    this.idx = new Int32Array(this.n).map((_, i) => i);
    this.ax = new Int8Array(this.n);
    this.build(0, this.n);
  }
  build(lo, hi) {
    if (hi - lo <= 1) return;
    const P = this.p;
    let axis = 0, spread = -1;
    for (let a = 0; a < 3; a++) {
      let mn = Infinity, mx = -Infinity;
      for (let k = lo; k < hi; k++) { const v = P[this.idx[k] * 3 + a]; if (v < mn) mn = v; if (v > mx) mx = v; }
      if (mx - mn > spread) { spread = mx - mn; axis = a; }
    }
    this.idx.set(Array.from(this.idx.subarray(lo, hi)).sort((u, v) => P[u * 3 + axis] - P[v * 3 + axis]), lo);
    const mid = (lo + hi) >> 1;
    this.ax[mid] = axis;
    this.build(lo, mid);
    this.build(mid + 1, hi);
  }
  nearest(x, y, z, maxD) {
    this.q0 = x; this.q1 = y; this.q2 = z; this.bd = maxD * maxD; this.bi = -1;
    this.search(0, this.n);
    return this.bi;
  }
  search(lo, hi) {
    if (lo >= hi) return;
    const mid = (lo + hi) >> 1, i = this.idx[mid], P = this.p;
    const dx = this.q0 - P[i * 3], dy = this.q1 - P[i * 3 + 1], dz = this.q2 - P[i * 3 + 2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < this.bd) { this.bd = d2; this.bi = i; }
    if (hi - lo === 1) return;
    const a = this.ax[mid];
    const diff = (a === 0 ? this.q0 : a === 1 ? this.q1 : this.q2) - P[i * 3 + a];
    if (diff < 0) { this.search(lo, mid); if (diff * diff < this.bd) this.search(mid + 1, hi); }
    else { this.search(mid + 1, hi); if (diff * diff < this.bd) this.search(lo, mid); }
  }
}

/** Поверхность для знакового теста: вершины меша, прошедшие отбор, их нормали и k-d дерево. */
function surfaceSet(meshName, keep, moving) {
  const P = meshAttr(meshName, 'POSITION'), N = meshAttr(meshName, 'NORMAL');
  const J = meshAttr(meshName, 'JOINTS_0'), W = meshAttr(meshName, 'WEIGHTS_0');
  const pts = [], nrm = [];
  let armWeighted = 0;
  for (let i = 0; i < P.length; i++) {
    let wMoving = 0;
    for (let c = 0; c < 4; c++) if (W[i][c] > 0 && moving.has(JOINT_NAMES[J[i][c]])) wMoving += W[i][c];
    if (!keep(P[i], wMoving, J[i], W[i])) continue;
    let wArm = 0;
    for (let c = 0; c < 4; c++) if (W[i][c] > 0 && (SPEED_ARM.has(JOINT_NAMES[J[i][c]]) || FINGER_BONES.has(JOINT_NAMES[J[i][c]]))) wArm += W[i][c];
    if (wArm > 0) armWeighted++;
    const l = Math.hypot(N[i][0], N[i][1], N[i][2]) || 1;
    pts.push(P[i]);
    nrm.push([N[i][0] / l, N[i][1] / l, N[i][2] / l]);
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let a = 0; a < 3; a++) { if (p[a] < min[a]) min[a] = p[a]; if (p[a] > max[a]) max[a] = p[a]; }
  return { pts, nrm, kd: new KDTree(pts), min, max, armWeighted };
}

/**
 * Глубина точки внутри поверхности (м, 0 — снаружи или неясно): ближайшая вершина и её
 * нормаль. Точка засчитывается внутри, только если лежит примерно по нормали от вершины
 * (боковой снос ≤ max(1.5 см, 0.75 глубины)) — у краёв дыр (проймы, ворот, подол) знак
 * по ближайшей вершине ненадёжен, и такая точка внутрь не засчитывается.
 */
function insideDepth(set, x, y, z) {
  if (x < set.min[0] || y < set.min[1] || z < set.min[2] || x > set.max[0] || y > set.max[1] || z > set.max[2]) return 0;
  const i = set.kd.nearest(x, y, z, SD_MAX);
  if (i < 0) return 0;
  const v = set.pts[i], n = set.nrm[i];
  const dx = x - v[0], dy = y - v[1], dz = z - v[2];
  const s = dx * n[0] + dy * n[1] + dz * n[2];
  if (s >= 0) return 0;
  const lat = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - s * s));
  return lat <= Math.max(LAT_MIN, LAT_K * -s) ? -s : 0;
}

// ——— «запас до корпуса» ровно как torsoClearance в check-phrases, с сеткой для скорости ———
const TORSO_CP = [...readMeshPositions(AVATAR, 'Qyran_Body'), ...readMeshPositions(AVATAR, 'Qyran_Outfit')]
  .filter((p) => Math.abs(p[0]) < 0.16 && p[1] > 0.9 && p[1] < 1.47);
const CELL = 0.025;
const cellKey = (ix, iy) => (ix + 10000) * 100000 + (iy + 10000);
const TORSO_GRID = new Map();
for (const v of TORSO_CP) {
  const k = cellKey(Math.floor(v[0] / CELL), Math.floor(v[1] / CELL));
  if (!TORSO_GRID.has(k)) TORSO_GRID.set(k, []);
  TORSO_GRID.get(k).push(v);
}
function torsoClearance(p) {
  let front = -Infinity;
  const ix = Math.floor(p.x / CELL), iy = Math.floor(p.y / CELL);
  for (let a = ix - 1; a <= ix + 1; a++) for (let b = iy - 1; b <= iy + 1; b++) {
    const cell = TORSO_GRID.get(cellKey(a, b));
    if (!cell) continue;
    for (const v of cell) if (Math.abs(v[0] - p.x) < 0.025 && Math.abs(v[1] - p.y) < 0.025 && v[2] > front) front = v[2];
  }
  return front === -Infinity ? Infinity : p.z - front;
}
function torsoClearanceBrute(p) {
  let front = -Infinity;
  for (const v of TORSO_CP) if (Math.abs(v[0] - p.x) < 0.025 && Math.abs(v[1] - p.y) < 0.025 && v[2] > front) front = v[2];
  return front === -Infinity ? Infinity : p.z - front;
}
const CP_KEYS = ['wrist', 'palmCenter', 'index', 'middle', 'ring', 'pinky', 'thumb'];

// ——— точки кисти ———
/** 23 точки кисти (запястье, центр и основание ладони, суставы и кончики пальцев) и описанная сфера. */
function handSample(side) {
  const hp = K.handPoints(side);
  const B = ARM[side];
  const pts = [['wrist', hp.wrist], ['palmCenter', hp.palmCenter], ['heel', hp.heel]];
  for (const f of FINGERS) {
    B[f].forEach((n, i) => pts.push([`${f}${i + 1}`, wpos(rig.bones.get(n))]));
    pts.push([`${f}Tip`, hp[f]]);
  }
  const c = new THREE.Vector3();
  for (const [, p] of pts) c.add(p);
  c.multiplyScalar(1 / pts.length);
  let r = 0;
  for (const [, p] of pts) r = Math.max(r, p.distanceTo(c));
  return { hp, pts, c, r };
}
function distToBox(c, box) {
  const dx = Math.max(box.min.x - c.x, 0, c.x - box.max.x);
  const dy = Math.max(box.min.y - c.y, 0, c.y - box.max.y);
  const dz = Math.max(box.min.z - c.z, 0, c.z - box.max.z);
  return Math.hypot(dx, dy, dz);
}

// ——— файлы ———
function listFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else if (e.name.endsWith('.json')) out.push(path.relative(path.join(ROOT, GESTURES), path.join(ROOT, rel)));
    }
  };
  walk(GESTURES);
  return out;
}
const groupOf = (rel) => (rel.startsWith('slovo/') ? 'slovo' : !rel.includes('/') && OLD_HANDMADE.has(rel.replace(/\.json$/, '')) ? 'old' : 'verified');

/** Структура файла: всё, что плеер прочтёт не так, как задумано. */
function validate(g) {
  const issues = [];
  if (!g || typeof g !== 'object' || Array.isArray(g)) return { fatal: 'не объект жеста', issues };
  if (!Array.isArray(g.frames)) return { fatal: 'нет массива frames', issues };
  if (!g.frames.length) return { fatal: 'frames пуст', issues };
  for (const [i, f] of g.frames.entries()) {
    if (!f || typeof f.t !== 'number' || !Number.isFinite(f.t)) return { fatal: `кадр ${i}: t не число`, issues };
    if (!f.bones || typeof f.bones !== 'object') return { fatal: `кадр ${i}: нет bones`, issues };
  }
  let bad = 0, nonMono = 0, dup = 0;
  for (const [i, f] of g.frames.entries()) {
    for (const v of Object.values(f.bones)) if (!Array.isArray(v) || v.length !== 3 || !v.every((x) => typeof x === 'number' && Number.isFinite(x))) bad++;
    if (i && f.t < g.frames[i - 1].t) nonMono++;
    if (i && f.t === g.frames[i - 1].t) dup++;
  }
  if (bad) return { fatal: `${bad} значений костей не [x, y, z] из чисел`, issues };
  if (nonMono) issues.push(`время идёт назад в ${nonMono} кадрах`);
  if (dup) issues.push(`${dup} кадров с тем же t (скачок без времени)`);
  if (g.frames[0].t !== 0) issues.push(`первый кадр при t=${g.frames[0].t}, не 0`);
  if (g.rotation_order && g.rotation_order !== 'XYZ') issues.push(`rotation_order ${g.rotation_order} (плеер всё равно кладёт XYZ)`);
  if (g.unit && g.unit !== 'radians') issues.push(`unit ${g.unit} (плеер считает радианы)`);
  // кость есть не во всех кадрах: в кадрах без неё плеер ставит её в базу — возможен скачок
  const all = new Set(g.frames.flatMap((f) => Object.keys(f.bones)));
  const gaps = {};
  for (const n of all) { const miss = g.frames.filter((f) => !(n in f.bones)).length; if (miss) gaps[n] = miss; }
  if (Object.keys(gaps).length) issues.push(`${Object.keys(gaps).length} костей есть не во всех кадрах (до ${Math.max(...Object.values(gaps))} кадров без них)`);
  return { fatal: null, issues, gaps };
}

// ——— скорость костей ———
const quatOf = (target, d) => {
  const r = REST.get(target);
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(r.x + d[0], r.y + d[1], r.z + d[2], 'XYZ'));
};
const qAngle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)));
const speedClass = (n) => (SPEED_ARM.has(n) ? 'arm' : FINGER_BONES.has(n) ? 'finger' : 'other');
/**
 * Туда-обратно: итог поворота кости за два шага, делённый на путь (Q[отсчёт][кость]).
 * 1 — поворот в одну сторону, около 0 — кость ушла и вернулась (дрожь, перескок оси).
 */
function reversal(Q, k, i0, i1, i2) {
  if (i0 < 0 || i2 >= Q.length) return 1;
  const path = qAngle(Q[i0][k], Q[i1][k]) + qAngle(Q[i1][k], Q[i2][k]);
  return path > 1e-9 ? qAngle(Q[i0][k], Q[i2][k]) / path : 1;
}

/**
 * Скорость по ключам: поза плеера в моменты ключей, угол до первого ключа не ближе окна
 * (1/hz), делённый на время между ними. У SLOVO ключи идут через ~1/15 с, и это просто
 * скорость между соседними ключами — выброс одного ключа, который сетка отсчётов может
 * перешагнуть, здесь виден. У частых ключей (4–33 мм с у проверенных) окно не даёт
 * мерить мгновенный пик на отрезке в 4 мс: число сравнимо с порогом для отсчётов.
 *
 * Отдельно — «скачки»: кость, которой нет в следующем ключе, плеер держит до его момента
 * и затем ставит в базу; кость, которой не было, прыгает из базы в значение.
 */
function keyframeSpeeds(g, hz = HZ) {
  const fr = g.frames;
  const best = { arm: { v: 0 }, finger: { v: 0 }, other: { v: 0 }, snap: { deg: 0 } };
  const all = new Set();
  for (const f of fr) for (const n of Object.keys(f.bones)) { const e = resolveBone(n); if (PLAYER_BONES.has(e.target)) all.add(e.target); }
  const bones = [...all];
  const Q = fr.map((f) => { const d = playerDeltas(g, f.t); return bones.map((n) => (d.has(n) ? quatOf(n, d.get(n)) : Q_BASE.get(n))); });
  const W = 1 / hz - 1e-9;
  for (let i = 0; i < fr.length - 1; i++) {
    let j = i + 1;
    while (j < fr.length - 1 && fr[j].t - fr[i].t < W) j++;
    const dt = fr[j].t - fr[i].t;
    if (!(dt > 0)) continue;
    bones.forEach((n, k) => {
      const v = deg(qAngle(Q[i][k], Q[j][k])) / dt;
      const c = speedClass(n);
      if (v > best[c].v) best[c] = { v, bone: n, t: fr[i].t, dt, rev: Math.min(reversal(Q, k, i - 1, i, j), reversal(Q, k, i, j, j + 1)) };
    });
  }
  const targetsOf = (f) => {
    const m = new Map();
    for (const [jsonName, d] of Object.entries(f.bones)) {
      const e = resolveBone(jsonName);
      if (!PLAYER_BONES.has(e.target)) continue;
      const [fx, fy, fz] = e.axisFlip ?? [1, 1, 1];
      m.set(e.target, { jsonName, d: [d[0] * fx, d[1] * fy, d[2] * fz] });
    }
    return m;
  };
  let cur = targetsOf(fr[0]);
  for (let i = 0; i < fr.length - 1; i++) {
    const next = targetsOf(fr[i + 1]);
    const dt = fr[i + 1].t - fr[i].t;
    for (const [target, { d }] of cur) {
      // кости нет в следующем ключе: плеер держит значение a до конца отрезка,
      // а в момент следующего ключа ставит её в базу
      if (!next.has(target)) {
        const a = deg(qAngle(quatOf(target, d), Q_BASE.get(target)));
        if (a > best.snap.deg) best.snap = { deg: a, bone: target, t: fr[i + 1].t, kind: 'в базу' };
      }
    }
    for (const [target, { d }] of next) {
      if (cur.has(target)) continue;
      const a = deg(qAngle(Q_BASE.get(target), quatOf(target, d)));
      if (a > best.snap.deg) best.snap = { deg: a, bone: target, t: fr[i + 1].t, kind: 'из базы' };
    }
    // кадры с одинаковым t: плеер перескакивает значение мгновенно
    if (dt <= 0) for (const [target, { d }] of cur) {
      const nx = next.get(target);
      if (!nx) continue;
      const a = deg(qAngle(quatOf(target, d), quatOf(target, nx.d)));
      if (a > best.snap.deg) best.snap = { deg: a, bone: target, t: fr[i + 1].t, kind: 'кадры с одним t' };
    }
    cur = next;
  }
  return best;
}

// ——— отсчёты ———
function sampleTimes(dur, hz) {
  const ts = [];
  for (let k = 0; k / hz <= dur + 1e-9; k++) ts.push(k / hz);
  if (ts[ts.length - 1] < dur - 1e-9) ts.push(dur);
  return ts;
}

let TRUNK = null, HEADSET = null, MOVING = null;
const HEAD_REST = new THREE.Matrix4();
let FACE_BOX_REST = null;
const HEAD_BACK = new THREE.Matrix4();
const tmpV = new THREE.Vector3();

function setupSurfaces(movingTargets) {
  // двигающиеся кости: все, что анимирует хоть один файл, со всеми потомками
  MOVING = new Set();
  for (const n of movingTargets) rig.bones.get(n)?.traverse((o) => MOVING.add(o.name));
  applyPose(new Map());
  TRUNK = surfaceSet('Qyran_Outfit', (p, w) => w <= 0.02, MOVING);
  // голова: вершины тела выше 1.45 м у середины — жёстко с костью головы (как лицо в signKit);
  // низ шеи, на который влияют кости рук (до 19 % от плеча), не берётся
  const armOnly = new Set([...MOVING].filter((n) => n !== 'mixamorigNeck' && n !== 'mixamorigHead'));
  HEADSET = surfaceSet('Qyran_Body', (p, w) => p[1] > 1.45 && Math.abs(p[0]) < 0.15 && w <= 0.02, armOnly);
  HEAD_REST.copy(HEAD.matrixWorld);
  FACE_BOX_REST = new THREE.Box3().setFromPoints(K.facePoints());
}

/** Один файл: все замеры по отсчётам. */
function auditGesture(g, { hz = HZ, exact = EXACT } = {}) {
  const fr = g.frames;
  const dur = fr[fr.length - 1].t;
  const times = sampleTimes(dur, hz);
  const targets = new Set();
  const unresolved = new Set();
  for (const f of fr) for (const n of Object.keys(f.bones)) {
    const e = resolveBone(n);
    if (PLAYER_BONES.has(e.target)) targets.add(e.target); else unresolved.add(n);
  }
  const R = {
    face: { gap: Infinity, t: null, side: null, exactSamples: 0 },
    head: { depth: 0, t: null, side: null, point: null },
    torso: { depth: 0, t: null, side: null, point: null },
    torsoPalm: 0, // глубже всего центр/основание ладони или запястье — кисть целиком в теле
    torsoSamples: 0, // отсчётов, где точка кисти глубже порога
    front: { right: { c: Infinity, t: null, key: null }, left: { c: Infinity, t: null, key: null } },
    hands: { gap: Infinity, t: null, exactSamples: 0 },
    elbow: { right: { z: Infinity, t: null }, left: { z: Infinity, t: null } },
    speed: { arm: { v: 0 }, finger: { v: 0 }, other: { v: 0 } },
    start: null, end: null,
  };
  const speedBones = [...targets];
  const Qs = [];
  for (const [si, t] of times.entries()) {
    applyPose(playerDeltas(g, t));
    const H = { right: handSample('right'), left: handSample('left') };

    // голова двинулась? тогда лицо и голова — в новом месте
    const headMoved = !HEAD.matrixWorld.equals(HEAD_REST);
    const faceBox = headMoved ? new THREE.Box3().setFromPoints(K.facePoints()) : FACE_BOX_REST;
    if (headMoved) HEAD_BACK.copy(HEAD_REST).multiply(HEAD.matrixWorld.clone().invert());

    let torsoHit = false;
    for (const side of ['right', 'left']) {
      const h = H[side];
      // 1a. кожа к коже до лица — K.faceGap, как check-phrases
      if (exact || distToBox(h.c, faceBox) - h.r - 0.012 <= FACE_MARGIN) {
        const gap = K.faceGap(side);
        R.face.exactSamples++;
        if (gap < R.face.gap) R.face = { ...R.face, gap, t, side };
      }
      // 1b/2. точки кисти внутри головы и внутри одежды
      for (const [name, p] of h.pts) {
        const q = headMoved ? tmpV.copy(p).applyMatrix4(HEAD_BACK) : p;
        const dh = insideDepth(HEADSET, q.x, q.y, q.z);
        if (dh > R.head.depth) R.head = { depth: dh, t, side, point: name };
        const dt = insideDepth(TRUNK, p.x, p.y, p.z);
        if (dt > R.torso.depth) R.torso = { depth: dt, t, side, point: name };
        if (dt * 100 > TH.torsoDepthCm) torsoHit = true;
        if ((name === 'wrist' || name === 'palmCenter' || name === 'heel') && dt > R.torsoPalm) R.torsoPalm = dt;
      }
      // запас до корпуса, как в check-phrases
      for (const key of CP_KEYS) {
        const c = torsoClearance(h.hp[key]);
        if (c < R.front[side].c) R.front[side] = { c, t, key };
      }
      // 4. локоть
      const z = K.toRef(wpos(rig.bones.get(ARM[side].fore))).z;
      if (z < R.elbow[side].z) R.elbow[side] = { z, t };
    }
    // 3. кисти друг в друге
    if (exact || H.right.c.distanceTo(H.left.c) - H.right.r - H.left.r - 0.024 <= HANDS_MARGIN) {
      const gap = K.handsGap();
      R.hands.exactSamples++;
      if (gap < R.hands.gap) R.hands = { ...R.hands, gap, t };
    }
    if (torsoHit) R.torsoSamples++;
    // 5. повороты костей — скорость считается после прохода
    Qs.push(speedBones.map((n) => rig.bones.get(n).quaternion.clone()));
    // 6. старт и финиш против покоя (показ) и базы жестов
    if (si === 0 || si === times.length - 1) {
      let idle = { deg: 0 }, base = { deg: 0 };
      for (const n of [...ARM_BONES.right, ...ARM_BONES.left]) {
        const q = rig.bones.get(n).quaternion;
        const ai = deg(qAngle(q, Q_IDLE.get(n))), ab = deg(qAngle(q, Q_BASE.get(n)));
        if (ai > idle.deg) idle = { deg: ai, bone: n };
        if (ab > base.deg) base = { deg: ab, bone: n };
      }
      // кость называем, только если отклонение заметно (иначе это шум округления)
      const rec = { idleDeg: idle.deg, idleBone: idle.deg > 0.05 ? idle.bone : null, baseDeg: base.deg, baseBone: base.deg > 0.05 ? base.bone : null, dev: Math.min(idle.deg, base.deg) };
      if (si === 0) R.start = rec;
      if (si === times.length - 1) R.end = rec;
    }
  }
  // 5. скорость костей между соседними отсчётами и «туда-обратно» вокруг самого быстрого шага
  for (let s = 1; s < Qs.length; s++) {
    const dt = times[s] - times[s - 1];
    if (!(dt > 0)) continue;
    speedBones.forEach((n, k) => {
      const v = deg(qAngle(Qs[s - 1][k], Qs[s][k])) / dt;
      const c = speedClass(n);
      if (v > R.speed[c].v) R.speed[c] = { v, bone: n, t: times[s - 1], dt, rev: Math.min(reversal(Qs, k, s - 2, s - 1, s), reversal(Qs, k, s - 1, s, s + 1)) };
    });
  }
  return { R, times: times.length, targets, unresolved: [...unresolved], exact, key: keyframeSpeeds(g) };
}

/** Итог по файлу: числа в понятных единицах и флаги. */
function summarize(rel, g, st, a, v) {
  const { R, key } = a;
  const fr = g.frames;
  const dur = fr[fr.length - 1].t;
  const dts = fr.slice(1).map((f, i) => f.t - fr[i].t);
  // с предотбором точное значение известно, только пока оно не больше запаса предотбора:
  // пропущенные отсчёты дальше запаса, но могут быть ближе, чем найденный минимум сверх него
  const faceGapMm = R.face.gap === Infinity || (!a.exact && R.face.gap > FACE_MARGIN) ? null : R.face.gap * 1000;
  const handsGapMm = R.hands.gap === Infinity || (!a.exact && R.hands.gap > HANDS_MARGIN) ? null : R.hands.gap * 1000;
  const out = {
    file: rel,
    group: groupOf(rel),
    name: g.name ?? null,
    description: typeof g.description === 'string' ? g.description.slice(0, 120) : null,
    mtime: st.mtime.toISOString(),
    size: st.size,
    frames: fr.length,
    duration: round(dur, 3),
    keyDt: dts.length ? { min: round(Math.min(...dts), 4), max: round(Math.max(...dts), 4) } : { min: null, max: null },
    samples: a.times,
    issues: v.issues,
    boneGaps: v.gaps && Object.keys(v.gaps).length ? v.gaps : undefined,
    unresolvedBones: a.unresolved,
    face: {
      minGapMm: round(faceGapMm, 1), // null — ни в одном отсчёте не ближе FACE_MARGIN
      t: faceGapMm === null ? null : round(R.face.t, 3), side: faceGapMm === null ? null : R.face.side,
      headInsideMm: round(R.head.depth * 1000, 1), headT: R.head.depth ? round(R.head.t, 3) : null, headSide: R.head.side, headPoint: R.head.point,
    },
    torso: {
      insideCm: round(R.torso.depth * 100, 2), t: R.torso.depth ? round(R.torso.t, 3) : null, side: R.torso.side, point: R.torso.point,
      palmInsideCm: round(R.torsoPalm * 100, 2), // запястье/ладонь: вся кисть в теле, а не только палец
      samplesInside: R.torsoSamples, samplesInsideShare: round(R.torsoSamples / a.times, 2),
      frontRightCm: R.front.right.c === Infinity ? null : round(R.front.right.c * 100, 2), frontRightT: round(R.front.right.t, 3), frontRightKey: R.front.right.key,
      frontLeftCm: R.front.left.c === Infinity ? null : round(R.front.left.c * 100, 2), frontLeftT: round(R.front.left.t, 3), frontLeftKey: R.front.left.key,
    },
    hands: { minGapMm: round(handsGapMm, 1), t: handsGapMm === null ? null : round(R.hands.t, 3) },
    elbow: {
      rightMinZ: round(R.elbow.right.z, 3), rightT: round(R.elbow.right.t, 3),
      leftMinZ: round(R.elbow.left.z, 3), leftT: round(R.elbow.left.t, 3),
    },
    speed: {
      // rev — итог поворота за два шага вокруг самого быстрого, делённый на путь: < 0.5 — туда-обратно
      armDegS: round(R.speed.arm.v, 0), armBone: R.speed.arm.bone ? label(R.speed.arm.bone) : null, armT: round(R.speed.arm.t, 3), armRev: round(R.speed.arm.rev, 2),
      fingerDegS: round(R.speed.finger.v, 0), fingerBone: R.speed.finger.bone ? label(R.speed.finger.bone) : null, fingerT: round(R.speed.finger.t, 3), fingerRev: round(R.speed.finger.rev, 2),
      otherDegS: round(R.speed.other.v, 0), otherBone: R.speed.other.bone ? label(R.speed.other.bone) : null,
      keyArmDegS: round(key.arm.v, 0), keyArmBone: key.arm.bone ? label(key.arm.bone) : null, keyArmT: round(key.arm.t, 3), keyArmRev: round(key.arm.rev, 2),
      keyFingerDegS: round(key.finger.v, 0), keyFingerBone: key.finger.bone ? label(key.finger.bone) : null,
      snapDeg: round(key.snap.deg, 1), snapBone: key.snap.bone ? label(key.snap.bone) : null, snapT: round(key.snap.t, 3), snapKind: key.snap.kind ?? null,
    },
    startEnd: {
      startDeg: round(R.start.dev, 1), startIdleDeg: round(R.start.idleDeg, 1), startBaseDeg: round(R.start.baseDeg, 1), startBone: label(R.start.idleDeg <= R.start.baseDeg ? R.start.idleBone ?? '' : R.start.baseBone ?? ''),
      endDeg: round(R.end.dev, 1), endIdleDeg: round(R.end.idleDeg, 1), endBaseDeg: round(R.end.baseDeg, 1), endBone: label(R.end.idleDeg <= R.end.baseDeg ? R.end.idleBone ?? '' : R.end.baseBone ?? ''),
    },
  };
  const flags = [];
  if ((faceGapMm !== null && faceGapMm < TH.faceGapMm) || R.head.depth * 1000 > TH.headDepthMm) flags.push('face');
  if (R.torso.depth * 100 > TH.torsoDepthCm) flags.push('torso');
  if (handsGapMm !== null && handsGapMm < TH.handsGapMm) flags.push('hands');
  if (Math.min(R.elbow.right.z, R.elbow.left.z) < TH.elbowZ) flags.push('elbow');
  if (R.speed.arm.v > TH.speedDegS) flags.push('speed');
  if (R.speed.finger.v > TH.speedDegS) flags.push('speedFinger');
  if (key.arm.v > TH.speedDegS || key.snap.deg > 5) flags.push('speedKey');
  if (Math.max(R.start.dev, R.end.dev) > TH.startEndDeg) flags.push('startEnd');
  if (a.unresolved.length) flags.push('unresolvable');
  if (v.issues.length) flags.push('structure');
  out.flags = flags;
  return out;
}

// ——— категории сводки ———
const CATS = [
  { id: 'face', title: '1. Кисть в лице/голове', rule: `кожа к коже до лица < ${TH.faceGapMm} мм или точка кисти > ${TH.headDepthMm} мм внутри головы`,
    sev: (r) => Math.max(r.face.minGapMm === null ? -Infinity : -r.face.minGapMm, r.face.headInsideMm ?? 0),
    cols: ['кожа к коже, мм', 'когда, с', 'кисть', 'внутри головы, мм', 'точка'],
    row: (r) => [fmt(r.face.minGapMm), fmt(r.face.t, 2), side(r.face.side), fmt(r.face.headInsideMm), r.face.headInsideMm ? `${side(r.face.headSide)} ${r.face.headPoint} @${fmt(r.face.headT, 2)}` : '—'] },
  { id: 'torso', title: '2. Кисть в корпусе/одежде', rule: `точка кисти > ${TH.torsoDepthCm} см внутри одежды (свитер/брюки)`,
    sev: (r) => r.torso.insideCm ?? 0,
    cols: ['глубина, см', 'когда, с', 'кисть', 'точка', 'запястье/ладонь, см', 'доля клипа', 'запас как в check-phrases: прав./лев., см'],
    row: (r) => [fmt(r.torso.insideCm, 1), fmt(r.torso.t, 2), side(r.torso.side), r.torso.point ?? '—', fmt(r.torso.palmInsideCm, 1), `${Math.round(100 * r.torso.samplesInsideShare)} %`, `${fmt(r.torso.frontRightCm, 1)} / ${fmt(r.torso.frontLeftCm, 1)}`] },
  { id: 'hands', title: '3. Кисти проходят друг сквозь друга', rule: `кожа к коже между кистями < ${TH.handsGapMm} мм`,
    sev: (r) => (r.hands.minGapMm === null ? -Infinity : -r.hands.minGapMm),
    cols: ['кожа к коже, мм', 'когда, с'], row: (r) => [fmt(r.hands.minGapMm), fmt(r.hands.t, 2)] },
  { id: 'elbow', title: '4. Локоть за спиной', rule: `z локтя < ${TH.elbowZ} ширины плеч от середины плеч`,
    sev: (r) => -Math.min(r.elbow.rightMinZ, r.elbow.leftMinZ),
    cols: ['z локтя, ш. плеч', 'рука', 'когда, с'],
    row: (r) => { const R = r.elbow.rightMinZ <= r.elbow.leftMinZ; return [fmt(R ? r.elbow.rightMinZ : r.elbow.leftMinZ, 2), R ? 'правая' : 'левая', fmt(R ? r.elbow.rightT : r.elbow.leftT, 2)]; } },
  { id: 'speed', title: '5. Рывок/телепорт: кости руки', rule: `> ${TH.speedDegS} °/с между отсчётами ${HZ} Гц (плечо, предплечье, кисть)`,
    sev: (r) => r.speed.armDegS,
    cols: ['°/с', 'кость', 'с момента, с', 'туда-обратно (итог/путь)', 'по ключам °/с', 'пальцы °/с'],
    row: (r) => [fmt(r.speed.armDegS, 0), r.speed.armBone ?? '—', fmt(r.speed.armT, 2), rev(r.speed.armRev), fmt(r.speed.keyArmDegS, 0), fmt(r.speed.fingerDegS, 0)] },
  { id: 'speedFinger', title: '5б. Рывок пальцев (справочно)', rule: `палец > ${TH.speedDegS} °/с между отсчётами ${HZ} Гц`,
    sev: (r) => r.speed.fingerDegS, cols: ['°/с', 'кость', 'с момента, с', 'туда-обратно (итог/путь)', 'по ключам °/с'],
    row: (r) => [fmt(r.speed.fingerDegS, 0), r.speed.fingerBone ?? '—', fmt(r.speed.fingerT, 2), rev(r.speed.fingerRev), fmt(r.speed.keyFingerDegS, 0)] },
  { id: 'speedKey', title: '5в. По ключам (справочно)', rule: `кость руки > ${TH.speedDegS} °/с между соседними ключами или скачок кости > 5° (кость пропадает из ключа и падает в базу)`,
    // скачок — разрыв (бесконечная скорость), поэтому скачки выше любых скоростей
    sev: (r) => ((r.speed.snapDeg ?? 0) > 5 ? 1e6 + r.speed.snapDeg : r.speed.keyArmDegS),
    cols: ['рука по ключам °/с', 'кость', 'с момента, с', 'туда-обратно', 'скачок °', 'кость', 'когда, с', 'как'],
    row: (r) => [fmt(r.speed.keyArmDegS, 0), r.speed.keyArmBone ?? '—', fmt(r.speed.keyArmT, 2), rev(r.speed.keyArmRev), fmt(r.speed.snapDeg), r.speed.snapBone ?? '—', fmt(r.speed.snapT, 2), r.speed.snapKind ?? '—'] },
  { id: 'startEnd', title: '6. Старт/финиш вне покоя (мелочь)', rule: `> ${TH.startEndDeg}° на кости руки и от позы покоя, и от базы жестов`,
    sev: (r) => Math.max(r.startEnd.startDeg, r.startEnd.endDeg),
    cols: ['старт °', 'кость', 'финиш °', 'кость'],
    row: (r) => [fmt(r.startEnd.startDeg), r.startEnd.startBone || '—', fmt(r.startEnd.endDeg), r.startEnd.endBone || '—'] },
];
function fmt(x, n = 1) { return x === null || x === undefined ? '—' : typeof x === 'number' ? x.toFixed(n) : String(x); }
function rev(x) { return x === null || x === undefined ? '—' : `${x < 0.5 ? 'да' : 'нет'} (${x.toFixed(2)})`; }
function side(s) { return s === 'right' ? 'правая' : s === 'left' ? 'левая' : '—'; }

function markdown(results, meta) {
  const L = [];
  const groups = Object.keys(GROUPS);
  const inG = (g) => results.filter((r) => r.group === g);
  const ok = results.filter((r) => !r.error);
  L.push('# Технический аудит анимаций жестов на Елнаре');
  L.push('');
  L.push(`${meta.date}; аватар \`${AVATAR}\`; отсчёты ${meta.hz} Гц + последний кадр; прогон ${meta.seconds.toFixed(0)} с${meta.exact ? '; без предотбора' : ''}.`);
  L.push(`Проигрывание как у GesturePlayer (${meta.resolver}; развороты осей: ${meta.axisFlips}). Проверяется только физика показа, не правильность знака.`);
  L.push('');
  L.push(`Файлов: ${results.length} — ${groups.map((g) => `${GROUPS[g]} ${inG(g).length}`).join(', ')}. Пропущены списки: ${meta.skipped.join(', ') || 'нет'}.`);
  L.push('');
  L.push('## Сколько файлов с проблемой');
  L.push('');
  L.push(`| Проверка | Порог | ${groups.map((g) => `${GROUPS[g]} (${inG(g).length})`).join(' | ')} |`);
  L.push(`|---|---|${groups.map(() => '---:').join('|')}|`);
  const cnt = (g, pred) => { const rs = inG(g).filter((r) => !r.error); const n = rs.filter(pred).length; return rs.length ? `${n} (${Math.round((100 * n) / rs.length)} %)` : '—'; };
  const SUB = {
    torso: ['↳ из них запястье или ладонь тоже глубже 1 см', (r) => r.torso.palmInsideCm > TH.torsoDepthCm],
    speed: ['↳ из них туда-обратно (итог/путь < 0.5)', (r) => r.speed.armRev < 0.5],
    speedKey: ['↳ из них туда-обратно по ключам (итог/путь < 0.5)', (r) => r.speed.keyArmDegS > TH.speedDegS && r.speed.keyArmRev < 0.5],
  };
  for (const c of CATS) {
    L.push(`| ${c.title} | ${c.rule} | ${groups.map((g) => cnt(g, (r) => r.flags.includes(c.id))).join(' | ')} |`);
    if (SUB[c.id]) L.push(`| ${SUB[c.id][0]} | | ${groups.map((g) => cnt(g, (r) => r.flags.includes(c.id) && SUB[c.id][1](r))).join(' | ')} |`);
  }
  L.push(`| Хотя бы одна из 1–5 | | ${groups.map((g) => cnt(g, (r) => r.flags.some((f) => ['face', 'torso', 'hands', 'elbow', 'speed'].includes(f)))).join(' | ')} |`);
  L.push(`| 7. Не читается / битая структура | JSON не разбирается или кадры не того вида | ${groups.map((g) => `${inG(g).filter((r) => r.error).length}`).join(' | ')} |`);
  L.push(`| 7б. Замечания к структуре | кость есть не во всех кадрах, время назад и т. п. | ${groups.map((g) => cnt(g, (r) => r.flags.includes('structure'))).join(' | ')} |`);
  L.push(`| Неизвестные плееру кости | resolveBone не находит кость | ${groups.map((g) => cnt(g, (r) => r.flags.includes('unresolvable'))).join(' | ')} |`);
  L.push('');
  // какая рука виновата (по худшему моменту файла)
  const bySide = (id, sideOf) => { const f = ok.filter((r) => r.flags.includes(id)); const n = (s) => f.filter((r) => sideOf(r) === s).length; return `правая ${n('right')}, левая ${n('left')}`; };
  L.push(`Какая рука в худший момент (все группы): лицо/голова — ${bySide('face', (r) => ((r.face.headInsideMm ?? 0) > TH.headDepthMm && -(r.face.minGapMm ?? 0) < r.face.headInsideMm ? r.face.headSide : r.face.side ?? r.face.headSide))}; `
    + `корпус — ${bySide('torso', (r) => r.torso.side)}; локоть — ${bySide('elbow', (r) => (r.elbow.rightMinZ <= r.elbow.leftMinZ ? 'right' : 'left'))}; `
    + `рывок руки — ${bySide('speed', (r) => (/^Left/.test(r.speed.armBone ?? '') ? 'left' : 'right'))}.`);
  L.push('');
  L.push('Длительность и число кадров (мин / медиана / макс):');
  L.push('');
  for (const g of groups) {
    const rs = inG(g).filter((r) => !r.error);
    if (!rs.length) continue;
    const q = (a) => { const s = [...a].sort((x, y) => x - y); return `${s[0]} / ${s[Math.floor(s.length / 2)]} / ${s[s.length - 1]}`; };
    L.push(`- ${GROUPS[g]}: ${q(rs.map((r) => r.duration))} с; ${q(rs.map((r) => r.frames))} кадров; шаг ключей ${q(rs.map((r) => r.keyDt.min))} … ${q(rs.map((r) => r.keyDt.max))} с`);
  }
  const errs = results.filter((r) => r.error);
  L.push('');
  L.push(errs.length ? `Не читаются: ${errs.map((r) => `\`${r.file}\` (${r.error})`).join('; ')}.` : 'Все файлы читаются, структура у всех — кадры с t и bones из [x, y, z].');
  const struct = ok.filter((r) => r.flags.includes('structure'));
  if (struct.length) L.push(`Замечания к структуре: ${struct.map((r) => `\`${r.file}\` — ${r.issues.join('; ')}`).join('; ')}.`);
  for (const c of CATS) {
    const flagged = ok.filter((r) => r.flags.includes(c.id)).sort((a, b) => c.sev(b) - c.sev(a));
    L.push('');
    L.push(`## ${c.title} — ${flagged.length} файлов`);
    L.push('');
    L.push(`Порог: ${c.rule}.${flagged.length > TOP ? ` Показаны ${TOP} худших.` : ''}`);
    if (!flagged.length) continue;
    L.push('');
    L.push(`| файл | группа | ${c.cols.join(' | ')} |`);
    L.push(`|---|---|${c.cols.map(() => '---').join('|')}|`);
    for (const r of flagged.slice(0, TOP)) L.push(`| \`${r.file}\` | ${GROUPS[r.group]} | ${c.row(r).join(' | ')} |`);
  }
  L.push('');
  L.push('## Как мерили и чего аудит не видит');
  L.push('');
  for (const s of meta.notes) L.push(`- ${s}`);
  L.push('');
  return L.join('\n');
}

const NOTES = [
  'Кадр кладётся как у GesturePlayer.update: resetToRest, затем rest + дельта (Эйлер XYZ), линейная интерполяция дельт между ключами, кость без значения в текущем ключе — в базе. Смешивание входа/выхода (0.18/0.3 с) и дыхание avatarLife (≤ 1° на позвоночнике, шее, голове) не моделируются.',
  `Лицо (1): K.faceGap из signKit — тот же замер, что в check-phrases: фаланги и пясти — цилиндры 7–12 мм, лицо — вершины тела выше 1.45 м спереди, жёстко с костью головы. Величина беззнаковая: глубже радиуса фаланги (~8–12 мм) она не растёт, поэтому рядом — знаковый тест «точка кисти внутри головы» по всем вершинам головы (выше 1.45 м). У головы есть внутренние полости (рот), там глубина занижена или точка считается снаружи. Точное значение зазора считается, когда кисть ближе ${FACE_MARGIN * 100} см к лицу; дальше — «—».`,
  'Корпус (2): у Елнара корпус и ноги — только одежда (свитер, брюки, обувь), тела под ней в меше нет. Вершины одежды, на которые двигающиеся кости влияют весом > 0.02, отброшены (проймы рукавов, ворот). Глубина — от сустава/кончика пальца до поверхности одежды по нормали ближайшей вершины, без толщины пальца. В дырах (подмышки, ворот) точка внутрь не засчитывается. «Запас как в check-phrases» — его torsoClearance: z точки минус передняя поверхность в окне ±2.5 см, только грудь/живот (|x| < 16 см, 0.9–1.47 м); сзади и сбоку она «внутри» не отличает.',
  `Кисти (3): K.handsGap (кожа к коже, цилиндры по фалангам и пястям), как в check-phrases. Точно считается, когда кисти ближе ${HANDS_MARGIN * 100} см; дальше — «—». Кисть против предплечья другой руки не проверяется.`,
  'Локоть (4): мировая точка кости предплечья (локтевой сустав), z от середины плеч в ширинах плеч; корпус в жестах не поворачивается, поэтому оси мира = оси тела.',
  `Скорость (5): угол между локальными кватернионами кости в соседних отсчётах ${HZ} Гц, делённый на шаг. «По ключам» — то же между позами плеера в моменты ключей, до первого ключа не ближе 1/${HZ} с (у SLOVO это соседние ключи, у частых ключей окно не даёт мерить мгновенный пик на отрезке в 4 мс), плюс скачки, когда кость пропадает из ключа и плеер ставит её в базу. «Туда-обратно» — итог поворота за два шага вокруг самого быстрого, делённый на пройденный путь: около 1 — движение в одну сторону (быстрый, но плавный мах), меньше 0.5 — кость ушла и вернулась (дрожь, перескок оси скручивания).`,
  'Старт/финиш (6): угол каждой кости руки (ключица, плечо, предплечье, кисть) против позы покоя плеера (IDLE_ARM_X) и против базы жестов (STANCE_ARM_X, дельта 0); засчитывается меньшее: SLOVO начинается в базе, проверенные — в покое, между ними 11.5° на плече.',
  'Отсчёты 15 Гц: у SLOVO ключи идут почти с той же частотой (~15 к/с), короткий выброс между отсчётами может быть пропущен геометрией (скорость по ключам его увидит).',
];

// ——— самопроверка ———
function selftest(files) {
  let ok = true;
  const say = (good, msg) => { if (!good) ok = false; console.log(`  ${good ? '✓' : '✗'} ${msg}`); };
  console.log('\n═══ самопроверка аудита');
  // 1. имена костей и развороты
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/avatarBoneMap.ts'), 'utf8');
  const MAP = Object.fromEntries([...(src.match(/const MAP[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? '').matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
  const inv = Object.fromEntries(Object.entries(JSON_NAME).map(([k, v]) => [v, k]));
  const diff = [...new Set([...Object.keys(MAP), ...Object.keys(inv)])].filter((k) => MAP[k] !== inv[k]);
  say(!diff.length, `карта имён плеера (${Object.keys(MAP).length}) = обратной JSON_NAME из rig.mjs${diff.length ? `; расходятся: ${diff.join(', ')}` : ''}; источник: ${resolverSource}`);
  const flips = Object.keys(MAP).map((n) => [n, resolveBone(n).axisFlip]).filter(([, f]) => f.some((x) => x !== 1));
  say(true, `развороты осей в плеере: ${flips.length ? flips.map(([n, f]) => `${n} ${f}`).join(', ') : 'нет (AXIS пуст)'}`);
  // 2. адаптер против rig.mjs applyFrame(sampleGesture)
  const pick = ['slovo', 'old', 'verified'].flatMap((g) => { const fs_ = files.filter((f) => groupOf(f) === g); return [...fs_.slice(0, 2), fs_[fs_.length - 1]]; });
  let worst = 0;
  for (const rel of pick) {
    const g = JSON.parse(fs.readFileSync(path.join(ROOT, GESTURES, rel), 'utf8'));
    const dur = g.frames[g.frames.length - 1].t;
    for (let k = 0; k <= 12; k++) {
      const t = (dur * k) / 12;
      applyFrame(rig, sampleGesture(g, t));
      const a = [...PLAYER_BONES].map((n) => wpos(rig.bones.get(n)));
      applyPose(playerDeltas(g, t));
      [...PLAYER_BONES].forEach((n, i) => { worst = Math.max(worst, a[i].distanceTo(wpos(rig.bones.get(n)))); });
    }
  }
  say(worst < 1e-9, `адаптер плеера = rig.mjs applyFrame(sampleGesture) на ${pick.length} файлах: расхождение суставов ${worst.toExponential(1)} м`);
  // 3. сетка «запаса до корпуса» = перебору как в check-phrases
  let gridBad = 0;
  for (let k = 0; k < 3000; k++) {
    const p = new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.85 + Math.random() * 0.7, Math.random() * 0.4 - 0.1);
    if (torsoClearance(p) !== torsoClearanceBrute(p)) gridBad++;
  }
  say(!gridBad, `torsoClearance через сетку совпадает с перебором check-phrases на 3000 случайных точках (расхождений: ${gridBad})`);
  // 4. числа check-phrases против этого аудита на тех же отсчётах
  for (const name of ['kak-dela', 'words/pit']) {
    const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts/check-phrases.mjs'), '--only', name], { cwd: ROOT, encoding: 'utf8' });
    const txt = run.stdout ?? '';
    const face = txt.match(/ближе всего (-?[\d.]+) мм @([\d.]+) с/) ?? txt.match(/входит в лицо на ([\d.]+) мм @([\d.]+) с/);
    const cpFace = face ? { mm: (txt.includes('входит в лицо') ? -1 : 1) * Number(face[1]), t: Number(face[2]) } : null;
    const cpTorso = {};
    for (const m of txt.matchAll(/(правая|левая) кисть не касается корпуса: запас (-?[\d.]+) см \(минимум @([\d.]+) с, (\w+)\)/g)) cpTorso[m[1] === 'правая' ? 'right' : 'left'] = { cm: Number(m[2]), t: Number(m[3]), key: m[4] };
    for (const m of txt.matchAll(/(правая|левая) кисть у корпуса: (-?[\d.]+) см @([\d.]+) с \((\w+);/g)) cpTorso[m[1] === 'правая' ? 'right' : 'left'] = { cm: Number(m[2]), t: Number(m[3]), key: m[4] };
    const g = JSON.parse(fs.readFileSync(path.join(ROOT, GESTURES, `${name}.json`), 'utf8'));
    const dur = g.frames[g.frames.length - 1].t;
    let f = { gap: Infinity, t: 0 };
    for (let k = 0; k <= Math.round(dur * 60); k++) {
      applyPose(playerDeltas(g, k / 60));
      for (const sd of ['right', 'left']) { const gap = K.faceGap(sd); if (gap < f.gap) f = { gap, t: k / 60 }; }
    }
    const tor = { right: { c: Infinity }, left: { c: Infinity } };
    for (let k = 0; k <= Math.round(dur * 120); k++) {
      applyPose(playerDeltas(g, k / 120));
      for (const sd of ['right', 'left']) { const hp = K.handPoints(sd); for (const key of CP_KEYS) { const c = torsoClearance(hp[key]); if (c < tor[sd].c) tor[sd] = { c, t: k / 120, key }; } }
    }
    const mine = `лицо ${(f.gap * 1000).toFixed(1)} мм @${f.t.toFixed(2)} с; запас прав. ${(tor.right.c * 100).toFixed(1)} см @${tor.right.t?.toFixed(2)} (${tor.right.key}), лев. ${(tor.left.c * 100).toFixed(1)} см @${tor.left.t?.toFixed(2)} (${tor.left.key})`;
    const theirs = `лицо ${cpFace ? `${cpFace.mm.toFixed(1)} мм @${cpFace.t.toFixed(2)} с` : '?'}; запас прав. ${cpTorso.right ? `${cpTorso.right.cm.toFixed(1)} см @${cpTorso.right.t.toFixed(2)} (${cpTorso.right.key})` : '— (рука в покое)'}, лев. ${cpTorso.left ? `${cpTorso.left.cm.toFixed(1)} см @${cpTorso.left.t.toFixed(2)} (${cpTorso.left.key})` : '— (рука в покое)'}`;
    const same = cpFace && (f.gap * 1000).toFixed(1) === cpFace.mm.toFixed(1) && f.t.toFixed(2) === cpFace.t.toFixed(2)
      && ['right', 'left'].every((sd) => (!cpTorso[sd] && tor[sd].c === Infinity)
        || (cpTorso[sd] && (tor[sd].c * 100).toFixed(1) === cpTorso[sd].cm.toFixed(1) && tor[sd].t.toFixed(2) === cpTorso[sd].t.toFixed(2) && tor[sd].key === cpTorso[sd].key));
    say(same, `${name} (лицо 60 Гц, корпус 120 Гц — как в check-phrases):\n      аудит:         ${mine}\n      check-phrases: ${theirs}`);
    const a = summarize(name, g, fs.statSync(path.join(ROOT, GESTURES, `${name}.json`)), auditGesture(g), validate(g));
    console.log(`      тот же файл в аудите (${HZ} Гц): лицо ${fmt(a.face.minGapMm)} мм @${fmt(a.face.t, 2)}, в голове ${a.face.headInsideMm} мм, в одежде ${a.torso.insideCm} см, запас ${fmt(a.torso.frontRightCm, 1)}/${fmt(a.torso.frontLeftCm, 1)} см, кисти ${fmt(a.hands.minGapMm)} мм, локти ${a.elbow.rightMinZ}/${a.elbow.leftMinZ}, рука ${a.speed.armDegS} °/с, флаги: ${a.flags.join(', ') || 'нет'}`);
  }
  // 5. поза покоя и база жестов — сами не должны ничего нарушать
  for (const [nm, deltas] of [['база жестов (дельта 0)', new Map()], ['поза покоя (IDLE_ARM_X)', new Map([[ARM.right.arm, [IDLE_ARM_X - STANCE_ARM_X, 0, 0]], [ARM.left.arm, [IDLE_ARM_X - STANCE_ARM_X, 0, 0]]])]]) {
    applyPose(deltas);
    let head = 0, trunk = 0, front = Infinity;
    for (const sd of ['right', 'left']) {
      const h = handSample(sd);
      for (const [, p] of h.pts) { head = Math.max(head, insideDepth(HEADSET, p.x, p.y, p.z)); trunk = Math.max(trunk, insideDepth(TRUNK, p.x, p.y, p.z)); }
      for (const key of CP_KEYS) front = Math.min(front, torsoClearance(h.hp[key]));
    }
    const ez = Math.min(...['right', 'left'].map((sd) => K.toRef(wpos(rig.bones.get(ARM[sd].fore))).z));
    const fg = Math.min(K.faceGap('right'), K.faceGap('left'));
    say(head * 1000 <= TH.headDepthMm && trunk * 100 <= TH.torsoDepthCm && fg * 1000 >= TH.faceGapMm && ez >= TH.elbowZ && K.handsGap() * 1000 >= TH.handsGapMm,
      `${nm}: лицо ${(fg * 1000).toFixed(0)} мм, в голове ${(head * 1000).toFixed(1)} мм, в одежде ${(trunk * 100).toFixed(2)} см, запас ${front === Infinity ? '—' : (front * 100).toFixed(1) + ' см'}, кисти ${(K.handsGap() * 1000).toFixed(0)} мм, локоть z ${ez.toFixed(2)}`);
  }
  // 6. знаковый тест на прямых через тело: внутри — только между поверхностями
  const probe = (set, f, from, to, step) => { const r = []; for (let u = from; u <= to + 1e-9; u += step) { const [x, y, z] = f(u); r.push(insideDepth(set, x, y, z) > 0 ? '█' : '·'); } return r.join(''); };
  console.log('  знаковый тест, █ — внутри (шаг 1 см):');
  console.log(`      грудь по z (x=0, y=1.2, z −0.25…0.30):   ${probe(TRUNK, (u) => [0, 1.2, u], -0.25, 0.3, 0.01)}`);
  console.log(`      грудь по x (y=1.2, z=0.02, x −0.3…0.3):   ${probe(TRUNK, (u) => [u, 1.2, 0.02], -0.3, 0.3, 0.01)}`);
  console.log(`      бедро по z (x=0.1, y=0.7, z −0.2…0.25):   ${probe(TRUNK, (u) => [0.1, 0.7, u], -0.2, 0.25, 0.01)}`);
  console.log(`      голова по z (x=0, y=1.65, z −0.2…0.3):    ${probe(HEADSET, (u) => [0, 1.65, u], -0.2, 0.3, 0.01)}`);
  console.log(`  поверхности: одежда без двигающихся костей ${TRUNK.pts.length} вершин, голова ${HEADSET.pts.length} (на них кости рук влияют весом ≤ 0.02); двигающиеся кости: ${[...MOVING].map(label).join(' ')}`);
  applyPose(new Map());
  return ok;
}

// ——— прогон ———
const t0 = performance.now();
const all = listFiles();
const skipped = all.filter((f) => path.basename(f) === 'index.json');
let files = all.filter((f) => path.basename(f) !== 'index.json');
if (ONLY) files = files.filter((f) => f.includes(ONLY));
if (GROUP) files = files.filter((f) => GROUP.split(',').includes(groupOf(f)));

// предпросмотр: какие кости анимируются хоть где-то (для неподвижной части одежды)
const movingTargets = new Set();
for (const rel of all.filter((f) => path.basename(f) !== 'index.json')) {
  try {
    const g = JSON.parse(fs.readFileSync(path.join(ROOT, GESTURES, rel), 'utf8'));
    for (const f of g?.frames ?? []) for (const n of Object.keys(f?.bones ?? {})) { const e = resolveBone(n); if (PLAYER_BONES.has(e.target)) movingTargets.add(e.target); }
  } catch { /* разбор — в основном проходе */ }
}
setupSurfaces(movingTargets);

if (SELFTEST) {
  const good = selftest(all.filter((f) => path.basename(f) !== 'index.json'));
  console.log(good ? '\nСАМОПРОВЕРКА: аудит считает так же, как плеер и check-phrases' : '\nСАМОПРОВЕРКА: есть расхождения — см. ✗');
  process.exit(good ? 0 : 1);
}

const results = [];
for (const [i, rel] of files.entries()) {
  const full = path.join(ROOT, GESTURES, rel);
  const st = fs.statSync(full);
  let g;
  try { g = JSON.parse(fs.readFileSync(full, 'utf8')); } catch (e) {
    results.push({ file: rel, group: groupOf(rel), error: `JSON не разбирается: ${e.message}`, mtime: st.mtime.toISOString(), size: st.size, flags: ['parse'] });
    continue;
  }
  const v = validate(g);
  if (v.fatal) { results.push({ file: rel, group: groupOf(rel), error: v.fatal, mtime: st.mtime.toISOString(), size: st.size, flags: ['parse'] }); continue; }
  results.push(summarize(rel, g, st, auditGesture(g), v));
  if ((i + 1) % 100 === 0) process.stderr.write(`  ${i + 1}/${files.length} файлов, ${((performance.now() - t0) / 1000).toFixed(0)} с\n`);
}
const seconds = (performance.now() - t0) / 1000;
// развороты осей по всем именам костей, что встречаются в проверенных файлах
const seenNames = new Set();
for (const rel of files) {
  try { for (const f of JSON.parse(fs.readFileSync(path.join(ROOT, GESTURES, rel), 'utf8')).frames ?? []) for (const n of Object.keys(f.bones ?? {})) seenNames.add(n); } catch { /* уже учтено */ }
}
const flipList = [...seenNames].map((n) => [n, resolveBone(n).axisFlip ?? [1, 1, 1]]).filter(([, a]) => a.some((x) => x !== 1));
const axisFlips = flipList.length ? flipList.map(([n, a]) => `${n} ${a}`).join(', ') : `нет ни у одной из ${seenNames.size} костей файлов`;
const meta = {
  date: new Date().toISOString(), hz: HZ, exact: EXACT, seconds, resolver: resolverSource, axisFlips, skipped,
  thresholds: TH, faceMargin: FACE_MARGIN, handsMargin: HANDS_MARGIN,
  movingBones: [...MOVING].map(label), trunkVertices: TRUNK.pts.length, headVertices: HEADSET.pts.length, notes: NOTES,
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'audit_technical.json'), JSON.stringify({ meta, files: results }, null, 1));
const md = markdown(results, meta);
fs.writeFileSync(path.join(OUT, 'audit_technical.md'), md);
console.log(md);
console.log(`\nЗаписано: ${path.join(OUT, 'audit_technical.json')}, ${path.join(OUT, 'audit_technical.md')} (${seconds.toFixed(1)} с)`);

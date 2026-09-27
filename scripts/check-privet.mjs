/**
 * Сверка жеста ПРИВЕТ с тем, как его показывают живые люди.
 *
 *   node scripts/check-privet.mjs [--gesture public/gestures/privet.json] [--ml ml]
 *
 * Жест прогоняется ровно той математикой, что GesturePlayer (rest + дельта,
 * линейная интерполяция кадров), на скелете avatar_elnar.glb. Эталон
 * пересчитывается из ландмарок SLOVO (все клипы «Привет!»). Для каждого
 * замера печатается значение аватара и разброс у людей (10–90 %).
 *
 * Плюс технические проверки: старт/финиш в позе покоя, левая рука не
 * двигается, интерполяция Эйлера не уводит кость от задуманного поворота,
 * кисть не проходит сквозь голову и корпус.
 */
import fs from 'node:fs';
import path from 'node:path';
import { THREE, ROOT, loadRig, applyFrame, sampleGesture, wpos, wquat, ARM, JSON_NAME, STANCE_ARM_X, IDLE_ARM_X } from './lib/rig.mjs';
import { readMeshPositions } from './lib/glbMesh.mjs';
import { slovoReference, median, pct, swingHz } from './lib/slovoRef.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const GESTURE = path.resolve(ROOT, arg('--gesture', 'public/gestures/privet.json'));
const ML = path.resolve(ROOT, arg('--ml', process.env.QYRAN_ML ?? 'ml'));
const AVATAR = arg('--avatar', 'public/avatar_elnar.glb');

const gesture = JSON.parse(fs.readFileSync(GESTURE, 'utf8'));
const rig = loadRig(AVATAR);
const R = ARM.right;
const B = (n) => rig.bones.get(n);
const deg = (r) => (r * 180) / Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tipOf = (bone, len) => wpos(B(bone)).add(V(0, len, 0).applyQuaternion(wquat(B(bone))));

// Система отсчёта как у эталона: центр плеч, ширина плеч, x к середине тела (+X мира для правой руки)
const SR = wpos(B(R.arm)), SL = wpos(B(ARM.left.arm));
const MID = SR.clone().add(SL).multiplyScalar(0.5);
const SW = SR.distanceTo(SL);
const rel = (p) => [(p.x - MID.x) / SW, (p.y - MID.y) / SW];
// Замеры по мешу (нос, касания) — только у Елнара: у Адама и Евы другие меши,
// а у Адама ещё и повёрнутая/масштабированная арматура.
const hasMesh = rig.json.meshes.some((m) => m.name === 'Qyran_Body');
const body = hasMesh ? readMeshPositions(AVATAR, 'Qyran_Body') : [];
const outfit = hasMesh ? readMeshPositions(AVATAR, 'Qyran_Outfit') : [];
const nose = hasMesh ? body.filter((p) => Math.abs(p[0]) < 0.01 && p[1] > 1.4).reduce((a, b) => (b[2] > a[2] ? b : a)) : null;
const noseY = nose ? (nose[1] - MID.y) / SW : NaN;

const dur = gesture.frames[gesture.frames.length - 1].t;
const HZ = 120;
const samples = [];
for (let k = 0; k <= Math.round(dur * HZ); k++) {
  const t = k / HZ;
  applyFrame(rig, sampleGesture(gesture, t));
  const wrist = wpos(B(R.hand));
  const tip = tipOf(R.middle[2], 0.024);
  const palm = V(0, 0, 1).applyQuaternion(wquat(B(R.hand)));
  const pr = (a, b) => [b.x - a.x, b.y - a.y];
  const ang2 = (a, b) => deg(Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))))));
  const thumbTip = tipOf(R.thumb[2], 0.03), indexTip = tipOf(R.index[2], 0.022), pinkyTip = tipOf(R.pinky[2], 0.018);
  samples.push({
    t, wrist, tip, palm,
    w: rel(wrist), tp: rel(tip),
    tilt: deg(Math.atan2(tip.x - wrist.x, tip.y - wrist.y)),
    thumbIndex: ang2(pr(wpos(B(R.thumb[1])), thumbTip), pr(wpos(B(R.index[0])), indexTip)),
    indexPinky: ang2(pr(wpos(B(R.index[0])), indexTip), pr(wpos(B(R.pinky[0])), pinkyTip)),
    palmForward: wpos(B(R.index[0])).x > wpos(B(R.pinky[0])).x,
    lwrist: wpos(B(ARM.left.hand)),
    fingerPts: [tip, indexTip, pinkyTip, thumbTip, wrist],
  });
}

// Фаза удержания — как у эталона: запястье не ниже 0.35 ширины плеч от максимума
const topY = Math.max(...samples.map((s) => s.w[1]));
const inHold = (s) => s.w[1] > topY - 0.35;
const hold = samples.filter(inHold);
const wave = swingHz(samples.map((s) => (inHold(s) ? s.tilt : NaN)), 1 / HZ);
const avatar = {
  wristX: median(hold.map((s) => s.w[0])),
  wristY: median(hold.map((s) => s.w[1])),
  tipY: median(hold.map((s) => s.tp[1])),
  tipMinusNose: median(hold.map((s) => s.tp[1])) - noseY,
  tilt: median(hold.map((s) => s.tilt)),
  tiltAmp: (pct(hold.map((s) => s.tilt), 0.9) - pct(hold.map((s) => s.tilt), 0.1)) / 2,
  wristSway: (pct(hold.map((s) => s.w[0]), 0.9) - pct(hold.map((s) => s.w[0]), 0.1)) / 2,
  thumbIndex: median(hold.map((s) => s.thumbIndex)),
  indexPinky: median(hold.map((s) => s.indexPinky)),
  hz: wave.hz,
  extremes: wave.extremes,
  seconds: dur,
  palmForward: hold.every((s) => s.palmForward),
};

// ——— эталон ———
let ref = null;
if (fs.existsSync(path.join(ML, 'landmarks_holistic/file_index.json'))) {
  ref = slovoReference(ML, 'Привет!');
} else {
  console.log(`(нет ландмарок SLOVO в ${ML} — укажите --ml <папка ml основного репо>; сверка с эталоном пропущена)`);
}

let fails = 0;
const row = (name, key, unit, fmt = 2, { soft = false } = {}) => {
  const a = avatar[key];
  if (!ref) { console.log(`  ${name.padEnd(34)} ${a.toFixed(fmt)}${unit}`); return; }
  const vals = ref.map((c) => c[key]);
  const lo = pct(vals, 0.1), hi = pct(vals, 0.9), md = median(vals);
  const ok = a >= lo && a <= hi;
  if (!ok && !soft) fails++;
  console.log(`  ${name.padEnd(34)} ${a.toFixed(fmt).padStart(7)}${unit}   люди: ${md.toFixed(fmt)} [${lo.toFixed(fmt)}..${hi.toFixed(fmt)}]  ${ok ? 'OK' : soft ? 'вне (справочно)' : 'ВНЕ'}`);
};

console.log(`\nПРИВЕТ: ${path.relative(ROOT, GESTURE)}, ${gesture.frames.length} кадров, ${dur.toFixed(2)} с`);
if (ref) console.log(`эталон: ${ref.length} клипов «Привет!» SLOVO, ${new Set(ref.map((c) => c.user)).size} разных людей`);
console.log('\n— место и форма (ширины плеч от центра плеч; x к середине тела, y вверх) —');
row('запястье x', 'wristX', '');
row('запястье y', 'wristY', '');
row('кончик среднего пальца y', 'tipY', '');
if (hasMesh) row('кончик пальца минус нос (y)', 'tipMinusNose', '');
row('наклон пальцев от вертикали', 'tilt', '°', 1);
row('большой ∠ указательный', 'thumbIndex', '°', 1);
row('веер указательный ∠ мизинец', 'indexPinky', '°', 1, { soft: true });
console.log('\n— движение —');
row('покачивание: наклон ±', 'tiltAmp', '°', 1);
row('покачивание: ход запястья ±', 'wristSway', '');
row('частота покачивания', 'hz', ' Гц', 2);
row('длительность клипа', 'seconds', ' с', 2, { soft: true });
const palmOk = avatar.palmForward && (!ref || ref.every((c) => c.palmForward));
console.log(`  ${'ладонь к собеседнику'.padEnd(34)} ${avatar.palmForward ? 'да' : 'НЕТ'}   люди: ${ref ? `${ref.filter((c) => c.palmForward).length} из ${ref.length}` : '—'}  ${palmOk ? 'OK' : 'ВНЕ'}`);
if (!palmOk) fails++;

// ——— технические проверки ———
console.log('\n— техника —');
const check = (name, ok, detail) => { if (!ok) fails++; console.log(`  ${name.padEnd(34)} ${ok ? 'OK' : 'ОШИБКА'}  ${detail}`); };

const idleDelta = { [JSON_NAME[R.arm]]: [IDLE_ARM_X - STANCE_ARM_X, 0, 0] };
const isIdle = (fr) => Object.entries(fr.bones).every(([n, d]) => {
  const want = idleDelta[n] ?? (n === JSON_NAME[ARM.left.arm] ? [IDLE_ARM_X - STANCE_ARM_X, 0, 0] : [0, 0, 0]);
  // эквивалентные углы Эйлера могут отличаться на 2π
  return d.every((x, k) => Math.abs(Math.atan2(Math.sin(x - want[k]), Math.cos(x - want[k]))) < 1e-3);
});
check('начало и конец — поза покоя', isIdle(gesture.frames[0]) && isIdle(gesture.frames[gesture.frames.length - 1]), '');

const l0 = samples[0].lwrist;
const lMove = Math.max(...samples.map((s) => s.lwrist.distanceTo(l0)));
check('левая рука неподвижна', lMove < 0.005, `смещение запястья ${(lMove * 100).toFixed(2)} см`);

// Интерполяция: плеер тянет Эйлеры линейно — сравниваем с настоящим слерпом кватернионов
let worst = 0, worstAt = '';
for (let i = 0; i + 1 < gesture.frames.length; i++) {
  const a = gesture.frames[i], b = gesture.frames[i + 1];
  for (const n of Object.keys(a.bones)) {
    const bone = Object.entries(JSON_NAME).find(([, v]) => v === n)?.[0];
    const rest = rig.rest.get(bone);
    const q = (d) => new THREE.Quaternion().setFromEuler(new THREE.Euler(rest.x + d[0], rest.y + d[1], rest.z + d[2], 'XYZ'));
    const qa = q(a.bones[n]), qb = q(b.bones[n] ?? a.bones[n]);
    const mid = q(a.bones[n].map((x, k) => (x + (b.bones[n] ?? a.bones[n])[k]) / 2));
    const want = qa.clone().slerp(qb, 0.5);
    const err = deg(mid.angleTo(want));
    if (err > worst) { worst = err; worstAt = `${n} между ${a.t}–${b.t} с`; }
  }
}
check('интерполяция Эйлера ≈ слерп', worst < 1, `худший промах ${worst.toFixed(2)}° (${worstAt})`);

// Кисть не входит в голову и корпус: точки пальцев против меша (ближайшая вершина ближе 1 см — касание)
if (!hasMesh) console.log('  (касания головы и корпуса проверяются только на avatar_elnar.glb)');
const headPts = body.filter((p) => p[1] > 1.45 && Math.abs(p[0]) < 0.12);
const torsoPts = outfit.filter((p) => p[1] > 1.0 && p[1] < 1.5 && Math.abs(p[0]) < 0.2);
let minHead = Infinity, minTorso = Infinity;
for (const s of samples) {
  for (const p of s.fingerPts) {
    for (const q of headPts) minHead = Math.min(minHead, Math.hypot(p.x - q[0], p.y - q[1], p.z - q[2]));
    if (p.y < 1.5) for (const q of torsoPts) minTorso = Math.min(minTorso, Math.hypot(p.x - q[0], p.y - q[1], p.z - q[2]));
  }
}
if (hasMesh) {
  check('кисть не касается головы', minHead > 0.03, `ближе всего ${(minHead * 100).toFixed(1)} см`);
  check('кисть не входит в корпус', minTorso > 0.015, `ближе всего ${(minTorso * 100).toFixed(1)} см (точки пальцев до поверхности одежды)`);
}

console.log(fails ? `\nИТОГ: ${fails} замечаний` : '\nИТОГ: всё в пределах разброса живых людей');
process.exitCode = fails ? 1 : 0;

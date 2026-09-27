/**
 * Сверка фраз «Как дела?» и «Как я могу помочь?» с записями носителей и техника.
 *
 *   node scripts/check-phrases.mjs [--only kak-dela]
 *
 * Жест прогоняется той же математикой, что GesturePlayer (rest + дельта,
 * линейная интерполяция кадров), на скелете avatar_elnar.glb.
 *
 * Что проверяется:
 *   - старт и финиш — поза покоя обеих рук, голова прямо;
 *   - интерполяция Эйлера между кадрами не уводит кость от слерпа больше 1°;
 *   - кисти не входят в корпус (по мешу одежды и тела);
 *   - в ПОМОЧЬ правая кисть лежит на левой (кожа к коже 0–8 мм) и кисти нигде не
 *     проходят друг сквозь друга (фаланги и пясти — цилиндры);
 *   - кисти в кадре спереди — там же и так же, как у носителя (scripts/lib/phraseRefs.mjs):
 *     запястье, направление пясти, указательного и большого пальца, по каждому кадру
 *     фаз знака; время жеста = время записи − t0. Раньше сверялись только запястья,
 *     и развёрнутая не туда ладонь проходила сверку («ДЕЛА» ладонями вверх).
 */
import fs from 'node:fs';
import path from 'node:path';
import { THREE, ROOT, loadRig, applyFrame, sampleGesture, wpos, wquat, ARM, STANCE_ARM_X, IDLE_ARM_X } from './lib/rig.mjs';
import { readMeshPositions } from './lib/glbMesh.mjs';
import { createKit } from './lib/signKit.mjs';
import { PHRASE_REFS } from './lib/phraseRefs.mjs';

/** Расстояние камеры для проекции — то же, что в scripts/author-phrases.mjs. */
const D_CAM = 2.0;

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
// --gestures <папка> — проверить другие файлы (например, прежние версии), --oldmap — у них своё
// время: кусочно-линейное соответствие фаз записи и жеста (как было до 2026-09-24)
const gestureDir = args.includes('--gestures') ? args[args.indexOf('--gestures') + 1] : 'public/gestures';
const OLD_MAPS = {
  'kak-dela': { ref: [1.14, 1.46, 2.02, 2.26, 2.50, 2.66, 3.02], avatar: [0.0, 0.36, 0.96, 1.26, 1.58, 1.80, 2.20] },
  'kak-pomoch': { ref: [1.14, 1.36, 1.88, 2.08, 2.26], avatar: [0.0, 0.32, 0.86, 1.08, 1.40] },
};
const oldMap = args.includes('--oldmap');
// --rows — печатать кисть аватара и носителя по каждому ряду эталона
const showRows = args.includes('--rows');
const AVATAR = 'public/avatar_elnar.glb';
const rig = loadRig(AVATAR);
const K = createKit(rig);
K.setFaceMesh(readMeshPositions(AVATAR, 'Qyran_Body'));
K.setBodyMesh([...readMeshPositions(AVATAR, 'Qyran_Body'), ...readMeshPositions(AVATAR, 'Qyran_Outfit')]);
const deg = (r) => (r * 180) / Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const f2 = (x) => (x >= 0 ? ' ' : '') + x.toFixed(2);

// Передняя поверхность корпуса: вершины тела и одежды между плечами, от таза до шеи
const torso = [...readMeshPositions(AVATAR, 'Qyran_Body'), ...readMeshPositions(AVATAR, 'Qyran_Outfit')]
  .filter((p) => Math.abs(p[0]) < 0.16 && p[1] > 0.9 && p[1] < 1.47);
function torsoClearance(p) {
  let front = -Infinity;
  for (const v of torso) if (Math.abs(v[0] - p.x) < 0.025 && Math.abs(v[1] - p.y) < 0.025 && v[2] > front) front = v[2];
  return front === -Infinity ? Infinity : p.z - front;
}

const idleDelta = { 'mixamorig:RightArm': [IDLE_ARM_X - STANCE_ARM_X, 0, 0], 'mixamorig:LeftArm': [IDLE_ARM_X - STANCE_ARM_X, 0, 0] };
let allOk = true;
const fail = (msg) => { allOk = false; console.log('  ✗', msg); };
const ok = (msg) => console.log('  ✓', msg);

for (const [name, refDef] of Object.entries(PHRASE_REFS)) {
  if (only && name !== only) continue;
  const gesture = JSON.parse(fs.readFileSync(path.resolve(ROOT, gestureDir, `${name}.json`), 'utf8'));
  const fr = gesture.frames;
  const dur = fr[fr.length - 1].t;
  console.log(`\n═══ ${name}: ${fr.length} кадров, ${dur.toFixed(2)} с — эталон ${refDef.source}`);

  // ——— старт/финиш ———
  for (const [label, frame] of [['старт', fr[0]], ['финиш', fr[fr.length - 1]]]) {
    let worst = 0;
    for (const [bone, d] of Object.entries(frame.bones)) {
      const want = idleDelta[bone] ?? [0, 0, 0];
      worst = Math.max(worst, ...d.map((x, i) => Math.abs(x - want[i])));
    }
    worst < 1e-4 ? ok(`${label} — поза покоя (отклонение ${deg(worst).toFixed(3)}°)`) : fail(`${label} не в покое: ${deg(worst).toFixed(2)}°`);
  }

  // ——— интерполяция Эйлера против слерпа ———
  let worstInterp = 0, worstAt = '';
  for (let i = 0; i < fr.length - 1; i++) {
    for (const bone of Object.keys(fr[i].bones)) {
      const a = fr[i].bones[bone], b = fr[i + 1].bones[bone];
      if (!b) continue;
      const qa = new THREE.Quaternion().setFromEuler(new THREE.Euler(...a, 'XYZ'));
      const qb = new THREE.Quaternion().setFromEuler(new THREE.Euler(...b, 'XYZ'));
      const qm = new THREE.Quaternion().setFromEuler(new THREE.Euler(...a.map((x, k) => (x + b[k]) / 2), 'XYZ'));
      const err = deg(qm.angleTo(qa.clone().slerp(qb, 0.5)));
      if (err > worstInterp) { worstInterp = err; worstAt = `${bone} @${fr[i].t}`; }
    }
  }
  worstInterp < 1 ? ok(`интерполяция: худшее расхождение с слерпом ${worstInterp.toFixed(2)}° (${worstAt})`) : fail(`интерполяция ${worstInterp.toFixed(2)}° (${worstAt})`);

  // ——— проход по времени ———
  const HZ = 120;
  let minClear = { right: Infinity, left: Infinity }, minClearAt = { right: 0, left: 0 }, minClearPt = { right: '', left: '' };
  const contact = [];
  const samples = [];
  for (let k = 0; k <= Math.round(dur * HZ); k++) {
    const t = k / HZ;
    applyFrame(rig, sampleGesture(gesture, t));
    const pts = { right: K.handPoints('right'), left: K.handPoints('left') };
    for (const side of ['right', 'left']) {
      for (const key of ['wrist', 'palmCenter', 'index', 'middle', 'ring', 'pinky', 'thumb']) {
        const c = torsoClearance(pts[side][key]);
        if (c < minClear[side]) { minClear[side] = c; minClearAt[side] = t; minClearPt[side] = key; }
      }
    }
    if (name === 'kak-pomoch') {
      const gap = K.handsGap();
      contact.push({ t, along: gap, inPlane: 0, deepest: gap, finger: 'ближайшие фаланги' });
    }
    // Проекция как у эталона: камера спереди на уровне плеч, на расстоянии D_CAM
    const rel2 = (p) => { const m = D_CAM / (D_CAM - (p.z - K.MID.z)); return [(p.x - K.MID.x) * m / K.SW, (p.y - K.MID.y) * m / K.SW]; };
    const ang2 = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    const hand2 = (side) => {
      const B = ARM[side], P = pts[side];
      const w = rel2(wpos(rig.bones.get(B.hand)));
      const m9 = rel2(wpos(rig.bones.get(B.middle[0])));
      const i5 = rel2(wpos(rig.bones.get(B.index[0]))), i8 = rel2(P.index);
      const t2 = rel2(wpos(rig.bones.get(B.thumb[1]))), t4 = rel2(P.thumb);
      return { w, meta: ang2(w, m9), idx: ang2(i5, i8), thb: ang2(t2, t4) };
    };
    samples.push({ t, R: hand2('right'), L: hand2('left') });
  }
  // Запас до корпуса: 1 см; у знаков под подбородком (запястье у ворота) — 3 мм, лишь бы не входила
  const minTorso = (refDef.minTorsoCm ?? 1);
  // кисть не входит в лицо ни в один момент (кивок головы учтён: лицо идёт за головой)
  let deepFace = { gap: Infinity, t: 0 };
  for (let k = 0; k <= Math.round(dur * 60); k++) {
    const t = k / 60;
    applyFrame(rig, sampleGesture(gesture, t));
    for (const sd of ['right', 'left']) { const g = K.faceGap(sd); if (g < deepFace.gap) deepFace = { gap: g, t }; }
  }
  deepFace.gap > -0.002 ? ok(`кисти не входят в лицо (ближе всего ${(deepFace.gap * 1000).toFixed(1)} мм @${deepFace.t.toFixed(2)} с)`)
    : fail(`кисть входит в лицо на ${(-deepFace.gap * 1000).toFixed(1)} мм @${deepFace.t.toFixed(2)} с`);
  // кисти не проходят друг сквозь друга ни в один момент — у всех знаков, где перед корпусом бывают обе руки (аудит 28.09:
  // на переходах между ключами касания кисти прорезали друг друга до 2 см, а сверка этого не видела)
  if (minClear.right !== Infinity && minClear.left !== Infinity) {
    let deepHands = { gap: Infinity, t: 0 };
    for (let k = 0; k <= Math.round(dur * 60); k++) {
      const t = k / 60;
      applyFrame(rig, sampleGesture(gesture, t));
      // кисти длиной ~18 см: пальцы навстречу сходятся и при запястьях в 36 см — отсекаем только заведомо далёкие
      if (wpos(rig.bones.get(ARM.right.hand)).distanceTo(wpos(rig.bones.get(ARM.left.hand))) > 0.45) continue;
      const g = K.handsGap();
      if (g < deepHands.gap) deepHands = { gap: g, t };
    }
    deepHands.gap > -0.003
      ? ok(`кисти не проходят друг сквозь друга (ближе всего ${deepHands.gap === Infinity ? '— кисти далеко' : `${(deepHands.gap * 1000).toFixed(1)} мм @${deepHands.t.toFixed(2)} с`})`)
      : fail(`кисти проходят друг сквозь друга: ${(deepHands.gap * 1000).toFixed(1)} мм @${deepHands.t.toFixed(2)} с`);
  }
  for (const side of ['right', 'left']) {
    const c = minClear[side] * 100;
    if (c === Infinity) { ok(`${side === 'right' ? 'правая' : 'левая'} рука в покое`); continue; }
    c >= minTorso ? ok(`${side === 'right' ? 'правая' : 'левая'} кисть не касается корпуса: запас ${c.toFixed(1)} см (минимум @${minClearAt[side].toFixed(2)} с, ${minClearPt[side]})`)
      : fail(`${side === 'right' ? 'правая' : 'левая'} кисть у корпуса: ${c.toFixed(1)} см @${minClearAt[side].toFixed(2)} с (${minClearPt[side]}; допуск ${minTorso} см)`);
  }

  if (name === 'kak-pomoch') {
    const [h0, h1] = oldMap ? [0.34, 0.84] : [0.50, 0.77];
    const hold = contact.filter((c) => c.t >= h0 && c.t <= h1);
    const minGap = Math.min(...hold.map((c) => c.along)) * 1000, maxGap = Math.max(...hold.map((c) => c.along)) * 1000;
    const deepest = Math.min(...contact.map((c) => c.deepest)) * 1000;
    const deepAt = contact.reduce((a, c) => (c.deepest < a.deepest ? c : a)).t;
    console.log(`  касание ${h0.toFixed(2)}–${h1.toFixed(2)} с: кисти сходятся до ${minGap.toFixed(1)}…${maxGap.toFixed(1)} мм кожа к коже`);
    (minGap > -2 && maxGap < 8) ? ok('правая лежит на левой (кожа к коже 0–8 мм)') : fail('кисти не сходятся');
    deepest > -3 ? ok(`кисти нигде не проходят друг сквозь друга (ближе всего ${deepest.toFixed(1)} мм @${deepAt.toFixed(2)} с)`)
      : fail(`кисти проходят друг сквозь друга: ${deepest.toFixed(1)} мм @${deepAt.toFixed(2)} с`);
  }

  // ——— кисти в кадре против носителя: запястье, пясть, указательный, большой ———
  // Та же проекция, что у эталона (камера спереди на расстоянии D_CAM), те же
  // точки: запястье, основания среднего/указательного/большого, кончики.
  const at = (t) => samples[Math.min(samples.length - 1, Math.max(0, Math.round(t * HZ)))];
  /** Время записи → время жеста. */
  const toAv = (tr, ph) => {
    if (ph?.t0 !== undefined) return tr - ph.t0;
    if (!oldMap) return tr - refDef.t0;
    const { ref, avatar } = OLD_MAPS[name];
    if (tr <= ref[0]) return avatar[0];
    for (let i = 0; i < ref.length - 1; i++) if (tr <= ref[i + 1]) return avatar[i] + ((tr - ref[i]) / (ref[i + 1] - ref[i])) * (avatar[i + 1] - avatar[i]);
    return avatar[avatar.length - 1];
  };
  const angDiff = (a, b) => { let d = a - b; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
  console.log(`  кисти в кадре против носителя (${oldMap ? 'время — по старым границам фаз' : refDef.t0 !== undefined ? `время жеста = время записи − ${refDef.t0} с` : 'время жеста = время записи − t0 фазы'}; ширины плеч, углы в кадре):`);
  console.log('    фаза                  рука  | запястье Δ | пясть Δ° | указат. Δ° | большой Δ°');
  const bad = [];
  for (const ph of refDef.phases) {
    let compared = 0;
    for (const side of ['R', 'L']) {
      if (ph.skip.includes(side)) continue;
      const rows = (ph[side === 'R' ? 'right' : 'left'] ?? refDef[side === 'R' ? 'right' : 'left']).filter((r) => r[0] >= ph.from - 1e-6 && r[0] <= ph.to + 1e-6);
      if (!rows.length) continue;
      compared += rows.length;
      const acc = { w: [], m: [], i: [], t: [], face: [] };
      for (const r of rows) {
        const s = at(toAv(r[0], ph))[side];
        acc.w.push(Math.hypot(s.w[0] - r[1], s.w[1] - r[2]));
        if (showRows) {
          const a = (x) => (x === null ? '  — ' : String(Math.round(x)).padStart(4));
          console.log(`      ${r[0].toFixed(2)} → ${toAv(r[0], ph).toFixed(2)} с  запястье (${f2(s.w[0])},${f2(s.w[1])}) у носителя (${f2(r[1])},${f2(r[2])})  пясть ${a(s.meta)}/${a(r[3])}  указ. ${a(s.idx)}/${a(r[4])}  больш. ${a(s.thb)}/${a(r[5])}`);
        }
        if (ph.face || ph.body) {
          applyFrame(rig, sampleGesture(gesture, toAv(r[0], ph)));
          const sd = side === 'R' ? 'right' : 'left';
          acc.face.push((ph.face ? K.faceGap(sd) : K.bodyGap(sd)) * 1000);
        }
        if (r[3] !== null) acc.m.push(angDiff(s.meta, r[3]));
        if (r[4] !== null) acc.i.push(angDiff(s.idx, r[4]));
        if (r[5] !== null) acc.t.push(angDiff(s.thb, r[5]));
      }
      const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
      const mabs = (a) => (a.length ? mean(a.map(Math.abs)) : null);
      const fmt = (a, unit) => (a.length ? `${mean(a) >= 0 ? '+' : ''}${mean(a).toFixed(0)}${unit} (|${mabs(a).toFixed(0)}|)` : '—').padEnd(11);
      const w = mean(acc.w);
      const faceTxt = ph.face || ph.body ? `  кожа к ${ph.face ? 'лицу' : 'груди'} ${Math.min(...acc.face).toFixed(1)}…${Math.max(...acc.face).toFixed(1)} мм` : '';
      console.log(`    ${ph.name.padEnd(21)} ${side === 'R' ? 'прав' : 'лев '}  | ${(w.toFixed(2) + (ph.face || ph.body ? '*' : ph.fromContact ? '†' : '')).padEnd(10)} | ${fmt(acc.m, '°')}| ${fmt(acc.i, '°')}| ${fmt(acc.t, '°')}${faceTxt}`);
      if (ph.face || ph.body) {
        // у лица и груди кисть стоит по телу Елнара — сверяется касание, а не запястье от плеч (*)
        if (Math.min(...acc.face) < -1 || Math.max(...acc.face) > 8) bad.push(`${ph.name}: кисть не касается ${ph.face ? 'лица' : 'груди'} (${Math.min(...acc.face).toFixed(1)}…${Math.max(...acc.face).toFixed(1)} мм)`);
      } else if (w > 0.1 && !ph.fromContact) bad.push(`${ph.name}, ${side === 'R' ? 'правое' : 'левое'} запястье в ${w.toFixed(2)} ширины плеч от носителя`);
      for (const [k, name] of [['m', 'пясть'], ['i', 'указательный'], ['t', 'большой']]) {
        const e = mabs(acc[k]);
        if (e !== null && e > 25) bad.push(`${ph.name}, ${side === 'R' ? 'правая' : 'левая'}: ${name} расходится с носителем на ${e.toFixed(0)}°`);
      }
    }
    // фаза без единого ряда эталона не сверялась — это не «прошла», а «не проверена»
    if (!compared) bad.push(`${ph.name}: нет рядов эталона — фаза не сверялась`);
  }
  bad.length ? bad.forEach((b) => fail(b)) : ok('в фазах знака кисти там же и так же, как у носителя: запястья ≤ 0.10 ширины плеч, пясть, указательный и большой ≤ 25° (в среднем по фазе)');
}
applyFrame(rig, {});
console.log(allOk ? '\nИТОГ: техника в порядке, кисти там же и так же, как у носителей' : '\nИТОГ: есть расхождения — см. ✗');
process.exit(allOk ? 0 : 1);

/**
 * Черновой замер (dev): где в кадре «как в записи» запястье и кончики пальцев жеста в моменты t.
 *   node scripts/probe-2d.mjs <жест> t1 t2 …
 * Кадр — ширины плеч от середины плеч, перспектива D = 2 м (как в author-phrases и check-phrases).
 */
import fs from 'node:fs';
import { loadRig, applyFrame, sampleGesture, wpos, ARM } from './lib/rig.mjs';
import { createKit } from './lib/signKit.mjs';
const D_CAM = 2.0;
const rig = loadRig('public/avatar_elnar.glb');
const K = createKit(rig);
const to2 = (p) => { const q = K.toRef(p); const m = D_CAM / (D_CAM - q.z * K.SW); return [q.x * m, q.y * m]; };
const f2 = (p) => to2(p).map((x) => x.toFixed(2)).join(',');
const [name, ...ts] = process.argv.slice(2);
const g = JSON.parse(fs.readFileSync(`public/gestures/${name}.json`));
for (const t of ts.map(Number)) {
  applyFrame(rig, sampleGesture(g, t));
  const out = [];
  for (const side of ['right', 'left']) {
    const p = K.handPoints(side);
    out.push(`${side === 'right' ? 'П' : 'Л'}: запястье (${f2(p.wrist)}) указ (${f2(p.index)}) сред (${f2(p.middle)}) большой (${f2(p.thumb)}) локоть (${f2(wpos(rig.bones.get(ARM[side].fore)))})`);
  }
  console.log(`t=${t}  ${out.join(' | ')}`);
}

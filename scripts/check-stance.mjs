/**
 * Куда applyNaturalStance реально уводит руки.
 *
 *   node scripts/check-stance.mjs
 *
 * Стойка покоя задана одной строкой в avatarLoader.ts: кости плеча `i` и `13`
 * поворачиваются на STANCE_ARM_X радиан по локальной оси X. Больше ничего не
 * трогается — ни ключица, ни предплечье.
 *
 * Проверяем три вещи, каждая из которых видна на экране как «аватар сломан»:
 *   1. КУДА показывает рука: вниз вдоль тела, вперёд или в сторону.
 *      У кости рук локальная +Y идёт вдоль кости, поэтому поворот вокруг X
 *      уводит руку ВПЕРЁД, а не вниз — если это так, цифры покажут.
 *   2. Насколько руки разведены в стороны — расстояние между запястьями в
 *      долях ширины плеч. У человека в покое примерно 1.1–1.3.
 *   3. Не влезает ли плечевая кость внутрь корпуса — оттуда берётся раздутие
 *      дельты и слипание рукава с телом.
 */
import * as THREE from 'three';
import { loadSkeleton } from './lib/solver-harness.mjs';

const STANCE_ARM_X = 1.25;

const B = {
  rShoulder: 'j', rArm: 'i', rFore: 'h', rHand: 'g',
  lShoulder: '14', lArm: '13', lFore: '12', lHand: 'z',
};

function world(bones, name) {
  const b = bones.get(name);
  if (!b) throw new Error(`нет кости ${name}`);
  return b.getWorldPosition(new THREE.Vector3());
}

function report(bones, label) {
  bones.get('mixamorigHips')?.updateMatrixWorld(true);
  const root = bones.values().next().value;
  let top = root;
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);

  const rS = world(bones, B.rShoulder);
  const rA = world(bones, B.rArm);
  const rH = world(bones, B.rHand);
  const lA = world(bones, B.lArm);
  const lH = world(bones, B.lHand);

  const shoulderWidth = rA.distanceTo(lA);
  const armVec = rH.clone().sub(rA);
  const len = armVec.length();
  const dir = armVec.clone().normalize();

  // Углы направления руки: 0° вниз = рука висит вдоль тела
  const down = new THREE.Vector3(0, -1, 0);
  const fromDown = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(dir.dot(down), -1, 1)));
  // разложение: сколько ушло вперёд (z) и сколько вбок (x)
  const forward = THREE.MathUtils.radToDeg(Math.atan2(dir.z, -dir.y));
  const sideways = THREE.MathUtils.radToDeg(Math.atan2(dir.x, -dir.y));

  console.log(`\n=== ${label} ===`);
  console.log(`  ширина плеч                 ${shoulderWidth.toFixed(3)} м`);
  console.log(`  длина руки                  ${len.toFixed(3)} м (${(len / shoulderWidth).toFixed(2)} ширины плеч)`);
  console.log(`  отклонение руки от «вниз»   ${fromDown.toFixed(1)}°`);
  console.log(`    из них вперёд             ${forward.toFixed(1)}°`);
  console.log(`    из них вбок               ${sideways.toFixed(1)}°`);
  console.log(`  зазор между запястьями      ${(rH.distanceTo(lH) / shoulderWidth).toFixed(2)} ширины плеч`);
  console.log(`  плечевая кость выше кисти   ${(rA.y - rH.y).toFixed(3)} м`);
  return { fromDown, forward, sideways, gap: rH.distanceTo(lH) / shoulderWidth };
}

const { bones } = await loadSkeleton();

const before = report(bones, 'bind-поза (как в GLB, T-поза)');

bones.get(B.rArm).rotation.x += STANCE_ARM_X;
bones.get(B.lArm).rotation.x += STANCE_ARM_X;
const after = report(bones, `applyNaturalStance (+${STANCE_ARM_X} рад по X)`);

console.log('\n=== вывод ===');
if (after.fromDown > 25) {
  console.log(`  ПЛОХО: рука отклонена от вертикали на ${after.fromDown.toFixed(0)}° — она не висит вдоль тела.`);
} else {
  console.log(`  рука висит близко к вертикали (${after.fromDown.toFixed(0)}°)`);
}
if (Math.abs(after.forward) > 20) {
  console.log(`  ПЛОХО: ${after.forward.toFixed(0)}° ушло ВПЕРЁД — поворот по X уводит руку не туда, куда нужно.`);
}
if (after.gap > 1.6) {
  console.log(`  ПЛОХО: запястья разведены на ${after.gap.toFixed(2)} ширины плеч (у человека в покое ~1.1–1.3).`);
}

// Сколько нужно, чтобы рука встала вертикально: подбираем перебором
let best = { err: Infinity, ang: 0, axis: 'x' };
for (const axis of ['x', 'y', 'z']) {
  for (let a = -2.2; a <= 2.2; a += 0.01) {
    bones.get(B.rArm).rotation.set(0, 0, 0);
    bones.get(B.rArm).rotation[axis] = a;
    let top = bones.get(B.rArm);
    while (top.parent) top = top.parent;
    top.updateMatrixWorld(true);
    const v = world(bones, B.rHand).sub(world(bones, B.rArm)).normalize();
    const err = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(v.dot(new THREE.Vector3(0, -1, 0)), -1, 1)));
    if (err < best.err) best = { err, ang: a, axis };
  }
}
console.log(`\n  лучшая одиночная ось для «руки вниз»: ${best.axis} = ${best.ang.toFixed(2)} рад, остаточное отклонение ${best.err.toFixed(1)}°`);

// ——— подбор: как меняется картина с углом ———
console.log('\n=== угол стойки против разведённости рук ===');
console.log(`  ${'угол'.padStart(6)} | ${'от вертикали'.padStart(13)} | ${'зазор запястий'.padStart(15)}`);
for (const a of [1.25, 1.35, 1.45, 1.52, 1.6, 1.7]) {
  for (const [n, s] of [[B.rArm, 1], [B.lArm, 1]]) bones.get(n).rotation.set(0, 0, 0);
  bones.get(B.rArm).rotation.x = a;
  bones.get(B.lArm).rotation.x = a;
  let top = bones.get(B.rArm); while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
  const rA = world(bones, B.rArm), rH = world(bones, B.rHand), lA = world(bones, B.lArm), lH = world(bones, B.lHand);
  const dir = rH.clone().sub(rA).normalize();
  const fromDown = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(dir.dot(new THREE.Vector3(0,-1,0)), -1, 1)));
  const gap = rH.distanceTo(lH) / rA.distanceTo(lA);
  const mark = a === 1.25 ? '  <- сейчас' : (Math.abs(fromDown) < 3 ? '  <- прямо вниз' : '');
  console.log(`  ${a.toFixed(2).padStart(6)} | ${fromDown.toFixed(1).padStart(12)}° | ${gap.toFixed(2).padStart(15)}${mark}`);
}

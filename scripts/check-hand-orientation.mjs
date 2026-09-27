/**
 * Проверка ориентации кисти в решателе: не вывернута ли ладонь.
 *
 *   node scripts/check-hand-orientation.mjs
 *
 * После solvePose локальная +Z кости кисти должна совпасть с наружной нормалью
 * ладони человека, посчитанной из лэндмарков НЕЗАВИСИМО от решателя.
 *
 * Хиральность сверена с bind-позой avatar.glb: там ладони смотрят вниз (большой
 * палец вперёд), локальная +Z костей кисти и предплечья — тоже вниз, значит +Z
 * это наружная нормаль. Отсюда:
 *   левая  кисть: наружу = (мизинец - запястье) x (указательный - запястье)
 *   правая кисть: наружу = (указательный - запястье) x (мизинец - запястье)
 *
 * Ошибка около 2° — норма: доворот выравнивает лишь проекцию нормали на
 * плоскость, перпендикулярную кости. Ошибка около 180° означает, что кисть
 * крутанули вокруг своей оси: пальцы будут нацелены верно, но их основания
 * окажутся с другой стороны — кулак выглядит вывернутым, а разведённые пальцы
 * скрещиваются.
 */
import * as THREE from 'three';
import {
  loadSolver, loadSkeleton, frames, bodyFrame, handAlive,
  deg, median, worldAxis, SIDES,
} from './lib/solver-harness.mjs';

/** Порог провала: больше — ладонь смотрит не туда. */
const MAX_ERROR_DEG = 20;
const HANDS_PER_MODE = 600;

const { solvePose, ARM_BONES, FINGER_BONES } = await loadSolver();
const { bones } = loadSkeleton();

/** Наружная нормаль ладони человека в осях тела — мимо решателя. */
function expectedPalmNormal(bf, side) {
  const wrist = bf.hand(side, 0);
  const toIndex = bf.hand(side, 5).sub(wrist);
  const toPinky = bf.hand(side, 17).sub(wrist);
  return (side === 'left'
    ? toPinky.clone().cross(toIndex)
    : toIndex.clone().cross(toPinky)).normalize();
}

let failed = false;
for (const mirrored of [false, true]) {
  const palmErr = { left: [], right: [] };
  const fingerErr = [];
  for (const frame of frames({ mirrored, limit: HANDS_PER_MODE })) {
    const visibility = new Float32Array(33).fill(1);
    if (!solvePose(frame, bones, { mirrored, visibility })) continue;
    const bf = bodyFrame(frame, mirrored);
    for (const side of SIDES) {
      if (!handAlive(frame, side)) continue;
      palmErr[side].push(deg(
        worldAxis(bones.get(ARM_BONES[side].hand), new THREE.Vector3(0, 0, 1)),
        expectedPalmNormal(bf, side),
      ));
      // Контроль плумбинга: указательный смотрит точно по лэндмаркам.
      fingerErr.push(deg(
        worldAxis(bones.get(FINGER_BONES[side].index[0]), new THREE.Vector3(0, 1, 0)),
        bf.hand(side, 6).sub(bf.hand(side, 5)).normalize(),
      ));
    }
  }

  const label = mirrored ? 'зеркальный кадр' : 'прямой кадр';
  for (const side of SIDES) {
    const errs = palmErr[side];
    const med = median(errs);
    const bad = !(med <= MAX_ERROR_DEG);
    if (bad) failed = true;
    console.log(
      `${bad ? 'ПРОВАЛ' : '  ок  '} ${label}, ${side}: кистей ${errs.length}, ` +
      `нормаль ладони — медиана ${med.toFixed(1)}°, ` +
      `вывернутых ${(100 * errs.filter((v) => v > 90).length / errs.length).toFixed(1)}%`,
    );
  }
  const fmed = median(fingerErr);
  if (!(fmed <= 1)) failed = true;
  console.log(`         ${label}: указательный палец — медиана ${fmed.toFixed(2)}°`);
}

process.exit(failed ? 1 : 0);

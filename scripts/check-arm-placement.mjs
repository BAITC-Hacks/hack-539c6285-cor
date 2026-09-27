/**
 * Проверка, куда решатель ставит кисти аватара.
 *
 *   node scripts/check-arm-placement.mjs
 *
 * Пропорции у аватара и у человека разные: рука аватара длиннее ширины плеч в
 * 1.85 раза, у человека — в 1.27. Если копировать углы костей, кисть улетает
 * дальше настоящей, и жесты с контактом ломаются: на «ладони вместе» обе руки
 * проскакивают среднюю линию и кисти въезжают друг в друга.
 *
 * Поэтому руки решаются IK по точке. Здесь это и меряется — в долях ширины
 * плеч, чтобы цифры не зависели от роста:
 *
 *  1. Согнутая рука (рабочая зона жеста) — запястье должно попадать в точку.
 *  2. Почти прямая рука — попадание намеренно уступает прямому локтю, иначе
 *     висящая вдоль тела рука стояла бы с локтем, согнутым под 80°.
 *  3. Кадры, где человек свёл кисти: зазор у аватара должен повторять
 *     человеческий, а не схлопываться в кашу.
 */
import * as THREE from 'three';
import {
  loadSolver, loadSkeleton, frames, bodyFrame, median, percentile, SIDES,
} from './lib/solver-harness.mjs';

/** Ниже этой доли вытянутости решатель обязан попадать в точку. */
const BENT_BELOW = 0.85;
/** Порог провала для согнутой руки, в долях ширины плеч. */
const MAX_WRIST_ERROR = 0.12;
/** Человек считается сведшим кисти, если зазор меньше этого. */
const HANDS_TOGETHER = 0.35;
/** Ближе этого кисти аватара уже пересекаются. */
const COLLISION_GAP = 0.1;

const { solvePose, ARM_BONES } = await loadSolver();
const { root, bones, worldPos } = loadSkeleton();

const POSE = {
  left: { shoulder: 11, elbow: 13, wrist: 15 },
  right: { shoulder: 12, elbow: 14, wrist: 16 },
};

// Мерки аватара — от них считается всё остальное.
const shL = worldPos(ARM_BONES.left.arm), shR = worldPos(ARM_BONES.right.arm);
const shoulderWidth = shL.distanceTo(shR);
const shoulderMid = shL.clone().add(shR).multiplyScalar(0.5);
const rigReach = worldPos(ARM_BONES.left.arm).distanceTo(worldPos(ARM_BONES.left.foreArm))
  + worldPos(ARM_BONES.left.foreArm).distanceTo(worldPos(ARM_BONES.left.hand));
console.log(`аватар: рука / ширина плеч = ${(rigReach / shoulderWidth).toFixed(2)}`);

const bent = [], straight = [], humanRatio = [];
const together = [];

for (const frame of frames({ step: 5, limit: 1200 })) {
  const visibility = new Float32Array(33).fill(1);
  if (!solvePose(frame, bones, { mirrored: false, visibility })) continue;
  root.updateMatrixWorld(true);
  const bf = bodyFrame(frame);

  const avatarWrist = {};
  const humanWrist = {};
  for (const side of SIDES) {
    const p = POSE[side];
    const sh = bf.pose(p.shoulder), el = bf.pose(p.elbow), wr = bf.pose(p.wrist);
    const reach = sh.distanceTo(el) + el.distanceTo(wr);
    if (reach < 1e-6) continue;
    humanRatio.push(reach);

    // Обе кисти в одних единицах: доли ширины плеч от центра плеч.
    const got = worldPos(ARM_BONES[side].hand).sub(shoulderMid).divideScalar(shoulderWidth);
    avatarWrist[side] = got;
    humanWrist[side] = wr;
    (sh.distanceTo(wr) / reach < BENT_BELOW ? bent : straight).push(got.distanceTo(wr));
  }

  if (avatarWrist.left && avatarWrist.right) {
    const humanGap = humanWrist.left.distanceTo(humanWrist.right);
    if (humanGap < HANDS_TOGETHER) {
      together.push({ humanGap, avatarGap: avatarWrist.left.distanceTo(avatarWrist.right) });
    }
  }
}

console.log(`человек: рука / ширина плеч = ${median(humanRatio).toFixed(2)} (медиана по ${humanRatio.length} рукам)`);

let failed = false;
const report = (ok, text) => { if (!ok) failed = true; console.log(`${ok ? '  ок  ' : 'ПРОВАЛ'} ${text}`); };

const bentMed = median(bent);
report(bentMed <= MAX_WRIST_ERROR,
  `согнутая рука (${bent.length} шт): промах запястья — медиана ${bentMed.toFixed(2)}, ` +
  `90-й процентиль ${percentile(bent, 0.9).toFixed(2)} ширины плеч`);
console.log(`         почти прямая рука (${straight.length} шт): промах ${median(straight).toFixed(2)} — ` +
  `так и задумано, взамен локоть остаётся прямым`);

if (together.length) {
  const spread = together.filter((p) => p.avatarGap > p.humanGap + 0.15).length;
  const collide = together.filter((p) => p.avatarGap < COLLISION_GAP).length;
  report(collide === 0 && spread === 0,
    `кисти сведены (${together.length} кадров): зазор у человека ${median(together.map((p) => p.humanGap)).toFixed(2)}, ` +
    `у аватара ${median(together.map((p) => p.avatarGap)).toFixed(2)}; ` +
    `пересеклись в ${collide}, разъехались в ${spread}`);
} else {
  console.log('         кадров со сведёнными кистями не нашлось — проверка пропущена');
}

process.exit(failed ? 1 : 0);

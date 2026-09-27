/**
 * Жест ПРИВЕТ (РЖЯ) для аватара — строится по цели, а не подбором углов.
 *
 *   node scripts/author-privet.mjs [--out public/gestures/privet.json]
 *   node scripts/check-privet.mjs           — сверка результата с эталоном
 *
 * Эталон — 20 клипов «Привет!» из SLOVO от 14 разных людей
 * (ml/landmarks_holistic). Что у них совпадает (медианы; расстояния — в
 * ширинах плеч от середины плеч, углы — в плоскости ладони):
 *   - одна рука (правая у правши), вторая висит;
 *   - кисть «ладонь»: пальцы прямые и почти сомкнуты (веер указательный–мизинец
 *     12°), большой вдоль указательного (17°);
 *   - ладонь к собеседнику — у всех 20 из 20;
 *   - пальцы вверх, наклон к середине тела ~5°;
 *   - запястье на уровне плеча (y −0.03), чуть снаружи плеча (x −0.59), перед
 *     телом; кончики пальцев чуть ниже носа (кончик −0.08 от носа);
 *   - движение: быстрое покачивание кисти из стороны в сторону, 2.4–3.3 Гц,
 *     наклон ±13°, запястье ходит на ±3 см.
 *
 * Геометрия задаётся в мире рига (avatar_elnar.glb, база жестов), углы
 * костей решает IK (scripts/lib/armIK.mjs). Результат — обычный GestureJSON:
 * дельты Эйлера XYZ против базы, как у всех жестов приложения.
 */
import fs from 'node:fs';
import path from 'node:path';
import { THREE, loadRig, applyFrame, wpos, wquat, ARM, ROOT, STANCE_ARM_X, IDLE_ARM_X, JSON_NAME } from './lib/rig.mjs';
import { solveRightArm, handFrame, frameFromLocals, unwrapFrames } from './lib/armIK.mjs';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rad = THREE.MathUtils.degToRad;

// ——— параметры жеста ———
const FPS = 30;
const T_RISE = 0.45;     // подъём руки
const WAVE_HZ = 3.0;     // частота покачивания (у людей 2.2–3.9, медиана 3.0)
const WAVE_CYCLES = 3;
const T_SETTLE = 0.12;   // короткая остановка в центре
const T_FALL = 0.45;     // возврат в покой
const TILT_DEG = 14;     // наклон кисти в покачивании (у людей ±6–22°, медиана ±14°)
const SWAY_M = 0.032;    // ход запястья в покачивании (у людей ±0.05–0.14 ширины плеч)

const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const OUT = path.resolve(ROOT, outArg >= 0 ? args[outArg + 1] : 'public/gestures/privet.json');

const rig = loadRig('public/avatar_elnar.glb');
const R = ARM.right;
const S = wpos(rig.bones.get(R.arm));

// Центр жеста: запястье перед плечом, чуть ниже его (кончики пальцев — у носа)
const WRIST = S.clone().add(V(-0.035, -0.025, 0.26));
const POLE_UP = V(-0.4, -1, -0.5);  // в позе «привет» локоть вниз и чуть наружу
const FINGERS_TILT = rad(5);        // пальцы к середине тела
const PALM_IN = rad(12);            // ладонь чуть к середине, как у носителей
// Большой палец: в покое рига он отведён на ~40° — приводим к указательному
const THUMB_ADDUCT = rad(16);       // в плоскости ладони
const THUMB_FLATTEN = rad(10);      // из-перед ладони — к её плоскости

const restQ = (bone) => new THREE.Quaternion().setFromEuler(rig.rest.get(bone));

/** Расслабленная «ладонь»: пальцы прямые с лёгким сгибом, сомкнуты. */
function handShape(k = 1) {
  // Сгиб фаланги — поворот вокруг её локальной +X (к ладони, см. armIK.mjs)
  const bend = (bone, deg) => restQ(bone).multiply(
    new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), rad(deg * k)));
  // Лёгкий веер: у живой «ладони» пальцы не строго параллельны (у людей
  // указательный ∠ мизинец ~13°). Разведение — поворот вокруг локальной +Z:
  // плюс уводит палец от большого, минус — к нему.
  const FAN = { index: -3, middle: 0, ring: 3, pinky: 7 };
  const out = {};
  for (const f of ['index', 'middle', 'ring', 'pinky']) {
    const [b1, b2, b3] = R[f];
    out[b1] = bend(b1, 4).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), rad(FAN[f] * k)));
    out[b2] = bend(b2, 6);
    out[b3] = bend(b3, 4);
  }
  // Большой палец поворачиваем в осях кисти (родителя): к указательному и к ладони
  const inHand = new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), THUMB_ADDUCT * k)
    .multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -THUMB_FLATTEN * k));
  out[R.thumb[0]] = inHand.multiply(restQ(R.thumb[0]));
  return out;
}

/** Ориентация кисти «привет»: пальцы вверх, ладонь к собеседнику; tilt — покачивание. */
const helloHand = (tilt = 0) => handFrame(
  V(Math.sin(FINGERS_TILT + tilt), Math.cos(FINGERS_TILT + tilt), 0),
  V(Math.sin(PALM_IN), 0, Math.cos(PALM_IN)),
);

/** Покой (как у плеера в простое): правая рука висит, кисть прямая. */
function idlePose() {
  const out = {};
  for (const n of [R.arm, R.fore, R.hand, R.thumb[0], ...R.index, ...R.middle, ...R.ring, ...R.pinky]) {
    const e = rig.rest.get(n).clone();
    if (n === R.arm) e.x += IDLE_ARM_X - STANCE_ARM_X;
    out[n] = new THREE.Quaternion().setFromEuler(e);
  }
  return out;
}

/** Где запястье и как повёрнута кисть в покое — старт дуги подъёма. */
function idleTargets(idle) {
  applyFrame(rig, frameFromLocals(rig, idle));
  const bArm = rig.bones.get(R.arm);
  const out = {
    wrist: wpos(rig.bones.get(R.hand)),
    hand: wquat(rig.bones.get(R.hand)),
    // локоть прямой руки смотрит назад: против оси сгиба (+X плеча)
    pole: V(1, 0, 0).applyQuaternion(wquat(bArm)).negate(),
  };
  applyFrame(rig, {});
  return out;
}

const idle = idlePose();
const I = idleTargets(idle);

/** Точка на дуге подъёма: сначала вперёд, потом вверх — как поднимают кисть. */
function risePath(k) {
  const C = V(
    I.wrist.x + 0.6 * (WRIST.x - I.wrist.x),
    I.wrist.y + 0.3 * (WRIST.y - I.wrist.y),
    WRIST.z + 0.05,
  );
  const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
  return I.wrist.clone().multiplyScalar(a).add(C.clone().multiplyScalar(b)).add(WRIST.clone().multiplyScalar(c));
}

/** Поза на дуге подъёма, k ∈ [0, 1]: 0 — покой, 1 — центр «привет». */
function risePose(k) {
  const pole = I.pole.clone().lerp(POLE_UP, k).normalize();
  const wrist = risePath(k);
  // Сначала кисть продолжает предплечье (запястье прямое), потом ладонь
  // плавно разворачивается к собеседнику — так руку поднимают люди.
  const neutral = solveRightArm(rig, { wrist, pole, hand: I.hand, foreTwist: 0 }).neutralHand;
  const kh = THREE.MathUtils.smoothstep(k, 0.05, 0.95);
  const hand = neutral.slerp(helloHand(0), kh);
  const sol = solveRightArm(rig, { wrist, pole, hand, foreTwist: 0.6 });
  return { ...sol.local, ...handShape(kh) };
}

/** Покачивание: phase — доля цикла, amp ∈ [0, 1]. */
function wavePose(phase, amp) {
  const s = Math.sin(2 * Math.PI * phase) * amp;
  const wrist = WRIST.clone().add(V(SWAY_M * s, 0, 0));
  const sol = solveRightArm(rig, { wrist, pole: POLE_UP, hand: helloHand(rad(TILT_DEG) * s), foreTwist: 0.6 });
  return { ...sol.local, ...handShape(1) };
}

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

// ——— раскадровка ———
const T_WAVE = WAVE_CYCLES / WAVE_HZ;
const T_END = T_RISE + T_WAVE + T_SETTLE + T_FALL;
const frames = [];
const nFrames = Math.round(T_END * FPS);
for (let fi = 0; fi <= nFrames; fi++) {
  const t = fi / FPS;
  let pose;
  if (fi === 0 || fi === nFrames) {
    pose = idle;
  } else if (t <= T_RISE) {
    pose = risePose(ease(t / T_RISE));
  } else if (t <= T_RISE + T_WAVE) {
    const tw = t - T_RISE;
    // амплитуда нарастает и гаснет за четверть цикла — без рывка на входе и выходе
    const ramp = Math.min(1, tw * WAVE_HZ * 4, (T_WAVE - tw) * WAVE_HZ * 4);
    pose = wavePose(tw * WAVE_HZ, ramp);
  } else if (t <= T_RISE + T_WAVE + T_SETTLE) {
    pose = risePose(1);
  } else {
    pose = risePose(ease(1 - (t - T_RISE - T_WAVE - T_SETTLE) / T_FALL));
  }
  const bones = frameFromLocals(rig, pose);
  // Левая рука стоит в позе покоя, а не в базе: иначе на время жеста она
  // отъезжает на 11° наружу (база 1.25 рад против покоя 1.45).
  bones[JSON_NAME[ARM.left.arm]] = [IDLE_ARM_X - STANCE_ARM_X, 0, 0];
  frames.push({ t: +t.toFixed(4), bones });
}
unwrapFrames(frames);
for (const f of frames) for (const k of Object.keys(f.bones)) f.bones[k] = f.bones[k].map((x) => +x.toFixed(5));

const gesture = {
  name: 'privet',
  rotation_order: 'XYZ',
  unit: 'radians',
  fps_target: FPS,
  description:
    'РЖЯ ПРИВЕТ: правая «ладонь» (пальцы прямые, сомкнуты) поднята к плечу, ладонь к собеседнику, ' +
    'пальцы вверх, кончики у носа; быстрое покачивание кисти из стороны в сторону (3 раза). ' +
    'Эталон — 20 клипов «Привет!» SLOVO от 14 людей; поза решена IK на avatar_elnar.glb (scripts/author-privet.mjs).',
  frames,
};
fs.writeFileSync(OUT, JSON.stringify(gesture) + '\n');
console.log(`записано ${path.relative(ROOT, OUT)}: ${frames.length} кадров, ${T_END.toFixed(2)} с`);

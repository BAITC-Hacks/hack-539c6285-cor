/**
 * Фразы РЖЯ «Как дела?» и «Как я могу помочь?» для Елнара — по записям носителей.
 *
 *   node scripts/author-phrases.mjs          — пишет public/gestures/kak-dela.json, kak-pomoch.json
 *   node scripts/check-phrases.mjs           — сверка с эталоном и техника
 *   /gesture-compare.html?g=kak-dela&vid=6155&off=1.2    — кадр в кадр с записью (dev)
 *
 * ЭТАЛОН — словарь SpreadTheSign, русский жестовый язык (RU), одна запись на фразу:
 *   «Как дела?»               — spreadthesign.com/ru.ru/sentence/621   (видео 6155)
 *   «Чем я могу вам помочь?» — spreadthesign.com/ru.ru/sentence/10070 (видео 105605)
 * Разметка — MediaPipe (Pose + HandLandmarker с трекингом) по каждому кадру 25/с,
 * кисти — на увеличенном вчетверо участке кадра; спорное сверено наложением
 * разметки на кадры. Числа — в кадре, в ширинах плеч от середины плеч (x — к
 * ЛЕВОЙ руке носителя, y — вверх); см. scripts/lib/phraseRefs.mjs.
 *
 * ВРЕМЯ. Ключи стоят в те же моменты, что у носителя: время жеста = время
 * записи − T0 (у каждой фразы свой T0), поэтому жест идёт в темпе носителя, а
 * сверка кадр в кадр — простым сдвигом.
 *
 * ЧТО ПОКАЗЫВАЮТ НОСИТЕЛИ (аудит 2026-09-24, всё — по кадрам и разметке).
 *   «Как дела?» = КАК + ДЕЛА.
 *     КАК (1.50–2.06 с): правая кисть у груди перед правым плечом, пальцы вверх,
 *     ладонь к середине тела и чуть к зрителю. Выпрямлены указательный и средний
 *     (средний прижат к указательному и спереди почти не виден), большой поднят
 *     вдоль указательного — между ними 20–28°; безымянный и мизинец согнуты.
 *     Один раз кисть сжимается в кулак с поднятым большим пальцем (1.66–1.78 с) и
 *     снова раскрывается.
 *     ДЕЛА (2.26–2.70 с): обе кисти с растопыренными пальцами у нижней части груди
 *     ладонями вниз, пальцы вперёд и к середине; кисти опускаются к поясу и
 *     «падают» в запястье — пальцы смотрят вниз, тыл кисти к зрителю, большие
 *     пальцы друг к другу. Ладонями вверх кисти НЕ разворачиваются.
 *   «Чем я могу вам помочь?» — один знак ПОМОЧЬ, без отдельных Я, МОЧЬ, ЧЕМ:
 *     правая — плоская ладонь, четыре пальца прямые и сомкнутые, большой отведён
 *     (~70° от указательного); тыл к зрителю, ладонь к груди; пальцы смотрят к
 *     середине тела и вверх (в кадре 50–65° над горизонталью, пока кисть над
 *     левой, и 30–40° на левой), большой — вверх и наружу. Правая ставится ребром
 *     мизинца на пальцы левой. Левая — ладонью вверх, пальцы прямые и сомкнутые,
 *     вперёд и к середине тела, большой отставлен наружу и чуть вверх. Перед
 *     концом пальцы правой ложатся почти горизонтально, затем обе кисти
 *     разворачиваются ладонями вверх и сразу опускаются.
 *     Корпус и голова: наклон к левому плечу и вниз во время знака, в конце
 *     подбородок вверх — вопрос.
 *   Фразу пользователя «Как я могу помочь?» показываем так же — по смыслу это
 *   та же фраза, а носители её показывают именно так.
 */
import fs from 'node:fs';
import path from 'node:path';
import { THREE, loadRig, applyFrame, ROOT, ARM, wpos } from './lib/rig.mjs';
import { unwrapFrames } from './lib/armIK.mjs';
import { createKit, shape, mixShape, SHAPES, ease, smoothstep, V, rad, mirV } from './lib/signKit.mjs';
import { readMeshPositions } from './lib/glbMesh.mjs';
import { WORD_SLICES, wordShift } from './lib/wordSlices.mjs';

const FPS = 30;
const AVATAR = 'public/avatar_elnar.glb';
const rig = loadRig(AVATAR);
const K = createKit(rig);
// Лицо для знаков у лица: вершины головы и точки прицеливания (bind-поза, мир;
// замерены по мешу: лоб над внешним концом правой брови, середина подбородка)
K.setFaceMesh(readMeshPositions(AVATAR, 'Qyran_Body'), {
  'лоб справа': V(-0.055, 1.715, 0.132),
  'подбородок': V(0, 1.548, 0.152),
  'губы': V(0, 1.585, 0.161),
  'угол рта справа': V(-0.022, 1.578, 0.155),
  'щека справа': V(-0.055, 1.60, 0.140),
  'щека слева': V(0.055, 1.60, 0.140),
  // ЗАВТРА: сбоку лица, у челюсти под скулой (по мешу: край лица на этой высоте x −0.066 при z 0.10)
  'сбоку щеки справа': V(-0.066, 1.58, 0.10),
  // ПЛОХО: под кончиком носа (кончик по мешу — (0, 1.612, 0.166))
  'нос': V(0, 1.606, 0.166),
  // ПЛОХО (пересборка 26.09): кончик носа справа (по мешу кончик (0, 1.61, 0.166), крыло на x −0.02 — z 0.152–0.157)
  'нос справа': V(-0.007, 1.611, 0.163),
  // ГЛУХОЙ: сбоку лица перед ухом на высоте носа (по мешу: x −0.067 → z 0.116, x −0.072 → z 0.082)
  'щека у уха справа': V(-0.069, 1.61, 0.10),
  // ПАПА: середина лба над бровями и низ подбородка (по мешу: лоб z 0.148–0.152, низ подбородка y 1.525)
  'лоб середина': V(-0.02, 1.705, 0.149),
  'под подбородком': V(0, 1.522, 0.10),
  // ПОНИМАТЬ: правый висок у наружного угла глаза (по мешу на высоте 1.66: x −0.068…−0.072, z 0.096…0.107)
  'висок справа': V(-0.070, 1.66, 0.10),
  // ГЛУХОЙ (пересборка 26.09): сбоку лица прямо перед ухом на высоте глаз (по мешу на 1.64: край лица x −0.075 при
  // z 0.07, ухо — x −0.089 при z 0.03…0.04)
  'перед ухом справа': V(-0.074, 1.632, 0.092),
});
// Грудь для касаний (одежда поверх тела; точки — на поверхности свитера)
K.setBodyMesh([...readMeshPositions(AVATAR, 'Qyran_Body'), ...readMeshPositions(AVATAR, 'Qyran_Outfit')], {
  // по носителям: кончик указательного в Я — у верха грудины (−0.15 ширины плеч от линии плеч),
  // середина ладони в ЛЮБИТЬ — чуть левее середины груди, на той же высоте
  'грудь': V(-0.03, 1.34, 0.143),
  'сердце': V(0.025, 1.33, 0.146),
  // ХОТЕТЬ: перед кулака — на левой стороне груди, у носительницы костяшки на (0.24…0.36, −0.17…−0.22)
  'грудь слева': V(0.08, 1.31, 0.156),
});

// ——— из кадра эталона в мир ———
// Кисть перед телом ближе к камере, поэтому в кадре её смещения от плеч
// увеличены в D/(D − z) раз; D — как у камеры сверки и переводчика.
export const D_CAM = 2.0;
/** Точка по положению в кадре эталона (x2, y2 — ширины плеч) и глубине z (ширины плеч вперёд от плеч). */
const P2 = (x2, y2, z) => {
  const m = D_CAM / (D_CAM - z * K.SW);
  return K.ref(x2 / m, y2 / m, z);
};
/** Мир → положение в кадре эталона. */
const to2 = (p) => {
  const q = K.toRef(p);
  const m = D_CAM / (D_CAM - q.z * K.SW);
  return [q.x * m, q.y * m];
};
const dir = (x, y, z) => V(x, y, z).normalize();
/** Направление по углу в кадре (° от горизонтали, 0 — к левой руке аватара) и выходу к зрителю (°). */
const dir2 = (deg2d, outDeg) => {
  const a = rad(deg2d), b = rad(outDeg);
  return V(Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), Math.sin(b));
};

// ——— рука по кадру: глубина запястья и локоть ———
// У носителя виден кадр, но не глубина. Глубину запястья и направление локтя
// подбираем так, чтобы в кадре локоть Елнара встал как можно ближе к локтю
// носителя, а запястье — ровно на место запястья носителя. Плечо у Елнара
// короче (0.68 ширины плеч, у носителей в кадре до локтя 0.8–0.95), поэтому
// «локоть внизу у бока» получается предельно низким, но не таким же.
const S_R = wpos(rig.bones.get(ARM.right.arm));
const L1 = wpos(rig.bones.get(ARM.right.fore)).distanceTo(S_R);
const L2 = wpos(rig.bones.get(ARM.right.hand)).distanceTo(wpos(rig.bones.get(ARM.right.fore)));
function fitArm(side, w2, e2, { zMin = 0.3, zMax = 1.0, zPref = 0.6, wPref = 0.15 } = {}) {
  const sx = side === 'right' ? 1 : -1; // левую решаем как отражённую правую
  const wx = w2[0] * sx, ex = e2[0] * sx;
  let best = null;
  for (let z = zMin; z <= zMax + 1e-9; z += 0.01) {
    const W = P2(wx, w2[1], z);
    const toW = W.clone().sub(S_R);
    const d = toW.length();
    if (d > L1 + L2 - 2e-3) continue;
    const a = toW.clone().normalize();
    const cosA = THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const C = S_R.clone().add(a.clone().multiplyScalar(L1 * cosA));
    const r = L1 * Math.sqrt(1 - cosA * cosA);
    const u = V(0, -1, 0).sub(a.clone().multiplyScalar(-a.y)).normalize();
    const v = new THREE.Vector3().crossVectors(a, u);
    for (let psi = -150; psi <= 150; psi += 3) {
      const E = C.clone().add(u.clone().multiplyScalar(r * Math.cos(rad(psi)))).add(v.clone().multiplyScalar(r * Math.sin(rad(psi))));
      if (K.toRef(E).z < -0.25) continue; // локоть не уходит за спину
      const [px, py] = to2(E);
      const err = Math.hypot(px - ex, py - e2[1]) + wPref * Math.abs(z - zPref);
      if (!best || err < best.err) best = { err, z, W, pole: E.clone().sub(C).normalize(), e2: [px * sx, py] };
    }
  }
  if (!best) throw new Error(`рука ${side} не дотягивается до (${w2})`);
  return side === 'right'
    ? { wrist: best.W, pole: best.pole, z: best.z, elbow2: best.e2 }
    : { wrist: mirV(best.W), pole: mirV(best.pole), z: best.z, elbow2: best.e2 };
}

// ——— формы кисти ———
// curl — сгиб трёх фаланг (°); spread — веер (плюс — от большого пальца);
// thumb: abd (плюс — к указательному), f1..f3 (плюс — к ладони). У Елнара
// пальцы в покое параллельны, но основания широко (23–30 мм), и между прямыми
// пальцами видны щели; «сомкнутые» — сведённые к среднему: spread 8/0/−7/−14.
const SH = {
  rest: SHAPES.rest,
  // КАК: указательный и средний прямые и вместе, безымянный и мизинец согнуты,
  // большой поднят вдоль указательного (~26° от него, у носителя 20–28°)
  kak3: shape({
    index: { curl: [0, 4, 2], spread: 3 }, middle: { curl: [6, 8, 4], spread: 0 },
    ring: { curl: [85, 100, 55], spread: -2 }, pinky: { curl: [85, 95, 55], spread: -4 },
    thumb: { abd: 0, f1: -20, f2: 0, f3: 0 },
  }),
  // КАК, сжатие: кулак, большой палец остаётся поднятым
  kakFist: shape({
    index: { curl: [72, 85, 45], spread: 3 }, middle: { curl: [74, 88, 45], spread: 0 },
    ring: { curl: [85, 100, 55], spread: -2 }, pinky: { curl: [85, 95, 55], spread: -4 },
    thumb: { abd: 8, f1: -20, f2: 0, f3: 0 },
  }),
  // ДЕЛА: пальцы растопырены и почти прямые, большой отставлен
  spread5: shape({
    index: { curl: [6, 8, 4], spread: -8 }, middle: { curl: [6, 8, 4], spread: -1 },
    ring: { curl: [8, 10, 5], spread: 7 }, pinky: { curl: [10, 12, 6], spread: 15 },
    thumb: { abd: -40, f1: -8, f2: 4, f3: 4 },
  }),
  // ПОМОЧЬ, правая: плоская ладонь, четыре пальца прямые и сомкнутые (лишь чуть
  // согнуты в основании), большой отведён в плоскости ладони (~72° от указательного)
  flatL: shape({
    index: { curl: [6, 4, 2], spread: 8 }, middle: { curl: [6, 4, 2], spread: 0 },
    ring: { curl: [7, 5, 3], spread: -7 }, pinky: { curl: [8, 6, 3], spread: -14 },
    thumb: { abd: -55, f1: -15, f2: 0, f3: 0 },
  }),
  // ПОМОЧЬ, правая над левой: то же, большой отведён меньше (у носителя в кадре 55–60° от пальцев)
  flatLhover: shape({
    index: { curl: [6, 4, 2], spread: 8 }, middle: { curl: [6, 4, 2], spread: 0 },
    ring: { curl: [7, 5, 3], spread: -7 }, pinky: { curl: [8, 6, 3], spread: -14 },
    thumb: { abd: -38, f1: -15, f2: 0, f3: 0 },
  }),
  // ПОМОЧЬ, левая: ладонь вверх, пальцы прямые и сомкнутые; большой отставлен
  // наружу и чуть вверх (у лежащей ладонью вверх кисти «к ладони», f1 > 0, — это вверх)
  flatUp: shape({
    index: { curl: [4, 5, 3], spread: 8 }, middle: { curl: [4, 5, 3], spread: 0 },
    ring: { curl: [5, 6, 3], spread: -7 }, pinky: { curl: [6, 7, 4], spread: -14 },
    thumb: { abd: -50, f1: 12, f2: 0, f3: 0 },
  }),
  // СПАСИБО: пальцы сжаты в кулак, большой вытянут вдоль кисти (у носителя ∠ к пясти 0–12°)
  fistThumb: shape({
    index: { curl: [85, 100, 55], spread: 3 }, middle: { curl: [88, 100, 55], spread: 0 },
    ring: { curl: [88, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: 25, f1: -18, f2: 8, f3: 5 },
  }),
  // Я: указательный вытянут, остальные сжаты, большой прижат к среднему
  point: shape({
    index: { curl: [20, 6, 3], spread: 2 }, middle: { curl: [85, 100, 55], spread: 0 },
    ring: { curl: [88, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: 25, f1: 25, f2: 20, f3: 10 },
  }),
  // Я: то же, указательный согнут в основании — смотрит в грудь
  pointIn: shape({
    index: { curl: [60, 8, 4], spread: 2 }, middle: { curl: [85, 100, 55], spread: 0 },
    ring: { curl: [88, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: 25, f1: 25, f2: 20, f3: 10 },
  }),
  // ЕСТЬ: пальцы сомкнуты и прямые, согнуты в основании — кончиками к нижней губе
  // (крупный план носительницы: тыл кисти к зрителю, длинные пальцы вверх к губе; большой за ними)
  bunch: shape({
    index: { curl: [40, 15, 6], spread: 8 }, middle: { curl: [40, 15, 6], spread: 0 },
    ring: { curl: [42, 15, 6], spread: -7 }, pinky: { curl: [44, 15, 6], spread: -14 },
    thumb: { abd: 10, f1: 15, f2: 0, f3: 0 },
  }),
  // ЛЮБИТЬ, у губ: плоская ладонь, пальцы вместе и чуть согнуты, большой в сторону
  flatBent: shape({
    index: { curl: [22, 12, 6], spread: 8 }, middle: { curl: [22, 12, 6], spread: 0 },
    ring: { curl: [24, 12, 6], spread: -7 }, pinky: { curl: [26, 12, 6], spread: -14 },
    thumb: { abd: -22, f1: -5, f2: 0, f3: 0 },
  }),
  // ЛЮБИТЬ, на сердце: ладонь плоская, пальцы вместе, большой вдоль
  flatHeart: shape({
    index: { curl: [12, 8, 4], spread: 8 }, middle: { curl: [12, 8, 4], spread: 0 },
    ring: { curl: [13, 8, 4], spread: -7 }, pinky: { curl: [14, 8, 4], spread: -14 },
    thumb: { abd: -15, f1: 0, f2: 0, f3: 0 },
  }),
  // МАМА у левой щеки: то же, большой прижат к ладони (у носительницы в кадре смотрит вверх и к
  // её левой руке, 49–63°, — через ладонь, а не наружу)
  flatThumbOutL: shape({
    index: { curl: [5, 5, 3], spread: 8 }, middle: { curl: [5, 5, 3], spread: 0 },
    ring: { curl: [6, 5, 3], spread: -7 }, pinky: { curl: [7, 5, 3], spread: -14 },
    thumb: { abd: 20, f1: 25, f2: 5, f3: 0 },
  }),
  // МАМА: плоская ладонь, пальцы вместе, большой вдоль
  flatClosed: shape({
    index: { curl: [5, 5, 3], spread: 8 }, middle: { curl: [5, 5, 3], spread: 0 },
    ring: { curl: [6, 5, 3], spread: -7 }, pinky: { curl: [7, 5, 3], spread: -14 },
    thumb: { abd: -10, f1: 0, f2: 0, f3: 0 },
  }),
  // КТО: указательный и средний прямые и сомкнуты вплотную, чуть согнуты в основании (у носителя их
  // кончики вместе, 9–17° к пясти); безымянный и мизинец согнуты в основании ~90° и не до кулака — торчат
  // к середине тела; большой поднят вдоль кисти, кончик — на уровне основания указательного, сбоку
  kto: shape({
    index: { curl: [10, 6, 3], spread: 8 }, middle: { curl: [12, 8, 4], spread: -1 },
    ring: { curl: [75, 45, 20], spread: -2 }, pinky: { curl: [75, 45, 20], spread: -4 },
    thumb: { abd: 50, f1: 5, f2: 0, f3: 0 },
  }),
  // ТАМ: указательный согнут в основании — показывает вдаль, остальные сжаты; большой лежит наискось
  // поверх согнутых пальцев, кончиком к среднему (у носительницы кончик — над основанием среднего)
  pointFar: shape({
    index: { curl: [30, 12, 5], spread: 2 }, middle: { curl: [85, 100, 55], spread: 0 },
    ring: { curl: [88, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: 40, f1: -20, f2: 30, f3: 18 },
  }),
  // МЫ: ладонь «лодочкой» — пальцы вместе и согнуты (у носителя 50–65° к пясти), большой вверх
  cupped: shape({
    index: { curl: [30, 30, 15], spread: 8 }, middle: { curl: [30, 30, 15], spread: 0 },
    ring: { curl: [32, 30, 15], spread: -7 }, pinky: { curl: [34, 30, 15], spread: -14 },
    thumb: { abd: -25, f1: -5, f2: 0, f3: 0 },
  }),
  // МЫ на обратном пути: большой палец отведён назад и смотрит вверх (у носителя в кадре 91–93°)
  cuppedThumbUp: shape({
    index: { curl: [30, 30, 15], spread: 8 }, middle: { curl: [30, 30, 15], spread: 0 },
    ring: { curl: [32, 30, 15], spread: -7 }, pinky: { curl: [34, 30, 15], spread: -14 },
    thumb: { abd: -30, f1: -40, f2: 0, f3: 0 },
  }),
  // РАБОТАТЬ: указательный и средний согнуты в основании под прямым углом и смотрят вниз, безымянный
  // и мизинец в кулаке, большой вдоль указательного
  bentTwo: shape({
    index: { curl: [85, 8, 4], spread: 6 }, middle: { curl: [85, 8, 4], spread: -2 },
    ring: { curl: [88, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: 10, f1: -10, f2: 5, f3: 0 },
  }),
  // СЕГОДНЯ: кисти ладонями вверх, пальцы вместе и согнуты «чашей» (у носительницы 75–95° к пясти),
  // большой отставлен вверх и наружу
  bowl: shape({
    index: { curl: [58, 40, 18], spread: 4 }, middle: { curl: [58, 40, 18], spread: 0 },
    ring: { curl: [60, 40, 18], spread: -4 }, pinky: { curl: [62, 40, 18], spread: -8 },
    thumb: { abd: -25, f1: 0, f2: 0, f3: 0 },
  }),
  // ТЫ: указательный согнут в основании (у носителя 33–37° к пясти) и смотрит на собеседника; большой
  // лежит поверх согнутых пальцев (как в ТАМ; «прижатый» из Я здесь торчал вниз вторым пальцем)
  pointYou: shape({
    index: { curl: [35, 5, 2], spread: 2 }, middle: { curl: [85, 100, 55], spread: 0 },
    ring: { curl: [88, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: 40, f1: -20, f2: 30, f3: 18 },
  }),
  // ШКОЛА: «Г» — указательный и большой вытянуты под прямым углом, остальные сжаты
  lHand: shape({
    index: { curl: [5, 5, 2], spread: 2 }, middle: { curl: [85, 100, 55], spread: 0 },
    ring: { curl: [88, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: -60, f1: -10, f2: 0, f3: 0 },
  }),
  // ДО СВИДАНИЯ: пальцы вместе, чуть согнуты в основании (у носителя указательный в кадре на 20° ближе
  // к середине, чем пясть), большой вдоль указательного (подбор: в кадре 75–79°, у носителя 78–84°)
  byeUp: shape({
    index: { curl: [35, 8, 4], spread: 8 }, middle: { curl: [35, 8, 4], spread: 0 },
    ring: { curl: [36, 8, 4], spread: -7 }, pinky: { curl: [37, 8, 4], spread: -14 },
    thumb: { abd: 22, f1: 0, f2: 10, f3: 5 },
  }),
  // ДО СВИДАНИЯ, взмах: пальцы мягко согнуты — в основании и в суставах (крупно ×2.35: кончики к зрителю и вниз;
  // прежние «палки» под прямым углом к ладони — неверно, пересборка 26.09)
  byeBent: shape({
    index: { curl: [62, 42, 20], spread: 8 }, middle: { curl: [64, 44, 20], spread: 0 },
    ring: { curl: [66, 44, 20], spread: -7 }, pinky: { curl: [68, 42, 20], spread: -14 },
    thumb: { abd: 22, f1: 0, f2: 10, f3: 5 },
  }),
  // ДО СВИДАНИЯ, в конце: кисть сжимается в свободный кулак, кончики в ладони
  byeClosed: shape({
    index: { curl: [80, 95, 50], spread: 6 }, middle: { curl: [82, 97, 50], spread: 0 },
    ring: { curl: [84, 97, 50], spread: -5 }, pinky: { curl: [86, 95, 50], spread: -10 },
    thumb: { abd: 25, f1: 15, f2: 15, f3: 10 },
  }),
  // ХОРОШО: кулак, большой палец вверх — отведён к стороне большого пальца, прямой
  thumbUp: shape({
    index: { curl: [85, 100, 55], spread: 3 }, middle: { curl: [88, 100, 55], spread: 0 },
    ring: { curl: [88, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: -55, f1: -5, f2: 0, f3: 0 },
  }),
  // ДА: указательный и средний вместе, чуть согнуты (у носителя в кадре на 20–30° ближе к середине, чем пясть),
  // безымянный и мизинец сжаты, большой поверх них; основания у Елнара широкие — сводим веером к среднему
  twoUp: shape({
    index: { curl: [25, 10, 5], spread: 10 }, middle: { curl: [25, 10, 5], spread: -1 },
    ring: { curl: [88, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: 40, f1: -20, f2: 30, f3: 18 },
  }),
  // ДА: кулак, большой лежит поверх указательного
  fist: shape({
    index: { curl: [85, 100, 55], spread: 3 }, middle: { curl: [88, 100, 55], spread: 0 },
    ring: { curl: [88, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: 40, f1: -20, f2: 30, f3: 18 },
  }),
  // ПОЖАЛУЙСТА: ладонь плоская, пальцы прямые и вместе, большой вдоль указательного в плоскости ладони (в покое
  // он у Елнара выступает к ладони на 5 см и упирался бы в другую кисть; подбор — на 6 мм за подушечками)
  flatPray: shape({
    index: { curl: [0, 0, 0], spread: 8 }, middle: { curl: [0, 0, 0], spread: 0 },
    ring: { curl: [1, 0, 0], spread: -7 }, pinky: { curl: [2, 0, 0], spread: -14 },
    thumb: { abd: 20, f1: -40, f2: 10, f3: 5 },
  }),
  // ЧТО, ГЛУХОЙ: указательный прямой, остальные сжаты, большой прижат к согнутым пальцам и смотрит вверх (подбор:
  // кончик на 0.09 ширины плеч к середине от основания среднего, в кадре 82–93° — у носителей 88–102°)
  one: shape({
    index: { curl: [5, 4, 2], spread: 2 }, middle: { curl: [85, 100, 55], spread: 0 },
    ring: { curl: [88, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: 47, f1: -3, f2: 0, f3: 0 },
  }),
  // ПОНИМАТЬ: как «один палец», но указательный согнут в основании к виску (у носителя в кадре на 35° ближе к
  // середине, чем пясть)
  oneBent: shape({
    index: { curl: [40, 6, 3], spread: 2 }, middle: { curl: [85, 100, 55], spread: 0 },
    ring: { curl: [88, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: 47, f1: -3, f2: 0, f3: 0 },
  }),
  // ПАПА: плоская ладонь, пальцы вместе, у лба согнуты в основании (у носителя в кадре 35° от пясти); большой
  // вдоль указательного, кончик чуть ниже оснований пальцев (подбор по кадру: у лба 34°, у подбородка 16°)
  flatSalute: shape({
    index: { curl: [30, 6, 3], spread: 8 }, middle: { curl: [30, 6, 3], spread: 0 },
    ring: { curl: [31, 6, 3], spread: -7 }, pinky: { curl: [32, 6, 3], spread: -14 },
    thumb: { abd: 20, f1: -8, f2: 0, f3: 0 },
  }),
  // ПЛОХО, у носа: щепоть — пальцы сведены и согнуты к середине (у носителя кончики в кадре на 47° от
  // пясти), большой под ними
  pinch: shape({
    index: { curl: [35, 30, 12], spread: 6 }, middle: { curl: [36, 32, 12], spread: 0 },
    ring: { curl: [40, 32, 12], spread: -5 }, pinky: { curl: [44, 32, 12], spread: -10 },
    thumb: { abd: 45, f1: 0, f2: 10, f3: 5 },
  }),
  // ПЛОХО, брошено вниз: пальцы раскрыты и опущены (согнуты в основании), большой отставлен
  dropOpen: shape({
    index: { curl: [65, 10, 5], spread: -8 }, middle: { curl: [65, 10, 5], spread: -1 },
    ring: { curl: [67, 10, 5], spread: 7 }, pinky: { curl: [69, 12, 6], spread: 15 },
    thumb: { abd: -35, f1: 30, f2: 5, f3: 5 },
  }),
  // ПЛОХО у носа (пересборка 26.09): указательный согнут крючком, кончиком на крыле носа; остальные сжаты,
  // большой вдоль согнутых, вверх (у носителя в кадре 72–77°)
  noseHook: shape({
    index: { curl: [8, 62, 42], spread: 2 }, middle: { curl: [80, 95, 50], spread: 0 },
    ring: { curl: [85, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: 25, f1: -12, f2: 8, f3: 5 },
  }),
  // ПЛОХО брошено вниз (пересборка 26.09): ладонь вниз, пальцы расслабленно свисают из костяшек (у носителя
  // сгиб указательного 73–100°, остальных 96–139° к пясти), чуть врозь; большой расслаблен
  dropHang: shape({
    index: { curl: [65, 25, 10], spread: -5 }, middle: { curl: [72, 30, 12], spread: 0 },
    ring: { curl: [78, 32, 12], spread: 5 }, pinky: { curl: [82, 32, 12], spread: 10 },
    thumb: { abd: -25, f1: 20, f2: 10, f3: 5 },
  }),
  // вопрос в конце: раскрытые ладони, пальцы расслаблены
  openUp: shape({
    index: { curl: [8, 12, 8], spread: -6 }, middle: { curl: [8, 12, 8] },
    ring: { curl: [10, 14, 8], spread: 5 }, pinky: { curl: [12, 16, 10], spread: 10 },
    thumb: { abd: -30, f1: -6, f2: 4, f3: 4 },
  }),
};

// ——— дорожки ———
// Ключ: { t, pos, fingers, palm, pole, shape } или { t, idle: true }; ease — вход в ключ.
const I = { right: K.idleTargets('right'), left: K.idleTargets('left') };

function keyPose(side, k) {
  return {
    wrist: k.pos,
    pole: k.pole.clone().normalize(),
    hand: k.hand ?? K.handQuat(side, k.fingers, k.palm),
    shape: k.shape,
  };
}

/** Подъём из покоя в позу k — дугой: сначала вперёд, потом к цели (как поднимают руку). */
function risePose(side, target, u) {
  const it = I[side];
  const W = target.wrist;
  const C = V(it.wrist.x + 0.6 * (W.x - it.wrist.x), it.wrist.y + 0.3 * (W.y - it.wrist.y), W.z + 0.05);
  const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
  const wrist = it.wrist.clone().multiplyScalar(a).add(C.clone().multiplyScalar(b)).add(W.clone().multiplyScalar(c));
  const pole = it.pole.clone().lerp(target.pole, u).normalize();
  // Сначала кисть продолжает предплечье, потом доворачивается в позу знака.
  const neutral = K.solveArm(side, { wrist, pole, hand: it.hand, foreTwist: 0 }).neutralHand;
  const hand = neutral.clone().slerp(target.hand, smoothstep(u, 0.05, 0.95));
  return { wrist, pole, hand, shape: mixShape(SH.rest, target.shape, smoothstep(u, 0.1, 0.9)) };
}

function evalTrack(side, keys, t) {
  if (t <= keys[0].t) return keys[0].idle ? { idle: true } : keyPose(side, keys[0]);
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.idle ? { idle: true } : keyPose(side, last);
  let i = 0;
  while (keys[i + 1].t < t) i++;
  const a = keys[i], b = keys[i + 1];
  const u = (t - a.t) / (b.t - a.t);
  const e = ease[b.ease ?? 'io'](u);
  if (a.idle && b.idle) return { idle: true };
  if (a.idle) return risePose(side, keyPose(side, b), e);
  if (b.idle) return risePose(side, keyPose(side, a), 1 - e);
  const pa = keyPose(side, a), pb = keyPose(side, b);
  const se = b.shapeEase ? ease[b.shapeEase](u) : e;
  return {
    wrist: pa.wrist.clone().lerp(pb.wrist, e),
    pole: pa.pole.clone().lerp(pb.pole, e).normalize(),
    hand: pa.hand.clone().slerp(pb.hand, e),
    shape: mixShape(pa.shape, pb.shape, se),
  };
}

/** Ключи головы: { t, pitch, roll, yaw } (°), между ними — синусом. */
function evalHead(keys, t) {
  if (!keys?.length) return [0, 0, 0];
  const val = (k) => [k.pitch ?? 0, k.roll ?? 0, k.yaw ?? 0];
  if (t <= keys[0].t) return val(keys[0]);
  if (t >= keys[keys.length - 1].t) return val(keys[keys.length - 1]);
  let i = 0;
  while (keys[i + 1].t < t) i++;
  const a = val(keys[i]), b = val(keys[i + 1]);
  const k = ease.sine((t - keys[i].t) / (keys[i + 1].t - keys[i].t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** Кадр по позам обеих рук и голове ([pitch, roll, yaw], °). */
function frameAt(right, left, head = [0, 0, 0]) {
  const locals = {};
  for (const [side, pose] of [['right', right], ['left', left]]) {
    if (pose.idle) { Object.assign(locals, K.idleLocals(side)); continue; }
    const sol = K.solveArm(side, { wrist: pose.wrist, pole: pose.pole, hand: pose.hand, foreTwist: 0.6 });
    Object.assign(locals, sol.locals, K.shapeLocals(side, pose.shape));
  }
  return { ...K.localsToDeltas(locals), ...K.headDeltas(head[0], head[1], head[2] ?? 0) };
}

/** Поза в момент t: обе руки и голова; края — точно покой. */
function poseAt(phrase, t, edge = false) {
  const right = edge ? { idle: true } : evalTrack('right', phrase.right, t);
  const left = edge ? { idle: true } : evalTrack('left', phrase.left, t);
  const head = edge ? [0, 0, 0] : evalHead(phrase.head, t);
  return frameAt(right, left, head);
}

/** Угол (°) между двумя поворотами одной кости, заданными дельтами Эйлера. */
const boneAngle = (a, b) => THREE.MathUtils.radToDeg(
  new THREE.Quaternion().setFromEuler(new THREE.Euler(...a, 'XYZ'))
    .angleTo(new THREE.Quaternion().setFromEuler(new THREE.Euler(...b, 'XYZ'))));

function build(phrase) {
  // Разворот кисти между соседними ключами больше 150° слерп может провести не
  // той стороной — такие места надо разбивать промежуточным ключом.
  for (const side of ['right', 'left']) {
    const keys = phrase[side].filter((k) => !k.idle);
    for (let i = 1; i < keys.length; i++) {
      const qa = keyPose(side, keys[i - 1]).hand, qb = keyPose(side, keys[i]).hand;
      const ang = THREE.MathUtils.radToDeg(qa.angleTo(qb));
      if (ang > 150) throw new Error(`${phrase.name}: ${side} ${keys[i - 1].t}→${keys[i].t} с — разворот кисти ${ang.toFixed(0)}°, нужен промежуточный ключ`);
    }
  }
  const n = Math.round(phrase.duration * FPS);
  let frames = [];
  for (let fi = 0; fi <= n; fi++) {
    const t = fi / FPS;
    frames.push({ t, bones: poseAt(phrase, t, fi === 0 || fi === n) });
  }
  unwrapFrames(frames);
  // Быстрые участки (разворот ладони, опускание рук): плеер интерполирует
  // Эйлеры линейно, и на шаге 1/30 с кость уходит от задуманного поворота.
  // Где середина интервала расходится с точной позой больше 0.4°, вставляем
  // точный промежуточный кадр — плеер понимает неравномерный шаг.
  for (let pass = 0; pass < 3; pass++) {
    const out = [frames[0]];
    let added = 0;
    for (let i = 0; i < frames.length - 1; i++) {
      const a = frames[i], b = frames[i + 1];
      const tm = (a.t + b.t) / 2;
      const exact = poseAt(phrase, tm);
      for (const [k, d] of Object.entries(exact)) {
        const p = a.bones[k];
        for (let j = 0; j < 3; j++) {
          while (d[j] - p[j] > Math.PI) d[j] -= 2 * Math.PI;
          while (d[j] - p[j] < -Math.PI) d[j] += 2 * Math.PI;
        }
      }
      let worst = 0;
      for (const k of Object.keys(exact)) {
        worst = Math.max(worst, boneAngle(a.bones[k].map((x, j) => (x + b.bones[k][j]) / 2), exact[k]));
      }
      if (worst > 0.4) { out.push({ t: tm, bones: exact }); added++; }
      out.push(b);
    }
    frames = out;
    if (!added) break;
  }
  for (const f of frames) {
    f.t = +f.t.toFixed(4);
    for (const k of Object.keys(f.bones)) f.bones[k] = f.bones[k].map((x) => +x.toFixed(5));
  }
  return frames;
}

/** Ключ руки по кадру эталона: запястье (x2, y2), локоть носителя e2, ориентация кисти и форма. */
function refKey(side, t, w2, e2, rest, fitOpts) {
  const arm = fitArm(side, w2, e2, fitOpts);
  return { t, pos: arm.wrist, pole: arm.pole, ...rest };
}

// ═══════════════ «Как дела?» = КАК + ДЕЛА ═══════════════
// Эталон — видео 6155. Время жеста = время записи − 1.20 с.
// Запястья (кисть MediaPipe) и локти (поза) в кадре, ширины плеч:
//   подъём 1.30–1.54; КАК открыта 1.54 (−0.41,−0.45) → 1.62 (−0.36,−0.31); кулак 1.66–1.78
//   (−0.37,−0.33) → (−0.34,−0.25); снова открыта 1.82–2.06 (−0.38,−0.27) → (−0.44,−0.39);
//   к ДЕЛА 2.10–2.22 (−0.45,−0.37) → (−0.47,−0.37); локоть правой всё время у бока (−0.71…−0.74, −0.95).
//   ДЕЛА: 2.26 правое (−0.45,−0.37), левое (0.54,−0.53) — ладони вниз; 2.46 (−0.56,−0.59) и
//   (0.61,−0.58) — пальцы вниз; держат до 2.70: (−0.59,−0.71) и (0.60,−0.72); локти (∓0.73…0.8, −0.9).
function kakDela() {
  const T0 = 1.2;
  const at = (tr) => +(tr - T0).toFixed(3);
  // КАК: пясть вверх, ладонь к середине тела и чуть к зрителю (у носителя (0.73…0.85, −0.3…0.1, 0.5…0.6))
  const KAK = { fingers: dir(0.02, 0.97, 0.22), palm: dir(0.85, -0.05, 0.5) };
  // после кулака кисть раскрывается чуть наклонённой наружу (пясть в кадре 98–109°)
  const KAK2 = { fingers: dir(-0.25, 0.94, 0.22), palm: dir(0.85, 0.15, 0.5) };
  const E_KAK = [-0.72, -0.96];
  // ДЕЛА: сначала ладони вниз, пальцы вперёд и к середине; потом кисти падают в запястье —
  // пальцы вниз, ладонь к телу, тыл к зрителю
  // В начале ДЕЛА кисти приходят с разных сторон: правая из КАК — пясть ещё
  // поднята (в кадре 53° к середине тела), левая снизу — пальцы к середине и вниз (−130°)
  const DOWN_R = { fingers: dir(0.3, 0.35, 0.89), palm: dir(0.4, -0.92, 0), shape: SH.spread5 };
  const DOWN_L = { fingers: dir(-0.35, -0.35, 0.87), palm: dir(-0.4, -0.92, 0), shape: SH.spread5 };
  const DROP_R = { fingers: dir(0.2, -0.95, 0.2), palm: dir(0.05, -0.2, -0.98), shape: SH.spread5 };
  const DROP_L = { fingers: dir(-0.2, -0.95, 0.2), palm: dir(-0.05, -0.2, -0.98), shape: SH.spread5 };
  // переход КАК → ДЕЛА: указательный уходит вперёд, ладонь к середине и вниз, пальцы раскрываются
  const TURN_R = { fingers: dir(0.3, 0.25, 0.92), palm: dir(0.65, -0.75, 0.1), shape: mixShape(SH.kak3, SH.spread5, 0.55) };
  const right = [
    { t: 0, idle: true },
    { t: at(1.30), idle: true },
    refKey('right', at(1.54), [-0.41, -0.45], E_KAK, { ...KAK, shape: SH.kak3 }),
    { ...refKey('right', at(1.62), [-0.36, -0.31], E_KAK, { ...KAK, shape: SH.kak3 }), ease: 'lin' },
    { ...refKey('right', at(1.67), [-0.37, -0.32], E_KAK, { ...KAK, shape: SH.kakFist }), ease: 'sine' },
    { ...refKey('right', at(1.78), [-0.34, -0.26], E_KAK, { fingers: dir(-0.2, 0.95, 0.22), palm: dir(0.85, 0.1, 0.5), shape: SH.kakFist }), ease: 'lin' },
    { ...refKey('right', at(1.84), [-0.39, -0.28], E_KAK, { ...KAK2, shape: SH.kak3 }), ease: 'sine' },
    { ...refKey('right', at(2.06), [-0.44, -0.39], E_KAK, { ...KAK2, shape: SH.kak3 }), ease: 'lin' },
    { ...refKey('right', at(2.16), [-0.43, -0.34], [-0.77, -0.94], TURN_R), ease: 'sine' },
    { ...refKey('right', at(2.26), [-0.45, -0.37], [-0.80, -0.97], DOWN_R), ease: 'sine' },
    { ...refKey('right', at(2.32), [-0.47, -0.44], [-0.78, -0.96], DOWN_R), ease: 'lin' },
    { ...refKey('right', at(2.46), [-0.56, -0.59], [-0.73, -0.90], DROP_R), ease: 'io' },
    { ...refKey('right', at(2.70), [-0.59, -0.71], [-0.72, -0.84], DROP_R), ease: 'lin' },
    { t: at(2.96), idle: true },
  ];
  const left = [
    { t: 0, idle: true },
    { t: at(2.06), idle: true },
    refKey('left', at(2.26), [0.54, -0.53], [0.85, -1.0], DOWN_L),
    { ...refKey('left', at(2.32), [0.56, -0.53], [0.86, -0.99], DOWN_L), ease: 'lin' },
    { ...refKey('left', at(2.46), [0.61, -0.58], [0.75, -0.83], DROP_L), ease: 'io' },
    { ...refKey('left', at(2.70), [0.60, -0.72], [0.70, -0.79], DROP_L), ease: 'lin' },
    { t: at(2.96), idle: true },
  ];
  // Голова у носителя кивает в такт: ниже на КАК, выше на переходе, ниже на
  // «падении» ДЕЛА, в конце подбородок чуть вверх (вопрос).
  const head = [
    { t: 0, pitch: 0 }, { t: at(1.40), pitch: 0 }, { t: at(1.56), pitch: -5 }, { t: at(2.02), pitch: -3 },
    { t: at(2.16), pitch: 3 }, { t: at(2.30), pitch: 2 }, { t: at(2.44), pitch: -2 }, { t: at(2.62), pitch: 0 },
    { t: at(2.80), pitch: 4 }, { t: at(3.00), pitch: 0 },
  ];
  return {
    name: 'kak-dela', duration: at(3.00), right, left, head,
    description:
      'РЖЯ «Как дела?» = КАК + ДЕЛА, как у носителя в SpreadTheSign RU sentence 621 (видео 6155), в его темпе. ' +
      'КАК: правая кисть у груди, пальцы вверх, ладонь к середине тела; указательный и средний выпрямлены, ' +
      'большой поднят вдоль указательного; кисть один раз сжимается в кулак с поднятым большим и раскрывается. ' +
      'ДЕЛА: обе кисти с растопыренными пальцами ладонями вниз у нижней части груди опускаются к поясу и ' +
      'падают в запястье — пальцы вниз, тыл к зрителю. Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ «Как я могу помочь?» = ПОМОЧЬ ═══════════════
// Эталон — видео 105605. Время жеста = время записи − 1.10 с.
// Запястья (кисть MediaPipe) в кадре, ширины плеч:
//   правая: 1.30 (−0.46,−0.44) — поднята; 1.42–1.54 (−0.33…−0.40, −0.24…−0.30) — над левой,
//   пальцы в кадре 52–66° над горизонталью; 1.58–1.78 (−0.31…−0.35, −0.31…−0.37) — на левой,
//   пальцы 30–42°; 1.82–1.90 (−0.32…−0.35, −0.40…−0.45) — пальцы ложатся (2–21°);
//   1.94–2.02 разворот ладонью вверх, 2.02–2.14 вниз. Локоть у бока: (−0.64…−0.67, −0.86…−0.90).
//   левая: 1.26 (0.30,−0.74) → 1.34 (0.15,−0.46); 1.42–1.90 (0.10 → 0.00, −0.40…−0.44);
//   1.98 (0.02,−0.55); 2.02 (0.08,−0.64). Локоть (0.42…0.55, −0.91…−0.97).
function kakPomoch() {
  const T0 = 1.1;
  const at = (tr) => +(tr - T0).toFixed(3);
  // Правая — плоская ладонь с отведённым большим пальцем: ладонь к груди, тыл к
  // зрителю, пальцы к середине тела, вверх и к зрителю; угол пальцев в кадре задаётся
  // явно, выход к зрителю ~38° (в кадре пясть и пальцы у носителя укорочены до 0.6–0.8 длины)
  const flatR = (deg, sh = SH.flatL) => ({ fingers: dir2(deg, 38), palm: V(0, 0, -1), shape: sh });
  const E_R = [-0.66, -0.88];
  // Левая — ладонью вверх, пальцы вперёд, к середине тела и чуть вниз (в кадре −134…−177°)
  const leftK = { fingers: dir(-0.6, -0.3, 0.74), palm: V(0, 1, 0), shape: SH.flatUp };
  const E_L = [0.48, -0.94];
  // Разворот правой ладонью вверх — через промежуточный ключ (иначе слерп
  // проводит кисть через «ладонь к зрителю, пальцы вверх»)
  const TURN_R = { fingers: dir(0.2, 0.1, 0.97), palm: dir(0.15, 0.6, -0.78), shape: mixShape(SH.flatL, SH.openUp, 0.5) };
  // Ладонями вверх (2.02 с): кисти рядом перед нижней частью груди, пальцы вперёд к
  // собеседнику и чуть к середине — правая раскрыта кверху, левая лежит ладонью вверх
  const UP_R = { fingers: dir(0.3, 0.1, 0.95), palm: dir(0.25, 0.95, -0.1), shape: SH.openUp };
  const UP_L = { fingers: dir(-0.3, -0.12, 0.95), palm: dir(-0.05, 0.98, 0.12), shape: SH.openUp };

  const leftK2 = { ...leftK, fingers: dir(-0.55, -0.42, 0.72) };
  const L = {
    k1: refKey('left', at(1.36), [0.14, -0.45], E_L, leftK),
    k2: refKey('left', at(1.58), [0.05, -0.39], E_L, leftK),
    k3: refKey('left', at(1.78), [0.03, -0.43], E_L, leftK),
    k4: refKey('left', at(1.88), [0.00, -0.43], E_L, leftK2),
  };
  const R = {
    k1: refKey('right', at(1.30), [-0.46, -0.44], E_R, flatR(62, SH.flatLhover)),
    k2: refKey('right', at(1.44), [-0.34, -0.28], E_R, flatR(58, SH.flatLhover)),
    k3: refKey('right', at(1.54), [-0.36, -0.27], E_R, flatR(60, SH.flatLhover)),
  };
  // На левой: правая ставится ребром мизинца на пальцы левой (3 мм кожа к коже)
  R.c1 = touchDown({ ...refKey('right', at(1.60), [-0.31, -0.32], E_R, flatR(40)) }, L.k2, L.k3, at(1.60));
  R.c2 = touchDown({ ...refKey('right', at(1.78), [-0.33, -0.37], E_R, flatR(38)) }, L.k2, L.k3, at(1.78));
  // Перед разворотом пальцы у носителя ложатся почти горизонтально (1.82–1.90);
  // Елнару так уложить их на пальцы левой без прохода сквозь неё нельзя — кисть
  // пришлось бы поднять на 5 см, — поэтому он только доводит их до ~28°.
  R.c3 = touchDown({ ...refKey('right', at(1.87), [-0.34, -0.41], E_R, flatR(28)) }, L.k3, L.k4, at(1.87));

  const right = [
    { t: 0, idle: true },
    R.k1,
    { ...R.k2, ease: 'sine' },
    { ...R.k3, ease: 'lin' },
    { ...R.c1, ease: 'sine' },
    { ...R.c2, ease: 'lin' },
    { ...R.c3, ease: 'sine' },
    { ...refKey('right', at(1.97), [-0.38, -0.47], E_R, TURN_R), ease: 'sine' },
    { ...refKey('right', at(2.03), [-0.33, -0.58], [-0.67, -0.84], UP_R), ease: 'sine' },
    { t: at(2.24), idle: true },
  ];
  const left = [
    { t: 0, idle: true },
    { t: at(1.18), idle: true },
    L.k1,
    { ...L.k2, ease: 'sine' },
    { ...L.k3, ease: 'lin' },
    { ...L.k4, ease: 'lin' },
    { ...refKey('left', at(1.97), [0.04, -0.55], E_L, { fingers: dir(-0.25, -0.2, 0.95), palm: V(0, 1, 0), shape: mixShape(SH.flatUp, SH.openUp, 0.5) }), ease: 'sine' },
    { ...refKey('left', at(2.03), [0.10, -0.63], [0.55, -0.85], UP_L), ease: 'sine' },
    { t: at(2.24), idle: true },
  ];
  // У носителя голова и плечи клонятся к левому плечу и вниз, пока длится знак
  // (нос ниже на 0.09 ширины плеч, плечи наклонены на 6°), в конце подбородок
  // поднимается выше исходного — вопрос. Корпус у Елнара в жестах не двигается,
  // поэтому наклон передаём головой и шеей.
  const head = [
    { t: 0, pitch: 0, roll: 0 }, { t: at(1.30), pitch: 0, roll: 0 }, { t: at(1.60), pitch: -8, roll: 5 },
    { t: at(1.86), pitch: -8, roll: 6 }, { t: at(2.04), pitch: 5, roll: 3 }, { t: at(2.14), pitch: 5, roll: 2 },
    { t: at(2.30), pitch: 0, roll: 0 },
  ];
  return {
    name: 'kak-pomoch', duration: at(2.30), right, left, head,
    description:
      'РЖЯ «Как я могу помочь?» (= «Чем я могу вам помочь?»): знак ПОМОЧЬ, как у носителя в SpreadTheSign RU ' +
      'sentence 10070 (видео 105605), в его темпе. Правая — плоская ладонь с отведённым большим пальцем, тыл к ' +
      'зрителю, пальцы к середине тела и вверх; ставится ребром мизинца на пальцы левой. Левая — ладонью вверх, ' +
      'пальцы вперёд и к середине тела, большой отставлен наружу. В конце обе ладонями вверх опускаются, голова ' +
      'после наклона к левому плечу поднимается — вопрос. Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

/**
 * Правая кисть в позе носителя над левой: если проходит сквозь неё (зазор меньше 3 мм), поднять вверх ровно до
 * 3 мм; если выше — оставить как у носителя (в отличие от touchDown, не опускает до касания).
 */
function keepAbove(rightKey, leftKey) {
  const leftPose = keyPose('left', leftKey);
  const gapAt = (W) => { applyFrame(rig, frameAt(keyPose('right', { ...rightKey, pos: W }), leftPose)); return K.handsGap(); };
  const W = rightKey.pos.clone();
  let gap = gapAt(W);
  for (let it = 0; it < 40 && gap < 0.003 - 3e-4; it++) { W.add(V(0, 0.003 - gap + 0.0005, 0)); gap = gapAt(W); }
  applyFrame(rig, {});
  return { ...rightKey, pos: W, gap };
}

/**
 * Левая кисть подводится к правой снизу (по вертикали), пока между ними не останется 3 мм кожа к коже: правая
 * стоит там, где у носителя, а левую под ней MediaPipe не видит — её высота менее надёжна.
 */
/**
 * Касание правой и левой по вертикали: правая сдвигается вверх или вниз на наименьшее расстояние (до ±8 см), при котором
 * зазор между кистями — 3 мм; левая не двигается. Зазор по высоте меняется не монотонно (пальцы одной кисти могут
 * загибаться перед другой), поэтому ищется ближайшая к исходной высоте точка касания, а не «сверху».
 */
function touchNear(rightKey, leftKey, { fromAbove = false } = {}) {
  const leftPose = keyPose('left', leftKey);
  const gapAt = (dy) => { applyFrame(rig, frameAt(keyPose('right', { ...rightKey, pos: rightKey.pos.clone().add(V(0, dy, 0)) }), leftPose)); return K.handsGap() - 0.003; };
  let found = null;
  // сверху — первое касание при опускании с +8 см (правая ложится на левую, а не подпирает её снизу)
  if (fromAbove) {
    let prev = 0.15;
    for (let dy = 0.15; dy >= -0.08; dy -= 0.002) { if (gapAt(dy) <= 0) { found = [prev, dy]; break; } prev = dy; }
  }
  for (let step = 1; step <= 40 && !found && !fromAbove; step++) {
    for (const sgn of [-1, 1]) {
      const a = sgn * (step - 1) * 0.002, b = sgn * step * 0.002;
      const ga = gapAt(a), gb = gapAt(b);
      if (ga === 0) { found = [a, a]; break; }
      if (Math.sign(ga) !== Math.sign(gb)) { found = [a, b]; break; }
    }
  }
  if (!found) { applyFrame(rig, {}); throw new Error(`touchNear ${rightKey.t} с: касания в пределах ±8 см нет`); }
  let [a, b] = found;
  for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (Math.sign(gapAt(m)) === Math.sign(gapAt(a))) a = m; else b = m; }
  const dy = (a + b) / 2;
  const gap = gapAt(dy) + 0.003;
  applyFrame(rig, {});
  return { ...rightKey, pos: rightKey.pos.clone().add(V(0, dy, 0)), gap, dy };
}
function meetLeft(rightKey, leftKey) {
  const rightPose = keyPose('right', rightKey);
  const gapAt = (W) => { applyFrame(rig, frameAt(rightPose, keyPose('left', { ...leftKey, pos: W }))); return K.handsGap(); };
  const W = leftKey.pos.clone();
  let gap = gapAt(W);
  for (let it = 0; it < 40 && Math.abs(gap - 0.003) > 3e-4; it++) { W.add(V(0, (gap - 0.003) * 0.8, 0)); gap = gapAt(W); }
  applyFrame(rig, {});
  return { ...leftKey, pos: W, gap };
}

/**
 * Поставить правую кисть на левую: 3 мм кожа к коже при наименьшем сдвиге от
 * места носителя. Правое запястье идёт по вертикали; если для касания пришлось
 * бы уйти вверх дальше 1.5 см, кисть можно вынести вперёд (к зрителю) до 6 см —
 * в кадре это почти не заметно, а кисти не проходят друг сквозь друга.
 * Левая берётся в позе между её ключами la и lb на момент t.
 */
function touchDown(rightKey, la, lb, t) {
  const u = lb.t > la.t ? THREE.MathUtils.clamp((t - la.t) / (lb.t - la.t), 0, 1) : 0;
  const pa = keyPose('left', la), pb = keyPose('left', lb);
  const leftPose = { wrist: pa.wrist.clone().lerp(pb.wrist, u), pole: pa.pole.clone().lerp(pb.pole, u).normalize(), hand: pa.hand.clone().slerp(pb.hand, u), shape: pa.shape };
  const gapAt = (W) => { applyFrame(rig, frameAt(keyPose('right', { ...rightKey, pos: W }), leftPose)); return K.handsGap(); };
  let best = null;
  for (const dz of [0, 0.015, 0.03, 0.045, 0.06]) {
    const W = rightKey.pos.clone().add(V(0, 0, dz));
    let gap = 0;
    for (let it = 0; it < 30; it++) {
      gap = gapAt(W);
      if (Math.abs(gap - 0.003) < 4e-4) break;
      W.add(V(0, -(gap - 0.003) * 0.7, 0));
    }
    const lift = W.y - rightKey.pos.y;
    const cost = Math.max(0, lift - 0.015) * 3 + Math.abs(lift) + dz * 0.5;
    if (Math.abs(gap - 0.003) < 1e-3 && (!best || cost < best.cost)) best = { cost, W, gap };
  }
  applyFrame(rig, {});
  if (!best) throw new Error(`касание в ${t} с не найдено`);
  return { ...rightKey, pos: best.W, gap: best.gap };
}

// ═══════════════ «Спасибо» = СПАСИБО ═══════════════
// Эталон — spreadthesign.com/ru.ru/sentence/14608 «Спасибо» (видео 176094). Время жеста = время записи − 0.50 с.
// Разметка (кисть MediaPipe, R 98–100 %; кадр — ширины плеч от середины плеч):
//   0.58–0.74 правая поднимается к лицу; 0.78–0.90 кулак у правой стороны лба: пясть вертикально
//   (в кадре 89–97°), ладонь к лицу (3D (−0.1…0.1, 0.05…0.24, −0.96…−0.99)), пальцы сжаты,
//   большой вытянут вверх вдоль кисти (∠ к пясти 0–12°); запястье (−0.26…−0.40, 0.36…0.47);
//   голова кивает навстречу (нос ниже на 0.13 ширины плеч) и чуть к правой руке.
//   0.94–1.00 кулак идёт вниз; 1.02–1.18 у подбородка: пясть наклонена к зрителю (3D (0.17, 0.66, 0.73),
//   в кадре 73–85°), ладонь к подбородку снизу-сзади, запястье (−0.05…−0.12, 0.00…0.09), большой
//   вверх-вперёд, кончик у подбородка; голова приподнимается. 1.22–1.38 рука опускается в покой,
//   голова на миг выше исходного.
function spasibo() {
  const T0 = 0.5;
  const at = (tr) => +(tr - T0).toFixed(3);
  const FOREHEAD = { fingers: dir(0.02, 0.97, 0.2), palm: dir(-0.05, 0.15, -0.98), pole: V(-0.3, -0.8, 0.45), shape: SH.fistThumb };
  const CHIN = { fingers: dir(0.17, 0.66, 0.73), palm: dir(-0.05, 0.75, -0.65), pole: V(-0.25, -0.9, 0.35), shape: SH.fistThumb };
  const head = [
    { t: 0, pitch: 0, roll: 0 }, { t: at(0.66), pitch: -5, roll: 0 }, { t: at(0.82), pitch: -18, roll: -4 },
    { t: at(0.90), pitch: -18, roll: -4 }, { t: at(1.02), pitch: -6, roll: -1 }, { t: at(1.18), pitch: -5, roll: 0 },
    { t: at(1.27), pitch: 5, roll: 0 }, { t: at(1.46), pitch: 0, roll: 0 },
  ];
  const headAt = (t) => evalHead(head, t);
  // Касание ставится по лицу Елнара, а не по кадру носителя: голова у него уже
  // относительно плеч, и запястье «как у носителя» уводило кулак за край лба.
  // Передняя сторона кулака (средние фаланги) — на точку лица, 3 мм кожа к коже.
  const f1 = touchSpot({ t: at(0.83), ...FOREHEAD }, 'лоб справа', headAt(at(0.83)));
  const f2 = touchSpot({ t: at(0.90), ...FOREHEAD }, 'лоб справа', headAt(at(0.90)));
  // у подбородка кулак касается его передней части (у носителя верх кулака — под нижней губой);
  // ниже он лёг бы запястьем на ворот
  const c1 = touchSpot({ t: at(1.01), ...CHIN }, 'подбородок', headAt(at(1.01)), V(0, 0.006, 0));
  const c2 = touchSpot({ t: at(1.18), ...CHIN }, 'подбородок', headAt(at(1.18)), V(0, 0.004, 0));
  // подход ко лбу — на сантиметр перед касанием
  const f0 = { ...f1, t: at(0.76), pos: f1.pos.clone().add(V(0, -0.012, 0.01)), ease: 'sine' };
  // ото лба к подбородку кулак идёт перед лицом (прямо — прошёл бы сквозь нос)
  const down = { t: at(0.955), pos: f2.pos.clone().lerp(c1.pos, 0.5).add(V(0, 0, 0.045)), fingers: dir(0.1, 0.85, 0.5), palm: dir(-0.05, 0.5, -0.86), pole: V(-0.28, -0.85, 0.4), shape: SH.fistThumb, ease: 'sine' };
  // подъём у носителя быстрый: к 0.66 с кулак уже у шеи
  const right = [
    { t: 0, idle: true },
    { t: at(0.54), idle: true },
    f0,
    { ...f1, ease: 'out' },
    { ...f2, ease: 'lin' },
    down,
    { ...c1, ease: 'sine' },
    { ...c2, ease: 'lin' },
    // от подбородка кулак уходит вперёд и вниз, перед грудью (у носителя 1.26–1.30 с —
    // запястье (−0.05…0.00, −0.29…−0.52)), а не прямо вниз сквозь неё
    { t: at(1.29), pos: P2(-0.06, -0.38, 0.72), fingers: dir(0.15, 0.35, 0.92), palm: dir(0, 0.9, -0.4), pole: V(-0.3, -0.9, 0.2), shape: mixShape(SH.fistThumb, SH.rest, 0.4), ease: 'io' },
    { t: at(1.44), idle: true },
  ];
  const left = [{ t: 0, idle: true }, { t: at(1.44), idle: true }];
  return {
    name: 'spasibo', duration: at(1.48), right, left, head,
    description:
      'РЖЯ «Спасибо», как у носителя в SpreadTheSign RU sentence 14608 (видео 176094), в его темпе: кулак правой ' +
      'руки с вытянутым вдоль кисти большим пальцем, ладонь к лицу, касается правой стороны лба (голова кивает ' +
      'навстречу), затем подбородка и опускается. Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ «Я люблю маму» = Я + ЛЮБИТЬ + МАМА ═══════════════
// Целиком фразы в словаре нет — знаки из видео слов и предложения того же словаря (RU):
//   Я      — word/1293 (видео 12788): указательный к середине груди, пясть к середине, вверх и к груди
//            (3D (0.55…0.63, 0.49…0.58, −0.52…−0.69)), остальные пальцы сжаты; держит 1.62–2.14 с.
//   ЛЮБИТЬ — sentence/2791 «я люблю тебя» (видео 26565), 2.82–3.62 с: плоская ладонь, пальцы чуть
//            согнуты, кончиками к губам (ладонь к лицу, 3D (0…0.13, 0.14…0.39, −0.91…−0.99)), большой
//            в сторону; затем ладонь на левую сторону груди — к сердцу (пальцы в кадре 39–43°, вверх и
//            к левому плечу). Тот же знак в word/10868 (видео 351477).
//   МАМА   — word/1284 (видео 12693), 1.18–1.70 с: плоская ладонь, пальцы вверх, у правой щеки, затем
//            перед подбородком — к левой щеке (ладонь к лицу), опускается.
// Я и МАМА показывает одна носительница (та же, что в «Как дела?»). Порядок — как во фразе
// переводчика: Я ЛЮБИТЬ МАМА. Паузы между знаками — как у носителей внутри предложения.
function yaLyublyuMamu() {
  // Я: пясть почти в плоскости кадра, 45° к середине и вверх (у носительницы в кадре 43–45°, длина
  // 0.27–0.28 ширины плеч — не укорочена), указательный согнут в основании и уходит в грудь (в кадре
  // укорочен почти в точку), кончиком правее середины груди
  const YA = { fingers: dir(0.68, 0.62, -0.35), palm: dir(-0.4, -0.3, -0.87), pole: V(-0.35, -0.9, 0.1), shape: SH.pointIn };
  const LIPS = { fingers: dir(0.35, 0.9, 0.25), palm: dir(0.05, 0.3, -0.95), pole: V(-0.4, -0.85, 0.15), shape: SH.flatBent };
  const HEART = { fingers: dir(0.75, 0.6, 0.25), palm: dir(0.1, 0.2, -0.97), pole: V(-0.35, -0.9, 0.1), shape: SH.flatHeart };
  const CHEEK_R = { fingers: dir(0.1, 0.97, 0.15), palm: dir(0.9, 0, -0.4), pole: V(-0.5, -0.8, 0.1), shape: SH.flatClosed };
  // у левой щеки запястье у носительницы близко к середине (0.04…0.11) — пальцы тянутся к щеке
  // вверх и влево; так предплечье идёт перед грудью, а не по ключице
  const CHEEK_L = { fingers: dir(0.35, 0.88, 0.3), palm: dir(0.55, 0.05, -0.83), pole: V(-0.2, -0.9, 0.35), shape: SH.flatThumbOutL };
  const ya1 = touch({ t: 0.26, ...YA }, { spot: 'грудь', on: 'body', point: 'tip' });
  const ya2 = { ...ya1, t: 0.42, ease: 'lin' };
  const lips1 = touch({ t: 0.60, ...LIPS }, { spot: 'губы', on: 'face', point: 'pads' });
  const lips2 = { ...lips1, t: 0.76, ease: 'lin' };
  const heart1 = touch({ t: 0.94, ...HEART }, { spot: 'сердце', on: 'body', point: 'palm' });
  const heart2 = { ...heart1, t: 1.12, ease: 'lin' };
  // у щёк носительница касается пальцами — ладонь ниже, у челюсти (у носителя основания пальцев
  // на уровне подбородка, кончики — у щеки)
  const cheekR1 = touch({ t: 1.34, ...CHEEK_R }, { spot: 'щека справа', on: 'face', point: 'pads' });
  const cheekR2 = { ...cheekR1, t: 1.44, ease: 'lin' };
  const cheekL1 = touch({ t: 1.62, ...CHEEK_L }, { spot: 'щека слева', on: 'face', point: 'pads' });
  const cheekL2 = { ...cheekL1, t: 1.82, ease: 'lin' };
  // проход от щеки к щеке — перед подбородком (у носителя кисть на уровне подбородка), не сквозь лицо
  // (запястье у носителя на линии плеч, кончики пальцев — у рта)
  const sweep = { t: 1.53, pos: K.faceSpot('подбородок').add(V(0.01, -0.13, 0.15)), fingers: dir(0.2, 0.95, 0.25), palm: dir(0.7, 0.1, -0.7), pole: V(-0.35, -0.9, 0.25), shape: SH.flatClosed, ease: 'sine' };
  // переходы: от груди к губам — перед подбородком; от сердца к щеке — от груди вперёд
  const toLips = { ...lips1, t: 0.52, pos: lips1.pos.clone().add(V(0, -0.06, 0.06)), ease: 'sine' };
  const toCheek = { t: 1.23, pos: heart2.pos.clone().lerp(cheekR1.pos, 0.45).add(V(-0.02, 0, 0.09)), fingers: dir(0.4, 0.9, 0.2), palm: dir(0.6, 0.1, -0.8), pole: V(-0.4, -0.85, 0.15), shape: SH.flatClosed, ease: 'sine' };
  const right = [
    { t: 0, idle: true },
    { ...ya1, ease: 'out' }, ya2,
    toLips,
    { ...lips1, ease: 'out' }, lips2,
    { ...heart1, ease: 'io' }, heart2,
    toCheek,
    { ...cheekR1, ease: 'sine' }, cheekR2,
    sweep,
    { ...cheekL1, ease: 'sine' }, cheekL2,
    // от левой щеки рука уходит вниз перед грудью (прямо в покой — прошла бы сквозь неё)
    { t: 1.96, pos: K.ref(-0.05, -0.45, 0.85), fingers: dir(0.3, 0.6, 0.75), palm: dir(0.5, 0.3, -0.8), pole: V(-0.3, -0.9, 0.3), shape: SH.flatClosed, ease: 'sine' },
    { t: 2.16, idle: true },
  ];
  const left = [{ t: 0, idle: true }, { t: 2.16, idle: true }];
  const head = [{ t: 0, pitch: 0 }, { t: 2.16, pitch: 0 }];
  return {
    name: 'ya-lyublyu-mamu', duration: 2.16, right, left, head,
    description:
      'РЖЯ «Я люблю маму» = Я + ЛЮБИТЬ + МАМА по видео словаря SpreadTheSign RU: Я — указательный к груди ' +
      '(word 1293), ЛЮБИТЬ — пальцы к губам, затем ладонь на сердце (sentence 2791), МАМА — ладонь у правой ' +
      'щеки, затем у левой (word 1284). Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ «Я хочу есть» = Я + ХОТЕТЬ + ЕСТЬ ═══════════════
// Целиком фразы в словаре нет. ХОТЕТЬ и ЕСТЬ — подряд из sentence/8799 «Ты хочешь есть?» (видео 100721,
// одна носительница), Я — word/1293 (видео 12788). Порядок — как во фразе переводчика: Я ХОТЕТЬ ЕСТЬ.
//   ХОТЕТЬ 0.62–0.78 с: кулак с вытянутым вверх большим пальцем (в кадре 42–65°), ладонью к груди
//          (3D (−0.15…0.17, −0.02…0.25, −0.96…−1.0)), костяшки на левой стороне груди, пясть к
//          середине и вверх (35–38°).
//   ЕСТЬ   0.98–1.38 с: пальцы сомкнуты, кончиками у нижней губы (крупно: тыл кисти к зрителю, большой
//          закрыт пальцами); пясть вверх и чуть к зрителю
//          (в кадре 75–79°), ладонь вверх-назад (3D (−0.06…−0.22, 0.58…0.68, −0.73…−0.79));
//          кисть слегка постукивает (запястье ±0.015 ширины плеч).
function yaKhochuEst() {
  const T0 = 0.12; // ХОТЕТЬ и ЕСТЬ: время жеста = время видео 100721 − T0 (после Я и перехода)
  const at = (tr) => +(tr - T0).toFixed(3);
  const YA = { fingers: dir(0.68, 0.62, -0.35), palm: dir(-0.4, -0.3, -0.87), pole: V(-0.35, -0.9, 0.1), shape: SH.pointIn };
  const WANT = { fingers: dir(0.8, 0.55, -0.1), palm: dir(-0.05, 0.1, -0.99), pole: V(-0.3, -0.9, 0.15), shape: SH.fistThumb };
  // пясть вертикальнее, чем у носительницы (у неё 3D (0.2, 0.77, 0.6)): у Елнара кисть длиннее, и при её
  // наклоне запястье уходило в ворот свитера; в кадре пясть та же — 75–79°
  const EAT = { fingers: dir(0.2, 0.9, 0.25), palm: dir(-0.12, 0.3, -0.95), pole: V(-0.35, -0.9, 0.25), shape: SH.bunch };
  const ya1 = touch({ t: 0.10, ...YA }, { spot: 'грудь', on: 'body', point: 'tip' });
  const want1 = touch({ t: at(0.64), ...WANT }, { spot: 'грудь слева', on: 'body', point: 'fist' });
  // от Я к ХОТЕТЬ — через «от груди вперёд» (прямо — большой палец чиркнул бы по свитеру)
  const toWant = { t: 0.44, pos: ya1.pos.clone().lerp(want1.pos, 0.5).add(V(0, 0.01, 0.06)), fingers: dir(0.75, 0.6, -0.2), palm: dir(-0.2, -0.1, -0.97), pole: V(-0.33, -0.9, 0.12), shape: mixShape(SH.pointIn, SH.fistThumb, 0.5), ease: 'sine' };
  // щепоть — у правого уголка рта (у носительницы кончики на 0.1 ширины плеч правее середины лица)
  const eat1 = touch({ t: at(1.00), ...EAT }, { spot: 'угол рта справа', on: 'face', point: 'pads' });
  // лёгкое постукивание: на сантиметр от губ и обратно, дважды
  const away = (k, t) => ({ ...k, t, pos: k.pos.clone().add(V(0, -0.003, 0.004)), ease: 'sine' });
  const right = [
    { t: 0, idle: true },
    { ...ya1, t: 0.24, ease: 'out' }, { ...ya1, t: 0.36, ease: 'lin' },
    toWant,
    { ...want1, ease: 'sine' }, { ...want1, t: at(0.78), ease: 'lin' },
    // от груди к губам — сначала от груди вперёд (иначе согнутые пальцы чиркают по свитеру)
    { t: at(0.87), pos: want1.pos.clone().lerp(eat1.pos, 0.4).add(V(0, 0, 0.07)), fingers: dir(0.5, 0.7, 0.5), palm: dir(-0.1, 0.4, -0.9), pole: V(-0.32, -0.9, 0.2), shape: mixShape(SH.fistThumb, SH.bunch, 0.5), ease: 'sine' },
    { ...eat1, ease: 'sine' },
    away(eat1, at(1.07)), { ...eat1, t: at(1.14), ease: 'sine' },
    away(eat1, at(1.21)), { ...eat1, t: at(1.28), ease: 'sine' },
    { ...eat1, t: at(1.36), ease: 'lin' },
    // вниз перед грудью (прямо в покой — прошла бы сквозь неё)
    { t: at(1.50), pos: K.ref(-0.2, -0.55, 0.8), fingers: dir(0.3, 0.5, 0.8), palm: dir(0, 0.8, -0.6), pole: V(-0.35, -0.9, 0.2), shape: mixShape(SH.bunch, SH.rest, 0.5), ease: 'sine' },
    { t: at(1.66), idle: true },
  ];
  const left = [{ t: 0, idle: true }, { t: at(1.66), idle: true }];
  const head = [{ t: 0, pitch: 0 }, { t: at(1.66), pitch: 0 }];
  return {
    name: 'ya-khochu-est', duration: at(1.66), right, left, head,
    description:
      'РЖЯ «Я хочу есть» = Я + ХОТЕТЬ + ЕСТЬ по видео словаря SpreadTheSign RU: Я — указательный к груди ' +
      '(word 1293); ХОТЕТЬ — кулак с поднятым большим пальцем ладонью к левой стороне груди, ЕСТЬ — щепоть ' +
      'у губ, лёгкое постукивание (sentence 8799 «Ты хочешь есть?»). Поза решена IK на avatar_elnar.glb.',
  };
}

/** Кисть, отклонённая в запястье в плоскости ладони: deg > 0 — к мизинцу, < 0 — к большому (правая рука). */
function deviate(o, deg) {
  const y = o.fingers.clone().normalize();
  const z = o.palm.clone().sub(y.clone().multiplyScalar(o.palm.dot(y))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z); // к большому пальцу
  return { ...o, fingers: y.multiplyScalar(Math.cos(rad(deg))).add(x.multiplyScalar(-Math.sin(rad(deg)))).normalize(), palm: z };
}

// ═══════════════ «Кто там» = КТО + ТАМ ═══════════════
// Целиком фразы в словаре нет — знаки из видео слов того же словаря (RU). Порядок — как во фразе
// переводчика: КТО ТАМ.
//   КТО — word/478 (видео 4706), 1.04–1.80 с: правая кисть перед правой стороной груди; указательный и
//         средний выпрямлены и сомкнуты, большой поднят вдоль них, безымянный и мизинец согнуты (крупно:
//         «палец» вверх шириной в два, согнутые — к середине тела). Ладонь к середине тела и к зрителю
//         (порядок оснований пальцев в кадре: большой — к середине, мизинец — наружу; согнутые пальцы
//         смотрят к середине), пясть вверх и наружу (в кадре 110–116°). Кисть покачивается в запястье к
//         мизинцу и обратно, 4 раза, ~5 в секунду (указательный в кадре 103–106° ↔ 112–116°; в 3D пальцы
//         уходят наружу и к зрителю); запястье (−0.29…−0.34, −0.28…−0.40), медленно опускается.
//   ТАМ — word/3907 (видео 43113), 1.06–1.90 с: рука поднимается в сторону — локоть наружу почти на уровне
//         плеча (−1.08, −0.10), кисть над плечом у головы (−0.77, 0.65). Указательный согнут в основании
//         (~40°) и показывает вверх, наружу и вперёд (в кадре 135–155°), остальные пальцы сжаты, большой
//         поверх них. Ладонь к зрителю и наружу (основания пальцев в кадре — большой к середине; согнутые
//         пальцы и кончик указательного уходят наружу). По пути указательный смотрит вперёд (1.10–1.22),
//         потом вверх (1.30, 121°) и наружу (1.46, 155°); два лёгких толчка (1.46, 1.68 с); вниз к 2.40.
function ktoTam() {
  const T0A = 0.66, T0B = -0.16; // КТО: время жеста = время видео 4706 − T0A; ТАМ: видео 43113 − T0B
  const atA = (tr) => +(tr - T0A).toFixed(3), atB = (tr) => +(tr - T0B).toFixed(3);
  // КТО: ладонь к середине и к зрителю, пясть вверх и наружу; «наклон» — отклонение к мизинцу
  const KTO = { fingers: dir(-0.33, 0.9, 0.26), palm: dir(0.87, 0.15, 0.47), shape: SH.kto };
  const KTO_T = deviate(KTO, 12);
  const E_KTO = [-0.72, -0.76];
  const kto = (tr, w2, o) => refKey('right', atA(tr), w2, E_KTO, { ...o, ease: 'sine' });
  // ТАМ: пясть вверх и чуть наружу, ладонь к зрителю и наружу; толчок — указательный сгибается сильнее
  const TAM = { fingers: dir(-0.13, 0.96, 0.25), palm: dir(-0.7, -0.2, 0.68), shape: SH.pointFar };
  const TAM_P = { ...TAM, fingers: dir(-0.19, 0.95, 0.25), shape: shape({ ...SH.pointFar, index: { curl: [42, 16, 7], spread: 2 } }) };
  const E_TAM = [-1.08, -0.10];
  const tam = (tr, w2, o, ease = 'sine') => refKey('right', atB(tr), w2, E_TAM, { ...o, ease }, { zMin: 0.0 });
  const right = [
    { t: 0, idle: true },
    { t: atA(0.74), idle: true },
    { ...kto(1.04, [-0.34, -0.36], KTO_T), ease: 'out' },
    kto(1.12, [-0.30, -0.29], KTO),
    kto(1.24, [-0.30, -0.325], KTO_T),
    kto(1.34, [-0.29, -0.33], KTO),
    kto(1.44, [-0.305, -0.36], KTO_T),
    kto(1.54, [-0.30, -0.35], KTO),
    kto(1.64, [-0.31, -0.37], KTO_T),
    kto(1.74, [-0.31, -0.39], KTO),
    { ...kto(1.80, [-0.315, -0.405], KTO), ease: 'lin' },
    // рука идёт вверх и в сторону; указательный сначала смотрит вверх (у носительницы 1.30 с: пясть 85°,
    // ладонь к зрителю), затем уходит наружу
    tam(1.30, [-0.64, 0.48], { fingers: dir(0.05, 0.98, 0.15), palm: dir(-0.3, -0.15, 0.94), shape: SH.pointFar }, 'io'),
    tam(1.46, [-0.79, 0.66], TAM_P, 'out'),
    tam(1.56, [-0.75, 0.65], TAM),
    tam(1.68, [-0.77, 0.66], TAM_P),
    { ...tam(1.90, [-0.78, 0.60], TAM), ease: 'sine' },
    // вниз рука идёт быстро и перед собой: у носительницы к 2.10 с кисть у плеча, указательный вперёд
    { ...refKey('right', atB(2.10), [-0.72, 0.15], [-1.11, -0.42], { fingers: dir(0.3, 0.6, 0.75), palm: dir(0.2, -0.75, 0.6), shape: mixShape(SH.pointFar, SH.rest, 0.3) }, { zMin: 0.0 }), ease: 'in' },
    { t: atB(2.38), idle: true, ease: 'out' },
  ];
  const left = [{ t: 0, idle: true }, { t: atB(2.38), idle: true }];
  const head = [{ t: 0, pitch: 0 }, { t: atB(2.38), pitch: 0 }];
  return {
    name: 'kto-tam', duration: atB(2.40), right, left, head,
    description:
      'РЖЯ «Кто там» = КТО + ТАМ по видео словаря SpreadTheSign RU: КТО — указательный и средний вверх, кисть ' +
      'покачивается у правой стороны груди (word 478); ТАМ — рука поднята в сторону, указательный показывает ' +
      'вверх и вдаль (word 3907). Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ «Мы работаем сегодня» = МЫ + РАБОТАТЬ + СЕГОДНЯ ═══════════════
// Целиком фразы в словаре нет — знаки из видео слов того же словаря (RU), порядок как во фразе
// переводчика: МЫ РАБОТАТЬ СЕГОДНЯ.
//   МЫ       — word/5714 (видео 349185), 1.06–1.74 с: правая кисть «лодочкой», пальцы вместе и согнуты,
//              ладонь к себе и вверх, пальцы к середине тела и вперёд; кисть описывает круг перед правой
//              половиной корпуса: сбоку (−0.88, −0.47) вперёд к середине (−0.21, −0.19; кисть в кадре
//              крупнее всего — ближе к камере) и обратно вправо к телу (−0.87, −0.40…−0.52).
//   РАБОТАТЬ — word/21687 (видео 319938), 0.70–1.38 с: правое предплечье поперёк груди (локоть справа
//              (−0.8, −0.62), запястье у середины (−0.05…−0.13, −0.09…−0.28)), ладонь вниз, указательный и
//              средний согнуты в основании и смотрят вниз, остальные сжаты; кисть качается в запястье вверх
//              (пясть в кадре +20…+29°) и вниз (−20…−25°) — три раза, ~3.6 в секунду.
//   СЕГОДНЯ  — word/428 (видео 4204), 1.46–2.38 с: обе кисти у пояса по бокам, предплечья вперёд, ладони
//              вверх и к себе, пальцы согнуты «чашей» и смотрят вверх, большие отставлены; кисти коротко
//              опускаются (1.66), поднимаются (1.78) и опускаются снова (1.90), держат до 2.38.
function myRabotatSegodnya() {
  const T0A = 0.80, T0B = -0.48, T0C = -0.66; // время жеста = время видео − T0 (МЫ, РАБОТАТЬ, СЕГОДНЯ)
  const atA = (tr) => +(tr - T0A).toFixed(3), atB = (tr) => +(tr - T0B).toFixed(3), atC = (tr) => +(tr - T0C).toFixed(3);
  const my = (tr, w2, e2, fingers, palm, ease = 'sine', sh = SH.cupped) => refKey('right', atA(tr), w2, e2, { fingers, palm, shape: sh, ease });
  // РАБОТАТЬ: ладонь вниз, пясть к середине тела; качание — сгиб и разгиб в запястье
  const E_RAB = [-0.80, -0.62];
  const UP = { fingers: dir(0.87, 0.45, 0.2), palm: dir(0.45, -0.89, 0), shape: SH.bentTwo };
  const DOWN = { fingers: dir(0.88, -0.3, 0.37), palm: dir(-0.33, -0.94, 0.06), shape: SH.bentTwo };
  const rab = (tr, w2, o, ease = 'sine') => refKey('right', atB(tr), w2, E_RAB, { ...o, ease }, { zMin: 0.2 });
  // СЕГОДНЯ: пясть вперёд и вверх, ладонь вверх и к себе
  const sgR = (tr, w2, fingers, palm, ease = 'sine') => refKey('right', atC(tr), w2, [-0.52, -0.84], { fingers, palm, shape: SH.bowl, ease }, { zMin: 0.2 });
  const sgL = (tr, w2, fingers, palm, ease = 'sine') => refKey('left', atC(tr), w2, [0.58, -0.82], { fingers, palm, shape: SH.bowl, ease }, { zMin: 0.2 });
  const right = [
    { t: 0, idle: true },
    { t: atA(0.90), idle: true },
    // ладонь к себе и чуть вниз: согнутые пальцы в кадре уходят ниже пясти (указательный на 25–35°
    // ниже неё), большой смотрит вверх (у MediaPipe нормаль здесь вверх — не сходится с изгибом пальцев)
    { ...my(1.10, [-0.77, -0.40], [-0.75, -0.70], dir(0.3, 0.6, 0.74), dir(0.75, -0.2, -0.6)), ease: 'out' },
    // к середине кисть идёт быстро (у носителя за 0.08 с — на 0.4 ширины плеч)
    my(1.17, [-0.39, -0.24], [-0.78, -0.72], dir(0.35, 0.53, 0.77), dir(0.8, -0.25, -0.55)),
    my(1.26, [-0.21, -0.19], [-0.83, -0.74], dir(0.62, 0.40, 0.68), dir(0.7, -0.25, -0.67)),
    my(1.38, [-0.41, -0.25], [-0.98, -0.65], dir(0.85, 0.32, 0.42), dir(0.3, -0.35, -0.88)),
    my(1.56, [-0.88, -0.40], [-0.97, -0.65], dir(0.55, 0.28, 0.79), dir(0.35, -0.3, -0.88), 'sine', SH.cuppedThumbUp),
    my(1.70, [-0.86, -0.52], [-0.89, -0.70], dir(0.56, 0.31, 0.77), dir(0.45, -0.3, -0.84), 'lin', SH.cuppedThumbUp),
    // к РАБОТАТЬ: кисть идёт к середине груди и ложится ладонью вниз
    rab(0.70, [-0.11, -0.22], UP, 'io'),
    rab(0.86, [-0.12, -0.18], DOWN),
    rab(0.98, [-0.07, -0.11], UP),
    rab(1.14, [-0.10, -0.12], DOWN),
    rab(1.26, [-0.05, -0.09], UP),
    rab(1.38, [-0.06, -0.26], DOWN),
    // к СЕГОДНЯ: кисть уходит вниз и в сторону, к поясу, и поворачивается ладонью вверх через «ребро»
    // (ладонь к середине тела) — разворот на 174° одним слерпом пошёл бы не той стороной
    { ...refKey('right', 2.01, [-0.42, -0.50], [-0.65, -0.75], { fingers: dir(0.35, 0.3, 0.88), palm: dir(0.9, 0.2, -0.35), shape: mixShape(SH.bentTwo, SH.bowl, 0.5) }, { zMin: 0.2 }), ease: 'sine' },
    // пясть у Елнара чуть ближе к вертикали, чем у MediaPipe (у носительницы в кадре 82–108°)
    sgR(1.50, [-0.68, -0.67], dir(0.05, 0.84, 0.54), dir(-0.16, 0.52, -0.84), 'sine'),
    sgR(1.58, [-0.73, -0.80], dir(0.07, 0.75, 0.66), dir(0.18, 0.66, -0.73)),
    sgR(1.68, [-0.67, -1.06], dir(-0.05, 0.72, 0.65), dir(-0.05, 0.66, -0.74)),
    sgR(1.78, [-0.65, -0.91], dir(0.08, 0.72, 0.7), dir(-0.1, 0.69, -0.72)),
    sgR(1.92, [-0.64, -1.03], dir(0.1, 0.68, 0.73), dir(-0.03, 0.74, -0.67)),
    sgR(2.10, [-0.66, -1.03], dir(0.19, 0.62, 0.78), dir(0.01, 0.78, -0.63), 'lin'),
    sgR(2.38, [-0.64, -1.08], dir(0.26, 0.6, 0.79), dir(0.04, 0.79, -0.61), 'lin'),
    { t: atC(2.64), idle: true, ease: 'io' },
  ];
  const left = [
    { t: 0, idle: true },
    { t: atC(1.30), idle: true },
    { ...sgL(1.54, [0.79, -0.75], dir(0.06, 0.8, 0.57), dir(-0.17, 0.6, -0.78)), ease: 'out' },
    sgL(1.58, [0.78, -0.81], dir(0.08, 0.69, 0.68), dir(-0.12, 0.72, -0.69)),
    sgL(1.68, [0.77, -1.17], dir(0.4, 0.45, 0.8), dir(0.08, 0.86, -0.5)),
    sgL(1.78, [0.72, -0.98], dir(0.15, 0.6, 0.74), dir(-0.04, 0.78, -0.62)),
    sgL(1.92, [0.70, -1.12], dir(0.12, 0.58, 0.75), dir(-0.04, 0.8, -0.6)),
    sgL(2.10, [0.72, -1.09], dir(0.06, 0.53, 0.81), dir(0.01, 0.84, -0.55), 'lin'),
    sgL(2.38, [0.69, -1.18], dir(0.0, 0.55, 0.82), dir(0.08, 0.83, -0.56), 'lin'),
    { t: atC(2.64), idle: true, ease: 'io' },
  ];
  const head = [{ t: 0, pitch: 0 }, { t: atC(2.64), pitch: 0 }];
  return {
    name: 'my-rabotat-segodnya', duration: atC(2.66), right, left, head,
    description:
      'РЖЯ «Мы работаем сегодня» = МЫ + РАБОТАТЬ + СЕГОДНЯ по видео словаря SpreadTheSign RU: МЫ — ладонь к себе ' +
      'описывает круг перед корпусом (word 5714); РАБОТАТЬ — предплечье поперёк груди, кисть с согнутыми ' +
      'указательным и средним качается в запястье (word 21687); СЕГОДНЯ — обе кисти ладонями вверх у пояса ' +
      'опускаются (word 428). Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ «Ты идёшь в школу завтра» = ТЫ + ИДТИ + ШКОЛА + ЗАВТРА ═══════════════
// Целиком фразы в словаре нет — знаки из видео слов того же словаря (RU), порядок как во фразе
// переводчика: ТЫ ИДТИ ШКОЛА ЗАВТРА.
//   ТЫ     — word/1294 (видео 12804), 1.46–1.74 с: указательный смотрит на собеседника (в кадре укорочен
//            почти в точку), кисть перед правой стороной груди (−0.21…−0.24, −0.11…−0.18), пясть вверх и
//            вперёд, ладонь вниз и вперёд, остальные пальцы сжаты.
//   ИДТИ   — word/7452 (видео 227981), 0.66–1.26 с: обе кисти у пояса, прямые пальцы вместе смотрят к середине
//            и вперёд, большие сверху; кисти по очереди уходят вперёд и назад — «шаги» (в кадре передняя
//            кисть отходит наружу: правая −0.69 ↔ −0.88…−0.95, левая 0.81 ↔ 0.66, в противофазе).
//   ШКОЛА  — word/1305 (видео 12914): 1.58–1.74 с — обе кисти «Г» перед грудью, указательные к середине и
//            вверх (кончики почти сходятся — «крыша»), большие навстречу друг другу; 1.78–1.90 кисти
//            расходятся в стороны; 1.90–2.22 — по бокам на уровне пояса, указательные вверх («стены»).
//   ЗАВТРА — word/427 (видео 4186), 1.82–2.58 с: кулак с поднятым большим у правой стороны лица, ладонь к
//            лицу; кисть дважды уходит наружу и вперёд, разворачиваясь ладонью вперёд (1.86 → 2.04, 2.20 → 2.36).
function tyIdtiShkolaZavtra() {
  const T0A = 1.06, T0B = -0.40, T0C = -0.38, T0D = -1.09;
  const atA = (tr) => +(tr - T0A).toFixed(3), atB = (tr) => +(tr - T0B).toFixed(3);
  const atC = (tr) => +(tr - T0C).toFixed(3), atD = (tr) => +(tr - T0D).toFixed(3);
  // ИДТИ: плоские кисти; шаг — кисть вперёд (глубже к камере) или назад
  // ладони вниз: большие в кадре смотрят к середине, как у носительницы (у MediaPipe нормаль правой — вверх,
  // но тогда большой смотрел бы наружу)
  // пальцы прямые, в кадре почти горизонтальны (у носительницы указательный −5° при пясти −11°)
  const FLAT = shape({ ...SH.flatClosed, index: { curl: [0, 0, 0], spread: 8 }, middle: { curl: [0, 0, 0], spread: 0 },
    ring: { curl: [1, 0, 0], spread: -7 }, pinky: { curl: [2, 0, 0], spread: -14 } });
  const STEP_R = { fingers: dir(0.72, 0.06, 0.68), palm: dir(0.1, -0.95, -0.2), shape: FLAT };
  const STEP_L = { fingers: dir(-0.72, 0.02, 0.68), palm: dir(-0.1, -0.95, -0.2), shape: FLAT };
  const FWD = { zMin: 0.75, zMax: 0.95, zPref: 0.85 }, BACK = { zMin: 0.35, zMax: 0.55, zPref: 0.45 };
  const step = (side, tr, w2, fwd) => refKey(side, atB(tr), w2, side === 'right' ? [-1.04, -0.80] : [0.9, -0.81],
    { ...(side === 'right' ? STEP_R : STEP_L), ease: 'sine' }, fwd ? FWD : BACK);
  // ШКОЛА
  // «крыша» — перед грудью, чуть дальше от неё: большие пальцы смотрят друг на друга и не должны задевать свитер
  const school = (side, tr, w2, e2, fingers, palm, ease = 'sine', z = { zMin: 0.2 }) => refKey(side, atC(tr), w2, e2, { fingers, palm, shape: SH.lHand, ease }, z);
  const ROOF = { zMin: 0.7, zMax: 0.9, zPref: 0.75 };
  // ЗАВТРА: большой палец у щеки ставится по лицу Елнара (голова у него уже, по кадру носительницы кулак
  // висел бы в 4–5 см от щеки); от щеки кисть уходит наружу и вперёд на столько же, сколько у неё
  const E_ZAV = [-0.77, -0.66];
  const zav = (tr, w2, fingers, palm, ease = 'sine') => refKey('right', atD(tr), w2, E_ZAV, { fingers, palm, shape: SH.fistThumb, ease });
  const cheek = (tr, w2, fingers, palm) => touch(zav(tr, w2, fingers, palm), { spot: 'сбоку щеки справа', on: 'face', point: 'thumb' });
  const z1 = cheek(1.86, [-0.60, 0.24], dir(0.02, 0.99, -0.13), dir(0.92, 0.03, 0.38));
  const z3 = cheek(2.18, [-0.63, 0.30], dir(0.1, 0.93, -0.35), dir(0.75, 0.16, 0.64));
  // от щеки большой отводится и смотрит обратно к лицу (у носительницы в кадре 42–58°, у щеки — вверх)
  const THUMB_OUT = shape({ ...SH.fistThumb, thumb: { abd: -5, f1: -20, f2: 0, f3: 0 } });
  const away = (k, tr, d2, fingers, palm) => ({ ...zav(tr, [0, 0], fingers, palm), shape: THUMB_OUT, pos: k.pos.clone().add(V(d2[0] * K.SW, d2[1] * K.SW, 0.035)) });
  const right = [
    { t: 0, idle: true },
    { t: atA(1.14), idle: true },
    // пясть вперёд сильнее, чем у MediaPipe: согнутый на 35° указательный тогда смотрит прямо в камеру,
    // как у носителя (в кадре он укорочен почти в точку), а не вверх к середине
    { ...refKey('right', atA(1.46), [-0.24, -0.11], [-0.68, -0.69], { fingers: dir(0.1, 0.62, 0.78), palm: dir(0.3, -0.76, 0.58), shape: SH.pointYou }), ease: 'out' },
    { ...refKey('right', atA(1.74), [-0.22, -0.18], [-0.68, -0.70], { fingers: dir(0.12, 0.55, 0.83), palm: dir(0.3, -0.8, 0.5), shape: SH.pointYou }), ease: 'lin' },
    { ...step('right', 0.66, [-0.69, -0.79], false), ease: 'io' },
    step('right', 0.86, [-0.88, -0.84], true),
    step('right', 1.06, [-0.70, -0.89], false),
    step('right', 1.26, [-0.95, -0.88], true),
    school('right', 1.62, [-0.47, -0.27], [-1.05, -0.75], dir(0.51, 0.74, 0.44), dir(0.29, -0.63, 0.72), 'io', ROOF),
    school('right', 1.72, [-0.53, -0.25], [-1.08, -0.75], dir(0.58, 0.71, 0.4), dir(0.27, -0.63, 0.73), 'lin', ROOF),
    school('right', 1.94, [-0.95, -0.45], [-1.0, -0.86], dir(0.04, 0.83, 0.55), dir(0.04, -0.56, 0.83)),
    school('right', 2.22, [-0.88, -0.49], [-0.98, -0.90], dir(0.0, 0.74, 0.67), dir(-0.01, -0.67, 0.74), 'lin'),
    { ...z1, ease: 'io' }, { ...z1, t: atD(1.92), ease: 'lin' },
    away(z1, 2.04, [-0.14, 0.10], dir(0.0, 0.99, -0.1), dir(0.39, 0.09, 0.91)),
    { ...z3, ease: 'sine' }, { ...z3, t: atD(2.22), ease: 'lin' },
    away(z3, 2.36, [-0.12, 0.05], dir(0.0, 0.98, -0.2), dir(0.45, 0.13, 0.88)),
    zav(2.50, [-0.76, 0.21], dir(-0.03, 0.94, 0.34), dir(0.63, -0.25, 0.73)),
    { t: atD(2.74), idle: true, ease: 'io' },
  ];
  const left = [
    { t: 0, idle: true },
    { t: atB(0.36), idle: true },
    { ...step('left', 0.66, [0.81, -0.73], true), ease: 'out' },
    step('left', 0.86, [0.66, -0.80], false),
    step('left', 1.06, [0.75, -0.79], true),
    step('left', 1.26, [0.66, -0.83], false),
    school('left', 1.62, [0.46, -0.20], [1.07, -0.76], dir(-0.59, 0.78, 0.21), dir(-0.42, -0.51, 0.75), 'io', ROOF),
    school('left', 1.72, [0.52, -0.21], [1.07, -0.75], dir(-0.66, 0.74, 0.11), dir(-0.38, -0.46, 0.8), 'lin', ROOF),
    school('left', 1.94, [1.07, -0.29], [1.0, -0.84], dir(-0.12, 0.84, 0.54), dir(-0.06, -0.54, 0.84)),
    school('left', 2.22, [1.00, -0.41], [0.95, -0.88], dir(-0.1, 0.74, 0.67), dir(0.01, -0.67, 0.74), 'lin'),
    { t: atC(2.50), idle: true, ease: 'io' },
    { t: atD(2.74), idle: true },
  ];
  const head = [{ t: 0, pitch: 0 }, { t: atD(2.74), pitch: 0 }];
  return {
    name: 'ty-idti-shkola-zavtra', duration: atD(2.76), right, left, head,
    description:
      'РЖЯ «Ты идёшь в школу завтра» = ТЫ + ИДТИ + ШКОЛА + ЗАВТРА по видео словаря SpreadTheSign RU: ТЫ — ' +
      'указательный на собеседника (word 1294); ИДТИ — плоские кисти у пояса по очереди шагают вперёд (word 7452); ' +
      'ШКОЛА — кисти «Г» сходятся «крышей» перед грудью и расходятся «стенами» (word 1305); ЗАВТРА — кулак с ' +
      'поднятым большим у правой стороны лица уходит вперёд (word 427). Поза решена IK на avatar_elnar.glb.',
  };
}

// ═══════════════ «До свидания» ═══════════════
// Эталон — spreadthesign.com/ru.ru/sentence/1297 «До свидания» (видео 12833). Время жеста = время записи − 1.40 с.
// Пересборка 26.09 (пользователь: прежняя версия неверна): пальцы при взмахе торчали прямыми «палками» под прямым
// углом к ладони — у носителя они мягко сгибаются во всех суставах; в конце кисть сжимается в кулак.
//   1.50–1.86 правая поднимается к правой стороне лица; 1.86–2.46 кисть стоит у щеки: запястье (−0.58…−0.52,
//   −0.08…0.00), локоть в сторону (−0.84…−0.87, −0.70…−0.74). Ладонь к зрителю, к середине и чуть вверх
//   (3D (0.34…0.49, 0.35…0.51, 0.73…0.87)), пясть вертикально (в кадре 86–92°), верх кисти чуть от зрителя.
//   Пальцы вместе, большой вдоль указательного; пальцы сгибаются в основании к зрителю и разгибаются — три раза,
//   ~4 в секунду (указательный в кадре 68–74° ↔ 41–48°: сгиб 1.84, 2.08, 2.31; прямые 1.96, 2.20, 2.42); в 2.50
//   пальцы сжимаются, 2.62–2.94 рука опускается.
function doSvidaniya() {
  const T0 = 1.40;
  const at = (tr) => +(tr - T0).toFixed(3);
  const HAND = { fingers: dir(-0.04, 0.9, -0.43), palm: dir(0.4, 0.42, 0.81) };
  const E = [-0.86, -0.72];
  // кисть у Елнара длиннее относительно плеч (0.55 ширины плеч против 0.50): запястье на 0.04 ниже, чтобы кисть
  // стояла у щеки, как у носителя, а не у глаз
  const k = (tr, w2, sh, ease = 'sine') => refKey('right', at(tr), [w2[0], w2[1] - 0.04], E, { ...HAND, shape: sh, ease });
  const right = [
    { t: 0, idle: true },
    { t: at(1.48), idle: true },
    { ...k(1.78, [-0.60, -0.19], SH.byeUp), ease: 'io' },
    k(1.85, [-0.58, -0.09], SH.byeBent),
    k(1.96, [-0.565, -0.02], SH.byeUp),
    k(2.08, [-0.55, -0.02], SH.byeBent),
    k(2.19, [-0.535, 0.00], SH.byeUp),
    k(2.31, [-0.535, -0.01], SH.byeBent),
    k(2.42, [-0.52, -0.01], SH.byeUp),
    k(2.52, [-0.52, -0.05], SH.byeClosed),
    k(2.62, [-0.51, -0.17], SH.byeClosed, 'lin'),
    { t: at(2.94), idle: true, ease: 'io' },
  ];
  const left = [{ t: 0, idle: true }, { t: at(2.94), idle: true }];
  const head = [{ t: 0, pitch: 0 }, { t: at(2.94), pitch: 0 }];
  return {
    name: 'do-svidaniya', duration: at(2.96), right, left, head,
    description:
      'РЖЯ «До свидания», как у носителя в SpreadTheSign RU sentence 1297 (видео 12833), в его темпе: правая кисть ' +
      'у правой стороны лица ладонью к зрителю, пальцы вместе трижды сгибаются в основании и разгибаются, в конце ' +
      'сжимаются, рука опускается. Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ ХОРОШО ═══════════════
// Эталон — spreadthesign.com/ru.ru/word/91 «хорошо» (видео 900). Время жеста = время записи − 1.18 с.
//   1.36–1.54 правая поднимается: кулак, большой палец вверх; 1.54–1.62 кисть выше всего — запястье (−0.39…−0.42,
//   −0.31…−0.38), пясть вперёд и вверх (3D (0.04…0.12, 0.45…0.75, 0.66…0.88)); 1.66–1.78 опускается и держится до
//   2.22 у правой стороны груди: запястье (−0.39…−0.43, −0.43…−0.48), пясть на зрителя (3D (−0.07…0, 0.08…0.16,
//   0.99)), ладонь к середине тела (3D (0.95…1.0, −0.3…−0.02, 0…0.14)), большой вверх (в кадре 83–97°); локоть
//   (−0.73…−0.78, −0.73…−0.78). 2.26–2.46 рука опускается.
function khorosho() {
  const T0 = 1.18; // пересборка 26.09: подъём начинается в 1.24 с, сдвиг T0 — чтобы жест начинался с покоя
  const at = (tr) => +(tr - T0).toFixed(3);
  const E = [-0.75, -0.75];
  const UP = { fingers: dir(0.08, 0.6, 0.8), palm: dir(0.99, -0.1, 0), shape: SH.thumbUp };
  const HOLD = { fingers: dir(-0.05, 0.12, 0.99), palm: dir(0.97, -0.2, 0.08), shape: SH.thumbUp };
  const right = [
    { t: 0, idle: true },
    // подъём у носителя начинается в 1.24 с, кисть поднимается раскрытой и сжимается в кулак у груди к 1.50
    // (пересборка 26.09: прежде подъём начинался на 0.1 с позже)
    { t: at(1.24), idle: true },
    { ...refKey('right', at(1.46), [-0.43, -0.51], E, { fingers: dir(0.2, 0.9, 0.4), palm: dir(0.9, -0.25, -0.35), shape: mixShape(SH.rest, SH.thumbUp, 0.35) }), ease: 'io' },
    { ...refKey('right', at(1.55), [-0.42, -0.33], E, UP), ease: 'sine' },
    { ...refKey('right', at(1.62), [-0.42, -0.32], E, UP), ease: 'lin' },
    { ...refKey('right', at(1.80), [-0.42, -0.47], E, HOLD), ease: 'sine' },
    { ...refKey('right', at(2.22), [-0.41, -0.46], E, HOLD), ease: 'lin' },
    { t: at(2.46), idle: true, ease: 'io' },
  ];
  const left = [{ t: 0, idle: true }, { t: at(2.46), idle: true }];
  const head = [{ t: 0, pitch: 0 }, { t: at(2.46), pitch: 0 }];
  return {
    name: 'words/khorosho', duration: at(2.48), right, left, head,
    description:
      'РЖЯ ХОРОШО, как у носителя в SpreadTheSign RU word 91 (видео 900), в его темпе: кулак с поднятым большим ' +
      'пальцем у правой стороны груди, костяшками к зрителю. Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

/** Ладони вместе: правая кисть по ключу, левая — её отражение; обе сдвигаются по x, пока ладони не сойдутся до 3 мм. */
function palmsTogether(rk) {
  const mir = (k) => ({ ...k, pos: mirV(k.pos), pole: mirV(k.pole), fingers: mirV(k.fingers), palm: mirV(k.palm) });
  const place = (dx) => ({ ...rk, pos: rk.pos.clone().add(V(dx, 0, 0)) });
  const gapAt = (dx) => {
    const r = place(dx);
    applyFrame(rig, frameAt(keyPose('right', r), keyPose('left', mir(r))));
    return K.handsGap();
  };
  let dx = 0, gap = gapAt(0);
  // правая к середине (+x) — зазор меньше; обе кисти сдвигаются, поэтому шаг — половина лишнего зазора
  for (let it = 0; it < 40 && Math.abs(gap - 0.003) > 3e-4; it++) {
    dx += (gap - 0.003) * 0.5;
    gap = gapAt(dx);
  }
  applyFrame(rig, {});
  if (Math.abs(gap - 0.003) > 1e-3) throw new Error(`ладони не сходятся в ${rk.t} с (зазор ${(gap * 1000).toFixed(1)} мм)`);
  const r = { ...place(dx), gap };
  return { r, l: { ...mir(r), gap } };
}

// ═══════════════ ПОЖАЛУЙСТА ═══════════════
// Эталон — spreadthesign.com/ru.ru/word/422 «пожалуйста» (видео 4138). Время жеста = время записи − 0.88 с.
// Пересборка 26.09 (пользователь: прежняя версия неверна — кончики пальцев расходились «галочкой», ладони
// сходились поздно и расходились раньше, чем у носительницы).
//   0.98–1.10 обе руки быстро поднимаются; 1.10–1.84 ладони сложены вместе перед серединой груди, пальцы прямые
//   вверх (пясть в кадре 86–90°, указательный 79–81°, большой вдоль указательного 80–85°), ладонь правой — к
//   середине тела (3D (0.97…1.0, 0, −0.07…−0.25)); запястье кисти (−0.06…−0.08, −0.43…−0.50), к 1.82 чуть ниже;
//   локти низко у боков (−0.63…−0.67, −1.00…−1.04) и (0.75…0.79, −0.98…−1.00). 1.86–1.94 сложенные ладони
//   съезжают вниз (запястье кисти до (−0.09, −0.73)), 1.98–2.14 руки расходятся и опускаются.
function pozhaluysta() {
  const T0 = 0.88;
  const at = (tr) => +(tr - T0).toFixed(3);
  // пальцы чуть к середине (≈6°): у Елнара ладонь у основания толще, чем модель зазора (цилиндры), и при
  // параллельных кистях сходились только основания ладоней, а кончики расходились «галочкой» (аудит 26.09)
  const R = { fingers: dir(0.105, 0.99, -0.1), palm: dir(0.99, -0.105, -0.12), shape: SH.flatPray };
  const pray = (tr, w2, ease, z) => palmsTogether({ ...refKey('right', at(tr), w2, [-0.65, -1.02], R, z), ease });
  // руки сходятся быстро: к 1.10 с ладони уже вместе
  const k1 = pray(1.10, [-0.08, -0.45], 'out');
  const k2 = pray(1.50, [-0.07, -0.47], 'sine');
  const k3 = pray(1.84, [-0.08, -0.55], 'sine');
  // вниз ладони съезжают вместе (1.86–1.94, запястье кисти (−0.09…−0.10, −0.61…−0.73)), затем расходятся в покой;
  // перед грудью глубже — иначе большие пальцы чиркнули бы по свитеру
  const k4 = pray(1.94, [-0.09, -0.72], 'sine', { zMin: 0.65 });
  // аудит 28.09: у носителя ладони опускаются вместе ещё ниже (1.94–1.98 запястья позы на −0.82…−0.97) и расходятся
  // только к 2.10 с; прежде они расходились сразу после 1.94
  const k5 = pray(1.99, [-0.10, -0.86], 'sine', { zMin: 0.75 });
  const right = [{ t: 0, idle: true }, { t: at(0.94), idle: true }, k1.r, k2.r, k3.r, k4.r, k5.r, { t: at(2.18), idle: true, ease: 'io' }];
  const left = [{ t: 0, idle: true }, { t: at(0.94), idle: true }, k1.l, k2.l, k3.l, k4.l, k5.l, { t: at(2.18), idle: true, ease: 'io' }];
  const head = [{ t: 0, pitch: 0 }, { t: at(2.18), pitch: 0 }];
  return {
    name: 'words/pozhaluysta', duration: at(2.20), right, left, head,
    description:
      'РЖЯ ПОЖАЛУЙСТА, как у носителя в SpreadTheSign RU word 422 (видео 4138), в его темпе: ладони сложены вместе ' +
      'перед серединой груди, пальцы вверх. Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ ДА ═══════════════
// Эталон — spreadthesign.com/ru.ru/sentence/420 «да» (видео 4126). Время жеста = время записи − 1.26 с.
//   1.34–1.50 правая поднимается к правой стороне груди; 1.50–1.66 указательный и средний выпрямлены и смотрят вверх
//   и вперёд, остальные сжаты, тыл кисти к зрителю (пясть в кадре 79–88°, 3D (0.02…0.11, 0.54…0.73, 0.67…0.84));
//   запястье (−0.39…−0.42, −0.32…−0.37); 1.66–1.82 пальцы сгибаются, кисть «кивает» — пясть уходит вперёд, к зрителю;
//   1.82–2.22 кулак костяшками к зрителю (пясть 3D (−0.15, 0.04, 0.99)), ладонь вверх и к середине (3D (0.66…0.77,
//   0.64…0.75, 0.03…0.11)), запястье (−0.34…−0.36, −0.44…−0.52); 2.26–2.46 рука опускается.
function da() {
  const T0 = 1.26;
  const at = (tr) => +(tr - T0).toFixed(3);
  const E = [-0.70, -0.76];
  // пясть почти вертикально (в кадре 79–88°), тыл кисти к зрителю (видна вся ширина кисти, согнутые пальцы
  // спрятаны за ней); два пальца смотрят вверх и к середине (в кадре 54–61°) — отведены в основании к мизинцу
  // (пересборка 26.09)
  const TWO = { fingers: dir(0.05, 0.82, 0.57), palm: dir(0.035, 0.57, -0.82), shape: shape({ ...SH.twoUp, index: { curl: [25, 10, 5], spread: 30 }, middle: { curl: [25, 10, 5], spread: 22 } }) };
  // кулак стоит «торчком»: костяшки к зрителю, линия костяшек вертикальна (указательный сверху, мизинец снизу),
  // большой сверху — ладонь к середине тела, а не вверх, как дала нормаль MediaPipe (пересборка 26.09)
  // большой лежит вдоль указательного сверху, кончиком у его среднего сустава (как у носителя)
  const FIST_A = shape({ ...SH.fist, thumb: { abd: 15, f1: -40, f2: 50, f3: 10 } });
  const FIST = { fingers: dir(-0.1, 0.25, 0.96), palm: dir(0.97, 0.2, 0.05), shape: FIST_A };
  // «кивок» — середина разворота от двух пальцев к кулаку
  const NOD = { hand: K.handQuat('right', TWO.fingers, TWO.palm).slerp(K.handQuat('right', FIST.fingers, FIST.palm), 0.5), shape: mixShape(TWO.shape, FIST_A, 0.6) };
  const right = [
    { t: 0, idle: true },
    { t: at(1.32), idle: true },
    { ...refKey('right', at(1.56), [-0.39, -0.37], E, TWO), ease: 'io' },
    { ...refKey('right', at(1.65), [-0.42, -0.32], E, TWO), ease: 'lin' },
    { ...refKey('right', at(1.74), [-0.39, -0.38], E, NOD), ease: 'sine' },
    { ...refKey('right', at(1.84), [-0.36, -0.45], E, FIST), ease: 'sine' },
    { ...refKey('right', at(2.18), [-0.36, -0.52], E, FIST), ease: 'lin' },
    { t: at(2.46), idle: true, ease: 'io' },
  ];
  const left = [{ t: 0, idle: true }, { t: at(2.46), idle: true }];
  const head = [{ t: 0, pitch: 0 }, { t: at(2.46), pitch: 0 }];
  return {
    name: 'words/da', duration: at(2.48), right, left, head,
    description:
      'РЖЯ ДА, как у носителя в SpreadTheSign RU sentence 420 (видео 4126), в его темпе: у правой стороны груди ' +
      'указательный и средний вверх, затем кисть «кивает» и сжимается в кулак костяшками к зрителю. Поза решена IK на ' +
      'avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ ПЛОХО ═══════════════
// Эталон — spreadthesign.com/ru.ru/word/544 «плохо» (видео 5372). Время жеста = время записи − 1.20 с.
// Пересборка 26.09 (пользователь: прежняя версия неверна — у носа была раскрытая кисть поперёк рта). По кадрам
// (крупно ×5) и разметке MediaPipe:
//   1.38–1.46 правая быстро поднимается перед грудью к лицу, пальцы полураскрыты; 1.50 сжимаются.
//   1.54–1.62 у носа: кисть вертикально справа под носом (пясть в кадре 88°, ладонь к середине лица, 3D
//   (0.98…0.99, 0.04…0.07, 0.11…0.19)), указательный согнут крючком и кончиком лежит на правом крыле носа
//   (кончик в кадре (−0.07…−0.10, 0.48…0.49), нос (−0.05, 0.49)), остальные сжаты, большой вдоль них вверх
//   (72–77°); запястье (−0.21…−0.23, 0.04…0.07). Лицо — гримаса (у Елнара мимики нет).
//   1.66–1.74 кисть рывком уходит от лица вниз и к середине, разворачиваясь ладонью вниз (пясть в кадре 74° →
//   46° → 22°); 1.78–1.94 ладонь вниз (3D (−0.06…0.14, −0.97…−1.0, …)), пясть к середине и вперёд (3D (0.5…0.8,
//   0, 0.6…0.86)), пальцы расслабленно свисают из костяшек; запястье (−0.27…−0.26, −0.22…−0.37), медленно
//   опускается; локоть (−0.72…−0.77, −0.63…−0.74). 1.98–2.26 рука уходит в покой.
function plokho() {
  const T0 = 1.20;
  const at = (tr) => +(tr - T0).toFixed(3);
  const NOSE = { fingers: dir(0.02, 1, 0.08), palm: dir(0.97, 0.05, 0.2), pole: V(-0.35, -0.9, 0.2), shape: SH.noseHook };
  const n1 = touch({ t: at(1.53), ...NOSE }, { spot: 'нос справа', on: 'face', point: 'tip' });
  const E = [-0.74, -0.66];
  // глубина не меньше 0.55 ширины плеч: ближе большой палец свисающей кисти задевал свитер
  const drop = (tr, w2, fingers, palm, ease = 'sine', sh = SH.dropHang) => refKey('right', at(tr), w2, E, { fingers, palm, shape: sh, ease }, { zMin: 0.55 });
  const right = [
    { t: 0, idle: true },
    { t: at(1.30), idle: true },
    // подъём: кисть перед грудью, пальцы полураскрыты
    { ...refKey('right', at(1.44), [-0.30, -0.16], [-0.72, -0.64], { fingers: dir(0.35, 0.88, 0.3), palm: dir(0.75, -0.45, 0.5), shape: mixShape(SH.rest, SH.noseHook, 0.8) }), ease: 'io' },
    { ...n1, ease: 'sine' },
    { ...n1, t: at(1.63), ease: 'lin' },
    // рывок: от лица вперёд, вниз и к середине — ладонь поворачивается вниз, пальцы раскрываются
    { ...refKey('right', at(1.70), [-0.21, -0.05], [-0.73, -0.61], { fingers: dir(0.55, 0.72, 0.42), palm: dir(0.78, -0.6, -0.1), shape: mixShape(SH.noseHook, SH.dropHang, 0.5) }, { zMin: 0.55 }), ease: 'in' },
    drop(1.76, [-0.24, -0.14], dir(0.77, 0.2, 0.6), dir(0.24, -0.97, 0.05), 'out'),
    drop(1.82, [-0.27, -0.25], dir(0.72, -0.08, 0.69), dir(-0.1, -0.99, 0.05)),
    drop(1.92, [-0.25, -0.35], dir(0.55, 0.02, 0.83), dir(0.05, -0.99, -0.05), 'lin'),
    { t: at(2.24), idle: true, ease: 'io' },
  ];
  const left = [{ t: 0, idle: true }, { t: at(2.24), idle: true }];
  const head = [{ t: 0, pitch: 0 }, { t: at(2.24), pitch: 0 }];
  return {
    name: 'words/plokho', duration: at(2.26), right, left, head,
    description:
      'РЖЯ ПЛОХО, как у носителя в SpreadTheSign RU word 544 (видео 5372), в его темпе: согнутый крючком указательный ' +
      'правой у крыла носа (остальные пальцы сжаты), затем кисть рывком уходит вниз к середине, ладонью вниз, пальцы ' +
      'свисают. Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ ГЛУХОЙ ═══════════════
// Эталон — spreadthesign.com/ru.ru/word/412 «глухой» (видео 4047). Время жеста = время записи − 1.72 с.
// Пересборка 26.09 (пользователь: прежняя версия неверна — у уха палец висел в стороне от лица, у челюсти).
// По кадрам (крупно ×4):
//   1.80–1.94 правая поднимается; 1.98–2.18 кончик указательного на нижней губе у правого угла рта, палец
//   смотрит вверх к середине (в кадре 49–55°), кисть ниже справа тылом к зрителю, остальные пальцы сжаты;
//   запястье (−0.33…−0.37, −0.05…−0.11). 2.22–2.34 кисть уходит вверх-вправо и разворачивается ладонью к лицу;
//   2.38–2.78 указательный вертикально прижат подушечкой к щеке прямо перед ухом, кончик на высоте глаз; кисть
//   под ним у челюсти, ладонью к лицу и к зрителю (видны согнутые пальцы); запястье (−0.33…−0.45, 0.00…0.06).
//   2.82–3.06 рука опускается.
function glukhoy() {
  const T0 = 1.72;
  const at = (tr) => +(tr - T0).toFixed(3);
  const MOUTH = { fingers: dir(0.45, 0.88, 0.15), palm: dir(-0.25, 0.25, -0.93), pole: V(-0.35, -0.9, 0.2), shape: SH.one };
  // у уха пясть вертикально и чуть назад, ладонь к щеке и к зрителю
  const EAR = { fingers: dir(0.04, 1, -0.04), palm: dir(0.93, 0, 0.36), pole: V(-0.45, -0.85, 0.1), shape: SH.one };
  const m1 = touch({ t: at(2.00), ...MOUTH }, { spot: 'угол рта справа', on: 'face', point: 'tip' });
  const c1 = touch({ t: at(2.38), ...EAR }, { spot: 'перед ухом справа', on: 'face', point: 'tip' });
  const right = [
    { t: 0, idle: true },
    { t: at(1.78), idle: true },
    // ко рту — через точку перед грудью (прямой дугой из покоя кисть прошла бы сквозь свитер)
    { ...m1, t: at(1.90), pos: m1.pos.clone().add(V(-0.02, -0.12, 0.09)), ease: 'io' },
    { ...m1, ease: 'sine' },
    { ...m1, t: at(2.18), ease: 'lin' },
    // от губ к уху — чуть вперёд и наружу, кисть разворачивается ладонью к лицу
    { t: at(2.28), pos: m1.pos.clone().lerp(c1.pos, 0.55).add(V(-0.012, 0, 0.05)), fingers: dir(0.15, 0.97, 0.1), palm: dir(0.55, 0.1, -0.8), pole: V(-0.42, -0.88, 0.12), shape: SH.one, ease: 'sine' },
    { ...c1, ease: 'sine' },
    { ...c1, t: at(2.78), ease: 'lin' },
    // аудит 28.09 (разметка 2.74–3.30): от щеки палец уходит медленно и ещё прямой — 2.90 запястье (−0.50, −0.03),
    // пясть 103°; 2.98 (−0.56, −0.12), палец сгибается; к 3.14–3.22 рука в покое
    { ...refKey('right', at(2.90), [-0.50, -0.03], [-0.80, -0.84], { fingers: dir(-0.2, 0.97, 0.1), palm: dir(0.9, 0.19, 0.39), shape: mixShape(SH.one, SH.rest, 0.15) }), ease: 'sine' },
    { ...refKey('right', at(2.98), [-0.56, -0.12], [-0.84, -0.88], { fingers: dir(-0.14, 0.98, 0.17), palm: dir(0.96, 0.09, 0.28), shape: mixShape(SH.one, SH.rest, 0.45) }), ease: 'sine' },
    { t: at(3.18), idle: true, ease: 'io' },
  ];
  const left = [{ t: 0, idle: true }, { t: at(3.18), idle: true }];
  const head = [{ t: 0, pitch: 0 }, { t: at(3.18), pitch: 0 }];
  return {
    name: 'words/glukhoy', duration: at(3.20), right, left, head,
    description:
      'РЖЯ ГЛУХОЙ, как у носителя в SpreadTheSign RU word 412 (видео 4047), в его темпе: кончик указательного на нижней ' +
      'губе у правого угла рта, затем палец вертикально прижат к щеке перед ухом. Поза решена IK на avatar_elnar.glb ' +
      '(scripts/author-phrases.mjs).',
  };
}

// ═══════════════ ЧТО ═══════════════
// Эталон — spreadthesign.com/ru.ru/word/3906 «что» (видео 43119). Время жеста = время записи − 1.74 с.
//   1.80–1.94 правая поднимается; указательный вверх перед правым плечом (запястье (−0.39…−0.50, −0.14…−0.29)),
//   остальные сжаты, ладонь к середине и к зрителю (3D (0.68…0.81, −0.27…0.12, 0.57…0.68)); 1.94–2.36 кисть
//   качается из стороны в сторону (пясть в кадре 77–79° ↔ 104–110°, дважды, ~4.5 в секунду), 2.42–2.74 стоит
//   прямо (93–96°); 2.78–3.00 рука опускается. Губы артикулируют «что».
function chto() {
  const T0 = 1.74;
  const at = (tr) => +(tr - T0).toFixed(3);
  const E = [-0.78, -0.80];
  const PALM = dir(0.75, -0.2, 0.63);
  const f = (deg) => dir(Math.cos(rad(deg)), Math.sin(rad(deg)), 0.3);
  const k = (tr, w2, deg, ease = 'sine') => refKey('right', at(tr), w2, E, { fingers: f(deg), palm: PALM, shape: SH.one, ease });
  const right = [
    { t: 0, idle: true },
    { t: at(1.80), idle: true },
    { ...k(1.96, [-0.41, -0.27], 78), ease: 'io' },
    k(2.07, [-0.50, -0.15], 108),
    k(2.18, [-0.45, -0.22], 79),
    k(2.27, [-0.50, -0.18], 105),
    k(2.36, [-0.48, -0.22], 88),
    k(2.44, [-0.48, -0.21], 94),
    k(2.74, [-0.48, -0.26], 94, 'lin'),
    { ...refKey('right', at(2.84), [-0.55, -0.40], [-0.82, -0.83], { fingers: dir(0.1, 0.8, 0.6), palm: dir(0.75, -0.4, 0.5), shape: mixShape(SH.one, SH.rest, 0.3) }), ease: 'sine' },
    { t: at(3.02), idle: true, ease: 'io' },
  ];
  const left = [{ t: 0, idle: true }, { t: at(3.02), idle: true }];
  const head = [{ t: 0, pitch: 0 }, { t: at(3.02), pitch: 0 }];
  return {
    name: 'words/chto', duration: at(3.04), right, left, head,
    description:
      'РЖЯ ЧТО, как у носителя в SpreadTheSign RU word 3906 (видео 43119), в его темпе: указательный вверх перед ' +
      'правым плечом качается из стороны в сторону. Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ ПАПА ═══════════════
// Эталон — spreadthesign.com/ru.ru/word/9157 «папа» (видео 223549). Время жеста = время записи − 0.30 с.
// Пересборка 26.09 (пользователь: прежняя версия неверна — кисть лежала на макушке, под подбородком — у шеи).
// По кадрам (крупно ×2.6) и 2D-разметке кисти:
//   0.38–0.62 правая быстро поднимается ко лбу; 0.66–0.86 «козырёк»: плоская ладонь ребром указательного к лбу,
//   ладонь вниз и к середине (кисть видна с ребра: основания указательного и мизинца в кадре почти совпадают),
//   большой вдоль указательного снизу; запястье у правого виска на уровне глаз (−0.44…−0.47, 0.53…0.59), пясть
//   круто вверх к середине (в кадре 54–57°), пальцы согнуты в основании и идут поперёк лба (16–25°), кончики — у
//   середины лба под линией волос (−0.06…−0.08, 0.81…0.86; нос (−0.07, 0.52)).
//   0.94–1.10 кисть опускается перед лицом; 1.14–1.34 та же кисть горизонтально под подбородком: ребро
//   указательного снизу к подбородку (основание указательного на 0.08 ширины плеч выше основания мизинца),
//   ладонь вниз и к шее, пальцы к середине (−2…−8°), кончики за серединой (0.03…0.10, 0.27…0.30); пясть 40–44°;
//   запястье (−0.35…−0.41, 0.10…0.16). 1.38–1.56 рука опускается.
function papa() {
  const T0 = 0.30;
  const at = (tr) => +(tr - T0).toFixed(3);
  // пясть в плоскости кадра под углом deg, ладонь — перпендикулярно в плоскости кадра, вниз и к середине,
  // с наклоном к лицу back°: кисть видна с ребра, как у носительницы
  const visor = (deg, back) => {
    const f = dir2(deg, 0);
    const p = V(Math.sin(rad(deg)), -Math.cos(rad(deg)), 0).multiplyScalar(Math.cos(rad(back))).add(V(0, 0, -Math.sin(rad(back))));
    return { fingers: f, palm: p.normalize() };
  };
  const BROW = { ...visor(57, 15), pole: V(-0.3, -0.9, 0.3), shape: SH.flatSalute };
  const CHIN = { ...visor(42, 25), pole: V(-0.3, -0.9, 0.3), shape: SH.flatSalute };
  // лицо у Елнара уже относительно плеч: запястье на 0.03 ближе к середине и ниже, чтобы пальцы легли поперёк лба,
  // а не по линии волос
  const b1 = touchFace({ t: at(0.68), ...BROW }, [-0.42, 0.52], [0, 0]);
  const b2 = touchFace({ t: at(0.86), ...BROW }, [-0.44, 0.50], [0, 0]);
  const c1 = touchFace({ t: at(1.14), ...CHIN }, [-0.40, 0.14], [0, 0]);
  const c2 = touchFace({ t: at(1.34), ...CHIN }, [-0.36, 0.11], [0, 0]);
  const right = [
    { t: 0, idle: true },
    { t: at(0.36), idle: true },
    { ...b1, ease: 'out' },
    { ...b2, ease: 'lin' },
    // ото лба к подбородку — перед лицом (прямо кисть прошла бы сквозь нос)
    { t: at(1.00), pos: b2.pos.clone().lerp(c1.pos, 0.55).add(V(-0.01, 0, 0.09)), ...visor(50, 20), pole: V(-0.3, -0.9, 0.3), shape: SH.flatSalute, ease: 'sine' },
    { ...c1, ease: 'sine' },
    { ...c2, ease: 'lin' },
    // вниз — вперёд от груди (прямо в покой большой палец чиркнул бы по свитеру)
    { ...c2, t: at(1.45), pos: c2.pos.clone().add(V(-0.03, -0.16, 0.10)), ease: 'sine' },
    { t: at(1.62), idle: true, ease: 'io' },
  ];
  const left = [{ t: 0, idle: true }, { t: at(1.62), idle: true }];
  const head = [{ t: 0, pitch: 0 }, { t: at(1.62), pitch: 0 }];
  return {
    name: 'words/papa', duration: at(1.64), right, left, head,
    description:
      'РЖЯ ПАПА, как у носителя в SpreadTheSign RU word 9157 (видео 223549), в его темпе: плоская ладонь «козырьком» — ' +
      'ребром указательного к лбу, пальцы поперёк лба, затем так же горизонтально под подбородком. Поза решена IK на ' +
      'avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ ПОНИМАТЬ ═══════════════
// Эталон — spreadthesign.com/ru.ru/word/1731 «понимать» (видео 17213). Время жеста = время записи − 1.00 с.
// Пересборка 26.09 (пользователь: прежняя версия неверна — локоть был задран вбок, предплечье почти
// горизонтально). По кадрам (крупно ×4) и разметке:
//   1.06–1.22 правая поднимается сбоку (кисть у плеча) и подходит к виску; 1.30–2.10 кончик указательного у
//   правого виска (у наружного угла глаза): кисть сбоку от лица на уровне щеки (запястье (−0.67…−0.73,
//   0.18…0.29)), пясть вверх и к середине (в кадре 63–73°), указательный согнут в основании (~35° к пясти) и
//   смотрит к виску (26–34°), остальные сжаты; ладонь к голове, тыл к зрителю и наружу. Локоть НИЗКО и в
//   сторону — на уровне груди (−0.79…−0.84, −0.67…−0.71): предплечье идёт от него к виску наискось вверх.
//   Голова чуть наклонена к руке (нос смещается вправо на 0.07 ширины плеч и немного вниз). 2.14–2.34 вниз.
function ponimat() {
  const T0 = 1.00;
  const at = (tr) => +(tr - T0).toFixed(3);
  const HEAD = [-3, -7];
  const TEMPLE = { fingers: dir(0.45, 0.85, 0.25), palm: dir(0.68, -0.15, -0.72), pole: V(-0.5, -0.85, 0), shape: SH.oneBent };
  // локоть — как у носительницы (низко и в сторону); запястье и касание от этого не меняются
  const t1 = fitPole('right', touch({ t: at(1.32), ...TEMPLE }, { spot: 'висок справа', on: 'face', point: 'tip', head: HEAD }), [-0.81, -0.68], HEAD);
  const right = [
    { t: 0, idle: true },
    { t: at(1.04), idle: true },
    // подъём сбоку: кисть у плеча, пальцы вверх
    { ...refKey('right', at(1.16), [-0.77, 0.08], [-0.78, -0.74], { fingers: dir(0.15, 0.98, 0.1), palm: dir(0.95, -0.1, -0.3), shape: mixShape(SH.rest, SH.oneBent, 0.7) }), ease: 'io' },
    { ...t1, ease: 'sine' },
    { ...t1, t: at(2.10), ease: 'lin' },
    { ...refKey('right', at(2.22), [-0.57, -0.18], [-0.72, -0.91], { fingers: dir(0.3, 0.9, 0.3), palm: dir(0.7, 0, -0.7), shape: mixShape(SH.oneBent, SH.rest, 0.4) }), ease: 'sine' },
    { t: at(2.40), idle: true, ease: 'io' },
  ];
  const left = [{ t: 0, idle: true }, { t: at(2.40), idle: true }];
  const head = [
    { t: 0, pitch: 0, roll: 0 }, { t: at(1.14), pitch: 0, roll: 0 }, { t: at(1.32), pitch: HEAD[0], roll: HEAD[1] },
    { t: at(2.10), pitch: HEAD[0], roll: HEAD[1] }, { t: at(2.34), pitch: 0, roll: 0 },
  ];
  return {
    name: 'words/ponimat', duration: at(2.42), right, left, head,
    description:
      'РЖЯ ПОНИМАТЬ, как у носителя в SpreadTheSign RU word 1731 (видео 17213), в его темпе: кончик указательного у ' +
      'правого виска, кисть сбоку от лица, локоть низко и в сторону, голова чуть наклонена к руке. Поза решена IK на ' +
      'avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ «Доброе утро» = ДОБРЫЙ + УТРО (новая фраза 26.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/sentence/1298 «Доброе утро!» (видео 12844), одна запись. Время жеста = время
// записи − 1.36 с. По кадрам (крупно ×1.85) и разметке MediaPipe:
//   ДОБРЫЙ 1.62–2.18: левая кисть ладонью вниз у низа груди, пальцы расслабленно вправо и вперёд (пясть 3D
//     (−0.73, −0.05, 0.68)), запястье (0.24…0.30, −0.39…−0.56); правая ладонью вниз лежит на тыле левой, пальцы
//     влево и вперёд, и гладит её — дважды туда и обратно (запястье правой по x: −0.25 → −0.15 → −0.27 (1.70–1.90)
//     и −0.27 → −0.16 → −0.21 (1.98–2.18)). Правую кисть на левой MediaPipe не видит — положение по позе и кадрам.
//   УТРО 2.22–2.90: правая плоская кисть (пальцы вместе, почти прямые) поднимается пальцами вверх перед правой
//     стороной лица, ладонью к середине (2.26–2.38 запястье (−0.19…−0.20, −0.28…−0.15), ладонь 3D (0.90…0.95,
//     −0.17…0.04, 0.27…0.40)); кончики доходят до уровня носа (2.46–2.62, запястье (−0.22…−0.27, −0.08…0.04));
//     затем кисть уходит вправо от лица, разворачиваясь ладонью к зрителю (2.66–2.86, запястье (−0.29…−0.43,
//     0.07…−0.06), ладонь (0.65…0.72, 0.02…0.13, 0.65…0.75)); 2.90–3.06 опускается. Локоть (−0.77…−0.87, −0.60…−0.77).
//   Левая после ДОБРЫЙ опускается в покой к 2.46.
function dobroeUtro() {
  const T0 = 1.36;
  const at = (tr) => +(tr - T0).toFixed(3);
  const RELAX = shape({
    index: { curl: [22, 18, 8], spread: 4 }, middle: { curl: [24, 18, 8], spread: 0 },
    ring: { curl: [26, 18, 8], spread: -4 }, pinky: { curl: [28, 18, 8], spread: -8 },
    thumb: { abd: -15, f1: 5, f2: 5, f3: 5 },
  });
  // левая: ладонь вниз, пальцы вправо и вперёд
  const L_DOWN = { fingers: dir(-0.73, -0.05, 0.68), palm: dir(0.04, -1, -0.03), shape: RELAX };
  const E_L = [0.80, -0.75];
  const lk = (tr, w2, ease = 'sine') => refKey('left', at(tr), w2, E_L, { ...L_DOWN, ease }, { zMin: 0.45 });
  const L = {
    a: lk(1.66, [0.30, -0.58], 'out'),
    b: lk(1.80, [0.25, -0.50]),
    c: lk(1.96, [0.29, -0.43]),
    d: lk(2.14, [0.27, -0.48], 'lin'),
  };
  // правая: ладонь вниз на тыле левой, пальцы влево и вперёд; положение по x — как у носителя, высота — касание 3 мм
  // правая лежит на левой, как у носителя: пясть в кадре вверх-влево (30…53°), пальцы свешены в основании через
  // тыл левой (указательный −9…−23°), тыл правой к зрителю; большой вдоль указательного
  const DRAPE = shape({
    index: { curl: [45, 12, 6], spread: 8 }, middle: { curl: [45, 12, 6], spread: 0 },
    ring: { curl: [46, 12, 6], spread: -7 }, pinky: { curl: [48, 12, 6], spread: -14 },
    thumb: { abd: 10, f1: -20, f2: 5, f3: 5 },
  });
  const R_DOWN = { fingers: dir(0.55, 0.45, 0.7), palm: dir(0.46, -0.87, -0.19), shape: DRAPE };
  const E_R = [-0.78, -0.75];
  const stroke = (tr, x2, la, lb, ease = 'sine') => ({ ...touchDown({ ...refKey('right', at(tr), [x2, -0.36], E_R, R_DOWN, { zMin: 0.45 }) }, la, lb, at(tr)), ease });
  // УТРО: плоская кисть пальцами вверх, ладонь к середине и чуть к зрителю → разворот к зрителю
  const E_U = [-0.83, -0.66];
  // большой прижат вдоль указательного и смотрит вверх (у носителя в кадре 58–81°)
  const FLAT_T = shape({ ...SH.flatClosed, thumb: { abd: 18, f1: -30, f2: 8, f3: 5 } });
  const up = (tr, w2, palm, ease = 'sine', fingers = dir(0.03, 0.97, -0.2), z) => refKey('right', at(tr), w2, E_U, { fingers, palm, shape: FLAT_T, ease }, z);
  const right = [
    { t: 0, idle: true },
    { t: at(1.42), idle: true },
    // подход — кисть над левой, чуть выше (иначе прошла бы сквозь неё)
    { ...refKey('right', at(1.62), [-0.32, -0.46], E_R, R_DOWN, { zMin: 0.45 }), ease: 'out' },
    stroke(1.72, -0.25, L.a, L.b),
    stroke(1.82, -0.15, L.b, L.b),
    stroke(1.92, -0.27, L.b, L.c),
    stroke(2.00, -0.27, L.c, L.d),
    stroke(2.10, -0.16, L.c, L.d),
    stroke(2.17, -0.21, L.d, L.d),
    // УТРО
    // от груди — глубже (ближе большой палец задевал свитер)
    up(2.26, [-0.19, -0.28], dir(0.92, -0.1, 0.38), 'sine', dir(0.2, 0.93, -0.3), { zMin: 0.62 }),
    up(2.38, [-0.20, -0.15], dir(0.93, 0.02, 0.37)),
    up(2.50, [-0.23, -0.06], dir(0.88, 0.12, 0.46)),
    up(2.62, [-0.27, 0.04], dir(0.8, 0.15, 0.58)),
    up(2.74, [-0.35, 0.09], dir(0.72, 0.08, 0.69)),
    up(2.84, [-0.41, -0.02], dir(0.68, 0.1, 0.72), 'lin'),
    { t: at(3.10), idle: true, ease: 'io' },
  ];
  const left = [
    { t: 0, idle: true },
    { t: at(1.42), idle: true },
    L.a, L.b, L.c, L.d,
    { t: at(2.46), idle: true, ease: 'io' },
    { t: at(3.10), idle: true },
  ];
  const head = [{ t: 0, pitch: 0 }, { t: at(3.10), pitch: 0 }];
  return {
    name: 'dobroe-utro', duration: at(3.12), right, left, head,
    description:
      'РЖЯ «Доброе утро» = ДОБРЫЙ + УТРО, как у носителя в SpreadTheSign RU sentence 1298 (видео 12844), в его темпе: ' +
      'правая ладонь дважды гладит тыл левой кисти; затем плоская правая кисть пальцами вверх поднимается перед правой ' +
      'стороной лица и уходит в сторону, разворачиваясь ладонью к зрителю. Поза решена IK на avatar_elnar.glb.',
  };
}

// ═══════════════ «Добрый день» = ДОБРЫЙ + ДЕНЬ (новая фраза 26.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/sentence/1299 «Добрый день» (видео 12848), одна запись. Время жеста = время
// записи − 1.00 с. По кадрам (крупно ×1.5) и разметке MediaPipe:
//   ДОБРЫЙ 1.14–1.70: левая ладонью вниз у низа груди, пальцы вправо и вперёд (пясть 3D (−0.94, −0.08, 0.33)),
//     запястье (0.24…0.41, −0.34…−0.63); правая лежит на её тыле (пясть в кадре вверх-влево 36…73°, пальцы
//     свешены) и один раз проводит от пальцев левой к её запястью (запястье правой по x −0.45 → −0.26, 1.22–1.54)
//     и обратно (−0.31, 1.70).
//   ДЕНЬ 1.78–2.70: обе раскрытые кисти (пальцы вместе, вверх, ладони к зрителю) поднимаются перед лицом и
//     расходятся по сторонам головы (1.96–2.10: запястья (∓0.61…0.80, 0.29…0.45), кончики выше головы); затем
//     опускаются, пальцы сгибаются (2.18–2.26) и у пояса по бокам кисти стоят вертикально ладонью к зрителю,
//     пальцы мягко согнуты «чашей» (2.34–2.66: запястья (−0.69…−0.73, −0.48…−0.53) и (0.72…0.77, −0.43…−0.49));
//     2.74 вниз.
//   Локти: в ДЕНЬ наверху (∓0.84…0.93, −0.53…−0.67), у пояса (∓0.69…0.77, −0.81…−0.90).
function dobryiDen() {
  const T0 = 1.00;
  const at = (tr) => +(tr - T0).toFixed(3);
  const RELAX = shape({
    index: { curl: [22, 18, 8], spread: 4 }, middle: { curl: [24, 18, 8], spread: 0 },
    ring: { curl: [26, 18, 8], spread: -4 }, pinky: { curl: [28, 18, 8], spread: -8 },
    thumb: { abd: -15, f1: 5, f2: 5, f3: 5 },
  });
  const DRAPE = shape({
    index: { curl: [45, 12, 6], spread: 8 }, middle: { curl: [45, 12, 6], spread: 0 },
    ring: { curl: [46, 12, 6], spread: -7 }, pinky: { curl: [48, 12, 6], spread: -14 },
    thumb: { abd: 10, f1: -20, f2: 5, f3: 5 },
  });
  // ДЕНЬ наверху: пальцы вместе и прямые, большой прижат
  const OPEN = shape({ ...SH.flatClosed, thumb: { abd: 10, f1: -25, f2: 5, f3: 5 } });
  const L_DOWN = { fingers: dir(-0.9, -0.08, 0.42), palm: dir(0.03, -1, -0.02), shape: RELAX };
  const E_L = [0.83, -0.86];
  const lk = (tr, w2, ease = 'sine') => refKey('left', at(tr), w2, E_L, { ...L_DOWN, ease }, { zMin: 0.45 });
  const L = { a: lk(1.22, [0.33, -0.47], 'out'), b: lk(1.38, [0.26, -0.40]), c: lk(1.50, [0.26, -0.42]), c2: lk(1.58, [0.26, -0.40]), d: lk(1.70, [0.25, -0.36]) };
  // правая: сперва стоит почти вертикально у кончиков левой (пясть 73–80°), затем ложится на её тыл и проходит к
  // запястью (пясть 41–64°), ладонь к середине и вниз; положение — по кадру, над левой не ниже касания
  const R_ON = (deg) => { const f = dir2(deg, 38); const p = V(0.5, -0.85, -0.15); return { fingers: f, palm: p.sub(f.clone().multiplyScalar(p.dot(f))).normalize(), shape: DRAPE }; };
  const E_R = [-0.79, -0.88];
  const on = (tr, w2, deg, lkey, ease = 'sine') => ({ ...keepAbove(refKey('right', at(tr), w2, E_R, R_ON(deg), { zMin: 0.5 }), lkey), ease });
  // правая — по кадру носительницы; левая под ней подводится до касания (с 1.38, когда правая уже на её тыле)
  const RK = [
    on(1.22, [-0.43, -0.38], 75, L.a, 'out'),
    on(1.38, [-0.36, -0.44], 45, L.b),
    on(1.50, [-0.20, -0.34], 51, L.c),
    on(1.58, [-0.25, -0.29], 60, L.c2),
    on(1.70, [-0.26, -0.36], 36, L.d),
  ];
  const LK = [L.a, ...[L.b, L.c, L.c2, L.d].map((k, i) => ({ ...meetLeft(RK[i + 1], k), ease: k.ease }))];
  // ДЕНЬ: ладони к зрителю и чуть к середине, пальцы вверх
  const UP_R = { fingers: dir(0.05, 1, -0.05), palm: dir(0.3, 0.02, 0.95), shape: OPEN };
  const UP_L = { fingers: dir(-0.05, 1, -0.05), palm: dir(-0.3, 0.02, 0.95), shape: OPEN };
  // у пояса кисти стоят вертикально ладонью к зрителю, пальцы вверх и мягко согнуты к зрителю — «чаша» (крупно
  // ×2.75; нормаль MediaPipe «ладонь вверх и к себе» здесь перевёрнута)
  const CUP = shape({
    index: { curl: [30, 40, 20], spread: 4 }, middle: { curl: [32, 42, 20], spread: 0 },
    ring: { curl: [34, 42, 20], spread: -4 }, pinky: { curl: [36, 40, 20], spread: -8 },
    thumb: { abd: -10, f1: 10, f2: 10, f3: 5 },
  });
  // кисти наклонены наружу (пясть в кадре 128…146° и 35…46°), ладони к зрителю и к середине — согнутые пальцы
  // поэтому смотрят вверх (указательный в кадре 78…102°)
  const CUP_R = { fingers: dir(-0.6, 0.75, 0.25), palm: dir(0.63, 0.26, 0.73), shape: CUP };
  const CUP_L = { fingers: dir(0.6, 0.75, 0.25), palm: dir(-0.63, 0.26, 0.73), shape: CUP };
  const r = (tr, w2, e2, o, ease = 'sine', z) => refKey('right', at(tr), w2, e2, { ...o, ease }, z);
  const l = (tr, w2, e2, o, ease = 'sine', z) => refKey('left', at(tr), w2, e2, { ...o, ease }, z);
  const right = [
    { t: 0, idle: true },
    { t: at(1.04), idle: true },
    ...RK,
    // аудит 28.09: расходясь к ДЕНЬ, мизинец правой прорезал пальцы левой (−6.1 мм) — сперва правая отрывается вверх
    { ...RK[4], t: at(1.77), pos: RK[4].pos.clone().add(V(-0.01, 0.035, 0.01)), ease: 'sine' },
    // ДЕНЬ: кисти поднимаются перед лицом (глубже — чтобы не задеть лицо) и расходятся
    r(1.86, [-0.40, 0.16], [-0.82, -0.73], { ...UP_R, palm: dir(0.6, 0, 0.8) }, 'sine', { zMin: 0.6 }),
    r(2.00, [-0.66, 0.42], [-0.87, -0.56], UP_R),
    r(2.10, [-0.76, 0.33], [-0.92, -0.61], UP_R, 'lin'),
    r(2.20, [-0.73, -0.05], [-0.83, -0.78], { ...UP_R, shape: mixShape(OPEN, CUP, 0.5) }),
    r(2.34, [-0.72, -0.50], [-0.70, -0.87], CUP_R),
    r(2.64, [-0.70, -0.49], [-0.74, -0.88], CUP_R, 'lin'),
    { t: at(2.94), idle: true, ease: 'io' },
  ];
  const left = [
    { t: 0, idle: true },
    { t: at(1.02), idle: true },
    ...LK,
    { ...LK[4], t: at(1.77), pos: LK[4].pos.clone().add(V(0.01, -0.01, 0)), ease: 'sine' },
    l(1.86, [0.38, 0.06], [0.78, -0.80], { ...UP_L, palm: dir(-0.6, 0, 0.8) }, 'sine', { zMin: 0.6 }),
    l(2.00, [0.66, 0.43], [0.86, -0.56], UP_L),
    l(2.10, [0.78, 0.38], [0.90, -0.60], UP_L, 'lin'),
    l(2.20, [0.82, 0.05], [0.87, -0.72], { ...UP_L, shape: mixShape(OPEN, CUP, 0.5) }),
    l(2.34, [0.76, -0.46], [0.76, -0.82], CUP_L),
    l(2.64, [0.73, -0.46], [0.74, -0.84], CUP_L, 'lin'),
    { t: at(2.94), idle: true, ease: 'io' },
  ];
  const head = [{ t: 0, pitch: 0 }, { t: at(2.94), pitch: 0 }];
  return {
    name: 'dobryi-den', duration: at(2.96), right, left, head,
    description:
      'РЖЯ «Добрый день» = ДОБРЫЙ + ДЕНЬ, как у носительницы в SpreadTheSign RU sentence 1299 (видео 12848), в её темпе: ' +
      'правая ладонь проводит по тылу левой кисти; затем обе раскрытые кисти ладонями к зрителю поднимаются перед лицом, ' +
      'расходятся по сторонам головы и опускаются к поясу, пальцы мягко сгибаются «чашей». Поза решена IK на avatar_elnar.glb.',
  };
}

// ═══════════════ «Спокойной ночи» = СПОКОЙНЫЙ + НОЧЬ (новая фраза 26.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/sentence/1300 «Спокойной ночи!» (видео 12864), одна запись. Время жеста = время
// записи − 1.50 с. По кадрам (крупно ×1.45) и разметке MediaPipe:
//   СПОКОЙНЫЙ 1.70–2.18: обе кисти в кулак с поднятым большим пальцем у верха груди (запястья (−0.52, −0.26) и
//     (0.57, −0.31)), ладони к середине, пясть вверх, вперёд и к середине; кисти медленно опускаются к поясу
//     (к 2.18 — (−0.55, −0.67) и (0.73, −0.61)), наклоняясь к середине (пясть в кадре 68° → 20°).
//   НОЧЬ 2.34–3.00: раскрытые кисти (пальцы вверх, чуть согнуты и врозь, ладони к себе) поднимаются к плечам
//     (2.42–2.50: (−0.56…−0.47, −0.20…−0.12) и (0.45, −0.18)), сходятся и перекрещиваются перед подбородком и
//     верхом груди — правая впереди левой, пальцы обеих вверх и к середине (2.58–2.74; по наложению разметки на
//     кадр — в этих кадрах MediaPipe путает кисти), сжимаются в кулаки с поднятым большим и расходятся к
//     груди (2.82–2.98: (−0.24…−0.33, −0.21…−0.36) и (0.26…0.27, −0.37…−0.39)); 3.06–3.14 вниз.
function spokoinoiNochi() {
  const T0 = 1.50;
  const at = (tr) => +(tr - T0).toFixed(3);
  // раскрытые кисти НОЧЬ: пальцы чуть согнуты и врозь, большой вверх вдоль указательного (в кадре 72…120°)
  const OPEN = shape({
    index: { curl: [18, 20, 10], spread: -6 }, middle: { curl: [18, 20, 10], spread: 0 },
    ring: { curl: [20, 22, 10], spread: 6 }, pinky: { curl: [22, 22, 10], spread: 12 },
    thumb: { abd: 5, f1: -20, f2: 5, f3: 5 },
  });
  const R = (fingers, palm, shape_) => ({ fingers, palm, shape: shape_ });
  const L = (o) => ({ fingers: mirV(o.fingers), palm: mirV(o.palm), shape: o.shape });
  const A1 = R(dir(0.45, 0.77, 0.45), dir(0.87, -0.3, -0.4), SH.fistThumb);
  const A2 = R(dir(0.55, 0.5, 0.67), dir(0.8, -0.2, -0.55), SH.fistThumb);
  const A3 = R(dir(0.5, 0.25, 0.83), dir(0.66, -0.72, -0.18), SH.fistThumb);
  const N1 = R(dir(0.08, 0.77, 0.64), dir(0.3, 0.6, -0.74), OPEN);
  const N2 = R(dir(0.02, 0.91, 0.4), dir(0.22, 0.39, -0.89), OPEN);
  // перекрещивание (крупно, наложение разметки): пальцы вверх и к середине (в кадре ~60°), ладони к себе —
  // правая кисть перед нижней частью лица, её пальцы заходят за середину; MediaPipe здесь путает кисти
  const N3 = R(dir(0.45, 0.8, 0.4), dir(0.2, 0.35, -0.92), OPEN);
  const N4 = R(dir(0.35, 0.85, 0.4), dir(0.15, 0.37, -0.92), mixShape(OPEN, SH.fistThumb, 0.3));
  const N5 = R(dir(0.24, 0.69, 0.68), dir(0.95, -0.25, -0.18), mixShape(OPEN, SH.fistThumb, 0.75));
  const F1 = R(dir(0.2, 0.6, 0.77), dir(0.85, 0.2, -0.38), SH.fistThumb);
  const E_R = [-0.87, -0.74], E_L = [0.85, -0.72];
  const r = (tr, w2, o, ease = 'sine', z) => refKey('right', at(tr), w2, E_R, { ...o, ease }, z);
  const l = (tr, w2, o, ease = 'sine', z) => refKey('left', at(tr), w2, E_L, { ...L(o), ease }, z);
  // при перекрещивании правая впереди левой
  const FRONT = { zMin: 0.72, zMax: 0.9, zPref: 0.78 }, BACK = { zMin: 0.35, zMax: 0.55, zPref: 0.45 };
  const right = [
    { t: 0, idle: true },
    { t: at(1.54), idle: true },
    { ...r(1.74, [-0.50, -0.27], A1), ease: 'out' },
    r(1.86, [-0.51, -0.31], A1),
    r(2.02, [-0.51, -0.50], A2),
    r(2.16, [-0.55, -0.64], A3, 'lin'),
    r(2.42, [-0.55, -0.20], N1),
    r(2.50, [-0.46, -0.12], N2),
    r(2.58, [-0.26, -0.03], N3, 'sine', FRONT),
    r(2.66, [-0.20, -0.10], N4, 'sine', FRONT),
    r(2.74, [-0.21, -0.15], N5, 'sine', FRONT),
    r(2.86, [-0.28, -0.26], F1),
    r(2.98, [-0.33, -0.37], F1, 'lin'),
    { t: at(3.26), idle: true, ease: 'io' },
  ];
  const left = [
    { t: 0, idle: true },
    { t: at(1.54), idle: true },
    { ...l(1.74, [0.57, -0.30], A1), ease: 'out' },
    l(1.86, [0.55, -0.33], A1),
    l(2.02, [0.58, -0.48], A2),
    l(2.16, [0.68, -0.61], A3, 'lin'),
    l(2.42, [0.58, -0.38], N1),
    l(2.50, [0.45, -0.18], N2),
    l(2.58, [0.35, -0.19], N3, 'sine', BACK),
    l(2.66, [0.22, -0.24], N4, 'sine', BACK),
    l(2.74, [0.20, -0.33], N5, 'sine', BACK),
    l(2.86, [0.27, -0.38], F1),
    l(2.98, [0.30, -0.44], F1, 'lin'),
    { t: at(3.26), idle: true, ease: 'io' },
  ];
  const head = [{ t: 0, pitch: 0 }, { t: at(3.26), pitch: 0 }];
  return {
    name: 'spokoinoi-nochi', duration: at(3.28), right, left, head,
    description:
      'РЖЯ «Спокойной ночи» = СПОКОЙНЫЙ + НОЧЬ, как у носителя в SpreadTheSign RU sentence 1300 (видео 12864), в его ' +
      'темпе: обе кисти в кулак с поднятым большим пальцем медленно опускаются от верха груди к поясу; затем раскрытые ' +
      'кисти ладонями к себе поднимаются, перекрещиваются перед подбородком и сжимаются в кулаки. Поза решена IK на ' +
      'avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ «Я не понимаю» = Я + ПОНИМАТЬ + НЕ (новая фраза 26.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/sentence/3666 «я не понимаю» (видео 33300), одна запись. Время жеста = время
// записи − 2.00 с. По кадрам (крупно ×3.5) и разметке MediaPipe:
//   Я 2.18–2.30: правая кисть у середины груди, пясть влево почти горизонтально (в кадре 11…29°), указательный
//     смотрит в грудь (в кадре укорочен в точку, кончик у середины груди), остальные сжаты; запястье (−0.27…−0.30,
//     −0.33…−0.11), кисть идёт вверх.
//   ПОНИМАТЬ 2.62–2.90: кончик прямого указательного — в середине лба (над переносицей, выше носа на 0.25 ширины
//     плеч), кисть перед лицом, пясть вверх и к середине (66…75°), указательный 37…51°, ладонь к середине;
//     запястье (−0.33…−0.42, 0.26…0.34).
//   НЕ 3.06–3.70: указательный лежит горизонтально под подбородком, кончиком влево (в кадре 16…33°), пясть
//     45…50°, ладонь вниз и к себе; запястье (−0.19…−0.26, −0.12…0.10); голова повёрнута влево (нос смещается
//     на 0.15 ширины плеч к левой руке). 3.78–3.90 рука уходит вниз.
function yaNePonimayu() {
  const T0 = 2.00;
  const at = (tr) => +(tr - T0).toFixed(3);
  // Я у этой носительницы: костяшки у середины груди, пясть влево, указательный согнут в основании почти под
  // прямым углом и упирается кончиком в грудь (в кадре укорочен в точку), ладонь к груди и вниз
  const YA = { fingers: dir(0.93, 0.35, 0), palm: dir(0.18, -0.48, -0.86), pole: V(-0.35, -0.9, 0.1),
    shape: shape({ ...SH.pointIn, index: { curl: [80, 8, 4], spread: 2 } }) };
  const BROW = { fingers: dir(0.3, 0.95, 0.05), palm: dir(0.95, -0.3, -0.1), pole: V(-0.35, -0.9, 0.15), shape: SH.one };
  // под подбородком указательный согнут в основании ~30° — лежит горизонтально при пясти ~45°
  // пясть чуть назад, к шее: тогда запястье выходит вперёд и не упирается в ворот свитера
  const UNDER = { fingers: dir(0.7, 0.7, -0.12), palm: dir(0.51, -0.61, -0.61), pole: V(-0.35, -0.9, 0.2),
    shape: shape({ ...SH.one, index: { curl: [30, 5, 2], spread: 2 } }) };
  const YAW = 20;
  const ya = touch({ t: at(2.22), ...YA }, { spot: 'грудь', on: 'body', point: 'tip' });
  const brow = touch({ t: at(2.64), ...BROW }, { spot: 'лоб середина', on: 'face', point: 'tip' });
  const chin = touch({ t: at(3.10), ...UNDER }, { spot: 'под подбородком', on: 'face', point: 'indexSide', head: [0, 0, YAW] });
  const right = [
    { t: 0, idle: true },
    { t: at(2.06), idle: true },
    { ...ya, ease: 'out' },
    { ...ya, t: at(2.30), ease: 'lin' },
    // от груди вверх к лицу — перед подбородком, указательный выпрямляется
    { t: at(2.44), pos: ya.pos.clone().lerp(brow.pos, 0.55).add(V(-0.015, 0, 0.07)), fingers: dir(0.55, 0.8, 0.25), palm: dir(0.8, -0.55, 0.1), pole: V(-0.35, -0.9, 0.15), shape: mixShape(SH.pointIn, SH.one, 0.5), ease: 'sine' },
    { ...brow, ease: 'sine' },
    { ...brow, t: at(2.90), ease: 'lin' },
    // вниз ко рту и под подбородок — перед лицом
    { t: at(3.00), pos: brow.pos.clone().lerp(chin.pos, 0.6).add(V(-0.01, 0, 0.09)), fingers: dir(0.55, 0.8, 0.2), palm: dir(0.8, -0.5, -0.3), pole: V(-0.35, -0.9, 0.2), shape: mixShape(SH.one, UNDER.shape, 0.5), ease: 'sine' },
    // под подбородок — снизу-спереди (прямо указательный задевал подбородок)
    { ...chin, t: at(3.06), pos: chin.pos.clone().add(V(0, -0.02, 0.03)), ease: 'sine' },
    { ...chin, ease: 'sine' },
    { ...chin, t: at(3.66), ease: 'lin' },
    { ...refKey('right', at(3.82), [-0.12, -0.60], [-0.77, -0.92], { fingers: dir(0.6, 0.3, 0.75), palm: dir(0.2, -0.9, 0.3), shape: mixShape(UNDER.shape, SH.rest, 0.4) }, { zMin: 0.75 }), ease: 'sine' },
    { t: at(4.06), idle: true, ease: 'io' },
  ];
  const left = [{ t: 0, idle: true }, { t: at(4.06), idle: true }];
  const head = [
    { t: 0, pitch: 0, roll: 0, yaw: 0 }, { t: at(2.96), pitch: 0, roll: 0, yaw: 0 }, { t: at(3.10), pitch: 0, roll: 0, yaw: YAW },
    { t: at(3.66), pitch: 0, roll: 0, yaw: YAW }, { t: at(3.90), pitch: 0, roll: 0, yaw: 0 },
  ];
  return {
    name: 'ya-ne-ponimayu', duration: at(4.08), right, left, head,
    description:
      'РЖЯ «Я не понимаю» = Я + ПОНИМАТЬ + НЕ, как у носительницы в SpreadTheSign RU sentence 3666 (видео 33300), в её ' +
      'темпе: указательный в грудь; кончик указательного к середине лба; указательный горизонтально под подбородком, ' +
      'голова отворачивается влево. Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ «Меня зовут…» = Я + ИМЯ (новая фраза 26.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/sentence/8851 «Меня зовут...» (видео 112327), одна запись. Время жеста = время
// записи − 0.86 с. По кадрам (крупно ×1.7) и разметке MediaPipe (обе кисти видны):
//   Я 1.06–1.14: указательный согнут в основании и смотрит в низ груди, пясть вверх-влево (42…45°), ладонь к груди;
//     запястье (−0.22…−0.29, −0.46…−0.60).
//   ИМЯ 1.38–2.58: левая ладонью вниз, пальцы (чуть согнуты) вправо и вперёд (пясть 3D (−0.5…−0.7, −0.2…0.07,
//     0.67…0.87)), запястье (0.38…0.47, −0.30…−0.47); правая сверху: пясть вверх-влево (49…56°), все четыре пальца
//     согнуты в основании (~55°) и лежат поперёк тыла левой кисти у её пальцев, кончики за серединой (0.13…0.21);
//     ладонь к середине и вниз; запястье (−0.28…−0.36, −0.48…−0.57). Правая дважды легко постукивает (1.60–2.10).
function menyaZovut() {
  const T0 = 0.86;
  const at = (tr) => +(tr - T0).toFixed(3);
  const YA = { fingers: dir(0.68, 0.62, -0.35), palm: dir(-0.4, -0.3, -0.87), pole: V(-0.35, -0.9, 0.1), shape: SH.pointIn };
  const ya = touch({ t: at(1.10), ...YA }, { spot: 'грудь', on: 'body', point: 'tip', shift: V(0, -0.03, 0) });
  const RELAX = shape({
    index: { curl: [25, 20, 8], spread: 4 }, middle: { curl: [28, 20, 8], spread: 0 },
    ring: { curl: [30, 20, 8], spread: -4 }, pinky: { curl: [32, 20, 8], spread: -8 },
    thumb: { abd: -15, f1: 5, f2: 5, f3: 5 },
  });
  const BENT = shape({
    index: { curl: [52, 10, 5], spread: 8 }, middle: { curl: [52, 10, 5], spread: 0 },
    ring: { curl: [54, 10, 5], spread: -7 }, pinky: { curl: [56, 10, 5], spread: -14 },
    thumb: { abd: 10, f1: -20, f2: 5, f3: 5 },
  });
  const L_DOWN = { fingers: dir(-0.6, -0.05, 0.8), palm: dir(-0.21, -0.95, -0.22), shape: RELAX };
  const R_ON = { fingers: dir(0.5, 0.78, 0.36), palm: dir(0.84, -0.54, -0.08), shape: BENT };
  const lk = (tr, w2, ease = 'sine') => refKey('left', at(tr), w2, [0.77, -0.80], { ...L_DOWN, ease }, { zMin: 0.45 });
  const rk = (tr, w2, ease = 'sine') => refKey('right', at(tr), w2, [-0.68, -0.85], { ...R_ON, ease }, { zMin: 0.45 });
  // правая — по кадру; левая под ней подводится до касания (MediaPipe видит обе, но глубину — нет)
  const tapDown = (tr, w2, lw2, ease) => { const r = rk(tr, w2, ease); return { r, l: { ...meetLeft(r, lk(tr, lw2)), ease } }; };
  const T1 = tapDown(1.54, [-0.33, -0.49], [0.47, -0.33], 'io');
  const T2 = tapDown(1.74, [-0.32, -0.48], [0.43, -0.31]);
  const T3 = tapDown(2.02, [-0.32, -0.52], [0.40, -0.33]);
  const T4 = tapDown(2.42, [-0.31, -0.55], [0.39, -0.36], 'lin');
  const up = (k, tr) => ({ ...k, t: at(tr), pos: k.pos.clone().add(V(0, 0.015, 0.004)), ease: 'sine' });
  const right = [
    { t: 0, idle: true },
    { t: at(0.90), idle: true },
    { ...ya, ease: 'out' },
    { ...ya, t: at(1.16), ease: 'lin' },
    // от груди к левой — кисть уходит вперёд (иначе большой палец задевал свитер) и разворачивается
    { ...rk(1.34, [-0.40, -0.45]), pos: T1.r.pos.clone().add(V(-0.03, 0.03, 0.07)) },
    T1.r, up(T2.r, 1.64), T2.r, up(T3.r, 1.90), T3.r, T4.r,
    { t: at(2.84), idle: true, ease: 'io' },
  ];
  const left = [
    { t: 0, idle: true },
    { t: at(1.20), idle: true },
    T1.l, { ...T2.l, t: at(1.64) }, T2.l, { ...T3.l, t: at(1.90) }, T3.l, T4.l,
    { t: at(2.84), idle: true, ease: 'io' },
  ];
  const head = [{ t: 0, pitch: 0 }, { t: at(2.84), pitch: 0 }];
  return {
    name: 'menya-zovut', duration: at(2.86), right, left, head,
    description:
      'РЖЯ «Меня зовут…» = Я + ИМЯ, как у носительницы в SpreadTheSign RU sentence 8851 (видео 112327), в её темпе: ' +
      'указательный в грудь; затем согнутые в основании пальцы правой ложатся поперёк тыла левой кисти (ладонью вниз) ' +
      'и дважды постукивают. Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ «Как тебя зовут?» = ИМЯ + ТЫ (новая фраза 26.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/sentence/10047 «Как тебя зовут?» (видео 112016), одна запись. Время жеста = время
// записи − 0.50 с. Отдельного КАК носительница не показывает: ИМЯ, затем указательный на собеседника, вопрос —
// лицом. По кадрам (крупно ×1.7) и разметке:
//   ИМЯ 0.66–1.22: левая у пояса, пясть вперёд и вправо (3D (−0.4…−0.52, 0.08…0.21, 0.83…0.91)), пальцы согнуты
//     и смотрят вправо, ладонь к середине; запястье (0.30…0.35, −0.41…−0.52). Правая (MediaPipe её под левой не
//     видит, по кадрам) — ладонью вниз, пальцы вместе и влево, лежат поперёк пальцев левой; запястье по позе
//     (−0.38…−0.42, −0.40…−0.45).
//   ТЫ 1.30–1.54: указательный на собеседника (в кадре укорочен), пясть вперёд и вверх (3D (0.21…0.32, 0.52…0.6,
//     0.77…0.82)), ладонь к середине и вниз, остальные сжаты; запястье (−0.41…−0.43, −0.20…−0.30). 1.62 вниз.
function kakTebyaZovut() {
  const T0 = 0.50;
  const at = (tr) => +(tr - T0).toFixed(3);
  // левая: пальцы согнуты в основании, большой лежит вдоль указательного и смотрит туда же — вправо (в кадре
  // −152…−164°)
  const LEFT = shape({
    index: { curl: [60, 25, 10], spread: 4 }, middle: { curl: [62, 25, 10], spread: 0 },
    ring: { curl: [64, 25, 10], spread: -4 }, pinky: { curl: [66, 25, 10], spread: -8 },
    thumb: { abd: 30, f1: -15, f2: 10, f3: 5 },
  });
  const FLAT = shape({ ...SH.flatClosed, index: { curl: [10, 5, 2], spread: 8 }, middle: { curl: [10, 5, 2], spread: 0 },
    ring: { curl: [11, 5, 2], spread: -7 }, pinky: { curl: [12, 5, 2], spread: -14 }, thumb: { abd: 10, f1: -20, f2: 5, f3: 5 } });
  const L_EDGE = { fingers: dir(-0.45, 0.12, 0.88), palm: dir(-0.88, -0.1, -0.44), shape: LEFT };
  const R_ACROSS = { fingers: dir(0.8, 0.05, 0.6), palm: dir(0.05, -1, 0.02), shape: FLAT };
  const lk = (tr, w2, ease = 'sine') => refKey('left', at(tr), w2, [0.65, -0.87], { ...L_EDGE, ease }, { zMin: 0.45 });
  const rk = (tr, w2, ease = 'sine') => refKey('right', at(tr), w2, [-0.77, -0.83], { ...R_ACROSS, ease }, { zMin: 0.45 });
  // правая ложится на пальцы левой (3 мм кожа к коже)
  const on = (tr, w2, lk_, ease) => ({ ...touchDown(rk(tr, w2), lk_, lk_, at(tr)), ease });
  const L1 = lk(0.70, [0.31, -0.46], 'out'), L2 = lk(1.10, [0.34, -0.44]), L3 = lk(1.20, [0.34, -0.48], 'lin');
  // указательный — прямо на собеседника (в кадре укорочен); ориентация кисти — как в одобренном ТЫ: при нормали
  // MediaPipe «ладонь к середине» указательный смотрел бы вбок, а не в камеру
  const YOU = { fingers: dir(0.1, 0.62, 0.78), palm: dir(0.3, -0.76, 0.58), shape: SH.pointYou };
  const r1 = on(0.72, [-0.40, -0.41], L1, 'out'), r3 = on(1.20, [-0.40, -0.42], L3, 'lin');
  const right = [
    { t: 0, idle: true },
    { t: at(0.52), idle: true },
    // аудит 28.09: подходя, правая прорезала пальцы ещё поднимающейся левой (−4.9 мм) — подходит сверху
    { ...r1, t: at(0.64), pos: r1.pos.clone().add(V(0, 0.05, 0.02)), ease: 'io' },
    { ...r1, ease: 'sine' },
    on(1.10, [-0.40, -0.43], L2, 'lin'),
    r3,
    // уходя к ТЫ, правая сперва отрывается от пальцев левой вверх (−3.9 мм, аудит 28.09)
    { ...r3, t: at(1.25), pos: r3.pos.clone().add(V(-0.01, 0.03, 0.01)), ease: 'sine' },
    { ...refKey('right', at(1.34), [-0.42, -0.25], [-0.70, -0.80], YOU), ease: 'sine' },
    { ...refKey('right', at(1.54), [-0.43, -0.24], [-0.67, -0.80], YOU), ease: 'lin' },
    { t: at(1.80), idle: true, ease: 'io' },
  ];
  const left = [
    { t: 0, idle: true },
    { t: at(0.52), idle: true },
    L1, L2, L3,
    { t: at(1.52), idle: true, ease: 'io' },
    { t: at(1.80), idle: true },
  ];
  const head = [{ t: 0, pitch: 0 }, { t: at(1.80), pitch: 0 }];
  return {
    name: 'kak-tebya-zovut', duration: at(1.82), right, left, head,
    description:
      'РЖЯ «Как тебя зовут?» = ИМЯ + ТЫ, как у носительницы в SpreadTheSign RU sentence 10047 (видео 112016), в её темпе: ' +
      'пальцы правой ладонью вниз лежат поперёк согнутых пальцев левой; затем указательный на собеседника. Поза решена ' +
      'IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ «Я люблю тебя» = ЛЮБИТЬ + ТЫ (новая фраза 26.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/sentence/2791 «я люблю тебя» (видео 26565), одна запись; из неё же ЛЮБИТЬ в
// одобренной фразе «Я люблю маму» — ключи ЛЮБИТЬ те же (губы → сердце). Время жеста = время записи − 2.60 с.
// Отдельного Я носительница не показывает. По кадрам (крупно ×1.4) и разметке:
//   ЛЮБИТЬ 2.94–3.62: пальцы к губам, затем ладонь на сердце (как в «Я люблю маму»).
//   3.86–4.06: вытянутый указательный вертикально у губ (пясть 94…106°, указательный 53…76°, кончик от губ до
//     носа), ладонь к середине и к зрителю; запястье (−0.15…−0.19, −0.02…0.10).
//   ТЫ 4.10–4.22: указательный на собеседника (в кадре укорочен), кисть у середины груди, запястье (−0.10…−0.13,
//     −0.10…0.06). 4.26–4.42 рука опускается.
function yaLyublyuTebya() {
  const T0 = 2.60;
  const at = (tr) => +(tr - T0).toFixed(3);
  // ЛЮБИТЬ — те же ориентации, форма и точки касания, что в одобренной фразе «Я люблю маму»
  const LIPS = { fingers: dir(0.35, 0.9, 0.25), palm: dir(0.05, 0.3, -0.95), pole: V(-0.4, -0.85, 0.15), shape: SH.flatBent };
  const HEART = { fingers: dir(0.75, 0.6, 0.25), palm: dir(0.1, 0.2, -0.97), pole: V(-0.35, -0.9, 0.1), shape: SH.flatHeart };
  const lips1 = touch({ t: at(2.94), ...LIPS }, { spot: 'губы', on: 'face', point: 'pads' });
  const heart1 = touch({ t: at(3.38), ...HEART }, { spot: 'сердце', on: 'body', point: 'palm' });
  // указательный у губ: пясть вертикально, указательный чуть согнут в основании к середине (в кадре 59…72°)
  const FINGER = { fingers: dir(-0.1, 0.95, 0.3), palm: dir(0.85, -0.1, 0.5), pole: V(-0.4, -0.88, 0.15), shape: SH.oneBent };
  const mouth = touch({ t: at(3.90), ...FINGER }, { spot: 'губы', on: 'face', point: 'tip', shift: V(0, 0.004, 0) });
  const YOU = { fingers: dir(0.1, 0.62, 0.78), palm: dir(0.3, -0.76, 0.58), shape: SH.pointYou };
  const right = [
    { t: 0, idle: true },
    { t: at(2.66), idle: true },
    // к губам — через точку перед подбородком (как в «Я люблю маму»)
    { ...lips1, t: at(2.86), pos: lips1.pos.clone().add(V(0, -0.06, 0.06)), ease: 'io' },
    { ...lips1, ease: 'out' },
    { ...lips1, t: at(3.10), ease: 'lin' },
    { ...heart1, ease: 'io' },
    { ...heart1, t: at(3.62), ease: 'lin' },
    // от сердца к губам — от груди вперёд (прямо указательный задел бы подбородок)
    { t: at(3.76), pos: heart1.pos.clone().lerp(mouth.pos, 0.55).add(V(-0.02, 0, 0.08)), fingers: dir(0.2, 0.9, 0.35), palm: dir(0.8, -0.3, 0.5), pole: V(-0.4, -0.88, 0.15), shape: mixShape(SH.flatHeart, SH.oneBent, 0.6), ease: 'sine' },
    { ...mouth, ease: 'sine' },
    { ...mouth, t: at(4.04), ease: 'lin' },
    { ...refKey('right', at(4.14), [-0.13, 0.02], [-0.52, -0.75], YOU), ease: 'sine' },
    { ...refKey('right', at(4.22), [-0.11, -0.08], [-0.56, -0.80], YOU), ease: 'lin' },
    { t: at(4.50), idle: true, ease: 'io' },
  ];
  const left = [{ t: 0, idle: true }, { t: at(4.50), idle: true }];
  const head = [{ t: 0, pitch: 0 }, { t: at(4.50), pitch: 0 }];
  return {
    name: 'ya-lyublyu-tebya', duration: at(4.52), right, left, head,
    description:
      'РЖЯ «Я люблю тебя» = ЛЮБИТЬ + ТЫ, как у носительницы в SpreadTheSign RU sentence 2791 (видео 26565), в её темпе: ' +
      'пальцы к губам, ладонь на сердце; указательный вертикально у губ, затем на собеседника. Поза решена IK на ' +
      'avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ «Ты хочешь есть?» = ХОТЕТЬ + ЕСТЬ (новая фраза 26.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/sentence/8799 «Ты хочешь есть?» (видео 100721), одна запись; из неё же ХОТЕТЬ и
// ЕСТЬ в одобренной фразе «Я хочу есть» — ключи те же. Отдельного ТЫ носительница не показывает (вопрос — лицом).
// Время жеста = время записи − 0.40 с: 0.44–0.60 рука поднимается, ХОТЕТЬ 0.62–0.78, ЕСТЬ 0.98–1.38, 1.44–1.62 вниз.
function tyKhocheshEst() {
  const T0 = 0.40;
  const at = (tr) => +(tr - T0).toFixed(3);
  // ХОТЕТЬ и ЕСТЬ — те же ориентации, формы и касания, что в одобренной фразе «Я хочу есть»
  const WANT = { fingers: dir(0.8, 0.55, -0.1), palm: dir(-0.05, 0.1, -0.99), pole: V(-0.3, -0.9, 0.15), shape: SH.fistThumb };
  const EAT = { fingers: dir(0.2, 0.9, 0.25), palm: dir(-0.12, 0.3, -0.95), pole: V(-0.35, -0.9, 0.25), shape: SH.bunch };
  const want1 = touch({ t: at(0.64), ...WANT }, { spot: 'грудь слева', on: 'body', point: 'fist' });
  const eat1 = touch({ t: at(1.00), ...EAT }, { spot: 'угол рта справа', on: 'face', point: 'pads' });
  const away = (k, t) => ({ ...k, t, pos: k.pos.clone().add(V(0, -0.003, 0.004)), ease: 'sine' });
  const right = [
    { t: 0, idle: true },
    { t: at(0.44), idle: true },
    // к левой стороне груди — перед грудью (прямо из покоя кулак прошёл бы сквозь свитер)
    { ...want1, t: at(0.54), pos: want1.pos.clone().add(V(-0.06, -0.08, 0.08)), ease: 'io' },
    { ...want1, ease: 'sine' }, { ...want1, t: at(0.78), ease: 'lin' },
    { t: at(0.87), pos: want1.pos.clone().lerp(eat1.pos, 0.4).add(V(0, 0, 0.07)), fingers: dir(0.5, 0.7, 0.5), palm: dir(-0.1, 0.4, -0.9), pole: V(-0.32, -0.9, 0.2), shape: mixShape(SH.fistThumb, SH.bunch, 0.5), ease: 'sine' },
    { ...eat1, ease: 'sine' },
    away(eat1, at(1.07)), { ...eat1, t: at(1.14), ease: 'sine' },
    away(eat1, at(1.21)), { ...eat1, t: at(1.28), ease: 'sine' },
    { ...eat1, t: at(1.36), ease: 'lin' },
    { t: at(1.50), pos: K.ref(-0.2, -0.55, 0.8), fingers: dir(0.3, 0.5, 0.8), palm: dir(0, 0.8, -0.6), pole: V(-0.35, -0.9, 0.2), shape: mixShape(SH.bunch, SH.rest, 0.5), ease: 'sine' },
    { t: at(1.66), idle: true },
  ];
  const left = [{ t: 0, idle: true }, { t: at(1.66), idle: true }];
  const head = [{ t: 0, pitch: 0 }, { t: at(1.66), pitch: 0 }];
  return {
    name: 'ty-khochesh-est', duration: at(1.66), right, left, head,
    description:
      'РЖЯ «Ты хочешь есть?» = ХОТЕТЬ + ЕСТЬ, как у носительницы в SpreadTheSign RU sentence 8799 (видео 100721), в её ' +
      'темпе: кулак с поднятым большим у левой стороны груди, затем щепоть у губ с постукиванием. Поза решена IK на ' +
      'avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ ПОКА (новое слово 26.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/word/10855 «Пока» (видео 100036). Время жеста = время записи − 0.20 с.
// По кадрам (крупно ×1.0) и разметке: 0.26–0.42 правая раскрытой поднимается к плечу; 0.46–1.06 кисть сбоку от
// головы на уровне плеча (запястье (−0.55…−0.62, −0.10…0.13), локоть в сторону (−0.93…−0.98, −0.64…−0.69)), пясть
// вертикально и чуть назад, ладонь к зрителю и к середине; пальцы вместе сгибаются в основании и разгибаются —
// между ~70° и ~105° к пясти (сгиб 0.50, 0.68, 0.90, 1.06; разгиб 0.58, 0.80, 0.98), ~5 в секунду; 1.10–1.22 кисть
// сжимается и опускается.
function poka() {
  const T0 = 0.20;
  const at = (tr) => +(tr - T0).toFixed(3);
  const OPEN = shape({
    index: { curl: [38, 20, 10], spread: 6 }, middle: { curl: [40, 20, 10], spread: 0 },
    ring: { curl: [42, 20, 10], spread: -5 }, pinky: { curl: [44, 20, 10], spread: -10 },
    thumb: { abd: 20, f1: 0, f2: 10, f3: 5 },
  });
  const BENT = shape({
    index: { curl: [72, 38, 15], spread: 6 }, middle: { curl: [74, 40, 15], spread: 0 },
    ring: { curl: [76, 40, 15], spread: -5 }, pinky: { curl: [78, 38, 15], spread: -10 },
    thumb: { abd: 20, f1: 0, f2: 10, f3: 5 },
  });
  const HAND = { fingers: dir(-0.01, 0.86, -0.5), palm: dir(0.5, 0.45, 0.74) };
  const E = [-0.95, -0.66];
  const k = (tr, w2, sh, ease = 'sine') => refKey('right', at(tr), w2, E, { ...HAND, shape: sh, ease });
  const right = [
    { t: 0, idle: true },
    { t: at(0.24), idle: true },
    { ...refKey('right', at(0.42), [-0.59, -0.21], [-0.91, -0.71], { fingers: dir(0.02, 0.94, 0.33), palm: dir(0.58, -0.28, 0.76), shape: mixShape(SH.rest, OPEN, 0.6) }), ease: 'io' },
    k(0.50, [-0.56, -0.02], BENT),
    k(0.58, [-0.55, 0.09], OPEN),
    k(0.68, [-0.60, 0.10], BENT),
    k(0.80, [-0.60, 0.13], OPEN),
    k(0.92, [-0.61, 0.11], BENT),
    k(0.99, [-0.59, 0.12], OPEN),
    k(1.07, [-0.60, 0.06], BENT),
    { ...refKey('right', at(1.17), [-0.52, -0.12], [-0.89, -0.68], { fingers: dir(-0.05, 0.93, 0.37), palm: dir(0.65, -0.25, 0.72), shape: SH.byeClosed }), ease: 'sine' },
    { t: at(1.42), idle: true, ease: 'io' },
  ];
  const left = [{ t: 0, idle: true }, { t: at(1.42), idle: true }];
  const head = [{ t: 0, pitch: 0 }, { t: at(1.42), pitch: 0 }];
  return {
    name: 'words/poka', duration: at(1.44), right, left, head,
    description:
      'РЖЯ ПОКА, как у носителя в SpreadTheSign RU word 10855 (видео 100036), в его темпе: правая кисть сбоку от ' +
      'головы ладонью к зрителю, пальцы вместе несколько раз сгибаются в основании и разгибаются. Поза решена IK на ' +
      'avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ НЕТ (новое слово 26.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/word/421 «нет» (видео 4136). Время жеста = время записи − 1.38 с.
// По кадрам (крупно ×2.1) и разметке: 1.40–1.52 правая быстро поднимается к подбородку; 1.54–1.62 «клюв» открыт
// под подбородком справа: указательный и средний прямые и вместе смотрят вверх (к подбородку), большой отставлен
// вниз, безымянный и мизинец сжаты; пясть 68…73°, ладонь к середине и к зрителю; запястье (−0.36…−0.39,
// −0.08…−0.13). 1.66–1.72 клюв закрывается (пальцы сгибаются к большому) и кисть уходит вниз к груди; 1.74–1.98
// у правой стороны груди: указательный и средний согнуты в основании (~60°) и смотрят к середине, большой под
// ними; запястье (−0.49…−0.53, −0.27…−0.38). Голова поворачивается вправо (нос смещается на 0.13 ширины плеч к
// правой руке) и возвращается. 2.02 вниз.
function net() {
  const T0 = 1.38;
  const at = (tr) => +(tr - T0).toFixed(3);
  const OPEN = shape({
    index: { curl: [10, 8, 4], spread: 9 }, middle: { curl: [10, 8, 4], spread: -1 },
    ring: { curl: [85, 95, 50], spread: -3 }, pinky: { curl: [85, 90, 50], spread: -6 },
    thumb: { abd: -30, f1: 15, f2: 5, f3: 5 },
  });
  const CLOSED = shape({
    index: { curl: [60, 18, 8], spread: 9 }, middle: { curl: [60, 18, 8], spread: -1 },
    ring: { curl: [88, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: 20, f1: 25, f2: 20, f3: 10 },
  });
  const CHIN = { fingers: dir(0.27, 0.95, 0.15), palm: dir(0.8, -0.3, 0.52), shape: OPEN };
  const CHEST = { fingers: dir(0.3, 0.65, 0.7), palm: dir(0.87, -0.45, 0.12), shape: CLOSED };
  const E = [-0.67, -0.91];
  const right = [
    { t: 0, idle: true },
    { t: at(1.40), idle: true },
    { ...refKey('right', at(1.55), [-0.38, -0.12], E, CHIN), ease: 'io' },
    { ...refKey('right', at(1.62), [-0.36, -0.09], E, CHIN), ease: 'lin' },
    { ...refKey('right', at(1.69), [-0.42, -0.22], E, { fingers: dir(0.25, 0.85, 0.45), palm: dir(0.9, -0.35, 0.25), shape: mixShape(OPEN, CLOSED, 0.6) }), ease: 'sine' },
    { ...refKey('right', at(1.78), [-0.50, -0.32], E, CHEST), ease: 'sine' },
    { ...refKey('right', at(1.96), [-0.52, -0.36], E, CHEST), ease: 'lin' },
    { t: at(2.24), idle: true, ease: 'io' },
  ];
  const left = [{ t: 0, idle: true }, { t: at(2.24), idle: true }];
  const head = [
    { t: 0, yaw: 0 }, { t: at(1.52), yaw: 0 }, { t: at(1.80), yaw: -15 }, { t: at(2.06), yaw: -6 }, { t: at(2.24), yaw: 0 },
  ];
  return {
    name: 'words/net', duration: at(2.26), right, left, head,
    description:
      'РЖЯ НЕТ, как у носительницы в SpreadTheSign RU word 421 (видео 4136), в её темпе: «клюв» (указательный и ' +
      'средний вместе, большой отставлен) открыт под подбородком, закрывается и уходит к правой стороне груди; голова ' +
      'поворачивается вправо. Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ ГДЕ (новое слово 26.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/word/1739 «где» (видео 17306). Время жеста = время записи − 1.50 с.
// По кадрам (крупно ×2.3) и разметке: 1.52–1.64 правая поднимается к правой стороне груди; 1.66–1.78 «Г»: тыл кисти
// к зрителю, пясть вверх-влево (50…56°), указательный согнут в основании и смотрит к середине (в кадре 23…27°),
// большой вверх, остальные сжаты; запястье (−0.52…−0.55, −0.13…−0.21). 1.82–1.88 кисть разворачивается ладонью к
// середине; 1.90–2.26 щепоть: кончики указательного и среднего на кончике большого, остальные сжаты, пясть вверх и чуть вправо
// (101…116°), кисть медленно опускается (запястье (−0.38…−0.43, −0.23…−0.33)). 2.34 вниз.
function gde() {
  const T0 = 1.50;
  const at = (tr) => +(tr - T0).toFixed(3);
  // «Г»: большой вверх (крупно ×3.45 — вдоль кисти, а не в сторону, как в «Г» дактиля ШКОЛЫ)
  const G = shape({
    index: { curl: [55, 5, 3], spread: 2 }, middle: { curl: [85, 100, 55], spread: 0 },
    ring: { curl: [88, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: -20, f1: -15, f2: 0, f3: 0 },
  });
  // щепоть: кончики указательного и среднего сходятся с большим (подбор «О» по скелету — 0.5 мм), безымянный и
  // мизинец в кулаке
  const O = shape({
    index: { curl: [54, 46, 20], spread: 3 }, middle: { curl: [58, 46, 20], spread: -3 },
    ring: { curl: [88, 100, 55], spread: -3 }, pinky: { curl: [88, 95, 55], spread: -6 },
    thumb: { abd: 26, f1: 7, f2: 5, f3: 10 },
  });
  const E = [-0.75, -0.74];
  const GK = { fingers: dir(0.55, 0.62, 0.56), palm: dir(0.5, 0.3, -0.81), shape: G };
  const OK = { fingers: dir(-0.25, 0.78, 0.57), palm: dir(0.78, -0.18, 0.6), shape: O };
  const right = [
    { t: 0, idle: true },
    { t: at(1.52), idle: true },
    { ...refKey('right', at(1.68), [-0.53, -0.18], E, GK), ease: 'io' },
    { ...refKey('right', at(1.78), [-0.55, -0.14], E, GK), ease: 'lin' },
    { ...refKey('right', at(1.86), [-0.49, -0.21], E, { fingers: dir(0.1, 0.72, 0.68), palm: dir(0.95, -0.2, 0.2), shape: mixShape(G, O, 0.6) }), ease: 'sine' },
    { ...refKey('right', at(1.94), [-0.41, -0.24], E, OK), ease: 'sine' },
    { ...refKey('right', at(2.10), [-0.39, -0.26], E, OK), ease: 'lin' },
    { ...refKey('right', at(2.26), [-0.43, -0.33], E, { ...OK, fingers: dir(-0.06, 0.73, 0.68), palm: dir(0.82, -0.35, 0.45) }), ease: 'lin' },
    { t: at(2.52), idle: true, ease: 'io' },
  ];
  const left = [{ t: 0, idle: true }, { t: at(2.52), idle: true }];
  const head = [{ t: 0, pitch: 0 }, { t: at(2.52), pitch: 0 }];
  return {
    name: 'words/gde', duration: at(2.54), right, left, head,
    description:
      'РЖЯ ГДЕ, как у носителя в SpreadTheSign RU word 1739 (видео 17306), в его темпе: у правой стороны груди «Г» — ' +
      'указательный к середине, большой вверх, тыл к зрителю; затем кисть разворачивается и кончики указательного и ' +
      'среднего смыкаются с большим (щепоть). Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ ПИТЬ (новое слово 26.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/word/10859 «пить» (видео 349221). Время жеста = время записи − 0.30 с.
// По кадрам и разметке: 0.40–0.54 правая поднимается ко рту; 0.58–1.10 кисть «стаканом» (пальцы вместе мягко
// согнуты, 28…52° к пясти, большой напротив) вертикально справа от рта: кончик большого у угла рта (кадр
// (−0.15…−0.18, 0.33…0.37)), пальцы вдоль правой щеки, ладонь к середине и к зрителю, пясть вверх и чуть назад;
// запястье (−0.33…−0.38, 0.03…0.10). Голова чуть поворачивается вправо, к кисти. 1.14–1.30 рука опускается.
function pit() {
  const T0 = 0.30;
  const at = (tr) => +(tr - T0).toFixed(3);
  // «стакан»: большой согнут навстречу пальцам (прямой торчал в угол рта «Г»-образно), ладонь к щеке
  const C = shape({
    index: { curl: [14, 16, 8], spread: 8 }, middle: { curl: [15, 16, 8], spread: 0 },
    ring: { curl: [16, 16, 8], spread: -7 }, pinky: { curl: [18, 16, 8], spread: -14 },
    thumb: { abd: 0, f1: 25, f2: 20, f3: 10 },
  });
  // ладонью к щеке: пальцы вдоль края щеки почти прямо вверх (у носителя в кадре 93…97°, кончики сбоку лица на высоте
  // глаз, x −0.34…−0.36), чуть согнуты, большой дугой ко рту
  const CUP = { fingers: dir(0, 0.98, 0.2), palm: dir(0.94, 0.07, -0.33), pole: V(-0.45, -0.85, 0.1), shape: C };
  const YAW = -8;
  // запястье — сбоку лица, где у носителя в кадре (чуть ближе к середине: лицо у Елнара уже), глубина — до касания
  // лица; при касании большим угла рта пальцы закрывали глаз
  const m1 = fitPole('right', touchFace({ t: at(0.58), ...CUP }, [-0.33, 0.07], [0, 0, YAW]), [-0.91, -0.59], [0, 0, YAW]);
  const right = [
    { t: 0, idle: true },
    { t: at(0.34), idle: true },
    // ко рту — перед грудью (ближе большой палец задевал свитер)
    { ...m1, t: at(0.48), pos: m1.pos.clone().add(V(-0.01, -0.07, 0.12)), ease: 'io' },
    { ...m1, ease: 'sine' },
    { ...m1, t: at(1.10), ease: 'lin' },
    { ...refKey('right', at(1.22), [-0.41, -0.24], [-0.89, -0.68], { fingers: dir(0.1, 0.97, 0.2), palm: dir(0.93, -0.14, 0.35), shape: mixShape(C, SH.rest, 0.4) }), ease: 'sine' },
    { t: at(1.42), idle: true, ease: 'io' },
  ];
  const left = [{ t: 0, idle: true }, { t: at(1.42), idle: true }];
  const head = [{ t: 0, yaw: 0 }, { t: at(0.46), yaw: 0 }, { t: at(0.60), yaw: YAW }, { t: at(1.10), yaw: YAW }, { t: at(1.30), yaw: 0 }];
  return {
    name: 'words/pit', duration: at(1.44), right, left, head,
    description:
      'РЖЯ ПИТЬ, как у носителя в SpreadTheSign RU word 10859 (видео 349221), в его темпе: кисть «стаканом» справа у ' +
      'рта, кончик большого у угла губ, пальцы вдоль щеки. Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ «Пожалуйста, подождите» (ЦОН, 27.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/sentence/10038 (видео 133657), один носитель. Время жеста = время записи − 0.60 с.
// По кадрам (крупно ×1.15) и разметке: 0.66–0.80 правая поднимается. ПОЖАЛУЙСТА 0.82–1.02 — одной рукой: плоская кисть,
// пальцы вместе, большой вдоль указательного; пальцы вверх-влево (в кадре 33…52°) и к зрителю (пясть укорочена до 0.26
// против 0.35), ладонь к середине тела и чуть вниз (ширина ладони в кадре 0.10–0.13 против 0.25 — видна с ребра, мизинец
// ближе к зрителю); запястье (−0.48…−0.59, −0.47…−0.53), локоть отведён (−1.02…−1.18, −0.61…−0.72); в 0.94–0.98 кисть
// чуть опускается. 1.06–1.38 кисть разворачивается ладонью к зрителю, указательный выпрямляется вверх, остальные в кулак, и
// уходит вправо. ПОДОЖДИТЕ 1.46–1.94: указательный вертикально (в кадре 87…90°), пясть 77…80°, ладонь к зрителю (ширина
// 0.25 — во всю), большой прижат к согнутым; запястье (−0.57…−0.61, −0.42…−0.50) стоит; локоть (−0.95, −0.65).
// 2.02–2.18 вниз. Голова чуть опущена во время знака (нос ниже на 0.07 ширины плеч).
function pozhaluystaPodozhdite() {
  const T0 = 0.60;
  const at = (tr) => +(tr - T0).toFixed(3);
  // указательный не сведён к среднему: у носителя он в кадре на 10…12° выше пясти (чуть к большому)
  const FLAT = shape({
    index: { curl: [0, 2, 1], spread: -4 }, middle: { curl: [4, 4, 2], spread: 0 },
    ring: { curl: [5, 4, 2], spread: -7 }, pinky: { curl: [6, 4, 2], spread: -14 },
    thumb: { abd: -12, f1: -5, f2: 0, f3: 0 },
  });
  const PLEASE = { fingers: dir(0.58, 0.52, 0.62), palm: dir(0.775, -0.6, -0.22), shape: FLAT };
  const WAIT = { fingers: dir(0.18, 0.98, 0.05), palm: dir(0, -0.05, 1), shape: SH.one };
  const E1 = [-1.10, -0.66], E2 = [-0.95, -0.65];
  const right = [
    { t: 0, idle: true },
    { t: at(0.64), idle: true },
    { ...refKey('right', at(0.84), [-0.55, -0.49], E1, PLEASE), ease: 'io' },
    { ...refKey('right', at(0.90), [-0.49, -0.47], E1, PLEASE), ease: 'sine' },
    { ...refKey('right', at(0.97), [-0.52, -0.53], E1, PLEASE), ease: 'sine' },
    { ...refKey('right', at(1.04), [-0.47, -0.50], E1, { ...PLEASE, shape: mixShape(FLAT, SH.one, 0.25) }), ease: 'sine' },
    { ...refKey('right', at(1.22), [-0.42, -0.44], E2, { fingers: dir(0.35, 0.9, 0.25), palm: dir(0.55, -0.45, 0.7), shape: SH.one }), ease: 'sine' },
    { ...refKey('right', at(1.46), [-0.59, -0.44], E2, WAIT), ease: 'sine' },
    { ...refKey('right', at(1.94), [-0.61, -0.47], E2, WAIT), ease: 'lin' },
    { t: at(2.24), idle: true, ease: 'io' },
  ];
  const left = [{ t: 0, idle: true }, { t: at(2.24), idle: true }];
  const head = [
    { t: 0, pitch: 0 }, { t: at(0.70), pitch: 0 }, { t: at(0.90), pitch: -5 }, { t: at(1.96), pitch: -5 }, { t: at(2.20), pitch: 0 },
  ];
  return {
    name: 'pozhaluysta-podozhdite', duration: at(2.26), right, left, head,
    description:
      'РЖЯ «Пожалуйста, подождите», как у носителя в SpreadTheSign RU sentence 10038 (видео 133657), в его темпе: ' +
      'ПОЖАЛУЙСТА одной рукой — плоская кисть перед грудью, пальцы вверх-влево, ладонь к середине тела; затем ' +
      'ПОДОЖДИТЕ — указательный вверх у правой стороны груди, ладонь к собеседнику. Поза решена IK на avatar_elnar.glb ' +
      '(scripts/author-phrases.mjs).',
  };
}

// ═══════════════ «Пожалуйста, повторите» (ЦОН, 28.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/sentence/10146 (видео 133656), тот же носитель, что в «Пожалуйста, подождите».
// Время жеста = время записи − 0.60 с. По кадрам (крупно ×0.9) и разметке подряд по кадрам (кисть сверена с запястьем
// позы, ≤ 0.08 ширины плеч):
//   ПОВТОРИТЕ 0.74–1.30. Левая — ладонью вверх у пояса слева, пальцы вправо и к зрителю (пясть в кадре 154…171°), запястье
//   (0.26…0.40, −0.49…−0.61). Правая дважды «загребает» по левой ладони: 0.74–0.82 подходит согнутой к середине (запястье
//   позы −0.42 → −0.27, −0.50…−0.54), 0.86 пальцы вытянуты над левой (пясть 42°), 0.94–1.06 отходит вправо и сжимается в
//   кулак (запястье (−0.52…−0.56, −0.48…−0.54), пясть 42…66°); 1.10–1.22 снова к середине полусогнутой ((−0.47 → −0.29,
//   −0.42…−0.60), пясть 53…72°), 1.26–1.30 сгибается.
//   ПОЖАЛУЙСТА 1.46–1.94 «домиком»: запястья врозь (правое (−0.15…−0.19, −0.30…−0.39), левое (0.13…0.16, −0.31…−0.39)),
//   пальцы вверх и друг к другу (правая пясть 73…76°, левая 95…101°), кончики сходятся над серединой. 1.98–2.14 вниз.
function pozhaluystaPovtorite() {
  const T0 = 0.60;
  const at = (tr) => +(tr - T0).toFixed(3);
  const R_BENT = shape({
    index: { curl: [70, 55, 25], spread: 6 }, middle: { curl: [72, 55, 25], spread: 0 },
    ring: { curl: [74, 55, 25], spread: -5 }, pinky: { curl: [76, 55, 25], spread: -10 },
    thumb: { abd: 10, f1: 10, f2: 10, f3: 5 },
  });
  const R_FLAT = shape({
    index: { curl: [25, 15, 8], spread: 6 }, middle: { curl: [26, 15, 8], spread: 0 },
    ring: { curl: [27, 15, 8], spread: -5 }, pinky: { curl: [28, 15, 8], spread: -10 },
    thumb: { abd: -10, f1: 0, f2: 5, f3: 0 },
  });
  const R_HALF = shape({
    index: { curl: [45, 35, 15], spread: 6 }, middle: { curl: [46, 35, 15], spread: 0 },
    ring: { curl: [48, 35, 15], spread: -5 }, pinky: { curl: [50, 35, 15], spread: -10 },
    thumb: { abd: 5, f1: 5, f2: 5, f3: 0 },
  });
  // левая: пальцы почти прямые, большой вдоль указательного (у носителя в кадре 131…160° — туда же, куда пальцы)
  const L_UP = shape({
    index: { curl: [5, 5, 3], spread: 8 }, middle: { curl: [5, 5, 3], spread: 0 },
    ring: { curl: [6, 5, 3], spread: -7 }, pinky: { curl: [7, 5, 3], spread: -14 },
    thumb: { abd: 15, f1: -10, f2: 0, f3: 0 },
  });
  const ER = [-0.98, -0.80], EL = [0.76, -0.92];
  // левая ладонью вверх, пальцы вправо и к зрителю
  const LK = { fingers: dir(-0.7, 0.25, 0.67), palm: dir(0.276, 0.958, -0.07), shape: L_UP };
  const lk = (tr, w2, ease = 'sine') => ({ ...refKey('left', at(tr), w2, EL, LK), ease });
  // левая в ПОВТОРИТЕ стоит (у носителя дрейф ±0.07): при её подъёмах под лежащей правой кисти прорезали друг друга
  // (аудит 28.09); одна поза — середина его рядов
  const LW = [0.33, -0.56];
  const l1 = lk(0.84, LW, 'io'), l2 = lk(0.87, LW), l3 = lk(1.06, LW), l4 = lk(1.21, LW), l5 = lk(1.28, LW);
  // правая: пясть вверх-влево, пальцы загибаются на левую ладонь; кисть не уходит в левую (keepAbove)
  const over1 = keepAbove({ ...refKey('right', at(0.87), [-0.33, -0.58], ER, { fingers: dir(0.65, 0.65, 0.4), palm: dir(0.55, -0.75, 0.2), shape: R_FLAT }), ease: 'sine' }, l2);
  const over2 = keepAbove({ ...refKey('right', at(1.21), [-0.30, -0.59], ER, { fingers: dir(0.55, 0.75, 0.35), palm: dir(0.7, -0.6, 0.2), shape: R_HALF }), ease: 'sine' }, l4);
  // ПОЖАЛУЙСТА «домиком»: правая пальцами к середине (74°), левая — её отражение; кисти сдвигаются до касания кончиков
  const ROOF = { fingers: dir(0.28, 0.93, 0.25), palm: dir(0.96, -0.28, 0), shape: SH.flatPray };
  const roof = (tr, w2, ease) => palmsTogether({ ...refKey('right', at(tr), w2, [-0.88, -0.86], ROOF, { zMin: 0.55 }), ease });
  const p1 = roof(1.50, [-0.18, -0.32], 'sine'), p2 = roof(1.72, [-0.15, -0.34], 'sine'), p3 = roof(1.92, [-0.17, -0.38], 'sine');
  const right = [
    { t: 0, idle: true },
    { t: at(0.66), idle: true },
    // подходит сверху: левая ещё поднимается к ладони-подставке и не должна задеть согнутые пальцы правой
    keepAbove({ ...refKey('right', at(0.80), [-0.30, -0.44], ER, { fingers: dir(0.35, 0.85, 0.4), palm: dir(0.85, -0.3, -0.1), shape: R_BENT }), ease: 'io' }, l1),
    over1,
    // отходя, правая сперва чуть приподнимается — сгибающиеся пальцы иначе цепляли левую (−4.8 мм, аудит 28.09)
    { ...over1, t: at(0.91), pos: over1.pos.clone().add(V(-0.02, 0.035, 0)), shape: mixShape(R_FLAT, SH.byeClosed, 0.1), ease: 'sine' },
    // после касаний правая не опускается сквозь левую (аудит 28.09) — ключи отхода тоже над левой
    keepAbove({ ...refKey('right', at(0.96), [-0.46, -0.50], ER, { fingers: dir(0.5, 0.78, 0.37), palm: dir(0.8, -0.5, -0.05), shape: mixShape(R_FLAT, SH.byeClosed, 0.5) }), ease: 'sine' }, l3),
    { ...refKey('right', at(1.04), [-0.55, -0.51], ER, { fingers: dir(0.45, 0.85, 0.25), palm: dir(0.85, -0.45, -0.1), shape: SH.byeClosed }), ease: 'sine' },
    { ...refKey('right', at(1.12), [-0.46, -0.45], ER, { fingers: dir(0.35, 0.9, 0.25), palm: dir(0.85, -0.35, 0.05), shape: R_HALF }), ease: 'sine' },
    over2,
    // сжимаясь, правая отходит вправо — левая поворачивается к «домику» уже рядом с ней, а не под ней
    keepAbove({ ...refKey('right', at(1.29), [-0.42, -0.56], ER, { fingers: dir(0.3, 0.92, 0.25), palm: dir(0.9, -0.3, 0.05), shape: mixShape(R_HALF, SH.byeClosed, 0.6) }), ease: 'sine' }, l5),
    // аудит 28.09: сходясь в «домик» напрямик, пальцы прорезали друг друга (−11.2 мм) — подходят с боков, чуть врозь
    { ...p1.r, t: at(1.42), pos: p1.r.pos.clone().add(V(-0.035, -0.02, 0)), ease: 'sine' },
    p1.r, p2.r, p3.r,
    { t: at(2.18), idle: true, ease: 'io' },
  ];
  const left = [
    { t: 0, idle: true },
    { t: at(0.66), idle: true },
    l1, l2, l3, l4, l5,
    // левая сперва поворачивается ладонью к середине (пальцы вперёд-вверх), потом поднимает пальцы (у носителя пясть
    // 153 → 119 → 96°); большой вдоль указательного — не упирается в грудь
    { ...refKey('left', at(1.35), [0.37, -0.41], EL, { fingers: dir(-0.45, 0.6, 0.66), palm: dir(-0.89, 0.3, 0.33), shape: L_UP }, { zMin: 0.6 }), ease: 'sine' },
    { ...p1.l, t: at(1.42), pos: p1.l.pos.clone().add(V(0.035, -0.02, 0)), ease: 'sine' },
    p1.l, p2.l, p3.l,
    { t: at(2.18), idle: true, ease: 'io' },
  ];
  const head = [{ t: 0, pitch: 0 }, { t: at(0.76), pitch: 0 }, { t: at(0.90), pitch: -4 }, { t: at(1.94), pitch: -3 }, { t: at(2.14), pitch: 0 }];
  return {
    name: 'pozhaluysta-povtorite', duration: at(2.20), right, left, head,
    description:
      'РЖЯ «Пожалуйста, повторите», как у носителя в SpreadTheSign RU sentence 10146 (видео 133656), в его темпе: ' +
      'ПОВТОРИТЕ — левая ладонью вверх, правая дважды загребает по ней и сжимается; затем ПОЖАЛУЙСТА — ладони «домиком» ' +
      'перед грудью. Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ «Здравствуйте, вам помочь?» (ЦОН, 28.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/sentence/23107 (видео 313532), одна носительница. Время жеста = время записи − 0.96 с.
// По кадрам (крупно ×1.05) и разметке подряд по кадрам (кисть сверена с запястьем позы):
//   ЗДРАВСТВУЙТЕ 1.10–1.78: 1.10–1.46 обе раскрытые кисти у груди по бокам, ладонями к себе, пальцы внутрь и вверх (правая
//   пясть 31…46°, левая 139…148°), запястья широко — (∓0.78…0.89, −0.42…−0.60); 1.58–1.78 кисти поворачиваются ладонями
//   вверх и уходят вперёд и к середине (правая (−0.72 → −0.47, −0.46…−0.51), левая (0.67 → 0.41, −0.48…−0.62)), пальцы
//   к собеседнику.
//   ВАМ ПОМОЧЬ 1.82–2.10: левая ладонью вверх, пальцы вперёд и вправо, большой вверх; правая ребром на ней — большой вверх,
//   пальцы вперёд, ладонь к середине; запястья (−0.37…−0.41, −0.37…−0.56) и (0.24…0.30, −0.37…−0.58), кисти вместе чуть
//   опускаются.
//   Вопрос 2.14–2.42: кисти расходятся ладонями вверх, пальцы расслаблены, к 2.40 — в стороны (запястья позы ∓0.64…0.71).
//   2.46–2.60 вниз.
function zdravstvuyteVamPomoch() {
  const T0 = 0.96;
  const at = (tr) => +(tr - T0).toFixed(3);
  const mirK = (k) => ({ ...k, fingers: mirV(k.fingers), palm: mirV(k.palm) });
  // ЗДРАВСТВУЙТЕ у груди: раскрытая кисть, пальцы чуть врозь и согнуты к груди (у носительницы указательный в кадре на
  // 20…30° ниже пясти)
  const OPEN = shape({
    index: { curl: [30, 22, 8], spread: -3 }, middle: { curl: [30, 22, 8], spread: 0 },
    ring: { curl: [32, 22, 8], spread: 3 }, pinky: { curl: [34, 22, 8], spread: 6 },
    thumb: { abd: -25, f1: -5, f2: 0, f3: 0 },
  });
  const CHEST = { fingers: dir(0.6, 0.6, 0.5), palm: dir(0.55, 0.2, -0.81), shape: OPEN };
  // вперёд и ВАМ ПОМОЧЬ (крупно): правая — плоская, большой вверх, пальцы влево и вперёд, ладонь к груди; левая —
  // «лодочкой», пальцы вправо и вверх, большой вверх
  const FLAT_R = { fingers: dir(0.85, -0.05, 0.52), palm: dir(0.52, 0, -0.85), shape: SH.flatLhover };
  const CUP_L = { fingers: dir(-0.6, 0.55, 0.58), palm: dir(-0.36, 0.47, -0.82), shape: SH.cupped };
  const HELP_R = { fingers: dir(0.9, -0.05, 0.43), palm: dir(0.43, 0, -0.9), shape: SH.flatLhover };
  // левая под ПОМОЧЬ: пальцы вправо и вперёд, ближе к горизонтали, чем у носительницы (в кадре 157° против её 137…151°):
  // правая лежит ребром на ладони — при её пальцах, торчащих вверх, правую пришлось бы поднять над кончиками
  const HELP_L = {
    fingers: dir(-0.6, 0.25, 0.76), palm: dir(0.36, 0.93, -0.02),
    shape: shape({
      index: { curl: [20, 15, 8], spread: 8 }, middle: { curl: [20, 15, 8], spread: 0 },
      ring: { curl: [22, 15, 8], spread: -7 }, pinky: { curl: [24, 15, 8], spread: -14 },
      thumb: { abd: -30, f1: -10, f2: 0, f3: 0 },
    }),
  };
  // вопрос: пальцы полусогнуты, большой вверх, ладони вверх; затем кисти в стороны
  const CLAW = shape({
    index: { curl: [45, 35, 15], spread: 6 }, middle: { curl: [46, 35, 15], spread: 0 },
    ring: { curl: [48, 35, 15], spread: -5 }, pinky: { curl: [50, 35, 15], spread: -10 },
    thumb: { abd: -30, f1: -5, f2: 0, f3: 0 },
  });
  const ASK = { fingers: dir(0.5, 0.55, 0.67), palm: dir(0.25, 0.65, -0.72), shape: CLAW };
  const ASK_OUT = { fingers: dir(-0.5, 0.45, 0.74), palm: dir(0.2, 0.85, -0.5), shape: SH.openUp };
  const ER = [-0.86, -0.94], EL = [0.86, -1.02];
  const SAME_DEPTH = { zMin: 0.55, zMax: 0.65, zPref: 0.6 };
  const R = (tr, w2, k, e = ER, ease = 'sine', o) => ({ ...refKey('right', at(tr), w2, e, k, o), ease });
  const L = (tr, w2, k, e = EL, ease = 'sine', o) => ({ ...refKey('left', at(tr), w2, e, k, o), ease });
  // правая ребром поперёк пальцев левой: левая стоит, где у носительницы; правая ставится чуть ниже и поднимается над
  // левой до 3 мм (обе на одной глубине, иначе не встретятся)
  const over = (r, l) => {
    const m = touchNear(r, l);
    if (Math.abs(m.gap - 0.003) > 0.001) throw new Error(`ВАМ ПОМОЧЬ ${r.t} с: кисти не сходятся (зазор ${(m.gap * 1000).toFixed(1)} мм)`);
    return m;
  };
  const hl1 = L(1.88, [0.27, -0.42], HELP_L, [0.70, -1.0], 'sine', SAME_DEPTH);
  const hr1 = over(R(1.88, [-0.38, -0.39], HELP_R, [-0.76, -0.93], 'sine', SAME_DEPTH), hl1);
  const hl2 = L(2.04, [0.25, -0.58], HELP_L, [0.68, -0.98], 'sine', SAME_DEPTH);
  const hr2 = over(R(2.04, [-0.40, -0.55], HELP_R, [-0.75, -0.94], 'sine', SAME_DEPTH), hl2);
  const right = [
    { t: 0, idle: true },
    { t: at(1.00), idle: true },
    R(1.14, [-0.84, -0.55], { ...CHEST, fingers: dir(0.65, 0.45, 0.6), palm: dir(0.6, 0.05, -0.8) }, ER, 'io'),
    R(1.28, [-0.84, -0.45], CHEST),
    R(1.46, [-0.79, -0.49], CHEST),
    R(1.64, [-0.64, -0.46], FLAT_R, [-0.82, -0.89]),
    R(1.78, [-0.47, -0.51], FLAT_R, [-0.84, -0.97]),
    hr1, hr2,
    // аудит 28.09: расходясь к вопросу, пальцы правой прорезали ладонь левой (−13.5 мм) — правая под загнутыми пальцами
    // левой, поэтому сперва уходит вниз и вправо
    { ...hr2, t: at(2.11), pos: hr2.pos.clone().add(V(-0.03, -0.035, 0)), ease: 'sine' },
    R(2.20, [-0.52, -0.47], ASK, [-0.75, -0.92]),
    R(2.38, [-0.65, -0.41], ASK_OUT, [-0.63, -0.92]),
    { t: at(2.66), idle: true, ease: 'io' },
  ];
  const left = [
    { t: 0, idle: true },
    { t: at(1.00), idle: true },
    L(1.14, [0.76, -0.50], mirK({ ...CHEST, fingers: dir(0.65, 0.45, 0.6), palm: dir(0.6, 0.05, -0.8) }), EL, 'io'),
    L(1.28, [0.83, -0.51], mirK(CHEST)),
    L(1.46, [0.74, -0.56], mirK(CHEST)),
    L(1.64, [0.57, -0.57], CUP_L, [0.78, -0.97]),
    L(1.78, [0.41, -0.48], CUP_L, [0.76, -1.0]),
    hl1, hl2,
    { ...hl2, t: at(2.11), pos: hl2.pos.clone().add(V(0.02, 0.01, 0)), ease: 'sine' },
    L(2.20, [0.45, -0.50], mirK(ASK), [0.68, -0.99]),
    L(2.38, [0.66, -0.47], mirK(ASK_OUT), [0.56, -0.98]),
    { t: at(2.66), idle: true, ease: 'io' },
  ];
  const head = [{ t: 0, pitch: 0 }, { t: at(2.66), pitch: 0 }];
  return {
    name: 'zdravstvuyte-vam-pomoch', duration: at(2.68), right, left, head,
    description:
      'РЖЯ «Здравствуйте, вам помочь?», как у носительницы в SpreadTheSign RU sentence 23107 (видео 313532), в её темпе: ' +
      'ЗДРАВСТВУЙТЕ — раскрытые ладони у груди, затем кисти вперёд к собеседнику; ВАМ ПОМОЧЬ — правая плоская, большой ' +
      'вверх, ребром поперёк пальцев левой «лодочки»; вопрос — полусогнутые кисти вверх и в стороны. Поза решена IK на ' +
      'avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

// ═══════════════ «Извините» (ЦОН, 28.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/sentence/8811 (видео 100652), одна носительница. Время жеста = время записи − 0.56 с.
// По кадрам и разметке подряд по кадрам: 0.62–0.70 обе руки поднимаются. 0.74–1.70 левая ладонью вверх перед грудью,
// пальцы вправо (пясть в кадре 149…157°), запястье позы (0.24…0.34, −0.44…−0.57) — под правой почти не размечается.
// Правая плоская, пальцы прямые и вместе, ладонью вниз, пальцы влево (пясть 2…39°), лежит на левой ладони и дважды
// кругами трёт её (кончик указательного по x: 0.33 → 0.03 → 0.19 → 0.00), смещаясь вправо: запястье (−0.19…−0.23,
// −0.37…−0.47) в 0.70–1.06 → (−0.31…−0.41, −0.34…−0.40) в 1.14–1.70. 1.74–1.86 кисти расходятся и опускаются.
function izvinite() {
  const T0 = 0.56;
  const at = (tr) => +(tr - T0).toFixed(3);
  const FLAT = shape({
    index: { curl: [5, 5, 3], spread: 8 }, middle: { curl: [5, 5, 3], spread: 0 },
    ring: { curl: [6, 5, 3], spread: -7 }, pinky: { curl: [7, 5, 3], spread: -14 },
    thumb: { abd: -5, f1: 0, f2: 0, f3: 0 },
  });
  // левая ближе к горизонтали, чем у носительницы (в кадре ~170° против 149…157° после её выхода из-под правой): при
  // поднятых пальцах левой правая, лёжа на ней, вставала на 0.13 ширины плеч выше носительницы
  const LK = { fingers: dir(-0.9, 0.18, 0.4), palm: dir(0.2, 0.98, 0.0), shape: SH.flatUp };
  const RK = { fingers: dir(0.9, 0.35, 0.25), palm: dir(0.3, -0.95, 0.0), shape: FLAT };
  const ER = [-0.72, -0.93], EL = [0.58, -0.94];
  const lk = (tr, w2, ease = 'sine') => ({ ...refKey('left', at(tr), w2, EL, LK), ease });
  // правая на левой ладони: по высоте — до касания 3 мм (левая в тот же момент — там, где у носительницы)
  const on = (tr, w2, ease = 'sine') => {
    const l = lk(tr, [0.28 + (tr - 0.74) * 0.05, -0.53]);
    const r = touchNear({ ...refKey('right', at(tr), w2, ER, RK), ease }, l);
    if (Math.abs(r.gap - 0.003) > 0.001) throw new Error(`ИЗВИНИТЕ ${tr} с: кисти не сходятся (${(r.gap * 1000).toFixed(1)} мм)`);
    return { r, l };
  };
  const c = [
    on(0.80, [-0.20, -0.42], 'io'), on(0.94, [-0.21, -0.38]), on(1.06, [-0.25, -0.40]), on(1.18, [-0.34, -0.39]),
    on(1.30, [-0.36, -0.37]), on(1.42, [-0.41, -0.36]), on(1.56, [-0.38, -0.35]), on(1.68, [-0.36, -0.39]),
  ];
  const right = [
    { t: 0, idle: true },
    { t: at(0.62), idle: true },
    ...c.map((x) => x.r),
    // аудит 28.09: отпуская вниз, правая прорезала пальцы левой (−13.5 мм) — сперва приподнимается и отходит вправо
    { ...c[7].r, t: at(1.80), pos: c[7].r.pos.clone().add(V(-0.07, 0.04, 0)), shape: mixShape(FLAT, SH.rest, 0.4), ease: 'sine' },
    { t: at(2.04), idle: true, ease: 'io' },
  ];
  const left = [
    { t: 0, idle: true },
    { t: at(0.62), idle: true },
    { ...c[0].l, ease: 'io' },
    ...c.slice(1).map((x) => x.l),
    // пальцы левой смотрят на правую — левая сперва отходит влево, чтобы правая, опускаясь, не прошла сквозь её кончики
    lk(1.84, [0.46, -0.55]),
    { t: at(2.04), idle: true, ease: 'io' },
  ];
  const head = [{ t: 0, pitch: 0 }, { t: at(2.04), pitch: 0 }];
  return {
    name: 'izvinite', duration: at(2.06), right, left, head,
    description:
      'РЖЯ «Извините», как у носительницы в SpreadTheSign RU sentence 8811 (видео 100652), в её темпе: левая ладонью ' +
      'вверх перед грудью, правая плоская ладонью вниз дважды кругами трёт её. Поза решена IK на avatar_elnar.glb ' +
      '(scripts/author-phrases.mjs).',
  };
}

// ═══════════════ ДОКУМЕНТ (ЦОН, 28.09) ═══════════════
// Эталон — spreadthesign.com/ru.ru/word/7926 «документ» (видео 295361), одна носительница. Время жеста = время записи −
// 0.10 с. По кадрам и разметке подряд по кадрам: 0.10–0.30 руки поднимаются. 0.34–0.54 правый кулак торчком над правой
// стороной груди (пясть вверх 67…71°, запястье (−0.43…−0.51, −0.13…0.11)); левая — ладонью вверх, пальцы вправо (пясть
// 136…169°), запястье (0.12…0.21, −0.20…−0.46). «Печать» дважды: 0.62–0.78 кулак ребром на левой ладони (запястье позы
// (−0.33…−0.41, −0.22…−0.25)), 0.82–0.90 чуть поднимается (−0.14…−0.17), 0.98–1.20 снова на ладони (−0.26…−0.30,
// −0.30…−0.36); 1.10–1.26 обе кисти вместе опускаются (левая до −0.57). 1.30–1.46 вниз.
function dokument() {
  const T0 = 0.10;
  const at = (tr) => +(tr - T0).toFixed(3);
  // кулак торчком в замахе; на ладони (крупно ×1.4) — предплечье горизонтально, кулак ладонью вниз на середине левой ладони
  const FIST = { fingers: dir(0.35, 0.92, 0.15), palm: dir(0.93, -0.35, 0), shape: SH.fist };
  // «печать» ребром: предплечье горизонтально, кулак влево и чуть вперёд, большой сверху, на ладонь опускается мизинцевая
  // сторона (ладонью вниз большой палец выступал книзу и вставал на ладонь первым — кулак висел над ней)
  const FIST_DOWN = { fingers: dir(0.95, -0.1, 0.3), palm: dir(0.3, 0, -0.95), shape: SH.fist };
  // левая ладонью вверх, большой вверх (у носительницы в кадре 77…119°); пальцы ближе к горизонтали, чем у неё (в кадре
  // ~169° против её 146…169°) — иначе кулак, лёжа на ладони, вставал выше её поднятых кончиков
  const LK = {
    fingers: dir(-0.95, 0.18, 0.25), palm: dir(0.17, 0.98, 0.0),
    shape: shape({
      index: { curl: [4, 5, 3], spread: 8 }, middle: { curl: [4, 5, 3], spread: 0 },
      ring: { curl: [5, 6, 3], spread: -7 }, pinky: { curl: [6, 7, 4], spread: -14 },
      thumb: { abd: -30, f1: 15, f2: 0, f3: 0 },
    }),
  };
  const ER = [-1.0, -0.66], EL = [0.76, -0.88];
  // на ладони кулак ближе к груди, чем большой палец левой (он торчит вверх на её переднем крае): левая на глубине ~0.62,
  // правая ~0.50 ширины плеч
  const L_DEPTH = { zMin: 0.6, zMax: 0.66, zPref: 0.62 }, R_DEPTH = { zMin: 0.46, zMax: 0.54, zPref: 0.5 };
  const lk = (tr, w2, ease = 'sine', o) => ({ ...refKey('left', at(tr), w2, EL, LK, o), ease });
  const rk = (tr, w2, ease = 'sine', k = FIST, o) => ({ ...refKey('right', at(tr), w2, ER, k, o), ease });
  // кулак ребром на левой ладони: по высоте — до касания 3 мм
  const stamp = (tr, w2r, w2l) => {
    const l = lk(tr, w2l, 'sine', L_DEPTH);
    const r = touchNear(rk(tr, w2r, 'sine', FIST_DOWN, R_DEPTH), l, { fromAbove: true });
    if (Math.abs(r.gap - 0.003) > 0.001) throw new Error(`ДОКУМЕНТ ${tr} с: кулак не встал на ладонь (${(r.gap * 1000).toFixed(1)} мм)`);
    return { r, l };
  };
  const s1 = stamp(0.66, [-0.34, -0.23], [0.15, -0.24]), s2 = stamp(0.76, [-0.39, -0.25], [0.12, -0.29]);
  const s3 = stamp(1.00, [-0.28, -0.30], [0.15, -0.32]), s4 = stamp(1.12, [-0.28, -0.33], [0.14, -0.40]);
  const s5 = stamp(1.24, [-0.29, -0.45], [0.15, -0.52]);
  const right = [
    { t: 0, idle: true },
    { t: at(0.12), idle: true },
    rk(0.36, [-0.49, -0.10], 'io'), rk(0.48, [-0.46, 0.10]),
    s1.r, s2.r, rk(0.86, [-0.40, -0.14], 'sine', { ...FIST_DOWN, fingers: dir(0.85, 0.3, 0.43), palm: dir(0.45, 0, -0.89) }), s3.r, s4.r, s5.r,
    // аудит 28.09: из «печати» прямо в покой кулак прорезал левую ладонь (−19.5 мм) — сперва приподнимается и отходит вправо
    { ...s5.r, t: at(1.32), pos: s5.r.pos.clone().add(V(-0.05, 0.03, 0)), ease: 'sine' },
    { t: at(1.52), idle: true, ease: 'io' },
  ];
  const left = [
    { t: 0, idle: true },
    { t: at(0.12), idle: true },
    lk(0.34, [0.21, -0.46], 'io'), lk(0.50, [0.16, -0.22]),
    s1.l, s2.l, lk(0.86, [0.12, -0.34]), s3.l, s4.l, s5.l,
    lk(1.32, [0.19, -0.64]),
    { t: at(1.52), idle: true, ease: 'io' },
  ];
  const head = [{ t: 0, pitch: 0 }, { t: at(1.52), pitch: 0 }];
  return {
    name: 'words/dokument', duration: at(1.54), right, left, head,
    description:
      'РЖЯ ДОКУМЕНТ, как у носительницы в SpreadTheSign RU word 7926 (видео 295361), в её темпе: правый кулак торчком ' +
      'дважды ставит «печать» ребром на левую ладонь. Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).',
  };
}

/**
 * Кулак у лица: передняя сторона кулака (тыл средних фаланг среднего пальца —
 * у сжатой кисти он смотрит туда же, куда ладонь) ставится на точку лица
 * `spot` при наклоне головы head = [pitch, roll], затем кисть отодвигается по
 * нормали лица до 3 мм кожа к коже. Ориентация кисти остаётся той, что в ключе.
 */
function touchSpot(key, spot, head, shift = V(0, 0, 0)) {
  return touch(key, { spot, on: 'face', point: 'fist', head, shift });
}

/** Точка кисти, которой она касается (кадр уже наложен). */
function handPoint(side, kind) {
  const B = ARM[side];
  const palmN = V(0, 0, 1).applyQuaternion(rig.bones.get(B.hand).getWorldQuaternion(new THREE.Quaternion()));
  const pts = K.handPoints(side);
  if (kind === 'fist') { // тыл средних фаланг сжатых пальцев — «перед» кулака
    const pip = wpos(rig.bones.get(B.middle[1])), dip = wpos(rig.bones.get(B.middle[2]));
    return pip.lerp(dip, 0.5).add(palmN.multiplyScalar(0.009));
  }
  if (kind === 'tip') return pts.index; // кончик указательного
  if (kind === 'pads') return pts.index.clone().lerp(pts.middle, 0.5).add(palmN.multiplyScalar(0.006)); // подушечки
  if (kind === 'palm') return pts.palmCenter; // середина ладони (на коже)
  if (kind === 'thumb') return pts.thumb; // кончик большого
  if (kind === 'indexSide') { // ребро указательного со стороны большого, у второй фаланги
    const a = wpos(rig.bones.get(B.index[1])), b = wpos(rig.bones.get(B.index[2]));
    const x = V(1, 0, 0).applyQuaternion(rig.bones.get(B.hand).getWorldQuaternion(new THREE.Quaternion()));
    return a.lerp(b, 0.5).add(x.multiplyScalar(0.008));
  }
  throw new Error(kind);
}

/**
 * Касание: точка кисти `point` ставится на точку `spot` лица (on: 'face', с
 * наклоном головы head = [pitch, roll]) или груди (on: 'body'), затем кисть
 * отодвигается по нормали поверхности до 3 мм кожа к коже. Ориентация и форма
 * кисти — из ключа; правая рука, левая — в покое, если не передана `left`.
 */
function touch(key, { spot, on, point, head = [0, 0], shift = V(0, 0, 0), side = 'right', other = { idle: true } }) {
  const place = (pos) => {
    const me = keyPose(side, { ...key, pos });
    applyFrame(rig, side === 'right' ? frameAt(me, other, head) : frameAt(other, me, head));
  };
  const target = () => (on === 'face' ? K.faceSpot(spot) : K.bodySpot(spot)).add(shift);
  const gapNow = () => (on === 'face' ? K.faceGap(side) : K.bodyGap(side));
  let W = K.ref(-0.2, 0.2, 0.5);
  for (let it = 0; it < 3; it++) {
    place(W);
    W = W.clone().add(target().sub(handPoint(side, point)));
  }
  place(W);
  // нормаль: у лица — от центра головы к точке, у груди — вперёд
  const n = on === 'face' ? target().sub(wpos(rig.bones.get('mixamorigHead'))).normalize() : V(0, 0, 1);
  let gap = gapNow();
  for (let it = 0; it < 30 && Math.abs(gap - 0.003) > 3e-4; it++) {
    W = W.clone().add(n.clone().multiplyScalar((0.003 - gap) * 0.8));
    place(W);
    gap = gapNow();
  }
  applyFrame(rig, {});
  return { ...key, pos: W, [on === 'face' ? 'faceGap' : 'bodyGap']: gap };
}

/**
 * Локоть как у носителя при уже найденной кисти: запястье и ориентация кисти остаются (касание не меняется),
 * локоть поворачивается вокруг оси плечо—запястье, пока в кадре не встанет ближе всего к локтю носителя e2
 * (ширины плеч). Для ключей касания (touch, touchFace) — там направление локтя задавалось на глаз.
 */
function fitPole(side, key, e2, head = [0, 0]) {
  const S = wpos(rig.bones.get(ARM[side].arm));
  const a = key.pos.clone().sub(S).normalize();
  const u = V(0, -1, 0).sub(a.clone().multiplyScalar(-a.y)).normalize();
  const w = new THREE.Vector3().crossVectors(a, u);
  let best = null;
  for (let psi = -150; psi <= 150; psi += 2) {
    const pole = u.clone().multiplyScalar(Math.cos(rad(psi))).add(w.clone().multiplyScalar(Math.sin(rad(psi))));
    const pose = keyPose(side, { ...key, pole });
    applyFrame(rig, side === 'right' ? frameAt(pose, { idle: true }, head) : frameAt({ idle: true }, pose, head));
    const E = wpos(rig.bones.get(ARM[side].fore));
    if (K.toRef(E).z < -0.25) continue; // локоть не уходит за спину
    const [px, py] = to2(E);
    const err = Math.hypot(px - e2[0], py - e2[1]);
    if (!best || err < best.err) best = { err, pole, e2: [px, py] };
  }
  applyFrame(rig, {});
  return { ...key, pole: best.pole, elbow2: best.e2 };
}

/**
 * Кисть у лица: запястье в кадре там же, где у носителя (x2, y2 — ширины плеч),
 * глубина подбирается так, чтобы кисть касалась лица (3 мм кожа к коже) при
 * наклоне головы head = [pitch, roll] в этот момент.
 */
function touchFace(key, w2, head) {
  const gapAt = (z) => {
    applyFrame(rig, frameAt(keyPose('right', { ...key, pos: P2(w2[0], w2[1], z) }), { idle: true }, head));
    return K.faceGap('right');
  };
  let lo = 0.1, hi = 1.2; // lo — в лице (зазор < 3 мм), hi — далеко
  if (gapAt(hi) < 0.003) throw new Error(`касание лица в ${key.t} с: кисть в лице даже на глубине ${hi}`);
  if (gapAt(lo) > 0.003) lo = -0.2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (gapAt(mid) < 0.003) lo = mid; else hi = mid;
  }
  const gap = gapAt(hi);
  applyFrame(rig, {});
  return { ...key, pos: P2(w2[0], w2[1], hi), faceGap: gap, depth: hi };
}

/**
 * Отдельное слово из знака фразы (scripts/lib/wordSlices.mjs): те же ключи, подъём из
 * покоя за rise до первого ключа и опускание в покой за lower после последнего.
 */
function sliceWord(phrase, w) {
  const shift = wordShift(w);
  const tracks = {};
  let dur = 0;
  for (const side of ['right', 'left']) {
    const [a, b] = w[side] ?? [w.from, w.to];
    const keys = phrase[side]
      .filter((k) => !k.idle && k.t >= a - 0.005 && k.t <= b + 0.005)
      .map((k) => ({ ...k, t: +(k.t - shift).toFixed(3) }));
    if (!keys.length) { tracks[side] = null; continue; }
    // подъём из покоя — плавно, как бы ни входил знак во фразе из соседнего
    if (!keys[0].ease || keys[0].ease === 'lin') keys[0] = { ...keys[0], ease: 'io' };
    // к знаку у лица рука идёт через точку перед грудью (прямой дугой из покоя задела бы свитер)
    if (w.via && side === 'right') {
      const k0 = keys[0];
      keys.unshift({ ...k0, t: +(k0.t - w.via.dt).toFixed(3), pos: k0.pos.clone().add(V(...w.via.d)), ease: 'io' });
      keys[1] = { ...keys[1], ease: 'sine' };
    }
    const end = +(keys[keys.length - 1].t + w.lower).toFixed(3);
    tracks[side] = [{ t: 0, idle: true }, ...keys, { t: end, idle: true, ease: 'io' }];
    dur = Math.max(dur, end);
  }
  if (!tracks.right) throw new Error(`words/${w.name}: у правой нет ключей в ${w.from}…${w.to}`);
  for (const side of ['right', 'left']) {
    const tr = tracks[side] ?? [{ t: 0, idle: true }];
    if (tr[tr.length - 1].t < dur) tr.push({ t: dur, idle: true });
    tracks[side] = tr;
  }
  return {
    name: `words/${w.name}`, duration: +(dur + 0.02).toFixed(3), right: tracks.right, left: tracks.left,
    head: [{ t: 0, pitch: 0 }, { t: dur, pitch: 0 }],
    description:
      `РЖЯ ${w.label} — знак по видео словаря SpreadTheSign RU ${w.source}, в темпе носителя; тот же, что во ` +
      `фразе ${w.phrase}, но из покоя в покой. Поза решена IK на avatar_elnar.glb (scripts/author-phrases.mjs).`,
  };
}

// GESTURES_OUT=<папка> — писать туда (например, в черновик), а не в public/gestures
const OUT_DIR = path.resolve(process.env.GESTURES_OUT ?? path.join(ROOT, 'public/gestures'));
// node scripts/author-phrases.mjs [имя …] — собрать только эти фразы и слова (по умолчанию все);
// «words» — все отдельные слова, «words/mama» — одно
const only = process.argv.slice(2);
const PHRASES = { 'kak-dela': kakDela, 'kak-pomoch': kakPomoch, spasibo, 'ya-lyublyu-mamu': yaLyublyuMamu, 'ya-khochu-est': yaKhochuEst, 'kto-tam': ktoTam, 'my-rabotat-segodnya': myRabotatSegodnya, 'ty-idti-shkola-zavtra': tyIdtiShkolaZavtra,
  'do-svidaniya': doSvidaniya, 'words/khorosho': khorosho, 'words/pozhaluysta': pozhaluysta, 'words/da': da, 'words/plokho': plokho,
  'words/glukhoy': glukhoy, 'words/chto': chto, 'words/papa': papa,
  'words/ponimat': ponimat,
  // новые фразы и слова (26.09)
  'dobroe-utro': dobroeUtro, 'dobryi-den': dobryiDen, 'spokoinoi-nochi': spokoinoiNochi,
  'ya-ne-ponimayu': yaNePonimayu, 'menya-zovut': menyaZovut, 'kak-tebya-zovut': kakTebyaZovut,
  'ya-lyublyu-tebya': yaLyublyuTebya, 'ty-khochesh-est': tyKhocheshEst,
  'words/poka': poka, 'words/net': net, 'words/gde': gde, 'words/pit': pit,
  // Окно ЦОН (27.09)
  'pozhaluysta-podozhdite': pozhaluystaPodozhdite, 'pozhaluysta-povtorite': pozhaluystaPovtorite,
  'zdravstvuyte-vam-pomoch': zdravstvuyteVamPomoch, izvinite, 'words/dokument': dokument };
const want = (n) => !only.length || only.includes(n) || (n.startsWith('words/') && only.includes('words'));
const built = new Map();
const phraseObj = (n) => { if (!built.has(n)) built.set(n, PHRASES[n]()); return built.get(n); };
const jobs = [
  ...Object.keys(PHRASES).filter(want).map(phraseObj),
  ...WORD_SLICES.filter((w) => want(`words/${w.name}`)).map((w) => sliceWord(phraseObj(w.phrase), w)),
];
for (const phrase of jobs) {
  const frames = build(phrase);
  const gesture = {
    name: phrase.name, rotation_order: 'XYZ', unit: 'radians', fps_target: FPS,
    description: phrase.description, frames,
  };
  const out = path.join(OUT_DIR, `${phrase.name}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(gesture) + '\n');
  console.log(`записано ${path.relative(ROOT, out)}: ${frames.length} кадров, ${phrase.duration.toFixed(2)} с`);
  for (const side of ['right', 'left']) {
    for (const k of phrase[side]) {
      if (k.idle) continue;
      const w2 = to2(k.pos);
      const q = K.toRef(k.pos);
      console.log(`  ${side.padEnd(5)} t=${k.t.toFixed(2)} запястье в кадре (${w2.map((x) => x.toFixed(2))}) глубина ${q.z.toFixed(2)}${k.gap !== undefined ? ` касание ${(k.gap * 1000).toFixed(1)} мм` : ''}${k.faceGap !== undefined ? ` до лица ${(k.faceGap * 1000).toFixed(1)} мм` : ''}${k.bodyGap !== undefined ? ` до груди ${(k.bodyGap * 1000).toFixed(1)} мм` : ''}`);
    }
  }
}

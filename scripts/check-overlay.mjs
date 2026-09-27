/**
 * Проверка разметки трекинга без браузера.
 *
 *   node scripts/check-overlay.mjs
 *
 * Canvas тут поддельный: он не рисует, а записывает, что у него просили. Этого
 * достаточно, чтобы проверить две вещи, которые ломаются молча и которые
 * пользователь видит как «скелет пропал».
 *
 * 1. Маркер потерянной кисти остаётся ВНУТРИ кадра. Измерено на 400 клипах
 *    SLOVO: у 22.4% событий «кисть потеряна» запястье позы лежит вне кадра, и
 *    маркер, привязанный к нему напрямую, рисуется за границей канваса — то
 *    есть рука исчезает молча ровно тогда, когда объяснение нужнее всего.
 *
 * 2. Порядок отрисовки не мерцает. При сведённых кистях у 8.2% кадров разница
 *    глубин меньше 0.05 — там знак определяет шум, и без гистерезиса стопка
 *    перещёлкивается около раза в секунду на 30 fps.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qyran-overlay-')), 'overlay.mjs');
execFileSync(path.join(ROOT, 'node_modules/.bin/esbuild'), [
  path.join(ROOT, 'src/lib/skeletonOverlay.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`,
], { stdio: 'pipe' });
const { drawTrackedSkeleton, SIDE_PAINT } = await import(bundle);

/**
 * Поддельный контекст: записывает координаты и цвета вместо рисования.
 *
 * strokeStyle и fillStyle держим РАЗДЕЛЬНО. Сначала они были одним полем, и
 * тест врал: точки суставов заливаются цветом стороны, но обводятся тёмным, и
 * общее поле сохраняло только последнее присваивание.
 */
function recordingContext() {
  const points = [];
  const arcs = [];
  const ctx = {
    strokeStyle: null, fillStyle: null,
    lineWidth: 1, lineJoin: '', lineCap: '', globalAlpha: 1,
    save() {}, restore() {}, beginPath() {}, closePath() {},
    setLineDash() {},
    moveTo(x, y) { points.push({ x, y, stroke: ctx.strokeStyle }); },
    lineTo(x, y) { points.push({ x, y, stroke: ctx.strokeStyle }); },
    arc(x, y, r) {
      const rec = { x, y, r, stroke: ctx.strokeStyle, fill: ctx.fillStyle };
      points.push(rec);
      arcs.push(rec);
    },
    stroke() {}, fill() {},
  };
  return { ctx, points, arcs };
}

const hand = (cx, cy) => Array.from({ length: 21 }, (_, i) => ({
  x: cx + (i % 5) * 0.01, y: cy + Math.floor(i / 5) * 0.01, z: 0,
}));

/** Поза: плечи, локти, запястья. Остальные точки решателю тут не нужны. */
function pose({ leftWrist, rightWrist, zl = 0, zr = 0, visL = 1, visR = 1 }) {
  const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  p[11] = { x: 0.35, y: 0.35, z: 0, visibility: 1 };
  p[13] = { x: 0.30, y: 0.50, z: 0, visibility: 1 };
  p[15] = { ...leftWrist, z: zl, visibility: visL };
  p[12] = { x: 0.65, y: 0.35, z: 0, visibility: 1 };
  p[14] = { x: 0.70, y: 0.50, z: 0, visibility: 1 };
  p[16] = { ...rightWrist, z: zr, visibility: visR };
  return p;
}

const W = 640, H = 480;
let failed = 0;
const report = (ok, text) => { if (!ok) failed++; console.log(`${ok ? '  ок  ' : 'ПРОВАЛ'} ${text}`); };

// --- 1. Маркер потерянной кисти не уезжает за край -------------------------
for (const [label, wrist] of [
  ['правее кадра', { x: 1.35, y: 0.6 }],
  ['ниже кадра', { x: 0.5, y: 1.4 }],
  ['левее и выше', { x: -0.4, y: -0.2 }],
  ['в кадре', { x: 0.7, y: 0.5 }],
]) {
  const { ctx, points } = recordingContext();
  drawTrackedSkeleton(ctx, {
    poseLandmarks: pose({ leftWrist: { x: 0.3, y: 0.6 }, rightWrist: wrist, visR: 0.2 }),
    leftHandLandmarks: hand(0.28, 0.58),
    rightHandLandmarks: undefined,           // правая кисть потеряна
  }, W, H, {});

  // Маркер — единственная дуга, ОБВЕДЁННАЯ цветом правой стороны (у суставов
  // цвет стороны идёт в заливку, а обводка тёмная).
  const marks = points.filter((p) => p.r && p.stroke === SIDE_PAINT.right.bone);
  const inside = marks.length > 0 && marks.every((m) =>
    m.x - m.r >= 0 && m.x + m.r <= W && m.y - m.r >= 0 && m.y + m.r <= H);
  report(inside, `маркер потерянной кисти (${label}): ${marks.length ? `центр ${marks[0].x.toFixed(0)},${marks[0].y.toFixed(0)}` : 'не нарисован'}`);
}

// --- 2. Порядок отрисовки не мерцает --------------------------------------
/** Первая нарисованная кисть — дальняя. Возвращает сторону, что рисуется первой. */
function firstDrawnSide(state, zl, zr) {
  const { ctx, arcs } = recordingContext();
  drawTrackedSkeleton(ctx, {
    poseLandmarks: pose({ leftWrist: { x: 0.45, y: 0.5 }, rightWrist: { x: 0.55, y: 0.5 }, zl, zr }),
    leftHandLandmarks: hand(0.43, 0.48),
    rightHandLandmarks: hand(0.53, 0.48),
  }, W, H, { state });
  // Суставы кисти заливаются цветом стороны — по первой такой дуге и видно,
  // какая кисть нарисована первой, то есть какая оказалась дальней.
  const first = arcs.find((a) => a.fill === SIDE_PAINT.left.bone || a.fill === SIDE_PAINT.right.bone);
  if (!first) throw new Error('ни одна кисть не нарисована — тест не может судить о порядке');
  return first.fill === SIDE_PAINT.left.bone ? 'left' : 'right';
}

// Глубины почти равны, дрожат в пределах шума — порядок обязан стоять.
{
  const state = {};
  const jitter = [0.01, -0.02, 0.015, -0.005, 0.03, -0.025, 0.02, -0.01, 0.005, -0.03];
  const seen = jitter.map((d) => firstDrawnSide(state, 0.30, 0.30 + d));
  const flips = seen.filter((s, i) => i > 0 && s !== seen[i - 1]).length;
  report(flips === 0, `шум глубины (|dz| до 0.03): перещёлкиваний ${flips} из ${seen.length - 1}`);
}

// Руки реально поменялись местами — порядок обязан перестроиться.
{
  const state = {};
  const before = firstDrawnSide(state, 0.10, 0.60);   // левая заметно ближе
  const after = firstDrawnSide(state, 0.60, 0.10);    // теперь ближе правая
  report(before !== after, `настоящая смена глубины: было первым ${before}, стало ${after}`);
}

// Без памяти состояния порядок обязан хотя бы работать (не падать).
{
  const side = firstDrawnSide(undefined, 0.2, 0.5);
  report(side === 'right' || side === 'left', `без состояния порядок определяется: первым ${side}`);
}

process.exit(failed ? 1 : 0);

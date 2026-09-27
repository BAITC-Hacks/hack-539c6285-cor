/**
 * Страница для проверки разметки трекинга глазами, без камеры.
 *
 *   node scripts/preview-overlay.mjs        # соберёт _overlay-preview.html
 *   затем открыть http://localhost:5174/_overlay-preview.html при живом dev
 *
 * Берёт НАСТОЯЩИЕ кадры из ml/landmarks_holistic и рисует их той самой
 * функцией, что работает в студии (страница импортирует src/lib/skeletonOverlay
 * через dev-сервер, поэтому правки видны сразу по перезагрузке).
 *
 * Кадры подобраны по зазору между запястьями: от сведённых вплотную — там
 * скелеты и налезают друг на друга — до разведённых.
 */
import fs from 'node:fs';
import path from 'node:path';
import { frames, bodyFrame, handAlive, ROOT } from './lib/solver-harness.mjs';

/** Какие зазоры между запястьями показать, в долях ширины плеч. */
const TARGET_GAPS = [0.08, 0.2, 0.35, 0.6, 1.0];

const pool = [];
for (const f of frames({ step: 2, limit: 6000 })) {
  if (!handAlive(f, 'left') || !handAlive(f, 'right')) continue;
  const bf = bodyFrame(f);
  pool.push({ gap: bf.pose(15).distanceTo(bf.pose(16)), frame: Float32Array.from(f) });
}
if (!pool.length) throw new Error('кадров с двумя кистями не нашлось');

const block = (f, off, n) => Array.from({ length: n }, (_, i) => ({
  x: f[off + i * 3], y: f[off + i * 3 + 1], z: f[off + i * 3 + 2],
}));

const picked = TARGET_GAPS.map((target) => {
  const best = pool.reduce((a, b) => (Math.abs(b.gap - target) < Math.abs(a.gap - target) ? b : a));
  return {
    gap: Number(best.gap.toFixed(3)),
    data: {
      poseLandmarks: block(best.frame, 0, 33),
      leftHandLandmarks: block(best.frame, 129, 21),
      rightHandLandmarks: block(best.frame, 192, 21),
    },
  };
});

// Отдельный случай: MediaPipe потерял кисть. Так это выглядит в студии —
// рука должна остаться пунктиром с кружком, а не просто исчезнуть.
const lost = JSON.parse(JSON.stringify(picked[1]));
lost.gap = 'кисть потеряна';
lost.data.rightHandLandmarks = undefined;
picked.push(lost);

// И главный по данным случай: рука ушла ЗА КРАЙ кадра. По измерениям это 22.4%
// всех потерь — маркер обязан прижаться к краю и показать стрелкой направление,
// иначе он рисуется за границей канваса и рука пропадает молча.
const offscreen = JSON.parse(JSON.stringify(picked[3]));
offscreen.gap = 'рука ушла за кадр';
offscreen.data.rightHandLandmarks = undefined;
const wrist = offscreen.data.poseLandmarks[16];
wrist.x = 1.35;
wrist.y = 1.2;
wrist.visibility = 0.2;
picked.push(offscreen);

const out = path.join(ROOT, '_overlay-preview.html');
fs.writeFileSync(out, `<!doctype html>
<meta charset="utf-8">
<title>разметка трекинга — настоящие кадры</title>
<body style="margin:0;background:#0A0908;color:#ddd;font:13px ui-monospace,monospace;padding:16px">
<div style="margin-bottom:12px">Настоящие кадры SLOVO. Подпись — зазор между запястьями в долях ширины плеч; чем меньше, тем сильнее кисти налезают друг на друга.</div>
<div id="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;max-width:1400px"></div>
<script type="module">
import { drawTrackedSkeleton } from '/src/lib/skeletonOverlay.ts';
const shots = ${JSON.stringify(picked)};
const W = 420, H = 315;
for (const shot of shots) {
  const box = document.createElement('div');
  box.innerHTML = '<div style="padding:6px 2px">зазор ' + shot.gap + '</div>';
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  c.style.cssText = 'width:100%;border-radius:8px;background:#151515';
  box.appendChild(c);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#151515';
  ctx.fillRect(0, 0, W, H);
  drawTrackedSkeleton(ctx, shot.data, W, H);
  document.getElementById('grid').appendChild(box);
}
</script>
</body>
`);
console.log(`кадров в выборке: ${pool.length}`);
console.log(`выбраны зазоры: ${picked.map((p) => p.gap).join(', ')}`);
console.log(`готово: ${out}`);
console.log('открыть: http://localhost:5174/_overlay-preview.html');

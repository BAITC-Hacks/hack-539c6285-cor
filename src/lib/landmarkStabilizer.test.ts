import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, HAND_BONES, HolisticStabilizer, LandmarkStabilizer, OneEuroFilter, type Landmark } from './landmarkStabilizer';

const FPS = 30, DT = 1000 / FPS;
/** Детерминированный шум. */
function rng(seed = 1) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 - 0.5; }; }
/** Правдоподобная кисть: запястье + 5 пальцев по 4 точки, ладонь ~0.12 по ширине кадра. */
function hand(cx: number, cy: number, scale = 1): Landmark[] {
  const p: Landmark[] = [{ x: cx, y: cy, z: 0 }];
  const dirs = [[-0.6, -0.5], [-0.3, -1], [0, -1], [0.3, -1], [0.6, -0.7]];
  for (const [dx, dy] of dirs) for (let k = 1; k <= 4; k++) {
    const l = 0.03 * scale * (k <= 1 ? 4 : 2);
    const prev = k === 1 ? p[0] : p[p.length - 1];
    p.push({ x: prev.x + dx * l, y: prev.y + dy * l, z: 0 });
  }
  return p;
}
const jitter = (h: Landmark[], r: () => number, amp: number) => h.map((q) => ({ x: q.x + r() * amp, y: q.y + r() * amp, z: q.z + r() * amp }));
const err = (a: Landmark[], b: Landmark[]) => Math.max(...a.map((q, i) => Math.hypot(q.x - b[i].x, q.y - b[i].y)));

test('One Euro: в покое давит шум, при движении не отстаёт', () => {
  const f = new OneEuroFilter(DEFAULT_CONFIG); const r = rng(3);
  let out: number[] = [];
  for (let i = 0; i < 90; i++) out.push(f.filter(0.5 + r() * 0.01, i / FPS));
  const tail = out.slice(30);
  const spread = Math.max(...tail) - Math.min(...tail);
  assert.ok(spread < 0.006, `дрожь в покое ${spread}`);
  // линейное движение 0.6/с
  let lag = 0;
  for (let i = 90; i < 150; i++) { const x = 0.5 + (i - 90) * 0.02; lag = x - f.filter(x, i / FPS); }
  assert.ok(Math.abs(lag) < 0.03, `лаг на движении ${lag} (1.5 кадра)`);
});

test('кисть: одиночный выброс одной точки не проходит', () => {
  const s = new LandmarkStabilizer(21, DEFAULT_CONFIG, { bones: HAND_BONES, scaleBone: [0, 9] });
  const base = hand(0.5, 0.5); let t = 0;
  for (let i = 0; i < 40; i++, t += DT) s.update(base, t);
  const bad = base.map((q) => ({ ...q })); bad[8] = { x: bad[8].x + 0.3, y: bad[8].y - 0.3, z: 0 };
  const out = s.update(bad, t)!;
  assert.equal(out.rejected, 1);
  assert.ok(Math.hypot(out.points![8].x - base[8].x, out.points![8].y - base[8].y) < 0.02, 'кончик пальца остался на месте');
});

test('кисть: настоящий быстрый рывок принимается за jumpConfirmFrames кадров без лага', () => {
  const s = new LandmarkStabilizer(21, DEFAULT_CONFIG, { bones: HAND_BONES, scaleBone: [0, 9] });
  let t = 0;
  for (let i = 0; i < 40; i++, t += DT) s.update(hand(0.3, 0.6), t);
  const far = hand(0.7, 0.3);                     // прыжок на 0.5 кадра за один кадр
  const r1 = s.update(far, t); t += DT;
  assert.equal(r1.status, 'rejected');
  const r2 = s.update(far, t); t += DT;
  assert.equal(r2.status, 'tracked');
  assert.ok(err(r2.points!, far) < 1e-6, 'после подтверждения — ровно новое место, без лага');
});

test('кисть: потеря трекинга → экстраполяция по скорости, затем затухание, затем null', () => {
  const cfg = { ...DEFAULT_CONFIG, enableBoneConstraints: false };
  const s = new LandmarkStabilizer(21, cfg, { scaleBone: [0, 9] });
  let t = 0; const v = 0.01;                       // 0.3/с вправо
  for (let i = 0; i < 40; i++, t += DT) s.update(hand(0.2 + i * v, 0.5), t);
  const lastX = s.update(hand(0.2 + 40 * v, 0.5), t).points![0].x; t += DT;
  const e1 = s.update(null, t); t += DT;
  assert.equal(e1.status, 'extrapolated');
  assert.ok(e1.points![0].x > lastX + v * 0.5, 'продолжает движение по скорости');
  for (let i = 0; i < cfg.extrapolateFrames - 1; i++, t += DT) s.update(null, t);
  const f1 = s.update(null, t); t += DT;
  assert.equal(f1.status, 'fading'); assert.ok(f1.alpha < 1 && f1.alpha > 0);
  t += cfg.fadeMs + 50;
  assert.equal(s.update(null, t).status, 'none');
});

test('кисть: длина кости удерживается после калибровки', () => {
  const s = new LandmarkStabilizer(21, { ...DEFAULT_CONFIG, enableFilter: false, enableJumpReject: false }, { bones: HAND_BONES, scaleBone: [0, 9] });
  const base = hand(0.5, 0.5); let t = 0;
  for (let i = 0; i < DEFAULT_CONFIG.calibFrames + 2; i++, t += DT) s.update(base, t);
  const stretched = base.map((q) => ({ ...q }));
  stretched[12] = { x: base[11].x + (base[12].x - base[11].x) * 3, y: base[11].y + (base[12].y - base[11].y) * 3, z: 0 };
  const out = s.update(stretched, t).points!;
  const ref = Math.hypot(base[12].x - base[11].x, base[12].y - base[11].y);
  const got = Math.hypot(out[12].x - out[11].x, out[12].y - out[11].y);
  assert.ok(got <= ref * DEFAULT_CONFIG.boneClamp[1] + 1e-9, `кость ${got} vs ${ref}`);
});

test('Holistic-обёртка: обе кисти независимы, поза проходит, сырые сохраняются', () => {
  const h = new HolisticStabilizer(); const r = rng(7); let t = 0; let out;
  for (let i = 0; i < 20; i++, t += DT) {
    out = h.update({ leftHandLandmarks: jitter(hand(0.3, 0.5), r, 0.01), rightHandLandmarks: undefined,
                     poseLandmarks: Array.from({ length: 33 }, (_, k) => ({ x: 0.3 + k * 0.01, y: 0.4, z: 0, visibility: 0.9 })) }, t);
  }
  assert.equal(out!.left.status, 'tracked'); assert.equal(out!.right.status, 'none');
  assert.ok(out!.results.leftHandLandmarks && !out!.results.rightHandLandmarks);
  assert.equal(out!.results.poseLandmarks!.length, 33);
  assert.notEqual(out!.raw.leftHandLandmarks, out!.results.leftHandLandmarks, 'сырые не перезаписаны');
});

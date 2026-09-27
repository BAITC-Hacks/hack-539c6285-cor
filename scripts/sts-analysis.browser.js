/**
 * Разметка записей SpreadTheSign во встроенном браузере (dev-инструмент, не часть сайта).
 *
 * Как пользоваться: открыть во встроенном браузере страницу слова/предложения на spreadthesign.com (ru.ru), затем в
 * той же вкладке — mp4 (https://media.spreadthesign.com/video/mp4/12/<id>.mp4): страница того же домена, поэтому холст
 * читается. Вставить этот файл через javascript_tool (верхнеуровневый await работает). Видео на диск не качать;
 * headless Chrome их CDN режет 403 — не обходить.
 *
 *   await useVideo(12844)                       — загрузить запись, вернёт длительность и размер
 *   await frameCal([0.5, 1.5, 2.5])             — u, v, fw для /gesture-compare.html (где у носителя плечи в кадре)
 *   await frameSheet([1.6, 1.8], {cols, crop: [x, y, w, h], scale})  — кадры крупно поверх страницы (скриншот)
 *   await refTable2(k0, k1, crop, scale, step)  — по кадрам 25/с: запястья, локти, нос, кисти (углы в кадре, нормаль и
 *                                                 пясть 3D — глубина MediaPipe бывает перевёрнута, сверять глазами)
 *   await refRows(k0, k1, step)                 — ряды [t, x, y, пясть°, указательный°, большой°] для phraseRefs.mjs
 *   await handPts([t…])                         — 2D-точки кисти (какое ребро сверху, где большой)
 *   await overlayLm([t…], scale, crop)          — наложение разметки кисти на кадр
 *   await multiSheet([id…], cols)               — обзор нескольких записей по 6 кадров
 * Числа — в ширинах плеч от середины плеч носителя: x — к его ЛЕВОЙ руке, y — вверх.
 */
const V = '0.10.17';
const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + V + '/vision_bundle.mjs');
const files = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + V + '/wasm');
window.__pose = await vision.PoseLandmarker.createFromOptions(files, {
  baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task', delegate: 'CPU' },
  runningMode: 'IMAGE', numPoses: 1, minPoseDetectionConfidence: 0.3, minPosePresenceConfidence: 0.3,
});
window.__handV = await vision.HandLandmarker.createFromOptions(files, {
  baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task', delegate: 'CPU' },
  runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.2, minHandPresenceConfidence: 0.2, minTrackingConfidence: 0.3,
});

window.useVideo = async function (id) {
  const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = `https://media.spreadthesign.com/video/mp4/12/${id}.mp4`;
  await new Promise((r, j) => { v.addEventListener('loadeddata', r, { once: true }); v.addEventListener('error', () => j(new Error('video ' + id)), { once: true }); });
  window.__v = v; window.__ts = (window.__ts || 0) + 1e6;
  return { id, dur: v.duration, w: v.videoWidth, h: v.videoHeight };
};

const seekTo = (v, t) => new Promise((r) => { v.addEventListener('seeked', r, { once: true }); v.currentTime = t; });
const showCanvas = (c, clear = false) => {
  let ov = document.getElementById('__sheet');
  if (!ov) { ov = document.createElement('div'); ov.id = '__sheet'; ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#222'; document.documentElement.appendChild(ov); }
  if (clear) ov.innerHTML = '';
  ov.append(c); if (ov.children.length > 1) ov.firstElementChild.remove();
  const k = Math.min(innerWidth / c.width, innerHeight / c.height, 1); c.style.cssText = `display:block;width:${c.width * k}px;height:${c.height * k}px`;
};
/** Поза (весь кадр ×3) и кисти (участок crop ×scale, трекинг) для текущего кадра. */
const detect = (v, crop, scale, ts) => {
  const VW = v.videoWidth, VH = v.videoHeight; const [cx, cy, cw, ch] = crop;
  const full = document.createElement('canvas'); full.width = VW * 3; full.height = VH * 3; full.getContext('2d').drawImage(v, 0, 0, full.width, full.height);
  const P = window.__pose.detect(full).landmarks?.[0];
  const cc = document.createElement('canvas'); cc.width = cw * scale; cc.height = ch * scale; cc.getContext('2d').drawImage(v, cx, cy, cw, ch, 0, 0, cc.width, cc.height);
  const hr = window.__handV.detectForVideo(cc, ts);
  return { P, hr };
};
/** Кисти приписываются рукам по близости к запястьям позы. */
const assignHands = (hr, crop, Rw, Lw, SW) => {
  const [cx, cy, cw, ch] = crop;
  const hands = (hr.landmarks || []).map((L, i) => ({ lab: hr.handedness?.[i]?.[0]?.categoryName?.[0], sc: Math.round((hr.handedness?.[i]?.[0]?.score ?? 0) * 100), p: L.map((q) => [cx + q.x * cw, cy + q.y * ch]), w: hr.worldLandmarks?.[i] }));
  const cand = [];
  hands.forEach((h, i) => { cand.push({ i, s: 'R', d: Math.hypot(h.p[0][0] - Rw[0], h.p[0][1] - Rw[1]) / SW }); cand.push({ i, s: 'L', d: Math.hypot(h.p[0][0] - Lw[0], h.p[0][1] - Lw[1]) / SW }); });
  cand.sort((a, b) => a.d - b.d);
  const used = new Set(), taken = {};
  for (const c of cand) { if (used.has(c.i) || taken[c.s] || c.d > 0.45) continue; used.add(c.i); taken[c.s] = hands[c.i]; }
  return taken;
};

window.frameSheet = async function (times, { cols = 3, crop = null, scale = 1, label = true } = {}) {
  const v = window.__v; crop = crop || [0, 0, v.videoWidth, v.videoHeight];
  const [cx, cy, cw, ch] = crop; const W = Math.round(cw * scale), H = Math.round(ch * scale); const rows = Math.ceil(times.length / cols);
  const c = document.createElement('canvas'); c.width = cols * W + (cols - 1) * 4; c.height = rows * H + (rows - 1) * 4;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < times.length; i++) {
    await seekTo(v, times[i]);
    const x = (i % cols) * (W + 4), y = Math.floor(i / cols) * (H + 4);
    g.drawImage(v, cx, cy, cw, ch, x, y, W, H);
    if (label) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x, y, 62, 22); g.fillStyle = '#ff0'; g.font = 'bold 16px sans-serif'; g.fillText(times[i].toFixed(2), x + 4, y + 17); }
  }
  showCanvas(c);
  return { w: c.width, h: c.height };
};

window.frameCal = async function (times) {
  const v = window.__v; const VW = v.videoWidth, VH = v.videoHeight;
  const us = [], vs = [], fws = [];
  for (const t of times) {
    await seekTo(v, t);
    const full = document.createElement('canvas'); full.width = VW * 3; full.height = VH * 3; full.getContext('2d').drawImage(v, 0, 0, full.width, full.height);
    const P = window.__pose.detect(full).landmarks?.[0]; if (!P) continue;
    us.push((P[11].x + P[12].x) / 2); vs.push((P[11].y + P[12].y) / 2); fws.push(Math.hypot((P[11].x - P[12].x) * VW, (P[11].y - P[12].y) * VH) / VW);
  }
  const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
  return `u=${med(us).toFixed(3)}&v=${med(vs).toFixed(3)}&fw=${med(fws).toFixed(3)}`;
};

window.refTable2 = async function (k0, k1, crop = null, scale = 3, step = 1) {
  const v = window.__v; const VW = v.videoWidth, VH = v.videoHeight; crop = crop || [20, 0, VW - 40, VH];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => +(x / l).toFixed(2)); };
  const angv = (a, b) => Math.round(Math.acos(Math.max(-1, Math.min(1, nrm(a).reduce((s, x, i) => s + x * nrm(b)[i], 0)))) * 180 / Math.PI);
  const rows = [];
  window.__ts += 100000;
  for (let k = k0; k <= k1; k += step) {
    const t = (k + 0.5) / 25;
    await seekTo(v, t);
    const { P, hr } = detect(v, crop, scale, window.__ts + k * 40);
    if (!P) { rows.push(t.toFixed(2) + ' нет позы'); continue; }
    const px = (q) => [q.x * VW, q.y * VH];
    const Ls = px(P[11]), Rs = px(P[12]), Lw = px(P[15]), Rw = px(P[16]);
    const mid = [(Ls[0] + Rs[0]) / 2, (Ls[1] + Rs[1]) / 2], SW = Math.hypot(Ls[0] - Rs[0], Ls[1] - Rs[1]);
    const U = (q) => [((q[0] - mid[0]) / SW).toFixed(2), (-(q[1] - mid[1]) / SW).toFixed(2)].join(',');
    const taken = assignHands(hr, crop, Rw, Lw, SW);
    const row = [t.toFixed(2), `wr ${U(Rw)}|${U(Lw)}`, `el ${U(px(P[14]))}|${U(px(P[13]))}`, `нос ${U(px(P[0]))}`];
    for (const s of ['R', 'L']) {
      const h = taken[s]; if (!h) { row.push(s + ':-'); continue; }
      const ang = (a, b) => Math.round(Math.atan2(-(h.p[b][1] - h.p[a][1]), h.p[b][0] - h.p[a][0]) * 180 / Math.PI);
      const len = (a, b) => (Math.hypot(h.p[b][0] - h.p[a][0], h.p[b][1] - h.p[a][1]) / SW).toFixed(2);
      let d3 = '';
      if (h.w) {
        const flip = h.lab !== s;
        const W = h.w.map((q) => [q.x, -q.y, flip ? q.z : -q.z]);
        const f = sub(W[9], W[0]), tv = sub(W[5], W[17]);
        const n = s === 'R' ? cross(tv, f) : cross(f, tv);
        d3 = ` n${nrm(n)} f${nrm(f)} b${angv(f, sub(W[8], W[5]))}/${angv(f, sub(W[12], W[9]))}/${angv(f, sub(W[16], W[13]))}/${angv(f, sub(W[20], W[17]))}`;
      }
      row.push(`${s}${h.lab}${h.sc} w(${U(h.p[0])}) i8(${U(h.p[8])}) m12(${U(h.p[12])}) t4(${U(h.p[4])}) meta∠${ang(0, 9)} L${len(0, 9)} idx∠${ang(5, 8)} L${len(5, 8)} thb∠${ang(2, 4)}${d3}`);
    }
    rows.push(row.join(' || '));
  }
  return rows.join('\n');
};

window.refRows = async function (k0, k1, step = 1, crop = null, scale = 3) {
  const v = window.__v; const VW = v.videoWidth, VH = v.videoHeight; crop = crop || [20, 0, VW - 40, VH];
  const R = [], L = [];
  window.__ts += 100000;
  for (let k = k0; k <= k1; k += step) {
    const t = (k + 0.5) / 25;
    await seekTo(v, t);
    const { P, hr } = detect(v, crop, scale, window.__ts + k * 40);
    if (!P) continue;
    const px = (q) => [q.x * VW, q.y * VH];
    const Ls = px(P[11]), Rs = px(P[12]), Lw = px(P[15]), Rw = px(P[16]);
    const mid = [(Ls[0] + Rs[0]) / 2, (Ls[1] + Rs[1]) / 2], SW = Math.hypot(Ls[0] - Rs[0], Ls[1] - Rs[1]);
    const taken = assignHands(hr, crop, Rw, Lw, SW);
    for (const s of ['R', 'L']) {
      const h = taken[s]; if (!h) continue;
      const ang = (a, b) => Math.round(Math.atan2(-(h.p[b][1] - h.p[a][1]), h.p[b][0] - h.p[a][0]) * 180 / Math.PI);
      const x = (h.p[0][0] - mid[0]) / SW, y = -(h.p[0][1] - mid[1]) / SW;
      (s === 'R' ? R : L).push(`[${t.toFixed(2)}, ${x.toFixed(2)}, ${y.toFixed(2)}, ${ang(0, 9)}, ${ang(5, 8)}, ${ang(2, 4)}]`);
    }
  }
  const fmt = (a) => a.reduce((acc, r, i) => acc + (i % 3 === 0 ? '\n      ' : ' ') + r + ',', '');
  return `right: [${fmt(R)}\n    ],\n    left: [${fmt(L)}\n    ],`;
};

window.handPts = async function (times, crop = null, scale = 3) {
  const v = window.__v; const VW = v.videoWidth, VH = v.videoHeight; crop = crop || [20, 0, VW - 40, VH];
  const out = []; window.__ts += 100000; let k = 0;
  for (const t of times) {
    await seekTo(v, t);
    const { P, hr } = detect(v, crop, scale, window.__ts + (k++) * 40);
    const px = (q) => [q.x * VW, q.y * VH];
    const Ls = px(P[11]), Rs = px(P[12]), Lw = px(P[15]), Rw = px(P[16]);
    const mid = [(Ls[0] + Rs[0]) / 2, (Ls[1] + Rs[1]) / 2], SW = Math.hypot(Ls[0] - Rs[0], Ls[1] - Rs[1]);
    const U = (q) => [+((q[0] - mid[0]) / SW).toFixed(2), +(-(q[1] - mid[1]) / SW).toFixed(2)];
    const h = assignHands(hr, crop, Rw, Lw, SW).R;
    if (!h) { out.push(t + ' нет кисти'); continue; }
    const L2 = h.p.map(U);
    out.push(`${t} ${h.lab} нос(${U(px(P[0]))}) | ` + [0, 1, 2, 3, 4, 5, 8, 9, 12, 13, 16, 17, 20].map((i) => i + ':' + L2[i].join(',')).join(' '));
  }
  return out.join('\n');
};

window.overlayLm = async function (times, scale = 2.4, crop = null) {
  const v = window.__v; const VW = v.videoWidth, VH = v.videoHeight; const handCrop = [20, 0, VW - 40, VH];
  const [zx, zy, zw, zh] = crop || [0, 0, VW, VH];
  const W = zw * scale / 2 * (VW / zw), H = zh * scale / 2 * (VW / zw);
  const out = document.createElement('canvas'); out.width = times.length * W + (times.length - 1) * 4; out.height = H;
  const g = out.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, out.width, out.height);
  window.__ts += 100000; let k = 0;
  for (let i = 0; i < times.length; i++) {
    await seekTo(v, times[i]);
    const { P, hr } = detect(v, handCrop, 3, window.__ts + (k++) * 40);
    const x0 = i * (W + 4);
    g.drawImage(v, zx, zy, zw, zh, x0, 0, W, H);
    const map = (x, y) => [x0 + (x - zx) / zw * W, (y - zy) / zh * H];
    const dot = (x, y, col, r = 3) => { const [a, b] = map(x, y); g.fillStyle = col; g.beginPath(); g.arc(a, b, r, 0, 7); g.fill(); };
    const line = (p, q, col) => { const [a, b] = map(...p), [c, d] = map(...q); g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); };
    if (P) for (const j of [15, 16, 13, 14, 11, 12]) dot(P[j].x * VW, P[j].y * VH, j === 16 ? '#f00' : j === 15 ? '#00f' : '#ff0', 4);
    const CH = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [0, 17, 18, 19, 20], [5, 9, 13, 17]];
    const [cx, cy, cw, ch] = handCrop;
    (hr.landmarks || []).forEach((L, hi) => { const p = L.map((q) => [cx + q.x * cw, cy + q.y * ch]); const col = hi ? '#0ff' : '#f0f'; for (const c of CH) for (let j = 0; j + 1 < c.length; j++) line(p[c[j]], p[c[j + 1]], col); dot(...p[4], '#ff0', 2.5); dot(...p[8], '#0f0', 2.5); });
    g.fillStyle = '#ff0'; g.font = 'bold 14px sans-serif'; g.fillText(times[i].toFixed(2), x0 + 4, 16);
  }
  showCanvas(out, true);
  return { w: out.width, h: out.height };
};

window.multiSheet = async function (ids, cols = 6, t0 = 0.2, t1 = 0.8) {
  const W = 128, H = 96;
  const c = document.createElement('canvas'); c.width = cols * (W + 4); c.height = ids.length * (H + 4);
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  const meta = [];
  for (let r = 0; r < ids.length; r++) {
    const info = await window.useVideo(ids[r]); meta.push(info);
    for (let i = 0; i < cols; i++) {
      const t = info.dur * (t0 + (t1 - t0) * i / (cols - 1));
      await seekTo(window.__v, t);
      g.drawImage(window.__v, i * (W + 4), r * (H + 4), W, H);
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(i * (W + 4), r * (H + 4), 70, 14); g.fillStyle = '#ff0'; g.font = 'bold 11px sans-serif'; g.fillText(`${ids[r]} ${t.toFixed(2)}`, i * (W + 4) + 2, r * (H + 4) + 11);
    }
  }
  showCanvas(c, true);
  return meta.map((m) => `${m.id}: ${m.dur.toFixed(2)} с ${m.w}x${m.h}`).join(', ');
};

'sts-analysis: готово';

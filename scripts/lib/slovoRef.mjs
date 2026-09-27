/**
 * Эталон жеста из записей SLOVO: где кисть, куда смотрит ладонь, как движется.
 *
 * Читает ml/landmarks_holistic (255 чисел на кадр: поза 33×3, лицо 10×3,
 * левая кисть 21×3, правая 21×3; координаты MediaPipe в долях кадра) и
 * ml/annotations.csv (размер видео — нужен, чтобы x и y были в одних единицах).
 *
 * Все клипы приводятся к правше: если поднята левая рука (зеркальное видео
 * или левша), кадр отражается по X. Расстояния — в ширинах плеч от середины
 * плеч, x — к середине тела положительный, y — вверх.
 */
import fs from 'node:fs';
import path from 'node:path';

function loadNpy(file) {
  const buf = fs.readFileSync(file);
  const headLen = buf.readUInt16LE(8);
  const header = buf.subarray(10, 10 + headLen).toString('latin1');
  const shape = header.match(/'shape':\s*\(([^)]*)\)/)[1].split(',').map((s) => s.trim()).filter(Boolean).map(Number);
  const start = 10 + headLen;
  const data = new Float32Array(buf.buffer.slice(buf.byteOffset + start, buf.byteOffset + start + shape[0] * shape[1] * 4));
  return { data, shape };
}

export const median = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
export const pct = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const deg = (r) => (r * 180) / Math.PI;

/**
 * Число размахов покачивания: смена направления засчитывается, только когда
 * величина отошла от последнего экстремума на minSwing — дрожь трекинга и
 * мелкие довороты не считаются. Одинаково для людей и аватара.
 */
export function countSwings(series, minSwing = 4) {
  // Индексы экстремумов (пик/впадина подтверждены откатом ≥ minSwing).
  // Частота = (экстремумов − 1) / 2 / время между крайними.
  const extremes = [];
  let dir = 0, ext = NaN, extAt = -1, hi = -Infinity, lo = Infinity;
  series.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    if (dir === 0) {
      // направление ещё не ясно: ждём первого хода на minSwing в любую сторону
      hi = Math.max(hi, v);
      lo = Math.min(lo, v);
      if (v - lo >= minSwing) { dir = 1; ext = v; extAt = i; }
      else if (hi - v >= minSwing) { dir = -1; ext = v; extAt = i; }
    } else if (dir > 0) {
      if (v > ext) { ext = v; extAt = i; }
      else if (ext - v >= minSwing) { extremes.push(extAt); dir = -1; ext = v; extAt = i; }
    } else {
      if (v < ext) { ext = v; extAt = i; }
      else if (v - ext >= minSwing) { extremes.push(extAt); dir = 1; ext = v; extAt = i; }
    }
  });
  return extremes;
}

/** Частота покачивания (Гц) по экстремумам; dt — шаг ряда в секундах. */
export function swingHz(series, dt, minSwing = 4) {
  const ex = countSwings(series, minSwing);
  if (ex.length < 3) return { hz: NaN, extremes: ex.length };
  return { hz: (ex.length - 1) / 2 / ((ex[ex.length - 1] - ex[0]) * dt), extremes: ex.length };
}

/** Угол (°) между 2D-векторами. */
const ang2 = (a, b) => deg(Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))))));

/**
 * Замеры одного клипа. Возвращает null, если в клипе мало кадров с кистью.
 * Фаза удержания — кадры, где запястье не ниже 0.35 ширины плеч от своего максимума.
 */
function measureClip(data, n, W, H) {
  const P = (f, i) => [data[f * 255 + i * 3] * W, data[f * 255 + i * 3 + 1] * H];
  const hand = (f, off, i) => [data[f * 255 + off + i * 3] * W, data[f * 255 + off + i * 3 + 1] * H];
  const alive = (f, off) => { for (let i = 0; i < 63; i++) if (data[f * 255 + off + i] !== 0) return true; return false; };
  const frames = [];
  for (let f = 0; f < n; f++) { let s = 0; for (let i = 0; i < 99; i++) s += Math.abs(data[f * 255 + i]); if (s > 0) frames.push(f); }
  if (frames.length < 8) return null;
  const Ls = [median(frames.map((f) => P(f, 11)[0])), median(frames.map((f) => P(f, 11)[1]))];
  const Rs = [median(frames.map((f) => P(f, 12)[0])), median(frames.map((f) => P(f, 12)[1]))];
  const mid = [(Ls[0] + Rs[0]) / 2, (Ls[1] + Rs[1]) / 2];
  const sw = Math.hypot(Ls[0] - Rs[0], Ls[1] - Rs[1]);
  const upR = Math.max(...frames.map((f) => mid[1] - P(f, 16)[1]));
  const upL = Math.max(...frames.map((f) => mid[1] - P(f, 15)[1]));
  const right = upR >= upL;
  // x к середине тела: у правой руки (слева в кадре) это +x кадра
  const sx = right ? 1 : -1;
  const T = ([x, y]) => [sx * (x - mid[0]) / sw, -(y - mid[1]) / sw];
  const wristIdx = right ? 16 : 15, off = right ? 192 : 129;
  const wy = frames.map((f) => T(P(f, wristIdx))[1]);
  const top = Math.max(...wy);
  const hold = frames.filter((f, k) => wy[k] > top - 0.35 && alive(f, off));
  if (hold.length < 5) return null;
  const tips = hold.map((f) => T(hand(f, off, 12)));
  const wr = hold.map((f) => T(P(f, wristIdx)));
  const nose = [median(frames.map((f) => T(P(f, 0))[0])), median(frames.map((f) => T(P(f, 0))[1]))];
  // наклон пальцев от вертикали, + к середине тела
  const tilt = hold.map((f) => { const a = T(hand(f, off, 0)), b = T(hand(f, off, 12)); return deg(Math.atan2(b[0] - a[0], b[1] - a[1])); });
  // ладонь к собеседнику: у правой руки ладонью вперёд указательный ближе к середине тела, чем мизинец
  const palmFwd = hold.map((f) => T(hand(f, off, 5))[0] - T(hand(f, off, 17))[0]);
  const v = (f, a, b) => { const p = hand(f, off, a), q = hand(f, off, b); return [q[0] - p[0], q[1] - p[1]]; };
  const thumb = hold.map((f) => ang2(v(f, 2, 4), v(f, 5, 8)));
  const fan = hold.map((f) => ang2(v(f, 5, 8), v(f, 17, 20)));
  // Частота покачивания — по экстремумам наклона на всей записи (вне удержания NaN).
  // Короткие клипы дополнены нулями, длинные сжаты до 60 кадров: шаг = длина / кадров.
  const holdSet = new Set(hold);
  const series = frames.map((f) => {
    if (!holdSet.has(f)) return NaN;
    const a = T(hand(f, off, 0)), b = T(hand(f, off, 12));
    return deg(Math.atan2(b[0] - a[0], b[1] - a[1]));
  });
  return {
    wristX: median(wr.map((p) => p[0])), wristY: median(wr.map((p) => p[1])),
    tipY: median(tips.map((p) => p[1])), tipMinusNose: median(tips.map((p) => p[1])) - nose[1],
    tilt: median(tilt), tiltAmp: (pct(tilt, 0.9) - pct(tilt, 0.1)) / 2,
    wristSway: (pct(wr.map((p) => p[0]), 0.9) - pct(wr.map((p) => p[0]), 0.1)) / 2,
    palmForward: median(palmFwd) > 0,
    thumbIndex: median(thumb), indexPinky: median(fan),
    tiltSeries: series, holdFrames: hold.length, frames: frames.length,
  };
}

/** Замеры всех клипов со знаком `text` (например «Привет!»). */
export function slovoReference(mlDir, text) {
  const idx = JSON.parse(fs.readFileSync(path.join(mlDir, 'landmarks_holistic/file_index.json'), 'utf8'));
  const dims = new Map();
  const rows = fs.readFileSync(path.join(mlDir, 'annotations.csv'), 'utf8').split('\n');
  const head = rows[0].split('\t');
  const iId = head.indexOf('attachment_id'), iW = head.indexOf('width'), iH = head.indexOf('height'), iL = head.indexOf('length');
  for (const r of rows.slice(1)) { const c = r.split('\t'); if (c.length > 3) dims.set(c[iId], [+c[iW], +c[iH], +c[iL]]); }
  const clips = [];
  for (const [id, meta] of Object.entries(idx)) {
    if (meta.text !== text) continue;
    const file = path.join(mlDir, 'landmarks_holistic', meta.split, `${id}.npy`);
    if (!fs.existsSync(file) || !dims.has(id)) continue;
    const [W, H, L] = dims.get(id);
    const { data, shape } = loadNpy(file);
    const m = measureClip(data, shape[0], W, H);
    if (!m) continue;
    const dt = L / 30 / m.frames; // реальная длительность клипа — length кадров при 30 к/с
    const { hz, extremes } = swingHz(m.tiltSeries, dt);
    clips.push({ id, user: meta.user, seconds: L / 30, hz, extremes, ...m });
  }
  return clips;
}

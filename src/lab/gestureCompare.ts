/**
 * Сверка жеста с записью носителя (только dev): /gesture-compare.html
 *
 * Слева — видео фразы из словаря SpreadTheSign (RU), справа — Елнар в тот же
 * момент знака, снятый камерой «как в записи»: спереди, плечи на том же месте
 * кадра, что у носителя. Так расхождения видны кадр в кадр, без пересказа.
 * Видео не скачивается и не копируется: элемент <video> смотрит его с сайта
 * словаря, как обычная страница.
 *
 * Параметры адреса:
 *   g=kak-pomoch            жест из /public/gestures
 *   vid=105605              номер видео словаря (media.spreadthesign.com/video/mp4/12/<vid>.mp4)
 *   off=1.14                время жеста = время записи − off
 *   map=1.14:0,1.36:0.32    или кусочно-линейное соответствие «запись:жест»
 *   times=1.3,1.5,1.7       «плёнка»: пары кадров в эти моменты записи (без — плеер)
 *   cols=3  pw=420          колонок и ширина одной половинки пары, px
 *   crop=0.2,0.3,0.6,0.6    увеличить участок кадра (доли: x, y, ширина, высота)
 *   u=0.53 v=0.498 fw=0.357 где у носителя середина плеч (доли кадра) и ширина плеч (доля ширины)
 *
 * Фраза из нескольких видео (знаки из видео слов): seq — отрезки времени ЖЕСТА
 * и их источники, atimes — моменты жеста для «плёнки»:
 *   seq=12788:1.40:0.20-0.45:0.514:0.515:0.275,26565:2.34:0.50-0.80
 *       номер видео : t0 (время видео = время жеста + t0) : отрезок жеста a0-a1 [: u : v : fw]
 *   atimes=0.30,0.68            пары «кадр своего видео | Елнар» в эти моменты жеста
 */
import * as THREE from 'three';
import { loadAvatar, AVATARS, type AvatarId } from '@/lib/avatarLoader';
import { GesturePlayer, fetchGesture, type GestureJSON } from '@/lib/gesturePlayer';

const params = new URLSearchParams(location.search);
const gestureName = params.get('g') ?? 'kak-pomoch';
const avatarId = (params.get('avatar') ?? 'elnar') as AvatarId;
const vid = params.get('vid') ?? '105605';
const SRC = `https://media.spreadthesign.com/video/mp4/12/${vid}.mp4`;
const off = parseFloat(params.get('off') ?? '0');
const mapPts = params.get('map')?.split(',').map((p) => p.split(':').map(Number) as [number, number]) ?? null;
const times = params.get('times')?.split(',').map(Number).filter(Number.isFinite) ?? null;
const cols = parseInt(params.get('cols') ?? '3', 10);
const pw = parseInt(params.get('pw') ?? '420', 10);
const crop = (params.get('crop')?.split(',').map(Number) ?? [0, 0, 1, 1]) as [number, number, number, number];
let U = parseFloat(params.get('u') ?? '0.53');
let Vv = parseFloat(params.get('v') ?? '0.498');
let FW = parseFloat(params.get('fw') ?? '0.357');
interface Seg { vid: string; t0: number; a0: number; a1: number; u?: number; v?: number; fw?: number }
const seq: Seg[] | null = params.get('seq')?.split(',').map((x) => {
  const [vid, t0, range, u, v, fw] = x.split(':');
  const [a0, a1] = range.split('-').map(Number);
  return { vid, t0: +t0, a0, a1, u: u ? +u : undefined, v: v ? +v : undefined, fw: fw ? +fw : undefined };
}) ?? null;
const atimes = params.get('atimes')?.split(',').map(Number).filter(Number.isFinite) ?? null;

/** Время записи → время жеста. */
function toAvatar(tr: number): number {
  if (!mapPts) return tr - off;
  if (tr <= mapPts[0][0]) return mapPts[0][1];
  for (let i = 0; i < mapPts.length - 1; i++) {
    const [r0, a0] = mapPts[i], [r1, a1] = mapPts[i + 1];
    if (tr <= r1) return a0 + ((tr - r0) / (r1 - r0)) * (a1 - a0);
  }
  return mapPts[mapPts.length - 1][1];
}

// ——— сцена аватара (рисуем вне страницы и копируем в холсты пар) ———
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8a5a3c);
scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.0));
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(2, 4, 3);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.5);
fill.position.set(-3, 2, 2);
scene.add(fill);

let player: GesturePlayer;
let gesture: GestureJSON;
let bones: Map<string, THREE.Bone>;
let cam: THREE.PerspectiveCamera;
let aspect = 4 / 3;

function poseAt(time: number) {
  const p = player as unknown as {
    gesture: GestureJSON; playing: boolean; returning: boolean; loop: boolean;
    blendStart: number; startWallClock: number; speed: number;
  };
  const dur = gesture.frames[gesture.frames.length - 1].t;
  p.gesture = gesture;
  p.playing = true;
  p.returning = false;
  p.loop = false;
  p.speed = 1;
  p.blendStart = -Infinity;
  p.startWallClock = performance.now() / 1000 - Math.min(Math.max(time, 0), dur);
  player.update();
}

/** Камера «как в записи»: плечи аватара там же в кадре, где плечи носителя. */
function makeCamera() {
  const wp = (n: string) => bones.get(n)!.getWorldPosition(new THREE.Vector3());
  const sr = wp('i'), sl = wp('13');
  const mid = sr.clone().add(sl).multiplyScalar(0.5);
  const D = 2.0;
  const frameW = sr.distanceTo(sl) / FW;
  const frameH = frameW / aspect;
  const c = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(2 * Math.atan(frameH / 2 / D)), aspect, 0.01, 50);
  const cx = mid.x - (U - 0.5) * frameW;
  const cy = mid.y - (0.5 - Vv) * frameH;
  c.position.set(cx, cy, mid.z + D);
  c.lookAt(cx, cy, mid.z);
  return c;
}

/** Нарисовать аватар в момент жеста в холст пары (с тем же увеличением участка). */
function drawAvatar(canvas: HTMLCanvasElement, tAvatar: number) {
  const [cx, cy, cw, ch] = crop;
  const RW = Math.round(canvas.width / cw), RH = Math.round(canvas.height / ch);
  renderer.setSize(RW, RH, false);
  poseAt(tAvatar);
  renderer.render(scene, cam);
  const g = canvas.getContext('2d')!;
  g.drawImage(renderer.domElement, cx * RW, cy * RH, cw * RW, ch * RH, 0, 0, canvas.width, canvas.height);
}

/**
 * Пара «запись | аватар». Слева — холст, в который кладётся кадр записи: в
 * «плёнке» один декодер на всю плёнку (браузер гасит лишние видео, и кадры
 * чернеют), в плеере — кадр из играющего видео на каждом шаге.
 */
function makePair(host: HTMLElement) {
  const pair = document.createElement('div');
  pair.className = 'pair';
  const left = document.createElement('div');
  left.className = 'cell';
  const right = document.createElement('div');
  right.className = 'cell';
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = SRC;
  const still2d = document.createElement('canvas');
  left.appendChild(still2d);
  const canvas = document.createElement('canvas');
  right.appendChild(canvas);
  const tagL = document.createElement('div');
  tagL.className = 'tag';
  left.appendChild(tagL);
  const tagR = document.createElement('div');
  tagR.className = 'tag';
  right.appendChild(tagR);
  const whoL = document.createElement('div');
  whoL.className = 'who';
  whoL.textContent = `SpreadTheSign ${vid}`;
  left.appendChild(whoL);
  const whoR = document.createElement('div');
  whoR.className = 'who';
  whoR.textContent = `Елнар · ${gestureName}`;
  right.appendChild(whoR);
  pair.append(left, right);
  host.appendChild(pair);
  const layout = () => {
    const w = left.clientWidth, h = left.clientHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    still2d.width = canvas.width;
    still2d.height = canvas.height;
  };
  /** Кадр записи (видео уже на нужном месте) — в холст слева, с тем же увеличением. */
  const drawStill = (src: HTMLVideoElement) => {
    const [cx, cy, cw, ch] = crop;
    const W = src.videoWidth, H = src.videoHeight;
    still2d.getContext('2d')!.drawImage(src, cx * W, cy * H, cw * W, ch * H, 0, 0, still2d.width, still2d.height);
  };
  return { video, canvas, tagL, tagR, whoL, layout, drawStill };
}

/** Подпись кадра аватара: до начала и после конца жеста он стоит в покое. */
function avatarLabel(ta: number) {
  const dur = gesture.frames[gesture.frames.length - 1].t;
  if (ta < 0) return 'жест ещё не начался — покой';
  if (ta > dur) return 'жест закончился — покой';
  return `жест ${ta.toFixed(2)} с`;
}

async function seek(video: HTMLVideoElement, t: number) {
  if (video.readyState < 1) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
  await new Promise((r) => { video.addEventListener('seeked', r, { once: true }); video.currentTime = t; });
}

(async () => {
  const avatar = await loadAvatar(AVATARS[avatarId]?.url ?? AVATARS.elnar.url);
  scene.add(avatar.root);
  bones = avatar.bones;
  player = new GesturePlayer(bones);
  gesture = await fetchGesture(gestureName);

  // Пропорции кадра — как у видео
  const probe = document.createElement('video');
  probe.muted = true;
  probe.preload = 'auto';
  probe.src = SRC;
  await new Promise((r) => probe.addEventListener('loadedmetadata', r, { once: true }));
  aspect = probe.videoWidth / probe.videoHeight;
  const [, , cw, ch] = crop;
  document.documentElement.style.setProperty('--ar', `${(aspect * cw) / ch}`);
  player.resetToIdle();
  avatar.root.updateMatrixWorld(true);
  cam = makeCamera();

  const grid = document.getElementById('grid')!;
  document.title = `сверка: ${gestureName} ↔ ${vid}`;

  if (seq && atimes) {
    // Фраза из нескольких видео: у каждого момента жеста — кадр своего источника
    document.getElementById('bar')!.style.display = 'none';
    grid.style.gridTemplateColumns = `repeat(${cols}, ${pw * 2 + 2}px)`;
    const base = { U, Vv, FW };
    const videos = new Map<string, HTMLVideoElement>();
    for (const ta of atimes) {
      const sg = seq.find((g) => ta >= g.a0 - 1e-6 && ta <= g.a1 + 1e-6);
      const pr = makePair(grid);
      pr.layout();
      if (sg) {
        let v = videos.get(sg.vid);
        if (!v) {
          v = document.createElement('video');
          v.muted = true;
          v.preload = 'auto';
          v.src = `https://media.spreadthesign.com/video/mp4/12/${sg.vid}.mp4`;
          videos.set(sg.vid, v);
        }
        await seek(v, ta + sg.t0);
        pr.drawStill(v);
        pr.tagL.textContent = `запись ${(ta + sg.t0).toFixed(2)} с`;
        pr.whoL.textContent = `SpreadTheSign ${sg.vid}`;
        U = sg.u ?? base.U; Vv = sg.v ?? base.Vv; FW = sg.fw ?? base.FW;
      } else {
        pr.tagL.textContent = 'переход между знаками';
        pr.whoL.textContent = '';
        U = base.U; Vv = base.Vv; FW = base.FW;
      }
      cam = makeCamera();
      drawAvatar(pr.canvas, ta);
      pr.tagR.textContent = avatarLabel(ta);
    }
    (window as unknown as { compareReady: boolean }).compareReady = true;
    return;
  }

  if (times) {
    // «Плёнка»: пары в заданные моменты записи
    document.getElementById('bar')!.style.display = 'none';
    grid.style.gridTemplateColumns = `repeat(${cols}, ${pw * 2 + 2}px)`;
    const pairs = times.map(() => makePair(grid));
    for (let i = 0; i < times.length; i++) {
      const pr = pairs[i];
      pr.layout();
      await seek(probe, times[i]);
      pr.drawStill(probe);
      const ta = toAvatar(times[i]);
      drawAvatar(pr.canvas, ta);
      pr.tagL.textContent = `запись ${times[i].toFixed(2)} с`;
      pr.tagR.textContent = avatarLabel(ta);
    }
    (window as unknown as { compareReady: boolean }).compareReady = true;
    return;
  }

  // Плеер: одна пара, ползунок по времени записи, воспроизведение с замедлением.
  // Кадр видео каждый раз кладётся в холст: живой <video> снимки экрана и
  // скрытая панель браузера часто показывают чёрным.
  grid.style.gridTemplateColumns = `${pw * 2 + 2}px`;
  const pr = makePair(grid);
  pr.layout();
  const slider = document.getElementById('time') as HTMLInputElement;
  const tlabel = document.getElementById('tlabel')!;
  const playBtn = document.getElementById('play')!;
  const speedSel = document.getElementById('speed') as HTMLSelectElement;
  await seek(pr.video, 0);
  slider.max = String(pr.video.duration);
  slider.oninput = () => { pr.video.pause(); pr.video.currentTime = parseFloat(slider.value); };
  playBtn.onclick = () => {
    if (pr.video.paused) { pr.video.playbackRate = parseFloat(speedSel.value); void pr.video.play(); } else pr.video.pause();
  };
  speedSel.onchange = () => { pr.video.playbackRate = parseFloat(speedSel.value); };
  let drawnAt = -1;
  const tick = () => {
    const tr = pr.video.currentTime;
    const ta = toAvatar(tr);
    // На паузе кадр не меняется — не гоняем WebGL впустую (ноутбук слабый по питанию)
    if (tr === drawnAt && pr.video.paused) { requestAnimationFrame(tick); return; }
    drawnAt = tr;
    pr.drawStill(pr.video);
    drawAvatar(pr.canvas, ta);
    pr.tagL.textContent = `запись ${tr.toFixed(2)} с`;
    pr.tagR.textContent = avatarLabel(ta);
    if (!pr.video.paused) slider.value = String(tr);
    playBtn.textContent = pr.video.paused ? '▶' : '❚❚';
    tlabel.textContent = `${tr.toFixed(2)} / ${pr.video.duration.toFixed(2)} с`;
    requestAnimationFrame(tick);
  };
  tick();
})();

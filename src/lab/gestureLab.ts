/**
 * Лаборатория жестов (только dev): /gesture-lab.html
 *
 * Показывает жест сразу с четырёх сторон — спереди, сбоку, в три четверти и
 * кисть крупно, — чтобы форму кисти, ориентацию ладони и место исполнения было
 * видно на одном снимке. Играет тем же GesturePlayer и тем же загрузчиком, что
 * переводчик, поэтому здесь видно ровно то, что увидит пользователь.
 *
 * Параметры адреса:
 *   avatar=elnar|adam|eva   (по умолчанию elnar)
 *   g=privet                файл из /public/gestures без .json
 *   t=0.8                   заморозить на этом времени (иначе — повтор)
 *   speed=0.5
 *   strip=0.2,0.5,0.7       «плёнка»: эти моменты в ряд, спереди и сбоку
 *   view=cam                один вид «как с веб-камеры» (по пояс, 4:3) — для
 *                           подачи жеста аватара в распознаватель как видео
 *
 * Для проверок из консоли: window.lab.poseAt(t), window.lab.bones.
 */
import * as THREE from 'three';
import { loadAvatar, AVATARS, type AvatarId } from '@/lib/avatarLoader';
import { GesturePlayer, fetchGesture, type GestureJSON } from '@/lib/gesturePlayer';

const params = new URLSearchParams(location.search);
const avatarId = (params.get('avatar') ?? 'elnar') as AvatarId;
const gestureName = params.get('g') ?? 'privet';
const frozen = params.get('t');

const host = document.getElementById('view')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setScissorTest(true);
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a4247);
scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.0));
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(2, 4, 3);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.5);
fill.position.set(-3, 2, 2);
scene.add(fill);

// Пол-сетка для ориентира глубины на боковом виде
const grid = new THREE.GridHelper(2, 20, 0x667075, 0x4a5358);
scene.add(grid);

interface View { name: string; cam: THREE.PerspectiveCamera; place: (w: number, h: number) => [number, number, number, number]; }
const views: View[] = [];
function addView(name: string, place: View['place']) {
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  views.push({ name, cam, place });
  const lbl = document.createElement('div');
  lbl.className = 'lbl';
  lbl.textContent = name;
  lbl.dataset.view = name;
  document.body.appendChild(lbl);
}
// Сетка 2×2
addView('спереди', (w, h) => [0, h / 2, w / 2, h / 2]);
addView('сбоку (справа от аватара)', (w, h) => [w / 2, h / 2, w / 2, h / 2]);
addView('три четверти', (w, h) => [0, 0, w / 2, h / 2]);
addView('кисть крупно', (w, h) => [w / 2, 0, w / 2, h / 2]);

let player: GesturePlayer | null = null;
let bones: Map<string, THREE.Bone> | null = null;
let gesture: GestureJSON | null = null;
let playing = frozen === null;
let t = frozen ? parseFloat(frozen) : 0;
let speed = parseFloat(params.get('speed') ?? '1');
let lastNow = performance.now() / 1000;

const slider = document.getElementById('time') as HTMLInputElement;
const tlabel = document.getElementById('tlabel')!;
const playBtn = document.getElementById('play')!;
const speedSel = document.getElementById('speed') as HTMLSelectElement;
speedSel.value = String(speed);
speedSel.onchange = () => { speed = parseFloat(speedSel.value); };
playBtn.textContent = playing ? '❚❚' : '▶';
playBtn.onclick = () => { playing = !playing; playBtn.textContent = playing ? '❚❚' : '▶'; };
slider.oninput = () => { playing = false; playBtn.textContent = '▶'; t = parseFloat(slider.value); };

/** Поставить скелет в кадр жеста на момент t — через настоящий плеер. */
function poseAt(time: number) {
  if (!player || !gesture) return;
  const p = player as unknown as {
    gesture: GestureJSON; playing: boolean; returning: boolean; loop: boolean;
    blendStart: number; startWallClock: number; speed: number;
  };
  p.gesture = gesture;
  p.playing = true;
  p.returning = false;
  p.loop = false;
  p.speed = 1;
  p.blendStart = -Infinity; // без слерпа входа: смотрим сам кадр
  p.startWallClock = performance.now() / 1000 - time;
  player.update();
}

function bonePos(name: string) {
  const b = bones?.get(name);
  return b ? b.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
}

function placeCameras() {
  const head = bonePos('mixamorigHead');
  const chest = bonePos('mixamorigSpine2');
  const hand = bonePos('g');
  const midY = (head.y + chest.y) / 2 - 0.05;
  const target = new THREE.Vector3(0, midY, 0.05);
  const set = (cam: THREE.PerspectiveCamera, pos: THREE.Vector3, look: THREE.Vector3) => {
    cam.position.copy(pos);
    cam.lookAt(look);
  };
  set(views[0].cam, new THREE.Vector3(0, midY, 2.3), target);
  set(views[1].cam, new THREE.Vector3(-2.3, midY, 0.05), target);
  set(views[2].cam, new THREE.Vector3(-1.3, midY + 0.15, 1.9), target);
  // Кисть крупно: спереди-сбоку от кисти, следим за ней
  const handLook = hand.clone().add(new THREE.Vector3(0, 0.07, 0));
  set(views[3].cam, handLook.clone().add(new THREE.Vector3(-0.12, 0.05, 0.62)), handLook);
}

function render() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px';
  renderer.domElement.style.height = h + 'px';
  placeCameras();
  for (const v of views) {
    const [x, y, vw, vh] = v.place(w, h);
    renderer.setViewport(x, y, vw, vh);
    renderer.setScissor(x, y, vw, vh);
    v.cam.aspect = vw / vh;
    v.cam.updateProjectionMatrix();
    renderer.render(scene, v.cam);
    const lbl = document.querySelector<HTMLElement>(`.lbl[data-view="${v.name}"]`);
    if (lbl) { lbl.style.left = x + 8 + 'px'; lbl.style.top = h - y - vh + 8 + 'px'; }
  }
}

/** «Плёнка»: каждый момент — колонка, верх — спереди, низ — сбоку. */
const strip = params.get('strip')?.split(',').map(Number).filter((x) => Number.isFinite(x)) ?? null;
function renderStrip(times: number[]) {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px';
  renderer.domElement.style.height = h + 'px';
  document.querySelectorAll('.lbl').forEach((el) => el.remove());
  const cw = w / times.length;
  const aspect = cw / (h / 2);
  // В колонку должна влезть полоса ~0.8 м (голова + поднятая кисть) по ширине
  const D = 2.2;
  const halfW = 0.4;
  const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(halfW / D / aspect));
  const front = new THREE.PerspectiveCamera(vfov, aspect, 0.01, 50);
  const side = new THREE.PerspectiveCamera(vfov, aspect, 0.01, 50);
  times.forEach((time, i) => {
    poseAt(time);
    const head = bonePos('mixamorigHead');
    const cy = head.y - 0.2;
    front.position.set(-0.1, cy, D);
    front.lookAt(-0.1, cy, 0);
    side.position.set(-D, cy, 0.12);
    side.lookAt(0, cy, 0.12);
    for (const [cam, row] of [[front, 1], [side, 0]] as const) {
      renderer.setViewport(i * cw, row * h / 2, cw, h / 2);
      renderer.setScissor(i * cw, row * h / 2, cw, h / 2);
      renderer.render(scene, cam);
    }
    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = `t=${time.toFixed(2)}`;
    lbl.style.left = i * cw + 6 + 'px';
    lbl.style.top = '6px';
    document.body.appendChild(lbl);
  });
}

/** Вид «с веб-камеры»: человек по пояс перед камерой на уровне лица. */
const camMode = params.get('view') === 'cam';
function renderCam() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px';
  renderer.domElement.style.height = h + 'px';
  document.querySelectorAll('.lbl').forEach((el) => el.remove());
  const head = bonePos('mixamorigHead');
  const cam = new THREE.PerspectiveCamera(50, w / h, 0.01, 50);
  cam.position.set(0, head.y - 0.02, 1.35);
  cam.lookAt(0, head.y - 0.3, 0);
  renderer.setViewport(0, 0, w, h);
  renderer.setScissor(0, 0, w, h);
  renderer.render(scene, cam);
}
if (camMode) {
  document.getElementById('bar')!.style.display = 'none';
  host.style.inset = '0';
  scene.background = new THREE.Color(0xd8d2c6);
  grid.visible = false;
}

/**
 * Вид «как в записи SpreadTheSign» (view=ref): кадр 4:3, камера прямо спереди,
 * плечи аватара стоят там же, где плечи носителя в видео словаря. Так кадр
 * аватара можно класть рядом с кадром записи и сравнивать один в один.
 *   refu — середина плеч по горизонтали (доля ширины кадра, по умолчанию 0.528)
 *   refv — высота плеч от верха кадра (доля высоты, 0.49)
 *   refw — ширина между плечевыми суставами (доля ширины кадра, 0.37)
 */
const refMode = params.get('view') === 'ref';
function renderRef() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px';
  renderer.domElement.style.height = h + 'px';
  document.querySelectorAll('.lbl').forEach((el) => el.remove());
  const u = parseFloat(params.get('refu') ?? '0.528');
  const v = parseFloat(params.get('refv') ?? '0.49');
  const fw = parseFloat(params.get('refw') ?? '0.37');
  const sr = bonePos('i'), sl = bonePos('13');
  const mid = sr.clone().add(sl).multiplyScalar(0.5);
  const D = 2.0;
  const frameW = sr.distanceTo(sl) / fw; // ширина кадра на глубине плеч, м
  const frameH = (frameW * h) / w;
  const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(frameH / 2 / D));
  const cam = new THREE.PerspectiveCamera(vfov, w / h, 0.01, 50);
  const cx = mid.x - (u - 0.5) * frameW;
  const cy = mid.y - (0.5 - v) * frameH;
  cam.position.set(cx, cy, mid.z + D);
  cam.lookAt(cx, cy, mid.z);
  renderer.setViewport(0, 0, w, h);
  renderer.setScissor(0, 0, w, h);
  renderer.render(scene, cam);
}
if (refMode) {
  document.getElementById('bar')!.style.display = 'none';
  host.style.inset = '0';
  scene.background = new THREE.Color(0x8a5a3c);
  grid.visible = false;
}

function tick() {
  if (strip && gesture) {
    renderStrip(strip);
    return; // статичная картинка
  }
  if (camMode && gesture) {
    poseAt(Math.min(t, gesture.frames[gesture.frames.length - 1].t));
    renderCam();
    requestAnimationFrame(tick);
    return;
  }
  if (refMode && gesture) {
    poseAt(Math.min(t, gesture.frames[gesture.frames.length - 1].t));
    renderRef();
    requestAnimationFrame(tick);
    return;
  }
  const now = performance.now() / 1000;
  const dt = now - lastNow;
  lastNow = now;
  if (gesture) {
    const dur = gesture.frames[gesture.frames.length - 1].t;
    if (playing) {
      t += dt * speed;
      if (t > dur + 0.4) t = 0;
    }
    poseAt(Math.min(t, dur));
    slider.max = String(dur);
    slider.value = String(Math.min(t, dur));
    tlabel.textContent = `t = ${Math.min(t, dur).toFixed(2)} с из ${dur.toFixed(2)}`;
  }
  render();
  requestAnimationFrame(tick);
}

(async () => {
  const avatar = await loadAvatar(AVATARS[avatarId]?.url ?? AVATARS.elnar.url);
  scene.add(avatar.root);
  bones = avatar.bones;
  player = new GesturePlayer(bones);
  gesture = await fetchGesture(gestureName);
  (window as unknown as { lab: unknown }).lab = { poseAt, bones, player, gesture, THREE, setT: (v: number) => { playing = false; t = v; } };
  document.title = `лаборатория: ${gestureName} (${avatarId})`;
  tick();
})();

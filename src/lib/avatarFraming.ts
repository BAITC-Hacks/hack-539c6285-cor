import * as THREE from 'three';

/**
 * Кадрирование аватара «как сурдопереводчик в новостях»: поясной план,
 * всё ниже пояса срезано плоскостью отсечения.
 *
 * Границы берутся из реальных костей скелета, а не из процентов от роста —
 * иначе кадр «плывёт» при смене модели аватара.
 */

export interface WaistUpFraming {
  /** Y мировой плоскости среза (уровень пояса). */
  cutY: number;
  /** Центр кадра по вертикали. */
  focusY: number;
  /** Дистанция камеры, при которой кадр заполнен от пояса до макушки. */
  distance: number;
  /** Плоскость отсечения — вешается на материалы. */
  clipPlane: THREE.Plane;
}

/**
 * Считает поясной кадр по позициям костей.
 * fovDeg — вертикальный угол камеры, aspect — ширина/высота вьюпорта.
 */
export function computeWaistUpFraming(
  bones: Map<string, THREE.Bone>,
  fovDeg: number,
  aspect: number,
): WaistUpFraming {
  const tmp = new THREE.Vector3();

  // Имена костей в разных ассетах пишутся по-разному (mixamorig:Head,
  // mixamorigHead, просто Head), поэтому ищем по окончанию имени.
  const find = (suffix: string): THREE.Bone | null => {
    const want = suffix.toLowerCase();
    for (const [name, bone] of bones) {
      const n = name.toLowerCase();
      if (n === want || n.endsWith(':' + want) || n.endsWith(want)) return bone;
    }
    return null;
  };
  const pos = (suffix: string): THREE.Vector3 | null => {
    const b = find(suffix);
    if (!b) return null;
    b.updateWorldMatrix(true, false);
    b.getWorldPosition(tmp);
    return tmp.clone();
  };

  const head = pos('head');
  const hips = pos('hips');
  const neck = pos('neck');

  // Запасной вариант, если имена костей другие: берём габарит по всем костям.
  if (!head || !hips) {
    const box = new THREE.Box3();
    for (const b of bones.values()) {
      b.getWorldPosition(tmp);
      if (Number.isFinite(tmp.y)) box.expandByPoint(tmp);
    }
    const h = Math.max(box.max.y - box.min.y, 0.001);
    const cutY = box.min.y + h * 0.52;
    const topY = box.max.y + h * 0.06;
    return framingFrom(cutY, topY, box.getCenter(new THREE.Vector3()).z, fovDeg, aspect);
  }

  // Срез по поясу: чуть выше таза, как за трибуной в новостной студии.
  // Доля от расстояния таз->шея, чтобы не зависеть от роста модели.
  const torso = neck ? neck.y - hips.y : 0.46;
  const cutY = hips.y + torso * 0.22;
  // Макушка примерно на длину шеи выше кости головы.
  const neckLen = neck ? Math.max(head.y - neck.y, 0.01) : 0.12;
  const topY = head.y + neckLen * 1.5;

  return framingFrom(cutY, topY, head.z, fovDeg, aspect);
}

function framingFrom(
  cutY: number, topY: number, centerZ: number, fovDeg: number, aspect: number,
): WaistUpFraming {
  const focusY = (cutY + topY) / 2;
  const frameH = Math.max(topY - cutY, 0.001);

  // Вертикальный охват + запас: при жестах руки уходят вверх и вбок.
  const vFov = (fovDeg * Math.PI) / 180;
  let distance = (frameH / 2) / Math.tan(vFov / 2) * 1.18;

  // Жестовое пространство шире корпуса: руки уходят в стороны примерно на
  // ±0.55 м при росте 1.8, поэтому по горизонтали нужен заметный запас.
  const neededWidth = frameH * 1.75;
  const hFovHalf = Math.atan(Math.tan(vFov / 2) * aspect);
  const distForWidth = (neededWidth / 2) / Math.tan(hFovHalf) * 1.05;
  distance = Math.max(distance, distForWidth);

  return {
    cutY,
    focusY,
    distance,
    clipPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -cutY),
  };
}

/**
 * Кадр сурдопереводчика с гарантией на кисти: низ тела спрятан, но срез
 * проходит НИЖЕ кончиков пальцев висящих рук — руки в покое видны целиком.
 * Прежний поясной кадр резал по талии, и висящие кисти уходили под срез.
 *
 * Нижняя граница берётся из реальных костей кистей в текущей стойке
 * (загрузчик уже опустил руки), поэтому одинаково работает на Адаме и Еве.
 */
export function computeSignerFraming(
  bones: Map<string, THREE.Bone>,
  fovDeg: number,
  aspect: number,
): WaistUpFraming {
  const tmp = new THREE.Vector3();
  const box = new THREE.Box3();
  let lowestHandY = Infinity;
  // Кисти и пальцы в этом риге минифицированы: z/g — кисти, дальше фаланги.
  const handNames = new Set([
    'z', 'g',
    'm', 'l', 'k', 'p', 'o', 'n', 's', 'r', 'q', 'v', 'u', 't', 'y', 'x', 'w',
    '3', '2', '1', '6', '5', '4', '9', '8', '7', 'c', 'b', 'a', 'f', 'e', 'd',
  ]);
  for (const [name, b] of bones) {
    b.updateWorldMatrix(true, false);
    b.getWorldPosition(tmp);
    if (!Number.isFinite(tmp.x) || !Number.isFinite(tmp.y) || !Number.isFinite(tmp.z)) continue;
    box.expandByPoint(tmp);
    if (handNames.has(name)) lowestHandY = Math.min(lowestHandY, tmp.y);
  }
  const h = Math.max(box.max.y - box.min.y, 0.001);
  if (!Number.isFinite(lowestHandY)) lowestHandY = box.min.y + h * 0.45;

  // Меш пальцев тянется ниже последней кости — запас, плюс воздух под кистями.
  const cutY = lowestHandY - h * 0.07;
  // Сверху — причёска (у Евы пучок) и бейджи интерфейса по краю сцены.
  const topY = box.max.y + h * 0.12;

  return framingFrom(cutY, topY, box.getCenter(new THREE.Vector3()).z, fovDeg, aspect);
}

/** Вешает плоскость отсечения на все материалы модели. */
export function applyClipPlane(root: THREE.Object3D, plane: THREE.Plane) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m) continue;
      m.clippingPlanes = [plane];
      m.clipShadows = true;
      m.needsUpdate = true;
    }
  });
}

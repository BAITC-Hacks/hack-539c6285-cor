/**
 * Извлечение кадра лэндмарков MediaPipe Holistic в SLOVO-совместимый вектор.
 *
 * Раскладка кадра (255 чисел) идентична обучающему датасету:
 *   pose(33*3=99) + face(10*3=30) + left_hand(21*3=63) + right_hand(21*3=63)
 *
 * Отсутствующий блок = нули (так же, как в ml/extract_holistic.py) — по этому
 * признаку ретаргетинг определяет, видна ли кисть.
 */

/** Ключевые точки лица (те же индексы, что при обучении). */
export const FACE_KEY_INDICES = [0, 13, 14, 61, 291, 33, 263, 159, 386, 152];

export const NUM_POSE = 33;
export const NUM_FACE_KEY = 10;
export const NUM_HAND = 21;

/** Длина сырого вектора кадра: (33 + 10 + 21 + 21) * 3. */
export const FRAME_FEATURES = 255;

/** Смещения блоков внутри кадра — используются ретаргетингом. */
export const POSE_OFFSET = 0;
export const FACE_OFFSET = NUM_POSE * 3;                    // 99
export const LEFT_HAND_OFFSET = FACE_OFFSET + NUM_FACE_KEY * 3;  // 129
export const RIGHT_HAND_OFFSET = LEFT_HAND_OFFSET + NUM_HAND * 3; // 192

/** Результат MediaPipe Holistic (типы пакета неполные, поэтому структурно). */
interface HolisticLandmark {
  x: number;
  y: number;
  z: number;
}
interface HolisticResults {
  poseLandmarks?: HolisticLandmark[];
  faceLandmarks?: HolisticLandmark[];
  leftHandLandmarks?: HolisticLandmark[];
  rightHandLandmarks?: HolisticLandmark[];
}

/**
 * Кадр Holistic -> вектор из 255 чисел.
 *
 * mirrored: камера показывает зеркальное изображение. При mirrored=true X
 * отражается (1-x) И блоки кистей меняются местами — иначе поднятая правая
 * рука пользователя попадёт в левую руку аватара.
 */
export function extractHolisticFrame(
  results: HolisticResults,
  mirrored = true,
): number[] {
  const frame = new Array<number>(FRAME_FEATURES).fill(0);
  const fx = (x: number) => (mirrored ? 1 - x : x);

  const writeBlock = (
    src: HolisticLandmark[] | undefined,
    offset: number,
    count: number,
    indices?: number[],
  ) => {
    if (!src) return;
    for (let i = 0; i < count; i++) {
      const lm = src[indices ? indices[i] : i];
      if (!lm) continue;
      frame[offset + i * 3] = fx(lm.x);
      frame[offset + i * 3 + 1] = lm.y;
      frame[offset + i * 3 + 2] = lm.z;
    }
  };

  writeBlock(results.poseLandmarks, POSE_OFFSET, NUM_POSE);
  writeBlock(results.faceLandmarks, FACE_OFFSET, NUM_FACE_KEY, FACE_KEY_INDICES);

  // Блоки кистей НЕ меняются местами при зеркалировании.
  //
  // MediaPipe размечает и позу, и кисти анатомически: poseLandmarks[11] — это
  // левое плечо человека, leftHandLandmarks — его левая кисть, независимо от
  // того, как он повёрнут. Отражение по X — это только смена точки зрения, а
  // не смена руки. Если поменять местами кисти, но не поменять плечи (а их
  // индексы фиксированы), рука аватара получит локоть от одной руки человека,
  // а кулак — от другой: поднимается одна рука, сжимается другая.
  writeBlock(results.leftHandLandmarks, LEFT_HAND_OFFSET, NUM_HAND);
  writeBlock(results.rightHandLandmarks, RIGHT_HAND_OFFSET, NUM_HAND);

  return frame;
}

/** Виден ли блок (не все нули) — критерий «кисть в кадре». */
export function isBlockAlive(frame: ArrayLike<number>, offset: number, count: number): boolean {
  for (let i = 0; i < count * 3; i++) {
    if (frame[offset + i] !== 0) return true;
  }
  return false;
}

/**
 * Достоверность точек позы (33 значения 0..1).
 *
 * КРИТИЧНО для управления аватаром: когда сустав уходит за край кадра,
 * MediaPipe не выбрасывает его, а ДОДУМЫВАЕТ координаты — с низкой
 * visibility. Без этой проверки аватар машет руками, которых в кадре нет.
 */
export function extractPoseVisibility(results: {
  poseLandmarks?: Array<{ visibility?: number }>;
}): Float32Array {
  const vis = new Float32Array(NUM_POSE);
  const src = results.poseLandmarks;
  if (!src) return vis;
  for (let i = 0; i < NUM_POSE; i++) {
    vis[i] = src[i]?.visibility ?? 0;
  }
  return vis;
}

/** Кадр живого захвата: точки + их достоверность. */
export interface LiveCaptureFrame {
  landmarks: Float32Array;
  poseVisibility: Float32Array;
}

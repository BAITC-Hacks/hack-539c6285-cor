/**
 * Разметка трекинга поверх видео.
 *
 * Рисуем только то, что реально едет в решатель: плечо, локоть, запястье и
 * скелет кисти. Лицо и ноги из POSE_CONNECTIONS не рисуются — на лице эти
 * линии ложатся друг на друга и превращаются в кашу, а к жесту отношения не
 * имеют. Перемычка между плечами тоже убрана: лежит поперёк груди и мешает.
 *
 * Функция чистая (только canvas и переданное состояние), поэтому её можно
 * нарисовать настоящим кадром из ml/landmarks_holistic и посмотреть глазами,
 * не поднимая камеру: `node scripts/preview-overlay.mjs`.
 */

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  /**
   * Достоверность точки позы. КРИТИЧНА для маркера потерянной кисти: за краем
   * кадра MediaPipe не выбрасывает сустав, а ДОДУМЫВАЕТ координаты (см.
   * src/lib/landmarks.ts). Без проверки маркер рисуется в выдуманном месте.
   */
  visibility?: number;
}

export interface TrackedFrame {
  poseLandmarks?: Landmark[];
  leftHandLandmarks?: Landmark[];
  rightHandLandmarks?: Landmark[];
}

/**
 * Что кисть ближе к камере — решение с памятью, см. resolveNearSide.
 * Владеет им вызывающий код (useRef), чтобы функция осталась чистой.
 */
export interface OverlayState {
  nearSide?: 'left' | 'right';
}

export interface OverlayOptions {
  /** Рисовать ли плечо-локоть-запястье. Выключается там, где есть свой скелет позы. */
  arms?: boolean;
  /** Память порядка отрисовки между кадрами. */
  state?: OverlayState;
}

/** Цепочка руки: плечо -> локоть -> запястье. Индексы точек позы MediaPipe. */
const ARM_CHAIN = {
  left: [11, 13, 15],
  right: [12, 14, 16],
} as const;

/**
 * Связи скелета кисти — те же, что в HAND_CONNECTIONS у MediaPipe.
 * Держим списком здесь, чтобы отрисовка не тянула drawing_utils и её можно
 * было прогнать вне браузера.
 */
const HAND_BONES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],           // большой
  [0, 5], [5, 6], [6, 7], [7, 8],           // указательный
  [5, 9], [9, 10], [10, 11], [11, 12],      // средний
  [9, 13], [13, 14], [14, 15], [15, 16],    // безымянный
  [13, 17], [17, 18], [18, 19], [19, 20],   // мизинец
  [0, 17],                                   // пясть замыкается на мизинец
];

/**
 * Своя краска на сторону: когда кисти сходятся или одна ладонь уходит за
 * другую, по одинаковым линиям не понять, где чья рука.
 *
 * Стороны анатомические, как их размечает MediaPipe. Видео показано зеркально,
 * поэтому красная рука окажется там, где пользователь видит свою левую.
 */
export const SIDE_PAINT = {
  left: { bone: '#f87171', joint: '#fecaca' },    // красная
  right: { bone: '#4ade80', joint: '#bbf7d0' },   // зелёная
} as const;

const BONE_WIDTH = 3;
const JOINT_RADIUS = 3.5;

/** Цвет обводки под линиями и точками — под цвет затемнённого видео. */
const CASING_COLOR = 'rgba(10, 9, 8, 0.85)';
/** Насколько обводка шире самой линии (суммарно, по 2 пикселя с каждой стороны). */
const CASING_WIDTH = 4;

/** Пунктир и кружок, которыми помечается потерянная кисть. */
const LOST_DASH = [6, 5];
const LOST_MARK_RADIUS = 9;
/** Отступ, на котором маркер удерживается у края кадра. */
const EDGE_MARGIN = 16;

/** Индексы запястий в позе — по ним определяем, какая кисть ближе к камере. */
const POSE_WRIST = { left: 15, right: 16 } as const;

/**
 * Ниже этого порога точку позы MediaPipe додумал, а не увидел.
 * То же значение, что по умолчанию у drawing_utils.
 */
const MIN_VISIBILITY = 0.5;

/**
 * Насколько глубины должны разойтись, чтобы переставить кисти местами.
 *
 * Измерено на 400 клипах SLOVO: при сведённых кистях медиана |z15 - z16| равна
 * 0.241, но у 8.2% близких кадров разница меньше 0.05 — там знак определяет
 * шум, и порядок перещёлкивается примерно раз в секунду на 30 fps. Ровно в тот
 * момент, когда кисти сошлись, то есть когда порядок и важен. Поэтому меняем
 * его только при уверенной разнице, иначе держим прежний.
 */
const DEPTH_HYSTERESIS = 0.08;

/**
 * Глубина кисти: чем МЕНЬШЕ, тем ближе к камере (так отдаёт MediaPipe).
 * Берём запястье позы — у точек кисти z считается относительно запястья, то
 * есть между двумя кистями их сравнивать нельзя.
 */
function wristDepth(frame: TrackedFrame, side: 'left' | 'right'): number | null {
  const z = frame.poseLandmarks?.[POSE_WRIST[side]]?.z;
  return typeof z === 'number' ? z : null;
}

/** Какая кисть ближе к камере, с гистерезисом против мерцания. */
function resolveNearSide(frame: TrackedFrame, state?: OverlayState): 'left' | 'right' {
  const zl = wristDepth(frame, 'left');
  const zr = wristDepth(frame, 'right');
  const previous = state?.nearSide ?? 'right';
  if (zl === null || zr === null) return previous;

  const diff = zr - zl;    // > 0 — левая ближе
  if (Math.abs(diff) < DEPTH_HYSTERESIS) return previous;

  const near = diff > 0 ? 'left' : 'right';
  if (state) state.nearSide = near;
  return near;
}

export function drawTrackedSkeleton(
  ctx: CanvasRenderingContext2D,
  frame: TrackedFrame,
  width: number,
  height: number,
  options: OverlayOptions = {},
) {
  const { arms = true, state } = options;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Дальнюю кисть рисуем первой, ближнюю поверх.
  //
  // Раньше порядок был жёстким (левая, потом правая), и при сближении правая
  // всегда накрывала левую — независимо от того, какая рука на самом деле
  // впереди. Выглядело так, будто скелет пропал.
  const near = resolveNearSide(frame, state);
  const order: Array<'left' | 'right'> = near === 'left' ? ['right', 'left'] : ['left', 'right'];

  for (const side of order) {
    const paint = SIDE_PAINT[side];
    const hand = side === 'left' ? frame.leftHandLandmarks : frame.rightHandLandmarks;
    const pose = frame.poseLandmarks;
    const at = (p: Landmark): [number, number] => [p.x * width, p.y * height];

    /**
     * Обводка. Каждая линия и точка сначала обводится тёмным, потом красится
     * цветом стороны. Приём из картографии: подпись поверх карты читается
     * потому, что под ней лежит контур фона.
     *
     * Здесь он решает главную беду — когда кисти сходятся, линии двух скелетов
     * ложатся друг на друга и сливаются в один клубок, где не видно, где чья
     * рука. С тёмным контуром верхняя кисть отделяется от нижней, и обе
     * читаются: нижняя не пропадает, а уходит ПОД верхнюю.
     */
    const casing = (draw: () => void, extra: number) => {
      ctx.strokeStyle = CASING_COLOR;
      ctx.lineWidth = BONE_WIDTH + extra;
      draw();
    };

    // Рука одной непрерывной костью: плечо -> локоть -> запястье, где запястье
    // берётся из модели КИСТИ, если она видна. Точка позы и точка кисти не
    // совпадают, и между предплечьем и скелетом кисти зиял разрыв — кисть
    // выглядела отрезанной от руки.
    if (arms && pose) {
      const [shoulder, elbow, poseWrist] = ARM_CHAIN[side].map((i) => pose[i]);
      const wrist = hand?.[0] ?? poseWrist;
      if (shoulder && elbow && wrist) {
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(...at(shoulder));
          ctx.lineTo(...at(elbow));
          ctx.lineTo(...at(wrist));
          ctx.stroke();
        };
        casing(path, CASING_WIDTH);
        // Кисть потеряна — рука рисуется пунктиром. Сплошная линия без пальцев
        // выглядит как обычная рука, и непонятно, почему аватар не повторяет.
        if (!hand) ctx.setLineDash(LOST_DASH);
        ctx.strokeStyle = paint.bone;
        ctx.lineWidth = BONE_WIDTH;
        ctx.globalAlpha = hand ? 1 : 0.55;
        path();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      if (!hand && poseWrist) drawLostMark(ctx, poseWrist, paint.bone, width, height);
    }

    if (!hand) continue;

    const bones = () => {
      ctx.beginPath();
      for (const [a, b] of HAND_BONES) {
        if (!hand[a] || !hand[b]) continue;
        ctx.moveTo(...at(hand[a]));
        ctx.lineTo(...at(hand[b]));
      }
      ctx.stroke();
    };
    casing(bones, CASING_WIDTH);
    ctx.strokeStyle = paint.bone;
    ctx.lineWidth = BONE_WIDTH;
    bones();

    // Точки суставов: тёмный контур по той же причине, что и у линий.
    ctx.fillStyle = paint.bone;
    ctx.strokeStyle = CASING_COLOR;
    ctx.lineWidth = 2;
    for (const p of hand) {
      if (!p) continue;
      const [x, y] = at(p);
      ctx.beginPath();
      ctx.arc(x, y, JOINT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Метка на месте пропавшей кисти.
 *
 * Почему не просто кружок в точке запястья. На 400 клипах SLOVO из 9128
 * событий «кисть потеряна» у 22.4% запястье позы лежит ВНЕ кадра и ещё у 4.3%
 * в двух процентах от края: в четверти случаев единственное объяснение
 * происходящего рисовалось за границей канваса, то есть рука пропадала молча.
 * Причём это не редкий угол — по данным именно уход за край кадра и есть
 * главная причина потерь (36% кадров при разведённых руках).
 *
 * Поэтому: точка в кадре — кружок на месте; точка за кадром — маркер
 * прижимается к краю и получает стрелку в ту сторону, куда ушла рука.
 */
function drawLostMark(
  ctx: CanvasRenderingContext2D,
  wrist: Landmark,
  color: string,
  width: number,
  height: number,
) {
  const rawX = wrist.x * width;
  const rawY = wrist.y * height;
  const outside = wrist.x < 0 || wrist.x > 1 || wrist.y < 0 || wrist.y > 1;
  // Низкая достоверность = координату MediaPipe додумал. Метку показываем,
  // но приглушённой: это догадка о том, где рука, а не факт.
  const guessed = (wrist.visibility ?? 1) < MIN_VISIBILITY;

  const x = Math.min(Math.max(rawX, EDGE_MARGIN), width - EDGE_MARGIN);
  const y = Math.min(Math.max(rawY, EDGE_MARGIN), height - EDGE_MARGIN);

  ctx.save();
  ctx.globalAlpha = guessed ? 0.5 : 0.75;

  ctx.strokeStyle = CASING_COLOR;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, LOST_MARK_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(LOST_DASH);
  ctx.beginPath();
  ctx.arc(x, y, LOST_MARK_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Рука ушла за кадр — показываем стрелкой, куда именно.
  if (outside) {
    const dx = rawX - x;
    const dy = rawY - y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const tip = LOST_MARK_RADIUS + 9;
    const base = LOST_MARK_RADIUS + 3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + ux * tip, y + uy * tip);
    ctx.lineTo(x + ux * base - uy * 5, y + uy * base + ux * 5);
    ctx.lineTo(x + ux * base + uy * 5, y + uy * base - ux * 5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

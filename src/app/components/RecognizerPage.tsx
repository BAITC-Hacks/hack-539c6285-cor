import { useEffect, useRef, useState, useCallback } from 'react';
import { useSignModel, QYRAN_MODEL } from '@/hooks/useSignModel';
import { AslDactyl } from '@/lib/aslDactyl';
import { useSpeech } from '@/hooks/useSpeech';
import { HolisticStabilizer, DEFAULT_CONFIG, type StabilizerConfig, type StabilizedSet, type StabilizedHolistic } from '@/lib/landmarkStabilizer';
import {
  HAND_CONNECTIONS,
  FACEMESH_FACE_OVAL,
  FACEMESH_LIPS,
  FACEMESH_LEFT_EYE,
  FACEMESH_RIGHT_EYE,
  FACEMESH_LEFT_EYEBROW,
  FACEMESH_RIGHT_EYEBROW,
  FACEMESH_LEFT_IRIS,
  FACEMESH_RIGHT_IRIS,
} from '@mediapipe/holistic';
import { featurizeWindow } from '@/lib/features';
import { useT } from '@/i18n';
import { ThemeToggle } from '@/app/components/shared/ThemeToggle';
import { LangSwitcher } from '@/app/components/shared/LangSwitcher';

// MediaPipe Holistic key face indices (same as training)
const FACE_KEY_INDICES = [0, 13, 14, 61, 291, 33, 263, 159, 386, 152];
const NUM_POSE = 33;
const NUM_FACE_KEY = 10;
const NUM_HAND = 21;
const FEATURES = 255; // (33 + 10 + 21 + 21) * 3 — raw MediaPipe vector per frame
const SEQ_LEN = 60;

// ---------------------------------------------------------------------------
// Камера — конвейер тестового стенда «Кыран» (ml/youtube_rsl/webtest/app.js),
// на котором Кыран-240 проверяли до деплоя. Веса там и здесь одни и те же
// байт в байт, поэтому всё между камерой и сетью повторяет стенд:
//  * MediaPipe Holistic той же сборки, лицо с уточнением (refineFaceLandmarks),
//    собственное сглаживание MediaPipe выключено;
//  * окно модели — последние 60 обработанных кадров, без пересчёта по времени
//    и без смешивания соседних кадров;
//  * предсказание раз в 15 кадров, решение — по сырым вероятностям ансамбля:
//    top-1 не no_event, не ниже 25 % и в 1.8 раза выше второго места;
//  * слово встаёт во фразу после двух таких замеров подряд и не чаще раза в
//    1.2 с; то же слово ещё раз — только после паузы (замера «не жест»).
// ---------------------------------------------------------------------------
const HOLISTIC_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629';
/** Не чаще 30 кадров в секунду: камера отдаёт 30, лишний send положил бы в окно дубли одного кадра. */
const SEND_MIN_INTERVAL_MS = 33;
const PRED_EVERY = 15;           // кадров между предсказаниями
const BUFFER_MAX = SEQ_LEN * 2;  // буфер кадров; окно берёт последние 60
const ACCEPT_P = 0.25;           // top-1 не ниже…
const ACCEPT_RATIO = 1.8;        // …и во столько раз выше второго места
const LOCK_REPEATS = 2;          // принятых замеров подряд, чтобы слово встало во фразу
const COOLDOWN_MS = 1200;        // пауза между словами фразы
/** Ниже этой частоты окно из 60 кадров растягивается во времени — предупреждаем, как стенд. */
const FPS_LOW = 12;

// ---------------------------------------------------------------------------
// Стабилизация лэндмарков (src/lib/landmarkStabilizer.ts) — слой между
// трекером и ОТРИСОВКОЙ. Классификатор по умолчанию получает сырые точки:
// модель училась на сырых, и менять её вход без переобучения нельзя.
// ---------------------------------------------------------------------------
/** Подавать в модель сглаженные точки вместо сырых. Оставить false, пока модель не переобучена. */
const STABILIZE_MODEL_INPUT = false;
/** Отладка: рисовать СЫРЫЕ точки кистей красным поверх сглаженного скелета, чтобы сравнить на глаз. */
const DEBUG_RAW_LANDMARKS = false;
/** Цвет сырых точек в отладке — контрастный к любой краске сторон. */
const DEBUG_RAW_COLOR = '#ff3b30';
/** Прозрачность кисти, положение которой предсказано (трекер её не вернул). */
const EXTRAPOLATED_ALPHA = 0.7;

/** Ручки стабилизатора. Дрожь ↔ лаг: minCutoff/beta; скачки: maxSpeed/jumpHandScale; потеря: extrapolateFrames/fadeMs. */
const STABILIZER_CONFIG: StabilizerConfig = {
  ...DEFAULT_CONFIG,
  minCutoff: 1.0,        // One Euro, Гц: МЕНЬШЕ — глаже в покое, но больше лаг
  beta: 4.0,             // One Euro: БОЛЬШЕ — меньше лаг на быстрых движениях, больше дрожь
  dCutoff: 1.0,          // One Euro: сглаживание оценки скорости (обычно не трогать)
  maxSpeed: 4.0,         // отсев скачков: допустимая скорость точки, ширин кадра в секунду
  jumpHandScale: 1.2,    // отсев скачков: порог за кадр не меньше k × размер ладони (запястье→основание среднего)
  jumpConfirmFrames: 2,  // скачок ВСЕЙ кисти принимается, если новое место подтвердилось столько кадров подряд
  minConfidence: 0.3,    // visibility ниже порога → точка пропала (только поза; у кистей visibility нет)
  extrapolateFrames: 6,  // кадров вести кисть по последней скорости после потери трекинга
  velocityDecay: 0.8,    // затухание скорости на каждом экстраполированном кадре
  fadeMs: 400,           // после экстраполяции: мс плавного исчезновения (alpha 1 → 0) вместо резкого пропадания
  boneClamp: [0.6, 1.45], // длина кости относительно калибровки [min, max] — шум не растянет/сожмёт палец
  calibFrames: 30,       // кадров калибровки длин костей после старта
  // Переключатели слоёв для отладки: что именно даёт эффект.
  enableFilter: true,
  enableJumpReject: true,
  enableExtrapolation: true,
  enableBoneConstraints: true,
};

/** Прозрачность отрисовки набора точек по его статусу в стабилизаторе. */
function alphaOf(set: StabilizedSet): number {
  if (set.status === 'fading') return set.alpha;
  if (set.status === 'extrapolated') return EXTRAPOLATED_ALPHA;
  return 1;
}

// ---------------------------------------------------------------------------
// Цифровой скелет, как на стенде: только скелет на тёмном фоне, без кадра
// камеры (стиль референса SL2T) — контуры лица и зрачки, поза до пояса, левая
// кисть жёлтая, правая розовая. Сам кадр камеры — маленьким окошком в углу.
// ---------------------------------------------------------------------------
const SKELETON_BG = '#07090f';
const POSE_COLOR = '#cdd6e4';
const FACE_COLOR = '#39c5ff';
const FACE_DOT_COLOR = '#bfe9ff';
const LEFT_HAND_COLOR = '#ffcf33';
const RIGHT_HAND_COLOR = '#ff4fd8';
const JOINT_COLOR = '#eaf2ff';
/** Сглаживание отображения лица (стабилизатор лицо не трогает). */
const FACE_SMOOTH_A = 0.55;

type Pt = { x: number; y: number };
type Pairs = ReadonlyArray<readonly [number, number]>;

const UPPER_POSE: Pairs = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]];
/** Кисть: если сборка holistic не отдала HAND_CONNECTIONS, те же 21 связь вручную. */
const HAND_PAIRS: Pairs = (HAND_CONNECTIONS as Pairs | undefined) ?? [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11],
  [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
/** Переносица 168→4 и крылья носа — в holistic нет готового набора. */
const NOSE_LINES: Pairs = [[168, 6], [6, 197], [197, 195], [195, 5], [5, 4], [4, 98], [4, 327], [98, 97], [327, 326]];
const FACE_SETS: Pairs[] = [
  FACEMESH_FACE_OVAL, FACEMESH_LIPS, FACEMESH_LEFT_EYE, FACEMESH_RIGHT_EYE,
  FACEMESH_LEFT_EYEBROW, FACEMESH_RIGHT_EYEBROW, FACEMESH_LEFT_IRIS, FACEMESH_RIGHT_IRIS,
  NOSE_LINES,
].filter(Boolean) as Pairs[];
/** Точки лица, обведённые кружками, — все концы линий выше. */
const FACE_DOT_IDX = [...new Set(FACE_SETS.flatMap((set) => set.flatMap(([a, b]) => [a, b])))];

function strokePairs(
  ctx: CanvasRenderingContext2D,
  pts: ReadonlyArray<Pt | undefined> | null | undefined,
  pairs: Pairs,
  color: string,
  width: number,
  alpha = 1,
) {
  if (!pts) return;
  const { width: w, height: h } = ctx.canvas;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (const [a, b] of pairs) {
    const p = pts[a];
    const q = pts[b];
    if (!p || !q) continue;
    ctx.moveTo(p.x * w, p.y * h);
    ctx.lineTo(q.x * w, q.y * h);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function fillDots(ctx: CanvasRenderingContext2D, pts: ReadonlyArray<Pt | undefined>, color: string, r: number, alpha = 1) {
  const { width: w, height: h } = ctx.canvas;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (const p of pts) {
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHand(ctx: CanvasRenderingContext2D, lms: Pt[] | undefined, color: string, alpha: number, width = 2.5) {
  if (!lms || alpha <= 0) return;
  strokePairs(ctx, lms, HAND_PAIRS, color, width, alpha);
  fillDots(ctx, lms, width < 2 ? color : JOINT_COLOR, width < 2 ? 1.3 : 2, alpha);
}

/** Кадр скелета: s.results — стабилизированные точки, s.raw — сырые (для отладки). */
function drawSkeleton(ctx: CanvasRenderingContext2D, s: StabilizedHolistic<any>, face: { prev: Pt[] | null }) {
  const res = s.results;
  ctx.fillStyle = SKELETON_BG;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const pose: Pt[] | undefined = res.poseLandmarks;
  strokePairs(ctx, pose, UPPER_POSE, POSE_COLOR, 1.5, 0.85);
  if (pose) fillDots(ctx, [pose[11], pose[12], pose[13], pose[14], pose[23], pose[24]], POSE_COLOR, 2.5, 0.9);

  if (res.faceLandmarks) {
    const prev = face.prev;
    const pts: Pt[] = res.faceLandmarks.map((p: Pt, i: number) => (prev && prev[i]
      ? { x: FACE_SMOOTH_A * prev[i].x + (1 - FACE_SMOOTH_A) * p.x, y: FACE_SMOOTH_A * prev[i].y + (1 - FACE_SMOOTH_A) * p.y }
      : { x: p.x, y: p.y }));
    face.prev = pts;
    for (const set of FACE_SETS) strokePairs(ctx, pts, set, FACE_COLOR, 1.1, 0.9);
    fillDots(ctx, FACE_DOT_IDX.map((i) => pts[i]), FACE_DOT_COLOR, 1.3, 0.95);
  } else {
    face.prev = null;
  }

  drawHand(ctx, res.leftHandLandmarks, LEFT_HAND_COLOR, alphaOf(s.left));
  drawHand(ctx, res.rightHandLandmarks, RIGHT_HAND_COLOR, alphaOf(s.right));

  // Отладка: сырые точки трекера поверх сглаженных — видно и дрожь, и лаг
  // фильтра, и отброшенные скачки.
  if (DEBUG_RAW_LANDMARKS) {
    drawHand(ctx, s.raw.leftHandLandmarks, DEBUG_RAW_COLOR, 0.8, 1);
    drawHand(ctx, s.raw.rightHandLandmarks, DEBUG_RAW_COLOR, 0.8, 1);
  }
}

const PIPELINE_STAGES = [
  { id: 'hand', labelKey: 'recognizer.stage.hand', icon: '✋', enabled: true },
  { id: 'emotion', labelKey: 'recognizer.stage.emotion', icon: '😊', enabled: false },
  { id: 'llm', labelKey: 'recognizer.stage.llm', icon: '✨', enabled: false },
  { id: 'voice', labelKey: 'recognizer.stage.voice', icon: '🔊', enabled: true },
] as const;

interface RecognizerPageProps {
  onBack: () => void;
}

export function RecognizerPage({ onBack }: RecognizerPageProps) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Стабилизатор лэндмарков — один на страницу, хранит состояние фильтров между кадрами. */
  const stabilizerRef = useRef<HolisticStabilizer | null>(null);
  if (!stabilizerRef.current) stabilizerRef.current = new HolisticStabilizer({ ...STABILIZER_CONFIG });
  /** Сглаженные точки лица прошлого кадра — только для отрисовки. */
  const faceDrawRef = useRef<{ prev: Pt[] | null }>({ prev: null });
  const holisticRef = useRef<any>(null);
  const framesBufferRef = useRef<{ t: number; frame: Float32Array }[]>([]);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const isRunningRef = useRef(false);
  const predictRef = useRef<typeof predict | null>(null);

  // Кадры и решение — как на стенде
  const lastSendAtRef = useRef<number>(0);
  const inFlightRef = useRef(false);
  /** Кадров обработано с запуска камеры: предсказание — на каждом PRED_EVERY-м. */
  const frameNoRef = useRef(0);
  /** Замок фразы: слово, сколько раз подряд принято, время последнего добавления, была ли пауза. */
  const lockRef = useRef<{ word: string | null; count: number; lastAppend: number; gap: boolean }>({
    word: null, count: 0, lastAppend: 0, gap: true,
  });
  /** Слова фразы — синхронно с collectedWords, чтобы решать без ожидания рендера. */
  const collectedRef = useRef<string[]>([]);
  /** Счётчик частоты MediaPipe: начало секунды и кадров в ней. */
  const fpsRef = useRef<{ t0: number; n: number }>({ t0: 0, n: 0 });

  const [isRunning, setIsRunning] = useState(false);
  const [currentPrediction, setCurrentPrediction] = useState<string | null>(null);
  const [, setConfidence] = useState(0);
  const [topPredictions, setTopPredictions] = useState<{ label: string; confidence: number }[]>([]);
  const [history, setHistory] = useState<{ word: string; confidence: number; time: string }[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [holisticReady, setHolisticReady] = useState(false);
  /** MediaPipe не запустился ни с уточнением лица, ни без него. */
  const [trackerFailed, setTrackerFailed] = useState(false);
  /** Уточнение лица (зрачки, губы) включилось — как на стенде; в Safari без него. */
  const [faceRefine, setFaceRefine] = useState(false);
  // Режим ASL-дактиля: отдельная лёгкая голова A-Z вместо основной модели.
  const [aslMode, setAslMode] = useState(false);
  const aslModeRef = useRef(false);
  const aslRef = useRef<AslDactyl | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  /** Частота MediaPipe за последнюю секунду и видны ли руки — как строка состояния стенда. */
  const [fpsInfo, setFpsInfo] = useState<{ fps: number; hands: boolean } | null>(null);
  const [mirrored, setMirrored] = useState(false);
  const mirroredRef = useRef(false);
  /** Озвучивать каждое принятое слово — на стенде включено по умолчанию. */
  const [autoSpeak, setAutoSpeak] = useState(true);
  const autoSpeakRef = useRef(true);
  const [debugMode, setDebugMode] = useState(false);

  // New: word chips accumulator + locking-in indicator
  const [collectedWords, setCollectedWords] = useState<string[]>([]);
  /**
   * Top-5 на момент коммита — ряд чипов-кандидатов под фразой. Модель часто
   * видит верное слово, но не ставит его первым: тап по чипу заменяет
   * последнее слово фразы — из «угадала или нет» получается «выбери за один
   * тап». Выбранный вариант подсвечен; тап по другому — переключение.
   */
  const [altChoices, setAltChoices] = useState<{ label: string; confidence: number }[]>([]);
  const [lockingWord, setLockingWord] = useState<string | null>(null);
  const [lockingProgress, setLockingProgress] = useState(0); // 0..1
  const [activeStage, setActiveStage] = useState<'hand' | 'emotion' | 'llm' | 'voice'>('hand');

  const { speak, cancel: cancelSpeech, isSpeaking, supported: ttsSupported } = useSpeech();
  const speakRef = useRef(speak);
  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  const { predict, isLoaded, isLoading, error, labels, numClasses, featuresPerFrame, progress, labelMap, idxToLabel } = useSignModel();
  /**
   * Три сети весят ~21 МБ: без процента «Loading» читается как «зависло».
   * Пока прогресс нулевой (идут заголовки, отдача ещё не началась) процент не
   * пишем — «0%» выглядит хуже, чем просто «Loading».
   */
  const percent = Math.round(progress * 100);
  const loadingLabel = percent > 0 ? `${t('common.loading')} ${percent}%` : t('common.loading');
  const signLabels = labels.filter((l) => l !== 'no_event');

  // Keep predict ref in sync
  useEffect(() => {
    predictRef.current = predict;
  }, [predict]);

  // Keep mirrored / autoSpeak / phrase refs in sync with state
  useEffect(() => {
    mirroredRef.current = mirrored;
  }, [mirrored]);
  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
  }, [autoSpeak]);
  useEffect(() => {
    collectedRef.current = collectedWords;
  }, [collectedWords]);

  const idxToLabelRef = useRef<Record<number, string>>({});
  useEffect(() => {
    idxToLabelRef.current = idxToLabel;
  }, [idxToLabel]);

  // Model card stats from <base>/model_config.json (optional)
  const [modelConfig, setModelConfig] = useState<{ accuracy?: number; architecture?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${QYRAN_MODEL.base}/model_config.json`)
      .then(r => (r.ok ? r.json() : null))
      .then(cfg => {
        if (!cancelled && cfg && typeof cfg === 'object') setModelConfig(cfg);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Extract landmarks from MediaPipe results
  const extractLandmarks = useCallback((results: any): number[] => {
    const frame = new Array(FEATURES).fill(0);
    let offset = 0;
    const flip = mirroredRef.current;
    const fx = (x: number) => (flip ? 1 - x : x);

    // 1. Pose (33 * 3 = 99)
    if (results.poseLandmarks) {
      for (let i = 0; i < NUM_POSE; i++) {
        const lm = results.poseLandmarks[i];
        if (lm) {
          frame[offset + i * 3] = fx(lm.x);
          frame[offset + i * 3 + 1] = lm.y;
          frame[offset + i * 3 + 2] = lm.z;
        }
      }
    }
    offset += NUM_POSE * 3;

    // 2. Face key landmarks (10 * 3 = 30)
    if (results.faceLandmarks) {
      for (let i = 0; i < FACE_KEY_INDICES.length; i++) {
        const idx = FACE_KEY_INDICES[i];
        const lm = results.faceLandmarks[idx];
        if (lm) {
          frame[offset + i * 3] = fx(lm.x);
          frame[offset + i * 3 + 1] = lm.y;
          frame[offset + i * 3 + 2] = lm.z;
        }
      }
    }
    offset += NUM_FACE_KEY * 3;

    // 3. Left hand (21 * 3 = 63) — when mirroring, swap left↔right hands
    const leftHand = flip ? results.rightHandLandmarks : results.leftHandLandmarks;
    if (leftHand) {
      for (let i = 0; i < NUM_HAND; i++) {
        const lm = leftHand[i];
        if (lm) {
          frame[offset + i * 3] = fx(lm.x);
          frame[offset + i * 3 + 1] = lm.y;
          frame[offset + i * 3 + 2] = lm.z;
        }
      }
    }
    offset += NUM_HAND * 3;

    // 4. Right hand (21 * 3 = 63) — when mirroring, swap left↔right hands
    const rightHand = flip ? results.leftHandLandmarks : results.rightHandLandmarks;
    if (rightHand) {
      for (let i = 0; i < NUM_HAND; i++) {
        const lm = rightHand[i];
        if (lm) {
          frame[offset + i * 3] = fx(lm.x);
          frame[offset + i * 3 + 1] = lm.y;
          frame[offset + i * 3 + 2] = lm.z;
        }
      }
    }

    return frame;
  }, []);

  /** Сбросить замок фразы и индикатор — после старта, стопа, смены режима. */
  const resetDecision = useCallback(() => {
    lockRef.current = { word: null, count: 0, lastAppend: lockRef.current.lastAppend, gap: true };
    setLockingWord(null);
    setLockingProgress(0);
  }, []);

  // Одно предсказание — как predict() + renderBars() + updateSentence() стенда:
  // последние 60 кадров → признаки → ансамбль → решение по сырым вероятностям.
  const runPrediction = useCallback(async () => {
    // В режиме ASL основная модель молчит — работает ASL-тикер ниже.
    if (aslModeRef.current) return;
    if (!isRunningRef.current || inFlightRef.current || !predictRef.current) return;
    const buf = framesBufferRef.current;
    if (buf.length < SEQ_LEN) return;
    const frames = buf.slice(-SEQ_LEN).map((e) => e.frame);

    inFlightRef.current = true;
    try {
      const result = await predictRef.current(featurizeWindow(frames));
      if (!result || !isRunningRef.current) return;

      const probs = result.probs;
      const i2l = idxToLabelRef.current;
      const order = Array.from(probs, (_, i) => i).sort((a, b) => probs[b] - probs[a]);
      const top = order.slice(0, 5).map((i) => ({ label: i2l[i] || `class_${i}`, confidence: probs[i] }));
      setTopPredictions(top);

      // Порог стенда: абсолютный 0.5 был подобран под 54 класса; при 240
      // классах softmax редко даёт больше 0.3 даже на верном ответе. Поэтому
      // top-1 ≥ ACCEPT_P и отрыв от второго места (любого, включая no_event).
      const best = order[0];
      const pBest = probs[best];
      const pSecond = order.length > 1 ? probs[order[1]] : 0;
      const label = i2l[best] || `class_${best}`;
      const isSign = label !== 'no_event' && pBest >= ACCEPT_P && pBest >= ACCEPT_RATIO * Math.max(pSecond, 1e-6);

      const lock = lockRef.current;
      if (!isSign) {
        // нет жеста — сброс замка; пауза разрешает повторить то же слово
        lock.word = null;
        lock.count = 0;
        lock.gap = true;
        setLockingWord(null);
        setLockingProgress(0);
        setCurrentPrediction(null);
        setConfidence(0);
        return;
      }

      if (label === lock.word) lock.count += 1;
      else { lock.word = label; lock.count = 1; }
      setLockingWord(label);
      setLockingProgress(Math.min(lock.count / LOCK_REPEATS, 1));
      if (lock.count < LOCK_REPEATS) return;

      const now = Date.now();
      if (now - lock.lastAppend < COOLDOWN_MS) return;
      const words = collectedRef.current;
      if (words[words.length - 1] === label && !lock.gap) return; // то же слово без паузы — дубль

      const next = [...words, label];
      collectedRef.current = next;
      setCollectedWords(next);
      lock.lastAppend = now;
      lock.count = 0;
      lock.gap = false;
      // top-5 в момент коммита — кандидаты на замену последнего слова
      setAltChoices(top.filter((c) => c.label !== 'no_event'));
      setCurrentPrediction(label);
      setConfidence(pBest);
      setHistory(prev => [
        { word: label, confidence: pBest, time: new Date().toLocaleTimeString() },
        ...prev.slice(0, 9),
      ]);
      setLockingWord(null);
      setLockingProgress(0);
      if (autoSpeakRef.current) speakRef.current(label);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  // Initialize MediaPipe Holistic ONCE
  useEffect(() => {
    let cancelled = false;

    const onResults = (results: any) => {
      if (!isRunningRef.current) return;
      const now = performance.now();

      // Частота MediaPipe раз в секунду — на слабом ноутбуке окно из 60 кадров
      // растягивается во времени, и об этом надо сказать, а не молчать.
      const f = fpsRef.current;
      if (!f.t0) f.t0 = now;
      f.n += 1;
      if (now - f.t0 >= 1000) {
        setFpsInfo({ fps: (f.n * 1000) / (now - f.t0), hands: !!(results.leftHandLandmarks || results.rightHandLandmarks) });
        f.t0 = now;
        f.n = 0;
      }

      // Стабилизатор считаем всегда (чтобы фильтры не «холодели») — для картинки;
      // модель видит сырые точки (STABILIZE_MODEL_INPUT), как при обучении и на стенде.
      const s = stabilizerRef.current!.update(results, now);
      const buf = framesBufferRef.current;
      buf.push({ t: now, frame: Float32Array.from(extractLandmarks(STABILIZE_MODEL_INPUT ? s.results : results)) });
      if (buf.length > BUFFER_MAX) buf.splice(0, SEQ_LEN);
      setFrameCount(Math.min(buf.length, SEQ_LEN));
      frameNoRef.current += 1;
      if (buf.length >= SEQ_LEN && frameNoRef.current % PRED_EVERY === 0) void runPrediction();

      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video) {
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        // размер меняем только при смене — присваивание width сбрасывает холст
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) drawSkeleton(ctx, s, faceDrawRef.current);
      }
    };

    async function initHolistic() {
      try {
        // @ts-ignore - MediaPipe loaded via npm
        const { Holistic } = await import('@mediapipe/holistic');

        const make = (refine: boolean) => {
          const holistic = new Holistic({
            locateFile: (file: string) => `${HOLISTIC_CDN}/${file}`,
          });
          holistic.setOptions({
            modelComplexity: 1,
            // Своё сглаживание MediaPipe выключено, как на стенде: картинку
            // сглаживает landmarkStabilizer, два фильтра подряд только добавляют лаг.
            smoothLandmarks: false,
            refineFaceLandmarks: refine,
            minDetectionConfidence: 0.3,
            minTrackingConfidence: 0.3,
          });
          holistic.onResults(onResults);
          return holistic;
        };

        // Как на стенде: сначала с уточнением лица, но с таймаутом и откатом —
        // Safari на уточнении (attention-модель лица) зависает, там сразу без него.
        const tryInit = async (refine: boolean, ms: number) => {
          const holistic = make(refine);
          const ok = await Promise.race([
            holistic.initialize().then(() => true).catch((e: unknown) => { console.error('[Qyran] Holistic init:', e); return false; }),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
          ]);
          if (!ok) {
            holistic.close().catch(() => {});
            return null;
          }
          return { holistic, refine };
        };

        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent);
        let got = isSafari ? null : await tryInit(true, 25000);
        if (!got && !cancelled) got = await tryInit(false, 40000);

        if (cancelled) {
          got?.holistic.close().catch(() => {});
          return;
        }
        if (!got) {
          setTrackerFailed(true);
          return;
        }
        holisticRef.current = got.holistic;
        setFaceRefine(got.refine);
        setHolisticReady(true);
        console.log(`[Qyran] MediaPipe Holistic initialized (refineFaceLandmarks: ${got.refine})`);
      } catch (err: any) {
        console.error('[Qyran] Holistic init error:', err);
        if (!cancelled) setTrackerFailed(true);
      }
    }

    initHolistic();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Camera processing loop — sends frames to Holistic
  useEffect(() => {
    if (!isRunning || !holisticRef.current || !videoRef.current) return;

    let running = true;

    async function processFrame() {
      if (!running || !videoRef.current || !holisticRef.current) return;
      if (videoRef.current.readyState >= 2) {
        const now = performance.now();
        if (now - lastSendAtRef.current >= SEND_MIN_INTERVAL_MS) {
          lastSendAtRef.current = now;
          try {
            await holisticRef.current.send({ image: videoRef.current });
          } catch (e) {
            // Ignore send errors during teardown
          }
        }
      }
      if (running) {
        animFrameRef.current = requestAnimationFrame(processFrame);
      }
    }

    processFrame();

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRunning, cameraReady, holisticReady]);

  // Синхронизация режима ASL + ленивая загрузка головы при первом включении.
  useEffect(() => {
    aslModeRef.current = aslMode;
    aslRef.current?.reset();
    if (aslMode && !aslRef.current) {
      AslDactyl.load()
        .then((m) => { aslRef.current = m; })
        .catch((e) => console.error('ASL model load failed', e));
    }
    // Смена режима сбрасывает решающее состояние основной модели.
    resetDecision();
    setCurrentPrediction(null);
    setTopPredictions([]);
  }, [aslMode, resetDecision]);

  // ASL-тикер: буквы решаются чаще слов (~7 раз/с) — конфигурация статична,
  // окно в 60 кадров не нужно, берём последний свежий кадр.
  useEffect(() => {
    if (!isRunning || !aslMode) return;
    const id = window.setInterval(() => {
      const asl = aslRef.current;
      const buf = framesBufferRef.current;
      if (!asl || buf.length === 0) return;
      const last = buf[buf.length - 1];
      if (performance.now() - last.t > 500) return; // кадр протух — камера стоит
      const r = asl.tick(last.frame);
      if (!r) {
        setLockingWord(null);
        setLockingProgress(0);
        setCurrentPrediction(null);
        setConfidence(0);
        return;
      }
      setTopPredictions(r.top);
      setLockingWord(r.letter);
      setLockingProgress(r.progress);
      if (r.committed === 'DEL') {
        setCollectedWords((prev) => prev.slice(0, -1));
      } else if (r.committed) {
        const letter = r.committed;
        setCollectedWords((prev) => [...prev, letter]);
        setCurrentPrediction(letter);
        setConfidence(r.confidence);
        setHistory((prev) => [
          { word: letter, confidence: r.confidence, time: new Date().toLocaleTimeString() },
          ...prev.slice(0, 9),
        ]);
      }
    }, 140);
    return () => window.clearInterval(id);
  }, [isRunning, aslMode]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user', frameRate: { ideal: 30, max: 60 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    // Фильтры и экстраполяция не должны тянуть позу из прошлого сеанса.
    stabilizerRef.current?.reset();
    setCameraReady(false);
  }, []);

  // Toggle recognition
  const toggleRecognition = useCallback(async () => {
    if (isRunning) {
      isRunningRef.current = false;
      setIsRunning(false);
      stopCamera();
      framesBufferRef.current = [];
      setFrameCount(0);
      setFpsInfo(null);
      resetDecision();
      inFlightRef.current = false;
      // Остановленная камера — пустой экран, а не последний кадр скелета.
      const canvas = canvasRef.current;
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      await startCamera();
      stabilizerRef.current?.reset();
      faceDrawRef.current.prev = null;
      framesBufferRef.current = [];
      frameNoRef.current = 0;
      fpsRef.current = { t0: 0, n: 0 };
      setFrameCount(0);
      setCurrentPrediction(null);
      resetDecision();
      inFlightRef.current = false;
      lastSendAtRef.current = 0;
      isRunningRef.current = true;
      setIsRunning(true);
    }
  }, [isRunning, startCamera, stopCamera, resetDecision]);

  // Speak the collected sentence
  const speakSentence = useCallback(() => {
    if (collectedWords.length === 0) return;
    speak(collectedWords.join(' '));
  }, [collectedWords, speak]);

  const clearChips = useCallback(() => {
    cancelSpeech();
    collectedRef.current = [];
    setCollectedWords([]);
    setAltChoices([]);
    lockRef.current = { word: null, count: 0, lastAppend: 0, gap: true };
    setLockingWord(null);
    setLockingProgress(0);
  }, [cancelSpeech]);

  const removeChip = useCallback((index: number) => {
    setCollectedWords(prev => {
      if (index === prev.length - 1) setAltChoices([]);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  /** Тап по кандидату: заменить ПОСЛЕДНЕЕ слово фразы выбранным. */
  const pickAlt = useCallback((label: string) => {
    setCollectedWords(prev =>
      prev.length ? [...prev.slice(0, -1), label] : prev);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      stopCamera();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [stopCamera]);

  return (
    <div className="qyran-app">
      <header className="topbar">
        <div className="shell topbar-inner">
          <button className="iconbtn" aria-label={t('common.back')} onClick={onBack} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span className="brand-q">Q</span>
            <span className="title-row">
              <span className="page-title">{t('recognizer.page.title')}</span>
              <span className="page-sub mono">/ {t('recognizer.page.sub')}</span>
            </span>
          </div>
          <div className="spacer" />
          <span className={`pill ${isRunning ? 'alive' : ''}`} aria-live="polite">
            <span className="dot" />
            <span>
              {error || trackerFailed ? t('common.error')
                : isLoaded && holisticReady ? (isRunning ? t('recognizer.status.recording') : t('common.ready'))
                : isLoading ? `${loadingLabel}…`
                : `${t('common.loading')}…`}
            </span>
          </span>
          <ThemeToggle compact />
          <LangSwitcher />
        </div>
      </header>

      <main className="shell" style={{ paddingTop: 36, paddingBottom: 80 }}>
        <section style={{ marginBottom: 28 }}>
          <span className="eyebrow" style={{ display: 'inline-block', marginBottom: 14 }}>{t('recognizer.hero.eyebrow')}</span>
          <h1 className="page-h1">{t('recognizer.hero.title')} <span className="dim">{t('recognizer.hero.titleDim')}</span></h1>
        </section>

        <div className="rec-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24 }}>
          <style>{`@media (max-width: 960px) { .rec-grid { grid-template-columns: 1fr !important; } }`}</style>

          {/* Camera Panel */}
          <div>
            <div className="card-elev" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: isRunning ? 'var(--accent)' : 'var(--text-mute)', boxShadow: isRunning ? '0 0 10px var(--accent)' : 'none', animation: isRunning ? 'qa-pulse 1.5s ease-in-out infinite' : 'none' }} />
                  <span style={{ fontWeight: 500, fontSize: 14 }}>
                    {isRunning ? t('recognizer.camera.recording') : t('recognizer.camera.off')}
                  </span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="mono mute" style={{ fontSize: 11 }}>{frameCount}/{SEQ_LEN}</span>
                  {isLoaded && holisticReady && !error && (<span className="tag gold">● {t('common.ready')}</span>)}
                  {isLoading && (<span className="tag amber">○ {t('recognizer.tag.model')}{percent > 0 ? ` ${percent}%` : ''}</span>)}
                  {!holisticReady && !trackerFailed && !isLoading && !error && (<span className="tag amber">○ MediaPipe</span>)}
                  {(error || trackerFailed) && (
                    <span
                      className="tag"
                      style={{
                        color: 'var(--danger)',
                        borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)',
                        background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
                      }}
                      title={error || t('recognizer.tracker.failed')}
                    >
                      ● {t('common.error')}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ position: 'relative', aspectRatio: '16/9', background: isRunning ? SKELETON_BG : 'var(--surface-2)' }}>
                {/* Скелет рисуется как видит себя человек — зеркально, как на стенде;
                    на вход модели это не влияет (там своя кнопка «Зеркало»). */}
                <canvas
                  ref={canvasRef}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)' }}
                />
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{
                    position: 'absolute', right: 10, bottom: 10, width: 128, height: 96, zIndex: 15,
                    objectFit: 'cover', borderRadius: 8, background: '#000', border: '1px solid #30363d',
                    transform: 'scaleX(-1)', opacity: 0.85, display: isRunning ? 'block' : 'none',
                  }}
                />

                {!isRunning && !error && !trackerFailed && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="14" height="12" rx="2"/><path d="M17 10l4-2v8l-4-2"/></svg>
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 16 }}>{t('recognizer.camera.off')}</div>
                      <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>
                        {t('recognizer.camera.hintBefore')}
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{t('recognizer.controls.start')}</span>
                        {t('recognizer.camera.hintAfter')}
                      </div>
                    </div>
                  </div>
                )}

                {!isRunning && (error || trackerFailed) && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: 999, background: 'color-mix(in srgb, var(--danger) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <div style={{ maxWidth: 420 }}>
                      <div style={{ fontWeight: 500, color: 'var(--danger)' }}>{t('recognizer.error.title')}</div>
                      <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>{error || t('recognizer.tracker.failed')}</div>
                      <button onClick={() => window.location.reload()} className="btn btn-ghost" style={{ marginTop: 14, fontSize: 13 }}>
                        {t('recognizer.error.reload')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Word chips overlay */}
                {isRunning && collectedWords.length > 0 && (
                  <div style={{ position: 'absolute', top: 14, left: 14, right: 14, zIndex: 20, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {collectedWords.map((word, i) => (
                      <button
                        key={`${word}-${i}`}
                        onClick={() => removeChip(i)}
                        title={t('recognizer.chip.remove')}
                        className="mono"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '6px 12px', borderRadius: 999,
                          background: 'var(--warm-soft)',
                          border: '1px solid var(--warm-line)',
                          color: 'var(--warm)', fontSize: 12, fontWeight: 600,
                          letterSpacing: '0.06em', textTransform: 'uppercase',
                          cursor: 'pointer', backdropFilter: 'blur(8px)',
                        }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor', boxShadow: '0 0 6px currentColor' }} />
                        {word}
                      </button>
                    ))}
                    <button
                      onClick={clearChips}
                      title={t('recognizer.chips.clearAll')}
                      className="mono"
                      style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 999, background: 'color-mix(in srgb, var(--bg) 70%, transparent)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', backdropFilter: 'blur(8px)' }}
                    >
                      {t('recognizer.chips.clear')}
                    </button>
                  </div>
                )}

                {/* Top-5 кандидаты: тап заменяет последнее слово фразы */}
                {isRunning && altChoices.length > 0 && collectedWords.length > 0 && (
                  <div style={{ position: 'absolute', top: 60, left: 14, right: 14, zIndex: 20, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 8px', background: 'color-mix(in srgb, var(--bg) 70%, transparent)', borderRadius: 999, backdropFilter: 'blur(8px)' }}>
                      {t('recognizer.alt.title')}
                    </span>
                    {altChoices.map(({ label, confidence }) => {
                      const active = collectedWords[collectedWords.length - 1] === label;
                      return (
                        <button
                          key={label}
                          onClick={() => pickAlt(label)}
                          className="mono"
                          style={{
                            padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                            letterSpacing: '0.04em', cursor: 'pointer', backdropFilter: 'blur(8px)',
                            background: active ? 'var(--accent-soft)' : 'color-mix(in srgb, var(--bg) 70%, transparent)',
                            border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                            color: active ? 'var(--accent)' : 'var(--text-dim)',
                          }}
                        >
                          {label} <span style={{ opacity: 0.6 }}>{Math.round(confidence * 100)}%</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Locking-in indicator */}
                {isRunning && lockingWord && lockingProgress > 0 && lockingProgress < 1 && (
                  <div style={{ position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 20, padding: '14px 22px', background: 'color-mix(in srgb, var(--bg) 85%, transparent)', backdropFilter: 'blur(12px)', borderRadius: 'var(--r-card)', border: '1px solid var(--accent-line)', boxShadow: 'var(--shadow-glow)', minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 8 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: 'var(--text)', fontSize: 18, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{lockingWord}</div>
                        <div className="mono" style={{ color: 'var(--accent)', fontSize: 10, marginTop: 4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                          {t('recognizer.locking.progress', { percent: (lockingProgress * 100).toFixed(0) })}
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 3, background: 'color-mix(in srgb, var(--text) 12%, transparent)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${lockingProgress * 100}%`, background: 'var(--grad-brand)', borderRadius: 999, transition: 'width 0.15s ease' }} />
                    </div>
                  </div>
                )}

                {/* Just-locked confirmation */}
                {isRunning && currentPrediction && !lockingWord && (
                  <div style={{ position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 20, padding: '12px 20px', background: 'var(--accent)', borderRadius: 'var(--r-card)', boxShadow: 'var(--shadow-glow)' }}>
                    <p style={{ color: 'var(--bg)', fontSize: 16, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>✓ {currentPrediction}</p>
                  </div>
                )}

                {/* Empty state */}
                {isRunning && !currentPrediction && !lockingWord && collectedWords.length === 0 && (
                  <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 10, padding: '8px 16px', background: 'color-mix(in srgb, var(--bg) 80%, transparent)', backdropFilter: 'blur(8px)', borderRadius: 999, border: '1px solid var(--border)' }}>
                    <p className="dim" style={{ fontSize: 13, margin: 0 }}>{t('recognizer.hint.showSign')}</p>
                  </div>
                )}

                {/* DEBUG: top-3 candidates */}
                {isRunning && debugMode && topPredictions.length > 0 && (
                  <div style={{ position: 'absolute', top: 56, left: 14, right: 14, background: 'color-mix(in srgb, var(--bg) 85%, transparent)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: 14, border: '1px solid var(--border)', zIndex: 30 }}>
                    <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--accent)' }}>{t('recognizer.debug.title')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {topPredictions.slice(0, 3).map((pred, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                          <span className="mono" style={{ width: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: i === 0 ? 'var(--text)' : 'var(--text-dim)', fontWeight: 500 }}>{pred.label}</span>
                          <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${pred.confidence * 100}%`,
                                background: pred.confidence > 0.7 ? 'var(--warm)' : pred.confidence > 0.4 ? 'var(--accent)' : 'var(--text-mute)',
                                borderRadius: 999,
                              }}
                            />
                          </div>
                          <span className="mono mute" style={{ width: 40, textAlign: 'right', fontSize: 11 }}>
                            {(pred.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Строка состояния, как на стенде: частота MediaPipe и видны ли руки */}
              {isRunning && fpsInfo && (
                <div className="mono" style={{ padding: '8px 18px', fontSize: 12, borderTop: '1px solid var(--border-soft)', color: 'var(--text-dim)' }}>
                  <span style={{ color: fpsInfo.fps >= 15 ? 'var(--accent)' : 'var(--danger)', fontWeight: 600 }}>
                    {t('recognizer.fps', { fps: Math.round(fpsInfo.fps) })}
                  </span>
                  {fpsInfo.fps < FPS_LOW && <> · {t('recognizer.fps.low')}</>}
                  {!fpsInfo.hands && <> · {t('recognizer.hands.none')}</>}
                </div>
              )}

              {/* Pipeline tabs */}
              <div style={{ padding: '14px 14px 6px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {PIPELINE_STAGES.map(stage => {
                  const active = activeStage === stage.id;
                  const isOff = !stage.enabled;
                  return (
                    <button
                      key={stage.id}
                      onClick={() => stage.enabled && setActiveStage(stage.id as any)}
                      disabled={isOff}
                      style={{
                        position: 'relative',
                        padding: '12px 8px',
                        borderRadius: 10,
                        border: '1px solid',
                        borderColor: active && stage.enabled ? 'var(--accent-line)' : 'var(--border)',
                        background: active && stage.enabled ? 'var(--accent-soft)' : 'var(--bg-elev)',
                        color: isOff ? 'var(--text-mute)' : active && stage.enabled ? 'var(--text)' : 'var(--text-dim)',
                        textAlign: 'center',
                        cursor: isOff ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                        opacity: isOff ? 0.5 : 1,
                        transition: 'all .2s',
                      }}
                    >
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{stage.icon}</div>
                      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t(stage.labelKey)}</div>
                      {isOff && (
                        <span className="mono" style={{ position: 'absolute', top: 4, right: 4, fontSize: 8, color: 'var(--accent)', opacity: 0.7, padding: '1px 4px', background: 'var(--accent-soft)', borderRadius: 3 }}>{t('recognizer.stage.soon')}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Speak / Sentence panel */}
              {collectedWords.length > 0 && (
                <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div className="eyebrow" style={{ marginBottom: 4 }}>{t('recognizer.sentence.title')}</div>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>{collectedWords.join(' ')}</p>
                  </div>
                  <button
                    onClick={isSpeaking ? cancelSpeech : speakSentence}
                    disabled={!ttsSupported}
                    className={isSpeaking ? 'btn btn-danger' : 'btn btn-brand'}
                    title={ttsSupported ? '' : t('recognizer.speak.unsupported')}
                  >
                    {isSpeaking ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                        {t('recognizer.speak.stop')}
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                        </svg>
                        {t('recognizer.speak.speak')}
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Controls */}
              <div style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--border-soft)' }}>
                <button
                  onClick={toggleRecognition}
                  disabled={!isLoaded || !holisticReady || !!error}
                  className={isRunning ? 'btn btn-danger' : 'btn btn-brand'}
                  style={{ padding: '14px 28px', fontSize: 15 }}
                >
                  {isRunning ? t('recognizer.controls.stop') : t('recognizer.controls.start')}
                </button>
                <button
                  onClick={() => setMirrored(m => !m)}
                  className="btn btn-ghost"
                  style={mirrored ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-line)', color: 'var(--accent)' } : undefined}
                  title={t('recognizer.mirror.hint')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                  </svg>
                  {t('recognizer.mirror.label')}: {mirrored ? t('recognizer.toggle.on') : t('recognizer.toggle.off')}
                </button>
                <button
                  onClick={() => setAutoSpeak(a => !a)}
                  className="btn btn-ghost"
                  style={autoSpeak ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-line)', color: 'var(--accent)' } : undefined}
                  title={t('recognizer.autoSpeak.hint')}
                >
                  {t('recognizer.autoSpeak.label')}: {autoSpeak ? t('recognizer.toggle.on') : t('recognizer.toggle.off')}
                </button>
                <button
                  onClick={() => setAslMode(a => !a)}
                  className="btn btn-ghost"
                  style={aslMode ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-line)', color: 'var(--accent)' } : undefined}
                  title={t('recognizer.asl.hint')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 11V6a2 2 0 0 1 4 0v5m0-3a2 2 0 0 1 4 0v3m0-1a2 2 0 0 1 4 0v4a7 7 0 0 1-7 7h-1a7 7 0 0 1-7-7v-2a2 2 0 0 1 3-1.7"/>
                  </svg>
                  {t('recognizer.asl.label')}: {aslMode ? t('recognizer.toggle.on') : t('recognizer.toggle.off')}
                </button>
                <button
                  onClick={() => setDebugMode(d => !d)}
                  className="btn btn-ghost"
                  style={debugMode ? { background: 'var(--warm-soft)', borderColor: 'var(--warm-line)', color: 'var(--warm)' } : undefined}
                  title={t('recognizer.debug.hint')}
                >
                  {t('recognizer.debug.label')}: {debugMode ? t('recognizer.toggle.on') : t('recognizer.toggle.off')}
                </button>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Model info */}
            <div className="panel">
              <div className="panel-head">
                <div className="panel-h"><span className="num">i</span>{t('recognizer.model.title')}</div>
                <span className={`tag ${isLoaded ? 'gold' : 'amber'}`}>{isLoaded ? t('common.ready') : isLoading ? loadingLabel : error ? t('common.error') : t('recognizer.model.waiting')}</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{t('recognizer.model.qyran240')}</div>
              <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>{t('recognizer.model.qyran240.hint')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                {[
                  { k: t('recognizer.model.classes'), v: String(numClasses - (labelMap['no_event'] !== undefined ? 1 : 0)) },
                  { k: t('recognizer.model.architecture'), v: modelConfig?.architecture || 'Conv1D + BiLSTM' },
                  { k: t('recognizer.model.features'), v: `${featuresPerFrame} (Holistic)` },
                  {
                    k: t('recognizer.model.tracker'),
                    v: holisticReady ? `MediaPipe Holistic${faceRefine ? ` · ${t('recognizer.tracker.refine')}` : ''}` : '…',
                  },
                  ...(typeof modelConfig?.accuracy === 'number'
                    ? [{ k: t('recognizer.model.accuracy'), v: `${+(modelConfig.accuracy <= 1 ? modelConfig.accuracy * 100 : modelConfig.accuracy).toFixed(1)}%` }]
                    : []),
                ].map((row) => (
                  <div key={row.k} className="between" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-soft)' }}>
                    <span className="dim">{row.k}</span>
                    <span className="mono" style={{ color: 'var(--text)' }}>{row.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Available signs */}
            <div className="panel">
              <div className="panel-head">
                <div className="panel-h"><span className="num">{signLabels.length}</span>{t('recognizer.signs.title')}</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {signLabels.map((label) => {
                  const active = currentPrediction === label;
                  return (
                    <span
                      key={label}
                      className="mono"
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 500,
                        border: '1px solid',
                        borderColor: active ? 'var(--accent-line)' : 'var(--border)',
                        background: active ? 'var(--accent-soft)' : 'var(--bg-elev)',
                        color: active ? 'var(--accent)' : 'var(--text-dim)',
                        transition: 'all .2s',
                      }}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* History */}
            <div className="panel">
              <div className="panel-head">
                <div className="panel-h"><span className="num">↻</span>{t('recognizer.history.title')}</div>
                {history.length > 0 && <span className="mono mute" style={{ fontSize: 11 }}>{history.length}</span>}
              </div>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p className="dim" style={{ fontSize: 13, margin: 0 }}>
                    {isRunning ? t('recognizer.history.emptyRunning') : t('recognizer.history.emptyIdle')}
                  </p>
                  <p className="mute" style={{ fontSize: 11, marginTop: 6 }}>
                    {t('recognizer.history.note')}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                  {history.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: 8,
                        background: 'var(--bg-elev)', border: '1px solid var(--border-soft)',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: 14 }}>{item.word}</span>
                        <span className="mono mute" style={{ fontSize: 11, marginLeft: 10 }}>{item.time}</span>
                      </div>
                      <span className="mono" style={{ color: 'var(--warm)', fontSize: 12 }}>
                        {(item.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

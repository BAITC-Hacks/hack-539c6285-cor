import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSignModel, SIGN_MODELS, DEFAULT_SIGN_MODEL, type SignModelId } from '@/hooks/useSignModel';
import { AslDactyl } from '@/lib/aslDactyl';
import { useSpeech } from '@/hooks/useSpeech';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { drawTrackedSkeleton, type OverlayState } from '@/lib/skeletonOverlay';
import { HolisticStabilizer, DEFAULT_CONFIG, type StabilizerConfig, type StabilizedSet } from '@/lib/landmarkStabilizer';
// @ts-ignore - constants are not in TS types
import { POSE_CONNECTIONS, FACEMESH_TESSELATION, HAND_CONNECTIONS } from '@mediapipe/holistic';
import { normalizeWindow, featurizeWindow, resampleWindow, BASE_DIM, OUT_DIM } from '@/lib/features';
import { useT } from '@/i18n';
import { useTheme } from '@/app/context/ThemeContext';
import { ThemeToggle } from '@/app/components/shared/ThemeToggle';
import { LangSwitcher } from '@/app/components/shared/LangSwitcher';

// MediaPipe Holistic key face indices (same as training)
const FACE_KEY_INDICES = [0, 13, 14, 61, 291, 33, 263, 159, 386, 152];
const NUM_POSE = 33;
const NUM_FACE_KEY = 10;
const NUM_HAND = 21;
const FEATURES = 255; // (33 + 10 + 21 + 21) * 3 — raw MediaPipe vector per frame
const SEQ_LEN = 60;

// Wall-clock capture / prediction cadence (frame-rate independent)
const SEND_MIN_INTERVAL_MS = 33;   // throttle holistic.send to ~30 fps max
const BUFFER_MS = 2500;            // rolling landmark buffer horizon
const WINDOW_MS = 2000;            // model window duration
const PREDICT_INTERVAL_MS = 500;   // prediction tick period

// EMA smoothing over full probability vectors + decision thresholds.
//
// Значения ИЗМЕРЕНЫ симуляцией боевого конвейера на 1652 клипах невиданных
// подписантов (ml/simulate_app.py — окно, тики, EMA и пороги повторены один в
// один). Прежняя пара EMA_KEEP=0.65 + COMMIT_THRESHOLD=0.65 давала МОЛЧАНИЕ на
// 79% знаков: за ~1.5 c знака EMA не успевала доползти до порога, и ответ не
// появлялся вообще. Текущая точка: верный коммит 46% знаков, молчание 19%,
// медианная задержка 3.0 с, ложные на тишине ~3/мин. Дальше точность двигает
// только модель/словарь (?vocab=...), не пороги.
const EMA_KEEP = 0.35;             // быстрое сглаживание: s = 0.35*s + 0.65*p
const DISPLAY_THRESHOLD = 0.40;    // show candidate word
const COMMIT_TICKS = 2;            // consecutive qualifying ticks to commit a chip
const NO_EVENT_MAX = 0.35;         // new model: max smoothed no_event to display
const COMMIT_THRESHOLD = 0.45;     // new model: commit level
const REARM_NO_EVENT = 0.5;        // new model: no_event level that re-arms after a commit
const OLD_COMMIT_THRESHOLD = 0.7;  // legacy model (no no_event class): commit level
const CHIP_COOLDOWN_MS = 1500;     // legacy model: cooldown between chips

/**
 * Пороги решения по модели. SLOVO-1001 — числа выше (подобраны симуляцией).
 * Кыран-240 — правило тестового стенда, на котором мерили её точность: на 240
 * классах softmax редко даёт больше 0.3 даже на верном ответе, поэтому слово
 * принимается при top-1 ≥ 0.25, если оно в 1.8 раза выше второго и выше no_event.
 */
const DECISION: Record<SignModelId, { display: number; commit: number; ratio: number; noEventMax: number | 'beat' }> = {
  slovo1001: { display: DISPLAY_THRESHOLD, commit: COMMIT_THRESHOLD, ratio: 1, noEventMax: NO_EVENT_MAX },
  qyran240: { display: 0.25, commit: 0.25, ratio: 1.8, noEventMax: 'beat' },
};

/** Модель при входе: ?model=qyran240|slovo1001 (или qyran|slovo), иначе последний выбор, иначе по умолчанию. */
const SIGN_MODEL_KEY = 'qyran.signModel';
function initialSignModel(): SignModelId {
  const q = new URLSearchParams(window.location.search).get('model');
  const alias: Record<string, SignModelId> = { qyran: 'qyran240', qyran240: 'qyran240', slovo: 'slovo1001', slovo1001: 'slovo1001' };
  if (q && alias[q]) return alias[q];
  try {
    const v = localStorage.getItem(SIGN_MODEL_KEY);
    if (v === 'qyran240' || v === 'slovo1001') return v;
  } catch { /* приватный режим — просто по умолчанию */ }
  return DEFAULT_SIGN_MODEL;
}

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

const PIPELINE_STAGES = [
  { id: 'hand', labelKey: 'recognizer.stage.hand', icon: '✋', enabled: true },
  { id: 'emotion', labelKey: 'recognizer.stage.emotion', icon: '😊', enabled: false },
  { id: 'llm', labelKey: 'recognizer.stage.llm', icon: '✨', enabled: false },
  { id: 'voice', labelKey: 'recognizer.stage.voice', icon: '🔊', enabled: true },
] as const;

/**
 * Краски разметки поверх видео.
 *
 * Canvas принимает только готовую строку цвета, var(--token) в него не
 * передашь, поэтому токены читаем с <html> и держим в ref. Раньше здесь были
 * зашиты жёлтый скелет и белая сетка лица: на светлом кадре белое по белому
 * пропадало полностью.
 */
function readOverlayPaint() {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  return {
    /** Вуаль поверх кадра: в тёмной теме гасит, в светлой засветляет. */
    veil: token('--bg'),
    /** Сетка лица — цветом текста темы, он по определению контрастен фону. */
    face: token('--text'),
    /** Скелет позы — тёплый акцент с логотипа, читается и на светлом кадре. */
    pose: token('--warm'),
  };
}

interface RecognizerPageProps {
  onBack: () => void;
}

export function RecognizerPage({ onBack }: RecognizerPageProps) {
  const t = useT();
  const { theme } = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Память порядка отрисовки кистей — без неё он мерцает при сближении. */
  const overlayStateRef = useRef<OverlayState>({});
  /** Стабилизатор лэндмарков — один на страницу, хранит состояние фильтров между кадрами. */
  const stabilizerRef = useRef<HolisticStabilizer | null>(null);
  if (!stabilizerRef.current) stabilizerRef.current = new HolisticStabilizer({ ...STABILIZER_CONFIG });
  const paintRef = useRef({ veil: '', face: '', pose: '' });
  const holisticRef = useRef<any>(null);
  const framesBufferRef = useRef<{ t: number; frame: Float32Array }[]>([]);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const isRunningRef = useRef(false);
  const predictRef = useRef<typeof predict | null>(null);

  // Wall-clock capture + EMA decision state
  const lastSendAtRef = useRef<number>(0);
  const inFlightRef = useRef(false);
  const smoothedRef = useRef<Float32Array | null>(null);
  const candidateRef = useRef<{ word: number; ticks: number }>({ word: -1, ticks: 0 });
  const blockedWordRef = useRef<number>(-1); // committed word index, blocked until re-armed (new model)
  const lastChipAddedAtRef = useRef<number>(0);

  const [isRunning, setIsRunning] = useState(false);
  const [currentPrediction, setCurrentPrediction] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [topPredictions, setTopPredictions] = useState<{ label: string; confidence: number }[]>([]);
  const [history, setHistory] = useState<{ word: string; confidence: number; time: string }[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [holisticReady, setHolisticReady] = useState(false);
  // Режим ASL-дактиля: отдельная лёгкая голова A-Z вместо основной модели.
  const [aslMode, setAslMode] = useState(false);
  const aslModeRef = useRef(false);
  const aslRef = useRef<AslDactyl | null>(null);
  const [status, setStatus] = useState('Loading model...');
  const [frameCount, setFrameCount] = useState(0);
  const [mirrored, setMirrored] = useState(false);
  const mirroredRef = useRef(false);
  const [debugMode, setDebugMode] = useState(false);

  // New: word chips accumulator + locking-in indicator
  const [collectedWords, setCollectedWords] = useState<string[]>([]);
  /**
   * Top-5 на момент коммита — ряд чипов-кандидатов под фразой.
   *
   * Зачем: честный top-1 модели 60.2%, а top-5 — 87.2%. Модель почти всегда
   * ВИДИТ верное слово, но не всегда ставит его первым. Тап по чипу заменяет
   * последнее слово фразы — из «угадала или нет» получается «выбери за один
   * тап». Выбранный вариант подсвечен; тап по другому — переключение.
   */
  const [altChoices, setAltChoices] = useState<{ label: string; confidence: number }[]>([]);
  const [lockingWord, setLockingWord] = useState<string | null>(null);
  const [lockingProgress, setLockingProgress] = useState(0); // 0..1
  const [activeStage, setActiveStage] = useState<'hand' | 'emotion' | 'llm' | 'voice'>('hand');

  const { speak, cancel: cancelSpeech, isSpeaking, supported: ttsSupported } = useSpeech();

  /**
   * Словарь площадки, `?vocab=counter_lean`.
   *
   * По умолчанию ограничения НЕТ, и это осознанно. Сужение словаря до двух
   * сотен знаков поднимает точность на невиданных подписантах с 58.5% до
   * 80.9% — но только когда показывают знаки ИЗ этого словаря. На публичной
   * демо-странице человек показывает что угодно, и ограничение там сделает
   * хуже: верный ответ окажется вычеркнут. Ограничение включается там, где
   * набор знаков заранее известен: регистратура, ЦОН, отделение банка.
   * Список — public/model/vocabularies.json, измерения — ml/vocab_experiment.py.
   */
  const vocabulary = useMemo(
    () => new URLSearchParams(window.location.search).get('vocab') || undefined,
    [],
  );

  const [signModel, setSignModel] = useState<SignModelId>(initialSignModel);
  useEffect(() => {
    try { localStorage.setItem(SIGN_MODEL_KEY, signModel); } catch { /* ignore */ }
  }, [signModel]);
  const decisionRef = useRef(DECISION[signModel]);
  useEffect(() => {
    decisionRef.current = DECISION[signModel];
    // другая модель — другие классы: сглаживание и кандидаты начинаем заново
    smoothedRef.current = null;
    candidateRef.current = { word: -1, ticks: 0 };
    blockedWordRef.current = -1;
    setTopPredictions([]);
    setLockingWord(null);
    setLockingProgress(0);
  }, [signModel]);

  const { predict, isLoaded, isLoading, error, labels, numClasses, featuresPerFrame, progress, labelMap, idxToLabel, vocabSize } = useSignModel({ vocabulary, model: signModel });
  /**
   * Модель весит ~8 МБ: без процента «Loading» читается как «зависло».
   * Пока прогресс нулевой (идут заголовки, отдача ещё не началась) процент не
   * пишем — «0%» выглядит хуже, чем просто «Loading».
   */
  const percent = Math.round(progress * 100);
  const loadingLabel = percent > 0 ? `${t('common.loading')} ${percent}%` : t('common.loading');

  // Токены темы читаем на следующем кадре: провайдер выставляет data-theme в
  // своём эффекте, а он идёт ПОСЛЕ эффектов детей — без rAF взяли бы старую тему.
  useEffect(() => {
    const id = requestAnimationFrame(() => { paintRef.current = readOverlayPaint(); });
    return () => cancelAnimationFrame(id);
  }, [theme]);

  // Keep predict ref in sync
  useEffect(() => {
    predictRef.current = predict;
  }, [predict]);

  // Keep mirrored ref in sync with state
  useEffect(() => {
    mirroredRef.current = mirrored;
  }, [mirrored]);

  // Keep model metadata refs in sync (used inside the prediction tick)
  const featuresRef = useRef<number>(FEATURES);
  useEffect(() => {
    featuresRef.current = featuresPerFrame;
  }, [featuresPerFrame]);
  const idxToLabelRef = useRef<Record<number, string>>({});
  useEffect(() => {
    idxToLabelRef.current = idxToLabel;
  }, [idxToLabel]);
  const noEventIdxRef = useRef(-1);
  useEffect(() => {
    noEventIdxRef.current = typeof labelMap['no_event'] === 'number' ? labelMap['no_event'] : -1;
  }, [labelMap]);

  // Model card stats from <base>/model_config.json (optional)
  const [modelConfig, setModelConfig] = useState<{ accuracy?: number; architecture?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setModelConfig(null);
    fetch(`${SIGN_MODELS[signModel].base}/model_config.json`)
      .then(r => (r.ok ? r.json() : null))
      .then(cfg => {
        if (!cancelled && cfg && typeof cfg === 'object') setModelConfig(cfg);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [signModel]);

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

  // One prediction tick (wall-clock driven): resample the rolling landmark
  // buffer to a fixed 60-frame window, run inference, update EMA-smoothed
  // probabilities and the display/commit decision state.
  const predictionTick = useCallback(async () => {
    // В режиме ASL основная модель молчит — работает ASL-тикер ниже.
    if (aslModeRef.current) return;
    if (!isRunningRef.current || inFlightRef.current || !predictRef.current) return;

    const frames = resampleWindow(framesBufferRef.current, performance.now(), WINDOW_MS, SEQ_LEN);
    if (!frames) return; // not enough recent frames yet

    inFlightRef.current = true;
    try {
      // v2 (319): канонизация + реляционный блок; v1 (259): только канонизация;
      // legacy (255): сырые кадры (скейлер применяется внутри хука).
      let flat: Float32Array;
      if (featuresRef.current === OUT_DIM) {
        flat = featurizeWindow(frames);
      } else if (featuresRef.current === BASE_DIM) {
        flat = normalizeWindow(frames);
      } else {
        flat = new Float32Array(SEQ_LEN * FEATURES);
        for (let i = 0; i < frames.length; i++) flat.set(frames[i], i * FEATURES);
      }

      const result = await predictRef.current(flat);
      if (!result || !isRunningRef.current) return;

      // EMA over the full probability vector
      const probs = result.probs;
      let s = smoothedRef.current;
      if (!s || s.length !== probs.length) {
        s = Float32Array.from(probs);
        smoothedRef.current = s;
      } else {
        for (let i = 0; i < s.length; i++) s[i] = EMA_KEEP * s[i] + (1 - EMA_KEEP) * probs[i];
      }

      // Top-5 side panel from smoothed probabilities
      const i2l = idxToLabelRef.current;
      const indexed = Array.from(s).map((p, i) => ({ idx: i, prob: p }));
      indexed.sort((a, b) => b.prob - a.prob);
      setTopPredictions(indexed.slice(0, 5).map(({ idx, prob }) => ({
        label: i2l[idx] || `class_${idx}`,
        confidence: prob,
      })));

      const noEventIdx = noEventIdxRef.current;
      const hasNoEvent = noEventIdx >= 0 && noEventIdx < s.length;

      // Argmax (excluding no_event when the model has that class) + второе место для правила отрыва
      let word = -1;
      let best = -Infinity;
      let second = 0;
      for (let i = 0; i < s.length; i++) {
        if (hasNoEvent && i === noEventIdx) continue;
        if (s[i] > best) { second = Math.max(second, best); best = s[i]; word = i; }
        else if (s[i] > second) second = s[i];
      }
      if (word < 0) return;
      const label = i2l[word] || `class_${word}`;
      const noEv = hasNoEvent ? s[noEventIdx] : 0;

      // Re-arm after a commit once no_event dominates for one tick
      if (hasNoEvent && blockedWordRef.current !== -1 && noEv > REARM_NO_EVENT) {
        blockedWordRef.current = -1;
      }

      const dec = decisionRef.current;
      const quietOk = !hasNoEvent || (dec.noEventMax === 'beat' ? best > noEv : noEv <= dec.noEventMax);
      const displayOk = best >= dec.display && best >= dec.ratio * second && quietOk;
      const commitLevel = hasNoEvent ? dec.commit : OLD_COMMIT_THRESHOLD;

      if (displayOk && word !== blockedWordRef.current) {
        // A different qualifying word also re-arms
        blockedWordRef.current = -1;
        setLockingWord(label);

        const cand = candidateRef.current;
        if (best >= commitLevel) {
          if (cand.word === word) cand.ticks += 1;
          else { cand.word = word; cand.ticks = 1; }
        } else {
          cand.word = word;
          cand.ticks = 0;
        }
        setLockingProgress(Math.min(cand.ticks / COMMIT_TICKS, 1));

        if (cand.ticks >= COMMIT_TICKS) {
          // Commit a chip
          const now = Date.now();
          if (hasNoEvent) {
            setCollectedWords(prev => [...prev, label]);
            lastChipAddedAtRef.current = now;
            blockedWordRef.current = word; // block repeats until re-armed
            // top-5 в момент коммита — кандидаты на замену последнего слова
            setAltChoices(
              indexed
                .filter(({ idx }) => idx !== noEventIdx)
                .slice(0, 5)
                .map(({ idx, prob }) => ({ label: i2l[idx] || `class_${idx}`, confidence: prob })),
            );
          } else {
            // Legacy model: same-word-in-a-row guard + global cooldown
            setCollectedWords(prev => {
              if (prev[prev.length - 1] === label) return prev;
              if (now - lastChipAddedAtRef.current < CHIP_COOLDOWN_MS) return prev;
              lastChipAddedAtRef.current = now;
              return [...prev, label];
            });
          }
          setCurrentPrediction(label);
          setConfidence(best);
          setHistory(prev => [
            { word: label, confidence: best, time: new Date().toLocaleTimeString() },
            ...prev.slice(0, 9),
          ]);
          candidateRef.current = { word: -1, ticks: 0 };
          smoothedRef.current = null; // reset EMA after each committed chip
          setLockingWord(null);
          setLockingProgress(0);
        }
      } else {
        candidateRef.current = { word: -1, ticks: 0 };
        setLockingWord(null);
        setLockingProgress(0);
        setCurrentPrediction(null);
        setConfidence(0);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  // Initialize MediaPipe Holistic ONCE
  useEffect(() => {
    let cancelled = false;

    async function initHolistic() {
      try {
        // @ts-ignore - MediaPipe loaded via npm
        const { Holistic } = await import('@mediapipe/holistic');

        const holistic = new Holistic({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
        });

        holistic.setOptions({
          modelComplexity: 1,
          // Своё сглаживание выключено: иначе оно складывается с One Euro
          // из landmarkStabilizer и лаг удваивается.
          smoothLandmarks: false,
          minDetectionConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });

        holistic.onResults((results: any) => {
          if (!isRunningRef.current) return;

          const now = performance.now();
          // Стабилизация — только для отрисовки; модель видит сырые точки
          // (STABILIZE_MODEL_INPUT), как при обучении.
          const s = stabilizerRef.current!.update(results, now);
          const landmarks = extractLandmarks(STABILIZE_MODEL_INPUT ? s.results : results);
          const buf = framesBufferRef.current;
          buf.push({ t: now, frame: Float32Array.from(landmarks) });
          // Evict entries older than the rolling buffer horizon
          const cutoff = now - BUFFER_MS;
          while (buf.length > 0 && buf[0].t < cutoff) buf.shift();
          setFrameCount(Math.min(buf.length, SEQ_LEN));

          // Draw on canvas — skeleton style (like the demo)
          const canvas = canvasRef.current;
          const video = videoRef.current;
          if (canvas && video) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;

              // Base video frame
              ctx.save();
              ctx.drawImage(video, 0, 0);

              // Прозрачность задаём globalAlpha, а не цветом: в токене лежит
              // сплошной цвет темы, полупрозрачных вариантов на каждый случай нет.
              const paint = paintRef.current;

              // Subtle overlay so landmarks pop
              ctx.save();
              ctx.globalAlpha = 0.15;
              ctx.fillStyle = paint.veil;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.restore();

              // Face mesh tessellation — translucent web
              if (results.faceLandmarks && FACEMESH_TESSELATION) {
                ctx.save();
                ctx.globalAlpha = 0.22;
                drawConnectors(ctx, results.faceLandmarks, FACEMESH_TESSELATION, {
                  color: paint.face,
                  lineWidth: 0.5,
                });
                ctx.restore();
              }

              // Pose skeleton — из стабилизатора (при потере трекинга
              // затухает вместе с alpha, а не пропадает рывком).
              const drawn = s.results;
              if (drawn.poseLandmarks && POSE_CONNECTIONS) {
                const poseAlpha = alphaOf(s.pose);
                // Стабилизатор отдаёт точки без visibility, а drawing_utils
                // по ней прячет додуманные суставы (ноги за кадром и т.п.,
                // visibilityMin 0.5). Возвращаем visibility из сырой позы,
                // иначе рисуются все 33 точки, включая выдуманные.
                const rawPose = s.raw.poseLandmarks;
                const posePts = rawPose
                  ? drawn.poseLandmarks.map((p: any, i: number) => ({ ...p, visibility: rawPose[i]?.visibility }))
                  : drawn.poseLandmarks;
                ctx.save();
                ctx.globalAlpha = 0.6 * poseAlpha;
                drawConnectors(ctx, posePts, POSE_CONNECTIONS, {
                  color: paint.pose,
                  lineWidth: 2,
                });
                ctx.restore();
                ctx.save();
                ctx.globalAlpha = poseAlpha;
                drawLandmarks(ctx, posePts, {
                  color: paint.pose,
                  fillColor: paint.pose,
                  lineWidth: 1,
                  radius: 2,
                });
                ctx.restore();
              }

              // Кисти — общей отрисовкой со студией: своя краска на сторону,
              // тёмная обводка и порядок по глубине.
              //
              // Раньше здесь обе кисти рисовались ОДНИМ оранжевым (вопреки
              // соседнему комментарию, обещавшему разные цвета), непрозрачными
              // кружками r=4 с ореолом, причём правая всегда поверх левой. При
              // сведённых кистях соседние точки разных рук отстоят в среднем на
              // 6 px — меньше диаметра маркера, поэтому верхняя рука буквально
              // закрашивала нижнюю, и та пропадала.
              //
              // arms: false — скелет позы здесь свой, рисуется выше.
              //
              // Кисти берём из стабилизатора. Прозрачность — по статусу:
              // предсказанная (трекер не вернул) — EXTRAPOLATED_ALPHA,
              // затухающая — alpha из стабилизатора. Если у кистей она
              // разная, рисуем их двумя вызовами по одной кисти.
              const alphaL = alphaOf(s.left);
              const alphaR = alphaOf(s.right);
              const drawHands = (frame: typeof drawn, alpha: number) => {
                ctx.save();
                ctx.globalAlpha = alpha;
                drawTrackedSkeleton(ctx, frame, canvas.width, canvas.height, {
                  arms: false,
                  state: overlayStateRef.current,
                });
                ctx.restore();
              };
              if (alphaL === alphaR) {
                drawHands(drawn, alphaL);
              } else {
                // дальняя кисть первой, ближняя поверх — как внутри drawTrackedSkeleton
                const onlyLeft = { ...drawn, rightHandLandmarks: undefined };
                const onlyRight = { ...drawn, leftHandLandmarks: undefined };
                if ((overlayStateRef.current.nearSide ?? 'right') === 'left') {
                  drawHands(onlyRight, alphaR);
                  drawHands(onlyLeft, alphaL);
                } else {
                  drawHands(onlyLeft, alphaL);
                  drawHands(onlyRight, alphaR);
                }
              }

              // Отладка: сырые точки трекера поверх сглаженных — видно и
              // дрожь, и лаг фильтра, и отброшенные скачки.
              if (DEBUG_RAW_LANDMARKS && HAND_CONNECTIONS) {
                ctx.save();
                ctx.globalAlpha = 0.8;
                for (const pts of [s.raw.leftHandLandmarks, s.raw.rightHandLandmarks]) {
                  if (!pts) continue;
                  drawConnectors(ctx, pts, HAND_CONNECTIONS, { color: DEBUG_RAW_COLOR, lineWidth: 1 });
                  drawLandmarks(ctx, pts, { color: DEBUG_RAW_COLOR, fillColor: DEBUG_RAW_COLOR, lineWidth: 1, radius: 2 });
                }
                ctx.restore();
              }

              ctx.restore();
            }
          }
        });

        if (!cancelled) {
          holisticRef.current = holistic;
          setHolisticReady(true);
          setStatus('Ready');
          console.log('[Qyran] MediaPipe Holistic initialized');
        }
      } catch (err: any) {
        console.error('[Qyran] Holistic init error:', err);
        if (!cancelled) {
          setStatus(`Holistic error: ${err.message}`);
        }
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
        // Throttle: successive holistic.send calls >= SEND_MIN_INTERVAL_MS apart
        // (skip rAF ticks in between so window content is display-Hz independent)
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

  // Predictions fire on a wall-clock interval, NOT on frame counts.
  // Started with the camera, cleaned up on stop/unmount.
  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => { predictionTick(); }, PREDICT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isRunning, predictionTick]);

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
    smoothedRef.current = null;
    candidateRef.current = { word: -1, ticks: 0 };
    setLockingWord(null);
    setLockingProgress(0);
    setCurrentPrediction(null);
    setTopPredictions([]);
  }, [aslMode]);

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
        // frameRate: 30 кадров достаточно для сглаживания, 60 — если камера
        // умеет (меньше dt → меньше порог скачка и точнее скорость).
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
      setStatus('Camera access denied');
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
      setLockingWord(null);
      setLockingProgress(0);
      smoothedRef.current = null;
      candidateRef.current = { word: -1, ticks: 0 };
      blockedWordRef.current = -1;
      inFlightRef.current = false;
    } else {
      await startCamera();
      stabilizerRef.current?.reset();
      framesBufferRef.current = [];
      setFrameCount(0);
      setCurrentPrediction(null);
      smoothedRef.current = null;
      candidateRef.current = { word: -1, ticks: 0 };
      blockedWordRef.current = -1;
      inFlightRef.current = false;
      lastSendAtRef.current = 0;
      isRunningRef.current = true;
      setIsRunning(true);
    }
  }, [isRunning, startCamera, stopCamera]);

  // Speak the collected sentence
  const speakSentence = useCallback(() => {
    if (collectedWords.length === 0) return;
    speak(collectedWords.join(' '));
  }, [collectedWords, speak]);

  const clearChips = useCallback(() => {
    cancelSpeech();
    setCollectedWords([]);
    setAltChoices([]);
    setLockingWord(null);
    setLockingProgress(0);
    candidateRef.current = { word: -1, ticks: 0 };
    blockedWordRef.current = -1;
    lastChipAddedAtRef.current = 0;
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
              {error ? t('common.error')
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
                  {!holisticReady && !isLoading && !error && (<span className="tag amber">○ MediaPipe</span>)}
                  {error && (
                    <span
                      className="tag"
                      style={{
                        color: 'var(--danger)',
                        borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)',
                        background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
                      }}
                      title={error}
                    >
                      ● {t('common.error')}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ position: 'relative', aspectRatio: '16/9', background: 'var(--surface-2)' }}>
                <video ref={videoRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'none' }} playsInline muted />
                <canvas
                  ref={canvasRef}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', transform: mirrored ? 'scaleX(-1)' : 'none' }}
                />

                {!isRunning && !error && (
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

                {!isRunning && error && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: 999, background: 'color-mix(in srgb, var(--danger) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <div style={{ maxWidth: 420 }}>
                      <div style={{ fontWeight: 500, color: 'var(--danger)' }}>{t('recognizer.error.title')}</div>
                      <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>{error}</div>
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
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }} role="radiogroup" aria-label={t('recognizer.model.title')}>
                {(Object.keys(SIGN_MODELS) as SignModelId[]).map((id) => (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={signModel === id}
                    onClick={() => setSignModel(id)}
                    className="btn btn-ghost"
                    style={{ padding: '6px 12px', fontSize: 13, ...(signModel === id ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-line)', color: 'var(--accent)' } : {}) }}
                    title={t(`recognizer.model.${id}.hint`)}
                  >
                    {t(`recognizer.model.${id}`)}
                  </button>
                ))}
              </div>
              <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>{t(`recognizer.model.${signModel}.hint`)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                {[
                  { k: t('recognizer.model.classes'), v: String(numClasses) },
                  { k: t('recognizer.model.architecture'), v: modelConfig?.architecture || 'Conv1D + BiLSTM' },
                  { k: t('recognizer.model.features'), v: `${featuresPerFrame} (Holistic)` },
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
                <div className="panel-h"><span className="num">{numClasses}</span>{t('recognizer.signs.title')}</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {labels.map((label) => {
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

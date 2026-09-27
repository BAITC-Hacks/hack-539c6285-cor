import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  loadAvatar, AVATARS, getSavedAvatarId, saveAvatarId, type AvatarId,
} from '@/lib/avatarLoader';
import { AvatarFace, IdleBody } from '@/lib/avatarLife';
import { computeSignerFraming, applyClipPlane } from '@/lib/avatarFraming';
import {
  GesturePlayer,
  fetchGesture,
  listGestures,
  type GestureJSON,
} from '@/lib/gesturePlayer';
import { buildFingerspellGesture, DACTYL_LETTERS } from '@/lib/dactyl';
import { buildWordGesture, resolveSignWord, SIGN_WORDS } from '@/lib/signWords';
import { loadSlovoIndex, resolveSlovoWord, resolveSlovoPhrase } from '@/lib/slovoLibrary';
import { resolveVerifiedSign, splitVerifiedPhrases, VERIFIED_PHRASES, VERIFIED_SIGNS, AUDITED_FILES } from '@/lib/verifiedSigns';
import { toGloss, glossToText } from '@/lib/glossing';
import { useTheme } from '@/app/context/ThemeContext';
import { useT } from '@/i18n';
import { ThemeToggle } from '@/app/components/shared/ThemeToggle';
import { LangSwitcher } from '@/app/components/shared/LangSwitcher';

/**
 * Цвет из токена темы для three.js.
 *
 * Сцена стоит внутри страницы, и её фон обязан жить в той же палитре: иначе на
 * светлой теме посреди кремовой страницы висит чернильный прямоугольник.
 * Токены хранятся как обычные css-переменные, поэтому просто читаем их с корня.
 */
function themeColor(token: string): THREE.Color {
  const c = new THREE.Color();
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (raw) c.set(raw);
  return c;
}

// Russian word forms → gesture file name (in /public/gestures)
const WORD_TO_GESTURE: Record<string, string> = {
  привет: 'privet',
  здравствуй: 'privet',
  здравствуйте: 'privet',

  мама: 'mama',
  маму: 'mama',
  маме: 'mama',
  мамы: 'mama',

  играть: 'igrat',
  играю: 'igrat',
  играешь: 'igrat',
  играет: 'igrat',
  играем: 'igrat',
  играете: 'igrat',
  играют: 'igrat',
  игра: 'igrat',
  игру: 'igrat',
  игры: 'igrat',

  магазин: 'magazin',
  магазину: 'magazin',
  магазина: 'magazin',
  магазине: 'magazin',

  молоко: 'moloko',
  молока: 'moloko',
  молоку: 'moloko',
  молоком: 'moloko',

  собака: 'sobaka',
  собаку: 'sobaka',
  собаке: 'sobaka',
  собаки: 'sobaka',
  собакой: 'sobaka',

  кошка: 'koshka',
  кошку: 'koshka',
  кошке: 'koshka',
  кошки: 'koshka',
  кошкой: 'koshka',
};

// Display labels for gesture buttons
const GESTURE_LABEL: Record<string, string> = {
  privet: 'Привет',
  mama: 'Мама',
  igrat: 'Играть',
  magazin: 'Магазин',
  moloko: 'Молоко',
  sobaka: 'Собака',
  koshka: 'Кошка',
};

const SUGGESTIONS = [
  'Привет',
  'Как дела?',
  'Как я могу помочь?',
  'Я хотеть есть',
  'Ты идти школа завтра',
  'Я любить мама',
  'Мы работать сегодня',
  'Кто там',
  'Спасибо',
];
const SPEEDS: { v: number; label: string }[] = [
  { v: 0.5, label: '0.5×' },
  { v: 0.75, label: '0.75×' },
  { v: 1, label: '1×' },
  { v: 1.5, label: '1.5×' },
  { v: 2, label: '2×' },
];

interface QueueItem {
  word: string;
  gestureName: string;
  /** Слово показывается дактилем (по буквам), а не записанным жестом */
  dactyl?: boolean;
}

export function TranslatorPage({
  onBack,
  onSwitchToRecognizer,
  onOpenStudio,
  onOpenDictionary,
}: {
  onBack: () => void;
  onSwitchToRecognizer?: () => void;
  onOpenStudio?: () => void;
  onOpenDictionary?: () => void;
}) {
  const [inputText, setInputText] = useState('');
  const [quickText, setQuickText] = useState('');
  /**
   * Как переводить: пословно или основной смысл.
   *
   * По умолчанию — смысл. Так просили сами глухие: пословный показ они не
   * понимают. Пословный остаётся под переключателем — он нужен, когда важно
   * каждое слово (имена, термины, диктовка).
   */
  const [meaningMode, setMeaningMode] = useState(true);
  /** Что получилось после глоссирования — показываем, чтобы правка была видна. */
  const [glossPreview, setGlossPreview] = useState<{ text: string; dropped: string[] } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSign, setCurrentSign] = useState('');
  const [statusText, setStatusText] = useState('');
  const [speed, setSpeed] = useState(1);
  const [isListening, setIsListening] = useState(false);
  const [progress, setProgress] = useState(0);
  const [signIndex, setSignIndex] = useState(0);
  const [signTotal, setSignTotal] = useState(0);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [lang, setLang] = useState<'EN' | 'RU' | 'KZ'>('RU');
  const [availableGestures, setAvailableGestures] = useState<string[]>([]);
  const [loop, setLoop] = useState(false);

  const t = useT();
  const { theme } = useTheme();

  /**
   * Перевод для обработчиков и эффектов.
   *
   * Сцена three.js собирается один раз, и перезапускать её из-за смены языка
   * нельзя. Поэтому внутри колбэков берём перевод через ref: язык там всегда
   * свежий, а зависимости остаются прежними.
   */
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  const containerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const playerRef = useRef<GesturePlayer | null>(null);
  const faceRef = useRef<AvatarFace | null>(null);
  const idleBodyRef = useRef<IdleBody | null>(null);
  const [avatarId, setAvatarId] = useState<AvatarId>(getSavedAvatarId);
  const isPlayingRef = useRef(false);
  const translateRef = useRef<(text?: string) => void>(() => {});
  const speedRef = useRef(1);
  const loopRef = useRef(false);
  const queueRef = useRef<QueueItem[]>([]);
  const queueTotalRef = useRef(0);
  const queueIndexRef = useRef(0);
  const gestureCacheRef = useRef<Record<string, GestureJSON>>({});
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer | null;
    controls: OrbitControls | null;
  }>({
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(40, 1, 0.1, 5000),
    renderer: null,
    controls: null,
  });

  useEffect(() => {
    speedRef.current = speed;
    if (playerRef.current) playerRef.current.speed = speed;
  }, [speed]);

  useEffect(() => {
    loopRef.current = loop;
    // When user toggles loop while a single gesture plays, propagate.
    if (playerRef.current && queueRef.current.length === 0) {
      playerRef.current.loop = loop;
    }
  }, [loop]);

  const playNextInQueue = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    if (queueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setStatusText(tRef.current('translator.status.done'));
      setProgress(100);
      setCurrentSign('');
      // Reset player to rest pose after sequence
      player.stop();
      faceRef.current?.quiet();
      return;
    }

    const item = queueRef.current.shift()!;
    queueIndexRef.current += 1;
    setSignIndex(queueIndexRef.current);
    setProgress((queueIndexRef.current / Math.max(queueTotalRef.current, 1)) * 100);
    setCurrentSign(
      item.dactyl ? tRef.current('translator.sign.dactylOf', { word: item.word }) : item.word,
    );
    setStatusText(
      tRef.current(
        item.dactyl ? 'translator.status.dactyl' : 'translator.status.signingOne',
        { word: item.word },
      ),
    );

    const data = gestureCacheRef.current[item.gestureName];
    if (!data) {
      // Should not happen — pre-fetched in translateText
      playNextInQueue();
      return;
    }

    player.speed = speedRef.current;
    player.loop = false; // queue-mode plays each gesture once
    player.onEnd = () => {
      // Small visual gap between signs
      window.setTimeout(playNextInQueue, 220);
    };
    player.load(data);

    // Артикуляция губ параллельно жесту — для дактиля не проговариваем,
    // там смысл в буквах на пальцах.
    if (!item.dactyl && data.frames.length) {
      const dur = data.frames[data.frames.length - 1].t / Math.max(speedRef.current, 0.1);
      faceRef.current?.say(item.word, dur);
    } else {
      faceRef.current?.quiet();
    }
  }, []);

  const playSingleGesture = useCallback(async (gestureName: string, label?: string) => {
    const player = playerRef.current;
    const shown = label || GESTURE_LABEL[gestureName] || gestureName;
    if (!player) return;
    queueRef.current = [];
    queueTotalRef.current = 1;
    queueIndexRef.current = 1;

    let data = gestureCacheRef.current[gestureName];
    if (!data) {
      try {
        data = await fetchGesture(gestureName);
        gestureCacheRef.current[gestureName] = data;
      } catch (e) {
        console.error('Failed to load gesture', gestureName, e);
        setStatusText(tRef.current('translator.status.loadFailed', { name: gestureName }));
        return;
      }
    }

    isPlayingRef.current = true;
    setIsPlaying(true);
    setProgress(100);
    setSignIndex(1);
    setSignTotal(1);
    setCurrentSign(shown);
    setStatusText(
      tRef.current('translator.status.signingOne', {
        word: shown,
      }),
    );

    player.speed = speedRef.current;
    player.loop = loopRef.current;
    player.onEnd = () => {
      if (loopRef.current) return;
      isPlayingRef.current = false;
      setIsPlaying(false);
      setStatusText(tRef.current('translator.status.ready'));
      setCurrentSign('');
      player.stop();
      faceRef.current?.quiet();
    };
    player.load(data);
    if (data.frames.length) {
      const dur = data.frames[data.frames.length - 1].t / Math.max(speedRef.current, 0.1);
      faceRef.current?.say(shown, dur);
    }
  }, []);

  // Показ одного слова из процедурного словаря (панель словаря)
  const playWordSign = useCallback(
    (lemma: string) => {
      // Слово уже есть в проверенной библиотеке — показываем её жест, а не процедурный
      const verified = resolveVerifiedSign(lemma);
      if (verified) {
        playSingleGesture(verified, lemma);
        return;
      }
      const name = `слово:${lemma}`;
      if (!gestureCacheRef.current[name]) {
        const built = buildWordGesture(lemma);
        if (!built) return;
        gestureCacheRef.current[name] = built;
      }
      queueRef.current = [{ word: lemma, gestureName: name }];
      queueTotalRef.current = 1;
      queueIndexRef.current = 0;
      setSignTotal(1);
      setSignIndex(0);
      isPlayingRef.current = true;
      setIsPlaying(true);
      setProgress(0);
      playNextInQueue();
    },
    [playNextInQueue, playSingleGesture],
  );

  // Показ одной буквы дактиля (панель алфавита)
  const playDactylLetter = useCallback(
    (letter: string) => {
      const name = `дактиль:${letter}`;
      if (!gestureCacheRef.current[name]) {
        const built = buildFingerspellGesture(letter);
        if (!built) return;
        gestureCacheRef.current[name] = built;
      }
      queueRef.current = [{ word: letter.toUpperCase(), gestureName: name, dactyl: true }];
      queueTotalRef.current = 1;
      queueIndexRef.current = 0;
      setSignTotal(1);
      setSignIndex(0);
      isPlayingRef.current = true;
      setIsPlaying(true);
      setProgress(0);
      playNextInQueue();
    },
    [playNextInQueue],
  );

  const translateText = useCallback(
    async (text?: string) => {
      const t = (text ?? inputText).trim();
      if (!t || !playerRef.current) return;

      const words = t
        .toLowerCase()
        .replace(/[^а-яёa-z\s-]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
      // Проверенные фразы («как дела», «как я могу помочь») показываются одним
      // жестом, как у носителей. Ищем их в исходных словах — до перевода в
      // жестовый порядок, который выбрасывает предлоги и переставляет слова.
      const segments = splitVerifiedPhrases(words);
      const question = /\?/.test(t);

      const items: QueueItem[] = [];
      const missing: string[] = [];
      const glossParts: string[] = [];
      const dropped: string[] = [];
      await loadSlovoIndex(); // идемпотентно, кэшируется
      for (const seg of segments) {
        if (seg.phrase) {
          items.push({ word: seg.words.join(' '), gestureName: seg.phrase.file });
          glossParts.push(seg.phrase.gloss);
          continue;
        }
        // Режим «основной смысл»: фраза сначала переводится в жестовый порядок —
        // без предлогов и связок, время вперёд, вопросительное слово в конец.
        // Пословный режим оставлен как был: он нужен, когда важно каждое слово.
        const gloss = meaningMode ? toGloss(seg.words.join(' ') + (question ? '?' : '')) : null;
        const tokens = gloss ? gloss.tokens : seg.words;
        if (gloss) {
          if (gloss.tokens.length) glossParts.push(glossToText(gloss.tokens));
          dropped.push(...gloss.dropped);
        }

        for (let ti = 0; ti < tokens.length; ti++) {
          const tok = tokens[ti];
          // Проверенная библиотека главнее всех старых источников
          const verified = resolveVerifiedSign(tok);
          if (verified) {
            items.push({ word: tok, gestureName: verified });
            continue;
          }
          const g = WORD_TO_GESTURE[tok];
          if (g) {
            items.push({ word: tok, gestureName: g });
            continue;
          }
          // Фразы из библиотеки SLOVO (n-граммы: «добро пожаловать» и т.п.)
          const ph = resolveSlovoPhrase(tokens, ti);
          if (ph) {
            items.push({
              word: tokens.slice(ti, ti + ph.consumed).join(' '),
              gestureName: `slovo/${ph.file}`,
            });
            ti += ph.consumed - 1;
            continue;
          }
          // Записанная библиотека SLOVO (~965 слов, ретаргет реального моушена)
          const sf = resolveSlovoWord(tok);
          if (sf) {
            items.push({ word: tok, gestureName: `slovo/${sf}` });
            continue;
          }
          // Процедурный словарь жестов (~90 слов + словоформы)
          const lemma = resolveSignWord(tok);
          if (lemma) {
            const wordName = `слово:${lemma}`;
            if (!gestureCacheRef.current[wordName]) {
              const built = buildWordGesture(lemma);
              if (built) gestureCacheRef.current[wordName] = built;
            }
            if (gestureCacheRef.current[wordName]) {
              items.push({ word: tok, gestureName: wordName });
              continue;
            }
          }
          // Нет записанного жеста — показываем слово дактилем (по буквам)
          const dactylName = `дактиль:${tok}`;
          if (!gestureCacheRef.current[dactylName]) {
            const built = buildFingerspellGesture(tok);
            if (!built) {
              missing.push(tok);
              continue;
            }
            gestureCacheRef.current[dactylName] = built;
          }
          items.push({ word: tok, gestureName: dactylName, dactyl: true });
        }
      }

      setGlossPreview(meaningMode && glossParts.length ? {
        text: glossParts.join(' '),
        dropped,
      } : null);

      if (items.length === 0) {
        setStatusText(
          missing.length
            ? tRef.current('translator.status.cantShow', { words: missing.join(', ') })
            : tRef.current('translator.status.enterWord'),
        );
        return;
      }

      // Pre-fetch all needed gestures
      const need = Array.from(new Set(items.map((i) => i.gestureName)));
      try {
        await Promise.all(
          need.map(async (n) => {
            if (!gestureCacheRef.current[n]) {
              gestureCacheRef.current[n] = await fetchGesture(n);
            }
          }),
        );
      } catch (e) {
        console.error('Failed to prefetch gestures', e);
        setStatusText(tRef.current('translator.status.gestureError'));
        return;
      }

      if (missing.length) {
        console.info('No gesture for:', missing.join(', '));
      }

      // Если уже показываем — дописываем слова в конец очереди (непрерывная речь)
      if (isPlayingRef.current) {
        queueRef.current.push(...items);
        queueTotalRef.current += items.length;
        setSignTotal(queueTotalRef.current);
        return;
      }

      queueRef.current = items;
      queueTotalRef.current = items.length;
      queueIndexRef.current = 0;
      setSignTotal(items.length);
      setSignIndex(0);
      isPlayingRef.current = true;
      setIsPlaying(true);
      setProgress(0);
      setStatusText(tRef.current('translator.status.translating'));

      playNextInQueue();
    },
    [inputText, meaningMode, playNextInQueue],
  );

  useEffect(() => {
    translateRef.current = translateText;
  }, [translateText]);

  // Initialize Three.js scene + load avatar (перезапускается при смене аватара)
  useEffect(() => {
    if (!containerRef.current) return;

    // Смена аватара посреди показа: очередь долой, спиннер обратно.
    setAvatarLoaded(false);
    queueRef.current = [];
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentSign('');

    const container = containerRef.current;
    const { scene, camera } = sceneRef.current;
    scene.background = themeColor('--bg-elev');

    const w0 = container.clientWidth || 480;
    const h0 = container.clientHeight || 360;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w0, h0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    // Включаем ДО первого рендера: иначе шейдеры компилируются без отсечения.
    renderer.localClippingEnabled = true;
    container.appendChild(renderer.domElement);
    sceneRef.current.renderer = renderer;

    camera.aspect = w0 / h0;
    camera.updateProjectionMatrix();

    // Всё, что кладём в сцену, запоминаем: сцена живёт в ref между
    // перезапусками эффекта (смена аватара), и без снятия в cleanup при
    // каждом переключении копились бы вторые светильники и второй аватар.
    const added: THREE.Object3D[] = [];
    const addToScene = (obj: THREE.Object3D) => {
      scene.add(obj);
      added.push(obj);
    };
    addToScene(new THREE.HemisphereLight(0xffffff, 0x333344, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2, 4, 3);
    addToScene(key);
    // Заполняющий свет тёплый — это подсветка из фирменной песочной части палитры.
    const fill = new THREE.DirectionalLight(themeColor('--warm'), 0.35);
    fill.position.set(-2, 1, -1);
    addToScene(fill);

    let animId: number;
    let disposed = false;

    loadAvatar(AVATARS[avatarId].url)
      .then(({ root, bones }) => {
        if (disposed) return;

        addToScene(root);
        root.updateMatrixWorld(true);

        // SkinnedMesh.geometry's AABB is in pre-skin (cm) space, so transforming
        // it by the Armature scale gives the wrong size. Use bone WORLD positions
        // for an accurate world-space extent.
        const box = new THREE.Box3();
        const tmp = new THREE.Vector3();
        for (const bone of bones.values()) {
          bone.getWorldPosition(tmp);
          if (Number.isFinite(tmp.x) && Number.isFinite(tmp.y) && Number.isFinite(tmp.z)) {
            box.expandByPoint(tmp);
          }
        }

        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        let h = size.y;
        if (h < 0.001 || !isFinite(h)) h = 1.8;
        const cx = isFinite(center.x) ? center.x : 0;
        const cy = isFinite(center.y) ? center.y : h * 0.5;
        const cz = isFinite(center.z) ? center.z : 0;
        const minY = isFinite(box.min.y) ? box.min.y : 0;

        // Кадр сурдопереводчика: низ спрятан, но кисти висящих рук видны
        // целиком — срез ниже кончиков пальцев.
        const framing = computeSignerFraming(bones, camera.fov, camera.aspect);
        applyClipPlane(root, framing.clipPlane);
        if (import.meta.env.DEV) {
          console.log('[Qyran] кадр: срез y=', framing.cutY.toFixed(3),
            'фокус y=', framing.focusY.toFixed(3), 'дистанция=', framing.distance.toFixed(3));
        }

        const focusY = framing.focusY;
        const dist = framing.distance;
        camera.position.set(cx, focusY, cz + dist);
        camera.near = Math.max(dist / 500, 0.01);
        camera.far = dist * 50;
        camera.updateProjectionMatrix();

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(cx, focusY, cz);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.minDistance = dist * 0.45;
        controls.maxDistance = dist * 2.2;
        controls.update();
        sceneRef.current.controls = controls;

        playerRef.current = new GesturePlayer(bones);
        playerRef.current.speed = speedRef.current;
        playerRef.current.loop = loopRef.current;
        // Живость: лицо (моргание, артикуляция) и дыхание в покое.
        faceRef.current = new AvatarFace(root);
        idleBodyRef.current = new IdleBody(bones);

        if (import.meta.env.DEV) {
          (window as any).__qyranDebug = {
            scene,
            camera,
            controls,
            bones,
            get player() {
              return playerRef.current;
            },
            get face() {
              return faceRef.current;
            },
            get idleBody() {
              return idleBodyRef.current;
            },
          };
        }

        setAvatarLoaded(true);
        setStatusText(tRef.current('translator.status.ready'));

        // Pre-load gesture index
        listGestures().then((arr) => {
          if (!disposed) setAvailableGestures(arr);
        });
      })
      .catch((err) => {
        console.error('Failed to load avatar:', err);
        setStatusText(tRef.current('translator.status.avatarError'));
      });

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const now = performance.now() / 1000;
      playerRef.current?.update();
      // Поверх плеера: дыхание гаснет во время жеста и ложится на его позу, не затирая её.
      idleBodyRef.current?.update(
        now,
        !(playerRef.current?.isPlaying() ?? false),
        playerRef.current?.drivesBones() ?? false,
      );
      faceRef.current?.update(now);
      sceneRef.current.controls?.update();
      renderer.render(scene, camera);
    };
    animate();

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      disposed = true;
      ro.disconnect();
      cancelAnimationFrame(animId);
      sceneRef.current.controls?.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      for (const obj of added) scene.remove(obj);
      playerRef.current = null;
      faceRef.current = null;
      idleBodyRef.current = null;
    };
  }, [avatarId]);

  // Смена темы: фон сцены переезжает вместе со страницей, иначе на светлой
  // теме аватар остаётся стоять в тёмном прямоугольнике.
  useEffect(() => {
    sceneRef.current.scene.background = themeColor('--bg-elev');
  }, [theme]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert(tRef.current('translator.speech.chromeOnly'));
      return;
    }

    const recog = new SR();
    recog.lang = 'ru-RU';
    recog.interimResults = true;
    recog.continuous = true;
    recog.onresult = (e: any) => {
      let f = '';
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) f += e.results[i][0].transcript;
      if (f) {
        setInputText((prev) => (prev ? prev + ' ' : '') + f);
        // Речь → жесты сразу: распознанная фраза уходит в перевод
        translateRef.current(f);
      }
    };
    recog.onend = () => {
      setIsListening(false);
    };
    recog.onerror = () => {
      setIsListening(false);
    };
    recog.start();
    recognitionRef.current = recog;
    setIsListening(true);
  }, [isListening]);

  const onQuickKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (quickText.trim()) {
        setInputText(quickText);
        translateText(quickText);
      }
    }
  };

  const onTextareaKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      translateText();
    }
  };

  return (
    <div className="qyran-translator">
      {/* Top bar */}
      <header className="topbar">
        <div className="shell topbar-inner">
          <button className="iconbtn" aria-label={t('common.back')} onClick={onBack}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span className="brand-q">Q</span>
            <span className="title-row">
              <span className="page-title">{t('translator.title')}</span>
              <span className="page-sub mono">{t('translator.subtitle')}</span>
            </span>
          </div>

          <div className="spacer" />

          <span className="pill" aria-live="polite">
            <span className="dot" />
            <span>
              {avatarLoaded
                ? t('translator.status.modelReady')
                : t('translator.status.modelLoading')}
            </span>
          </span>

          {onSwitchToRecognizer && (
            <button
              onClick={onSwitchToRecognizer}
              className="btn btn-brand"
              type="button"
              style={{
                padding: '8px 14px',
                fontSize: 13,
                background: 'var(--grad-brand)',
              }}
              title={t('translator.nav.toRecognizer')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="6" width="14" height="12" rx="2" />
                <path d="M17 10l4-2v8l-4-2" />
              </svg>
              {t('common.nav.recognizer')}
            </button>
          )}

          {onOpenDictionary && (
            <button
              onClick={onOpenDictionary}
              className="btn"
              type="button"
              style={{ padding: '8px 14px', fontSize: 13 }}
              title={t('dictionary.toDictionary')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              {t('dictionary.nav')}
            </button>
          )}

          {onOpenStudio && (
            <button
              onClick={onOpenStudio}
              className="btn"
              type="button"
              style={{ padding: '8px 14px', fontSize: 13 }}
              title={t('translator.nav.toStudio')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="3" fill="currentColor" />
              </svg>
              {t('common.nav.studio')}
            </button>
          )}

          <ThemeToggle compact />
          <LangSwitcher />

          <button className="iconbtn" aria-label={t('translator.a11y.settings')} type="button">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="shell">
        <section className="page-header">
          <span className="eyebrow" style={{ display: 'inline-block', marginBottom: 18 }}>
            {t('translator.hero.eyebrow')}
          </span>
          <h1 className="page-h1">
            {t('translator.hero.title')}{' '}
            <span className="dim">{t('translator.hero.titleDim')}</span>
          </h1>
          <p className="page-lede">{t('translator.hero.lede')}</p>
        </section>

        <section className="grid" aria-label={t('translator.a11y.workspace')}>
          {/* LEFT: Avatar stage */}
          <div>
            <div className="stage" role="img" aria-label={t('translator.a11y.stage')}>
              <div className="stage-grid" />
              <div className="stage-floor" />

              <div className="stage-head">
                <span className="stage-tag mono">AVATAR · v1.0</span>
                <span
                  role="group"
                  aria-label={t('translator.avatar.pick')}
                  style={{ display: 'inline-flex', gap: 4 }}
                >
                  {(['adam', 'eva', 'elnar'] as AvatarId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`stage-tag mono${avatarId === id ? ' active' : ''}`}
                      style={{
                        cursor: 'pointer',
                        opacity: avatarId === id ? 1 : 0.55,
                        borderColor: avatarId === id ? 'var(--accent)' : undefined,
                      }}
                      aria-pressed={avatarId === id}
                      onClick={() => {
                        if (id === avatarId) return;
                        saveAvatarId(id);
                        setAvatarId(id);
                      }}
                    >
                      {t(`translator.avatar.${id}`)}
                    </button>
                  ))}
                </span>
                <span className="stage-tag mono">
                  {avatarLoaded ? '60 FPS' : t('translator.stage.loadingTag')}
                </span>
              </div>

              <div className="stage-corners">
                <span className="tl" />
                <span className="tr" />
                <span className="bl" />
                <span className="br" />
              </div>

              {/* 3D Avatar canvas */}
              <div ref={containerRef} className="avatar-wrap" />

              {!avatarLoaded && (
                <div className="stage-loading">
                  <div className="spinner" />
                  <span className="dim" style={{ fontSize: 13 }}>
                    {t('translator.stage.loadingAvatar')}
                  </span>
                </div>
              )}

              <div className="stage-status">
                <span className={`stage-chip ${isPlaying ? 'live' : 'ok'}`}>
                  {isPlaying
                    ? `● ${t('translator.stage.signing')}`
                    : avatarLoaded
                      ? `● ${t('translator.stage.ready')}`
                      : `○ ${t('translator.stage.idle')}`}
                </span>
                {currentSign && (
                  <span className="stage-chip">
                    {t('translator.stage.sign', { word: currentSign.toUpperCase() })}
                  </span>
                )}
                {signTotal > 0 && (
                  <span className="stage-chip">
                    {String(signIndex).padStart(2, '0')} / {String(signTotal).padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>

            <div className="row-status" aria-live="polite">
              <span className={`led ${isPlaying ? 'playing' : ''}`} aria-hidden="true" />
              <span className="dim">
                {isPlaying ? (
                  <>
                    {t('translator.status.signingWord')}{' '}
                    <span style={{ color: 'var(--text)' }}>{currentSign}</span>…
                  </>
                ) : (
                  <>
                    {statusText || t('translator.status.idle')}. {t('translator.status.press')}{' '}
                    <span className="kbd">{t('translator.action.translate')}</span>{' '}
                    {t('translator.status.or')} <span className="kbd">Enter</span>
                  </>
                )}
              </span>
              {isPlaying && (
                <div className="progress" style={{ flex: 1, marginTop: 0 }}>
                  <div style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Input panels */}
          <div>
            {/* Quick phrase */}
            <div className="panel">
              <div className="panel-head">
                <div className="panel-h">
                  <span className="num">1</span>{t('translator.panel.quick')}
                </div>
                <button
                  className="iconbtn"
                  aria-label={t('translator.a11y.voice')}
                  onClick={toggleListening}
                  type="button"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="3" width="6" height="12" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0" />
                    <path d="M12 18v3" />
                  </svg>
                </button>
              </div>
              <div className="input-row">
                <input
                  type="text"
                  placeholder={t('translator.quick.placeholder')}
                  aria-label={t('translator.a11y.quickInput')}
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  onKeyDown={onQuickKey}
                />
              </div>

              <div className="speed-row" role="group" aria-label={t('translator.a11y.speedGroup')}>
                <span className="speed-label">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon
                      points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                      fill="currentColor"
                    />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                  {t('translator.speed.label')}
                </span>
                <input
                  className="slider"
                  type="range"
                  min="50"
                  max="200"
                  step="25"
                  value={speed * 100}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    setSpeed(v);
                    e.currentTarget.style.setProperty('--v', `${((v * 100 - 50) / 150) * 100}%`);
                  }}
                  style={{ ['--v' as any]: `${((speed * 100 - 50) / 150) * 100}%` }}
                  aria-label={t('translator.a11y.speedSlider')}
                />
                <div className="seg" role="tablist" aria-label={t('translator.a11y.speedPresets')}>
                  {SPEEDS.map((s) => (
                    <button
                      key={s.v}
                      className={speed === s.v ? 'on' : ''}
                      onClick={() => setSpeed(s.v)}
                      type="button"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="speed-row"
                role="group"
                aria-label={t('translator.a11y.loop')}
                style={{ marginTop: 4 }}
              >
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={loop}
                    onChange={(e) => setLoop(e.target.checked)}
                  />
                  {t('translator.loop.label')}
                </label>
              </div>
            </div>

            {/* Full text */}
            <div className="panel">
              <div className="panel-head">
                <div className="panel-h">
                  <span className="num">2</span>{t('translator.panel.full')}
                </div>
                <div className="lang-tabs" role="tablist" aria-label={t('translator.a11y.sourceLang')}>
                  {(['EN', 'RU', 'KZ'] as const).map((l) => (
                    <button
                      key={l}
                      className={lang === l ? 'on' : ''}
                      onClick={() => setLang(l)}
                      type="button"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/*
                Выбор способа перевода. Пословный показ глухие не понимают —
                об этом сказали сами носители, — поэтому по умолчанию включён
                основной смысл. Пословный нужен там, где важно каждое слово.
              */}
              <div role="group" aria-label={t('translator.a11y.mode')} style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {([
                  { on: true, title: 'translator.mode.meaning', hint: 'translator.mode.meaningHint' },
                  { on: false, title: 'translator.mode.literal', hint: 'translator.mode.literalHint' },
                ] as const).map((m) => (
                  <button
                    key={String(m.on)}
                    type="button"
                    className="btn"
                    aria-pressed={meaningMode === m.on}
                    title={t(m.hint)}
                    onClick={() => { setMeaningMode(m.on); setGlossPreview(null); }}
                    style={{
                      padding: '7px 12px',
                      fontSize: 12,
                      ...(meaningMode === m.on
                        ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-line)', color: 'var(--accent)' }
                        : {}),
                    }}
                  >
                    {t(m.title)}
                  </button>
                ))}
              </div>

              <div className="textarea-wrap">
                <textarea
                  placeholder={t('translator.full.placeholder')}
                  maxLength={500}
                  aria-label={t('translator.a11y.fullInput')}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={onTextareaKey}
                />
                <div className="textarea-foot">
                  <span>{t('translator.full.foot')}</span>
                  <span>{inputText.length}/500</span>
                </div>
              </div>

              {/* Что именно покажет аватар — видно до и во время показа. */}
              {glossPreview && (
                <div
                  className="mono"
                  style={{
                    marginTop: 8, padding: '8px 10px', fontSize: 12, lineHeight: 1.5,
                    border: '1px solid var(--border)', borderRadius: 8,
                    background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
                  }}
                >
                  <span className="dim">{t('translator.gloss.showing')}</span>
                  <span style={{ color: 'var(--accent)' }}>{glossPreview.text}</span>
                  {glossPreview.dropped.length > 0 && (
                    <>
                      <br />
                      <span className="dim">
                        {t('translator.gloss.dropped', { words: glossPreview.dropped.join(', ') })}
                      </span>
                    </>
                  )}
                </div>
              )}

              <div className="action-row">
                <button
                  className="btn-translate"
                  type="button"
                  onClick={() => translateText()}
                  disabled={isPlaying || !inputText.trim()}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon
                      points="22 2 15 22 11 13 2 9 22 2"
                      fill="currentColor"
                    />
                  </svg>
                  {t('translator.action.translate')}
                </button>
                <button
                  className={`btn-mic ${isListening ? 'rec' : ''}`}
                  aria-label={t('translator.a11y.voice')}
                  aria-pressed={isListening}
                  onClick={toggleListening}
                  type="button"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="3" width="6" height="12" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0" />
                    <path d="M12 18v3" />
                  </svg>
                </button>
              </div>

              <div className="suggestions" aria-label={t('translator.a11y.suggestions')}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="chip"
                    onClick={() => {
                      setInputText(s);
                    }}
                    type="button"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Проверенная библиотека: фразы и слова, построенные по записям носителей (src/lib/verifiedSigns.ts) */}
            <div className="panel">
              <div className="panel-head">
                <div className="panel-h">
                  <span className="num">3</span>{t('translator.panel.verified')}
                </div>
                <span className="page-sub mono" style={{ fontSize: 11 }}>
                  {t('translator.verified.count', { p: VERIFIED_PHRASES.length, w: Object.keys(VERIFIED_SIGNS).length })}
                </span>
              </div>
              <p className="dim" style={{ fontSize: 12, margin: '0 0 10px' }}>
                {t('translator.verified.hint')}
              </p>
              <div className="suggestions" aria-label={t('translator.panel.verified')}>
                {VERIFIED_PHRASES.map((p) => (
                  <button
                    key={p.file}
                    className="chip"
                    style={AUDITED_FILES.has(p.file) ? undefined : { borderStyle: 'dashed' }}
                    onClick={() => {
                      if (!isPlaying) playSingleGesture(p.file, p.label);
                    }}
                    disabled={!avatarLoaded || isPlaying}
                    type="button"
                    title={t('translator.recorded.play', { name: p.label }) + (AUDITED_FILES.has(p.file) ? '' : ` · ${t('translator.verified.pending')}`)}
                  >
                    ▶ {p.label}
                  </button>
                ))}
              </div>
              <div className="suggestions" style={{ marginTop: 8 }} aria-label={t('translator.verified.words')}>
                {Object.entries(VERIFIED_SIGNS).map(([word, s]) => (
                  <button
                    key={word}
                    className="chip"
                    style={AUDITED_FILES.has(s.file) ? undefined : { borderStyle: 'dashed' }}
                    onClick={() => {
                      if (!isPlaying) playSingleGesture(s.file, word);
                    }}
                    disabled={!avatarLoaded || isPlaying}
                    type="button"
                    title={t('translator.dict.play', { word }) + (AUDITED_FILES.has(s.file) ? '' : ` · ${t('translator.verified.pending')}`)}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>

            {/* Старые источники — не проверены носителями: спрятаны под раскрытие, не удалены */}
            <div className="panel">
              <div className="panel-head">
                <div className="panel-h">
                  <span className="num">4</span>{t('translator.panel.unverified')}
                </div>
                <span className="page-sub mono" style={{ fontSize: 11 }}>
                  {t('translator.dict.count', { n: SIGN_WORDS.length + availableGestures.length })}
                </span>
              </div>
              <p className="dim" style={{ fontSize: 12, margin: '0 0 10px' }}>
                {t('translator.unverified.hint')}
              </p>
              <details>
                <summary className="dim" style={{ fontSize: 12, cursor: 'pointer' }}>
                  {t('translator.unverified.show')}
                </summary>
                <div className="suggestions" aria-label={t('translator.a11y.recordedLib')} style={{ marginTop: 8 }}>
                  {availableGestures.map((g) => (
                    <button
                      key={g}
                      className="chip"
                      onClick={() => {
                        if (!isPlaying) playSingleGesture(g);
                      }}
                      disabled={!avatarLoaded || isPlaying}
                      type="button"
                      title={t('translator.recorded.play', { name: GESTURE_LABEL[g] || g })}
                    >
                      ▶ {GESTURE_LABEL[g] || g}
                    </button>
                  ))}
                </div>
                <div
                  className="suggestions"
                  aria-label={t('translator.panel.dict')}
                  style={{ maxHeight: 220, overflowY: 'auto', marginTop: 8 }}
                >
                  {SIGN_WORDS.map((w) => (
                    <button
                      key={w}
                      className="chip"
                      onClick={() => {
                        if (!isPlaying) playWordSign(w);
                      }}
                      disabled={!avatarLoaded || isPlaying}
                      type="button"
                      title={t('translator.dict.play', { word: w })}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </details>
            </div>

            {/* Dactyl alphabet (fingerspelling) */}
            <div className="panel">
              <div className="panel-head">
                <div className="panel-h">
                  <span className="num">5</span>{t('translator.panel.dactyl')}
                </div>
                <span className="page-sub mono" style={{ fontSize: 11 }}>
                  {t('translator.dactyl.count', { n: DACTYL_LETTERS.length })}
                </span>
              </div>
              <p className="dim" style={{ fontSize: 12, margin: '0 0 10px' }}>
                {t('translator.dactyl.hint')}
              </p>
              <div className="suggestions" aria-label={t('translator.a11y.dactyl')}>
                {DACTYL_LETTERS.map((l) => (
                  <button
                    key={l}
                    className="chip"
                    style={{ minWidth: 36, justifyContent: 'center' }}
                    onClick={() => {
                      if (!isPlaying) playDactylLetter(l);
                    }}
                    disabled={!avatarLoaded || isPlaying}
                    type="button"
                    title={t('translator.dactyl.letter', { letter: l.toUpperCase() })}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

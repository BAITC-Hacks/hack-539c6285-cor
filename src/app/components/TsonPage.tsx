import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadAvatar, AVATARS } from '@/lib/avatarLoader';
import { AvatarFace, IdleBody } from '@/lib/avatarLife';
import { computeSignerFraming, applyClipPlane } from '@/lib/avatarFraming';
import { GesturePlayer, fetchGesture, type GestureJSON } from '@/lib/gesturePlayer';
import { AUDITED_FILES, resolveVerifiedSign, splitVerifiedPhrases } from '@/lib/verifiedSigns';
import { TSON_DECK, TSON_REPLIES, TSON_SKIP } from '@/lib/tsonDeck';
import { useTheme } from '@/app/context/ThemeContext';
import { useI18n, useT } from '@/i18n';
import { ThemeToggle } from '@/app/components/shared/ThemeToggle';
import { LangSwitcher } from '@/app/components/shared/LangSwitcher';

/**
 * «Окно ЦОН» — экран для окна госуслуг.
 *
 * Слышащий оператор нажимает готовую фразу (или пишет свою) — Елнар показывает её на русском жестовом языке, фраза
 * крупно подписана для гражданина. Глухой гражданин отвечает кнопками или текстом — оператор видит ответ крупно и
 * слышит его. Играет только проверенная библиотека (src/lib/verifiedSigns.ts); слово без жеста не подменяется
 * другим источником, а честно называется под подписью. Страница публичная, как словарь: для демо и пилота вход не
 * нужен, камера не используется.
 */

interface QueueItem {
  file: string;
  /** Что проговаривают губы и что стоит в метке сцены */
  label: string;
}

interface LogEntry {
  id: number;
  who: 'operator' | 'citizen';
  text: string;
}

const SPEEDS = [0.5, 0.75, 1];
const SPEECH_LANG = { kk: 'kk-KZ', ru: 'ru-RU', en: 'en-US' } as const;
const LOG_MAX = 12;

export function TsonPage({ onBack }: { onBack: () => void }) {
  const t = useT();
  const { lang } = useI18n();
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<GesturePlayer | null>(null);
  const faceRef = useRef<AvatarFace | null>(null);
  const idleBodyRef = useRef<IdleBody | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cacheRef = useRef<Record<string, GestureJSON>>({});
  const queueRef = useRef<QueueItem[]>([]);
  /** Номер показа: новый клик обрывает старую очередь, даже если та ещё ждёт загрузки файла */
  const runRef = useRef(0);
  const lastRef = useRef<{ items: QueueItem[]; caption: string; missing: string[] } | null>(null);
  const speedRef = useRef(1);
  const logIdRef = useRef(0);

  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [caption, setCaption] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
  const [citizenText, setCitizenText] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [speak, setSpeak] = useState(true);
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    speedRef.current = speed;
    if (playerRef.current) playerRef.current.speed = speed;
  }, [speed]);

  // ——— сцена: всегда Елнар — проверенные жесты построены на его скелете ———
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.localClippingEnabled = true;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2, 4, 3);
    scene.add(key);

    let disposed = false;
    let raf = 0;
    let controls: OrbitControls | null = null;

    loadAvatar(AVATARS.elnar.url).then(({ root, bones }) => {
      if (disposed) return;
      scene.add(root);
      root.updateMatrixWorld(true);

      const framing = computeSignerFraming(bones, camera.fov, camera.aspect);
      applyClipPlane(root, framing.clipPlane);
      const center = new THREE.Vector3();
      const box = new THREE.Box3();
      const tmp = new THREE.Vector3();
      for (const b of bones.values()) {
        b.getWorldPosition(tmp);
        if (Number.isFinite(tmp.x)) box.expandByPoint(tmp);
      }
      box.getCenter(center);
      camera.position.set(center.x, framing.focusY, center.z + framing.distance);
      camera.near = Math.max(framing.distance / 500, 0.01);
      camera.far = framing.distance * 50;
      camera.updateProjectionMatrix();

      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(center.x, framing.focusY, center.z);
      controls.enableDamping = true;
      controls.minDistance = framing.distance * 0.45;
      controls.maxDistance = framing.distance * 2.2;
      controls.update();

      playerRef.current = new GesturePlayer(bones);
      playerRef.current.speed = speedRef.current;
      playerRef.current.loop = false;
      faceRef.current = new AvatarFace(root);
      idleBodyRef.current = new IdleBody(bones);
      setAvatarLoaded(true);
    }).catch(() => setAvatarLoaded(false));

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now() / 1000;
      playerRef.current?.update();
      idleBodyRef.current?.update(
        now,
        !(playerRef.current?.isPlaying() ?? false),
        playerRef.current?.drivesBones() ?? false,
      );
      faceRef.current?.update(now);
      controls?.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      runRef.current += 1;
      ro.disconnect();
      cancelAnimationFrame(raf);
      controls?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      if (playerRef.current) playerRef.current.onEnd = null;
      playerRef.current = null;
      faceRef.current = null;
      idleBodyRef.current = null;
    };
  }, []);

  // Фон сцены — вместе с темой.
  useEffect(() => {
    if (sceneRef.current) {
      const c = getComputedStyle(document.documentElement).getPropertyValue('--bg-elev').trim();
      sceneRef.current.background = c ? new THREE.Color(c) : null;
    }
  }, [theme, avatarLoaded]);

  // ——— показ: очередь жестов, каждый из покоя в покой ———
  const getGesture = useCallback(async (file: string) => {
    const hit = cacheRef.current[file];
    if (hit) return hit;
    const data = await fetchGesture(file);
    cacheRef.current[file] = data;
    return data;
  }, []);

  const playNext = useCallback(async (run: number): Promise<void> => {
    if (run !== runRef.current) return;
    const player = playerRef.current;
    if (!player) return;
    const item = queueRef.current.shift();
    if (!item) {
      player.onEnd = null;
      player.stop();
      setCurrent(null);
      faceRef.current?.quiet();
      return;
    }
    let data: GestureJSON;
    try {
      data = await getGesture(item.file);
    } catch {
      return playNext(run);
    }
    if (run !== runRef.current) return;
    player.loop = false;
    player.speed = speedRef.current;
    player.onEnd = () => { void playNext(run); };
    player.load(data);
    setCurrent(item.label.toUpperCase());
    if (data.frames.length) {
      const dur = data.frames[data.frames.length - 1].t / Math.max(speedRef.current, 0.1);
      faceRef.current?.say(item.label, dur);
    }
  }, [getGesture]);

  const show = useCallback((items: QueueItem[], text: string, noSign: string[]) => {
    lastRef.current = { items, caption: text, missing: noSign };
    setCaption(text);
    setMissing(noSign);
    runRef.current += 1;
    queueRef.current = [...items];
    if (items.length) void playNext(runRef.current);
    else playerRef.current?.stop();
  }, [playNext]);

  const addLog = (entry: Omit<LogEntry, 'id'>) => {
    logIdRef.current += 1;
    const id = logIdRef.current;
    setLog((l) => [{ ...entry, id }, ...l].slice(0, LOG_MAX));
  };

  const operatorPhrase = (key: string, file: string) => {
    const text = t(key);
    show([{ file, label: text }], text, []);
    addLog({ who: 'operator', text });
  };

  /** Своя фраза оператора: сперва целые проверенные фразы, потом слова; служебные слова пропускаются. */
  const operatorFree = () => {
    const text = freeText.trim();
    if (!text) return;
    const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean);
    const items: QueueItem[] = [];
    const noSign: string[] = [];
    for (const seg of splitVerifiedPhrases(words)) {
      if (seg.phrase) {
        items.push({ file: seg.phrase.file, label: seg.phrase.gloss.toLowerCase() });
        continue;
      }
      for (const w of seg.words) {
        if (TSON_SKIP.has(w)) continue;
        const file = resolveVerifiedSign(w);
        if (file) items.push({ file, label: w });
        else noSign.push(w);
      }
    }
    show(items, text, noSign);
    addLog({ who: 'operator', text });
    setFreeText('');
  };

  const replay = () => {
    const last = lastRef.current;
    if (last) show(last.items, last.caption, last.missing);
  };

  const citizenSays = (text: string) => {
    const s = text.trim();
    if (!s) return;
    setReply(s);
    addLog({ who: 'citizen', text: s });
    if (speak && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(s);
      u.lang = SPEECH_LANG[lang];
      window.speechSynthesis.speak(u);
    }
  };

  const phraseCount = TSON_DECK.reduce((n, g) => n + g.phrases.length, 0);

  return (
    <div className="qyran-translator">
      <div className="shell">
        <header className="topbar">
          <div className="topbar-inner">
            <button className="iconbtn" onClick={onBack} aria-label="Back" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="title-row">
              <span className="brand-q mono">Q</span>
              <span className="page-title">{t('tson.title')}</span>
              <span className="page-sub mono dim">{t('tson.sub')}</span>
            </div>
            <div className="spacer" />
            <ThemeToggle />
            <LangSwitcher />
          </div>
        </header>

        <section className="grid" style={{ alignItems: 'start' }}>
          {/* Елнар и крупная подпись — сторона гражданина */}
          <div>
            <div className="stage">
              <div className="stage-grid" />
              <div className="stage-floor" />
              <div className="stage-head">
                <span className="stage-tag mono">{current ?? t('tson.stage.idle')}</span>
                <span className="stage-tag mono">{avatarLoaded ? 'ЕЛНАР' : t('translator.stage.loadingTag')}</span>
              </div>
              <div ref={containerRef} className="avatar-wrap" />
              {!avatarLoaded && (
                <div className="stage-loading">
                  <div className="spinner" />
                </div>
              )}
            </div>

            <div className="panel" style={{ marginTop: 12 }}>
              <div aria-live="polite" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.25, minHeight: 35 }}>
                {caption ?? <span className="dim" style={{ fontSize: 16, fontWeight: 400 }}>{t('tson.caption.idle')}</span>}
              </div>
              {missing.length > 0 && (
                <div className="dim" style={{ fontSize: 13, marginTop: 6 }}>
                  {t('tson.free.noSign', { w: missing.join(', ') })}
                </div>
              )}
              <div className="speed-row" style={{ marginTop: 14 }}>
                <span className="speed-label mono dim">{t('translator.speed.label')}</span>
                <div className="seg">
                  {SPEEDS.map((s) => (
                    <button key={s} type="button" className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>
                      {s}×
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="chip"
                  style={{ marginLeft: 'auto' }}
                  onClick={replay}
                  disabled={!avatarLoaded || !caption}
                >
                  ↻ {t('tson.replay')}
                </button>
              </div>
            </div>
          </div>

          {/* Оператор, ответ гражданина, ход диалога */}
          <div>
            <div className="panel">
              <div className="panel-head">
                <div className="panel-h">
                  <span className="num">1</span>{t('tson.operator.title')}
                </div>
                <span className="page-sub mono" style={{ fontSize: 11 }}>{t('tson.operator.count', { n: phraseCount })}</span>
              </div>
              <p className="dim" style={{ fontSize: 12, margin: '0 0 12px' }}>{t('tson.operator.hint')}</p>
              {TSON_DECK.map((g) => (
                <div key={g.title} style={{ marginBottom: 12 }}>
                  <div className="mono dim" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                    {t(g.title)}
                  </div>
                  <div className="suggestions" style={{ marginTop: 0 }}>
                    {g.phrases.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        className="chip"
                        style={AUDITED_FILES.has(p.file) ? undefined : { borderStyle: 'dashed' }}
                        disabled={!avatarLoaded}
                        onClick={() => operatorPhrase(p.key, p.file)}
                      >
                        ▶ {t(p.key)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <div className="input-row" style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={freeText}
                    placeholder={t('tson.free.placeholder')}
                    onChange={(e) => setFreeText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') operatorFree(); }}
                    style={{ width: '100%' }}
                  />
                </div>
                <button
                  type="button"
                  className="btn-translate"
                  style={{ flex: '0 0 auto', padding: '12px 18px' }}
                  onClick={operatorFree}
                  disabled={!avatarLoaded || !freeText.trim()}
                >
                  {t('tson.free.go')}
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <div className="panel-h">
                  <span className="num">2</span>{t('tson.citizen.title')}
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={speak} onChange={(e) => setSpeak(e.target.checked)} />
                  {t('tson.citizen.speak')}
                </label>
              </div>
              <p className="dim" style={{ fontSize: 12, margin: '0 0 12px' }}>{t('tson.citizen.hint')}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                {TSON_REPLIES.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="chip"
                    style={{ fontSize: 16, padding: '14px 12px', borderRadius: 12, color: 'var(--text)' }}
                    onClick={() => citizenSays(t(key))}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <div className="input-row" style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={citizenText}
                    placeholder={t('tson.citizen.placeholder')}
                    onChange={(e) => setCitizenText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { citizenSays(citizenText); setCitizenText(''); }
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
                <button
                  type="button"
                  className="btn-translate"
                  style={{ flex: '0 0 auto', padding: '12px 18px' }}
                  onClick={() => { citizenSays(citizenText); setCitizenText(''); }}
                  disabled={!citizenText.trim()}
                >
                  {t('tson.citizen.send')}
                </button>
              </div>
              {reply && (
                <div
                  aria-live="polite"
                  style={{
                    marginTop: 12,
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: '1px solid var(--accent)',
                    fontSize: 26,
                    fontWeight: 600,
                    lineHeight: 1.25,
                  }}
                >
                  {reply}
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-head">
                <div className="panel-h">
                  <span className="num">3</span>{t('tson.log.title')}
                </div>
                <button type="button" className="chip" onClick={() => setLog([])} disabled={!log.length}>
                  {t('tson.log.clear')}
                </button>
              </div>
              {log.length === 0 ? (
                <p className="dim" style={{ fontSize: 13, margin: 0 }}>{t('tson.log.empty')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {log.map((e) => (
                    <div key={e.id} style={{ fontSize: 14, display: 'flex', gap: 8 }}>
                      <span className="mono" style={{ fontSize: 11, minWidth: 78, color: e.who === 'operator' ? 'var(--accent)' : 'var(--warm)' }}>
                        {t(e.who === 'operator' ? 'tson.log.operator' : 'tson.log.citizen')}
                      </span>
                      <span>{e.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="dim" style={{ fontSize: 12, marginTop: 12 }}>{t('tson.verified.note')}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

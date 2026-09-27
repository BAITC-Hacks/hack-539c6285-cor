import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  loadAvatar, AVATARS, getSavedAvatarId, saveAvatarId, type AvatarId,
} from '@/lib/avatarLoader';
import { AvatarFace, IdleBody } from '@/lib/avatarLife';
import { computeSignerFraming, applyClipPlane } from '@/lib/avatarFraming';
import { GesturePlayer, fetchGesture, type GestureJSON } from '@/lib/gesturePlayer';
import { buildWordGesture, SIGN_WORDS } from '@/lib/signWords';
import { loadSlovoIndex } from '@/lib/slovoLibrary';
import { VERIFIED_SIGNS, VERIFIED_PHRASES } from '@/lib/verifiedSigns';
import { useTheme } from '@/app/context/ThemeContext';
import { useT } from '@/i18n';
import { ThemeToggle } from '@/app/components/shared/ThemeToggle';
import { LangSwitcher } from '@/app/components/shared/LangSwitcher';

/**
 * Словарь жестов — справочник в духе SpreadTheSign: поиск, алфавит, список
 * слов; выбранное слово показывает 3D-аватар (вместо видео, как у них).
 * Страница публичная: это витрина корпуса и инструмент обучения.
 */

interface Entry {
  label: string;        // как показываем в списке
  gestureName: string;  // 'slovo/<file>', 'слово:<лемма>' (процедурный) или файл проверенного жеста
  procedural?: boolean;
}

function firstLetter(label: string): string {
  const ch = label[0].toUpperCase();
  if (/[0-9]/.test(ch)) return '0–9';
  return ch;
}

const SPEEDS = [0.5, 0.75, 1, 1.5, 2];

export function DictionaryPage({ onBack }: { onBack: () => void }) {
  const t = useT();
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<GesturePlayer | null>(null);
  const faceRef = useRef<AvatarFace | null>(null);
  const idleBodyRef = useRef<IdleBody | null>(null);
  const sceneBgRef = useRef<THREE.Scene | null>(null);
  const gestureCacheRef = useRef<Record<string, GestureJSON>>({});

  const [avatarId, setAvatarId] = useState<AvatarId>(getSavedAvatarId);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Entry | null>(null);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);

  const speedRef = useRef(speed);
  const loopRef = useRef(loop);

  // ——— данные словаря: клипы SLOVO + процедурные слова ———
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out = new Map<string, Entry>();
      const idx = await loadSlovoIndex();
      if (idx) {
        for (const [word, file] of Object.entries(idx.words)) {
          out.set(word, { label: word, gestureName: `slovo/${file}` });
        }
        for (const [phrase, file] of Object.entries(idx.phrases)) {
          out.set(phrase, { label: phrase, gestureName: `slovo/${file}` });
        }
      }
      // Процедурный словарь — только слова, которых нет в SLOVO.
      for (const lemma of SIGN_WORDS) {
        if (!out.has(lemma)) {
          out.set(lemma, { label: lemma, gestureName: `слово:${lemma}`, procedural: true });
        }
      }
      // Проверенные жесты заменяют любой старый источник для своего слова.
      for (const [word, sign] of Object.entries(VERIFIED_SIGNS)) {
        out.set(word, { label: word, gestureName: sign.file });
      }
      // Проверенные фразы — одним жестом, как их показывают носители.
      for (const phrase of VERIFIED_PHRASES) {
        out.set(phrase.forms[0], { label: phrase.label, gestureName: phrase.file });
      }
      if (cancelled) return;
      const list = [...out.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
      setEntries(list);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { speedRef.current = speed; if (playerRef.current) playerRef.current.speed = speed; }, [speed]);
  useEffect(() => { loopRef.current = loop; if (playerRef.current) playerRef.current.loop = loop; }, [loop]);

  // ——— сцена с аватаром (пересоздаётся при смене аватара) ———
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setAvatarLoaded(false);

    const scene = new THREE.Scene();
    sceneBgRef.current = scene;
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

    loadAvatar(AVATARS[avatarId].url).then(({ root, bones }) => {
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
      playerRef.current.loop = loopRef.current;
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
      ro.disconnect();
      cancelAnimationFrame(raf);
      controls?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      playerRef.current = null;
      faceRef.current = null;
      idleBodyRef.current = null;
    };
  }, [avatarId]);

  // Фон сцены — вместе с темой.
  useEffect(() => {
    if (sceneBgRef.current) {
      const c = getComputedStyle(document.documentElement).getPropertyValue('--bg-elev').trim();
      sceneBgRef.current.background = c ? new THREE.Color(c) : null;
    }
  }, [theme, avatarId]);

  // ——— проигрывание выбранного слова ———
  const play = useCallback(async (entry: Entry) => {
    const player = playerRef.current;
    if (!player) return;
    setSelected(entry);
    let data = gestureCacheRef.current[entry.gestureName];
    if (!data) {
      if (entry.procedural) {
        const built = buildWordGesture(entry.label);
        if (!built) return;
        data = built;
      } else {
        try {
          data = await fetchGesture(entry.gestureName);
        } catch {
          return;
        }
      }
      gestureCacheRef.current[entry.gestureName] = data;
    }
    player.speed = speedRef.current;
    player.loop = loopRef.current;
    player.onEnd = () => {
      if (!loopRef.current) faceRef.current?.quiet();
    };
    player.load(data);
    if (data.frames.length) {
      const dur = data.frames[data.frames.length - 1].t / Math.max(speedRef.current, 0.1);
      faceRef.current?.say(entry.label, dur);
    }
  }, []);

  // ——— поиск и группировка по буквам ———
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.label.toLowerCase().includes(q));
  }, [entries, query]);

  const groups = useMemo(() => {
    const g = new Map<string, Entry[]>();
    for (const e of filtered) {
      const L = firstLetter(e.label);
      if (!g.has(L)) g.set(L, []);
      g.get(L)!.push(e);
    }
    return [...g.entries()];
  }, [filtered]);

  const letters = useMemo(() => groups.map(([L]) => L), [groups]);

  const jumpTo = (letter: string) => {
    const el = listRef.current?.querySelector(`[data-letter="${letter}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
              <span className="page-title">{t('dictionary.title')}</span>
              <span className="page-sub mono dim">{t('dictionary.sub')}</span>
            </div>
            <div className="spacer" />
            <span role="group" aria-label={t('translator.avatar.pick')} style={{ display: 'inline-flex', gap: 4 }}>
              {(['adam', 'eva', 'elnar'] as AvatarId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="stage-tag mono"
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
            <ThemeToggle />
            <LangSwitcher />
          </div>
        </header>

        <section className="grid" style={{ alignItems: 'start' }}>
          {/* сцена с аватаром */}
          <div>
            <div className="stage">
              <div className="stage-grid" />
              <div className="stage-floor" />
              <div className="stage-head">
                <span className="stage-tag mono">
                  {selected ? selected.label.toUpperCase() : t('dictionary.hint')}
                </span>
                <span className="stage-tag mono">
                  {avatarLoaded ? '60 FPS' : t('translator.stage.loadingTag')}
                </span>
              </div>
              <div ref={containerRef} className="avatar-wrap" />
              {!avatarLoaded && (
                <div className="stage-loading">
                  <div className="spinner" />
                </div>
              )}
            </div>

            <div className="panel" style={{ marginTop: 12 }}>
              <div className="speed-row">
                <span className="speed-label mono dim">{t('translator.speed.label')}</span>
                <div className="seg">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={speed === s ? 'on' : ''}
                      onClick={() => setSpeed(s)}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
                <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
                  {t('dictionary.loop')}
                </label>
              </div>
            </div>
          </div>

          {/* поиск + алфавит + список */}
          <div className="panel">
            <div className="panel-head">
              <span className="panel-h">{t('dictionary.title')}</span>
              <span className="mono dim" style={{ fontSize: 12 }}>
                {t('dictionary.count', { n: String(entries.length) })}
              </span>
            </div>
            <div className="input-row">
              <input
                type="text"
                value={query}
                placeholder={t('dictionary.search')}
                onChange={(e) => setQuery(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, margin: '10px 0' }}>
              {letters.map((L) => (
                <button
                  key={L}
                  type="button"
                  className="mono dim"
                  onClick={() => jumpTo(L)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 12 }}
                >
                  {L}
                </button>
              ))}
            </div>
            <div ref={listRef} style={{ maxHeight: '52vh', overflowY: 'auto', paddingRight: 6 }}>
              {groups.length === 0 && (
                <div className="dim" style={{ padding: 12 }}>{t('dictionary.nothing')}</div>
              )}
              {groups.map(([L, list]) => (
                <div key={L} data-letter={L}>
                  <div className="mono dim" style={{ fontSize: 12, padding: '10px 4px 4px', borderBottom: '1px solid var(--line, #8882)' }}>
                    {L}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 0' }}>
                    {list.map((e) => (
                      <button
                        key={e.gestureName + e.label}
                        type="button"
                        className="chip"
                        onClick={() => play(e)}
                        style={selected?.label === e.label ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
                      >
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

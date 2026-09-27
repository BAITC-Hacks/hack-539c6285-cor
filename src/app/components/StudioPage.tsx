import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  loadAvatar, AVATARS, getSavedAvatarId, saveAvatarId, type AvatarId,
} from '@/lib/avatarLoader';
import { GesturePlayer } from '@/lib/gesturePlayer';
import { useGestureCapture } from '@/hooks/useGestureCapture';
import { type GestureJSON } from '@/lib/retarget';
import { solvePose, readBoneDeltas, captureRest, PoseSmoother, isArmTracked } from '@/lib/poseSolver';
import { computeSignerFraming, applyClipPlane } from '@/lib/avatarFraming';
import { saveGesture, listMyGestures, type SavedGesture, type SignLanguage } from '@/lib/gestureStore';
import { ThemeToggle } from '@/app/components/shared/ThemeToggle';
import { LangSwitcher } from '@/app/components/shared/LangSwitcher';
import { useT } from '@/i18n';

interface StudioPageProps {
  onBack: () => void;
}

type Stage = 'idle' | 'recording' | 'review';

export function StudioPage({ onBack }: StudioPageProps) {
  const t = useT();
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<GesturePlayer | null>(null);
  const bonesRef = useRef<Map<string, THREE.Bone> | null>(null);
  const restRef = useRef<Map<string, THREE.Euler> | null>(null);
  // Живое управление — производная от этапа, а не отдельный флаг: пока мы
  // не смотрим запись, аватар слушает камеру. Отдельный флаг рассинхронивался
  // с этапом (например, после неудачной записи), и аватар молча замирал.
  const stageRef = useRef<Stage>('idle');
  const isLive = () => stageRef.current !== 'review';
  const smootherRef = useRef(new PoseSmoother(0.45));
  const handsRef = useRef({ left: false, right: false });
  const sceneRef = useRef<{ renderer?: THREE.WebGLRenderer; controls?: OrbitControls }>({});

  // Аватар повторяет за человеком в реальном времени: каждый кадр трекинга
  // напрямую ставит кости скелета.
  const onLiveFrame = useCallback((frame: Float32Array, visibility: Float32Array) => {
    const left = isArmTracked(frame, 'left', visibility);
    const right = isArmTracked(frame, 'right', visibility);
    handsRef.current = { left, right };
    if (!isLive()) return;
    const bones = bonesRef.current;
    if (!bones) return;
    solvePose(frame, bones, { visibility, smoother: smootherRef.current, mirrored: false });
  }, []);

  // Геометрию НЕ зеркалим.
  //
  // MediaPipe видит прямой кадр с камеры и уже размечает руки анатомически:
  // leftHandLandmarks — это левая рука человека, кто бы куда ни повернулся.
  // Зеркальным пользователю показывается только видео, и делает это CSS
  // (scaleX(-1) на канвасе). Если вдобавок отражать координаты, кисть
  // становится геометрически противоположной: разводишь пальцы — на аватаре
  // сходятся, сводишь — расходятся.
  const capture = useGestureCapture(false, onLiveFrame);

  const [stage, setStage] = useState<Stage>('idle');
  const [avatarId, setAvatarId] = useState<AvatarId>(getSavedAvatarId);
  const [clip, setClip] = useState<GestureJSON | null>(null);
  const [rawFrames, setRawFrames] = useState<Float32Array[]>([]);
  const [word, setWord] = useState('');
  // Проект работает только с РЖЯ — выбирать язык записи не из чего.
  const language: SignLanguage = 'rsl';
  const [consent, setConsent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myGestures, setMyGestures] = useState<SavedGesture[]>([]);
  const [hands, setHands] = useState({ left: false, right: false });

  // Единственный источник правды об этапе — stage; ref нужен, чтобы читать его
  // из колбэка трекинга, который живёт вне рендера.
  useEffect(() => { stageRef.current = stage; }, [stage]);

  // Индикатор рук обновляем 5 раз в секунду: на каждом кадре — лишние
  // перерисовки всего экрана.
  useEffect(() => {
    const id = setInterval(() => {
      const h = handsRef.current;
      setHands((prev) => (prev.left === h.left && prev.right === h.right ? prev : { ...h }));
    }, 200);
    return () => clearInterval(id);
  }, []);

  // ---- 3D превью аватара -------------------------------------------------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    // Фон сцены не задаём: канвас прозрачный, и цвет за аватаром берётся из
    // CSS-фона контейнера (var(--surface-2)). Так превью переключается вместе
    // с темой само, без второго списка цветов на стороне three.js.
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;   // до первого рендера
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);
    sceneRef.current.renderer = renderer;

    // Это источники света, а не палитра интерфейса: белый ключевой свет и
    // чуть синеватая «земля» лепят объём на модели. Токенами темы их красить
    // нельзя — аватар окрасился бы в цвет кнопок.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2, 4, 3);
    scene.add(key);

    let disposed = false;
    let raf = 0;

    loadAvatar(AVATARS[avatarId].url).then(({ root, bones }) => {
      if (disposed) return;
      scene.add(root);
      root.updateMatrixWorld(true);

      const box = new THREE.Box3();
      const tmp = new THREE.Vector3();
      for (const bone of bones.values()) {
        bone.getWorldPosition(tmp);
        if (Number.isFinite(tmp.y)) box.expandByPoint(tmp);
      }
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Тот же кадр, что в переводчике: низ спрятан, кисти видны целиком.
      const framing = computeSignerFraming(bones, camera.fov, camera.aspect);
      applyClipPlane(root, framing.clipPlane);

      const dist = framing.distance;
      camera.position.set(center.x, framing.focusY, center.z + dist);
      camera.near = Math.max(dist / 500, 0.01);
      camera.far = dist * 50;
      camera.updateProjectionMatrix();

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(center.x, framing.focusY, center.z);
      controls.enableDamping = true;
      controls.minDistance = dist * 0.45;
      controls.maxDistance = dist * 2.2;
      controls.update();
      sceneRef.current.controls = controls;

      playerRef.current = new GesturePlayer(bones);
      playerRef.current.loop = true;
      bonesRef.current = bones;
      restRef.current = captureRest(bones);
    }).catch(() => setError(t('studio.error.avatarLoad')));

    const resize = () => {
      const w = mount.clientWidth;
      const hgt = mount.clientHeight;
      if (!w || !hgt) return;
      renderer.setSize(w, hgt, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / hgt;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const tick = () => {
      // При живом управлении позу задаёт solvePose из onResults, плеер молчит.
      if (!isLive()) playerRef.current?.update();
      sceneRef.current.controls?.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      sceneRef.current.controls?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarId]);

  // ---- камера ------------------------------------------------------------
  useEffect(() => {
    capture.start();
    return () => capture.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listMyGestures().then(setMyGestures).catch(() => {});
  }, []);

  // ---- запись ------------------------------------------------------------
  const finishRecording = useCallback(() => {
    const frames = capture.stopRecording();
    setStage('idle');
    if (frames.length === 0) {
      setError(t('studio.error.tooShort'));
      return;
    }
    const bones = bonesRef.current;
    const rest = restRef.current;
    if (!bones || !rest) {
      setError(t('studio.error.avatarNotReady'));
      return;
    }
    try {
      const gesture = buildGesture(frames, bones, rest, {
        name: word.trim() || 'untitled',
        durationSec: capture.lastDurationSec || frames.length / 30,
        visibility: capture.recordedVisibility(),
      });
      setClip(gesture);
      setRawFrames(frames);
      setStage('review');
      setError(null);
      playerRef.current?.load(gesture);
    } catch (e: any) {
      setError(t('studio.error.processFailed', { reason: e.message }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture, word, t]);

  /** Прогоняет записанные кадры через решатель и собирает клип для плеера. */
  function buildGesture(
    frames: Float32Array[],
    bones: Map<string, THREE.Bone>,
    rest: Map<string, THREE.Euler>,
    opts: { name: string; durationSec: number; visibility?: Float32Array[] },
  ): GestureJSON {
    const step = frames.length > 90 ? 3 : frames.length > 45 ? 2 : 1;
    const dur = Math.min(Math.max(opts.durationSec, 0.8), 6);
    const ease = 0.35;

    // Своё сглаживание для записи: живой фильтр уже «ушёл» по времени вперёд.
    const smoother = new PoseSmoother(0.5);
    const body: GestureJSON['frames'] = [];
    for (let i = 0; i < frames.length; i += step) {
      if (!solvePose(frames[i], bones, {
        visibility: opts.visibility?.[i],
        smoother,
        mirrored: false,         // записываются те же незеркалёные кадры
      })) continue;
      const t2 = ease + (i / Math.max(frames.length - 1, 1)) * dur;
      body.push({ t: Math.round(t2 * 1000) / 1000, bones: readBoneDeltas(bones, rest) });
    }
    // Текст ошибки виден человеку — он подставляется в studio.error.processFailed.
    if (body.length < 2) throw new Error(t('studio.error.noTorso'));

    // Опоры покоя с обоих концов, иначе плеер стартует рывком.
    const zeros: Record<string, [number, number, number]> = {};
    for (const b of Object.keys(body[0].bones)) zeros[b] = [0, 0, 0];
    return {
      name: opts.name,
      fps_target: 30,
      rotation_order: 'XYZ',
      unit: 'radians',
      // Служебное поле самого клипа, а не подпись на экране: оно уезжает в
      // хранилище и не должно зависеть от языка интерфейса.
      description: 'Запись с камеры',
      frames: [
        { t: 0, bones: zeros },
        ...body,
        { t: Math.round((ease + dur + ease) * 1000) / 1000, bones: zeros },
      ],
    };
  }

  const beginRecording = useCallback(() => {
    if (!capture.cameraReady || !capture.holisticReady) return;
    setError(null);
    setMessage(null);
    playerRef.current?.stop();
    capture.startRecording();
    setStage('recording');
  }, [capture]);

  // Пробел: зажал — пишем, отпустил — стоп.
  useEffect(() => {
    const isTyping = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');

    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isTyping(e.target)) return;
      e.preventDefault();
      beginRecording();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTyping(e.target)) return;
      e.preventDefault();
      if (stage === 'recording') finishRecording();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [beginRecording, finishRecording, stage]);

  const replay = () => {
    if (!clip) return;
    playerRef.current?.load(clip);
  };

  const discard = () => {
    setClip(null);
    setRawFrames([]);
    setStage('idle');
    playerRef.current?.stop();
  };

  const save = async () => {
    if (!clip || !word.trim()) {
      setError(t('studio.error.needWord'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveGesture({
        word: word.trim(),
        language,
        clip: { ...clip, name: word.trim() },
        landmarks: rawFrames,
        consentTraining: consent,
        durationMs: Math.round((capture.lastDurationSec || 0) * 1000),
      });
      setMessage(t('studio.msg.saved', { word: saved.word }));
      setMyGestures((prev) => [saved, ...prev.filter((g) => g.id !== saved.id)]);
      setWord('');
      discard();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const status = capture.error
    ? capture.error
    : !capture.cameraReady ? t('studio.status.camera')
    : !capture.holisticReady ? t('studio.status.tracking')
    : stage === 'review' ? t('studio.status.review')
    : !hands.left && !hands.right
      ? t('studio.status.noHands')
    : stage === 'recording' ? t('studio.status.recording')
    : t('studio.status.idle');

  const handsBadge = hands.left && hands.right ? t('studio.hands.both')
    : hands.left ? t('studio.hands.left')
    : hands.right ? t('studio.hands.right')
    : t('studio.hands.none');
  const handsOk = hands.left || hands.right;
  const liveBadge = stage === 'review' ? t('studio.live.playback') : t('studio.live.camera');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <header
        className="between"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="row" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={onBack} aria-label={t('common.back')} style={btnGhost}>←</button>
          <strong>{t('studio.title')}</strong>
          <span className="mono dim" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            / {t('studio.subtitle')}
          </span>
        </div>
        <div className="row" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="mono" style={{
            fontSize: 12,
            color: stage === 'recording' ? 'var(--warm)' : 'var(--text-dim)',
          }}>
            {status}
          </span>
          <ThemeToggle compact />
          <LangSwitcher />
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px,1fr) minmax(320px,1fr)', gap: 20, padding: 24 }}>
        {/* камера */}
        <section style={panel}>
          <div className="mono dim" style={label}>{t('studio.panel.camera')}</div>
          <div style={{
            position: 'relative', aspectRatio: '4/3',
            background: 'var(--surface-2)', borderRadius: 'var(--r-btn)', overflow: 'hidden',
          }}>
            <video ref={capture.videoRef} playsInline muted style={{ display: 'none' }} />
            <canvas
              ref={capture.canvasRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
            {stage === 'recording' && (
              <div style={recBadge}>
                <span style={recDot} /> REC · {t('studio.rec.frames', { count: capture.frameCount })}
              </div>
            )}
            <div style={{
              ...recBadge,
              top: 'auto', bottom: 10,
              color: handsOk ? 'var(--ok)' : 'var(--danger)',
            }}>
              <span style={{
                ...recDot,
                background: handsOk ? 'var(--ok)' : 'var(--danger)',
              }} />
              {handsBadge}
            </div>
          </div>
          <button
            onMouseDown={beginRecording}
            onMouseUp={() => stage === 'recording' && finishRecording()}
            onMouseLeave={() => stage === 'recording' && finishRecording()}
            disabled={!capture.cameraReady || !capture.holisticReady}
            style={{ ...btnPrimary, width: '100%', marginTop: 12 }}
          >
            {stage === 'recording' ? t('studio.record.stop') : t('studio.record.start')}
          </button>
        </section>

        {/* аватар */}
        <section style={panel}>
          <div className="between" style={{ alignItems: 'baseline' }}>
            <div className="mono dim" style={label}>{t('studio.panel.avatar')}</div>
            <div role="group" aria-label={t('translator.avatar.pick')} style={{ display: 'inline-flex', gap: 6 }}>
              {(['adam', 'eva', 'elnar'] as AvatarId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="mono"
                  style={{
                    ...label,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: avatarId === id ? 'var(--accent)' : 'var(--text-mute)',
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
            </div>
            <div className="mono" style={{
              ...label,
              color: stage === 'review' ? 'var(--text-mute)' : 'var(--ok)',
            }}>
              {liveBadge}
            </div>
          </div>
          <div
            ref={mountRef}
            style={{
              aspectRatio: '4/3', background: 'var(--surface-2)',
              borderRadius: 'var(--r-btn)', overflow: 'hidden',
            }}
          />
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button onClick={replay} disabled={!clip} style={btnGhost}>{t('studio.action.replay')}</button>
            <button onClick={discard} disabled={!clip} style={btnGhost}>{t('studio.action.rerecord')}</button>
            {clip && (
              <span className="mono dim" style={{ fontSize: 12, alignSelf: 'center', color: 'var(--text-dim)' }}>
                {t('studio.clip.keys', { count: clip.frames.length })}
              </span>
            )}
          </div>
        </section>
      </div>

      {/* сохранение */}
      <div style={{ padding: '0 24px 24px' }}>
        <section style={panel}>
          <div className="mono dim" style={label}>{t('studio.panel.save')}</div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder={t('studio.input.placeholder')}
              style={input}
            />
            <button onClick={save} disabled={!clip || saving || !word.trim()} style={btnPrimary}>
              {saving ? t('studio.action.saving') : t('studio.action.save')}
            </button>
          </div>
          <label className="row" style={{ gap: 8, marginTop: 12, fontSize: 14, alignItems: 'center' }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            {t('studio.consent.label')}
          </label>
          {error && <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}
          {message && <p style={{ color: 'var(--ok)', fontSize: 14 }}>{message}</p>}
        </section>

        {myGestures.length > 0 && (
          <section style={{ ...panel, marginTop: 20 }}>
            <div className="mono dim" style={label}>{t('studio.panel.myGestures')} · {myGestures.length}</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {myGestures.map((g) => (
                <span key={g.id} style={chip}>
                  {g.word}
                  <span className="mono dim" style={{ fontSize: 11, marginLeft: 6, color: 'var(--text-dim)' }}>
                    {g.language}
                  </span>
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-card)',
  padding: 16,
};
const label: React.CSSProperties = { fontSize: 11, letterSpacing: '0.1em', marginBottom: 10 };
const btnPrimary: React.CSSProperties = {
  background: 'var(--grad-brand)',
  // Подпись на градиенте — цветом фона страницы: в тёмной теме тёмная надпись
  // на светлом градиенте, в светлой — светлая на тёмном. Контраст сохраняется
  // в обеих темах без отдельного «цвета текста на акценте».
  color: 'var(--bg)', border: 'none', borderRadius: 'var(--r-btn)',
  padding: '10px 18px', fontWeight: 600, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  background: 'transparent', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 'var(--r-btn)',
  padding: '8px 14px', cursor: 'pointer',
};
const input: React.CSSProperties = {
  flex: '1 1 260px', background: 'var(--bg-elev)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 'var(--r-btn)', padding: '10px 14px',
};
const chip: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 'var(--r-pill)',
  padding: '5px 12px', fontSize: 13,
};
const recBadge: React.CSSProperties = {
  position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 8,
  // Плашка лежит поверх картинки с камеры, поэтому подложка — полупрозрачный
  // фон страницы: в тёмной теме затемняет, в светлой засветляет, и надпись
  // цветом var(--text) читается в обеих.
  background: 'color-mix(in srgb, var(--bg) 72%, transparent)',
  color: 'var(--text)',
  borderRadius: 'var(--r-pill)', padding: '5px 12px',
  fontSize: 12, fontFamily: 'ui-monospace, monospace',
};
const recDot: React.CSSProperties = {
  width: 8, height: 8, borderRadius: 'var(--r-pill)', background: 'var(--danger)',
  display: 'inline-block',
};

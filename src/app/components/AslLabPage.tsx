import { useState, useRef, useEffect, useCallback } from 'react';
import { AslDactyl, type AslTickResult } from '@/lib/aslDactyl';
import {
  NUM_HAND, LEFT_HAND_OFFSET, RIGHT_HAND_OFFSET, FRAME_FEATURES,
} from '@/lib/landmarks';
import { useT } from '@/i18n';
import { ThemeToggle } from '@/app/components/shared/ThemeToggle';
import { LangSwitcher } from '@/app/components/shared/LangSwitcher';

/**
 * Лаборатория ASL-дактиля: отдельная страница «проверить, как это работает».
 *
 * Камера -> MediaPipe Holistic (нам нужны только кисти) -> ASL-голова A-Z.
 * Крупная буква с прогрессом удержания, набранная строка, топ-5 кандидатов.
 * Страница публичная (?view=asl) — это витрина/стенд, логин не нужен.
 */

const SEND_MIN_INTERVAL_MS = 33;
const TICK_MS = 140;

export function AslLabPage({ onBack }: { onBack: () => void }) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const holisticRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef(0);
  const lastSendRef = useRef(0);
  const lastFrameRef = useRef<{ t: number; frame: Float32Array } | null>(null);
  const aslRef = useRef<AslDactyl | null>(null);

  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [handSeen, setHandSeen] = useState(false);
  const [text, setText] = useState('');
  const [top, setTop] = useState<AslTickResult['top']>([]);
  const [error, setError] = useState<string | null>(null);

  // Модель + трекинг — грузим сразу: страница только про это.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ Holistic }, asl] = await Promise.all([
          import('@mediapipe/holistic'),
          AslDactyl.load(),
        ]);
        if (cancelled) return;
        aslRef.current = asl;
        const holistic = new Holistic({
          locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`,
        });
        holistic.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
          refineFaceLandmarks: false,
        });
        holistic.onResults((results: any) => {
          // Кадр 255 в раскладке проекта — заполняем только кисти, остальное нули.
          const frame = new Float32Array(FRAME_FEATURES);
          const put = (lms: any, off: number) => {
            if (!lms) return;
            for (let i = 0; i < NUM_HAND; i++) {
              frame[off + i * 3] = lms[i].x;
              frame[off + i * 3 + 1] = lms[i].y;
              frame[off + i * 3 + 2] = lms[i].z;
            }
          };
          put(results.leftHandLandmarks, LEFT_HAND_OFFSET);
          put(results.rightHandLandmarks, RIGHT_HAND_OFFSET);
          lastFrameRef.current = { t: performance.now(), frame };
        });
        holisticRef.current = holistic;
        setReady(true);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Цикл камеры -> holistic.send, как в распознавателе.
  useEffect(() => {
    if (!running) return;
    let live = true;
    const loop = async () => {
      if (!live || !videoRef.current || !holisticRef.current) return;
      if (videoRef.current.readyState >= 2) {
        const now = performance.now();
        if (now - lastSendRef.current >= SEND_MIN_INTERVAL_MS) {
          lastSendRef.current = now;
          try { await holisticRef.current.send({ image: videoRef.current }); } catch { /* teardown */ }
        }
      }
      if (live) animRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => { live = false; cancelAnimationFrame(animRef.current); };
  }, [running]);

  // Решающий тикер букв.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const asl = aslRef.current;
      const last = lastFrameRef.current;
      if (!asl || !last || performance.now() - last.t > 500) return;
      let alive = false;
      for (let i = LEFT_HAND_OFFSET; i < FRAME_FEATURES; i++) {
        if (last.frame[i] !== 0) { alive = true; break; }
      }
      setHandSeen(alive);
      const r = asl.tick(last.frame);
      if (!r) {
        setLetter(null); setProgress(0);
        return;
      }
      setLetter(r.letter);
      setProgress(r.progress);
      setTop(r.top);
      if (r.committed === 'DEL') setText((s) => s.slice(0, -1));
      else if (r.committed) setText((s) => s + r.committed);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);

  const toggle = useCallback(async () => {
    if (running) {
      setRunning(false);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      aslRef.current?.reset();
      setLetter(null); setProgress(0); setHandSeen(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      aslRef.current?.reset();
      lastSendRef.current = 0;
      setRunning(true);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }, [running]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((tr) => tr.stop()); }, []);

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
              <span className="page-title">{t('asl.title')}</span>
              <span className="page-sub mono dim">{t('asl.sub')}</span>
            </div>
            <div className="spacer" />
            <ThemeToggle />
            <LangSwitcher />
          </div>
        </header>

        <section className="grid" style={{ alignItems: 'start' }}>
          {/* камера */}
          <div>
            <div className="stage" style={{ minHeight: 420 }}>
              <div className="stage-grid" />
              <div className="stage-head">
                <span className="stage-tag mono">{t('asl.cameraTag')}</span>
                <span className="stage-tag mono" style={handSeen ? { color: 'var(--ok)' } : undefined}>
                  {handSeen ? t('asl.handYes') : t('asl.handNo')}
                </span>
              </div>
              <video
                ref={videoRef}
                playsInline
                muted
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'contain', transform: 'scaleX(-1)',
                }}
              />
              {/* крупная буква с кольцом прогресса */}
              {running && (
                <div style={{
                  position: 'absolute', right: 18, bottom: 18, width: 110, height: 110,
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'color-mix(in srgb, var(--bg-elev) 82%, transparent)',
                  border: '3px solid var(--accent)',
                  backgroundImage: `conic-gradient(var(--accent) ${progress * 360}deg, transparent 0deg)`,
                }}>
                  <div style={{
                    width: 92, height: 92, borderRadius: '50%', background: 'var(--bg-elev)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 52, fontWeight: 700, color: 'var(--accent)',
                  }}>
                    {letter ?? '·'}
                  </div>
                </div>
              )}
            </div>

            <div className="row" style={{ gap: 10, marginTop: 12 }}>
              <button
                className={running ? 'btn btn-danger' : 'btn btn-brand'}
                onClick={toggle}
                disabled={!ready || !!error}
                style={{ padding: '12px 24px', fontSize: 15 }}
                type="button"
              >
                {running ? t('asl.stop') : ready ? t('asl.start') : t('asl.loading')}
              </button>
              {error && <span className="dim" style={{ alignSelf: 'center', color: 'var(--danger, #c33)' }}>{error}</span>}
            </div>
          </div>

          {/* набранная строка + топ-5 */}
          <div>
            <div className="panel">
              <div className="panel-head">
                <span className="panel-h">{t('asl.output')}</span>
                <button
                  className="chip"
                  onClick={() => setText('')}
                  disabled={!text}
                  type="button"
                >
                  {t('asl.clear')}
                </button>
              </div>
              <div className="mono" style={{
                minHeight: 84, fontSize: 34, letterSpacing: 4, padding: '12px 6px',
                wordBreak: 'break-all',
              }}>
                {text || <span className="dim" style={{ fontSize: 15, letterSpacing: 0 }}>{t('asl.hint')}</span>}
                {running && <span style={{ opacity: 0.5 }}>▌</span>}
              </div>
            </div>

            <div className="panel" style={{ marginTop: 12 }}>
              <div className="panel-head"><span className="panel-h">{t('asl.top')}</span></div>
              {top.length === 0 && <div className="dim" style={{ padding: 8, fontSize: 13 }}>—</div>}
              {top.map(({ label, confidence }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 2px' }}>
                  <span className="mono" style={{ width: 20, fontWeight: 700 }}>{label}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--surface-2, #8882)' }}>
                    <div style={{
                      width: `${Math.round(confidence * 100)}%`, height: '100%',
                      borderRadius: 3, background: 'var(--accent)',
                    }} />
                  </div>
                  <span className="mono dim" style={{ fontSize: 12, width: 40, textAlign: 'right' }}>
                    {(confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>

            <div className="panel" style={{ marginTop: 12 }}>
              <div className="dim" style={{ fontSize: 13, lineHeight: 1.5 }}>{t('asl.howto')}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

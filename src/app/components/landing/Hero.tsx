import { useEffect, useState } from 'react';
import { useT } from '@/i18n';
import { Icon } from './Icon';

const PHRASES = [
  { text: 'Good morning. How are you?', glyphs: ['👋', '☀️', '?'], lang: 'EN' },
  { text: 'Сәлеметсіз бе. Менің атым — Айдар.', glyphs: ['🤝', '✋', 'A'], lang: 'KZ' },
  { text: 'Добро пожаловать в Qyran.', glyphs: ['🤲', '🎯', '✨'], lang: 'RU' },
  { text: 'Where is the nearest pharmacy?', glyphs: ['👉', '🏥', '?'], lang: 'EN' },
];

function HandPose({ frame = 0 }: { frame?: number }) {
  const base: [number, number][] = [
    [50, 90], [44, 82], [38, 72], [32, 64], [28, 56],
    [46, 70], [44, 52], [42, 40], [40, 30],
    [54, 68], [54, 48], [54, 34], [54, 22],
    [62, 70], [64, 52], [66, 40], [68, 30],
    [70, 76], [74, 62], [78, 52], [80, 44],
  ];
  const off = Math.sin(frame / 14) * 1.2;
  const off2 = Math.cos(frame / 16) * 1.2;
  const pts = base.map(([x, y], i) => [x + (i % 2 ? off : off2), y + (i % 3 ? -off2 : off)] as [number, number]);
  const lines = [
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
    [0, 5], [5, 9], [9, 13], [13, 17], [0, 17],
  ];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }}>
      {lines.map((path, i) => (
        <polyline key={i} points={path.map((p) => pts[p].join(',')).join(' ')} fill="none" stroke="color-mix(in srgb, var(--accent) 55%, transparent)" strokeWidth="0.6" strokeLinecap="round" />
      ))}
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === 0 || i === 4 || i === 8 || i === 12 || i === 16 || i === 20 ? 1.6 : 1.1}
          fill={i === 0 ? 'var(--warm)' : 'var(--accent)'}
          opacity={i === 0 ? 1 : 0.85}
        />
      ))}
    </svg>
  );
}

function Waveform({ active = true }: { active?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28 }} aria-hidden="true">
      {Array.from({ length: 32 }).map((_, i) => {
        const h = active ? 4 + Math.abs(Math.sin(Date.now() / 220 + i)) * 22 : 4;
        return (
          <span
            key={i}
            style={{
              display: 'block',
              width: 3,
              height: h,
              borderRadius: 2,
              background: i < 8 ? 'var(--warm)' : i < 20 ? 'var(--accent)' : 'var(--text-mute)',
              opacity: active ? 1 : 0.4,
              transition: 'height .18s ease',
            }}
          />
        );
      })}
    </div>
  );
}

interface HeroProps {
  onTryTranslator?: () => void;
  onTryRecognizer?: () => void;
}

export function Hero({ onTryTranslator, onTryRecognizer }: HeroProps) {
  const t = useT();
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [glyphStep, setGlyphStep] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const phrase = PHRASES[phraseIdx];
    let i = 0;
    setTyped('');
    setGlyphStep(0);
    const typer = setInterval(() => {
      i += 1;
      setTyped(phrase.text.slice(0, i));
      if (i >= phrase.text.length) clearInterval(typer);
    }, 36);
    const stepper = setInterval(() => {
      setGlyphStep((s) => Math.min(phrase.glyphs.length, s + 1));
    }, 900);
    const next = setTimeout(() => {
      setPhraseIdx((p) => (p + 1) % PHRASES.length);
    }, 6800);
    return () => {
      clearInterval(typer);
      clearInterval(stepper);
      clearTimeout(next);
    };
  }, [phraseIdx]);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      setTick((t) => t + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const phrase = PHRASES[phraseIdx];

  return (
    <section id="top" className="section" style={{ paddingTop: 80, paddingBottom: 60 }}>
      <div className="container">
        <div className="pill" style={{ marginBottom: 24 }}>
          <span className="dot" />
          <span>{t('landing.hero.badge')}</span>
          <span style={{ color: 'var(--text-mute)' }}>·</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-mute)' }}>v0.9 · 2026</span>
        </div>

        <h1 className="h-display" style={{ margin: '0 0 22px' }}>
          {t('landing.hero.title.a')}<br />
          <span style={{ color: 'var(--text-dim)' }}>{t('landing.hero.title.b')}</span>
          <span className="grad-text">{t('landing.hero.title.c')}</span>
        </h1>

        <p style={{ maxWidth: 640, fontSize: 20, lineHeight: 1.5, color: 'var(--text-dim)', margin: '0 0 36px' }}>
          {t('landing.hero.sub')}
        </p>

        <div className="row" style={{ gap: 12, marginBottom: 64 }}>
          <button onClick={onTryTranslator} className="btn btn-brand">
            <Icon name="hand" size={14} /> {t('common.nav.translator')}
          </button>
          <button onClick={onTryRecognizer} className="btn btn-brand" style={{ background: 'linear-gradient(95deg, var(--warm) 0%, var(--accent) 100%)' }}>
            <Icon name="cam" size={14} /> {t('landing.hero.cta.recognizer')}
          </button>
          <a href="/?view=tson" className="btn btn-ghost"><Icon name="shield" size={14} /> {t('landing.hero.cta.tson')}</a>
          <a href="#how" className="btn btn-ghost"><Icon name="play" size={14} /> {t('landing.nav.how')}</a>
        </div>

        <div className="hero-demo" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 18, alignItems: 'stretch' }}>
          {/* LEFT — Speech to signs */}
          <div className="demo-stage" style={{ minHeight: 420 }}>
            <div className="between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              <span className="eyebrow">{t('landing.hero.left.title')}</span>
              <span className="row mono" style={{ fontSize: 11, color: 'var(--text-mute)', gap: 8 }}>
                <span style={{ padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4 }}>{phrase.lang}</span>
                <span>TTS · MediaPipe</span>
              </span>
            </div>

            <div style={{ padding: '24px 22px 80px', minHeight: 340, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="row" style={{ gap: 10 }}>
                <span style={{ display: 'inline-flex', width: 28, height: 28, borderRadius: 999, background: 'var(--bg-elev)', border: '1px solid var(--border)', alignItems: 'center', justifyContent: 'center', color: 'var(--warm)' }}><Icon name="mic" size={14} /></span>
                <Waveform />
                <span className="mono mute" style={{ marginLeft: 'auto', fontSize: 11 }}>0:0{Math.floor((tick / 60) % 6)}</span>
              </div>

              <div style={{ fontSize: 22, lineHeight: 1.35, letterSpacing: '-0.012em', minHeight: 80 }}>
                {typed}
                <span style={{ display: 'inline-block', width: 2, height: 20, background: 'var(--accent)', marginLeft: 3, verticalAlign: '-3px', animation: 'qyran-blink 1s steps(2) infinite' }} />
              </div>

              <div style={{ marginTop: 'auto' }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>{t('landing.hero.left.output')}</div>
                <div className="row" style={{ gap: 10 }}>
                  {phrase.glyphs.map((g, i) => (
                    <div
                      key={i}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        background: i < glyphStep
                          ? 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 16%, transparent), color-mix(in srgb, var(--warm) 6%, transparent))'
                          : 'var(--bg-elev)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 28,
                        transition: 'all .35s ease',
                        transform: i < glyphStep ? 'translateY(0)' : 'translateY(4px)',
                        opacity: i < glyphStep ? 1 : 0.35,
                        boxShadow: i === glyphStep - 1 ? '0 0 0 1px var(--accent-line), var(--shadow-glow)' : 'none',
                      }}
                    >
                      {g}
                    </div>
                  ))}
                  <div className="mono mute" style={{ marginLeft: 'auto', fontSize: 11, alignSelf: 'flex-end' }}>
                    {t('landing.hero.left.signed', { done: glyphStep, total: phrase.glyphs.length })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER — direction indicator */}
          <div className="hero-arrow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 4px', minWidth: 48 }}>
            <div style={{ width: 1, flex: 1, background: 'linear-gradient(180deg, transparent, var(--border), transparent)' }} />
            <div style={{ padding: '10px 12px', borderRadius: 999, background: 'var(--bg-elev)', border: '1px solid var(--border)', color: 'var(--warm)', boxShadow: 'var(--shadow-glow)', margin: '10px 0' }}>
              <Icon name="arrow-rl" size={18} />
            </div>
            <div style={{ width: 1, flex: 1, background: 'linear-gradient(180deg, transparent, var(--border), transparent)' }} />
          </div>

          {/* RIGHT — Signs to speech */}
          <div className="demo-stage" style={{ minHeight: 420 }}>
            <div className="between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              <span className="eyebrow">{t('landing.hero.right.title')}</span>
              <span className="row mono" style={{ fontSize: 11, color: 'var(--text-mute)', gap: 8 }}>
                <span className="row" style={{ gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--danger)', boxShadow: '0 0 8px var(--danger)' }} />
                  REC
                </span>
                <span>WebCam · TF.js</span>
              </span>
            </div>
            <div style={{ position: 'relative', height: 'calc(100% - 53px)', overflow: 'hidden' }}>
              <div className="scanline" />
              <div
                style={{
                  position: 'absolute',
                  inset: '18px 18px 88px',
                  borderRadius: 10,
                  background: 'radial-gradient(circle at 50% 60%, var(--surface) 0%, var(--bg) 80%)',
                  border: '1px dashed var(--border)',
                  overflow: 'hidden',
                }}
              >
                <HandPose frame={tick} />
                {[
                  { top: 8, left: 8 },
                  { top: 8, right: 8 },
                  { bottom: 8, left: 8 },
                  { bottom: 8, right: 8 },
                ].map((s, i) => (
                  <span key={i} style={{ position: 'absolute', width: 14, height: 14, border: '1.5px solid var(--warm)', ...s }} />
                ))}
                <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                  {[t('landing.hero.right.gloss'), '85%'].map((label, i) => (
                    <span
                      key={i}
                      className="mono"
                      style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'var(--warm-soft)', border: '1px solid var(--warm-line)', color: 'var(--warm)' }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="caption-bar" aria-live="polite">
                <span className="cc-tag">CC</span>
                <span style={{ flex: 1 }}>
                  {tick % 240 < 80
                    ? t('landing.hero.right.caption1')
                    : tick % 240 < 160
                      ? t('landing.hero.right.caption2')
                      : t('landing.hero.right.caption3')}
                  <span style={{ display: 'inline-block', width: 8, height: 14, background: 'var(--text)', marginLeft: 4, verticalAlign: '-2px', animation: 'qyran-blink 1s steps(2) infinite' }} />
                </span>
                <button aria-label={t('landing.hero.right.playAria')} className="btn" style={{ padding: '6px 10px', background: 'var(--text)', color: 'var(--bg)', borderRadius: 8, fontSize: 12 }}>
                  <Icon name="play" size={12} /> {t('landing.hero.right.speak')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="row" style={{ marginTop: 60, gap: 0, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          {[
            { num: '99.2%', label: t('landing.hero.stat.accuracy') },
            { num: '<50ms', label: t('landing.hero.stat.latency') },
            { num: '200+', label: t('landing.hero.stat.signs') },
            { num: '1', label: t('landing.hero.stat.languages') },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: '24px 24px', borderLeft: i ? '1px solid var(--border)' : 'none', minWidth: 200 }}>
              <div className="stat-num grad-text">{s.num}</div>
              <div className="dim" style={{ fontSize: 14, marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useT } from '@/i18n';
import { Icon } from './Icon';

export function Features() {
  const t = useT();

  return (
    <section id="features" className="section">
      <div className="container">
        <div style={{ marginBottom: 48 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>{t('landing.features.eyebrow')}</div>
          <h2 className="h1" style={{ margin: 0, maxWidth: 780 }}>
            {t('landing.features.title.a')}
            <br />
            <span className="dim">{t('landing.features.title.b')}</span>
          </h2>
        </div>

        <div className="bento">
          {/* Big — Two-way translator */}
          <div className="card-elev b-4" style={{ padding: 28, position: 'relative', overflow: 'hidden', minHeight: 340 }}>
            <div className="between" style={{ marginBottom: 18 }}>
              <span className="eyebrow">{t('landing.features.translator.eyebrow')}</span>
              <span className="mono mute" style={{ fontSize: 11 }}>{t('landing.features.translator.tag')}</span>
            </div>
            <h3 className="h2" style={{ margin: '0 0 8px', maxWidth: 480 }}>{t('landing.features.translator.title')}</h3>
            <p className="dim" style={{ margin: 0, maxWidth: 480, fontSize: 15.5 }}>
              {t('landing.features.translator.body')}
            </p>

            <div style={{ position: 'absolute', right: -20, bottom: -20, width: 380, height: 240, opacity: 0.9 }}>
              <svg viewBox="0 0 400 240" style={{ width: '100%', height: '100%' }}>
                <defs>
                  <linearGradient id="bg1" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="var(--accent)" stopOpacity="0.5" />
                    <stop offset="1" stopColor="var(--warm)" stopOpacity="0.5" />
                  </linearGradient>
                </defs>
                <path d="M40,160 C140,160 140,80 240,80 S360,160 380,160" fill="none" stroke="url(#bg1)" strokeWidth="1.5" />
                <path d="M40,180 C140,180 140,100 240,100 S360,180 380,180" fill="none" stroke="color-mix(in srgb, var(--text-mute) 30%, transparent)" strokeWidth="1" />
                <circle cx="40" cy="160" r="5" fill="var(--accent)" />
                <circle cx="380" cy="160" r="5" fill="var(--warm)" />
                <circle cx="40" cy="180" r="4" fill="color-mix(in srgb, var(--text-mute) 50%, transparent)" />
                <circle cx="380" cy="180" r="4" fill="color-mix(in srgb, var(--text-mute) 50%, transparent)" />
              </svg>
            </div>
          </div>

          {/* Latency */}
          <div className="card b-2" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 340 }}>
            <Icon name="bolt" size={22} style={{ color: 'var(--warm)' }} />
            <div className="stat-num" style={{ fontSize: 48 }}>
              &lt;50<span style={{ fontSize: 24 }}>ms</span>
            </div>
            <div className="dim" style={{ fontSize: 14, lineHeight: 1.5 }}>{t('landing.features.latency.body')}</div>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['landing.features.latency.step1', 'landing.features.latency.step2', 'landing.features.latency.step3', 'landing.features.latency.step4'].map((key, i) => (
                <div key={key} className="row mono" style={{ justifyContent: 'space-between', fontSize: 11, color: 'var(--text-mute)' }}>
                  <span>{t(key)}</span>
                  <span>{[12, 9, 18, 8][i]}ms</span>
                </div>
              ))}
            </div>
          </div>

          {/* Languages */}
          <div className="card b-2" style={{ padding: 24, minHeight: 240 }}>
            <Icon name="globe" size={22} style={{ color: 'var(--warm)' }} />
            <h3 className="h3" style={{ margin: '14px 0 6px' }}>{t('landing.features.langs.title')}</h3>
            <p className="dim" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              {t('landing.features.langs.body')}
            </p>
            <div className="row" style={{ marginTop: 14, gap: 6 }}>
              {['RSL'].map((l) => (
                <span key={l} className="mono" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--bg-elev)' }}>
                  {l}
                </span>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div className="card b-2" style={{ padding: 24, minHeight: 240 }}>
            <Icon name="shield" size={22} style={{ color: 'var(--warm)' }} />
            <h3 className="h3" style={{ margin: '14px 0 6px' }}>{t('landing.features.privacy.title')}</h3>
            <p className="dim" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{t('landing.features.privacy.body')}</p>
          </div>

          {/* Accessibility */}
          <div className="card b-2" style={{ padding: 24, minHeight: 240 }}>
            <Icon name="eye" size={22} style={{ color: 'var(--warm)' }} />
            <h3 className="h3" style={{ margin: '14px 0 6px' }}>WCAG AAA</h3>
            <p className="dim" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{t('landing.features.a11y.body')}</p>
            <div className="row mono" style={{ marginTop: 14, gap: 6, fontSize: 11, color: 'var(--text-mute)' }}>
              <Icon name="kbd" size={14} /> {t('landing.features.a11y.keys')}
            </div>
          </div>

          {/* Learn */}
          <div className="card b-3" style={{ padding: 24, minHeight: 200, display: 'flex', flexDirection: 'column' }}>
            <Icon name="cards" size={22} style={{ color: 'var(--warm)' }} />
            <h3 className="h3" style={{ margin: '14px 0 6px' }}>{t('landing.features.learn.title')}</h3>
            <p className="dim" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{t('landing.features.learn.body')}</p>
          </div>

          {/* Open */}
          <div className="card b-3" style={{ padding: 24, minHeight: 200, position: 'relative', overflow: 'hidden' }}>
            <Icon name="github" size={22} style={{ color: 'var(--warm)' }} />
            <h3 className="h3" style={{ margin: '14px 0 6px' }}>{t('landing.features.open.title')}</h3>
            <p className="dim" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{t('landing.features.open.body')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

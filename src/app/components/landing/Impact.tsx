import { useT } from '@/i18n';

export function Impact() {
  const t = useT();
  return (
    <section id="impact" className="section">
      <div className="container">
        <div
          className="card-elev impact-card"
          style={{ padding: '56px 56px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 48, alignItems: 'center' }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>{t('landing.impact.eyebrow')}</div>
            <blockquote
              style={{ margin: 0, fontSize: 28, lineHeight: 1.3, letterSpacing: '-0.018em', fontWeight: 500, textWrap: 'balance' }}
            >
              {t('landing.impact.quote')}
            </blockquote>
            <div className="row mute" style={{ marginTop: 20, fontSize: 13, gap: 8 }}>
              <span className="mono">{t('landing.impact.source')}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { num: '430K', label: t('landing.impact.stat1') },
              { num: '< 1%', label: t('landing.impact.stat2') },
              { num: '14', label: t('landing.impact.stat3') },
            ].map((s, i) => (
              <div key={i} className="between" style={{ padding: '18px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                <span className="dim" style={{ fontSize: 14, maxWidth: 240 }}>{s.label}</span>
                <span className="stat-num grad-text" style={{ fontSize: 36 }}>{s.num}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{t('landing.impact.builtWith')}</div>
          <div className="row" style={{ gap: 36, flexWrap: 'wrap', opacity: 0.7 }}>
            {['TensorFlow', 'MediaPipe', 'PyTorch', 'OpenCV', 'Supabase', 'Vite'].map((n) => (
              <span key={n} className="mono" style={{ fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>{n}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

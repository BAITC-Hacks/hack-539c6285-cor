import { Icon } from './Icon';
import { useT } from '@/i18n';

export function LandingFooter() {
  const t = useT();

  // «API» — название технологии, оно одинаково во всех трёх языках.
  const cols = [
    {
      title: t('landing.footer.col.product'),
      links: [
        t('landing.footer.link.translator'),
        t('landing.nav.learn'),
        t('landing.footer.link.avatar'),
        'API',
        t('landing.footer.link.changelog'),
      ],
    },
    {
      title: t('landing.footer.col.company'),
      links: [
        t('landing.footer.link.about'),
        t('landing.footer.link.team'),
        t('landing.footer.link.press'),
        t('landing.footer.link.contact'),
      ],
    },
    {
      title: t('landing.footer.col.resources'),
      links: [
        t('landing.footer.link.docs'),
        t('landing.footer.link.a11y'),
        t('landing.footer.link.privacy'),
        t('landing.footer.link.terms'),
      ],
    },
  ];
  return (
    <footer className="foot">
      <div className="container">
        <div className="foot-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 48, marginBottom: 60 }}>
          <div>
            <div className="row" style={{ gap: 10, marginBottom: 14 }}>
              <span
                style={{
                  display: 'inline-flex',
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'var(--grad-brand)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--on-brand)',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Q
              </span>
              <span style={{ fontWeight: 600 }}>Qyran</span>
            </div>
            <p className="dim" style={{ maxWidth: 300, fontSize: 14, lineHeight: 1.55, margin: '0 0 18px' }}>
              {t('landing.footer.tagline')}
            </p>
            <div className="row" style={{ gap: 8 }}>
              {['EN', 'RU', 'KZ'].map((l, i) => (
                <button
                  key={l}
                  className="mono"
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    background: i === 0 ? 'var(--bg-elev)' : 'transparent',
                    color: i === 0 ? 'var(--text)' : 'var(--text-dim)',
                    cursor: 'pointer',
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="eyebrow" style={{ marginBottom: 16 }}>{c.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.links.map((l) => (
                  <a key={l} href="#" style={{ fontSize: 14 }}>
                    {l}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="between" style={{ paddingTop: 24, borderTop: '1px solid var(--border)' }}>
          <span className="mute mono" style={{ fontSize: 12 }}>{t('landing.footer.copyright')}</span>
          <div className="row" style={{ gap: 16 }}>
            <a href="#"><Icon name="github" size={16} /></a>
            <span className="mute mono" style={{ fontSize: 12 }}>{t('landing.footer.version')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

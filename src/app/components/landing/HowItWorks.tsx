import { useT } from '@/i18n';
import { Icon } from './Icon';

export function HowItWorks() {
  const t = useT();

  const steps = [
    {
      n: '01',
      side: t('landing.how.s1.title'),
      body: t('landing.how.s1.body'),
      icon: 'mic' as const,
      meta: t('landing.how.s1.meta'),
    },
    {
      n: '02',
      side: t('landing.how.s2.title'),
      body: t('landing.how.s2.body'),
      icon: 'hand' as const,
      meta: t('landing.how.s2.meta'),
    },
    {
      n: '03',
      side: t('landing.how.s3.title'),
      body: t('landing.how.s3.body'),
      icon: 'cam' as const,
      meta: t('landing.how.s3.meta'),
    },
    {
      n: '04',
      side: t('landing.how.s4.title'),
      body: t('landing.how.s4.body'),
      icon: 'globe' as const,
      meta: t('landing.how.s4.meta'),
    },
  ];

  return (
    <section id="how" className="section">
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 60, alignItems: 'end', marginBottom: 56 }} className="how-header">
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>{t('landing.how.eyebrow')}</div>
            <h2 className="h1" style={{ margin: 0, maxWidth: 720 }}>
              {t('landing.how.title.a')}<br />
              <span className="dim">{t('landing.how.title.b')}</span>
            </h2>
          </div>
          <p className="dim" style={{ maxWidth: 420, fontSize: 17, justifySelf: 'end', textAlign: 'right' }}>
            {t('landing.how.lead')}
          </p>
        </div>

        <div className="how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {steps.map((s) => (
            <article key={s.n} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18, position: 'relative', overflow: 'hidden' }}>
              <div className="between">
                <span className="mono mute" style={{ fontSize: 12 }}>{s.n}</span>
                <span style={{ display: 'inline-flex', width: 32, height: 32, borderRadius: 8, background: 'var(--bg-elev)', border: '1px solid var(--border)', alignItems: 'center', justifyContent: 'center', color: 'var(--warm)' }}>
                  <Icon name={s.icon} size={16} />
                </span>
              </div>
              <h3 className="h3" style={{ margin: 0 }}>{s.side}</h3>
              <p className="dim" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>{s.body}</p>
              <div className="mono mute" style={{ fontSize: 11, marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>{s.meta}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

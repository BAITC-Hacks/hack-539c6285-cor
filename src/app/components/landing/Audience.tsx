import { useT } from '@/i18n';

export function Audience() {
  const t = useT();

  const groups = [
    { who: 'landing.audience.g1.who', why: 'landing.audience.g1.why', tag: 'landing.audience.g1.tag' },
    { who: 'landing.audience.g2.who', why: 'landing.audience.g2.why', tag: 'landing.audience.g2.tag' },
    { who: 'landing.audience.g3.who', why: 'landing.audience.g3.why', tag: 'landing.audience.g3.tag' },
    { who: 'landing.audience.g4.who', why: 'landing.audience.g4.why', tag: 'landing.audience.g4.tag' },
  ];
  return (
    <section id="audience" className="section">
      <div className="container">
        <div className="eyebrow" style={{ marginBottom: 14 }}>{t('landing.audience.eyebrow')}</div>
        <h2 className="h1" style={{ margin: '0 0 48px', maxWidth: 760 }}>{t('landing.audience.title')}</h2>
        <div className="aud-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {groups.map((g, i) => (
            <article key={i} className="card-elev" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
              <span className="mono mute" style={{ fontSize: 11, letterSpacing: '0.1em' }}>{t(g.tag).toUpperCase()}</span>
              <h3 className="h2" style={{ margin: 0, fontSize: 24 }}>{t(g.who)}</h3>
              <p className="dim" style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, maxWidth: 460 }}>{t(g.why)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

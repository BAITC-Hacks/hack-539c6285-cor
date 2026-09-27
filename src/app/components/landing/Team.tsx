import { useT } from '@/i18n';

export function Team() {
  const t = useT();

  const founders = [
    {
      name: 'Yelnar Niyazbek',
      ru: 'Елнар Ниязбек',
      role: 'landing.team.f1.role',
      bio: 'landing.team.f1.bio',
      initials: 'EN',
      photo: '/team/elnar.png',
    },
    {
      name: 'Tangirberdi Ayazhan',
      ru: 'Тангирберди Аяжан',
      role: 'landing.team.f2.role',
      bio: 'landing.team.f2.bio',
      initials: 'TA',
      photo: '/team/ayazhan.png',
    },
  ];
  return (
    <section id="team" className="section">
      <div className="container">
        <div className="eyebrow" style={{ marginBottom: 14 }}>{t('landing.team.eyebrow')}</div>
        <h2 className="h1" style={{ margin: '0 0 48px', maxWidth: 780 }}>
          {t('landing.team.title.a')} <span className="dim">{t('landing.team.title.b')}</span>
        </h2>
        <div className="team-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {founders.map((f) => (
            <article key={f.name} className="card-elev" style={{ padding: 32, display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 96,
                  height: 120,
                  flexShrink: 0,
                  borderRadius: 10,
                  background: 'repeating-linear-gradient(135deg, var(--surface) 0 6px, var(--surface-2) 6px 12px)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  padding: 8,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {f.photo && (
                  <img
                    src={f.photo}
                    alt={f.name}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center top',
                    }}
                  />
                )}
                <span
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    fontFamily: 'Geist Mono, monospace',
                    fontSize: 10,
                    color: 'color-mix(in srgb, var(--text) 90%, transparent)',
                    letterSpacing: '0.1em',
                    textShadow: '0 1px 2px color-mix(in srgb, var(--bg) 70%, transparent)',
                    zIndex: 1,
                  }}
                >
                  {f.initials}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <h3 className="h3" style={{ margin: 0 }}>{f.name}</h3>
                    <div className="mute" style={{ fontSize: 13, marginTop: 2 }}>{f.ru}</div>
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--warm)', margin: '10px 0 12px' }}>{t(f.role)}</div>
                <p className="dim" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>{t(f.bio)}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="mute" style={{ marginTop: 32, fontSize: 14, maxWidth: 600 }}>
          {t('landing.team.note')}
        </p>
      </div>
    </section>
  );
}

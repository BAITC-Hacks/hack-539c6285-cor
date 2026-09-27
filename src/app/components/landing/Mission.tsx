import { useT } from '@/i18n';

export function Mission() {
  const t = useT();

  const cards = [
    { for: 'landing.mission.card.deaf.for', num: '70M+', body: 'landing.mission.card.deaf.body' },
    { for: 'landing.mission.card.family.for', num: '~300M', body: 'landing.mission.card.family.body' },
    { for: 'landing.mission.card.public.for', num: '< 5%', body: 'landing.mission.card.public.body' },
  ];

  return (
    <section id="mission" className="section" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div className="container">
        <div className="eyebrow" style={{ marginBottom: 24 }}>{t('landing.mission.eyebrow')}</div>

        <div className="mission-grid" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 80, alignItems: 'flex-start' }}>
          <div>
            <h2 className="h1" style={{ margin: '0 0 28px', maxWidth: 780 }}>
              {t('landing.mission.title.a')}
              <br />
              <span className="dim">{t('landing.mission.title.b')}</span>
            </h2>
            <p style={{ maxWidth: 600, fontSize: 18, lineHeight: 1.55, color: 'var(--text-dim)', margin: '0 0 18px' }}>
              {t('landing.mission.p1')}
            </p>
            <p style={{ maxWidth: 600, fontSize: 18, lineHeight: 1.55, color: 'var(--text-dim)', margin: 0 }}>
              {t('landing.mission.p2')}
            </p>
          </div>

          <div aria-hidden="true" style={{ aspectRatio: '1', position: 'relative' }}>
            <svg viewBox="0 0 400 400" style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="iso-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" style={{ stopColor: 'var(--accent)' }} />
                  <stop offset="1" style={{ stopColor: 'var(--warm)' }} />
                </linearGradient>
                <pattern id="iso-grid" width="20" height="11.5" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)">
                  <path
                    d="M0 0 H20 M0 0 V11.5"
                    strokeWidth="0.6"
                    fill="none"
                    style={{ stroke: 'color-mix(in srgb, var(--text-mute) 20%, transparent)' }}
                  />
                </pattern>
              </defs>
              <g transform="translate(200,220)">
                <polygon
                  points="-160,0 0,-90 160,0 0,90"
                  strokeWidth="1"
                  style={{ fill: 'color-mix(in srgb, var(--surface) 90%, transparent)', stroke: 'var(--border)' }}
                />
                <polygon points="-160,0 0,-90 160,0 0,90" fill="url(#iso-grid)" />
                <g transform="translate(-90,-30)">
                  <polygon points="0,-30 26,-15 26,15 0,30 -26,15 -26,-15" style={{ fill: 'var(--surface)', stroke: 'var(--border)' }} />
                  <polygon
                    points="0,-30 26,-15 0,0 -26,-15"
                    style={{
                      fill: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                      stroke: 'color-mix(in srgb, var(--accent) 50%, transparent)',
                    }}
                  />
                  <text x="0" y="-44" textAnchor="middle" fontSize="10" fontFamily="Geist Mono, monospace" style={{ fill: 'var(--text-mute)' }}>
                    {t('landing.mission.diagram.speaker')}
                  </text>
                </g>
                <g transform="translate(0,-50)">
                  <polygon points="0,-40 34,-20 34,20 0,40 -34,20 -34,-20" fill="url(#iso-grad)" opacity="0.95" />
                  <polygon points="0,-40 34,-20 0,0 -34,-20" style={{ fill: 'color-mix(in srgb, var(--on-brand) 18%, transparent)' }} />
                  <text x="0" y="6" textAnchor="middle" fontSize="14" fontWeight="700" style={{ fill: 'var(--on-brand)' }}>Q</text>
                </g>
                <g transform="translate(90,-30)">
                  <polygon points="0,-30 26,-15 26,15 0,30 -26,15 -26,-15" style={{ fill: 'var(--surface)', stroke: 'var(--border)' }} />
                  <polygon
                    points="0,-30 26,-15 0,0 -26,-15"
                    style={{
                      fill: 'color-mix(in srgb, var(--warm) 18%, transparent)',
                      stroke: 'color-mix(in srgb, var(--warm) 50%, transparent)',
                    }}
                  />
                  <text x="0" y="-44" textAnchor="middle" fontSize="10" fontFamily="Geist Mono, monospace" style={{ fill: 'var(--text-mute)' }}>
                    {t('landing.mission.diagram.signer')}
                  </text>
                </g>
                <g fill="none" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M-90,-30 Q-45,-80 0,-50" strokeDasharray="3 5" style={{ stroke: 'var(--accent)' }}>
                    <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="1.2s" repeatCount="indefinite" />
                  </path>
                  <path d="M0,-50 Q45,-80 90,-30" strokeDasharray="3 5" style={{ stroke: 'var(--warm)' }}>
                    <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="1.2s" repeatCount="indefinite" />
                  </path>
                </g>
              </g>
            </svg>
          </div>
        </div>

        <div className="mission-stats" style={{ marginTop: 72, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {cards.map((s, i) => (
            <article key={i} className="card" style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="eyebrow">{t(s.for)}</span>
              <div className="stat-num grad-text" style={{ fontSize: 48, marginTop: 6 }}>{s.num}</div>
              <p className="dim" style={{ margin: '8px 0 0', fontSize: 14.5, lineHeight: 1.55 }}>{t(s.body)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

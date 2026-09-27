import { Icon } from './Icon';
import { useT } from '@/i18n';

interface LearnProps {
  onStartPracticing?: () => void;
}

export function Learn({ onStartPracticing }: LearnProps) {
  const t = useT();
  const letters = ['А','Б','В','Г','Д','Е','Ё','Ж','З','И','Й','К','Л','М','Н','О','П','Р','С','Т','У','Ф','Х','Ц','Ч','Ш','Щ','Ъ','Ы','Ь','Э','Ю','Я'];
  return (
    <section id="learn" className="section">
      <div className="container">
        <div className="learn-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>{t('landing.learn.eyebrow')}</div>
            <h2 className="h1" style={{ margin: '0 0 18px' }}>
              {t('landing.learn.title.a')}<br />
              <span className="grad-text">{t('landing.learn.title.b')}</span>
            </h2>
            <p className="dim" style={{ maxWidth: 480, fontSize: 17, marginBottom: 24 }}>
              {t('landing.learn.body')}
            </p>
            <div className="row" style={{ gap: 10 }}>
              <button onClick={onStartPracticing} className="btn btn-primary">{t('landing.learn.cta.start')} <Icon name="arrow" size={14} /></button>
              <a href="#how" className="btn btn-ghost">{t('landing.learn.cta.curriculum')}</a>
            </div>
            <div className="row" style={{ marginTop: 32, gap: 24 }}>
              {[['33', 'landing.learn.stat.letters'], ['12', 'landing.learn.stat.phrases'], ['200+', 'landing.learn.stat.signs']].map(([n, l]) => (
                <div key={l}>
                  <div className="stat-num" style={{ fontSize: 32 }}>{n}</div>
                  <div className="mute" style={{ fontSize: 12 }}>{t(l)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-elev" style={{ padding: 24, position: 'relative' }}>
            <div className="between" style={{ marginBottom: 14 }}>
              <span className="eyebrow">{t('landing.learn.card.title')}</span>
              <span className="mono mute" style={{ fontSize: 11 }}>{t('landing.learn.card.locked', { done: 14, total: 33 })}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
              {letters.slice(0, 32).map((L, i) => {
                const locked = i < 14;
                return (
                  <div
                    key={L}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: locked
                        ? 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 18%, transparent), color-mix(in srgb, var(--warm) 6%, transparent))'
                        : 'var(--bg-elev)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 500,
                      fontSize: 15,
                      color: locked ? 'var(--text)' : 'var(--text-mute)',
                      position: 'relative',
                    }}
                  >
                    {L}
                    {locked && <span style={{ position: 'absolute', top: 3, right: 4, width: 5, height: 5, borderRadius: 999, background: 'var(--warm)' }} />}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 18, padding: 16, borderRadius: 12, background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
              <div className="between">
                <div className="row">
                  <div style={{ width: 46, height: 46, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 600 }}>Ж</div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{t('landing.learn.card.letter', { letter: 'Ж' })}</div>
                    <div className="mute" style={{ fontSize: 12 }}>{t('landing.learn.card.hint')}</div>
                  </div>
                </div>
                <div className="row mono" style={{ fontSize: 11, color: 'var(--text-mute)', gap: 6 }}>
                  <span>{t('landing.learn.card.press')}</span>
                  <span style={{ padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }}>Space</span>
                  <span>{t('landing.learn.card.toLock')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import { Icon } from './Icon';
import { useT } from '@/i18n';

interface CTAProps {
  onOpenTranslator?: () => void;
}

export function CTA({ onOpenTranslator }: CTAProps) {
  const t = useT();

  return (
    <section id="try" className="section">
      <div className="container">
        <div
          style={{
            padding: '72px 56px',
            borderRadius: 20,
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, transparent) 0%, color-mix(in srgb, var(--warm) 4%, transparent) 60%, transparent 100%), var(--surface)',
            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 50%)',
              pointerEvents: 'none',
            }}
          />
          <h2
            className="h-display"
            style={{ margin: '0 auto 16px', maxWidth: 780, fontSize: 'clamp(40px, 5.4vw, 72px)' }}
          >
            {t('landing.cta.title.a')}
            <br />
            <span className="grad-text">{t('landing.cta.title.b')}</span>
          </h2>
          <p className="dim" style={{ margin: '0 auto 32px', maxWidth: 520, fontSize: 18 }}>
            {t('landing.cta.body')}
          </p>
          <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
            <button onClick={onOpenTranslator} className="btn btn-brand">
              {t('landing.cta.open')} <Icon name="arrow" size={14} />
            </button>
            <a href="#faq" className="btn btn-ghost">
              <Icon name="github" size={14} /> {t('landing.cta.docs')}
            </a>
          </div>
          <div className="mute mono" style={{ marginTop: 28, fontSize: 11, letterSpacing: '0.08em' }}>
            {t('landing.cta.browsers')}
          </div>
        </div>
      </div>
    </section>
  );
}

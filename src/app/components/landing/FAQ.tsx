import { useState } from 'react';
import { Icon } from './Icon';
import { useT } from '@/i18n';

export function FAQ() {
  const t = useT();
  const items = [
    { q: t('landing.faq.q1'), a: t('landing.faq.a1') },
    { q: t('landing.faq.q2'), a: t('landing.faq.a2') },
    { q: t('landing.faq.q3'), a: t('landing.faq.a3') },
    { q: t('landing.faq.q4'), a: t('landing.faq.a4') },
    { q: t('landing.faq.q5'), a: t('landing.faq.a5') },
  ];
  const [open, setOpen] = useState<number>(0);
  return (
    <section id="faq" className="section">
      <div className="container" style={{ maxWidth: 920 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>{t('landing.faq.eyebrow')}</div>
        <h2 className="h1" style={{ margin: '0 0 40px' }}>{t('landing.faq.title')}</h2>
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '22px 4px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 24,
                    fontFamily: 'inherit',
                    fontSize: 18,
                    fontWeight: 500,
                    letterSpacing: '-0.012em',
                  }}
                >
                  <span>{it.q}</span>
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      border: '1px solid var(--border)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform .25s ease',
                      color: 'var(--text-dim)',
                    }}
                  >
                    <Icon name="chev" size={14} />
                  </span>
                </button>
                <div style={{ overflow: 'hidden', maxHeight: isOpen ? 200 : 0, transition: 'max-height .35s ease' }}>
                  <p className="dim" style={{ margin: 0, padding: '0 4px 24px', maxWidth: 680, fontSize: 15.5, lineHeight: 1.6 }}>
                    {it.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

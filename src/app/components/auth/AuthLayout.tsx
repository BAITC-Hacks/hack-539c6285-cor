import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import { ThemeToggle } from '@/app/components/shared/ThemeToggle';
import { LangSwitcher } from '@/app/components/shared/LangSwitcher';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  onBack?: () => void;
}

export function AuthLayout({ children, title, subtitle, onBack }: AuthLayoutProps) {
  const t = useT();

  return (
    <div className="qyran-app">
      <header className="topbar">
        <div className="shell topbar-inner">
          {onBack && (
            <button className="iconbtn" aria-label={t('common.back')} onClick={onBack} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span className="brand-q">Q</span>
            <span className="page-title">Qyran</span>
          </div>
          <div className="spacer" />
          <span className="pill">
            <span className="dot" />
            <span>BETA · v0.9</span>
          </span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <LangSwitcher />
            <ThemeToggle compact />
          </div>
        </div>
      </header>

      <main className="shell-narrow" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <span className="eyebrow" style={{ display: 'inline-block', marginBottom: 16 }}>{subtitle}</span>
            <h1
              style={{
                fontSize: 'clamp(32px, 4vw, 44px)',
                fontWeight: 600,
                letterSpacing: '-0.025em',
                lineHeight: 1.05,
                margin: 0,
                color: 'var(--text)',
              }}
            >
              {title}
            </h1>
          </div>

          <div className="card-elev" style={{ padding: 32 }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

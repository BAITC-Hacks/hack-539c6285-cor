import type { ReactNode } from 'react';

interface PageTopBarProps {
  title: string;
  sub?: string;
  onBack?: () => void;
  right?: ReactNode;
  pill?: { text: string; alive?: boolean };
}

export function PageTopBar({ title, sub, onBack, right, pill }: PageTopBarProps) {
  return (
    <header className="topbar">
      <div className="shell topbar-inner">
        {onBack && (
          <button className="iconbtn" aria-label="Back" onClick={onBack} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span className="brand-q">Q</span>
          <span className="title-row">
            <span className="page-title">{title}</span>
            {sub && <span className="page-sub mono">/ {sub}</span>}
          </span>
        </div>

        <div className="spacer" />

        {pill && (
          <span className={`pill ${pill.alive ? 'alive' : ''}`} aria-live="polite">
            <span className="dot" />
            <span>{pill.text}</span>
          </span>
        )}

        {right}
      </div>
    </header>
  );
}

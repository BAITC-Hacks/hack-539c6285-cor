import type { ReactNode } from 'react';
import { PageTopBar } from './PageTopBar';
import { ThemeToggle } from './ThemeToggle';
import { LangSwitcher } from './LangSwitcher';
import { useT } from '@/i18n';

export interface TechFeature {
  title: string;
  description: string;
  metric: string;
  icon: ReactNode;
}

export interface TechStep {
  num: string;
  title: string;
  body: string;
}

export interface TechDetailPageProps {
  onBack: () => void;
  name: string;
  tagline: string;
  description: string;
  badge?: string;
  heroIcon?: ReactNode;
  features: TechFeature[];
  primaryMetric: { value: string; label: string };
  secondaryMetric: { value: string; label: string };
  performanceChart?: ReactNode;
  latencyChart?: ReactNode;
  codeSnippet: string;
  codeTitle?: string;
  steps: TechStep[];
  outroParagraphs: ReactNode[];
  topPill?: { text: string; alive?: boolean };
}

export function TechDetailPage({
  onBack,
  name,
  tagline,
  description,
  badge,
  heroIcon,
  features,
  primaryMetric,
  secondaryMetric,
  performanceChart,
  latencyChart,
  codeSnippet,
  codeTitle,
  steps,
  outroParagraphs,
  topPill,
}: TechDetailPageProps) {
  const t = useT();

  return (
    <div className="qyran-app">
      <PageTopBar
        title={name}
        sub={tagline.toLowerCase()}
        onBack={onBack}
        pill={topPill ?? { text: t('tech.pill.stable') }}
        right={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 10 }}>
            <LangSwitcher />
            <ThemeToggle compact />
          </div>
        }
      />

      <main>
        {/* Hero */}
        <section className="shell detail-hero">
          {heroIcon && <div className="hero-icon">{heroIcon}</div>}
          <span className="eyebrow" style={{ display: 'inline-block', marginBottom: 14 }}>{tagline}</span>
          <h1 className="page-h1" style={{ fontSize: 'clamp(48px, 6vw, 80px)' }}>
            {name}
          </h1>
          {badge && (
            <div style={{ marginTop: 8, marginBottom: 14 }}>
              <span className="tag gold">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
                {badge}
              </span>
            </div>
          )}
          <p className="page-lede" style={{ maxWidth: 760, fontSize: 19 }}>{description}</p>
        </section>

        {/* Features */}
        <section className="shell" style={{ marginTop: 60, marginBottom: 80 }}>
          <span className="eyebrow" style={{ display: 'inline-block', marginBottom: 14 }}>{t('tech.features.eyebrow')}</span>
          <h2 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 36px' }}>{t('tech.features.title')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }} className="features-grid">
            {features.map((f, i) => (
              <article key={i} className="card" style={{ padding: 28, display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 11, background: 'var(--bg-elev)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warm)' }}>
                  {f.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>{f.title}</h3>
                  <p className="dim" style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.55 }}>{f.description}</p>
                  <span className="tag amber">{f.metric}</span>
                </div>
              </article>
            ))}
          </div>
          <style>{`
            @media (max-width: 880px) { .features-grid { grid-template-columns: 1fr !important; } }
          `}</style>
        </section>

        {/* Charts */}
        {(performanceChart || latencyChart) && (
          <section className="shell" style={{ marginBottom: 80 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="charts-grid">
              {performanceChart && (
                <div className="card-elev" style={{ padding: 24 }}>
                  <div className="between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <span className="eyebrow">{t('tech.chart.performance')}</span>
                    <span className="mono mute" style={{ fontSize: 11 }}>{t('tech.chart.overTime')}</span>
                  </div>
                  <div style={{ height: 200 }}>{performanceChart}</div>
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <div className="stat-num grad-text" style={{ fontSize: 36 }}>{primaryMetric.value}</div>
                    <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>{primaryMetric.label}</div>
                  </div>
                </div>
              )}
              {latencyChart && (
                <div className="card-elev" style={{ padding: 24 }}>
                  <div className="between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <span className="eyebrow">{t('tech.chart.latency')}</span>
                    <span className="mono mute" style={{ fontSize: 11 }}>{t('tech.chart.perFrame')}</span>
                  </div>
                  <div style={{ height: 200 }}>{latencyChart}</div>
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <div className="stat-num grad-text" style={{ fontSize: 36 }}>{secondaryMetric.value}</div>
                    <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>{secondaryMetric.label}</div>
                  </div>
                </div>
              )}
            </div>
            <style>{`
              @media (max-width: 880px) { .charts-grid { grid-template-columns: 1fr !important; } }
            `}</style>
          </section>
        )}

        {/* Code */}
        <section className="shell" style={{ marginBottom: 80 }}>
          <span className="eyebrow" style={{ display: 'inline-block', marginBottom: 14 }}>{codeTitle ?? t('tech.code.eyebrow')}</span>
          <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 24px' }}>{t('tech.code.title')}</h2>
          <div className="code-block">{codeSnippet}</div>
        </section>

        {/* Steps */}
        <section className="shell" style={{ marginBottom: 80 }}>
          <span className="eyebrow" style={{ display: 'inline-block', marginBottom: 14 }}>{t('tech.steps.eyebrow')}</span>
          <h2 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 36px' }}>{t('tech.steps.title')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }} className="steps-grid">
            {steps.map((s) => (
              <article key={s.num} className="card" style={{ padding: 28 }}>
                <div className="mono mute" style={{ fontSize: 12, marginBottom: 14 }}>{s.num}</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>{s.title}</h3>
                <p className="dim" style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{s.body}</p>
              </article>
            ))}
          </div>
          <style>{`
            @media (max-width: 880px) { .steps-grid { grid-template-columns: 1fr !important; } }
          `}</style>
        </section>

        {/* Outro */}
        <section className="shell" style={{ paddingBottom: 100, maxWidth: 820, margin: '0 auto' }}>
          {outroParagraphs.map((p, i) => (
            <p key={i} className="dim" style={{ fontSize: 17, lineHeight: 1.7, margin: '0 0 18px' }}>{p}</p>
          ))}
        </section>
      </main>
    </div>
  );
}

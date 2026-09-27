import { Icon } from './Icon';
import { useT } from '@/i18n';

type TechName = 'mediapipe' | 'tensorflow' | 'pytorch' | 'opencv';

interface TechProps {
  onNavigateToTech?: (name: TechName) => void;
}

export function Tech({ onNavigateToTech }: TechProps) {
  const t = useT();
  const tech: { name: string; key: TechName | null; role: string; detail: string }[] = [
    { name: 'MediaPipe', key: 'mediapipe', role: t('landing.tech.mediapipe.role'), detail: t('landing.tech.mediapipe.detail') },
    { name: 'TensorFlow.js', key: 'tensorflow', role: t('landing.tech.tensorflow.role'), detail: t('landing.tech.tensorflow.detail') },
    { name: 'PyTorch', key: 'pytorch', role: t('landing.tech.pytorch.role'), detail: t('landing.tech.pytorch.detail') },
    { name: 'OpenCV', key: 'opencv', role: t('landing.tech.opencv.role'), detail: t('landing.tech.opencv.detail') },
    { name: 'Web Speech API', key: null, role: t('landing.tech.speech.role'), detail: t('landing.tech.speech.detail') },
    { name: 'Supabase', key: null, role: t('landing.tech.supabase.role'), detail: t('landing.tech.supabase.detail') },
  ];
  return (
    <section id="tech" className="section" style={{ paddingTop: 60 }}>
      <div className="container">
        <div className="between" style={{ marginBottom: 36, alignItems: 'flex-end' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>{t('landing.tech.eyebrow')}</div>
            <h2 className="h1" style={{ margin: 0 }}>{t('landing.tech.title')}</h2>
          </div>
          <p className="dim" style={{ maxWidth: 340, fontSize: 15, textAlign: 'right' }}>{t('landing.tech.lead')}</p>
        </div>

        <div className="tech-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {tech.map((t, i) => {
            const Tag = t.key ? 'button' : 'div';
            const interactive = !!t.key;
            return (
              <Tag
                key={t.name}
                {...(interactive ? { onClick: () => t.key && onNavigateToTech?.(t.key), type: 'button' as const } : {})}
                style={{
                  padding: '28px 26px',
                  borderRight: i % 3 !== 2 ? '1px solid var(--border)' : 'none',
                  borderBottom: i < 3 ? '1px solid var(--border)' : 'none',
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'background .2s ease',
                  background: 'var(--surface)',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  cursor: interactive ? 'pointer' : 'default',
                  borderTop: 'none',
                  borderLeft: 'none',
                }}
                onMouseEnter={(e: any) => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={(e: any) => (e.currentTarget.style.background = 'var(--surface)')}
              >
                <div className="between">
                  <span className="h3" style={{ margin: 0 }}>{t.name}</span>
                  {interactive && <Icon name="arrow" size={16} style={{ color: 'var(--text-mute)' }} />}
                </div>
                <div className="mono mute" style={{ fontSize: 11 }}>{t.role}</div>
                <div className="dim" style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>{t.detail}</div>
              </Tag>
            );
          })}
        </div>
      </div>
    </section>
  );
}

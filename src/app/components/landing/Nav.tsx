import { Icon } from './Icon';
import { useT } from '@/i18n';
import { ThemeToggle } from '@/app/components/shared/ThemeToggle';
import { LangSwitcher } from '@/app/components/shared/LangSwitcher';

interface NavProps {
  onOpenApp?: () => void;
  onSignIn?: () => void;
  userInitials?: string;
  userName?: string;
  isAuthenticated?: boolean;
  onProfile?: () => void;
}

export function Nav({ onOpenApp, onSignIn, userInitials, userName, isAuthenticated, onProfile }: NavProps) {
  const t = useT();
  const links = [
    { label: t('landing.nav.how'), href: '#how' },
    { label: t('landing.nav.features'), href: '#features' },
    { label: t('landing.nav.learn'), href: '#learn' },
    { label: t('landing.nav.tech'), href: '#tech' },
    { label: t('landing.nav.faq'), href: '#faq' },
  ];
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 40, backdropFilter: 'blur(14px)', background: 'color-mix(in srgb, var(--bg) 72%, transparent)', borderBottom: '1px solid var(--border-soft)' }}>
      <div className="container between" style={{ height: 64 }}>
        <a href="#top" className="row" style={{ textDecoration: 'none', color: 'var(--text)', gap: 10 }}>
          <span style={{ display: 'inline-flex', width: 28, height: 28, borderRadius: 8, background: 'var(--grad-brand)', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', fontWeight: 700, fontSize: 14, letterSpacing: '-0.04em' }}>Q</span>
          <span style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>Qyran</span>
          <span className="mono mute" style={{ fontSize: 11, marginLeft: 6, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 6 }}>BETA</span>
        </a>
        <nav aria-label={t('landing.nav.aria')} className="row nav-links" style={{ gap: 28 }}>
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: 14, fontWeight: 450 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="row nav-actions" style={{ gap: 10 }}>
          <span className="nav-lang"><LangSwitcher /></span>
          <ThemeToggle compact />
          {isAuthenticated ? (
            <>
              <button
                onClick={onProfile}
                className="btn btn-ghost"
                style={{ padding: '8px 12px', fontSize: 13, gap: 8 }}
              >
                <span style={{ display: 'inline-flex', width: 24, height: 24, borderRadius: 999, background: 'var(--grad-brand)', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', fontWeight: 700, fontSize: 11 }}>{userInitials}</span>
                <span className="nav-user-name" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</span>
              </button>
              <button onClick={onOpenApp} className="btn btn-primary" style={{ padding: '10px 16px', fontSize: 14 }}>
                {t('common.nav.openApp')} <Icon name="arrow" size={14} />
              </button>
            </>
          ) : (
            <>
              <button onClick={onSignIn} className="btn btn-ghost" style={{ padding: '10px 16px', fontSize: 14 }}>{t('common.nav.signIn')}</button>
              <button onClick={onOpenApp} className="btn btn-primary" style={{ padding: '10px 16px', fontSize: 14 }}>
                {t('common.nav.openApp')} <Icon name="arrow" size={14} />
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`
        @media (max-width: 880px) {
          .nav-links { display: none !important; }
        }
        /* Узкий экран: сначала сжимаем кнопки, потом прячем имя.
           Переключатели темы и языка остаются — без них сайт не трёхъязычный. */
        @media (max-width: 760px) {
          .nav-actions { gap: 8px !important; }
          .nav-actions .btn { padding: 9px 12px !important; font-size: 13px !important; gap: 6px !important; }
        }
        @media (max-width: 560px) {
          .nav-actions .nav-user-name { display: none !important; }
        }
      `}</style>
    </header>
  );
}

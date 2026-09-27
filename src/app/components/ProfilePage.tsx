import { useAuth } from '@/app/context/AuthContext';
import { PageTopBar } from '@/app/components/shared/PageTopBar';
import { ThemeToggle } from '@/app/components/shared/ThemeToggle';
import { LangSwitcher } from '@/app/components/shared/LangSwitcher';
import { useI18n, type Lang } from '@/i18n';

interface ProfilePageProps {
  onBack: () => void;
}

/** Дата «в сети с» должна читаться на языке интерфейса, а не всегда по-английски. */
const DATE_LOCALE: Record<Lang, string> = { kk: 'kk-KZ', ru: 'ru-RU', en: 'en-US' };

export function ProfilePage({ onBack }: ProfilePageProps) {
  const { user, signOut } = useAuth();
  const { t, lang } = useI18n();

  if (!user) return null;

  const fullName = user.user_metadata?.full_name || t('account.profile.defaultName');
  const email = user.email || '';
  const createdAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString(DATE_LOCALE[lang], { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  async function handleSignOut() {
    await signOut();
  }

  const rows = [
    { label: t('account.profile.row.name'), value: fullName, icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>) },
    { label: t('account.profile.row.email'), value: email, icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>) },
    { label: t('account.profile.row.since'), value: createdAt, icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>) },
  ];

  return (
    <div className="qyran-app">
      <PageTopBar
        title={t('account.profile.title')}
        sub={t('account.profile.sub')}
        onBack={onBack}
        pill={{ text: t('account.profile.pill'), alive: true }}
        right={(
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <LangSwitcher />
            <ThemeToggle compact />
          </div>
        )}
      />

      <main className="shell-narrow" style={{ paddingTop: 56, paddingBottom: 80 }}>
        {/* Identity card */}
        <section className="card-elev" style={{ padding: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16, marginBottom: 28 }}>
          <div className="avatar-pill" style={{ width: 96, height: 96, fontSize: 36, boxShadow: 'var(--shadow-glow)' }}>
            {initials}
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>{fullName}</h1>
            <p className="mute" style={{ fontSize: 14, marginTop: 6 }}>{t('account.profile.member')}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
            <span className="tag gold">
              <span style={{ width: 6, height: 6, borderRadius: 'var(--r-pill)', background: 'currentColor', boxShadow: '0 0 8px currentColor' }} />
              {t('account.profile.verified')}
            </span>
            <span className="tag">BETA · v0.9</span>
          </div>
        </section>

        {/* Info rows */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {rows.map((r) => (
            <div key={r.label} className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg-elev)', border: '1px solid var(--border)', color: 'var(--warm)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {r.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="eyebrow" style={{ marginBottom: 4 }}>{r.label}</div>
                <div style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Actions */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={handleSignOut} className="btn btn-danger" style={{ justifyContent: 'center', padding: '14px 22px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {t('common.nav.signOut')}
          </button>
        </section>
      </main>
    </div>
  );
}

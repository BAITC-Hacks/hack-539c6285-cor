import { useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { useT } from '@/i18n';

interface SignUpFormProps {
  onSignIn: () => void;
  onSuccess?: () => void;
}

const UserIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const MailIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="22 6 12 13 2 6" />
  </svg>
);
const LockIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const Spinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'qa-spin 0.8s linear infinite' }}>
    <path d="M21 12a9 9 0 1 1-6.2-8.55" />
    <style>{`@keyframes qa-spin { to { transform: rotate(360deg); } }`}</style>
  </svg>
);
const ArrowIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
  </svg>
);

export function SignUpForm({ onSignIn, onSuccess }: SignUpFormProps) {
  const { signUp } = useAuth();
  const t = useT();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!fullName || !email || !password) {
      setError(t('account.err.fillAll'));
      return;
    }
    if (password.length < 6) {
      setError(t('account.err.passwordShort'));
      return;
    }

    setLoading(true);
    try {
      const { error: signUpError, needsConfirmation } = await signUp(email, password, fullName);
      if (signUpError) {
        setError(signUpError);
      } else if (needsConfirmation) {
        setSuccess(true);
      } else {
        onSuccess?.();
      }
    } catch (err: any) {
      setError(err?.message || t('account.err.network'));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div
          style={{
            width: 64, height: 64,
            borderRadius: 'var(--r-pill)',
            background: 'color-mix(in srgb, var(--ok) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--ok) 35%, transparent)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto', color: 'var(--ok)',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--text)' }}>{t('account.signUp.done.title')}</h3>
          <p className="dim" style={{ fontSize: 14, marginTop: 8, marginBottom: 0 }}>
            {t('account.signUp.done.sent')}<br />
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{email}</span>
          </p>
        </div>
        <div className="card" style={{ padding: 18, textAlign: 'left', background: 'var(--bg-elev)' }}>
          <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--accent)' }}>{t('account.signUp.done.steps')}</div>
          <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.7 }}>
            <li>{t('account.signUp.done.step1')}</li>
            <li>{t('account.signUp.done.step2')}</li>
            <li>{t('account.signUp.done.step3')}</li>
          </ol>
          <p className="mute" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
            {t('account.signUp.done.noEmail')}
          </p>
        </div>
        <button onClick={onSignIn} className="btn btn-brand" style={{ justifyContent: 'center', padding: '14px 22px' }}>
          {t('account.signUp.done.goSignIn')} {ArrowIcon}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error && (
        <div className="alert alert-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="field-label">{t('account.field.fullName')}</label>
        <div className="input-row">
          <span className="input-icon">{UserIcon}</span>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('account.field.fullName.ph')} autoComplete="name" />
        </div>
      </div>

      <div>
        <label className="field-label">{t('account.field.email')}</label>
        <div className="input-row">
          <span className="input-icon">{MailIcon}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" />
        </div>
      </div>

      <div>
        <label className="field-label">{t('account.field.password')}</label>
        <div className="input-row">
          <span className="input-icon">{LockIcon}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('account.field.password.ph')} autoComplete="new-password" />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-brand"
        style={{ justifyContent: 'center', padding: '14px 22px', marginTop: 6 }}
      >
        {loading ? (<><Spinner /> {t('account.signUp.loading')}</>) : (<>{t('account.signUp.submit')} {ArrowIcon}</>)}
      </button>

      <p className="dim" style={{ textAlign: 'center', fontSize: 14, margin: 0 }}>
        {t('account.signUp.haveAccount')}{' '}
        <button
          type="button"
          onClick={onSignIn}
          style={{ background: 'transparent', border: 0, color: 'var(--accent)', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
        >
          {t('account.signUp.toSignIn')}
        </button>
      </p>
    </form>
  );
}

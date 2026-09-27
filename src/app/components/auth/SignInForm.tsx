import { useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { useT } from '@/i18n';

interface SignInFormProps {
  onSignUp: () => void;
  onSuccess?: () => void;
}

const MailIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <polyline points="22 6 12 13 2 6" />
  </svg>
);

const LockIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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

export function SignInForm({ onSignUp, onSuccess }: SignInFormProps) {
  const { signIn, resendConfirmation } = useAuth();
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resending, setResending] = useState(false);
  const [resentMessage, setResentMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNeedsConfirmation(false);
    setResentMessage('');

    if (!email || !password) {
      setError(t('account.err.fillAll'));
      return;
    }

    setLoading(true);
    try {
      const { error: signInError, needsConfirmation: nc } = await signIn(email, password);
      if (signInError) {
        setError(signInError);
        setNeedsConfirmation(!!nc);
      } else {
        onSuccess?.();
      }
    } catch (err: any) {
      setError(err?.message || t('account.err.network'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) {
      setError(t('account.err.emailFirst'));
      return;
    }
    setResending(true);
    setResentMessage('');
    try {
      const { error: resendError } = await resendConfirmation(email);
      if (resendError) {
        setError(resendError);
      } else {
        setResentMessage(t('account.signIn.resent', { email }));
        setError('');
        setNeedsConfirmation(false);
      }
    } catch (err: any) {
      setError(err?.message || t('account.err.resendFailed'));
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {resentMessage && (
        <div className="alert alert-success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>{resentMessage}</span>
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="alert alert-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
          {needsConfirmation && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="btn btn-ghost"
              style={{ justifyContent: 'center', fontSize: 13 }}
            >
              {resending ? (<><Spinner /> {t('account.action.sending')}</>) : t('account.signIn.resend')}
            </button>
          )}
        </div>
      )}

      <div>
        <label className="field-label">{t('account.field.email')}</label>
        <div className="input-row">
          <span className="input-icon">{MailIcon}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
          />
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label className="field-label" style={{ marginBottom: 0 }}>{t('account.field.password')}</label>
          <button
            type="button"
            style={{ background: 'transparent', border: 0, color: 'var(--warm)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {t('account.signIn.forgot')}
          </button>
        </div>
        <div className="input-row">
          <span className="input-icon">{LockIcon}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-brand"
        style={{ justifyContent: 'center', padding: '14px 22px', marginTop: 6 }}
      >
        {loading ? (<><Spinner /> {t('account.signIn.loading')}</>) : (<>{t('account.signIn.submit')} {ArrowIcon}</>)}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 0' }}>
        <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
        <span className="mono mute" style={{ fontSize: 11, letterSpacing: '0.15em' }}>{t('account.or')}</span>
        <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
      </div>

      <button
        type="button"
        className="btn btn-ghost"
        style={{ justifyContent: 'center', padding: '12px 22px', borderColor: 'var(--warm-line)', color: 'var(--warm)', background: 'var(--warm-soft)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" /><path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11" /><path d="M15 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1.2a4 4 0 0 1-3.6-2.2L5 14a1.4 1.4 0 0 1 2.4-1.4L9 14V7a1.5 1.5 0 0 1 3 0" />
        </svg>
        {t('account.signIn.gesture')}
        <span
          className="mono"
          style={{
            fontSize: 9,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'color-mix(in srgb, var(--warm) 18%, transparent)',
            color: 'var(--warm)',
            letterSpacing: '0.08em',
          }}
        >
          {t('account.badge.experimental')}
        </span>
      </button>

      <p className="dim" style={{ textAlign: 'center', fontSize: 14, margin: 0 }}>
        {t('account.signIn.noAccount')}{' '}
        <button
          type="button"
          onClick={onSignUp}
          style={{ background: 'transparent', border: 0, color: 'var(--accent)', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
        >
          {t('account.signIn.toSignUp')}
        </button>
      </p>
    </form>
  );
}

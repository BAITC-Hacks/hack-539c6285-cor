import { useTheme } from '@/app/context/ThemeContext';
import { useT } from '@/i18n';

/**
 * Переключатель темы — одна кнопка с иконкой.
 *
 * Иконка показывает, КУДА переключит, а не что сейчас: в тёмной теме солнце,
 * в светлой луна. Так понятнее — человек и так видит, какая тема сейчас.
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const t = useT();
  const label = theme === 'dark' ? t('common.theme.toLight') : t('common.theme.toDark');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: compact ? 34 : undefined,
        height: 34,
        padding: compact ? 0 : '0 12px',
        borderRadius: 'var(--r-btn)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text-dim)',
        cursor: 'pointer',
        transition: 'color 140ms ease, border-color 140ms ease',
      }}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
    </svg>
  );
}

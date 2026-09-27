import { useI18n, LANGS, type Lang } from '@/i18n';

/**
 * Переключатель языка интерфейса — три коротких кнопки.
 *
 * Не выпадающий список: языков всего три, и выбор в один клик важнее экономии
 * места. Подписи короткие (KZ/RU/EN), полное название уходит в подсказку.
 */
export function LangSwitcher() {
  const { lang, setLang } = useI18n();

  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 2,
        borderRadius: 'var(--r-btn)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      {LANGS.map(({ code, label, native }) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code as Lang)}
          title={native}
          aria-pressed={lang === code}
          style={{
            padding: '4px 9px',
            fontSize: 11,
            lineHeight: 1.6,
            fontFamily: "'Geist Mono', ui-monospace, monospace",
            borderRadius: 7,
            border: 'none',
            cursor: 'pointer',
            background: lang === code ? 'var(--accent-soft)' : 'transparent',
            color: lang === code ? 'var(--accent)' : 'var(--text-mute)',
            transition: 'color 140ms ease, background 140ms ease',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

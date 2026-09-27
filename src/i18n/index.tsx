import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MESSAGES } from '@/i18n/messages';

/**
 * Язык интерфейса.
 *
 * Три языка: казахский, русский, английский. Казахский первый не случайно —
 * приложение собирает корпус казахского жестового языка, и его аудитория здесь
 * главная. Русский нужен, потому что вся библиотека жестов пока русская, а
 * английский — потому что проект показывают снаружи.
 *
 * Устройство простое до скуки: плоский словарь «ключ -> перевод на три языка».
 * Словари разбиты по страницам (src/i18n/messages/*), чтобы правки в разных
 * частях сайта не сталкивались в одном файле.
 *
 * Если перевода нет — показываем русский, а не пустоту и не сам ключ. Пустой
 * интерфейс хуже, чем интерфейс на другом языке.
 */

export type Lang = 'kk' | 'ru' | 'en';

export const LANGS: Array<{ code: Lang; label: string; native: string }> = [
  { code: 'kk', label: 'KZ', native: 'Қазақша' },
  { code: 'ru', label: 'RU', native: 'Русский' },
  { code: 'en', label: 'EN', native: 'English' },
];

const STORAGE_KEY = 'qyran-lang';
const FALLBACK: Lang = 'ru';

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Перевод по ключу. Подстановки — {имя} в строке. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'kk' || stored === 'ru' || stored === 'en') return stored;
  } catch { /* приватный режим */ }

  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : '';
  if (nav.startsWith('kk')) return 'kk';
  if (nav.startsWith('en')) return 'en';
  return FALLBACK;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectLang());

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nContextType>(() => ({
    lang,
    setLang: (l: Lang) => {
      setLangState(l);
      try { localStorage.setItem(STORAGE_KEY, l); } catch { /* приватный режим */ }
    },
    t: (key, vars) => {
      const entry = MESSAGES[key];
      if (!entry) {
        // Ключа нет в словаре — это ошибка разработчика, а не пользователя.
        // Показываем сам ключ: так пропажа сразу видна и не выглядит багом вёрстки.
        if (import.meta.env.DEV) console.warn(`[i18n] нет ключа: ${key}`);
        return key;
      }
      let out = entry[lang] ?? entry[FALLBACK] ?? key;
      if (vars) {
        for (const [name, v] of Object.entries(vars)) {
          out = out.replaceAll(`{${name}}`, String(v));
        }
      }
      return out;
    },
  }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n вызван вне I18nProvider');
  return ctx;
}

/** Короткая форма для компонентов, которым нужен только перевод. */
export function useT() {
  return useI18n().t;
}

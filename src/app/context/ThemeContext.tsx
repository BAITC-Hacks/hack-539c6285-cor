import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Светлая и тёмная тема.
 *
 * Тема — это ровно один атрибут data-theme на <html>; всё остальное делают
 * токены в src/styles/tokens.css. Компоненты про тему не знают и знать не
 * должны: они пишут var(--surface), а не «если тёмная, то...».
 *
 * По умолчанию берём системную настройку — человек уже сказал системе, как ему
 * удобно, спрашивать второй раз незачем. Явный выбор запоминаем и с этого
 * момента системную больше не слушаем.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'qyran-theme';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  /** Тему выбрал человек, а не система. */
  isExplicit: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;   // приватный режим — просто живём без памяти
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  // Плавность включаем только на смену, иначе первая отрисовка страницы
  // выезжает через переход и мигает.
  root.classList.add('theme-anim');
  window.setTimeout(() => root.classList.remove('theme-anim'), 250);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [explicit, setExplicit] = useState<Theme | null>(() => storedTheme());
  const [system, setSystem] = useState<Theme>(() => systemTheme());
  const theme = explicit ?? system;

  useEffect(() => { applyTheme(theme); }, [theme]);

  // Пока человек не выбрал сам — идём за системой, в том числе на лету.
  useEffect(() => {
    if (explicit || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystem(mq.matches ? 'light' : 'dark');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [explicit]);

  const setTheme = (t: Theme) => {
    // Атрибут ставим СРАЗУ, а не в эффекте.
    //
    // React выполняет эффекты снизу вверх: эффект страницы отрабатывает раньше
    // эффекта этого провайдера. Компоненты, которые читают токены из css
    // (three.js-сцена в переводчике берёт оттуда фон), успевали прочитать цвет
    // ещё старой темы, и сцена оставалась светлой на тёмной странице.
    applyTheme(t);
    setExplicit(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* приватный режим */ }
  };

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'), isExplicit: explicit !== null }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme вызван вне ThemeProvider');
  return ctx;
}

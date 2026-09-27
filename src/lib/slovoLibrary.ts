/**
 * Библиотека жестов, ретаргетированных из SLOVO (public/gestures/slovo/).
 *
 * Индекс: { words: {токен -> файл}, phrases: {фраза из n слов -> файл} }.
 * Резолвинг: сначала фразы (жадно, по n-граммам от длинных к коротким),
 * затем точное слово, затем усечение окончаний (та же идея, что в signWords).
 */

export interface SlovoIndex {
  words: Record<string, string>;
  phrases: Record<string, string>;
}

let indexCache: SlovoIndex | null = null;
let phraseByLen: Map<number, Map<string, string>> | null = null;
let maxPhraseLen = 0;

const ENDINGS = [
  'иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими',
  'ует', 'уют', 'ешь', 'ете', 'ила', 'или', 'ило', 'ать', 'ять', 'еть', 'ить',
  'ый', 'ий', 'ой', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ом', 'ем', 'ам', 'ям',
  'ах', 'ях', 'ов', 'ев', 'ой', 'ей', 'ут', 'ют', 'ат', 'ят', 'ет', 'ит',
  'ла', 'ло', 'ли', 'ть', 'а', 'я', 'о', 'е', 'у', 'ю', 'ы', 'и', 'й', 'ь',
];

export async function loadSlovoIndex(): Promise<SlovoIndex | null> {
  if (indexCache) return indexCache;
  try {
    const res = await fetch('/gestures/slovo/index.json');
    if (!res.ok) return null;
    indexCache = await res.json();
    phraseByLen = new Map();
    for (const [phrase, file] of Object.entries(indexCache!.phrases)) {
      const n = phrase.split(' ').length;
      maxPhraseLen = Math.max(maxPhraseLen, n);
      if (!phraseByLen.has(n)) phraseByLen.set(n, new Map());
      phraseByLen.get(n)!.set(phrase, file);
    }
    return indexCache;
  } catch {
    return null;
  }
}

/** Точное слово или усечение окончания. Возвращает имя файла без расширения. */
export function resolveSlovoWord(token: string): string | null {
  if (!indexCache) return null;
  const w = indexCache.words;
  if (w[token]) return w[token];
  for (const end of ENDINGS) {
    if (token.length - end.length >= 3 && token.endsWith(end)) {
      const stem = token.slice(0, -end.length);
      if (w[stem]) return w[stem];
      // основа + типовые леммные окончания
      for (const suf of ['ь', 'а', 'я', 'о', 'ий', 'ый', 'ать', 'ить', 'еть']) {
        if (w[stem + suf]) return w[stem + suf];
      }
    }
  }
  return null;
}

/**
 * Фразовый матч с позиции i: пробует n-граммы от длинных к коротким.
 * Возвращает {file, consumed} или null.
 */
export function resolveSlovoPhrase(
  tokens: string[], i: number,
): { file: string; consumed: number } | null {
  if (!phraseByLen) return null;
  for (let n = Math.min(maxPhraseLen, tokens.length - i); n >= 2; n--) {
    const gram = tokens.slice(i, i + n).join(' ');
    const file = phraseByLen.get(n)?.get(gram);
    if (file) return { file, consumed: n };
  }
  return null;
}

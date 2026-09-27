/**
 * Колода «Окна ЦОН»: что оператор показывает глухому гражданину и чем гражданин отвечает.
 *
 * Фраза оператора играет ОДИН файл из проверенной библиотеки (src/lib/verifiedSigns.ts) — только то, что построено
 * по записям носителей и прошло сверку. Новой фразе здесь место, когда её жест есть в библиотеке. Тексты — ключи
 * src/i18n/messages/tson.ts (kk/ru/en); жест у фразы один на все три языка — русский жестовый язык.
 *
 * Ответы гражданина — текст, не жест: оператор слышащий, ему ответ показывается крупно и озвучивается.
 */
export interface TsonPhrase {
  /** Ключ текста фразы в i18n */
  key: string;
  /** Файл жеста в public/gestures без .json */
  file: string;
}

export interface TsonGroup {
  /** Ключ заголовка группы в i18n */
  title: string;
  phrases: TsonPhrase[];
}

export const TSON_DECK: TsonGroup[] = [
  {
    title: 'tson.g.greet',
    phrases: [
      { key: 'tson.p.help', file: 'kak-pomoch' },
      { key: 'tson.p.name', file: 'kak-tebya-zovut' },
    ],
  },
  {
    title: 'tson.g.wait',
    phrases: [
      { key: 'tson.p.wait', file: 'pozhaluysta-podozhdite' },
    ],
  },
  {
    title: 'tson.g.talk',
    phrases: [
      { key: 'tson.p.yes', file: 'words/da' },
      { key: 'tson.p.no', file: 'words/net' },
      { key: 'tson.p.ok', file: 'words/khorosho' },
      { key: 'tson.p.please', file: 'words/pozhaluysta' },
      { key: 'tson.p.notUnderstand', file: 'ya-ne-ponimayu' },
      { key: 'tson.p.where', file: 'words/gde' },
    ],
  },
  {
    title: 'tson.g.time',
    phrases: [
      { key: 'tson.p.weWork', file: 'my-rabotat-segodnya' },
      { key: 'tson.p.today', file: 'words/segodnya' },
      { key: 'tson.p.tomorrow', file: 'words/zavtra' },
    ],
  },
  {
    title: 'tson.g.bye',
    phrases: [
      { key: 'tson.p.thanks', file: 'spasibo' },
      { key: 'tson.p.goodbye', file: 'do-svidaniya' },
    ],
  },
];

export const TSON_REPLIES: string[] = [
  'tson.r.yes',
  'tson.r.no',
  'tson.r.notUnderstand',
  'tson.r.repeat',
  'tson.r.slower',
  'tson.r.write',
  'tson.r.thanks',
];

/**
 * Служебные слова, у которых в жестовом языке нет своего знака: в свободном тексте оператора их пропускаем молча,
 * а не пишем «нет жеста». «Не» сюда не входит — отрицание в РЖЯ показывается.
 */
export const TSON_SKIP = new Set([
  'в', 'во', 'на', 'и', 'а', 'но', 'у', 'с', 'со', 'к', 'ко', 'по', 'о', 'об', 'обо', 'из', 'за', 'для', 'от', 'же',
  'ли', 'бы',
]);

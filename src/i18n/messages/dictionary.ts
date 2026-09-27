import type { Dictionary } from '@/i18n/messages/index';

/**
 * Словарь жестов: публичная страница-справочник в духе SpreadTheSign,
 * только вместо видео жест показывает 3D-аватар.
 */
export const dictionary: Dictionary = {
  'dictionary.title': { kk: 'Ым сөздігі', ru: 'Словарь жестов', en: 'Sign dictionary' },
  'dictionary.sub': { kk: '/ сөзден ымға', ru: '/ слово → жест', en: '/ word → sign' },
  'dictionary.search': {
    kk: 'Сөз іздеу…',
    ru: 'Поиск слова…',
    en: 'Search a word…',
  },
  'dictionary.count': {
    kk: '{n} ым',
    ru: '{n} знаков',
    en: '{n} signs',
  },
  'dictionary.hint': {
    kk: 'Сөзді таңдаңыз — аватар ымды көрсетеді',
    ru: 'Выберите слово — аватар покажет жест',
    en: 'Pick a word — the avatar signs it',
  },
  'dictionary.loop': { kk: 'Қайталау', ru: 'Повторять', en: 'Repeat' },
  'dictionary.nothing': {
    kk: 'Ештеңе табылмады',
    ru: 'Ничего не найдено',
    en: 'Nothing found',
  },
  'dictionary.nav': { kk: 'Сөздік', ru: 'Словарь', en: 'Dictionary' },
  'dictionary.toDictionary': {
    kk: 'Ым сөздігін ашу',
    ru: 'Открыть словарь жестов',
    en: 'Open the sign dictionary',
  },
};

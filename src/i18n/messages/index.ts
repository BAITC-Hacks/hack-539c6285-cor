import { common } from '@/i18n/messages/common';
import { landing } from '@/i18n/messages/landing';
import { translator } from '@/i18n/messages/translator';
import { dictionary } from '@/i18n/messages/dictionary';
import { recognizer } from '@/i18n/messages/recognizer';
import { studio } from '@/i18n/messages/studio';
import { account } from '@/i18n/messages/account';
import { tech } from '@/i18n/messages/tech';
import { tson } from '@/i18n/messages/tson';

/**
 * Все словари, собранные вместе.
 *
 * Разбиты по страницам намеренно: правки в переводчике и в лендинге не должны
 * встречаться в одном файле. Ключи именуются «страница.блок.что-это»:
 * landing.hero.title, translator.mode.meaning.
 */

export type Translated = { kk: string; ru: string; en: string };
export type Dictionary = Record<string, Translated>;

export const MESSAGES: Dictionary = {
  ...common,
  ...landing,
  ...translator,
  ...dictionary,
  ...recognizer,
  ...studio,
  ...account,
  ...tech,
  ...tson,
};

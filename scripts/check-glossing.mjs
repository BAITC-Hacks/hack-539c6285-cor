/**
 * Проверка перевода фразы в жестовый порядок.
 *
 *   node scripts/check-glossing.mjs
 *
 * Здесь закреплены ожидания, а не «как получилось». Правила глоссирования
 * будут меняться вместе с сурдопереводчиком — этот файл ловит момент, когда
 * очередная правка ломает уже разобранный случай.
 *
 * Два случая стоят отдельного внимания, оба были настоящими ошибками:
 *   * «есть» — не выбрасывать: чаще это глагол «кушать», и «я не хочу есть»
 *     превращалось в «Я ХОЧУ НЕ»;
 *   * «потом» в середине фразы — не выносить вперёд: слово из второй части
 *     уезжало в начало и рвало последовательность событий.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qyran-gloss-')), 'glossing.mjs');
execFileSync(path.join(ROOT, 'node_modules/.bin/esbuild'), [
  path.join(ROOT, 'src/lib/glossing.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`,
], { stdio: 'pipe' });
const { toGloss, glossToText } = await import(bundle);

/** [фраза, ожидаемая глосса, ожидаемые выброшенные слова] */
const CASES = [
  // предлоги уходят, порядок сохраняется
  ['Я иду в магазин', 'Я ИДУ МАГАЗИН', ['в']],
  ['Спасибо большое за помощь', 'СПАСИБО БОЛЬШОЕ ПОМОЩЬ', ['за']],
  // время из начала фразы — вперёд
  ['Я вчера ходил в магазин с мамой', 'ВЧЕРА Я ХОДИЛ МАГАЗИН МАМОЙ', ['в', 'с']],
  // время из середины остаётся на месте
  ['Сегодня утром я работал на работе и потом пошёл домой',
    'СЕГОДНЯ УТРОМ Я РАБОТАЛ РАБОТЕ ПОТОМ ПОШЁЛ ДОМОЙ', ['на', 'и']],
  // вопросительное слово — в конец
  ['Ты куда идёшь?', 'ТЫ ИДЁШЬ КУДА', []],
  ['Что это такое?', 'ЭТО ТАКОЕ ЧТО', []],
  // «что» вне вопроса — союз, выбрасывается
  ['Я думаю что ты прав', 'Я ДУМАЮ ТЫ ПРАВ', ['что']],
  // отрицание — после того, что отрицает
  ['Я не хочу есть', 'Я ХОЧУ НЕ ЕСТЬ', []],
  ['Почему ты не пришёл?', 'ТЫ ПРИШЁЛ НЕ ПОЧЕМУ', []],
  // «есть» как глагол не теряется
  ['Я хочу есть', 'Я ХОЧУ ЕСТЬ', []],
  // одно слово не трогаем
  ['привет', 'ПРИВЕТ', []],
  // повтор подряд показывать дважды незачем
  ['да да да', 'ДА', []],
];

let failed = 0;
for (const [input, wantGloss, wantDropped] of CASES) {
  const got = toGloss(input);
  const gotGloss = glossToText(got.tokens);
  const okGloss = gotGloss === wantGloss;
  const okDropped = got.dropped.join(' ') === wantDropped.join(' ');
  if (okGloss && okDropped) {
    console.log(`  ок   ${input}\n       -> ${gotGloss}`);
    continue;
  }
  failed++;
  console.log(`ПРОВАЛ ${input}`);
  if (!okGloss) console.log(`       ждали  ${wantGloss}\n       вышло  ${gotGloss}`);
  if (!okDropped) console.log(`       убрано: ждали [${wantDropped}], вышло [${got.dropped}]`);
}

console.log(`\n${CASES.length - failed} из ${CASES.length} совпало`);
process.exit(failed ? 1 : 0);

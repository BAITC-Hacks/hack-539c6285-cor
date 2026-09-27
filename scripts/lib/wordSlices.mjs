/**
 * Отдельные слова из знаков уже построенных фраз.
 *
 * Знак берётся из фразы целиком — те же ключи, та же сверка с тем же видео
 * носителя, — но начинается и кончается в покое: подъём из покоя за rise с
 * до первого ключа и опускание за lower с после последнего. Так переводчик
 * может собрать из них любую фразу, а не только семь готовых.
 *
 *   from, to — окно ключей знака во ВРЕМЕНИ ФРАЗЫ (с); у рук может быть своё
 *              окно: right: [from, to], left: [from, to];
 *   время слова = время фразы − (from − rise);
 *   via — к первому ключу правая идёт через точку, сдвинутую на d (м), за dt с до него.
 *
 * Строит scripts/author-phrases.mjs (файлы public/gestures/words/<name>.json),
 * сверяет scripts/check-phrases.mjs — фазы носителя те же, что у фразы, с тем же
 * сдвигом времени (scripts/lib/phraseRefs.mjs).
 */
export const WORD_SLICES = [
  // «Как дела?» и «Как я могу помочь?» (26.09): КАК — правая до перехода к ДЕЛА; ПОМОЧЬ — без разворота ладонями
  // вверх (это вопрос фразы)
  { name: 'kak', label: 'КАК', phrase: 'kak-dela', from: 0.34, to: 0.86, rise: 0.30, lower: 0.30,
    phases: ['КАК, открыта', 'КАК, кулак', 'КАК, снова'], source: 'sentence/621 «Как дела?» (видео 6155)' },
  { name: 'pomoch', label: 'ПОМОЧЬ', phrase: 'kak-pomoch', from: 0.20, to: 0.78, rise: 0.28, lower: 0.34,
    phases: ['правая над левой', 'правая на левой', 'перед разворотом'], source: 'sentence/10070 «Чем я могу вам помочь?» (видео 105605)' },
  // Из новых фраз 26.09 (ждут проверки пользователем вместе с фразами)
  { name: 'dobryi', label: 'ДОБРЫЙ', phrase: 'dobroe-utro', from: 0.26, to: 0.81, rise: 0.28, lower: 0.30,
    phases: ['ДОБРЫЙ, правая на левой'], source: 'sentence/1298 «Доброе утро!» (видео 12844)' },
  { name: 'utro', label: 'УТРО', phrase: 'dobroe-utro', right: [0.90, 1.48], left: [9, 9], from: 0.90, to: 1.48, rise: 0.30, lower: 0.28,
    phases: ['УТРО, кисть у лица', 'УТРО, в сторону'], source: 'sentence/1298 «Доброе утро!» (видео 12844)' },
  { name: 'den', label: 'ДЕНЬ', phrase: 'dobryi-den', from: 0.86, to: 1.64, rise: 0.30, lower: 0.30,
    phases: ['ДЕНЬ, кисти вверху', 'ДЕНЬ, «чаши» у пояса'], source: 'sentence/1299 «Добрый день» (видео 12848)' },
  { name: 'spokoinyi', label: 'СПОКОЙНЫЙ', phrase: 'spokoinoi-nochi', from: 0.24, to: 0.66, rise: 0.26, lower: 0.30,
    phases: ['СПОКОЙНЫЙ'], source: 'sentence/1300 «Спокойной ночи!» (видео 12864)' },
  { name: 'noch', label: 'НОЧЬ', phrase: 'spokoinoi-nochi', from: 0.92, to: 1.48, rise: 0.30, lower: 0.30,
    phases: ['НОЧЬ, раскрытые', 'НОЧЬ, кулаки'], source: 'sentence/1300 «Спокойной ночи!» (видео 12864)' },
  { name: 'imya', label: 'ИМЯ', phrase: 'menya-zovut', from: 0.68, to: 1.56, rise: 0.30, lower: 0.30,
    phases: ['ИМЯ'], source: 'sentence/8851 «Меня зовут...» (видео 112327)' },
  // Окно ЦОН (27.09): ПОДОЖДИТЕ из «Пожалуйста, подождите» — от разворота кисти до конца удержания
  { name: 'podozhdite', label: 'ПОДОЖДИТЕ', phrase: 'pozhaluysta-podozhdite', from: 0.62, to: 1.34, rise: 0.30, lower: 0.30,
    phases: ['ПОДОЖДИТЕ'], source: 'sentence/10038 «Пожалуйста, подождите.» (видео 133657)' },
  // Окно ЦОН (28.09): ПОВТОРИТЕ из «Пожалуйста, повторите» — левая до поворота к ПОЖАЛУЙСТА, правая до последнего сжатия
  { name: 'povtorite', label: 'ПОВТОРИТЕ', phrase: 'pozhaluysta-povtorite', right: [0.20, 0.69], left: [0.20, 0.68], from: 0.20, to: 0.69,
    rise: 0.20, lower: 0.30,
    phases: ['ПОВТОРИТЕ, левая', 'ПОВТОРИТЕ, правая в кулак', 'ПОВТОРИТЕ, правая снова'], source: 'sentence/10146 «Пожалуйста, повторите.» (видео 133656)' },
  // Окно ЦОН (28.09): ЗДРАВСТВУЙТЕ из «Здравствуйте, вам помочь?» — от ладоней у груди до кистей впереди
  { name: 'zdravstvuyte', label: 'ЗДРАВСТВУЙТЕ', phrase: 'zdravstvuyte-vam-pomoch', from: 0.18, to: 0.82, rise: 0.18, lower: 0.30,
    phases: ['ЗДРАВСТВУЙТЕ, у груди', 'ЗДРАВСТВУЙТЕ, вперёд'], source: 'sentence/23107 «Здравствуйте, вам помочь?» (видео 313532)' },
  // «Я люблю маму»
  { name: 'ya', label: 'Я', phrase: 'ya-lyublyu-mamu', from: 0.26, to: 0.42, rise: 0.26, lower: 0.30,
    phases: ['Я'], source: 'word/1293 «я» (видео 12788)' },
  { name: 'lyubit', label: 'ЛЮБИТЬ', phrase: 'ya-lyublyu-mamu', from: 0.52, to: 1.12, rise: 0.26, lower: 0.32,
    phases: ['ЛЮБИТЬ, у губ', 'ЛЮБИТЬ, на сердце'], source: 'sentence/2791 «я люблю тебя» (видео 26565); тот же знак — word/10868' },
  { name: 'mama', label: 'МАМА', phrase: 'ya-lyublyu-mamu', from: 1.23, to: 1.96, rise: 0.30, lower: 0.20,
    phases: ['МАМА, правая щека', 'МАМА, левая щека'], source: 'word/1284 «мама» (видео 12693)' },
  // «Я хочу есть»
  { name: 'khotet', label: 'ХОТЕТЬ', phrase: 'ya-khochu-est', from: 0.52, to: 0.66, rise: 0.30, lower: 0.30,
    phases: ['ХОТЕТЬ'], source: 'sentence/8799 «Ты хочешь есть?» (видео 100721)' },
  { name: 'est', label: 'ЕСТЬ', phrase: 'ya-khochu-est', from: 0.88, to: 1.38, rise: 0.34, lower: 0.16,
    phases: ['ЕСТЬ'], source: 'sentence/8799 «Ты хочешь есть?» (видео 100721)' },
  // «Кто там»
  { name: 'kto', label: 'КТО', phrase: 'kto-tam', from: 0.38, to: 1.14, rise: 0.30, lower: 0.30,
    phases: ['КТО'], source: 'word/478 «кто» (видео 4706)' },
  { name: 'tam', label: 'ТАМ', phrase: 'kto-tam', from: 1.46, to: 2.26, rise: 0.26, lower: 0.28,
    phases: ['ТАМ'], source: 'word/3907 «там» (видео 43113)' },
  // «Мы работаем сегодня»
  { name: 'my', label: 'МЫ', phrase: 'my-rabotat-segodnya', from: 0.30, to: 0.90, rise: 0.20, lower: 0.30,
    phases: ['МЫ, к середине', 'МЫ, обратно вправо'], source: 'word/5714 «мы» (видео 349185)' },
  { name: 'rabotat', label: 'РАБОТАТЬ', phrase: 'my-rabotat-segodnya', from: 1.18, to: 1.86, rise: 0.30, lower: 0.30,
    phases: ['РАБОТАТЬ'], source: 'word/21687 «работать» (видео 319938)' },
  { name: 'segodnya', label: 'СЕГОДНЯ', phrase: 'my-rabotat-segodnya', from: 2.16, to: 3.04, rise: 0.30, lower: 0.26,
    phases: ['СЕГОДНЯ'], source: 'word/428 «сегодня» (видео 4204)' },
  // «Ты идёшь в школу завтра»
  { name: 'ty', label: 'ТЫ', phrase: 'ty-idti-shkola-zavtra', from: 0.40, to: 0.68, rise: 0.32, lower: 0.30,
    phases: ['ТЫ'], source: 'word/1294 «ты» (видео 12804)' },
  { name: 'idti', label: 'ИДТИ', phrase: 'ty-idti-shkola-zavtra', from: 1.06, to: 1.66, rise: 0.30, lower: 0.30,
    phases: ['ИДТИ'], source: 'word/7452 «идти» (видео 227981)' },
  { name: 'shkola', label: 'ШКОЛА', phrase: 'ty-idti-shkola-zavtra', from: 2.00, to: 2.60, rise: 0.30, lower: 0.28,
    phases: ['ШКОЛА, крыша', 'ШКОЛА, стены'], source: 'word/1305 «школа» (видео 12914)' },
  // из покоя к щеке — через точку на 10 см ниже и на 8 см впереди (via: сдвиг и сколько до касания, с)
  { name: 'zavtra', label: 'ЗАВТРА', phrase: 'ty-idti-shkola-zavtra', from: 2.95, to: 3.59, rise: 0.38, lower: 0.24,
    via: { d: [0, -0.10, 0.08], dt: 0.12 },
    phases: ['ЗАВТРА, у щеки', 'ЗАВТРА, от щеки', 'ЗАВТРА, у щеки 2', 'ЗАВТРА, от щеки 2'], source: 'word/427 «завтра» (видео 4186)' },
];

/** Сдвиг времени: время слова = время фразы − shift. */
export const wordShift = (w) => +(w.from - w.rise).toFixed(3);

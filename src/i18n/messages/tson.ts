import type { Dictionary } from '@/i18n/messages/index';

/**
 * «Окно ЦОН»: экран для окна госуслуг — оператор показывает фразы жестами, глухой гражданин отвечает кнопками или
 * текстом. Фразы колоды — src/lib/tsonDeck.ts.
 */
export const tson: Dictionary = {
  'tson.title': { kk: 'ХҚКО терезесі', ru: 'Окно ЦОН', en: 'Service desk' },
  'tson.sub': { kk: '/ оператор ↔ саңырау азамат', ru: '/ оператор ↔ глухой гражданин', en: '/ clerk ↔ deaf citizen' },

  'tson.stage.idle': { kk: 'Фразаны таңдаңыз', ru: 'Выберите фразу', en: 'Pick a phrase' },
  'tson.caption.idle': {
    kk: 'Оператордың фразасы осында ірі әріппен шығады',
    ru: 'Здесь крупно появится фраза оператора',
    en: "The clerk's phrase appears here in large print",
  },
  'tson.replay': { kk: 'Қайталау', ru: 'Повторить', en: 'Replay' },

  'tson.operator.title': { kk: 'Оператор', ru: 'Оператор', en: 'Clerk' },
  'tson.operator.count': { kk: '{n} фраза', ru: '{n} фраз', en: '{n} phrases' },
  'tson.operator.hint': {
    kk: 'Фразаны басыңыз — Елнар оны орыс ым тілінде көрсетеді. Пунктир — ым әлі тексеруді күтуде.',
    ru: 'Нажмите фразу — Елнар покажет её на русском жестовом языке. Пунктир — жест ещё ждёт проверки.',
    en: 'Tap a phrase — Elnar signs it in Russian Sign Language. Dashed — the sign is still awaiting review.',
  },
  'tson.g.greet': { kk: 'Қарсы алу', ru: 'Приём', en: 'Welcome' },
  'tson.g.wait': { kk: 'Кезек және күту', ru: 'Очередь и ожидание', en: 'Queue & waiting' },
  'tson.g.talk': { kk: 'Түсіну', ru: 'Понимание', en: 'Understanding' },
  'tson.g.time': { kk: 'Уақыт', ru: 'Сроки', en: 'Timing' },
  'tson.g.bye': { kk: 'Қоштасу', ru: 'Прощание', en: 'Goodbye' },

  'tson.p.help': { kk: 'Сізге қалай көмектесе аламын?', ru: 'Чем я могу вам помочь?', en: 'How can I help you?' },
  'tson.p.name': { kk: 'Атыңыз кім?', ru: 'Как вас зовут?', en: "What's your name?" },
  'tson.p.wait': { kk: 'Күте тұрыңыз', ru: 'Пожалуйста, подождите', en: 'Please wait' },
  'tson.p.yes': { kk: 'Иә', ru: 'Да', en: 'Yes' },
  'tson.p.no': { kk: 'Жоқ', ru: 'Нет', en: 'No' },
  'tson.p.ok': { kk: 'Жақсы', ru: 'Хорошо', en: 'Good' },
  'tson.p.please': { kk: 'Өтінемін', ru: 'Пожалуйста', en: 'Please' },
  'tson.p.notUnderstand': { kk: 'Мен түсінбеймін', ru: 'Я не понимаю', en: "I don't understand" },
  'tson.p.where': { kk: 'Қайда?', ru: 'Где?', en: 'Where?' },
  'tson.p.weWork': { kk: 'Біз бүгін жұмыс істейміз', ru: 'Мы работаем сегодня', en: 'We are open today' },
  'tson.p.today': { kk: 'Бүгін', ru: 'Сегодня', en: 'Today' },
  'tson.p.tomorrow': { kk: 'Ертең', ru: 'Завтра', en: 'Tomorrow' },
  'tson.p.thanks': { kk: 'Рақмет', ru: 'Спасибо', en: 'Thank you' },
  'tson.p.goodbye': { kk: 'Сау болыңыз', ru: 'До свидания', en: 'Goodbye' },

  'tson.free.placeholder': {
    kk: 'Өз фразаңыз (әзірге орысша)…',
    ru: 'Своя фраза (пока по-русски)…',
    en: 'Your own phrase (Russian for now)…',
  },
  'tson.free.go': { kk: 'Ыммен көрсету', ru: 'Показать жестами', en: 'Sign it' },
  'tson.free.noSign': { kk: 'Ымы әлі жоқ: {w}', ru: 'Пока нет жеста: {w}', en: 'No sign yet: {w}' },

  'tson.citizen.title': { kk: 'Азаматтың жауабы', ru: 'Ответ гражданина', en: "Citizen's reply" },
  'tson.citizen.hint': {
    kk: 'Азамат жауапты басады немесе жазады — оператор оны ірі көреді және естиді.',
    ru: 'Гражданин нажимает ответ или пишет — оператор видит его крупно и слышит.',
    en: 'The citizen taps a reply or types — the clerk sees it in large print and hears it.',
  },
  'tson.citizen.speak': { kk: 'Дауыстап оқу', ru: 'Озвучивать', en: 'Read aloud' },
  'tson.citizen.placeholder': { kk: 'Операторға жазу…', ru: 'Написать оператору…', en: 'Write to the clerk…' },
  'tson.citizen.send': { kk: 'Көрсету', ru: 'Показать', en: 'Show' },
  'tson.r.yes': { kk: 'Иә', ru: 'Да', en: 'Yes' },
  'tson.r.no': { kk: 'Жоқ', ru: 'Нет', en: 'No' },
  'tson.r.notUnderstand': { kk: 'Түсінбедім', ru: 'Не понимаю', en: "I don't understand" },
  'tson.r.repeat': { kk: 'Қайталаңызшы', ru: 'Повторите, пожалуйста', en: 'Please repeat' },
  'tson.r.slower': { kk: 'Баяуырақ, өтінемін', ru: 'Медленнее, пожалуйста', en: 'Slower, please' },
  'tson.r.write': { kk: 'Жазып беріңізші', ru: 'Напишите, пожалуйста', en: 'Please write it down' },
  'tson.r.thanks': { kk: 'Рақмет', ru: 'Спасибо', en: 'Thank you' },

  'tson.log.title': { kk: 'Диалог', ru: 'Диалог', en: 'Dialogue' },
  'tson.log.clear': { kk: 'Тазалау', ru: 'Очистить', en: 'Clear' },
  'tson.log.empty': { kk: 'Әзірге бос', ru: 'Пока пусто', en: 'Nothing yet' },
  'tson.log.operator': { kk: 'Оператор', ru: 'Оператор', en: 'Clerk' },
  'tson.log.citizen': { kk: 'Азамат', ru: 'Гражданин', en: 'Citizen' },

  'tson.verified.note': {
    kk: 'Ымдар орыс ым тілін тасымалдаушылардың жазбалары (SpreadTheSign) бойынша жасалып, олармен кадрма-кадр салыстырылды. Камера бұл экранда қолданылмайды.',
    ru: 'Жесты построены по записям носителей русского жестового языка (SpreadTheSign) и сверены с ними кадр в кадр. Камера на этом экране не используется.',
    en: 'Signs are built from native Russian Sign Language recordings (SpreadTheSign) and checked against them frame by frame. This screen does not use the camera.',
  },
};

import type { Dictionary } from '@/i18n/messages/index';

/**
 * Переводчик: текст и речь в жест.
 *
 * Слова, которые человек вводит для показа (подсказки-фразы, названия жестов,
 * буквы дактиля, словарь SIGN_WORDS) здесь намеренно отсутствуют: это данные
 * распознавателя, они всегда русские, потому что русская и сама библиотека
 * жестов. Переводится только интерфейс вокруг них.
 */
export const translator: Dictionary = {
  // --- шапка страницы ---
  'translator.title': { kk: 'Аудармашы', ru: 'Переводчик', en: 'Translator' },
  'translator.subtitle': { kk: '/ сөз → ым', ru: '/ речь → жест', en: '/ speech → sign' },
  'translator.status.modelReady': {
    kk: 'Дайын · модель жүктелді',
    ru: 'Готово · модель загружена',
    en: 'Ready · model loaded',
  },
  'translator.status.modelLoading': {
    kk: 'Модель жүктелуде…',
    ru: 'Загружаем модель…',
    en: 'Loading model…',
  },
  'translator.nav.toRecognizer': {
    kk: 'Ымнан сөзге ауысу (камера + AI)',
    ru: 'Перейти в «Жест → речь» (камера + ИИ)',
    en: 'Switch to Sign → Speech (camera + AI)',
  },
  'translator.nav.toStudio': {
    kk: 'Өз ымыңды камераға жазу',
    ru: 'Записать свой жест на камеру',
    en: 'Record your own sign with the camera',
  },
  'translator.a11y.settings': { kk: 'Баптаулар', ru: 'Настройки', en: 'Settings' },

  // --- заголовок страницы ---
  'translator.hero.eyebrow': { kk: 'Сөзден ымға', ru: 'Речь → жест', en: 'Speech → Sign' },
  'translator.hero.title': {
    kk: 'Жазыңыз немесе айтыңыз.',
    ru: 'Напишите или скажите.',
    en: 'Type or speak.',
  },
  'translator.hero.titleDim': {
    kk: 'Аватар ымдап көрсетеді.',
    ru: 'Аватар покажет жестами.',
    en: 'Watch it signed.',
  },
  'translator.hero.lede': {
    kk: 'Сөйлемді жазыңыз немесе микрофонды қосыңыз. Аватар оны сол сәтте ымдап көрсетеді. Төмендегі ым белгісін бассаңыз, жазылған ым ойнатылады — жылдамдығы мен қайталауы реттеледі.',
    ru: 'Напишите фразу или включите микрофон. Аватар сразу покажет её жестами. Нажмите любой значок жеста ниже — проиграется записанный жест; скорость и повтор настраиваются.',
    en: 'Type a phrase or use the microphone. The avatar signs it back in real time. Click any of the gesture chips below to play a recorded sign — speed and looping are adjustable.',
  },

  // --- сцена с аватаром ---
  'translator.a11y.workspace': {
    kk: 'Аудармашының жұмыс аймағы',
    ru: 'Рабочая область переводчика',
    en: 'Translator workspace',
  },
  'translator.a11y.stage': {
    kk: 'Ымдап тұрған 3D аватар — көрсету аймағы',
    ru: '3D-аватар, показывающий жесты — область вывода',
    en: '3D signing avatar — output area',
  },
  'translator.stage.loadingTag': { kk: 'ЖҮКТЕЛУДЕ', ru: 'ЗАГРУЗКА', en: 'LOADING' },
  'translator.avatar.adam': { kk: 'Адам', ru: 'Адам', en: 'Adam' },
  'translator.avatar.elnar': { kk: 'Елнар', ru: 'Елнар', en: 'Elnar' },
  'translator.avatar.eva': { kk: 'Ева', ru: 'Ева', en: 'Eva' },
  'translator.avatar.pick': {
    kk: 'Аватарды таңдау',
    ru: 'Выбор аватара',
    en: 'Choose avatar',
  },
  'translator.stage.loadingAvatar': {
    kk: '3D аватар жүктелуде…',
    ru: 'Загружаем 3D-аватар…',
    en: 'Loading 3D avatar…',
  },
  'translator.stage.signing': { kk: 'КӨРСЕТУДЕ', ru: 'ПОКАЗЫВАЕМ', en: 'SIGNING' },
  'translator.stage.ready': { kk: 'ДАЙЫН', ru: 'ГОТОВО', en: 'READY' },
  'translator.stage.idle': { kk: 'КҮТУДЕ', ru: 'ОЖИДАНИЕ', en: 'IDLE' },
  'translator.stage.sign': { kk: 'ЫМ: {word}', ru: 'ЖЕСТ: {word}', en: 'SIGN: {word}' },

  // --- строка состояния ---
  'translator.status.idle': { kk: 'Аватар күтуде', ru: 'Аватар ждёт', en: 'Avatar idle' },
  'translator.status.ready': { kk: 'Дайын', ru: 'Готово', en: 'Ready' },
  'translator.status.done': {
    kk: 'Аударма аяқталды',
    ru: 'Перевод закончен',
    en: 'Translation complete',
  },
  'translator.status.translating': { kk: 'Аударылуда…', ru: 'Переводим…', en: 'Translating…' },
  'translator.status.signingOne': {
    kk: '«{word}» көрсетілуде…',
    ru: 'Показываем «{word}»…',
    en: 'Signing “{word}”…',
  },
  'translator.status.dactyl': {
    kk: 'Әріптеп: «{word}»…',
    ru: 'Дактиль: «{word}» по буквам…',
    en: 'Fingerspelling “{word}” letter by letter…',
  },
  'translator.status.loadFailed': {
    kk: '«{name}» жүктелмеді',
    ru: 'Не удалось загрузить «{name}»',
    en: 'Could not load “{name}”',
  },
  'translator.status.cantShow': {
    kk: 'Көрсету мүмкін болмады: {words}',
    ru: 'Не удалось показать: {words}',
    en: 'Could not sign: {words}',
  },
  'translator.status.enterWord': {
    kk: 'Сөз енгізіңіз (мысалы: привет, мама, играть)',
    ru: 'Введите слово (например: привет, мама, играть)',
    en: 'Type a word (for example: привет, мама, играть)',
  },
  'translator.status.gestureError': {
    kk: 'Ымдарды жүктеу қатесі',
    ru: 'Ошибка загрузки жестов',
    en: 'Failed to load the gestures',
  },
  'translator.status.avatarError': {
    kk: 'Аватарды жүктеу қатесі',
    ru: 'Ошибка загрузки аватара',
    en: 'Failed to load the avatar',
  },
  'translator.status.signingWord': { kk: 'Көрсетеміз', ru: 'Показываем', en: 'Signing' },
  'translator.status.press': { kk: 'Басыңыз:', ru: 'Нажмите', en: 'Press' },
  'translator.status.or': { kk: 'немесе', ru: 'или', en: 'or' },
  'translator.sign.dactylOf': {
    kk: '{word} (әріптеп)',
    ru: '{word} (дактиль)',
    en: '{word} (fingerspelled)',
  },

  // --- панель 1: быстрая фраза ---
  'translator.panel.quick': { kk: 'Жылдам фраза', ru: 'Быстрая фраза', en: 'Quick phrase' },
  'translator.a11y.voice': { kk: 'Дауыспен енгізу', ru: 'Голосовой ввод', en: 'Voice input' },
  'translator.quick.placeholder': {
    kk: 'Орысша мәтін жазыңыз немесе микрофонды қосыңыз',
    ru: 'Напишите текст по-русски или используйте микрофон',
    en: 'Type Russian text or use the microphone',
  },
  'translator.a11y.quickInput': {
    kk: 'Жылдам фраза өрісі',
    ru: 'Поле быстрой фразы',
    en: 'Quick phrase input',
  },
  'translator.a11y.speedGroup': {
    kk: 'Көрсету жылдамдығы',
    ru: 'Скорость показа',
    en: 'Playback speed',
  },
  'translator.speed.label': { kk: 'Жылдамдық', ru: 'Скорость', en: 'Speed' },
  'translator.a11y.speedSlider': {
    kk: 'Жылдамдық сырғытпасы',
    ru: 'Ползунок скорости',
    en: 'Speed slider',
  },
  'translator.a11y.speedPresets': {
    kk: 'Дайын жылдамдықтар',
    ru: 'Готовые значения скорости',
    en: 'Speed presets',
  },
  'translator.a11y.loop': { kk: 'Қайталау', ru: 'Повтор', en: 'Loop' },
  'translator.loop.label': {
    kk: 'Бір ымды қайталап көрсету',
    ru: 'Повторять один жест',
    en: 'Loop single gesture',
  },

  // --- панель 2: полный текст ---
  'translator.panel.full': { kk: 'Толық мәтін', ru: 'Полный текст', en: 'Full text' },
  'translator.a11y.sourceLang': { kk: 'Мәтін тілі', ru: 'Язык текста', en: 'Source language' },
  'translator.a11y.mode': { kk: 'Аудару тәсілі', ru: 'Способ перевода', en: 'Translation mode' },
  'translator.mode.meaning': { kk: 'Негізгі мағына', ru: 'Основной смысл', en: 'Main meaning' },
  'translator.mode.meaningHint': {
    kk: 'Ым тәртібі: септеуліктер мен көмекші сөздерсіз, уақыт алдында, сұрақ соңында',
    ru: 'Жестовый порядок: без предлогов и связок, время вперёд, вопрос в конце',
    en: 'Sign order: no prepositions or linking words, time first, question word last',
  },
  'translator.mode.literal': { kk: 'Сөзбе-сөз', ru: 'Слово в слово', en: 'Word for word' },
  'translator.mode.literalHint': {
    kk: 'Әр сөз жазылғандай, ретімен',
    ru: 'Каждое слово подряд, как написано',
    en: 'Every word in order, exactly as written',
  },
  'translator.full.placeholder': {
    kk: 'Орысша мәтінді осында жазыңыз, мысалы «привет мама»…',
    ru: 'Напишите русский текст здесь, например «привет мама»…',
    en: 'Type Russian text here, e.g. “привет мама”…',
  },
  'translator.a11y.fullInput': {
    kk: 'Аударылатын толық фраза',
    ru: 'Полная фраза для перевода',
    en: 'Full phrase to translate',
  },
  'translator.full.foot': {
    kk: 'Тіл өзі анықталады · Дауыс қолдау көрсетеді',
    ru: 'Автоопределение · Голос поддерживается',
    en: 'Auto-detect on · Voice supported',
  },
  'translator.gloss.showing': { kk: 'көрсетеміз: ', ru: 'показываем: ', en: 'showing: ' },
  'translator.gloss.dropped': {
    kk: 'көмекші сөз ретінде алынып тасталды: {words}',
    ru: 'убрано как служебное: {words}',
    en: 'dropped as function words: {words}',
  },
  'translator.action.translate': { kk: 'Аудару', ru: 'Перевести', en: 'Translate' },
  'translator.a11y.suggestions': {
    kk: 'Ұсынылған фразалар',
    ru: 'Подсказки-фразы',
    en: 'Suggested phrases',
  },

  // --- панель 3: записанные жесты ---
  'translator.panel.recorded': {
    kk: 'Жазылған ымдар',
    ru: 'Записанные жесты',
    en: 'Recorded gestures',
  },
  'translator.recorded.count': { kk: '{n} ым', ru: '{n} жестов', en: '{n} signs' },
  'translator.a11y.recordedLib': {
    kk: 'Жазылған ымдар жинағы',
    ru: 'Библиотека записанных жестов',
    en: 'Recorded gesture library',
  },
  'translator.recorded.play': {
    kk: '«{name}» ымын көрсету',
    ru: 'Показать «{name}»',
    en: 'Play “{name}”',
  },
  'translator.recorded.empty': {
    kk: '/gestures/ ішінде ым табылмады',
    ru: 'В /gestures/ жестов не найдено',
    en: 'No gestures found in /gestures/',
  },

  // --- панель 3: проверенная библиотека ---
  'translator.panel.verified': {
    kk: 'Тексерілген ымдар',
    ru: 'Проверенные жесты',
    en: 'Verified signs',
  },
  'translator.verified.count': {
    kk: '{p} фраза · {w} сөз',
    ru: '{p} фраз · {w} слов',
    en: '{p} phrases · {w} words',
  },
  'translator.verified.hint': {
    kk: 'SpreadTheSign тасымалдаушыларының жазбалары бойынша кадрма-кадр салыстырылып жасалған фразалар мен сөздер. Үзік жиек — әлі тексерілмеген.',
    ru: 'Фразы и слова, построенные по записям носителей РЖЯ (словарь SpreadTheSign) и сверенные с ними кадр в кадр. Пунктирная рамка — ещё ждут вашей проверки.',
    en: 'Phrases and words built from native RSL signers’ recordings (SpreadTheSign) and checked against them frame by frame. Dashed border: awaiting your review.',
  },
  'translator.verified.words': { kk: 'Тексерілген сөздер', ru: 'Проверенные слова', en: 'Verified words' },
  'translator.verified.pending': {
    kk: 'жазбамен салыстырылды, пайдаланушы тексеруін күтуде (үзік жиек)',
    ru: 'сверено с записью, ждёт проверки пользователем (пунктирная рамка)',
    en: 'checked against the recording, awaiting the user’s review (dashed border)',
  },

  // --- панель 4: непроверенные источники ---
  'translator.panel.unverified': {
    kk: 'Тексерілмеген ымдар',
    ru: 'Непроверенные жесты',
    en: 'Unverified signs',
  },
  'translator.unverified.hint': {
    kk: 'Ескі жазбалар мен процедуралық сөздік тасымалдаушылармен салыстырылмаған — дұрыс болмауы мүмкін. Олар бірте-бірте тексерілген ымдармен ауыстырылады.',
    ru: 'Старые записи и процедурный словарь не сверены с носителями и могут быть неверными. Они по одному заменяются проверенными жестами.',
    en: 'Old recordings and the procedural dictionary have not been checked against native signers and may be wrong. They are being replaced one by one.',
  },
  'translator.unverified.show': {
    kk: 'Көрсету (тексерілмеген)',
    ru: 'Показать (не проверено)',
    en: 'Show (unverified)',
  },

  // --- панель 4: словарь жестов ---
  'translator.panel.dict': { kk: 'Ым сөздігі', ru: 'Словарь жестов', en: 'Sign dictionary' },
  'translator.dict.count': { kk: '{n} сөз', ru: '{n} слов', en: '{n} words' },
  'translator.dict.hint': {
    kk: 'Сөйлем құрауға арналған сөздер: есімдіктер, етістіктер, сұраулар, уақыт. Сөз тұлғаларын таниды («хочу» → «хотеть»). Сөзді бассаңыз, аватар ымын көрсетеді.',
    ru: 'Слова для сборки предложений: местоимения, глаголы, вопросы, время. Понимает словоформы («хочу» → «хотеть»). Нажмите слово — аватар покажет жест.',
    en: 'Words for building sentences: pronouns, verbs, questions, time. It understands word forms («хочу» → «хотеть»). Tap a word and the avatar signs it.',
  },
  'translator.dict.play': {
    kk: '«{word}» ымын көрсету',
    ru: 'Показать жест «{word}»',
    en: 'Sign “{word}”',
  },

  // --- панель 5: дактиль ---
  'translator.panel.dactyl': {
    kk: 'Дактиль (РЖЯ әліпбиі)',
    ru: 'Дактиль (алфавит РЖЯ)',
    en: 'Fingerspelling (RSL alphabet)',
  },
  'translator.dactyl.count': { kk: '{n} әріп', ru: '{n} букв', en: '{n} letters' },
  'translator.dactyl.hint': {
    kk: 'Жазылған ымы жоқ сөздерді аватар әріптеп көрсетеді. Әріпті бассаңыз, оның ымын көресіз.',
    ru: 'Слова без записанного жеста аватар показывает по буквам. Нажмите букву, чтобы посмотреть её жест.',
    en: 'Words with no recorded sign are fingerspelled letter by letter. Tap a letter to see its sign.',
  },
  'translator.a11y.dactyl': {
    kk: 'Дактиль әліпбиі',
    ru: 'Дактильный алфавит',
    en: 'Fingerspelling alphabet',
  },
  'translator.dactyl.letter': {
    kk: '«{letter}» әрпі',
    ru: 'Буква «{letter}»',
    en: 'Letter “{letter}”',
  },

  // --- прочее ---
  'translator.speech.chromeOnly': {
    kk: 'Дауысты тану тек Chrome браузерінде жұмыс істейді.',
    ru: 'Распознавание речи работает только в Chrome.',
    en: 'Speech recognition is supported in Chrome only.',
  },
};

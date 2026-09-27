import type { Dictionary } from '@/i18n/messages/index';

/** Главная страница: шапка, герой, разделы, подвал. */
export const landing: Dictionary = {
  // --- Шапка -----------------------------------------------------------
  'landing.nav.aria': { kk: 'Негізгі мәзір', ru: 'Основная навигация', en: 'Primary' },
  'landing.nav.how': { kk: 'Қалай жұмыс істейді', ru: 'Как это работает', en: 'How it works' },
  'landing.nav.features': { kk: 'Мүмкіндіктер', ru: 'Возможности', en: 'Features' },
  'landing.nav.learn': { kk: 'Үйрену', ru: 'Обучение', en: 'Learn' },
  'landing.nav.tech': { kk: 'Технологиялар', ru: 'Технологии', en: 'Tech' },
  'landing.nav.faq': { kk: 'Сұрақтар', ru: 'Вопросы', en: 'FAQ' },

  // --- Герой -----------------------------------------------------------
  'landing.hero.badge': {
    kk: 'Браузерде бірден жұмыс істейді — орнатудың қажеті жоқ',
    ru: 'Работает прямо в браузере — без установки',
    en: 'Live in your browser — no install',
  },
  'landing.hero.title.a': { kk: 'Ымдау тілі,', ru: 'Язык жестов,', en: 'Sign language,' },
  'landing.hero.title.b': { kk: 'екі жаққа ', ru: 'переведённый ', en: 'translated ' },
  'landing.hero.title.c': { kk: 'аударылады.', ru: 'в обе стороны.', en: 'both ways.' },
  'landing.hero.sub': {
    kk: 'Qyran сөзді ымға, ымды дауысқа айналдырады — нақты уақытта, тікелей браузерде. Түсінікті болғысы келетін әркімге арналған құрал.',
    ru: 'Qyran превращает речь в жесты, а жесты — в голос. В реальном времени, прямо в браузере. Инструмент для всех, кто хочет быть понятым.',
    en: 'Qyran turns speech into signs, and signs into voice — in real time, in your browser. A tool for everyone who wants to be understood.',
  },
  'landing.hero.cta.tson': { kk: 'ХҚКО терезесі', ru: 'Окно ЦОН', en: 'Service desk' },
  'landing.hero.cta.recognizer': {
    kk: 'Ым → сөз (ЖИ камерасы)',
    ru: 'Жест → речь (камера с ИИ)',
    en: 'Sign → Speech (AI camera)',
  },
  'landing.hero.left.title': { kk: 'Сөз → ым', ru: 'Речь → жесты', en: 'Speech → Signs' },
  'landing.hero.left.output': { kk: 'Шыққан ымдар', ru: 'Жесты на выходе', en: 'Sign output' },
  'landing.hero.left.signed': {
    kk: '{done}/{total} көрсетілді',
    ru: 'показано {done}/{total}',
    en: '{done}/{total} signed',
  },
  'landing.hero.right.title': { kk: 'Ым → сөз', ru: 'Жесты → речь', en: 'Signs → Speech' },
  'landing.hero.right.gloss': { kk: 'СӘЛЕМ', ru: 'ПРИВЕТ', en: 'HELLO' },
  'landing.hero.right.caption1': { kk: 'Сәлем.', ru: 'Привет.', en: 'Hello.' },
  'landing.hero.right.caption2': { kk: 'Сәлем. Танысқаныма', ru: 'Привет. Рад', en: 'Hello. Nice to' },
  'landing.hero.right.caption3': {
    kk: 'Сәлем. Танысқаныма қуаныштымын.',
    ru: 'Привет. Рад познакомиться.',
    en: 'Hello. Nice to meet you.',
  },
  'landing.hero.right.playAria': { kk: 'Дауыстап оқу', ru: 'Озвучить', en: 'Play voice' },
  'landing.hero.right.speak': { kk: 'Дауыстау', ru: 'Озвучить', en: 'Speak' },
  'landing.hero.stat.accuracy': { kk: 'тану дәлдігі', ru: 'точность распознавания', en: 'recognition accuracy' },
  'landing.hero.stat.latency': { kk: 'аударма кідірісі', ru: 'задержка перевода', en: 'translation latency' },
  'landing.hero.stat.signs': { kk: 'қолдау көрсетілетін ым', ru: 'поддерживаемых жестов', en: 'signs supported' },
  'landing.hero.stat.languages': { kk: 'ымдау тілі — РЖЯ', ru: 'жестовый язык — РЖЯ', en: 'sign language — RSL' },

  // --- Проблема --------------------------------------------------------
  'landing.mission.eyebrow': { kk: 'Мәселе', ru: 'Проблема', en: 'The problem' },
  'landing.mission.title.a': {
    kk: 'Дәріхана. Сынып. Аурухананың тіркеу бөлімі.',
    ru: 'Аптека. Класс. Регистратура в больнице.',
    en: 'A pharmacy. A classroom. A hospital reception.',
  },
  'landing.mission.title.b': {
    kk: 'Түсінікті болу артықшылық емес, қалыпты жағдай болуға тиіс жерлер.',
    ru: 'Места, где быть понятым не должно быть привилегией.',
    en: "Places where being understood shouldn't be a privilege.",
  },
  'landing.mission.p1': {
    kk: 'Әлемдегі 70 миллион адам үшін ымдау тілі — ана тілі. Оларға аяушылық емес, ымға ыммен жауап беретін терезе керек.',
    ru: 'Для 70 миллионов человек в мире жестовый язык — родной. Им не нужна жалость. Им нужно окно, которое ответит жестом.',
    en: "For 70 million people worldwide, sign language is their first language. They don't need pity. They need a counter that signs back.",
  },
  'landing.mission.p2': {
    kk: 'Qyran күнделікті істерге арналған: дәрігердегі қабылдау, мектептегі сабақ, дүкенге бару, үйге қоңырау. Үшінші адамды қажет етпейтін әңгімелер үшін.',
    ru: 'Qyran сделан для обычных дел: приём у врача, урок в школе, поход в магазин, звонок домой. Для разговоров, в которых не должен участвовать третий.',
    en: "Qyran is built for the everyday — doctor's visits, school lessons, grocery runs, calls home. The kind of conversations that shouldn't require a third person.",
  },
  'landing.mission.diagram.speaker': { kk: 'ДАУЫС', ru: 'ГОЛОС', en: 'SPEAKER' },
  'landing.mission.diagram.signer': { kk: 'ЫМ', ru: 'ЖЕСТ', en: 'SIGNER' },
  'landing.mission.card.deaf.for': {
    kk: 'Естімейтін және нашар еститіндер үшін',
    ru: 'Для глухих и слабослышащих',
    en: 'For Deaf & hard-of-hearing',
  },
  'landing.mission.card.deaf.body': {
    kk: 'Ымдау тілі ана тілі болып саналатын, күнделікті істерде туыстарына немесе ақылы аудармашыға тәуелді адамдар.',
    ru: 'Людей в мире, для которых жестовый язык — родной и кто сегодня зависит от близких или платных переводчиков даже в бытовых делах.',
    en: 'People worldwide whose first language is sign — and who today rely on family or paid interpreters for basic services.',
  },
  'landing.mission.card.family.for': {
    kk: 'Олардың жақындары үшін',
    ru: 'Для их близких',
    en: 'For their families',
  },
  'landing.mission.card.family.body': {
    kk: 'Ымдау тілін өз бетінше үйреніп жүрген еститін ата-аналар, жұбайлар және балалар — көбіне ана тіліндегі материалсыз.',
    ru: 'Слышащие родители, партнёры и дети, которые учат жесты сами — обычно без материалов на своём языке.',
    en: 'Hearing parents, partners and children who learn sign on their own, usually without resources in their language.',
  },
  'landing.mission.card.public.for': {
    kk: 'Мемлекеттік қызметтер үшін',
    ru: 'Для государственных служб',
    en: 'For public services',
  },
  'landing.mission.card.public.body': {
    kk: 'Әлемде ымдау тіліне нақты уақытта қолжетімділік беретін мектеп, емхана және мемлекеттік терезелер. Qyran осыны түзетуге кірісті.',
    ru: 'Школ, клиник и государственных окон в мире, где есть перевод на жестовый язык в реальном времени. Qyran берётся это исправить.',
    en: 'Schools, clinics and government counters globally that offer real-time sign-language access. Qyran is rolling out to fix this.',
  },

  // --- Как это работает ------------------------------------------------
  'landing.how.eyebrow': { kk: 'Қалай жұмыс істейді', ru: 'Как это работает', en: 'How it works' },
  'landing.how.title.a': { kk: 'Бұл — әңгіме,', ru: 'Это разговор,', en: 'A conversation,' },
  'landing.how.title.b': { kk: 'стенограмма емес.', ru: 'а не расшифровка.', en: 'not a transcript.' },
  'landing.how.lead': {
    kk: 'Көп қызмет тек бір бағытта аударады. Qyran телефон қоңырауы сияқты: әркім өз тілінде сөйлейді және екеуі де түсінікті болады.',
    ru: 'Большинство сервисов переводят в одну сторону. Qyran работает как телефонный звонок: каждый говорит на своём языке и каждого понимают.',
    en: 'Most tools translate one direction. Qyran works like a phone call — both people speak in their own language, and both are understood.',
  },
  'landing.how.s1.title': { kk: 'Сіз сөйлейсіз немесе жазасыз', ru: 'Вы говорите или печатаете', en: 'You speak or type' },
  'landing.how.s1.body': {
    kk: 'Дауыспен, пернетақтадан немесе мәтінді қойып. Qyran ағылшын, орыс және қазақ тіліндегі сөзді таниды әрі тек сөзді емес, мағынаны талдайды.',
    ru: 'Голосом, с клавиатуры или вставкой текста. Qyran распознаёт речь на английском, русском и казахском и разбирает смысл, а не только слова.',
    en: 'Use your voice, your keyboard, or paste text. Qyran picks up speech in EN, RU, or KZ and parses meaning, not just words.',
  },
  'landing.how.s1.meta': { kk: 'Web Speech API · 12 тіл', ru: 'Web Speech API · 12 языков', en: 'Web Speech API · 12 languages' },
  'landing.how.s2.title': { kk: 'Ымдайтын аватар жауап береді', ru: 'Отвечает жестовый аватар', en: 'A signing avatar replies' },
  'landing.how.s2.body': {
    kk: '3D-аватар жауапты нақты уақытта көрсетеді — сөзбе-сөз аудару емес, ымдау тілінің өз грамматикасымен.',
    ru: '3D-аватар показывает ответ в реальном времени — с грамматикой жестового языка, а не пословным переводом.',
    en: 'A fluent 3D signer renders the response in real time — with proper grammar for sign language, not word-for-word transcription.',
  },
  'landing.how.s2.meta': { kk: 'Аватар · 200+ ым', ru: 'Аватар · 200+ жестов', en: 'Avatar · 200+ glosses' },
  'landing.how.s3.title': { kk: 'Әңгімелесуші камераға ым көрсетеді', ru: 'Собеседник показывает жест в камеру', en: 'They sign back to the camera' },
  'landing.how.s3.body': {
    kk: 'MediaPipe әр қолдағы 21 нүктені бақылайды. TensorFlow моделі ымды 50 мс-тан аз уақытта таниды.',
    ru: 'MediaPipe отслеживает 21 точку на каждой руке. Модель TensorFlow распознаёт жест меньше чем за 50 мс.',
    en: 'MediaPipe tracks 21 landmarks per hand. A TensorFlow model classifies the gesture in under 50ms.',
  },
  'landing.how.s3.meta': { kk: 'MediaPipe + TF.js · 30 к/с', ru: 'MediaPipe + TF.js · 30 к/с', en: 'MediaPipe + TF.js · 30fps' },
  'landing.how.s4.title': { kk: 'Сіз жауапты естисіз', ru: 'Вы слышите ответ', en: 'You hear the answer' },
  'landing.how.s4.body': {
    kk: 'Танылған ымдар сөйлемге жинақталып, динамиктен дауыстап оқылады. Әңгіме үзілмейді.',
    ru: 'Распознанные жесты складываются в предложения и звучат через динамики. Разговор не прерывается.',
    en: 'Recognized signs are stitched into sentences and read aloud through your speakers. Both sides keep talking.',
  },
  'landing.how.s4.meta': { kk: 'TTS · кідірісі аз ағын', ru: 'TTS · поток с малой задержкой', en: 'TTS · low-latency stream' },

  // --- Возможности -----------------------------------------------------
  'landing.features.eyebrow': { kk: 'Мүмкіндіктер', ru: 'Возможности', en: 'Features' },
  'landing.features.title.a': { kk: 'Бәрі бір терезеде.', ru: 'Всё в одном окне.', en: 'Everything in one window.' },
  'landing.features.title.b': { kk: 'Ештеңе орнатудың қажеті жоқ.', ru: 'Ничего не нужно ставить.', en: 'Nothing to install.' },
  'landing.features.translator.eyebrow': { kk: 'Аудармашы', ru: 'Переводчик', en: 'Translator' },
  'landing.features.translator.tag': { kk: 'нақты уақытта', ru: 'в реальном времени', en: 'real-time' },
  'landing.features.translator.title': {
    kk: 'Екі бағыттағы тікелей аударма',
    ru: 'Живой перевод в обе стороны',
    en: 'Two-way live translation',
  },
  'landing.features.translator.body': {
    kk: 'Сөйлеңіз, жазыңыз немесе ым көрсетіңіз — Qyran екі бағытты да бір терезеде жүргізеді. Қолданба ауыстырудың да, ыңғайсыз үнсіздіктің де қажеті жоқ.',
    ru: 'Говорите, печатайте или показывайте жест — Qyran ведёт оба направления в одном окне. Без переключения приложений и неловких пауз.',
    en: 'Speak, type, or sign — Qyran routes both directions through one interface. No swapping apps, no awkward pauses.',
  },
  'landing.features.latency.body': {
    kk: 'Ымнан субтитрге дейінгі толық кідіріс. Көзді ашып-жұмғаннан да жылдам.',
    ru: 'Полная задержка от жеста до субтитра. Быстрее, чем моргнуть.',
    en: 'End-to-end latency from gesture to caption. Faster than blinking.',
  },
  'landing.features.latency.step1': { kk: 'Камерадан түсіру', ru: 'Захват с камеры', en: 'Camera capture' },
  'landing.features.latency.step2': { kk: 'Нүктелерді анықтау', ru: 'Выделение точек', en: 'Landmark extraction' },
  'landing.features.latency.step3': { kk: 'Жіктеу', ru: 'Классификация', en: 'Classification' },
  'landing.features.latency.step4': { kk: 'Дауыстау', ru: 'Озвучивание', en: 'TTS playback' },
  'landing.features.langs.title': {
    kk: 'Орыс ымдау тілі, бір модель',
    ru: 'Русский жестовый язык, одна модель',
    en: 'Russian Sign Language, one model',
  },
  'landing.features.langs.body': {
    kk: 'РЖЯ ымдарының кітапханасы және дактиль әліпбиі. Ашық ым тілі деректер жинағында оқытылған.',
    ru: 'Библиотека жестов РЖЯ и дактильный алфавит. Обучено на открытом датасете жестового языка.',
    en: 'A library of RSL signs plus the fingerspelling alphabet. Trained on an open sign-language dataset.',
  },
  'landing.features.privacy.title': {
    kk: 'Әдепкіде — құрылғының өзінде',
    ru: 'По умолчанию — на устройстве',
    en: 'On-device by default',
  },
  'landing.features.privacy.body': {
    kk: 'Камера кадрлары браузерден шықпайды. Модельдер TensorFlow.js арқылы жергілікті жұмыс істейді.',
    ru: 'Кадры с камеры не покидают браузер. Модели работают локально на TensorFlow.js.',
    en: 'Camera frames never leave your browser. Models run locally with TensorFlow.js.',
  },
  'landing.features.a11y.body': {
    kk: 'Жоғары контраст. Барлық жерде субтитр. Пернетақтамен толық басқару. Осыны күнде қолданатын адамдар жасаған.',
    ru: 'Высокий контраст. Субтитры везде. Полная навигация с клавиатуры. Сделано теми, кто этим пользуется.',
    en: 'High contrast. Captions everywhere. Full keyboard navigation. Designed by people who use it.',
  },
  'landing.features.a11y.keys': {
    kk: 'Tab · Enter · Esc бәрінде жұмыс істейді',
    ru: 'Tab · Enter · Esc работают везде',
    en: 'Tab · Enter · Esc fully wired',
  },
  'landing.features.learn.title': { kk: 'Әліпбиді үйреніңіз', ru: 'Выучите алфавит', en: 'Learn the alphabet' },
  'landing.features.learn.body': {
    kk: 'Бекітілгенше қайталанатын карточкалар. Сөздік қорыңыз өз қарқыныңызбен өседі.',
    ru: 'Карточки с повторением до закрепления. Словарь растёт в вашем темпе.',
    en: 'Flashcards with lock-in repetition. Build vocabulary at your pace.',
  },
  'landing.features.open.title': { kk: 'Бастапқыдан ашық', ru: 'Открытый по замыслу', en: 'Open by design' },
  'landing.features.open.body': {
    kk: 'Браузерге негізделген стек. Бәрін тексеруге болады. Qyran-ды сыныпқа, емханаға, киоскіге орнатыңыз.',
    ru: 'Браузерный стек. Всё можно проверить. Встраивайте Qyran в классы, клиники, киоски.',
    en: 'Browser-native stack. Auditable. Embed Qyran in classrooms, clinics, kiosks.',
  },

  // --- Обучение --------------------------------------------------------
  'landing.learn.eyebrow': { kk: 'Үйрену', ru: 'Обучение', en: 'Learn' },
  'landing.learn.title.a': { kk: 'РЖЯ ымдау әліпбиі —', ru: 'Жестовый алфавит РЖЯ —', en: 'The RSL sign alphabet,' },
  'landing.learn.title.b': { kk: 'бір карточкадан.', ru: 'по одной карточке.', en: 'one card at a time.' },
  'landing.learn.body': {
    kk: 'Аралық қайталауы бар карточкалар. Есте қалғанын бекітіңіз, қалғанын жаттығыңыз. Күнделік те, ұялту да жоқ — тек нәтиже.',
    ru: 'Карточки с интервальным повторением. Закрепляйте то, что запомнилось, и тренируйте остальное. Без серий и упрёков — просто прогресс.',
    en: 'Flashcards with spaced repetition. Lock in the letters that stick. Practice the ones that don’t. No streaks, no shame — just progress.',
  },
  'landing.learn.cta.start': { kk: 'Жаттығуды бастау', ru: 'Начать тренировку', en: 'Start practicing' },
  'landing.learn.cta.curriculum': { kk: 'Бағдарламаны қарау', ru: 'Программа занятий', en: 'View curriculum' },
  'landing.learn.stat.letters': { kk: 'әріп', ru: 'букв', en: 'letters' },
  'landing.learn.stat.phrases': { kk: 'сөз тіркесі', ru: 'фраз', en: 'phrases' },
  'landing.learn.stat.signs': { kk: 'толық ым', ru: 'жестов целиком', en: 'full signs' },
  'landing.learn.card.title': { kk: 'Орысша · РЖЯ', ru: 'Русский · РЖЯ', en: 'Russian · RSL' },
  'landing.learn.card.locked': {
    kk: '{done} / {total} бекітілді',
    ru: '{done} / {total} закреплено',
    en: '{done} / {total} locked',
  },
  'landing.learn.card.letter': { kk: '{letter} әрпі', ru: 'Буква {letter}', en: 'Letter {letter}' },
  'landing.learn.card.hint': {
    kk: 'Бас бармақ бүгулі · сұқ саусақ тік',
    ru: 'Большой согнут · указательный прямой',
    en: 'Curl thumb · index extended',
  },
  'landing.learn.card.press': { kk: 'Бекіту үшін', ru: 'Нажмите', en: 'Press' },
  'landing.learn.card.toLock': { kk: 'басыңыз', ru: 'чтобы закрепить', en: 'to lock' },

  // --- Технологии ------------------------------------------------------
  'landing.tech.eyebrow': { kk: 'Технологиялар жиынтығы', ru: 'Стек технологий', en: 'Tech stack' },
  'landing.tech.title': { kk: 'Жұмыс істейтін нәрсенің үстіне құрылған.', ru: 'Собрано на том, что работает.', en: 'Built on what works.' },
  'landing.tech.lead': {
    kk: 'Ашық браузер примитивтері, ашық ML-құбыры. Қара жәшік те, жеткізушіге тәуелділік те жоқ.',
    ru: 'Открытые браузерные примитивы, открытый ML-пайплайн. Без чёрных ящиков и привязки к вендору.',
    en: 'Open browser primitives, an open ML pipeline. No black boxes, no vendor lock.',
  },
  'landing.tech.mediapipe.role': { kk: 'Қол мен дене нүктелері', ru: 'Точки рук и тела', en: 'Hand & body landmarks' },
  'landing.tech.mediapipe.detail': {
    kk: 'Браузерде секундына 30 кадр, әр қолда 21 нүкте.',
    ru: '21 точка на руке, 30 кадров в секунду, прямо в браузере.',
    en: '21 hand landmarks @ 30fps in the browser.',
  },
  'landing.tech.tensorflow.role': { kk: 'Ымды жіктеу', ru: 'Классификация жестов', en: 'Sign classification' },
  'landing.tech.tensorflow.detail': {
    kk: 'Кванттелген модель толығымен құрылғының өзінде.',
    ru: 'Квантованная модель целиком на устройстве.',
    en: 'Quantised model running fully on-device.',
  },
  'landing.tech.pytorch.role': { kk: 'Модельді оқыту', ru: 'Обучение моделей', en: 'Training pipeline' },
  'landing.tech.pytorch.detail': {
    kk: 'РЖЯ деректер жинағы, 900+ ым.',
    ru: 'Датасет РЖЯ, 900+ жестов.',
    en: 'RSL dataset, 900+ glosses.',
  },
  'landing.tech.opencv.role': { kk: 'Кадрды дайындау', ru: 'Подготовка кадров', en: 'Frame preprocessing' },
  'landing.tech.opencv.detail': {
    kk: 'Қию, қалыпқа келтіру, тегістеу — әр кадр.',
    ru: 'Обрезка, нормализация, сглаживание — каждый кадр.',
    en: 'Crop, normalize, smooth — every frame.',
  },
  'landing.tech.speech.role': { kk: 'Сөзді енгізу және шығару', ru: 'Ввод и вывод речи', en: 'Speech IO' },
  'landing.tech.speech.detail': {
    kk: '12 тілде сөзді тану · Жүйелік дауыстау.',
    ru: 'Распознавание речи на 12 языках · Штатное озвучивание.',
    en: 'STT in 12 languages · Native TTS playback.',
  },
  'landing.tech.supabase.role': { kk: 'Кіру және профильдер', ru: 'Вход и профили', en: 'Auth & profiles' },
  'landing.tech.supabase.detail': {
    kk: 'Поштаға жіберілетін сілтеме · Жол деңгейіндегі қауіпсіздік.',
    ru: 'Ссылки для входа на почту · Доступ на уровне строк.',
    en: 'Email magic-links · Row-level security.',
  },

  // --- Кому это нужно --------------------------------------------------
  'landing.audience.eyebrow': { kk: 'Бұл кімге керек', ru: 'Кому это нужно', en: "Who it's for" },
  'landing.audience.title': {
    kk: 'Әңгімедегі екі жаққа да жасалған.',
    ru: 'Сделано для обеих сторон разговора.',
    en: 'Built for everyone in the conversation.',
  },
  'landing.audience.g1.tag': { kk: 'Сізге', ru: 'Вам', en: 'You' },
  'landing.audience.g1.who': {
    kk: 'Естімейтін және нашар еститіндерге',
    ru: 'Глухим и слабослышащим',
    en: 'Deaf & hard-of-hearing',
  },
  'landing.audience.g1.why': {
    kk: 'Күнделікті әңгімеге арналған ана тіліндегі құрал: дәріхана, мектеп, такси, отбасы чаты.',
    ru: 'Инструмент на родном языке для повседневных разговоров: аптека, школа, такси, семейный чат.',
    en: 'A first-language tool for daily conversations — pharmacy, school, taxi, family group chats.',
  },
  'landing.audience.g2.tag': { kk: 'Жақындарға', ru: 'Близким', en: 'Your people' },
  'landing.audience.g2.who': { kk: 'Еститін туыстарға', ru: 'Слышащим родным', en: 'Hearing family members' },
  'landing.audience.g2.why': {
    kk: 'Ымды өз қарқыныңызбен үйреніңіз. Ата-анаңызбен, бауырыңызбен немесе балаңызбен бөлмеде үшінші адамсыз сөйлесіңіз.',
    ru: 'Учите жесты в своём темпе. Говорите с родителем, братом или ребёнком без третьего человека в комнате.',
    en: 'Practice signs at your own pace. Catch up with a parent, sibling, or child without a third person in the room.',
  },
  'landing.audience.g3.tag': { kk: 'Ұстаздарға', ru: 'Педагогам', en: 'Educators' },
  'landing.audience.g3.who': { kk: 'Мұғалімдер мен мектептерге', ru: 'Учителям и школам', en: 'Teachers & schools' },
  'landing.audience.g3.why': {
    kk: 'Qyran-ды сыныпқа орнатыңыз. Нақты уақыттағы субтитрлер. РЖЯ ымдау әліпбиі бойынша сабақ жоспарлары.',
    ru: 'Встройте Qyran в класс. Субтитры в реальном времени. Планы уроков по жестовому алфавиту РЖЯ.',
    en: 'Embed Qyran in classrooms. Real-time captions. Lesson plans for the RSL sign alphabet.',
  },
  'landing.audience.g4.tag': { kk: 'Мекемелерге', ru: 'Учреждениям', en: 'Institutions' },
  'landing.audience.g4.who': {
    kk: 'Емханалар мен мемлекеттік қызметтерге',
    ru: 'Клиникам и государственным службам',
    en: 'Clinics & public services',
  },
  'landing.audience.g4.why': {
    kk: 'Тіркеушіге науқасқа ыммен жауап беруге мүмкіндік беретін тегін киоск. Биыл 14 жерде орнатылды.',
    ru: 'Бесплатный киоск, с которым регистратор ответит пациенту жестом. В этом году развёрнут в 14 местах.',
    en: 'A free kiosk app that lets a receptionist sign a patient back. Deployed in 14 places this year.',
  },

  // --- Почему это важно ------------------------------------------------
  'landing.impact.eyebrow': { kk: 'Бұл неге маңызды', ru: 'Почему это важно', en: 'Why this matters' },
  'landing.impact.quote': {
    kk: '«70 миллион адам ымдау тілін ана тілі ретінде қолданады. Мемлекеттік қызметтердің көбі оған жауап бермейді.»',
    ru: '«70 миллионов человек говорят на жестовом языке как на родном. Большинство государственных служб им не отвечает.»',
    en: '"70 million people use sign language as their first language. Most public services don’t speak it back."',
  },
  'landing.impact.source': { kk: 'WFD · Жаһандық есеп', ru: 'WFD · Глобальный отчёт', en: 'WFD · Global report' },
  'landing.impact.stat1': {
    kk: 'KZ, UZ, KG елдеріндегі ымдау тілін қолданушы',
    ru: 'носителей жестового языка в KZ, UZ, KG',
    en: 'sign language users in KZ, UZ, KG',
  },
  'landing.impact.stat2': {
    kk: 'аудармашысы бар мемлекеттік қызмет',
    ru: 'госслужб с доступом к переводчику',
    en: 'public services with interpreter access',
  },
  'landing.impact.stat3': {
    kk: '2026 жылы Qyran-ды сынап жатқан мектеп',
    ru: 'школ тестируют Qyran в 2026 году',
    en: 'schools piloting Qyran in 2026',
  },
  'landing.impact.builtWith': { kk: 'Мына құралдармен жасалған', ru: 'Собрано на', en: 'Built with' },

  // --- Вопросы ---------------------------------------------------------
  'landing.faq.eyebrow': { kk: 'Жиі қойылатын сұрақтар', ru: 'Частые вопросы', en: 'FAQ' },
  'landing.faq.title': { kk: 'Жауап береміз.', ru: 'Отвечаем.', en: 'Questions, answered.' },
  'landing.faq.q1': {
    kk: 'Qyran интернетсіз жұмыс істей ме?',
    ru: 'Работает ли Qyran без интернета?',
    en: 'Does Qyran work without an internet connection?',
  },
  'landing.faq.a1': {
    kk: 'Модельдер браузерде жұмыс істейді: бет жүктелген соң аудармашыны байланыс нашар болғанда да қолдана аласыз. Алғашқы жүктеу — шамамен 8 МБ.',
    ru: 'Модели работают в браузере: после загрузки страницы переводчиком можно пользоваться при слабой связи. Первая загрузка — около 8 МБ.',
    en: 'Models run in your browser, so once the page loads you can keep using the translator with limited connectivity. Initial download is roughly 8 MB.',
  },
  'landing.faq.q2': {
    kk: 'Қандай ымдау тілдері қолдау табады?',
    ru: 'Какие жестовые языки поддерживаются?',
    en: 'Which sign languages does it support?',
  },
  'landing.faq.a2': {
    kk: 'Орыс ымдау тілі (РЖЯ) — 900-ден астам ымнан тұратын кітапхана және дактиль әліпбиі.',
    ru: 'Русский жестовый язык (РЖЯ) — библиотека из 900+ жестов и дактильный алфавит.',
    en: 'Russian Sign Language (RSL) — a library of 900+ signs plus the fingerspelling alphabet.',
  },
  'landing.faq.q3': {
    kk: 'Менің бейнем бір жаққа жіберіле ме?',
    ru: 'Уходит ли моё видео куда-нибудь?',
    en: 'Is my video sent anywhere?',
  },
  'landing.faq.a3': {
    kk: 'Жоқ. Кадрлар құрылғының өзінде TensorFlow.js арқылы өңделеді. Оқытуға беруге өзіңіз келіспейінше, ештеңе браузерден шықпайды.',
    ru: 'Нет. Кадры обрабатываются на устройстве через TensorFlow.js. Ничего не покидает браузер, пока вы сами не разрешите передать записи для обучения.',
    en: 'No. Camera frames are processed on-device with TensorFlow.js. Nothing leaves your browser unless you opt in to share for training.',
  },
  'landing.faq.q4': {
    kk: 'Qyran-ды мектепте немесе емханада қолдануға бола ма?',
    ru: 'Можно ли использовать Qyran в школе или клинике?',
    en: 'Can I use Qyran in a classroom or clinic?',
  },
  'landing.faq.a4': {
    kk: 'Иә, кез келген заманауи браузерде жұмыс істейді. Мектептер мен мемлекеттік мекемелерге тегін нұсқасы бар — бізге жазыңыз.',
    ru: 'Да, он работает в любом современном браузере. Для школ и госучреждений есть бесплатная встройка — напишите нам.',
    en: 'Yes — it runs in any modern browser. We also offer a free embed for schools and public institutions. Get in touch.',
  },
  'landing.faq.q5': { kk: 'Мұны кім жасады?', ru: 'Кто это сделал?', en: 'Who built this?' },
  'landing.faq.a5': {
    kk: 'Алматыдағы шағын команда — Қазақстандағы естімейтіндер қауымдастығымен бірге жұмыс істейді. Біз естімейтін инженерлерді жұмысқа аламыз және әр шығарылымда ымдау тілі кеңесшілерінің еңбегін төлейміз.',
    ru: 'Небольшая команда из Алматы, которая работает с сообществом глухих Казахстана. Мы нанимаем глухих инженеров и оплачиваем работу консультантов по жестовому языку в каждом релизе.',
    en: 'A small team based in Almaty, working with the Deaf community in Kazakhstan. We hire Deaf engineers and pay sign-language consultants on every release.',
  },

  // --- Финальный призыв ------------------------------------------------
  'landing.cta.title.a': { kk: 'Әңгімені бастаңыз —', ru: 'Начните разговор,', en: 'Start a conversation' },
  'landing.cta.title.b': { kk: 'ол екі жаққа да жүреді.', ru: 'который идёт в обе стороны.', en: 'that goes both ways.' },
  'landing.cta.body': {
    kk: 'Qyran-ды браузерде ашыңыз. Демо үшін тіркелудің қажеті жоқ.',
    ru: 'Откройте Qyran в браузере. Для демо регистрация не нужна.',
    en: 'Open Qyran in your browser. No signup needed for the demo.',
  },
  'landing.cta.open': { kk: 'Аудармашыны ашу', ru: 'Открыть переводчик', en: 'Open the translator' },
  'landing.cta.docs': { kk: 'Құжаттаманы оқу', ru: 'Читать документацию', en: 'Read the docs' },
  'landing.cta.browsers': {
    kk: 'CHROME · SAFARI · EDGE · FIREFOX БРАУЗЕРЛЕРІНДЕ ЖҰМЫС ІСТЕЙДІ',
    ru: 'РАБОТАЕТ В CHROME · SAFARI · EDGE · FIREFOX',
    en: 'WORKS IN CHROME · SAFARI · EDGE · FIREFOX',
  },

  // --- Подвал ----------------------------------------------------------
  'landing.footer.tagline': {
    kk: 'Орталық Азияға арналған ЖИ-негізіндегі ымдау тілі аудармашысы. Ашық. Қолжетімді. Естімейтіндер қауымдастығымен бірге жасалған.',
    ru: 'ИИ-переводчик жестового языка для Центральной Азии. Открытый. Доступный. Сделан вместе с сообществом глухих.',
    en: 'An AI sign language translator for Central Asia. Open. Accessible. Built with the Deaf community.',
  },
  'landing.footer.col.product': { kk: 'Өнім', ru: 'Продукт', en: 'Product' },
  'landing.footer.col.company': { kk: 'Компания', ru: 'Компания', en: 'Company' },
  'landing.footer.col.resources': { kk: 'Материалдар', ru: 'Материалы', en: 'Resources' },
  'landing.footer.link.translator': { kk: 'Аудармашы', ru: 'Переводчик', en: 'Translator' },
  'landing.footer.link.avatar': { kk: 'Аватар', ru: 'Аватар', en: 'Avatar' },
  'landing.footer.link.changelog': { kk: 'Өзгерістер тізімі', ru: 'История изменений', en: 'Changelog' },
  'landing.footer.link.about': { kk: 'Жоба туралы', ru: 'О проекте', en: 'About' },
  'landing.footer.link.team': { kk: 'Команда', ru: 'Команда', en: 'Team' },
  'landing.footer.link.press': { kk: 'Баспасөз', ru: 'Пресса', en: 'Press' },
  'landing.footer.link.contact': { kk: 'Байланыс', ru: 'Контакты', en: 'Contact' },
  'landing.footer.link.docs': { kk: 'Құжаттама', ru: 'Документация', en: 'Documentation' },
  'landing.footer.link.a11y': { kk: 'Қолжетімділік', ru: 'Доступность', en: 'Accessibility' },
  'landing.footer.link.privacy': { kk: 'Құпиялылық', ru: 'Конфиденциальность', en: 'Privacy' },
  'landing.footer.link.terms': { kk: 'Шарттар', ru: 'Условия', en: 'Terms' },
  'landing.footer.copyright': {
    kk: '© 2026 Qyran. Алматы, Қазақстан.',
    ru: '© 2026 Qyran. Алматы, Казахстан.',
    en: '© 2026 Qyran. Almaty, Kazakhstan.',
  },
  'landing.footer.version': {
    kk: 'v0.9.2 — 2026 жылдың сәуірінде жарияланды',
    ru: 'v0.9.2 — опубликовано в апреле 2026',
    en: 'v0.9.2 — published Apr 2026',
  },

  // --- Команда ---------------------------------------------------------
  'landing.team.eyebrow': { kk: 'Команда', ru: 'Команда', en: 'Team' },
  'landing.team.title.a': { kk: 'Екі құрылтайшы.', ru: 'Два сооснователя.', en: 'Two co-founders.' },
  'landing.team.title.b': {
    kk: 'Және кеңесшілер қауымдастығы.',
    ru: 'И сообщество консультантов.',
    en: 'A community of advisors.',
  },
  'landing.team.f1.role': {
    kk: 'Құрылтайшы · ML және компьютерлік көру',
    ru: 'Сооснователь · ML и компьютерное зрение',
    en: 'Co-founder · ML & Computer Vision',
  },
  'landing.team.f1.bio': {
    kk: 'Тану жүйесіне жауап береді. Ым тілінің ашық деректер жинағында РЖЯ жіктеуішін оқытты.',
    ru: 'Отвечает за распознавание. Обучил классификатор РЖЯ на открытом датасете жестового языка.',
    en: 'Builds the recognition pipeline. Trained the RSL classifier on an open sign-language dataset.',
  },
  'landing.team.f2.role': {
    kk: 'Құрылтайшы · Өнім және қауымдастық',
    ru: 'Сооснователь · Продукт и сообщество',
    en: 'Co-founder · Product & Community',
  },
  'landing.team.f2.bio': {
    kk: 'Дизайн мен серіктестікті жүргізеді. Qyran шынайы болып қалуы үшін Орталық Азиядағы мектептермен, емханалармен және естімейтіндер қауымының белсенділерімен жұмыс істейді.',
    ru: 'Ведёт дизайн и партнёрства. Работает со школами, клиниками и активистами сообщества глухих по всей Центральной Азии, чтобы Qyran оставался честным.',
    en: 'Leads design and partnerships. Works with schools, clinics and Deaf advocates across Central Asia to keep Qyran honest.',
  },
  'landing.team.note': {
    kk: 'Qyran әр шығарылымда естімейтін кеңесшілердің еңбегін төлейді. Біз қызмет ететін қауымдастықтан адам жалдаймыз.',
    ru: 'Qyran оплачивает работу глухих консультантов в каждом релизе. Мы нанимаем из того сообщества, для которого работаем.',
    en: 'Qyran also pays Deaf consultants on every release. We hire from the community we serve.',
  },
};

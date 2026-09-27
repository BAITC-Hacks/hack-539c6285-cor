import type { Dictionary } from '@/i18n/messages/index';

/** Распознаватель: жест с камеры в текст. */
export const recognizer: Dictionary = {
  // Шапка
  'recognizer.page.title': { kk: 'Танушы', ru: 'Распознаватель', en: 'Recognizer' },
  'recognizer.page.sub': { kk: 'ым → сөз', ru: 'жест → речь', en: 'signs → speech' },
  'recognizer.status.recording': { kk: 'Жазылуда…', ru: 'Идёт запись…', en: 'Recording…' },

  // Заголовок страницы
  'recognizer.hero.eyebrow': { kk: 'Ым → сөз', ru: 'Жест → речь', en: 'Signs → Speech' },
  'recognizer.hero.title': { kk: 'Камераға ым көрсетіңіз.', ru: 'Покажите жест камере.', en: 'Sign to the camera.' },
  'recognizer.hero.titleDim': { kk: 'Ол дауыстап айтады.', ru: 'Она ответит голосом.', en: 'It speaks back.' },

  // Панель камеры
  'recognizer.camera.recording': { kk: 'Жазылуда', ru: 'Идёт запись', en: 'Recording' },
  'recognizer.camera.off': { kk: 'Камера өшірулі', ru: 'Камера выключена', en: 'Camera off' },
  'recognizer.tag.model': { kk: 'Модель', ru: 'Модель', en: 'Model' },
  // Подсказка «Нажмите <Начать распознавание>, чтобы начать» собирается из двух
  // половин вокруг названия кнопки. По-казахски название идёт первым, поэтому
  // левая половина пустая — это не пропущенный перевод.
  'recognizer.camera.hintBefore': { kk: '', ru: 'Нажмите ', en: 'Press ' },
  'recognizer.camera.hintAfter': { kk: ' түймесін басыңыз', ru: ', чтобы начать', en: ' to begin' },

  // Ошибка загрузки
  'recognizer.error.title': { kk: 'Жүктелмеді', ru: 'Не удалось загрузить', en: 'Failed to load' },
  'recognizer.error.reload': { kk: 'Бетті жаңарту', ru: 'Перезагрузить страницу', en: 'Reload page' },

  // Собранные слова
  'recognizer.chip.remove': { kk: 'Өшіру үшін басыңыз', ru: 'Нажмите, чтобы убрать', en: 'Click to remove' },
  'recognizer.chips.clear': { kk: 'Тазалау', ru: 'Очистить', en: 'Clear' },
  'recognizer.alt.title': { kk: 'Басқа сөз бе?', ru: 'Не то слово?', en: 'Wrong word?' },
  'recognizer.chips.clearAll': { kk: 'Барлығын тазалау', ru: 'Очистить всё', en: 'Clear all' },

  // Индикатор фиксации слова
  'recognizer.locking.progress': { kk: '{percent}% бекітілуде', ru: '{percent}% фиксируется', en: '{percent}% locking in' },
  'recognizer.hint.showSign': { kk: 'Сөздіктегі ымды көрсетіңіз…', ru: 'Покажите жест из словаря…', en: 'Show a sign from the dictionary…' },

  // Отладка
  'recognizer.debug.label': { kk: 'Диагностика', ru: 'Отладка', en: 'Debug' },
  'recognizer.debug.title': { kk: 'Диагностика — үздік 3 болжам', ru: 'Отладка — топ-3 предсказания', en: 'Debug — top 3 predictions' },
  'recognizer.debug.hint': { kk: 'Үздік 3 болжамды көрсету', ru: 'Показать топ-3 предсказания', en: 'Show the top 3 predictions' },

  // Этапы обработки
  'recognizer.stage.hand': { kk: 'Қолды бақылау', ru: 'Отслеживание рук', en: 'Hand tracking' },
  'recognizer.stage.emotion': { kk: 'Эмоцияны тану', ru: 'Распознавание эмоций', en: 'Emotion detection' },
  'recognizer.stage.llm': { kk: 'LLM талдауы', ru: 'Интерпретация LLM', en: 'LLM interpretation' },
  'recognizer.stage.voice': { kk: 'Дауыстап айту', ru: 'Озвучивание', en: 'Voice output' },
  'recognizer.stage.soon': { kk: 'жақында', ru: 'скоро', en: 'soon' },

  // Предложение и озвучка
  'recognizer.sentence.title': { kk: 'Сөйлем', ru: 'Предложение', en: 'Sentence' },
  'recognizer.speak.speak': { kk: 'Айту', ru: 'Озвучить', en: 'Speak' },
  'recognizer.speak.stop': { kk: 'Тоқтату', ru: 'Остановить', en: 'Stop' },
  'recognizer.speak.unsupported': {
    kk: 'Бұл браузер дауыс синтезін қолдамайды',
    ru: 'Синтез речи не поддерживается в этом браузере',
    en: 'Speech synthesis is not supported in this browser',
  },

  // Кнопки под камерой
  'recognizer.controls.start': { kk: 'Тануды бастау', ru: 'Начать распознавание', en: 'Start recognition' },
  'recognizer.controls.stop': { kk: 'Тоқтату', ru: 'Остановить', en: 'Stop' },
  'recognizer.mirror.label': { kk: 'Айна', ru: 'Зеркало', en: 'Mirror' },
  'recognizer.mirror.hint': {
    kk: 'Камера кескінін көлденең аудару',
    ru: 'Отразить изображение камеры по горизонтали',
    en: 'Flip camera input horizontally',
  },
  'recognizer.toggle.on': { kk: 'ҚОСУЛЫ', ru: 'ВКЛ', en: 'ON' },
  'recognizer.toggle.off': { kk: 'ӨШІРУЛІ', ru: 'ВЫКЛ', en: 'OFF' },
  'recognizer.asl.label': { kk: 'ASL A–Z', ru: 'ASL A–Z', en: 'ASL A–Z' },
  'asl.title': { kk: 'ASL зертханасы', ru: 'Лаборатория ASL', en: 'ASL Lab' },
  'asl.sub': { kk: '/ саусақ әліпбиі A–Z', ru: '/ пальцевая азбука A–Z', en: '/ fingerspelling A–Z' },
  'asl.cameraTag': { kk: 'КАМЕРА', ru: 'КАМЕРА', en: 'CAMERA' },
  'asl.handYes': { kk: 'қол көрінеді', ru: 'рука видна', en: 'hand tracked' },
  'asl.handNo': { kk: 'қол көрінбейді', ru: 'руки не видно', en: 'no hand' },
  'asl.start': { kk: 'Камераны қосу', ru: 'Включить камеру', en: 'Start camera' },
  'asl.stop': { kk: 'Тоқтату', ru: 'Остановить', en: 'Stop' },
  'asl.loading': { kk: 'Жүктелуде…', ru: 'Загрузка…', en: 'Loading…' },
  'asl.output': { kk: 'Терілген жол', ru: 'Набранная строка', en: 'Typed string' },
  'asl.clear': { kk: 'Тазалау', ru: 'Очистить', en: 'Clear' },
  'asl.top': { kk: 'Үміткер әріптер', ru: 'Кандидаты', en: 'Candidates' },
  'asl.hint': {
    kk: 'A–Z әрпін бір қолмен көрсетіп, жарты секунд ұстап тұрыңыз',
    ru: 'Покажите букву A–Z одной рукой и удержите полсекунды',
    en: 'Show an A–Z letter with one hand and hold for half a second',
  },
  'asl.howto': {
    kk: 'Әріп сақинадағы прогресс толғанда жолға жазылады. Қайталау үшін — қолды түсіріп, қайта көрсетіңіз. Қате әріпті «Тазалау» өшіреді. J мен Z қозғалысты қажет етеді — статикалық модель оларды жиі шатастырады.',
    ru: 'Буква записывается в строку, когда кольцо прогресса заполнится. Для повтора той же буквы — опустите руку и покажите снова. Ошибку стирает кнопка «Очистить». J и Z в ASL требуют движения — статичная модель их часто путает.',
    en: 'A letter is committed when the progress ring fills. To repeat a letter, drop your hand and show it again. Use Clear to erase mistakes. J and Z require motion — a static model often confuses them.',
  },
  'recognizer.asl.hint': {
    kk: 'Америкалық саусақ әліпбиі: бір қолмен A-Z әріптерін көрсетіңіз',
    ru: 'Американская пальцевая азбука: показывайте буквы A–Z одной рукой',
    en: 'American fingerspelling: show A–Z letters with one hand',
  },

  // Карточка модели
  'recognizer.model.title': { kk: 'Модель', ru: 'Модель', en: 'Model' },
  'recognizer.model.waiting': { kk: 'Күтуде', ru: 'Ожидание', en: 'Waiting' },
  'recognizer.model.classes': { kk: 'Кластар', ru: 'Классы', en: 'Classes' },
  'recognizer.model.architecture': { kk: 'Архитектура', ru: 'Архитектура', en: 'Architecture' },
  'recognizer.model.features': { kk: 'Белгілер', ru: 'Признаки', en: 'Features' },
  'recognizer.model.accuracy': { kk: 'Дәлдік', ru: 'Точность', en: 'Accuracy' },
  // Выбор модели
  'recognizer.model.qyran240': { kk: 'Qyran-240', ru: 'Qyran-240', en: 'Qyran-240' },
  'recognizer.model.slovo1001': { kk: 'SLOVO-1001', ru: 'SLOVO-1001', en: 'SLOVO-1001' },
  'recognizer.model.qyran240.hint': {
    kk: 'Біздің модель: YouTube-тағы орыс ым тілінің 240 сөзі, үш желінің ансамблі',
    ru: 'Наша модель: 240 слов русского жестового языка с YouTube, ансамбль из трёх сетей',
    en: 'Our own model: 240 Russian Sign Language words from YouTube, an ensemble of three networks',
  },
  'recognizer.model.slovo1001.hint': {
    kk: 'SLOVO деректер жинағындағы 1001 ым',
    ru: '1001 жест из датасета SLOVO',
    en: '1,001 signs from the SLOVO dataset',
  },

  // Словарь жестов
  'recognizer.signs.title': { kk: 'Ымдар', ru: 'Жесты', en: 'Signs' },

  // История
  'recognizer.history.title': { kk: 'Тарих', ru: 'История', en: 'History' },
  'recognizer.history.emptyRunning': { kk: 'Камераға ым көрсетіңіз…', ru: 'Покажите жест в камеру…', en: 'Show a sign to the camera…' },
  'recognizer.history.emptyIdle': {
    kk: 'Бастау үшін «Тануды бастау» түймесін басыңыз',
    ru: 'Нажмите «Начать распознавание»',
    en: 'Press Start to begin',
  },
  'recognizer.history.note': {
    kk: 'Сенімді танулар (≥70%) осында шығады',
    ru: 'Уверенные распознавания (≥70%) появятся здесь',
    en: 'Confident detections (≥70%) appear here',
  },
};

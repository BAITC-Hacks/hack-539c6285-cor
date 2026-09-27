import type { Dictionary } from '@/i18n/messages/index';

/** Студия записи жестов. */
export const studio: Dictionary = {
  // --- шапка -------------------------------------------------------------
  'studio.title': { kk: 'Ым студиясы', ru: 'Студия жестов', en: 'Sign studio' },
  'studio.subtitle': {
    kk: 'жаңа ымды жазу',
    ru: 'запись нового знака',
    en: 'recording a new sign',
  },

  // --- заголовки панелей --------------------------------------------------
  // Набраны прописными прямо в переводе: text-transform к этим подписям не
  // применяется, регистр задаёт сам текст.
  'studio.panel.camera': { kk: 'КАМЕРА', ru: 'КАМЕРА', en: 'CAMERA' },
  'studio.panel.avatar': {
    kk: 'АВАТАР ҚАЙТАЛАЙДЫ',
    ru: 'АВАТАР ПОВТОРЯЕТ',
    en: 'THE AVATAR MIRRORS YOU',
  },
  'studio.panel.save': {
    kk: 'АТАУ ЖӘНЕ САҚТАУ',
    ru: 'НАЗВАТЬ И СОХРАНИТЬ',
    en: 'NAME AND SAVE',
  },
  'studio.panel.myGestures': {
    kk: 'МЕНІҢ ЫМДАРЫМ',
    ru: 'МОИ ЖЕСТЫ',
    en: 'MY SIGNS',
  },

  // --- строка состояния ---------------------------------------------------
  'studio.status.camera': {
    kk: 'Камера қосылып жатыр…',
    ru: 'Включаю камеру…',
    en: 'Starting the camera…',
  },
  'studio.status.tracking': {
    kk: 'Қимыл тану жүктелуде…',
    ru: 'Загружаю трекинг…',
    en: 'Loading tracking…',
  },
  'studio.status.review': {
    kk: 'Ымды аватардан тексеріңіз',
    ru: 'Проверьте жест на аватаре',
    en: 'Check the sign on the avatar',
  },
  'studio.status.noHands': {
    kk: 'Қол көрінбейді — қолыңыз кадрға сыятындай артқа шегініңіз',
    ru: 'Рук не видно — отойдите, чтобы руки попали в кадр',
    en: 'No hands in view — step back so they fit in the frame',
  },
  'studio.status.recording': {
    kk: 'Жазылып жатыр — бос орын пернесін жіберіңіз',
    ru: 'Идёт запись — отпустите пробел',
    en: 'Recording — release the space bar',
  },
  'studio.status.idle': {
    kk: 'Бос орын пернесін басып тұрып, ымды көрсетіңіз',
    ru: 'Зажмите пробел и покажите жест',
    en: 'Hold the space bar and show the sign',
  },

  // --- значки поверх видео ------------------------------------------------
  'studio.hands.both': { kk: 'екі қол', ru: 'обе руки', en: 'both hands' },
  'studio.hands.left': { kk: 'тек сол қол', ru: 'только левая', en: 'left hand only' },
  'studio.hands.right': { kk: 'тек оң қол', ru: 'только правая', en: 'right hand only' },
  'studio.hands.none': { kk: 'қол көрінбейді', ru: 'рук не видно', en: 'no hands in view' },
  'studio.rec.frames': { kk: '{count} кадр', ru: '{count} кадров', en: '{count} frames' },

  'studio.live.camera': { kk: 'тікелей камера', ru: 'живая камера', en: 'live camera' },
  'studio.live.playback': { kk: 'жазба', ru: 'запись', en: 'playback' },

  // --- запись -------------------------------------------------------------
  'studio.record.start': {
    kk: 'Бос орын пернесін не осы түймені басып тұрыңыз',
    ru: 'Зажмите пробел или эту кнопку',
    en: 'Hold the space bar or this button',
  },
  'studio.record.stop': {
    kk: 'Аяқтау үшін жіберіңіз',
    ru: 'Отпустите, чтобы закончить',
    en: 'Release to finish',
  },
  'studio.action.replay': {
    kk: 'Тағы бір рет ойнату',
    ru: 'Проиграть ещё раз',
    en: 'Play again',
  },
  'studio.action.rerecord': { kk: 'Қайта жазу', ru: 'Перезаписать', en: 'Record again' },
  'studio.clip.keys': { kk: '{count} кілт кадр', ru: '{count} ключей', en: '{count} keyframes' },

  // --- сохранение ---------------------------------------------------------
  'studio.input.placeholder': {
    kk: 'Бұл ым нені білдіреді? Мысалы: привет',
    ru: 'Что означает этот жест? Например: привет',
    en: 'What does this sign mean? For example: hello',
  },
  'studio.action.save': { kk: 'Ымды сақтау', ru: 'Сохранить жест', en: 'Save the sign' },
  'studio.action.saving': { kk: 'Сақталуда…', ru: 'Сохраняю…', en: 'Saving…' },
  'studio.consent.label': {
    kk: 'Модельді үйрету үшін бастапқы кадрлар сақталсын — олардан анимацияны қайта жинауға болады',
    ru: 'Сохранить сырые кадры для обучения модели — из них можно пересобрать анимацию заново',
    en: 'Keep the raw frames for model training — the animation can be rebuilt from them',
  },
  'studio.msg.saved': { kk: 'Сақталды: «{word}»', ru: 'Сохранено: «{word}»', en: 'Saved: «{word}»' },

  // --- ошибки -------------------------------------------------------------
  'studio.error.avatarLoad': {
    kk: 'Аватарды жүктеу мүмкін болмады.',
    ru: 'Не удалось загрузить аватар.',
    en: 'Could not load the avatar.',
  },
  'studio.error.tooShort': {
    kk: 'Жазба тым қысқа — бос орын пернесін кемінде жарты секунд ұстаңыз.',
    ru: 'Запись слишком короткая — держите пробел хотя бы полсекунды.',
    en: 'The recording is too short — hold the space bar for at least half a second.',
  },
  'studio.error.avatarNotReady': {
    kk: 'Аватар әлі жүктеліп болған жоқ.',
    ru: 'Аватар ещё не загрузился.',
    en: 'The avatar has not loaded yet.',
  },
  'studio.error.processFailed': {
    kk: 'Жазбаны өңдеу мүмкін болмады: {reason}',
    ru: 'Не удалось обработать запись: {reason}',
    en: 'Could not process the recording: {reason}',
  },
  'studio.error.noTorso': {
    kk: 'жазбада дене көрінбейді',
    ru: 'в записи не видно корпуса',
    en: 'the torso is not visible in the recording',
  },
  'studio.error.needWord': {
    kk: 'Осы ым білдіретін сөзді жазыңыз.',
    ru: 'Введите слово, которое означает этот жест.',
    en: 'Enter the word this sign stands for.',
  },
};

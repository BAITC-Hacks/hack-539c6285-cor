// Процедурный словарь жестов для 3D-аватара.
//
// Как в фонологии жестовых языков, каждый жест-слово описан тройкой:
//   форма кисти (SHAPES) + позиция руки (LOC) + движение (motion).
// Из этого конструктора собран словарь ~90 слов, достаточный для простых
// предложений («я хотеть есть», «ты идти школа завтра» …).
//
// ВНИМАНИЕ: жесты — узнаваемые ПРИБЛИЖЕНИЯ к РЖЯ, не выверенный словарь.
// Формы легко правятся в таблице WORDS. Все значения — дельты против rest
// в радианах (XYZ). Оси рига измерены эмпирически (см. dactyl.ts):
// сгиб пальцев правой руки +Z (левой −Z), позы рук подобраны по мировым
// координатам кисти.

import type { GestureJSON, GestureFrame } from './gesturePlayer';
import { fingerJoints, type HandShape, type Vec3 } from './dactyl';

// ——— Позиции руки (правая; левая получается зеркалированием) ———
interface ArmPose {
  arm: Vec3;
  fore: Vec3;
  wrist: Vec3;
}

const LOC: Record<string, ArmPose> = {
  /** Перед грудью, ладонь к себе */
  chest: { arm: [-0.35, 0, -0.5], fore: [0, 0, -1.9], wrist: [0, 0.6, -0.3] },
  /** Касание груди */
  chestTouch: { arm: [-0.25, 0, -0.45], fore: [0, 0, -2.2], wrist: [0, 0.6, -0.3] },
  /** Нейтральная: перед плечом, ладонь вперёд (базовая поза дактиля) */
  shoulder: { arm: [-0.35, 0, -0.6], fore: [0, 0, -2.1], wrist: [-0.1, 1.2, -0.9] },
  /** У рта / подбородка */
  mouth: { arm: [-0.5, 0, -0.72], fore: [0, 0, -2.45], wrist: [-0.55, 2.3, -0.8] },
  /** У щеки (как в «мама») */
  cheek: { arm: [-0.5, 0, -0.6], fore: [0, 0, -2.5], wrist: [-0.6, 2.4, -0.8] },
  /** У лба */
  forehead: { arm: [-0.55, 0, -0.78], fore: [0, 0, -2.6], wrist: [-0.55, 2.3, -0.8] },
  /** Рука вытянута вперёд */
  forward: { arm: [-0.8, 0, -0.45], fore: [0, 0, -1.05], wrist: [0, 0.5, -0.3] },
  /** Рука вниз-вперёд (низко) */
  low: { arm: [-0.25, 0, -0.25], fore: [0, 0, -0.9], wrist: [0, 0.4, -0.2] },
  /** У живота */
  belly: { arm: [-0.15, 0, -0.35], fore: [0, 0, -1.5], wrist: [0, 0.6, -0.3] },
};

// ——— Формы кисти ———
const SHAPES: Record<string, HandShape> = {
  open: { curl: [0.15, 0, 0, 0, 0] },
  openSpread: { curl: [0.15, 0, 0, 0, 0], spread: 1 },
  fist: { curl: [0.25, 1, 1, 1, 1] },
  point: { curl: [0.6, 0, 1, 1, 1] },
  v: { curl: [0.6, 0, 0, 1, 1], spread: 0.6 },
  pinch: { curl: [0.5, 0.6, 0.6, 0.6, 0.6] },
  c: { curl: [0.4, 0.45, 0.45, 0.45, 0.45] },
  thumbUp: { curl: [0, 1, 1, 1, 1], thumbOut: 1 },
  phone: { curl: [0, 1, 1, 1, 0], thumbOut: 1 },
  three: { curl: [0.75, 0, 0, 0, 1], spread: 0.9 },
  ring: { curl: [0.5, 0.7, 0.15, 0.15, 0.15] },
  four: { curl: [1, 0, 0, 0, 0], spread: 0.6 },
};

type MotionKind =
  | 'none' // удержание позы
  | 'tap' // касание: отвод-возврат (reps раз)
  | 'circle' // круг запястьем
  | 'shake' // помахивание запястьем
  | 'sway' // покачивание всей рукой в стороны
  | 'updown' // покачивание вверх-вниз
  | 'push' // толчок вперёд
  | 'pull' // притягивание к себе
  | 'down' // движение вниз
  | 'up' // движение вверх
  | 'twist' // разворот запястья
  | 'apart' // руки расходятся (для двуручных)
  | 'together' // руки сходятся
  | 'morph'; // форма кисти меняется на shape2

interface WordSign {
  loc: keyof typeof LOC;
  shape: keyof typeof SHAPES;
  motion: MotionKind;
  /** Повторы колебательного движения (tap/shake/updown/sway), по умолчанию 2 */
  reps?: number;
  /** Вторая форма кисти для morph (и для push/pull по желанию) */
  shape2?: keyof typeof SHAPES;
  /** Обе руки (левая — зеркало правой) */
  twoHand?: boolean;
  /** Точечные поправки позы: дельты к arm/fore/wrist */
  dArm?: Vec3;
  dWrist?: Vec3;
}

// ——— Словарь (приближение к РЖЯ; правится построчно) ———
export const WORDS: Record<string, WordSign> = {
  // Местоимения
  я: { loc: 'chestTouch', shape: 'point', motion: 'tap', reps: 1, dWrist: [1.4, 0, 0] },
  ты: { loc: 'forward', shape: 'point', motion: 'none' },
  он: { loc: 'forward', shape: 'point', motion: 'none', dArm: [0, 0, 0.3] },
  она: { loc: 'forward', shape: 'point', motion: 'none', dArm: [0, 0, 0.3] },
  они: { loc: 'forward', shape: 'point', motion: 'sway', dArm: [0, 0, 0.3] },
  мы: { loc: 'chest', shape: 'point', motion: 'circle' },
  вы: { loc: 'forward', shape: 'point', motion: 'sway' },

  // Служебные / этикет
  //
  // Блок выверен по словесным описаниям 7 августа 2026. Формулировки взяты у
  // автора проекта и НЕ проверены носителем — см. предупреждение в шапке файла.
  // Отличия от прежних записей помечены: было -> стало.

  /** Кулак у груди, короткие кивки вниз-вверх. Было: указательный у плеча. */
  да: { loc: 'chest', shape: 'fist', motion: 'updown', reps: 3 },
  /** Кулак у плеча, качание из стороны в сторону. Было: открытая ладонь. */
  нет: { loc: 'shoulder', shape: 'fist', motion: 'sway', reps: 3 },
  /** Открытая ладонь у подбородка -> вперёд и вниз. Было: только вперёд. */
  спасибо: { loc: 'mouth', shape: 'open', motion: 'push', dArm: [0.18, 0, 0] },
  пожалуйста: { loc: 'chest', shape: 'open', motion: 'circle' },
  /** Кончики пальцев на груди, круг вперёд-вниз. Было: кулак. */
  извините: { loc: 'chestTouch', shape: 'openSpread', motion: 'circle', dArm: [0.1, 0, 0] },
  пока: { loc: 'shoulder', shape: 'openSpread', motion: 'shake', reps: 3 },
  /** Открытая ладонь к плечу, пальцы вперёд, затем наклон ладони. */
  здравствуйте: { loc: 'shoulder', shape: 'open', motion: 'twist', reps: 1 },
  привет: { loc: 'shoulder', shape: 'open', motion: 'twist', reps: 1 },
  /** Кулак с поднятым большим пальцем. */
  хорошо: { loc: 'chest', shape: 'thumbUp', motion: 'none' },
  /** Тот же кулак, большой палец вниз — кисть развёрнута. */
  плохо: { loc: 'chest', shape: 'thumbUp', motion: 'none', dWrist: [0, 0, 3.0] },
  /** Обе руки расходятся в стороны, ладони вперёд, на уровне груди. */
  согласен: { loc: 'chest', shape: 'fist', motion: 'updown', reps: 3, twoHand: true },
  можно: { loc: 'chest', shape: 'thumbUp', motion: 'none' },
  нельзя: { loc: 'shoulder', shape: 'point', motion: 'sway', reps: 2 },
  нужно: { loc: 'chest', shape: 'point', motion: 'down', reps: 1 },

  // Вопросительные
  //
  // У вопросительных знаков смысл несут ещё и брови — этого аватар пока не
  // умеет: морф-таргеты browsUp/frown в риге есть, но не подключены.
  // До подключения любой вопрос читается как утверждение.

  /** Обе открытые ладони у груди расходятся в стороны. Было: одна рука. */
  что: { loc: 'chest', shape: 'openSpread', motion: 'apart', twoHand: true },
  /** Указательный у губ -> вперёд и вниз со сгибанием. Было: круг. */
  кто: { loc: 'mouth', shape: 'point', motion: 'morph', shape2: 'fist' },
  /** Оба кулака у груди, качание из стороны в сторону. Было: одна рука. */
  где: { loc: 'chest', shape: 'fist', motion: 'sway', reps: 3, twoHand: true },
  куда: { loc: 'forward', shape: 'point', motion: 'twist' },
  когда: { loc: 'shoulder', shape: 'point', motion: 'circle' },
  почему: { loc: 'forehead', shape: 'open', motion: 'twist' },
  сколько: { loc: 'chest', shape: 'pinch', motion: 'morph', shape2: 'openSpread' },
  /** Кулак у груди, пальцы сгибаются и разгибаются. Было: две открытые ладони. */
  как: { loc: 'chest', shape: 'fist', motion: 'morph', shape2: 'openSpread', reps: 2 },

  // Глаголы
  хотеть: { loc: 'chestTouch', shape: 'open', motion: 'tap', reps: 2 },
  любить: { loc: 'chestTouch', shape: 'open', motion: 'none' },
  есть: { loc: 'mouth', shape: 'pinch', motion: 'tap', reps: 2 },
  кушать: { loc: 'mouth', shape: 'pinch', motion: 'tap', reps: 2 },
  пить: { loc: 'mouth', shape: 'c', motion: 'twist' },
  спать: { loc: 'cheek', shape: 'open', motion: 'none' },
  видеть: { loc: 'forehead', shape: 'v', motion: 'push' },
  смотреть: { loc: 'forehead', shape: 'v', motion: 'push' },
  слышать: { loc: 'cheek', shape: 'point', motion: 'tap', reps: 1 },
  говорить: { loc: 'mouth', shape: 'point', motion: 'tap', reps: 2 },
  сказать: { loc: 'mouth', shape: 'point', motion: 'push' },
  знать: { loc: 'forehead', shape: 'open', motion: 'tap', reps: 1 },
  /** Указательный к виску -> вниз и вперёд. Было: касание дважды. */
  понимать: { loc: 'forehead', shape: 'point', motion: 'push', dArm: [0.2, 0, 0] },
  думать: { loc: 'forehead', shape: 'point', motion: 'circle' },
  работать: { loc: 'chest', shape: 'fist', motion: 'tap', reps: 2, twoHand: true },
  учиться: { loc: 'forehead', shape: 'pinch', motion: 'tap', reps: 2 },
  жить: { loc: 'chest', shape: 'open', motion: 'sway', twoHand: true },
  помогать: { loc: 'chest', shape: 'open', motion: 'up', twoHand: true },
  дать: { loc: 'chest', shape: 'pinch', motion: 'morph', shape2: 'open' },
  взять: { loc: 'forward', shape: 'open', motion: 'morph', shape2: 'fist' },
  купить: { loc: 'chest', shape: 'pinch', motion: 'push' },
  делать: { loc: 'chest', shape: 'fist', motion: 'twist', twoHand: true },
  мочь: { loc: 'chest', shape: 'fist', motion: 'down', twoHand: true },
  ждать: { loc: 'chest', shape: 'open', motion: 'none', twoHand: true },
  идти: { loc: 'chest', shape: 'v', motion: 'updown', reps: 2, dWrist: [0.5, 0, 0] },
  бежать: { loc: 'chest', shape: 'v', motion: 'shake', reps: 3, dWrist: [0.5, 0, 0] },
  ехать: { loc: 'chest', shape: 'fist', motion: 'sway', twoHand: true },
  читать: { loc: 'chest', shape: 'v', motion: 'sway', dWrist: [0.5, 0, 0] },
  писать: { loc: 'chest', shape: 'pinch', motion: 'sway' },
  сидеть: { loc: 'chest', shape: 'v', motion: 'down', reps: 1, dWrist: [0.5, 0, 0] },
  стоять: { loc: 'chest', shape: 'v', motion: 'none', dWrist: [0.5, 0, 0] },
  плакать: { loc: 'cheek', shape: 'point', motion: 'down', reps: 2 },
  смеяться: { loc: 'mouth', shape: 'openSpread', motion: 'updown', reps: 2 },

  // Семья и люди
  мама2: { loc: 'cheek', shape: 'open', motion: 'down', reps: 2 },
  папа: { loc: 'forehead', shape: 'open', motion: 'tap', reps: 1 },
  брат: { loc: 'chest', shape: 'point', motion: 'tap', reps: 2, twoHand: true },
  сестра: { loc: 'cheek', shape: 'point', motion: 'down', reps: 1 },
  бабушка: { loc: 'cheek', shape: 'open', motion: 'tap', reps: 2 },
  дедушка: { loc: 'forehead', shape: 'open', motion: 'tap', reps: 2 },
  ребёнок: { loc: 'low', shape: 'open', motion: 'updown', reps: 2, dWrist: [0.5, 0, 0] },
  /** Обе руки расходятся в стороны, ладони вперёд, на уровне груди. */
  счастливый: { loc: 'chest', shape: 'openSpread', motion: 'apart', twoHand: true },
  радостный: { loc: 'chest', shape: 'openSpread', motion: 'apart', twoHand: true },
  семья: { loc: 'chest', shape: 'open', motion: 'circle', twoHand: true },
  друг: { loc: 'chest', shape: 'point', motion: 'together', twoHand: true },
  человек: { loc: 'shoulder', shape: 'point', motion: 'down', reps: 1 },
  врач: { loc: 'chest', shape: 'v', motion: 'tap', reps: 2 },

  // Существительные
  дом: { loc: 'shoulder', shape: 'open', motion: 'together', twoHand: true, dWrist: [0, 0, -0.4] },
  школа: { loc: 'chest', shape: 'open', motion: 'tap', reps: 2, twoHand: true },
  работа: { loc: 'chest', shape: 'fist', motion: 'tap', reps: 2, twoHand: true },
  еда: { loc: 'mouth', shape: 'pinch', motion: 'tap', reps: 2 },
  вода: { loc: 'mouth', shape: 'three', motion: 'tap', reps: 2 },
  чай: { loc: 'mouth', shape: 'pinch', motion: 'twist' },
  хлеб: { loc: 'chest', shape: 'open', motion: 'down', reps: 2, twoHand: true },
  деньги: { loc: 'chest', shape: 'pinch', motion: 'twist' },
  книга: { loc: 'chest', shape: 'open', motion: 'apart', twoHand: true },
  телефон: { loc: 'cheek', shape: 'phone', motion: 'none' },
  машина: { loc: 'chest', shape: 'fist', motion: 'sway', reps: 2, twoHand: true },
  город: { loc: 'shoulder', shape: 'open', motion: 'sway', twoHand: true },
  улица: { loc: 'forward', shape: 'open', motion: 'sway' },
  время: { loc: 'chest', shape: 'point', motion: 'tap', reps: 2, twoHand: true },
  год: { loc: 'chest', shape: 'fist', motion: 'circle', twoHand: true },

  // Время
  день: { loc: 'shoulder', shape: 'open', motion: 'sway' },
  ночь: { loc: 'chest', shape: 'open', motion: 'down', dWrist: [0.6, 0, 0] },
  утро: { loc: 'chest', shape: 'open', motion: 'up' },
  вечер: { loc: 'shoulder', shape: 'open', motion: 'down', dWrist: [0.6, 0, 0] },
  сегодня: { loc: 'chest', shape: 'point', motion: 'down', reps: 1, dWrist: [0.5, 0, 0] },
  завтра: { loc: 'cheek', shape: 'open', motion: 'push' },
  вчера: { loc: 'cheek', shape: 'open', motion: 'pull' },
  сейчас: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, twoHand: true },
  потом: { loc: 'chest', shape: 'open', motion: 'twist' },
  здесь: { loc: 'low', shape: 'point', motion: 'tap', reps: 2 },
  там: { loc: 'forward', shape: 'point', motion: 'none', dArm: [0, 0, 0.25] },

  // Прилагательные / наречия
  хороший: { loc: 'chest', shape: 'thumbUp', motion: 'none' },
  плохой: { loc: 'chest', shape: 'fist', motion: 'shake', reps: 2 },
  большой: { loc: 'chest', shape: 'open', motion: 'apart', twoHand: true },
  маленький: { loc: 'chest', shape: 'open', motion: 'together', twoHand: true },
  красивый: { loc: 'cheek', shape: 'open', motion: 'circle' },
  быстро: { loc: 'chest', shape: 'fist', motion: 'shake', reps: 3, twoHand: true },
  медленно: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1 },
  много: { loc: 'chest', shape: 'openSpread', motion: 'apart', twoHand: true },
  мало: { loc: 'chest', shape: 'pinch', motion: 'together', twoHand: true },
  горячий: { loc: 'mouth', shape: 'open', motion: 'push' },
  холодный: { loc: 'chest', shape: 'fist', motion: 'shake', reps: 3, twoHand: true },

  // Магазин и еда
  продать: { loc: 'chest', shape: 'pinch', motion: 'push' },
  платить: { loc: 'chest', shape: 'pinch', motion: 'down', reps: 1 },
  цена: { loc: 'chest', shape: 'pinch', motion: 'tap', reps: 2 },
  дорого: { loc: 'shoulder', shape: 'pinch', motion: 'updown', reps: 2 },
  дёшево: { loc: 'low', shape: 'pinch', motion: 'down', reps: 1 },
  мясо: { loc: 'chest', shape: 'c', motion: 'twist' },
  рыба: { loc: 'forward', shape: 'open', motion: 'sway', reps: 2 },
  яблоко: { loc: 'mouth', shape: 'c', motion: 'twist' },
  фрукты: { loc: 'mouth', shape: 'c', motion: 'tap', reps: 2 },
  овощи: { loc: 'chest', shape: 'c', motion: 'sway', reps: 2 },
  сахар: { loc: 'mouth', shape: 'pinch', motion: 'down', reps: 2 },
  соль: { loc: 'mouth', shape: 'three', motion: 'tap', reps: 2 },
  суп: { loc: 'mouth', shape: 'c', motion: 'updown', reps: 2 },
  каша: { loc: 'chest', shape: 'c', motion: 'circle' },
  кофе: { loc: 'chest', shape: 'fist', motion: 'circle', twoHand: true },
  масло: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1 },
  сыр: { loc: 'chest', shape: 'fist', motion: 'twist' },
  яйцо: { loc: 'chest', shape: 'pinch', motion: 'morph', shape2: 'open' },
  конфета: { loc: 'cheek', shape: 'point', motion: 'twist' },
  мороженое: { loc: 'mouth', shape: 'fist', motion: 'down', reps: 2 },

  // Здоровье и тело
  болеть: { loc: 'chestTouch', shape: 'fist', motion: 'shake', reps: 2 },
  больно: { loc: 'chest', shape: 'point', motion: 'twist' },
  здоровый: { loc: 'chest', shape: 'fist', motion: 'up', reps: 1 },
  таблетка: { loc: 'mouth', shape: 'pinch', motion: 'tap', reps: 1 },
  лекарство: { loc: 'chest', shape: 'c', motion: 'circle' },
  аптека: { loc: 'chest', shape: 'c', motion: 'tap', reps: 2, twoHand: true },
  голова: { loc: 'forehead', shape: 'open', motion: 'tap', reps: 1 },
  живот: { loc: 'belly', shape: 'open', motion: 'tap', reps: 1 },
  сердце: { loc: 'chestTouch', shape: 'open', motion: 'tap', reps: 2 },
  рука: { loc: 'forward', shape: 'open', motion: 'tap', reps: 1 },
  нога: { loc: 'low', shape: 'point', motion: 'tap', reps: 2 },
  глаза: { loc: 'forehead', shape: 'v', motion: 'tap', reps: 1 },
  уши: { loc: 'cheek', shape: 'point', motion: 'tap', reps: 2 },
  нос: { loc: 'mouth', shape: 'point', motion: 'tap', reps: 1 },
  рот: { loc: 'mouth', shape: 'point', motion: 'circle' },
  зубы: { loc: 'mouth', shape: 'point', motion: 'tap', reps: 2 },
  кровь: { loc: 'chest', shape: 'three', motion: 'down', reps: 2 },
  температура: { loc: 'forehead', shape: 'open', motion: 'tap', reps: 2 },
  кашель: { loc: 'chestTouch', shape: 'fist', motion: 'tap', reps: 2 },

  // Город и транспорт
  автобус: { loc: 'chest', shape: 'fist', motion: 'updown', reps: 2, twoHand: true },
  метро: { loc: 'forward', shape: 'fist', motion: 'push' },
  поезд: { loc: 'chest', shape: 'fist', motion: 'circle', reps: 2, twoHand: true },
  самолёт: { loc: 'shoulder', shape: 'phone', motion: 'push' },
  такси: { loc: 'forward', shape: 'open', motion: 'shake', reps: 2 },
  дорога: { loc: 'forward', shape: 'open', motion: 'push' },
  остановка: { loc: 'forward', shape: 'open', motion: 'none' },
  парк: { loc: 'chest', shape: 'openSpread', motion: 'sway', reps: 2 },
  мост: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1, twoHand: true },
  река: { loc: 'forward', shape: 'openSpread', motion: 'sway', reps: 2 },
  билет: { loc: 'chest', shape: 'pinch', motion: 'tap', reps: 1 },
  карта: { loc: 'chest', shape: 'open', motion: 'apart', twoHand: true },
  направо: { loc: 'forward', shape: 'point', motion: 'push', dArm: [0, 0, 0.3] },
  налево: { loc: 'forward', shape: 'point', motion: 'push', dArm: [0, 0, -0.3] },
  прямо: { loc: 'forward', shape: 'point', motion: 'push' },
  далеко: { loc: 'forward', shape: 'open', motion: 'push' },
  близко: { loc: 'chest', shape: 'open', motion: 'pull' },

  // Школа и работа
  учитель: { loc: 'forehead', shape: 'point', motion: 'push' },
  ученик: { loc: 'forehead', shape: 'point', motion: 'pull' },
  студент: { loc: 'forehead', shape: 'v', motion: 'pull' },
  университет: { loc: 'forehead', shape: 'open', motion: 'circle' },
  урок: { loc: 'chest', shape: 'v', motion: 'tap', reps: 2 },
  экзамен: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, twoHand: true },
  вопрос: { loc: 'shoulder', shape: 'point', motion: 'circle' },
  ответ: { loc: 'mouth', shape: 'point', motion: 'push' },
  слово: { loc: 'mouth', shape: 'pinch', motion: 'tap', reps: 1 },
  язык: { loc: 'mouth', shape: 'open', motion: 'tap', reps: 1 },
  жест: { loc: 'chest', shape: 'openSpread', motion: 'twist', twoHand: true },
  считать: { loc: 'chest', shape: 'openSpread', motion: 'tap', reps: 2 },
  компьютер: { loc: 'chest', shape: 'openSpread', motion: 'updown', reps: 3, twoHand: true },
  интернет: { loc: 'forward', shape: 'openSpread', motion: 'twist' },
  бумага: { loc: 'chest', shape: 'open', motion: 'tap', reps: 1, twoHand: true },
  стол: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, twoHand: true, dWrist: [0.6, 0, 0] },
  стул: { loc: 'chest', shape: 'v', motion: 'down', reps: 1, dWrist: [0.5, 0, 0] },
  дверь: { loc: 'forward', shape: 'open', motion: 'twist' },
  окно: { loc: 'chest', shape: 'open', motion: 'apart', twoHand: true },

  // Эмоции
  рад: { loc: 'chestTouch', shape: 'open', motion: 'circle' },
  /** Кончики пальцев у уголков глаз -> вниз по щекам, обеими руками. */
  грустный: { loc: 'cheek', shape: 'openSpread', motion: 'down', reps: 1, twoHand: true },
  злой: { loc: 'forehead', shape: 'fist', motion: 'shake', reps: 2 },
  бояться: { loc: 'chestTouch', shape: 'open', motion: 'shake', reps: 3, twoHand: true },
  удивляться: { loc: 'mouth', shape: 'open', motion: 'morph', shape2: 'openSpread' },
  устал: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, twoHand: true },
  скучать: { loc: 'cheek', shape: 'point', motion: 'circle' },
  нравиться: { loc: 'chestTouch', shape: 'open', motion: 'circle' },
  счастье: { loc: 'chest', shape: 'open', motion: 'circle', twoHand: true },
  проблема: { loc: 'forehead', shape: 'fist', motion: 'tap', reps: 2 },

  // Погода и природа
  погода: { loc: 'shoulder', shape: 'open', motion: 'twist', twoHand: true },
  солнце: { loc: 'shoulder', shape: 'ring', motion: 'circle', dArm: [-0.3, 0, 0] },
  дождь: { loc: 'shoulder', shape: 'openSpread', motion: 'down', reps: 2, twoHand: true },
  снег: { loc: 'shoulder', shape: 'openSpread', motion: 'down', reps: 1, twoHand: true },
  ветер: { loc: 'forward', shape: 'openSpread', motion: 'sway', reps: 3, twoHand: true },
  жарко: { loc: 'cheek', shape: 'open', motion: 'shake', reps: 2 },
  небо: { loc: 'shoulder', shape: 'open', motion: 'sway', reps: 1, dArm: [-0.3, 0, 0] },
  звезда: { loc: 'shoulder', shape: 'point', motion: 'shake', reps: 2, dArm: [-0.3, 0, 0] },
  луна: { loc: 'shoulder', shape: 'c', motion: 'none', dArm: [-0.3, 0, 0] },
  дерево: { loc: 'shoulder', shape: 'openSpread', motion: 'twist' },
  цветок: { loc: 'mouth', shape: 'pinch', motion: 'morph', shape2: 'openSpread' },
  трава: { loc: 'low', shape: 'openSpread', motion: 'sway', reps: 2 },
  лес: { loc: 'shoulder', shape: 'openSpread', motion: 'sway', reps: 2, twoHand: true },
  гора: { loc: 'shoulder', shape: 'fist', motion: 'up', reps: 1 },
  море: { loc: 'chest', shape: 'openSpread', motion: 'sway', reps: 2, twoHand: true },

  // Животные
  птица: { loc: 'mouth', shape: 'pinch', motion: 'morph', shape2: 'v' },
  лошадь: { loc: 'forehead', shape: 'v', motion: 'tap', reps: 2 },
  корова: { loc: 'forehead', shape: 'phone', motion: 'none' },
  медведь: { loc: 'chest', shape: 'fist', motion: 'circle', twoHand: true },
  заяц: { loc: 'forehead', shape: 'v', motion: 'updown', reps: 2 },
  мышь: { loc: 'mouth', shape: 'point', motion: 'tap', reps: 2 },

  // Время и сезоны
  неделя: { loc: 'chest', shape: 'point', motion: 'sway', reps: 1 },
  месяц: { loc: 'chest', shape: 'c', motion: 'twist' },
  час: { loc: 'chest', shape: 'point', motion: 'circle' },
  минута: { loc: 'chest', shape: 'point', motion: 'tap', reps: 1 },
  зима: { loc: 'chest', shape: 'fist', motion: 'shake', reps: 2, twoHand: true },
  лето: { loc: 'forehead', shape: 'open', motion: 'sway', reps: 1 },
  весна: { loc: 'chest', shape: 'pinch', motion: 'morph', shape2: 'openSpread' },
  осень: { loc: 'shoulder', shape: 'open', motion: 'down', reps: 2 },

  // Люди
  муж: { loc: 'forehead', shape: 'c', motion: 'tap', reps: 1 },
  жена: { loc: 'cheek', shape: 'c', motion: 'tap', reps: 1 },
  сын: { loc: 'forehead', shape: 'v', motion: 'tap', reps: 1 },
  дочь: { loc: 'cheek', shape: 'v', motion: 'tap', reps: 1 },
  девушка: { loc: 'cheek', shape: 'open', motion: 'circle' },
  парень: { loc: 'forehead', shape: 'three', motion: 'tap', reps: 1 },
  люди: { loc: 'chest', shape: 'point', motion: 'circle', twoHand: true },
  имя: { loc: 'chest', shape: 'v', motion: 'tap', reps: 2 },

  // Глаголы (ещё)
  приходить: { loc: 'forward', shape: 'open', motion: 'pull' },
  уходить: { loc: 'chest', shape: 'open', motion: 'push' },
  встречать: { loc: 'chest', shape: 'point', motion: 'together', twoHand: true },
  открыть: { loc: 'chest', shape: 'open', motion: 'apart', twoHand: true },
  закрыть: { loc: 'chest', shape: 'open', motion: 'together', twoHand: true },
  начать: { loc: 'chest', shape: 'point', motion: 'twist' },
  закончить: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, twoHand: true },
  забыть: { loc: 'forehead', shape: 'open', motion: 'push' },
  помнить: { loc: 'forehead', shape: 'point', motion: 'tap', reps: 1 },
  искать: { loc: 'forehead', shape: 'c', motion: 'sway', reps: 2 },
  найти: { loc: 'forward', shape: 'pinch', motion: 'pull' },
  потерять: { loc: 'chest', shape: 'open', motion: 'down', reps: 1 },
  показать: { loc: 'forward', shape: 'open', motion: 'tap', reps: 1 },
  спросить: { loc: 'forward', shape: 'point', motion: 'circle' },
  учить: { loc: 'forehead', shape: 'pinch', motion: 'push' },
  гулять: { loc: 'chest', shape: 'v', motion: 'sway', reps: 2, dWrist: [0.5, 0, 0] },
  петь: { loc: 'mouth', shape: 'open', motion: 'circle' },
  танцевать: { loc: 'chest', shape: 'v', motion: 'twist', dWrist: [0.5, 0, 0] },
  рисовать: { loc: 'forward', shape: 'point', motion: 'sway', reps: 2 },
  мыть: { loc: 'chest', shape: 'fist', motion: 'circle', twoHand: true },
  готовить: { loc: 'chest', shape: 'open', motion: 'twist', twoHand: true },
  звонить: { loc: 'cheek', shape: 'phone', motion: 'tap', reps: 1 },
  слушать: { loc: 'cheek', shape: 'open', motion: 'none' },
  должен: { loc: 'chest', shape: 'fist', motion: 'down', reps: 1, twoHand: true },

  // Разное
  всё: { loc: 'chest', shape: 'open', motion: 'apart', twoHand: true },
  ничего: { loc: 'chest', shape: 'open', motion: 'shake', reps: 2 },
  немного: { loc: 'chest', shape: 'pinch', motion: 'tap', reps: 1 },
  очень: { loc: 'chest', shape: 'fist', motion: 'up', reps: 1 },
  тоже: { loc: 'chest', shape: 'point', motion: 'tap', reps: 1, twoHand: true },
  вместе: { loc: 'chest', shape: 'fist', motion: 'together', twoHand: true },
  другой: { loc: 'chest', shape: 'open', motion: 'twist' },
  новый: { loc: 'chest', shape: 'open', motion: 'up', reps: 1 },
  старый: { loc: 'mouth', shape: 'fist', motion: 'down', reps: 1 },
  первый: { loc: 'shoulder', shape: 'point', motion: 'up', reps: 1 },
  последний: { loc: 'low', shape: 'point', motion: 'down', reps: 1 },
  правда: { loc: 'mouth', shape: 'point', motion: 'push' },
  неправда: { loc: 'mouth', shape: 'open', motion: 'sway', reps: 2 },

  // Числа 1–10, сто, тысяча (счётные формы; 6–10 — условные)
  один: { loc: 'shoulder', shape: 'point', motion: 'none' },
  два: { loc: 'shoulder', shape: 'v', motion: 'none' },
  три: { loc: 'shoulder', shape: 'three', motion: 'none' },
  четыре: { loc: 'shoulder', shape: 'four', motion: 'none' },
  пять: { loc: 'shoulder', shape: 'openSpread', motion: 'none' },
  шесть: { loc: 'shoulder', shape: 'phone', motion: 'tap', reps: 1 },
  семь: { loc: 'shoulder', shape: 'ring', motion: 'tap', reps: 1 },
  восемь: { loc: 'shoulder', shape: 'c', motion: 'tap', reps: 1 },
  девять: { loc: 'shoulder', shape: 'pinch', motion: 'tap', reps: 1 },
  десять: { loc: 'shoulder', shape: 'fist', motion: 'morph', shape2: 'openSpread' },
  сто: { loc: 'shoulder', shape: 'openSpread', motion: 'twist' },
  тысяча: { loc: 'shoulder', shape: 'openSpread', motion: 'push' },

  // Дни недели (номер дня счётной формой + движение вниз)
  понедельник: { loc: 'shoulder', shape: 'point', motion: 'down', reps: 1 },
  вторник: { loc: 'shoulder', shape: 'v', motion: 'down', reps: 1 },
  среда: { loc: 'shoulder', shape: 'three', motion: 'down', reps: 1 },
  четверг: { loc: 'shoulder', shape: 'four', motion: 'down', reps: 1 },
  пятница: { loc: 'shoulder', shape: 'openSpread', motion: 'down', reps: 1 },
  суббота: { loc: 'shoulder', shape: 'phone', motion: 'down', reps: 1 },
  воскресенье: { loc: 'shoulder', shape: 'ring', motion: 'down', reps: 1 },

  // Цвета (условные: по «носителю» цвета)
  цвет: { loc: 'mouth', shape: 'open', motion: 'sway', reps: 1 },
  красный: { loc: 'mouth', shape: 'point', motion: 'tap', reps: 1 },
  белый: { loc: 'mouth', shape: 'point', motion: 'sway', reps: 1 },
  чёрный: { loc: 'forehead', shape: 'point', motion: 'sway', reps: 1 },
  синий: { loc: 'shoulder', shape: 'open', motion: 'up', reps: 1, dArm: [-0.3, 0, 0] },
  зелёный: { loc: 'low', shape: 'openSpread', motion: 'sway', reps: 1 },
  жёлтый: { loc: 'shoulder', shape: 'ring', motion: 'twist', dArm: [-0.3, 0, 0] },
  серый: { loc: 'chest', shape: 'open', motion: 'twist', reps: 1 },

  // Одежда
  одежда: { loc: 'chestTouch', shape: 'open', motion: 'down', reps: 2 },
  куртка: { loc: 'chestTouch', shape: 'fist', motion: 'down', reps: 1, twoHand: true },
  шапка: { loc: 'forehead', shape: 'open', motion: 'down', reps: 1 },
  обувь: { loc: 'low', shape: 'fist', motion: 'tap', reps: 2 },
  платье: { loc: 'chestTouch', shape: 'openSpread', motion: 'down', reps: 1, twoHand: true },
  штаны: { loc: 'belly', shape: 'open', motion: 'down', reps: 1, twoHand: true },
  рубашка: { loc: 'chestTouch', shape: 'pinch', motion: 'tap', reps: 2 },
  носки: { loc: 'low', shape: 'v', motion: 'sway', reps: 1 },
  перчатки: { loc: 'chest', shape: 'openSpread', motion: 'pull' },
  шарф: { loc: 'mouth', shape: 'fist', motion: 'sway', reps: 1 },

  // Профессии
  полиция: { loc: 'forehead', shape: 'open', motion: 'tap', reps: 1, dWrist: [0, 0, 0.3] },
  пожарный: { loc: 'forehead', shape: 'fist', motion: 'tap', reps: 1 },
  повар: { loc: 'chest', shape: 'c', motion: 'circle', twoHand: true },
  водитель: { loc: 'chest', shape: 'fist', motion: 'circle', reps: 1, twoHand: true },
  продавец: { loc: 'chest', shape: 'pinch', motion: 'sway', reps: 2 },
  строитель: { loc: 'chest', shape: 'fist', motion: 'updown', reps: 2, twoHand: true },
  инженер: { loc: 'forward', shape: 'point', motion: 'circle' },
  директор: { loc: 'shoulder', shape: 'point', motion: 'up', reps: 1, dArm: [-0.2, 0, 0] },

  // Документы и учреждения
  документ: { loc: 'chest', shape: 'open', motion: 'tap', reps: 1, dWrist: [0.6, 0, 0] },
  паспорт: { loc: 'chest', shape: 'open', motion: 'apart', reps: 1, twoHand: true },
  справка: { loc: 'chest', shape: 'open', motion: 'tap', reps: 2, dWrist: [0.6, 0, 0] },
  подпись: { loc: 'chest', shape: 'pinch', motion: 'twist' },
  очередь: { loc: 'forward', shape: 'point', motion: 'pull' },
  банк: { loc: 'chest', shape: 'pinch', motion: 'down', reps: 2 },
  почта: { loc: 'chest', shape: 'open', motion: 'push', dWrist: [0.6, 0, 0] },

  // Дом и быт
  ключ: { loc: 'chest', shape: 'point', motion: 'twist' },
  сумка: { loc: 'low', shape: 'fist', motion: 'none' },
  очки: { loc: 'forehead', shape: 'ring', motion: 'tap', reps: 1 },
  часы: { loc: 'chest', shape: 'point', motion: 'tap', reps: 1, twoHand: true },
  кровать: { loc: 'cheek', shape: 'open', motion: 'tap', reps: 1 },
  диван: { loc: 'chest', shape: 'v', motion: 'down', reps: 1, dWrist: [0.5, 0, 0], twoHand: true },
  телевизор: { loc: 'chest', shape: 'openSpread', motion: 'twist', twoHand: true },
  лампа: { loc: 'shoulder', shape: 'pinch', motion: 'morph', shape2: 'openSpread' },
  зеркало: { loc: 'mouth', shape: 'open', motion: 'twist' },
  мыло: { loc: 'chest', shape: 'fist', motion: 'circle', reps: 1, twoHand: true },
  полотенце: { loc: 'cheek', shape: 'open', motion: 'sway', reps: 2 },
  посуда: { loc: 'chest', shape: 'ring', motion: 'circle' },
  чашка: { loc: 'chest', shape: 'c', motion: 'tap', reps: 1 },
  тарелка: { loc: 'chest', shape: 'ring', motion: 'none' },
  нож: { loc: 'chest', shape: 'v', motion: 'sway', reps: 2 },
  ложка: { loc: 'mouth', shape: 'c', motion: 'updown', reps: 1 },
  вилка: { loc: 'chest', shape: 'three', motion: 'tap', reps: 1 },

  // Глаголы (третья партия)
  стирать: { loc: 'chest', shape: 'fist', motion: 'circle', reps: 2, twoHand: true },
  убирать: { loc: 'low', shape: 'open', motion: 'sway', reps: 2 },
  спешить: { loc: 'chest', shape: 'fist', motion: 'updown', reps: 3, twoHand: true },
  ложиться: { loc: 'cheek', shape: 'open', motion: 'down', reps: 1 },
  вставать: { loc: 'chest', shape: 'v', motion: 'up', reps: 1 },
  одеваться: { loc: 'chestTouch', shape: 'open', motion: 'down', reps: 1, twoHand: true },
  снимать: { loc: 'chestTouch', shape: 'open', motion: 'up', reps: 1, twoHand: true },
  включить: { loc: 'forward', shape: 'point', motion: 'twist' },
  выключить: { loc: 'forward', shape: 'point', motion: 'twist', reps: 1, dWrist: [0, -0.5, 0] },
  ломать: { loc: 'chest', shape: 'fist', motion: 'apart', twoHand: true },
  чинить: { loc: 'chest', shape: 'fist', motion: 'twist', reps: 2, twoHand: true },
  менять: { loc: 'chest', shape: 'open', motion: 'twist', twoHand: true },
  пробовать: { loc: 'mouth', shape: 'point', motion: 'tap', reps: 1 },
  верить: { loc: 'forehead', shape: 'point', motion: 'pull' },
  обещать: { loc: 'mouth', shape: 'open', motion: 'down', reps: 1 },
  приглашать: { loc: 'chest', shape: 'open', motion: 'pull' },
  поздравлять: { loc: 'shoulder', shape: 'fist', motion: 'shake', reps: 2, twoHand: true },
  желать: { loc: 'chestTouch', shape: 'open', motion: 'push' },
  целовать: { loc: 'mouth', shape: 'pinch', motion: 'push' },
  обнимать: { loc: 'chest', shape: 'open', motion: 'together', reps: 1, twoHand: true },
  улыбаться: { loc: 'mouth', shape: 'v', motion: 'twist' },
  кричать: { loc: 'mouth', shape: 'openSpread', motion: 'push' },
  молчать: { loc: 'mouth', shape: 'point', motion: 'none' },
  шутить: { loc: 'mouth', shape: 'point', motion: 'shake', reps: 2 },
  мешать: { loc: 'chest', shape: 'point', motion: 'sway', reps: 2 },
  отдыхать: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, twoHand: true },
  болтать: { loc: 'mouth', shape: 'openSpread', motion: 'shake', reps: 3 },

  // Наречия и служебные
  всегда: { loc: 'chest', shape: 'point', motion: 'circle' },
  никогда: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1 },
  часто: { loc: 'chest', shape: 'point', motion: 'tap', reps: 3 },
  редко: { loc: 'chest', shape: 'point', motion: 'tap', reps: 1 },
  иногда: { loc: 'chest', shape: 'point', motion: 'sway', reps: 1 },
  рано: { loc: 'chest', shape: 'open', motion: 'up', reps: 1 },
  поздно: { loc: 'chest', shape: 'open', motion: 'down', reps: 1 },
  уже: { loc: 'chest', shape: 'open', motion: 'twist', reps: 1 },
  ещё: { loc: 'chest', shape: 'pinch', motion: 'tap', reps: 2 },
  снова: { loc: 'chest', shape: 'point', motion: 'circle', reps: 1 },
  только: { loc: 'shoulder', shape: 'point', motion: 'none' },
  около: { loc: 'chest', shape: 'c', motion: 'none' },
  между: { loc: 'chest', shape: 'point', motion: 'together', twoHand: true },
  внутри: { loc: 'chest', shape: 'pinch', motion: 'pull' },
  снаружи: { loc: 'chest', shape: 'open', motion: 'push' },
  сверху: { loc: 'shoulder', shape: 'open', motion: 'down', reps: 1, dArm: [-0.3, 0, 0] },
  снизу: { loc: 'low', shape: 'point', motion: 'up', reps: 1 },

  // Качества
  умный: { loc: 'forehead', shape: 'point', motion: 'tap', reps: 1, dWrist: [0, 0, 0.2] },
  глупый: { loc: 'forehead', shape: 'fist', motion: 'tap', reps: 1 },
  добрый: { loc: 'chest', shape: 'open', motion: 'circle', reps: 1 },
  сильный: { loc: 'chest', shape: 'fist', motion: 'up', reps: 2, twoHand: true },
  слабый: { loc: 'chest', shape: 'open', motion: 'down', reps: 1 },
  молодой: { loc: 'chestTouch', shape: 'open', motion: 'up', reps: 2 },
  богатый: { loc: 'chest', shape: 'pinch', motion: 'apart', twoHand: true },
  бедный: { loc: 'low', shape: 'open', motion: 'down', reps: 1 },
  весёлый: { loc: 'chest', shape: 'openSpread', motion: 'updown', reps: 2, twoHand: true },
  важный: { loc: 'shoulder', shape: 'ring', motion: 'up', reps: 1 },
  трудный: { loc: 'forehead', shape: 'fist', motion: 'tap', reps: 2 },
  лёгкий: { loc: 'chest', shape: 'open', motion: 'up', reps: 1 },
  чистый: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1 },
  грязный: { loc: 'low', shape: 'fist', motion: 'sway', reps: 2 },
  полный: { loc: 'chest', shape: 'c', motion: 'morph', shape2: 'fist' },
  пустой: { loc: 'low', shape: 'open', motion: 'twist', reps: 1 },
  вкусный: { loc: 'mouth', shape: 'open', motion: 'circle' },

  // Общение и события
  разговор: { loc: 'mouth', shape: 'openSpread', motion: 'tap', reps: 2 },
  новости: { loc: 'chest', shape: 'openSpread', motion: 'apart', twoHand: true },
  письмо: { loc: 'chest', shape: 'pinch', motion: 'sway', reps: 1 },
  фото: { loc: 'forehead', shape: 'c', motion: 'tap', reps: 1 },
  видео: { loc: 'forward', shape: 'open', motion: 'sway', reps: 1 },
  музыка: { loc: 'shoulder', shape: 'open', motion: 'sway', reps: 2, twoHand: true },
  праздник: { loc: 'shoulder', shape: 'openSpread', motion: 'circle', twoHand: true },
  подарок: { loc: 'chest', shape: 'open', motion: 'push', twoHand: true },
  гость: { loc: 'forward', shape: 'open', motion: 'pull' },
  свадьба: { loc: 'chest', shape: 'ring', motion: 'together', twoHand: true },

  // ——— Партия 4: глаголы ———
  бросать: { loc: 'forward', shape: 'fist', motion: 'morph', shape2: 'openSpread' },
  ловить: { loc: 'forward', shape: 'open', motion: 'morph', shape2: 'fist' },
  держать: { loc: 'chest', shape: 'fist', motion: 'none' },
  нести: { loc: 'low', shape: 'fist', motion: 'sway', reps: 1 },
  везти: { loc: 'forward', shape: 'fist', motion: 'push' },
  поднимать: { loc: 'chest', shape: 'open', motion: 'up', reps: 1, twoHand: true },
  опускать: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, twoHand: true },
  толкать: { loc: 'forward', shape: 'open', motion: 'push', twoHand: true },
  тянуть: { loc: 'forward', shape: 'fist', motion: 'pull', twoHand: true },
  резать: { loc: 'chest', shape: 'v', motion: 'sway', reps: 2 },
  клеить: { loc: 'chest', shape: 'open', motion: 'tap', reps: 1, twoHand: true },
  шить: { loc: 'chest', shape: 'pinch', motion: 'updown', reps: 2 },
  вязать: { loc: 'chest', shape: 'point', motion: 'circle', twoHand: true },
  копать: { loc: 'low', shape: 'fist', motion: 'down', reps: 2, twoHand: true },
  сажать: { loc: 'low', shape: 'pinch', motion: 'down', reps: 1 },
  поливать: { loc: 'low', shape: 'c', motion: 'down', reps: 1 },
  гладить: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1, dWrist: [0.5, 0, 0] },
  вешать: { loc: 'shoulder', shape: 'pinch', motion: 'up', reps: 1 },
  ставить: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, dWrist: [0.6, 0, 0] },
  класть: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, dWrist: [0.7, 0, 0] },
  прятать: { loc: 'chest', shape: 'fist', motion: 'pull' },
  падать: { loc: 'shoulder', shape: 'v', motion: 'down', reps: 1 },
  прыгать: { loc: 'chest', shape: 'v', motion: 'updown', reps: 2, dWrist: [0.5, 0, 0] },
  плавать: { loc: 'chest', shape: 'open', motion: 'sway', reps: 2, twoHand: true },
  летать: { loc: 'shoulder', shape: 'openSpread', motion: 'sway', reps: 2, twoHand: true },
  ползти: { loc: 'low', shape: 'open', motion: 'sway', reps: 2 },
  кататься: { loc: 'chest', shape: 'fist', motion: 'circle', reps: 2, twoHand: true },
  качать: { loc: 'chest', shape: 'open', motion: 'sway', reps: 2, twoHand: true },
  крутить: { loc: 'chest', shape: 'point', motion: 'circle', reps: 2 },
  трясти: { loc: 'chest', shape: 'fist', motion: 'shake', reps: 3, twoHand: true },
  стучать: { loc: 'forward', shape: 'fist', motion: 'tap', reps: 3 },
  звенеть: { loc: 'shoulder', shape: 'pinch', motion: 'shake', reps: 3 },
  свистеть: { loc: 'mouth', shape: 'ring', motion: 'push' },
  дуть: { loc: 'mouth', shape: 'open', motion: 'push' },
  нюхать: { loc: 'mouth', shape: 'open', motion: 'pull' },
  лизать: { loc: 'mouth', shape: 'open', motion: 'tap', reps: 2 },
  кусать: { loc: 'mouth', shape: 'c', motion: 'morph', shape2: 'fist' },
  жевать: { loc: 'mouth', shape: 'fist', motion: 'circle', reps: 1 },
  глотать: { loc: 'mouth', shape: 'open', motion: 'down', reps: 1 },
  дышать: { loc: 'chestTouch', shape: 'open', motion: 'updown', reps: 2 },
  чихать: { loc: 'mouth', shape: 'open', motion: 'morph', shape2: 'openSpread' },
  зевать: { loc: 'mouth', shape: 'c', motion: 'morph', shape2: 'openSpread' },
  потеть: { loc: 'forehead', shape: 'open', motion: 'down', reps: 1 },
  дрожать: { loc: 'chest', shape: 'openSpread', motion: 'shake', reps: 3, twoHand: true },
  греть: { loc: 'chest', shape: 'open', motion: 'circle', reps: 1, twoHand: true },
  мёрзнуть: { loc: 'chest', shape: 'fist', motion: 'shake', reps: 2, twoHand: true },
  гореть: { loc: 'chest', shape: 'openSpread', motion: 'updown', reps: 2 },
  тушить: { loc: 'chest', shape: 'open', motion: 'down', reps: 2, twoHand: true },
  светить: { loc: 'shoulder', shape: 'openSpread', motion: 'apart', twoHand: true },
  расти: { loc: 'chest', shape: 'open', motion: 'up', reps: 2 },
  цвести: { loc: 'chest', shape: 'pinch', motion: 'morph', shape2: 'openSpread' },
  умирать: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, dWrist: [0.6, 0, 0], twoHand: true },
  рождаться: { loc: 'belly', shape: 'open', motion: 'up', reps: 1 },
  жениться: { loc: 'chest', shape: 'ring', motion: 'together', reps: 1, twoHand: true },
  разводиться: { loc: 'chest', shape: 'ring', motion: 'apart', twoHand: true },
  дружить: { loc: 'chest', shape: 'fist', motion: 'together', reps: 1, twoHand: true },
  ссориться: { loc: 'chest', shape: 'fist', motion: 'apart', twoHand: true },
  мириться: { loc: 'chest', shape: 'open', motion: 'together', reps: 1, twoHand: true },
  драться: { loc: 'chest', shape: 'fist', motion: 'updown', reps: 3, twoHand: true },
  побеждать: { loc: 'shoulder', shape: 'fist', motion: 'up', reps: 1 },
  проигрывать: { loc: 'low', shape: 'open', motion: 'down', reps: 1 },
  соревноваться: { loc: 'forward', shape: 'point', motion: 'push', twoHand: true },
  тренироваться: { loc: 'chest', shape: 'fist', motion: 'updown', reps: 2, twoHand: true },
  заниматься: { loc: 'chest', shape: 'open', motion: 'circle', reps: 1, twoHand: true },
  стараться: { loc: 'chest', shape: 'fist', motion: 'push' },
  лениться: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, dWrist: [0.3, 0, 0] },
  веселиться: { loc: 'shoulder', shape: 'openSpread', motion: 'circle', twoHand: true },
  радоваться: { loc: 'chestTouch', shape: 'open', motion: 'circle', reps: 1 },
  грустить: { loc: 'cheek', shape: 'open', motion: 'down', reps: 2 },
  злиться: { loc: 'forehead', shape: 'fist', motion: 'shake', reps: 3 },
  обижаться: { loc: 'chestTouch', shape: 'open', motion: 'pull' },
  прощать: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1, dWrist: [0, 0.5, 0] },
  благодарить: { loc: 'mouth', shape: 'open', motion: 'push', reps: 1 },
  хвалить: { loc: 'chest', shape: 'thumbUp', motion: 'updown', reps: 1 },
  ругать: { loc: 'forward', shape: 'point', motion: 'shake', reps: 3 },
  наказывать: { loc: 'forward', shape: 'point', motion: 'down', reps: 2 },
  жаловаться: { loc: 'chestTouch', shape: 'fist', motion: 'tap', reps: 2 },
  советовать: { loc: 'forehead', shape: 'pinch', motion: 'push' },
  объяснять: { loc: 'mouth', shape: 'openSpread', motion: 'push', twoHand: true },
  повторять: { loc: 'chest', shape: 'point', motion: 'circle', reps: 2 },
  проверять: { loc: 'forward', shape: 'point', motion: 'sway', reps: 2 },
  ошибаться: { loc: 'forehead', shape: 'point', motion: 'twist' },
  исправлять: { loc: 'chest', shape: 'point', motion: 'twist', reps: 1 },
  выбирать: { loc: 'forward', shape: 'pinch', motion: 'pull', reps: 1 },
  решать: { loc: 'forehead', shape: 'fist', motion: 'down', reps: 1 },
  соглашаться: { loc: 'chest', shape: 'thumbUp', motion: 'tap', reps: 1 },
  отказываться: { loc: 'chest', shape: 'open', motion: 'push', reps: 1 },
  спорить: { loc: 'forward', shape: 'point', motion: 'tap', reps: 3 },
  обсуждать: { loc: 'mouth', shape: 'openSpread', motion: 'tap', reps: 2, twoHand: true },
  договариваться: { loc: 'chest', shape: 'open', motion: 'together', reps: 1, twoHand: true },
  встречаться: { loc: 'chest', shape: 'point', motion: 'together', reps: 1, twoHand: true },
  расставаться: { loc: 'chest', shape: 'open', motion: 'apart', reps: 1, twoHand: true },
  провожать: { loc: 'forward', shape: 'open', motion: 'push', reps: 1 },
  опаздывать: { loc: 'forward', shape: 'fist', motion: 'push', reps: 1 },
  успевать: { loc: 'chest', shape: 'fist', motion: 'up', reps: 1 },
  торопиться: { loc: 'chest', shape: 'fist', motion: 'updown', reps: 3, twoHand: true },
  останавливаться: { loc: 'forward', shape: 'open', motion: 'none' },
  поворачивать: { loc: 'forward', shape: 'open', motion: 'twist' },
  возвращаться: { loc: 'forward', shape: 'open', motion: 'pull', reps: 1 },
  переезжать: { loc: 'forward', shape: 'fist', motion: 'sway', reps: 1 },
  путешествовать: { loc: 'forward', shape: 'open', motion: 'circle' },
  отправлять: { loc: 'forward', shape: 'open', motion: 'push', dWrist: [0.5, 0, 0] },
  получать: { loc: 'forward', shape: 'open', motion: 'morph', shape2: 'fist', reps: 1 },
  приносить: { loc: 'forward', shape: 'fist', motion: 'pull' },
  уносить: { loc: 'chest', shape: 'fist', motion: 'push' },
  объявлять: { loc: 'mouth', shape: 'openSpread', motion: 'apart', twoHand: true },
  переводить: { loc: 'chest', shape: 'open', motion: 'twist', reps: 2, twoHand: true },
  печатать: { loc: 'chest', shape: 'openSpread', motion: 'tap', reps: 3, twoHand: true },
  фотографировать: { loc: 'forehead', shape: 'c', motion: 'tap', reps: 1, twoHand: true },
  рыбачить: { loc: 'forward', shape: 'point', motion: 'pull', reps: 1 },
  охотиться: { loc: 'forward', shape: 'point', motion: 'push', reps: 1 },
  собирать: { loc: 'chest', shape: 'pinch', motion: 'together', twoHand: true },
  использовать: { loc: 'chest', shape: 'fist', motion: 'twist', reps: 1 },
  уметь: { loc: 'chest', shape: 'open', motion: 'tap', reps: 1 },
  мыться: { loc: 'cheek', shape: 'fist', motion: 'circle', reps: 1 },
  бриться: { loc: 'cheek', shape: 'open', motion: 'down', reps: 1 },
  причёсываться: { loc: 'forehead', shape: 'open', motion: 'down', reps: 2 },
  чистить: { loc: 'chest', shape: 'fist', motion: 'sway', reps: 2 },
  варить: { loc: 'chest', shape: 'c', motion: 'circle', reps: 1 },
  жарить: { loc: 'chest', shape: 'open', motion: 'shake', reps: 1 },
  печь: { loc: 'chest', shape: 'open', motion: 'tap', reps: 1, dWrist: [0.6, 0, 0], twoHand: true },
  наливать: { loc: 'chest', shape: 'c', motion: 'twist', reps: 1 },
  кормить: { loc: 'mouth', shape: 'open', motion: 'push', reps: 1 },
  лечить: { loc: 'chest', shape: 'c', motion: 'push' },
  спасать: { loc: 'forward', shape: 'open', motion: 'pull', twoHand: true },
  защищать: { loc: 'chest', shape: 'fist', motion: 'together', reps: 1, twoHand: true },

  // ——— Партия 5: природа и география ———
  страна: { loc: 'chest', shape: 'open', motion: 'circle', reps: 1, twoHand: true },
  граница: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, dWrist: [0, 0, 0.5] },
  столица: { loc: 'shoulder', shape: 'fist', motion: 'tap', reps: 1 },
  деревня: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1, twoHand: true },
  поле: { loc: 'low', shape: 'open', motion: 'apart', twoHand: true },
  сад: { loc: 'chest', shape: 'openSpread', motion: 'circle', reps: 1 },
  огород: { loc: 'low', shape: 'openSpread', motion: 'circle', reps: 1 },
  земля: { loc: 'low', shape: 'open', motion: 'tap', reps: 1, dWrist: [0.5, 0, 0] },
  камень: { loc: 'chest', shape: 'fist', motion: 'tap', reps: 1, twoHand: true },
  песок: { loc: 'low', shape: 'pinch', motion: 'shake', reps: 2 },
  пыль: { loc: 'chest', shape: 'openSpread', motion: 'shake', reps: 1 },
  лёд: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1, dWrist: [0.6, 0, 0] },
  пар: { loc: 'chest', shape: 'openSpread', motion: 'up', reps: 2 },
  дым: { loc: 'shoulder', shape: 'openSpread', motion: 'circle', reps: 1 },
  огонь: { loc: 'chest', shape: 'openSpread', motion: 'updown', reps: 3 },
  воздух: { loc: 'shoulder', shape: 'open', motion: 'sway', reps: 1, twoHand: true },
  свет: { loc: 'shoulder', shape: 'pinch', motion: 'morph', shape2: 'openSpread', twoHand: true },
  тень: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, dWrist: [0.6, 0, 0], twoHand: true },
  звук: { loc: 'cheek', shape: 'openSpread', motion: 'apart', twoHand: true },
  запах: { loc: 'mouth', shape: 'open', motion: 'circle', reps: 1 },
  гроза: { loc: 'shoulder', shape: 'fist', motion: 'shake', reps: 3, twoHand: true },
  молния: { loc: 'shoulder', shape: 'point', motion: 'down', reps: 1, dArm: [-0.3, 0, 0] },
  гром: { loc: 'chest', shape: 'fist', motion: 'shake', reps: 2 },
  туман: { loc: 'forehead', shape: 'open', motion: 'sway', reps: 1, twoHand: true },
  мороз: { loc: 'chest', shape: 'fist', motion: 'shake', reps: 3 },
  жара: { loc: 'forehead', shape: 'open', motion: 'shake', reps: 2 },
  радуга: { loc: 'shoulder', shape: 'openSpread', motion: 'sway', reps: 1, dArm: [-0.3, 0, 0] },
  облако: { loc: 'shoulder', shape: 'c', motion: 'sway', reps: 1, dArm: [-0.3, 0, 0] },
  туча: { loc: 'shoulder', shape: 'fist', motion: 'sway', reps: 1, dArm: [-0.3, 0, 0] },
  лужа: { loc: 'low', shape: 'open', motion: 'circle', reps: 1, dWrist: [0.5, 0, 0] },
  метель: { loc: 'shoulder', shape: 'openSpread', motion: 'circle', twoHand: true },
  капля: { loc: 'shoulder', shape: 'point', motion: 'down', reps: 2 },
  волна: { loc: 'chest', shape: 'open', motion: 'sway', reps: 2, dWrist: [0.5, 0, 0] },
  берег: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1, dWrist: [0.5, 0, 0], twoHand: true },
  остров: { loc: 'chest', shape: 'fist', motion: 'circle', reps: 1 },
  пустыня: { loc: 'low', shape: 'open', motion: 'apart', reps: 1, twoHand: true },
  болото: { loc: 'low', shape: 'open', motion: 'down', reps: 2, twoHand: true },
  ручей: { loc: 'forward', shape: 'v', motion: 'sway', reps: 2 },
  водопад: { loc: 'shoulder', shape: 'openSpread', motion: 'down', reps: 1, twoHand: true },

  // ——— Партия 5: еда ———
  завтрак: { loc: 'mouth', shape: 'pinch', motion: 'tap', reps: 1 },
  обед: { loc: 'mouth', shape: 'c', motion: 'tap', reps: 1 },
  ужин: { loc: 'mouth', shape: 'pinch', motion: 'circle', reps: 1 },
  картошка: { loc: 'chest', shape: 'fist', motion: 'tap', reps: 2 },
  морковь: { loc: 'chest', shape: 'point', motion: 'sway', reps: 1 },
  лук: { loc: 'mouth', shape: 'c', motion: 'shake', reps: 1 },
  огурец: { loc: 'chest', shape: 'c', motion: 'sway', reps: 1 },
  помидор: { loc: 'chest', shape: 'c', motion: 'tap', reps: 1 },
  капуста: { loc: 'chest', shape: 'c', motion: 'circle', reps: 1, twoHand: true },
  ягода: { loc: 'mouth', shape: 'pinch', motion: 'tap', reps: 2 },
  гриб: { loc: 'chest', shape: 'c', motion: 'up', reps: 1 },
  орех: { loc: 'chest', shape: 'fist', motion: 'tap', reps: 2, twoHand: true },
  мёд: { loc: 'mouth', shape: 'point', motion: 'circle', reps: 1 },
  варенье: { loc: 'mouth', shape: 'point', motion: 'tap', reps: 2 },
  печенье: { loc: 'chest', shape: 'c', motion: 'tap', reps: 2 },
  торт: { loc: 'chest', shape: 'open', motion: 'circle', reps: 1, twoHand: true },
  блины: { loc: 'chest', shape: 'open', motion: 'twist', reps: 2 },
  пирог: { loc: 'chest', shape: 'open', motion: 'together', reps: 1, twoHand: true },
  колбаса: { loc: 'chest', shape: 'c', motion: 'apart', twoHand: true },
  курица: { loc: 'mouth', shape: 'pinch', motion: 'tap', reps: 3 },
  рис: { loc: 'chest', shape: 'pinch', motion: 'shake', reps: 2 },
  макароны: { loc: 'mouth', shape: 'pinch', motion: 'up', reps: 1 },
  сметана: { loc: 'chest', shape: 'c', motion: 'circle', reps: 1 },
  кефир: { loc: 'mouth', shape: 'c', motion: 'updown', reps: 1 },
  творог: { loc: 'chest', shape: 'pinch', motion: 'together', reps: 1, twoHand: true },
  соус: { loc: 'chest', shape: 'c', motion: 'twist', reps: 2 },
  перец: { loc: 'chest', shape: 'pinch', motion: 'shake', reps: 3 },
  лимон: { loc: 'mouth', shape: 'c', motion: 'twist', reps: 1 },
  апельсин: { loc: 'chest', shape: 'c', motion: 'twist', reps: 1 },
  банан: { loc: 'chest', shape: 'point', motion: 'down', reps: 1 },
  груша: { loc: 'chest', shape: 'c', motion: 'down', reps: 1 },
  арбуз: { loc: 'chest', shape: 'open', motion: 'tap', reps: 2, twoHand: true },
  дыня: { loc: 'chest', shape: 'c', motion: 'sway', reps: 1, twoHand: true },
  виноград: { loc: 'mouth', shape: 'pinch', motion: 'tap', reps: 3 },
  компот: { loc: 'mouth', shape: 'c', motion: 'circle', reps: 1 },

  // ——— Партия 5: животные ———
  волк: { loc: 'mouth', shape: 'c', motion: 'push' },
  лиса: { loc: 'mouth', shape: 'pinch', motion: 'sway', reps: 1 },
  ёж: { loc: 'chest', shape: 'openSpread', motion: 'tap', reps: 2 },
  белка: { loc: 'chest', shape: 'v', motion: 'updown', reps: 3 },
  слон: { loc: 'mouth', shape: 'fist', motion: 'down', reps: 1 },
  жираф: { loc: 'shoulder', shape: 'c', motion: 'up', reps: 1 },
  тигр: { loc: 'chest', shape: 'openSpread', motion: 'sway', reps: 2, twoHand: true },
  лев: { loc: 'forehead', shape: 'openSpread', motion: 'circle', reps: 1 },
  обезьяна: { loc: 'chest', shape: 'fist', motion: 'updown', reps: 2, twoHand: true },
  змея: { loc: 'forward', shape: 'point', motion: 'sway', reps: 3 },
  лягушка: { loc: 'chest', shape: 'v', motion: 'updown', reps: 2, twoHand: true },
  черепаха: { loc: 'chest', shape: 'fist', motion: 'sway', reps: 1, twoHand: true },
  крокодил: { loc: 'chest', shape: 'open', motion: 'tap', reps: 2, twoHand: true, dWrist: [0.5, 0, 0] },
  кит: { loc: 'chest', shape: 'open', motion: 'up', reps: 1, twoHand: true },
  дельфин: { loc: 'forward', shape: 'open', motion: 'updown', reps: 2 },
  акула: { loc: 'forehead', shape: 'open', motion: 'push', dWrist: [0, 0, 0.5] },
  паук: { loc: 'chest', shape: 'openSpread', motion: 'down', reps: 2, twoHand: true },
  муха: { loc: 'cheek', shape: 'pinch', motion: 'circle', reps: 2 },
  комар: { loc: 'forward', shape: 'point', motion: 'circle', reps: 2 },
  пчела: { loc: 'cheek', shape: 'point', motion: 'circle', reps: 1 },
  бабочка: { loc: 'shoulder', shape: 'openSpread', motion: 'shake', reps: 2, twoHand: true },
  муравей: { loc: 'low', shape: 'point', motion: 'sway', reps: 2 },
  червяк: { loc: 'low', shape: 'point', motion: 'sway', reps: 3 },
  петух: { loc: 'forehead', shape: 'three', motion: 'shake', reps: 1 },
  утка: { loc: 'mouth', shape: 'open', motion: 'tap', reps: 2, dWrist: [0.5, 0, 0] },
  гусь: { loc: 'forward', shape: 'c', motion: 'push' },
  коза: { loc: 'forehead', shape: 'phone', motion: 'tap', reps: 1 },
  овца: { loc: 'chest', shape: 'fist', motion: 'circle', reps: 2 },
  свинья: { loc: 'mouth', shape: 'fist', motion: 'twist', reps: 1 },
  олень: { loc: 'forehead', shape: 'openSpread', motion: 'up', reps: 1, twoHand: true },
  верблюд: { loc: 'chest', shape: 'c', motion: 'updown', reps: 2 },

  // ——— Партия 5: транспорт ———
  велосипед: { loc: 'chest', shape: 'fist', motion: 'circle', reps: 2, twoHand: true },
  мотоцикл: { loc: 'chest', shape: 'fist', motion: 'twist', reps: 2, twoHand: true },
  грузовик: { loc: 'chest', shape: 'fist', motion: 'push', twoHand: true },
  трамвай: { loc: 'forward', shape: 'fist', motion: 'sway', reps: 1, twoHand: true },
  троллейбус: { loc: 'shoulder', shape: 'v', motion: 'push', twoHand: true },
  корабль: { loc: 'chest', shape: 'open', motion: 'sway', reps: 2, dWrist: [0, 0, -0.4], twoHand: true },
  лодка: { loc: 'chest', shape: 'open', motion: 'push', dWrist: [0, 0, -0.4], twoHand: true },
  вертолёт: { loc: 'shoulder', shape: 'openSpread', motion: 'circle', reps: 2, dArm: [-0.3, 0, 0] },
  ракета: { loc: 'shoulder', shape: 'point', motion: 'up', reps: 1, dArm: [-0.3, 0, 0] },

  // ——— Партия 5: дом и помещения ———
  здание: { loc: 'chest', shape: 'open', motion: 'up', reps: 1, twoHand: true },
  этаж: { loc: 'chest', shape: 'open', motion: 'up', reps: 2, dWrist: [0.6, 0, 0] },
  лифт: { loc: 'chest', shape: 'fist', motion: 'updown', reps: 1 },
  лестница: { loc: 'chest', shape: 'v', motion: 'up', reps: 2 },
  подъезд: { loc: 'forward', shape: 'open', motion: 'pull', reps: 1 },
  двор: { loc: 'low', shape: 'open', motion: 'circle', reps: 1 },
  забор: { loc: 'chest', shape: 'openSpread', motion: 'sway', reps: 1 },
  ворота: { loc: 'chest', shape: 'open', motion: 'apart', reps: 1, twoHand: true },
  крыша: { loc: 'shoulder', shape: 'open', motion: 'together', reps: 1, twoHand: true, dWrist: [0, 0, -0.4] },
  стена: { loc: 'forward', shape: 'open', motion: 'sway', reps: 1 },
  пол: { loc: 'low', shape: 'open', motion: 'sway', reps: 1, dWrist: [0.5, 0, 0] },
  потолок: { loc: 'shoulder', shape: 'open', motion: 'sway', reps: 1, dArm: [-0.3, 0, 0], dWrist: [0.5, 0, 0] },
  угол: { loc: 'chest', shape: 'open', motion: 'together', reps: 1, twoHand: true, dWrist: [0, 0.5, 0] },
  комната: { loc: 'chest', shape: 'open', motion: 'circle', reps: 1, twoHand: true },
  кухня: { loc: 'chest', shape: 'c', motion: 'circle', reps: 2 },
  ванная: { loc: 'chest', shape: 'fist', motion: 'circle', reps: 2, twoHand: true },
  туалет: { loc: 'chest', shape: 'fist', motion: 'shake', reps: 1 },
  балкон: { loc: 'forward', shape: 'open', motion: 'down', reps: 1, twoHand: true },
  гараж: { loc: 'chest', shape: 'fist', motion: 'pull', twoHand: true },
  подвал: { loc: 'low', shape: 'open', motion: 'down', reps: 1 },
  мебель: { loc: 'chest', shape: 'fist', motion: 'tap', reps: 2, twoHand: true },

  // ——— Партия 6: школа и канцелярия ———
  тетрадь: { loc: 'chest', shape: 'open', motion: 'twist', reps: 1, twoHand: true },
  карандаш: { loc: 'chest', shape: 'pinch', motion: 'sway', reps: 2 },
  линейка: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1, dWrist: [0, 0, 0.4] },
  ластик: { loc: 'chest', shape: 'fist', motion: 'sway', reps: 2, dWrist: [0.4, 0, 0] },
  доска: { loc: 'forward', shape: 'open', motion: 'circle', reps: 1 },
  мел: { loc: 'forward', shape: 'pinch', motion: 'sway', reps: 2 },
  парта: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, dWrist: [0.6, 0, 0], twoHand: true },
  портфель: { loc: 'low', shape: 'fist', motion: 'updown', reps: 1 },
  задача: { loc: 'forehead', shape: 'point', motion: 'circle', reps: 1 },
  пример: { loc: 'chest', shape: 'point', motion: 'tap', reps: 1, dWrist: [0.5, 0, 0] },
  ошибка: { loc: 'chest', shape: 'point', motion: 'twist', reps: 1 },
  оценка: { loc: 'chest', shape: 'openSpread', motion: 'tap', reps: 1 },
  каникулы: { loc: 'shoulder', shape: 'openSpread', motion: 'circle', reps: 1, twoHand: true },
  перемена: { loc: 'chest', shape: 'open', motion: 'twist', reps: 2, twoHand: true },
  звонок: { loc: 'shoulder', shape: 'pinch', motion: 'shake', reps: 2 },
  класс: { loc: 'chest', shape: 'open', motion: 'circle', reps: 1, dWrist: [0.6, 0, 0], twoHand: true },
  буква: { loc: 'chest', shape: 'pinch', motion: 'tap', reps: 1 },
  цифра: { loc: 'chest', shape: 'point', motion: 'tap', reps: 1 },
  страница: { loc: 'chest', shape: 'open', motion: 'twist', reps: 2 },
  рассказ: { loc: 'mouth', shape: 'openSpread', motion: 'push', reps: 1 },
  сказка: { loc: 'mouth', shape: 'openSpread', motion: 'circle', reps: 1 },
  стихи: { loc: 'mouth', shape: 'open', motion: 'sway', reps: 2 },
  песня: { loc: 'mouth', shape: 'open', motion: 'circle', reps: 2 },
  рисунок: { loc: 'chest', shape: 'point', motion: 'circle', reps: 1, dWrist: [0.5, 0, 0] },
  краски: { loc: 'chest', shape: 'open', motion: 'sway', reps: 2, dWrist: [0.3, 0, 0] },
  кисточка: { loc: 'chest', shape: 'pinch', motion: 'updown', reps: 2 },
  ножницы: { loc: 'chest', shape: 'v', motion: 'tap', reps: 3 },
  клей: { loc: 'chest', shape: 'point', motion: 'sway', reps: 1, dWrist: [0.5, 0, 0] },

  // ——— Партия 6: одежда ———
  пальто: { loc: 'chestTouch', shape: 'fist', motion: 'down', reps: 1, twoHand: true, dArm: [0.1, 0, 0] },
  свитер: { loc: 'chestTouch', shape: 'fist', motion: 'up', reps: 1, twoHand: true },
  футболка: { loc: 'chestTouch', shape: 'open', motion: 'tap', reps: 1, twoHand: true },
  юбка: { loc: 'belly', shape: 'open', motion: 'apart', reps: 1, twoHand: true },
  костюм: { loc: 'chestTouch', shape: 'open', motion: 'down', reps: 1, twoHand: true },
  галстук: { loc: 'chestTouch', shape: 'pinch', motion: 'down', reps: 1 },
  ремень: { loc: 'belly', shape: 'fist', motion: 'sway', reps: 1 },
  пуговица: { loc: 'chestTouch', shape: 'ring', motion: 'tap', reps: 2 },
  карман: { loc: 'belly', shape: 'open', motion: 'pull', reps: 1 },
  сапоги: { loc: 'low', shape: 'c', motion: 'up', reps: 1 },
  кроссовки: { loc: 'low', shape: 'fist', motion: 'tap', reps: 2 },
  тапочки: { loc: 'low', shape: 'open', motion: 'sway', reps: 1 },
  пижама: { loc: 'cheek', shape: 'open', motion: 'down', reps: 1, dArm: [0.2, 0, 0] },
  зонт: { loc: 'shoulder', shape: 'fist', motion: 'up', reps: 1 },

  // ——— Партия 6: здоровье ———
  болезнь: { loc: 'forehead', shape: 'open', motion: 'shake', reps: 1 },
  грипп: { loc: 'mouth', shape: 'fist', motion: 'tap', reps: 2 },
  простуда: { loc: 'mouth', shape: 'open', motion: 'shake', reps: 2 },
  рана: { loc: 'forward', shape: 'point', motion: 'sway', reps: 1 },
  синяк: { loc: 'forward', shape: 'fist', motion: 'tap', reps: 1 },
  ожог: { loc: 'forward', shape: 'open', motion: 'shake', reps: 2 },
  укол: { loc: 'forward', shape: 'point', motion: 'tap', reps: 1 },
  операция: { loc: 'belly', shape: 'point', motion: 'sway', reps: 1 },
  рецепт: { loc: 'chest', shape: 'pinch', motion: 'sway', reps: 1, dWrist: [0.5, 0, 0] },
  витамины: { loc: 'mouth', shape: 'pinch', motion: 'tap', reps: 2 },
  бинт: { loc: 'forward', shape: 'fist', motion: 'circle', reps: 2 },
  пластырь: { loc: 'forward', shape: 'open', motion: 'tap', reps: 1 },
  градусник: { loc: 'chestTouch', shape: 'point', motion: 'none' },
  маска: { loc: 'mouth', shape: 'open', motion: 'tap', reps: 1 },
  аллергия: { loc: 'cheek', shape: 'openSpread', motion: 'circle', reps: 1 },
  давление: { loc: 'forward', shape: 'c', motion: 'tap', reps: 2 },
  пульс: { loc: 'forward', shape: 'v', motion: 'tap', reps: 3 },
  зрение: { loc: 'forehead', shape: 'v', motion: 'push', reps: 1 },
  слух: { loc: 'cheek', shape: 'open', motion: 'tap', reps: 1 },

  // ——— Партия 6: спорт ———
  спорт: { loc: 'chest', shape: 'fist', motion: 'updown', reps: 2 },
  футбол: { loc: 'low', shape: 'fist', motion: 'push' },
  хоккей: { loc: 'low', shape: 'fist', motion: 'sway', reps: 2 },
  баскетбол: { loc: 'shoulder', shape: 'c', motion: 'push', twoHand: true },
  волейбол: { loc: 'shoulder', shape: 'open', motion: 'up', reps: 1, twoHand: true },
  теннис: { loc: 'forward', shape: 'fist', motion: 'sway', reps: 2 },
  бокс: { loc: 'chest', shape: 'fist', motion: 'push', reps: 2, twoHand: true },
  борьба: { loc: 'chest', shape: 'c', motion: 'together', reps: 1, twoHand: true },
  плавание: { loc: 'chest', shape: 'open', motion: 'apart', reps: 2, twoHand: true },
  бег: { loc: 'chest', shape: 'fist', motion: 'updown', reps: 3, twoHand: true },
  прыжок: { loc: 'chest', shape: 'v', motion: 'up', reps: 1, dWrist: [0.5, 0, 0] },
  мяч: { loc: 'chest', shape: 'c', motion: 'none', twoHand: true },
  команда: { loc: 'chest', shape: 'point', motion: 'circle', reps: 1, twoHand: true },
  тренер: { loc: 'forward', shape: 'point', motion: 'tap', reps: 2 },
  стадион: { loc: 'chest', shape: 'open', motion: 'circle', reps: 1, twoHand: true, dArm: [-0.2, 0, 0] },
  победа: { loc: 'shoulder', shape: 'v', motion: 'up', reps: 1 },
  медаль: { loc: 'chestTouch', shape: 'ring', motion: 'tap', reps: 1 },
  кубок: { loc: 'shoulder', shape: 'c', motion: 'up', reps: 1, twoHand: true },

  // ——— Партия 6: люди ———
  тётя: { loc: 'cheek', shape: 'c', motion: 'sway', reps: 1 },
  дядя: { loc: 'forehead', shape: 'c', motion: 'sway', reps: 1 },
  племянник: { loc: 'forehead', shape: 'v', motion: 'sway', reps: 1 },
  внук: { loc: 'forehead', shape: 'point', motion: 'down', reps: 2 },
  внучка: { loc: 'cheek', shape: 'point', motion: 'down', reps: 2 },
  сосед: { loc: 'forward', shape: 'open', motion: 'tap', reps: 1, dArm: [0, 0, 0.3] },
  начальник: { loc: 'shoulder', shape: 'fist', motion: 'up', reps: 1, dArm: [-0.2, 0, 0] },
  коллега: { loc: 'chest', shape: 'point', motion: 'together', reps: 1, twoHand: true },
  незнакомец: { loc: 'forward', shape: 'open', motion: 'twist', reps: 1 },
  инвалид: { loc: 'chest', shape: 'fist', motion: 'circle', reps: 1, twoHand: true },
  глухой: { loc: 'cheek', shape: 'point', motion: 'tap', reps: 1, dWrist: [0, 0, 0.3] },
  слышащий: { loc: 'cheek', shape: 'open', motion: 'apart', reps: 1 },
  переводчик: { loc: 'chest', shape: 'open', motion: 'twist', reps: 2, twoHand: true, dArm: [-0.1, 0, 0] },
  детство: { loc: 'low', shape: 'open', motion: 'sway', reps: 1, dWrist: [0.5, 0, 0] },

  // ——— Партия 6: абстракции ———
  мысль: { loc: 'forehead', shape: 'point', motion: 'circle', reps: 1 },
  мечта: { loc: 'forehead', shape: 'open', motion: 'up', reps: 1 },
  надежда: { loc: 'chestTouch', shape: 'open', motion: 'up', reps: 1 },
  дружба: { loc: 'chest', shape: 'fist', motion: 'together', reps: 2, twoHand: true },
  ссора: { loc: 'chest', shape: 'point', motion: 'apart', twoHand: true },
  обида: { loc: 'chestTouch', shape: 'fist', motion: 'pull', reps: 1 },
  вина: { loc: 'chestTouch', shape: 'point', motion: 'down', reps: 1 },
  стыд: { loc: 'cheek', shape: 'open', motion: 'down', reps: 1, dWrist: [0, 0, 0.3] },
  гордость: { loc: 'chestTouch', shape: 'thumbUp', motion: 'up', reps: 1 },
  зависть: { loc: 'mouth', shape: 'point', motion: 'sway', reps: 1 },
  жалость: { loc: 'chestTouch', shape: 'open', motion: 'circle', reps: 2 },
  скука: { loc: 'cheek', shape: 'open', motion: 'down', reps: 1, dArm: [0.15, 0, 0] },
  интерес: { loc: 'forehead', shape: 'point', motion: 'push', reps: 1 },
  внимание: { loc: 'forehead', shape: 'v', motion: 'push', twoHand: true },
  память: { loc: 'forehead', shape: 'fist', motion: 'tap', reps: 1 },
  ум: { loc: 'forehead', shape: 'point', motion: 'circle', reps: 2 },
  совесть: { loc: 'chestTouch', shape: 'point', motion: 'tap', reps: 2 },
  характер: { loc: 'chest', shape: 'fist', motion: 'twist', reps: 1 },
  привычка: { loc: 'chest', shape: 'fist', motion: 'circle', reps: 2 },
  настроение: { loc: 'chest', shape: 'open', motion: 'updown', reps: 1 },
  желание: { loc: 'chestTouch', shape: 'open', motion: 'pull', reps: 1 },
  цель: { loc: 'forward', shape: 'point', motion: 'push', reps: 1 },
  план: { loc: 'chest', shape: 'open', motion: 'sway', reps: 2, dWrist: [0.5, 0, 0] },
  идея: { loc: 'forehead', shape: 'point', motion: 'up', reps: 1 },
  секрет: { loc: 'mouth', shape: 'fist', motion: 'tap', reps: 1 },
  правило: { loc: 'chest', shape: 'open', motion: 'down', reps: 2, dWrist: [0, 0, 0.4] },
  закон: { loc: 'chest', shape: 'fist', motion: 'down', reps: 1, dWrist: [0, 0, 0.4] },
  право: { loc: 'chest', shape: 'open', motion: 'up', reps: 1, dWrist: [0, 0, 0.4] },
  совет: { loc: 'forehead', shape: 'pinch', motion: 'push', reps: 1 },
  выбор: { loc: 'forward', shape: 'pinch', motion: 'sway', reps: 2 },
  решение: { loc: 'chest', shape: 'fist', motion: 'down', reps: 1 },
  успех: { loc: 'shoulder', shape: 'openSpread', motion: 'up', reps: 1 },
  удача: { loc: 'chest', shape: 'thumbUp', motion: 'shake', reps: 1 },
  беда: { loc: 'forehead', shape: 'open', motion: 'shake', reps: 2 },
  опасность: { loc: 'forward', shape: 'openSpread', motion: 'shake', reps: 2 },
  риск: { loc: 'chest', shape: 'fist', motion: 'push', reps: 1 },
  польза: { loc: 'chest', shape: 'thumbUp', motion: 'tap', reps: 1 },
  вред: { loc: 'chest', shape: 'fist', motion: 'down', reps: 2 },

  // ——— Партия 6: материалы ———
  железо: { loc: 'chest', shape: 'fist', motion: 'tap', reps: 1, dWrist: [0, 0, 0.3] },
  золото: { loc: 'chest', shape: 'ring', motion: 'shake', reps: 1 },
  серебро: { loc: 'chest', shape: 'ring', motion: 'sway', reps: 1 },
  стекло: { loc: 'forward', shape: 'open', motion: 'tap', reps: 1, dWrist: [0, 0, 0.3] },
  ткань: { loc: 'chest', shape: 'pinch', motion: 'apart', twoHand: true },
  пластик: { loc: 'chest', shape: 'c', motion: 'tap', reps: 1 },
  резина: { loc: 'chest', shape: 'pinch', motion: 'apart', reps: 2, twoHand: true },
  кирпич: { loc: 'chest', shape: 'fist', motion: 'down', reps: 1, twoHand: true },

  // ——— Партия 6: качества ———
  высокий: { loc: 'shoulder', shape: 'open', motion: 'up', reps: 1, dWrist: [0.5, 0, 0] },
  низкий: { loc: 'low', shape: 'open', motion: 'down', reps: 1, dWrist: [0.5, 0, 0] },
  длинный: { loc: 'chest', shape: 'open', motion: 'apart', reps: 1, twoHand: true },
  короткий: { loc: 'chest', shape: 'open', motion: 'together', reps: 1, twoHand: true },
  широкий: { loc: 'chest', shape: 'open', motion: 'apart', twoHand: true, dWrist: [0, 0.5, 0] },
  узкий: { loc: 'chest', shape: 'open', motion: 'together', twoHand: true, dWrist: [0, 0.5, 0] },
  толстый: { loc: 'chest', shape: 'c', motion: 'apart', reps: 1, twoHand: true },
  тонкий: { loc: 'chest', shape: 'pinch', motion: 'together', reps: 1 },
  тяжёлый: { loc: 'chest', shape: 'fist', motion: 'down', reps: 1, twoHand: true, dArm: [0.15, 0, 0] },
  глубокий: { loc: 'low', shape: 'open', motion: 'down', reps: 1 },
  мелкий: { loc: 'low', shape: 'open', motion: 'sway', reps: 1, dWrist: [0.5, 0, 0] },
  острый: { loc: 'chest', shape: 'point', motion: 'tap', reps: 1, dWrist: [0, 0, 0.4] },
  тупой: { loc: 'chest', shape: 'fist', motion: 'tap', reps: 1, dWrist: [0, 0, 0.4] },
  мягкий: { loc: 'chest', shape: 'open', motion: 'morph', shape2: 'pinch', reps: 1 },
  твёрдый: { loc: 'chest', shape: 'fist', motion: 'tap', reps: 2, twoHand: true },
  гладкий: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1, dWrist: [0.6, 0, 0] },
  мокрый: { loc: 'chest', shape: 'openSpread', motion: 'down', reps: 1 },
  сухой: { loc: 'chest', shape: 'open', motion: 'twist', reps: 2 },
  тёплый: { loc: 'chest', shape: 'open', motion: 'circle', reps: 1, dWrist: [0, 0.5, 0] },
  светлый: { loc: 'shoulder', shape: 'openSpread', motion: 'apart', reps: 1, twoHand: true },
  тёмный: { loc: 'forehead', shape: 'open', motion: 'down', reps: 1, twoHand: true },
  яркий: { loc: 'shoulder', shape: 'openSpread', motion: 'morph', shape2: 'open', reps: 1 },
  громкий: { loc: 'cheek', shape: 'openSpread', motion: 'apart', reps: 1, twoHand: true },
  тихий: { loc: 'mouth', shape: 'point', motion: 'down', reps: 1 },
  свежий: { loc: 'mouth', shape: 'open', motion: 'circle', reps: 1 },
  старший: { loc: 'shoulder', shape: 'open', motion: 'up', reps: 1 },
  младший: { loc: 'low', shape: 'open', motion: 'down', reps: 1 },
  левый: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1, dArm: [0, 0, -0.3] },
  правый: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1, dArm: [0, 0, 0.3] },
  целый: { loc: 'chest', shape: 'open', motion: 'circle', reps: 1 },
  готовый: { loc: 'chest', shape: 'thumbUp', motion: 'push', reps: 1 },
  живой: { loc: 'chestTouch', shape: 'openSpread', motion: 'up', reps: 1 },
  мёртвый: { loc: 'chest', shape: 'open', motion: 'twist', reps: 1, twoHand: true },
  больной: { loc: 'forehead', shape: 'open', motion: 'tap', reps: 2, dWrist: [0, 0, 0.2] },
  голодный: { loc: 'belly', shape: 'c', motion: 'circle', reps: 1 },
  сытый: { loc: 'belly', shape: 'open', motion: 'up', reps: 1 },
  серьёзный: { loc: 'mouth', shape: 'point', motion: 'down', reps: 1, dWrist: [0, 0, 0.3] },
  строгий: { loc: 'forward', shape: 'point', motion: 'down', reps: 1 },
  вежливый: { loc: 'chestTouch', shape: 'open', motion: 'circle', reps: 1, dWrist: [0, 0.3, 0] },
  грубый: { loc: 'chest', shape: 'fist', motion: 'push', reps: 2 },
  честный: { loc: 'mouth', shape: 'open', motion: 'push', dWrist: [0, 0.3, 0] },
  хитрый: { loc: 'cheek', shape: 'point', motion: 'sway', reps: 2 },
  смелый: { loc: 'chestTouch', shape: 'fist', motion: 'tap', reps: 1 },
  трусливый: { loc: 'chest', shape: 'open', motion: 'shake', reps: 3, twoHand: true },
  ленивый: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, dArm: [0.2, 0, 0] },
  аккуратный: { loc: 'chest', shape: 'open', motion: 'sway', reps: 2, dWrist: [0.5, 0, 0] },
  спокойный: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, dWrist: [0.5, 0, 0], twoHand: true },
  нервный: { loc: 'chest', shape: 'openSpread', motion: 'shake', reps: 3 },
  одинокий: { loc: 'shoulder', shape: 'point', motion: 'none', dArm: [0, 0, 0.2] },
  свободный: { loc: 'chest', shape: 'open', motion: 'apart', reps: 1, twoHand: true, dArm: [-0.2, 0, 0] },
  занятый: { loc: 'chest', shape: 'fist', motion: 'circle', reps: 2, twoHand: true },

  // ——— Партия 6: указатели и наречия ———
  этот: { loc: 'low', shape: 'point', motion: 'tap', reps: 1 },
  тот: { loc: 'forward', shape: 'point', motion: 'tap', reps: 1, dArm: [0, 0, 0.3] },
  такой: { loc: 'forward', shape: 'open', motion: 'tap', reps: 1 },
  каждый: { loc: 'chest', shape: 'point', motion: 'sway', reps: 3 },
  любой: { loc: 'chest', shape: 'open', motion: 'sway', reps: 2 },
  весь: { loc: 'chest', shape: 'open', motion: 'circle', reps: 1, twoHand: true },
  сам: { loc: 'chestTouch', shape: 'point', motion: 'tap', reps: 2 },
  свой: { loc: 'chestTouch', shape: 'open', motion: 'tap', reps: 1 },
  никто: { loc: 'chest', shape: 'ring', motion: 'sway', reps: 2 },
  все: { loc: 'forward', shape: 'open', motion: 'circle', reps: 1, twoHand: true },
  оба: { loc: 'chest', shape: 'v', motion: 'tap', reps: 1, twoHand: true },
  несколько: { loc: 'chest', shape: 'openSpread', motion: 'twist', reps: 1 },
  зачем: { loc: 'forehead', shape: 'open', motion: 'twist', reps: 2 },
  откуда: { loc: 'forward', shape: 'point', motion: 'pull', reps: 1 },
  туда: { loc: 'forward', shape: 'open', motion: 'push', reps: 1, dArm: [0, 0, 0.2] },
  сюда: { loc: 'chest', shape: 'open', motion: 'pull', reps: 1 },
  везде: { loc: 'chest', shape: 'open', motion: 'circle', reps: 2, twoHand: true },
  нигде: { loc: 'chest', shape: 'ring', motion: 'circle', reps: 1 },
  вверх: { loc: 'shoulder', shape: 'point', motion: 'up', reps: 1 },
  вниз: { loc: 'low', shape: 'point', motion: 'down', reps: 1 },
  вперёд: { loc: 'forward', shape: 'open', motion: 'push', reps: 1, dWrist: [0, 0.4, 0] },
  назад: { loc: 'chest', shape: 'open', motion: 'pull', reps: 1, dWrist: [0, 0.4, 0] },
  рядом: { loc: 'chest', shape: 'open', motion: 'together', reps: 1, twoHand: true, dArm: [0, 0, -0.1] },
  высоко: { loc: 'shoulder', shape: 'open', motion: 'up', reps: 1, dArm: [-0.3, 0, 0] },
  низко: { loc: 'low', shape: 'open', motion: 'down', reps: 1, dArm: [0.1, 0, 0] },
  глубоко: { loc: 'low', shape: 'point', motion: 'down', reps: 2 },
  вдруг: { loc: 'chest', shape: 'fist', motion: 'morph', shape2: 'openSpread', reps: 1 },
  сразу: { loc: 'chest', shape: 'open', motion: 'push', reps: 1, dWrist: [0.3, 0, 0] },
  давно: { loc: 'shoulder', shape: 'open', motion: 'pull', reps: 1, dArm: [0, 0, 0.2] },
  недавно: { loc: 'chest', shape: 'point', motion: 'pull', reps: 1 },
  скоро: { loc: 'forward', shape: 'point', motion: 'tap', reps: 2 },
  вовремя: { loc: 'chest', shape: 'point', motion: 'down', reps: 1, twoHand: true },

  // ——— Партия 6: время ———
  секунда: { loc: 'chest', shape: 'point', motion: 'shake', reps: 1 },
  момент: { loc: 'chest', shape: 'pinch', motion: 'tap', reps: 1, dWrist: [0.3, 0, 0] },
  прошлое: { loc: 'shoulder', shape: 'open', motion: 'pull', dArm: [0, 0, 0.3] },
  будущее: { loc: 'forward', shape: 'open', motion: 'push', dArm: [-0.2, 0, 0] },
  начало: { loc: 'chest', shape: 'point', motion: 'twist', reps: 1, dWrist: [0.3, 0, 0] },
  конец: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, dWrist: [0, 0, 0.5], twoHand: true },
  рождение: { loc: 'belly', shape: 'open', motion: 'up', reps: 1, twoHand: true },
  возраст: { loc: 'mouth', shape: 'fist', motion: 'down', reps: 2 },

  // ——— Партия 7: кухня и посуда ———
  кастрюля: { loc: 'chest', shape: 'c', motion: 'up', reps: 1, twoHand: true },
  сковорода: { loc: 'chest', shape: 'fist', motion: 'shake', reps: 1 },
  чайник: { loc: 'chest', shape: 'c', motion: 'twist', reps: 1, dWrist: [0.3, 0, 0] },
  стакан: { loc: 'chest', shape: 'c', motion: 'up', reps: 1 },
  банка: { loc: 'chest', shape: 'c', motion: 'twist', reps: 2, twoHand: true },
  бутылка: { loc: 'chest', shape: 'c', motion: 'twist', reps: 1, dArm: [-0.15, 0, 0] },
  пакет: { loc: 'low', shape: 'fist', motion: 'sway', reps: 1, dArm: [0.1, 0, 0] },
  коробка: { loc: 'chest', shape: 'open', motion: 'together', reps: 1, twoHand: true, dWrist: [0, 0.5, 0] },

  // ——— Партия 7: инструменты ———
  молоток: { loc: 'chest', shape: 'fist', motion: 'down', reps: 2, dWrist: [0.3, 0, 0] },
  топор: { loc: 'chest', shape: 'open', motion: 'down', reps: 2, dWrist: [0, 0, 0.4] },
  пила: { loc: 'chest', shape: 'open', motion: 'sway', reps: 3, dWrist: [0, 0, 0.4] },
  гвоздь: { loc: 'chest', shape: 'point', motion: 'down', reps: 2, twoHand: true },
  верёвка: { loc: 'chest', shape: 'pinch', motion: 'apart', reps: 1, twoHand: true },
  лопата: { loc: 'low', shape: 'fist', motion: 'down', reps: 2, dArm: [0.1, 0, 0] },
  ведро: { loc: 'low', shape: 'fist', motion: 'updown', reps: 1, dArm: [0.1, 0, 0] },
  метла: { loc: 'low', shape: 'fist', motion: 'sway', reps: 2 },

  // ——— Партия 7: искусство и культура ———
  театр: { loc: 'chest', shape: 'open', motion: 'twist', reps: 1, twoHand: true, dArm: [-0.2, 0, 0] },
  кино: { loc: 'forehead', shape: 'openSpread', motion: 'sway', reps: 2 },
  артист: { loc: 'chest', shape: 'openSpread', motion: 'circle', reps: 1, dArm: [-0.2, 0, 0] },
  сцена: { loc: 'forward', shape: 'open', motion: 'apart', reps: 1, twoHand: true },
  танец: { loc: 'chest', shape: 'v', motion: 'sway', reps: 2, dWrist: [0.5, 0, 0] },
  барабан: { loc: 'chest', shape: 'fist', motion: 'updown', reps: 3, twoHand: true },
  гитара: { loc: 'chest', shape: 'open', motion: 'sway', reps: 2, dArm: [0.1, 0, -0.2] },
  пианино: { loc: 'chest', shape: 'openSpread', motion: 'sway', reps: 2, twoHand: true, dWrist: [0.5, 0, 0] },
  мир: { loc: 'chest', shape: 'open', motion: 'circle', reps: 1, twoHand: true, dArm: [-0.15, 0, 0] },
  война: { loc: 'chest', shape: 'fist', motion: 'push', reps: 2, twoHand: true },
  солдат: { loc: 'forehead', shape: 'open', motion: 'tap', reps: 1, dWrist: [0, 0, 0.4] },

  // ——— Партия 7: птицы и растения ———
  ворона: { loc: 'mouth', shape: 'pinch', motion: 'push', reps: 2 },
  воробей: { loc: 'chest', shape: 'pinch', motion: 'updown', reps: 3 },
  голубь: { loc: 'chest', shape: 'open', motion: 'shake', reps: 2, twoHand: true },
  сова: { loc: 'forehead', shape: 'ring', motion: 'none', twoHand: true },
  роза: { loc: 'mouth', shape: 'pinch', motion: 'circle', reps: 1 },
  берёза: { loc: 'shoulder', shape: 'openSpread', motion: 'sway', reps: 1 },
  ёлка: { loc: 'chest', shape: 'open', motion: 'down', reps: 2, twoHand: true, dWrist: [0, 0, -0.3] },
  дуб: { loc: 'shoulder', shape: 'fist', motion: 'none', twoHand: true },

  // ——— Партия 7: игрушки и детское ———
  игрушка: { loc: 'chest', shape: 'open', motion: 'shake', reps: 2 },
  кукла: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1, dArm: [0.1, 0, 0] },
  мишка: { loc: 'chest', shape: 'fist', motion: 'together', reps: 1, twoHand: true },
  кубики: { loc: 'chest', shape: 'fist', motion: 'up', reps: 2, twoHand: true },
  шарик: { loc: 'shoulder', shape: 'pinch', motion: 'up', reps: 1 },

  // ——— Партия 7: техника ———
  холодильник: { loc: 'chest', shape: 'fist', motion: 'pull', reps: 1, dArm: [-0.1, 0, 0] },
  плита: { loc: 'chest', shape: 'point', motion: 'twist', reps: 1, dWrist: [0.5, 0, 0] },
  пылесос: { loc: 'low', shape: 'fist', motion: 'push', reps: 2 },
  утюг: { loc: 'chest', shape: 'fist', motion: 'sway', reps: 2, dWrist: [0.5, 0, 0] },
  микроволновка: { loc: 'chest', shape: 'point', motion: 'circle', reps: 1, dWrist: [0, 0, 0.3] },
  розетка: { loc: 'forward', shape: 'v', motion: 'push', reps: 1 },
  батарея: { loc: 'chest', shape: 'open', motion: 'tap', reps: 1, dWrist: [0, 0, 0.4], twoHand: true },
  кондиционер: { loc: 'shoulder', shape: 'openSpread', motion: 'sway', reps: 2, dArm: [-0.2, 0, 0] },

  // ——— Партия 7: гаджеты и интернет ———
  сайт: { loc: 'forward', shape: 'point', motion: 'tap', reps: 1, dWrist: [0, 0.4, 0] },
  приложение: { loc: 'chest', shape: 'point', motion: 'tap', reps: 2, dWrist: [0, 0.4, 0] },
  сообщение: { loc: 'chest', shape: 'point', motion: 'sway', reps: 2, dWrist: [0.5, 0, 0] },
  экран: { loc: 'forward', shape: 'open', motion: 'circle', reps: 1, dWrist: [0, 0.4, 0] },
  кнопка: { loc: 'forward', shape: 'point', motion: 'tap', reps: 2 },
  наушники: { loc: 'cheek', shape: 'c', motion: 'tap', reps: 1, twoHand: true },
  камера: { loc: 'forehead', shape: 'ring', motion: 'tap', reps: 1, dArm: [0, 0, 0.15] },
  планшет: { loc: 'chest', shape: 'open', motion: 'tap', reps: 2, dWrist: [0, 0.4, 0], twoHand: true },
  ноутбук: { loc: 'chest', shape: 'open', motion: 'up', reps: 1, twoHand: true, dWrist: [0.5, 0, 0] },
  зарядка: { loc: 'chest', shape: 'v', motion: 'push', reps: 1 },

  // ——— Партия 7: профессии ———
  юрист: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, dWrist: [0, 0, 0.4] },
  бухгалтер: { loc: 'chest', shape: 'openSpread', motion: 'tap', reps: 2 },
  программист: { loc: 'chest', shape: 'openSpread', motion: 'updown', reps: 2, twoHand: true },
  дизайнер: { loc: 'forward', shape: 'pinch', motion: 'circle', reps: 1 },
  журналист: { loc: 'mouth', shape: 'pinch', motion: 'sway', reps: 2 },
  актёр: { loc: 'chest', shape: 'open', motion: 'twist', reps: 1, dArm: [-0.2, 0, 0] },
  певец: { loc: 'mouth', shape: 'open', motion: 'circle', reps: 2, dArm: [-0.1, 0, 0] },
  художник: { loc: 'forward', shape: 'pinch', motion: 'sway', reps: 2, dArm: [-0.1, 0, 0] },
  музыкант: { loc: 'chest', shape: 'openSpread', motion: 'sway', reps: 2, dArm: [-0.1, 0, 0] },
  спортсмен: { loc: 'chest', shape: 'fist', motion: 'up', reps: 2 },
  официант: { loc: 'shoulder', shape: 'open', motion: 'none', dWrist: [0, 0.5, 0] },
  парикмахер: { loc: 'forehead', shape: 'v', motion: 'tap', reps: 2 },
  охранник: { loc: 'chest', shape: 'fist', motion: 'none', twoHand: true },
  курьер: { loc: 'forward', shape: 'fist', motion: 'push', reps: 1, dArm: [0.1, 0, 0] },
  фермер: { loc: 'low', shape: 'fist', motion: 'circle', reps: 1, twoHand: true },

  // ——— Партия 7: ещё глаголы и связки ———
  висеть: { loc: 'shoulder', shape: 'c', motion: 'sway', reps: 1 },
  лежать: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1, dWrist: [0.6, 0, 0] },
  шептать: { loc: 'mouth', shape: 'open', motion: 'tap', reps: 2, dWrist: [0, 0, 0.3] },
  кивать: { loc: 'chest', shape: 'fist', motion: 'updown', reps: 2, dWrist: [0.3, 0, 0] },
  махать: { loc: 'shoulder', shape: 'open', motion: 'shake', reps: 3 },
  если: { loc: 'chest', shape: 'open', motion: 'updown', reps: 1, dWrist: [0, 0.4, 0] },
  или: { loc: 'chest', shape: 'v', motion: 'sway', reps: 1 },
  но: { loc: 'chest', shape: 'point', motion: 'sway', reps: 1, dWrist: [0, 0, 0.3] },
  потому: { loc: 'forehead', shape: 'point', motion: 'push', reps: 1 },
  половина: { loc: 'chest', shape: 'open', motion: 'down', reps: 1, dWrist: [0, 0, 0.4] },
  часть: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1, dWrist: [0, 0, 0.4] },
  ноль: { loc: 'shoulder', shape: 'ring', motion: 'none' },
  отлично: { loc: 'shoulder', shape: 'thumbUp', motion: 'push', reps: 1 },
  ужасно: { loc: 'chest', shape: 'openSpread', motion: 'shake', reps: 2 },
  точно: { loc: 'chest', shape: 'point', motion: 'tap', reps: 1, twoHand: true },
  примерно: { loc: 'chest', shape: 'open', motion: 'sway', reps: 1, dWrist: [0, 0.4, 0] },
  конечно: { loc: 'chest', shape: 'thumbUp', motion: 'tap', reps: 2 },
  наверное: { loc: 'chest', shape: 'open', motion: 'updown', reps: 1, twoHand: true },
  обязательно: { loc: 'chest', shape: 'fist', motion: 'down', reps: 2 },
  специально: { loc: 'forehead', shape: 'point', motion: 'tap', reps: 1, dWrist: [0, 0, 0.2] },
  случайно: { loc: 'chest', shape: 'open', motion: 'twist', reps: 1, dWrist: [0, 0.3, 0] },

  // ——— Партия 7б: места в городе ———
  аэропорт: { loc: 'shoulder', shape: 'phone', motion: 'up', reps: 1 },
  вокзал: { loc: 'chest', shape: 'fist', motion: 'circle', reps: 1, twoHand: true, dArm: [-0.1, 0, 0] },
  гостиница: { loc: 'cheek', shape: 'open', motion: 'tap', reps: 2 },
  ресторан: { loc: 'mouth', shape: 'c', motion: 'circle', reps: 2 },
  кафе: { loc: 'mouth', shape: 'c', motion: 'tap', reps: 1, dArm: [-0.1, 0, 0] },
  рынок: { loc: 'chest', shape: 'pinch', motion: 'sway', reps: 2, twoHand: true },
  цирк: { loc: 'shoulder', shape: 'openSpread', motion: 'circle', reps: 2 },
  зоопарк: { loc: 'chest', shape: 'openSpread', motion: 'sway', reps: 2, twoHand: true },
  музей: { loc: 'forward', shape: 'open', motion: 'sway', reps: 1, dWrist: [0, 0.4, 0], twoHand: true },
  библиотека: { loc: 'chest', shape: 'open', motion: 'twist', reps: 2, twoHand: true },
  бассейн: { loc: 'chest', shape: 'open', motion: 'apart', reps: 2, twoHand: true, dWrist: [0.5, 0, 0] },
  завод: { loc: 'chest', shape: 'fist', motion: 'circle', reps: 2, twoHand: true, dWrist: [0.3, 0, 0] },
  офис: { loc: 'chest', shape: 'openSpread', motion: 'tap', reps: 2, dWrist: [0.4, 0, 0] },
};

/** Отображаемое имя (мама2 — вариант «мама», основной жест записан отдельно) */
export const SIGN_WORDS = Object.keys(WORDS).filter((w) => w !== 'мама2');

// ——— Морфология: приведение словоформ к лемме ———

// Явные неправильные формы (частотные глаголы)
const FORMS: Record<string, string> = {
  хочу: 'хотеть', хочешь: 'хотеть', хочет: 'хотеть', хотим: 'хотеть',
  хотите: 'хотеть', хотят: 'хотеть', хотел: 'хотеть', хотела: 'хотеть',
  ем: 'есть', ешь: 'есть', ест: 'есть', едим: 'есть', едите: 'есть', едят: 'есть',
  ел: 'есть', ела: 'есть',
  пью: 'пить', пьёшь: 'пить', пьёт: 'пить', пьём: 'пить', пьёте: 'пить', пьют: 'пить',
  иду: 'идти', идёшь: 'идти', идёт: 'идти', идём: 'идти', идёте: 'идти', идут: 'идти',
  шёл: 'идти', шла: 'идти', шли: 'идти',
  еду: 'ехать', едешь: 'ехать', едет: 'ехать', едем: 'ехать', едете: 'ехать',
  люблю: 'любить', любишь: 'любить', любит: 'любить', любим: 'любить',
  любите: 'любить', любят: 'любить',
  могу: 'мочь', можешь: 'мочь', может: 'мочь', можем: 'мочь', можете: 'мочь',
  могут: 'мочь', мог: 'мочь', могла: 'мочь',
  вижу: 'видеть', видишь: 'видеть', видит: 'видеть', видим: 'видеть',
  видите: 'видеть', видят: 'видеть',
  знаю: 'знать', знаешь: 'знать', знает: 'знать', знаем: 'знать',
  знаете: 'знать', знают: 'знать',
  понимаю: 'понимать', понимаешь: 'понимать', понимает: 'понимать',
  понимаем: 'понимать', понимаете: 'понимать', понимают: 'понимать',
  думаю: 'думать', думаешь: 'думать', думает: 'думать', думаем: 'думать',
  думают: 'думать',
  работаю: 'работать', работаешь: 'работать', работает: 'работать',
  работаем: 'работать', работают: 'работать',
  сплю: 'спать', спишь: 'спать', спит: 'спать', спим: 'спать', спят: 'спать',
  дай: 'дать', дам: 'дать', дашь: 'дать', даст: 'дать', дадим: 'дать', дадут: 'дать',
  жду: 'ждать', ждёшь: 'ждать', ждёт: 'ждать', ждём: 'ждать', ждут: 'ждать',
  говорю: 'говорить', говоришь: 'говорить', говорит: 'говорить',
  говорим: 'говорить', говорят: 'говорить',
  скажи: 'сказать', скажу: 'сказать', скажет: 'сказать',
  помоги: 'помогать', помогаю: 'помогать', помогает: 'помогать',
  делаю: 'делать', делаешь: 'делать', делает: 'делать', делаем: 'делать',
  делают: 'делать',
  живу: 'жить', живёшь: 'жить', живёт: 'жить', живём: 'жить', живут: 'жить',
  меня: 'я', мне: 'я', мной: 'я',
  тебя: 'ты', тебе: 'ты', тобой: 'ты',
  его: 'он', ему: 'он', нём: 'он', ним: 'он',
  её: 'она', ей: 'она', ней: 'она',
  нас: 'мы', нам: 'мы', нами: 'мы',
  вас: 'вы', вам: 'вы', вами: 'вы',
  их: 'они', им: 'они', ними: 'они',
  дома: 'дом', домой: 'дом', доме: 'дом',
  мамочка: 'мама2',
  куплю: 'купить', купишь: 'купить', купит: 'купить', купим: 'купить',
  купят: 'купить', купи: 'купить', купил: 'купить', купила: 'купить',
  звоню: 'звонить', звонишь: 'звонить', звонит: 'звонить', звоним: 'звонить',
  звонят: 'звонить', позвони: 'звонить', позвонить: 'звонить',
  помню: 'помнить', помнишь: 'помнить', помнит: 'помнить', помним: 'помнить',
  помнят: 'помнить',
  плачу: 'платить', платишь: 'платить', платит: 'платить', платим: 'платить',
  платят: 'платить', заплатить: 'платить',
  готовлю: 'готовить', готовишь: 'готовить', готовит: 'готовить',
  готовим: 'готовить', готовят: 'готовить',
  найду: 'найти', найдёшь: 'найти', найдёт: 'найти', найдём: 'найти',
  найдут: 'найти', нашёл: 'найти', нашла: 'найти',
  открою: 'открыть', откроешь: 'открыть', откроет: 'открыть',
  открой: 'открыть', открыл: 'открыть', открыла: 'открыть',
  закрою: 'закрыть', закроешь: 'закрыть', закроет: 'закрыть',
  закрой: 'закрыть', закрыл: 'закрыть', закрыла: 'закрыть',
  забуду: 'забыть', забудешь: 'забыть', забудет: 'забыть',
  забыл: 'забыть', забыла: 'забыть',
  боюсь: 'бояться', боишься: 'бояться', боится: 'бояться',
  боимся: 'бояться', боятся: 'бояться',
  нравлюсь: 'нравиться', нравится: 'нравиться', нравятся: 'нравиться',
  пою: 'петь', поёшь: 'петь', поёт: 'петь', поём: 'петь', поют: 'петь',
  танцую: 'танцевать', танцуешь: 'танцевать', танцует: 'танцевать',
  танцуют: 'танцевать',
  мою: 'мыть', моешь: 'мыть', моет: 'мыть', моют: 'мыть',
  ищу: 'искать', ищешь: 'искать', ищет: 'искать', ищем: 'искать', ищут: 'искать',
  покажу: 'показать', покажешь: 'показать', покажет: 'показать',
  покажи: 'показать', показал: 'показать', показала: 'показать',
  спрошу: 'спросить', спросишь: 'спросить', спросит: 'спросить',
  спроси: 'спросить', спросил: 'спросить', спросила: 'спросить',
  учу: 'учить', учишь: 'учить', учит: 'учить', учим: 'учить', учат: 'учить',
  ухожу: 'уходить', уходишь: 'уходить', уходит: 'уходить', уходим: 'уходить',
  уходят: 'уходить', ушёл: 'уходить', ушла: 'уходить', уйти: 'уходить',
  прихожу: 'приходить', приходишь: 'приходить', приходит: 'приходить',
  приходят: 'приходить', пришёл: 'приходить', пришла: 'приходить',
  приди: 'приходить', прийти: 'приходить', приду: 'приходить',
  придёт: 'приходить', придём: 'приходить',
  начну: 'начать', начнёшь: 'начать', начнёт: 'начать', начни: 'начать',
  начал: 'начать', начала: 'начать',
  закончу: 'закончить', закончишь: 'закончить', закончит: 'закончить',
  закончи: 'закончить', закончил: 'закончить', закончила: 'закончить',
  устала: 'устал', устали: 'устал', устать: 'устал',
  болит: 'болеть', болят: 'болеть', заболел: 'болеть', заболела: 'болеть',
  плачет: 'плакать', плачешь: 'плакать',
  верю: 'верить', веришь: 'верить', верит: 'верить', верим: 'верить',
  верят: 'верить', поверь: 'верить',
  обещаю: 'обещать', обещаешь: 'обещать', обещает: 'обещать', обещают: 'обещать',
  приглашаю: 'приглашать', приглашает: 'приглашать', пригласи: 'приглашать',
  приглашаем: 'приглашать', пригласить: 'приглашать',
  поздравляю: 'поздравлять', поздравляем: 'поздравлять', поздравь: 'поздравлять',
  желаю: 'желать', желаем: 'желать', желает: 'желать', пожелать: 'желать',
  целую: 'целовать', целует: 'целовать', поцелуй: 'целовать',
  обнимаю: 'обнимать', обнимает: 'обнимать', обними: 'обнимать',
  улыбаюсь: 'улыбаться', улыбается: 'улыбаться', улыбнись: 'улыбаться',
  кричу: 'кричать', кричит: 'кричать', кричат: 'кричать', закричал: 'кричать',
  молчу: 'молчать', молчит: 'молчать', молчи: 'молчать', замолчи: 'молчать',
  шучу: 'шутить', шутит: 'шутить', пошутил: 'шутить',
  отдыхаю: 'отдыхать', отдыхает: 'отдыхать', отдохни: 'отдыхать',
  отдыхаем: 'отдыхать', отдохнуть: 'отдыхать',
  встаю: 'вставать', встаёшь: 'вставать', встаёт: 'вставать', встану: 'вставать',
  встал: 'вставать', встала: 'вставать', вставай: 'вставать',
  ложусь: 'ложиться', ложится: 'ложиться', ложись: 'ложиться', лёг: 'ложиться',
  легла: 'ложиться',
  включи: 'включить', включу: 'включить', включил: 'включить',
  включает: 'включить',
  выключи: 'выключить', выключу: 'выключить', выключил: 'выключить',
  сломал: 'ломать', сломала: 'ломать', сломался: 'ломать', сломать: 'ломать',
  починю: 'чинить', почини: 'чинить', починил: 'чинить', починить: 'чинить',
  чиню: 'чинить', чинит: 'чинить',
  поменяю: 'менять', поменяй: 'менять', поменял: 'менять', поменять: 'менять',
  меняю: 'менять', меняет: 'менять',
  попробую: 'пробовать', попробуй: 'пробовать', пробую: 'пробовать',
  пробует: 'пробовать', попробовать: 'пробовать',
  стираю: 'стирать', стирает: 'стирать', постирай: 'стирать',
  убираю: 'убирать', убирает: 'убирать', убери: 'убирать', уберу: 'убирать',
  спешу: 'спешить', спешит: 'спешить', спешим: 'спешить',
  мешаю: 'мешать', мешает: 'мешать', мешают: 'мешать',
  прости: 'прощать', простите: 'прощать', прощаю: 'прощать', простил: 'прощать',
  вернусь: 'возвращаться', вернётся: 'возвращаться', вернулся: 'возвращаться',
  вернулась: 'возвращаться', вернись: 'возвращаться', вернуться: 'возвращаться',
  упал: 'падать', упала: 'падать', упадёт: 'падать', падаю: 'падать',
  опоздал: 'опаздывать', опоздала: 'опаздывать', опоздаю: 'опаздывать',
  получил: 'получать', получила: 'получать', получу: 'получать', получи: 'получать',
  принеси: 'приносить', принесу: 'приносить', принёс: 'приносить',
  принесла: 'приносить', принести: 'приносить',
  объясни: 'объяснять', объясню: 'объяснять', объяснил: 'объяснять',
  повтори: 'повторять', повторю: 'повторять', повторил: 'повторять',
  проверь: 'проверять', проверю: 'проверять', проверил: 'проверять',
  выбери: 'выбирать', выберу: 'выбирать', выбрал: 'выбирать', выбрала: 'выбирать',
  реши: 'решать', решу: 'решать', решил: 'решать', решила: 'решать',
  согласен: 'соглашаться', согласна: 'соглашаться', согласился: 'соглашаться',
  откажусь: 'отказываться', отказался: 'отказываться',
  держу: 'держать', держишь: 'держать', держит: 'держать', держи: 'держать',
  несу: 'нести', несёт: 'нести', неси: 'нести', нёс: 'нести',
  кладу: 'класть', кладёт: 'класть', положи: 'класть', положил: 'класть',
  положу: 'класть', положить: 'класть',
  ставлю: 'ставить', ставит: 'ставить', поставь: 'ставить', поставил: 'ставить',
  поставить: 'ставить', поставлю: 'ставить',
  брошу: 'бросать', бросил: 'бросать', бросила: 'бросать', брось: 'бросать',
  бросить: 'бросать', бросаю: 'бросать',
  ловлю: 'ловить', ловит: 'ловить', поймал: 'ловить', поймала: 'ловить',
  поймай: 'ловить', поймать: 'ловить',
  победил: 'побеждать', победила: 'побеждать', победим: 'побеждать',
  дышу: 'дышать', дышит: 'дышать', дыши: 'дышать',
  плыву: 'плавать', плывёт: 'плавать', плыть: 'плавать',
  лечу: 'летать', летит: 'летать', лететь: 'летать',
  расту: 'расти', растёт: 'расти', вырос: 'расти', выросла: 'расти',
  жалуюсь: 'жаловаться', жалуется: 'жаловаться',
  советую: 'советовать', советует: 'советовать', посоветуй: 'советовать',
  спорю: 'спорить', спорит: 'спорить', спорят: 'спорить',
  умею: 'уметь', умеешь: 'уметь', умеет: 'уметь', умеем: 'уметь', умеют: 'уметь',
  использую: 'использовать', использует: 'использовать',
  собираю: 'собирать', собирает: 'собирать', собери: 'собирать', собрал: 'собирать',
  прячу: 'прятать', прячет: 'прятать', спрячь: 'прятать', спрятал: 'прятать',
  тяну: 'тянуть', тянет: 'тянуть', потяни: 'тянуть',
  толкаю: 'толкать', толкает: 'толкать', толкни: 'толкать',
  режу: 'резать', режет: 'резать', разрежь: 'резать', порезал: 'резать',
  шью: 'шить', шьёт: 'шить', сшил: 'шить', сшила: 'шить',
  вишу: 'висеть', висит: 'висеть', висят: 'висеть',
  лежу: 'лежать', лежит: 'лежать', лежат: 'лежать', ляг: 'лежать',
  шепчу: 'шептать', шепчет: 'шептать', шепни: 'шептать',
  машу: 'махать', машет: 'махать', помаши: 'махать',
  варю: 'варить', варит: 'варить', сварил: 'варить', сварить: 'варить',
  жарю: 'жарить', жарит: 'жарить', пожарил: 'жарить',
  налью: 'наливать', налей: 'наливать', налил: 'наливать', налить: 'наливать',
  кормлю: 'кормить', кормит: 'кормить', покорми: 'кормить', покормил: 'кормить',
  лечит: 'лечить', вылечил: 'лечить', вылечить: 'лечить',
  спасу: 'спасать', спас: 'спасать', спасла: 'спасать', спаси: 'спасать',
  защищаю: 'защищать', защитит: 'защищать', защити: 'защищать',
  одеваюсь: 'одеваться', одевается: 'одеваться', оденься: 'одеваться',
  снимаю: 'снимать', снимает: 'снимать', сними: 'снимать',
};

// Окончания для простого стемминга (длинные — первыми)
const ENDINGS = [
  'ами', 'ями', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ешь', 'ете', 'ишь', 'ите',
  'ует', 'уют', 'ает', 'ают', 'ит', 'им', 'ат', 'ят', 'ет', 'ем', 'ут', 'ют',
  'ов', 'ев', 'ей', 'ах', 'ях', 'ам', 'ям', 'ой', 'ый', 'ий', 'ая', 'яя', 'ое', 'ее',
  'ые', 'ие', 'ом', 'у', 'ю', 'а', 'я', 'о', 'е', 'ы', 'и', 'ь',
];

// Стемы лемм словаря (лемма без -ть / без последней гласной)
const STEMS: [string, string][] = Object.keys(WORDS).map((lemma) => {
  let stem = lemma;
  if (lemma.endsWith('ть') || lemma.endsWith('чь')) stem = lemma.slice(0, -2);
  else if (/[аяоеыиьй]$/.test(lemma)) stem = lemma.slice(0, -1);
  return [stem, lemma];
});
STEMS.sort((a, b) => b[0].length - a[0].length);

/** Словоформа → лемма словаря, либо null. */
export function resolveSignWord(token: string): string | null {
  if (WORDS[token]) return token;
  if (FORMS[token]) return FORMS[token];
  // Пробуем срезать окончание и найти лемму по стему
  const candidates = [token];
  for (const e of ENDINGS) {
    if (token.length > e.length + 2 && token.endsWith(e)) {
      candidates.push(token.slice(0, -e.length));
    }
  }
  for (const cand of candidates) {
    for (const [stem, lemma] of STEMS) {
      if (stem.length >= 3 && cand === stem) return lemma;
    }
  }
  return null;
}

// ——— Сборка жеста ———

const add = (a: Vec3, b?: Vec3): Vec3 =>
  b ? [a[0] + b[0], a[1] + b[1], a[2] + b[2]] : [...a];
const mirror = (v: Vec3): Vec3 => [v[0], -v[1], -v[2]];

interface PoseDelta {
  dArm?: Vec3;
  dWrist?: Vec3;
  shape?: HandShape;
}

function poseFrameBones(sign: WordSign, delta: PoseDelta = {}): Record<string, Vec3> {
  const loc = LOC[sign.loc];
  const shape = delta.shape ?? SHAPES[sign.shape];
  const arm = add(add(loc.arm, sign.dArm), delta.dArm);
  const fore = loc.fore;
  const wrist = add(add(loc.wrist, sign.dWrist), delta.dWrist);

  const bones: Record<string, Vec3> = {
    'mixamorig:RightArm': arm,
    'mixamorig:RightForeArm': fore,
    'mixamorig:RightHand': wrist,
    ...fingerJoints(shape, 'Right'),
  };
  if (sign.twoHand) {
    bones['mixamorig:LeftArm'] = mirror(arm);
    bones['mixamorig:LeftForeArm'] = mirror(fore);
    bones['mixamorig:LeftHand'] = mirror(wrist);
    Object.assign(bones, fingerJoints(shape, 'Left'));
  }
  return bones;
}

function restFrameBones(sign: WordSign): Record<string, Vec3> {
  const zero: Vec3 = [0, 0, 0];
  const bones: Record<string, Vec3> = {
    'mixamorig:RightArm': zero,
    'mixamorig:RightForeArm': zero,
    'mixamorig:RightHand': zero,
    ...fingerJoints({ curl: [0, 0, 0, 0, 0] }, 'Right'),
  };
  if (sign.twoHand) {
    bones['mixamorig:LeftArm'] = zero;
    bones['mixamorig:LeftForeArm'] = zero;
    bones['mixamorig:LeftHand'] = zero;
    Object.assign(bones, fingerJoints({ curl: [0, 0, 0, 0, 0] }, 'Left'));
  }
  return bones;
}

const RAISE = 0.45;
const LOWER = 0.55;

/** Кадры движения между tA и tB (базовая поза уже выставлена в tA). */
function motionSegment(sign: WordSign, tA: number): { frames: GestureFrame[]; tEnd: number } {
  const frames: GestureFrame[] = [];
  const reps = sign.reps ?? 2;
  const f = (delta: PoseDelta) => poseFrameBones(sign, delta);
  let tEnd = tA;

  const oscillate = (delta: PoseDelta, period: number) => {
    let t = tA;
    for (let i = 0; i < reps; i++) {
      t += period / 2;
      frames.push({ t, bones: f(delta) });
      t += period / 2;
      frames.push({ t, bones: f({}) });
    }
    tEnd = t;
  };

  switch (sign.motion) {
    case 'none':
      tEnd = tA + 0.7;
      frames.push({ t: tEnd, bones: f({}) });
      break;
    case 'tap':
      oscillate({ dArm: [0.12, 0, 0.1] }, 0.4);
      break;
    case 'shake':
      oscillate({ dWrist: [0, 0, 0.35] }, 0.36);
      break;
    case 'updown':
      oscillate({ dArm: [0.16, 0, 0] }, 0.44);
      break;
    case 'sway':
      oscillate({ dArm: [0, 0, 0.22] }, 0.5);
      break;
    case 'circle': {
      const r = 0.28;
      const steps: Vec3[] = [
        [r, 0, 0],
        [r, 0, r],
        [0, 0, r],
        [0, 0, 0],
      ];
      let t = tA;
      for (const s of steps) {
        t += 0.22;
        frames.push({ t, bones: f({ dWrist: s }) });
      }
      tEnd = t;
      break;
    }
    case 'push':
      tEnd = tA + 0.5;
      frames.push({ t: tEnd, bones: f({ dArm: [-0.3, 0, 0.15] }) });
      tEnd += 0.25;
      frames.push({ t: tEnd, bones: f({ dArm: [-0.3, 0, 0.15] }) });
      break;
    case 'pull':
      tEnd = tA + 0.5;
      frames.push({ t: tEnd, bones: f({ dArm: [0.25, 0, -0.2] }) });
      tEnd += 0.25;
      frames.push({ t: tEnd, bones: f({ dArm: [0.25, 0, -0.2] }) });
      break;
    case 'down':
      oscillate({ dArm: [0.3, 0, 0.1] }, 0.5);
      break;
    case 'up':
      oscillate({ dArm: [-0.28, 0, 0.05] }, 0.5);
      break;
    case 'twist': {
      let t = tA + 0.35;
      frames.push({ t, bones: f({ dWrist: [0, -0.7, 0] }) });
      t += 0.35;
      frames.push({ t, bones: f({}) });
      tEnd = t;
      break;
    }
    case 'apart':
      tEnd = tA + 0.55;
      frames.push({ t: tEnd, bones: f({ dArm: [0, 0, 0.35] }) });
      tEnd += 0.25;
      frames.push({ t: tEnd, bones: f({ dArm: [0, 0, 0.35] }) });
      break;
    case 'together':
      tEnd = tA + 0.55;
      frames.push({ t: tEnd, bones: f({ dArm: [0, 0, -0.3] }) });
      tEnd += 0.25;
      frames.push({ t: tEnd, bones: f({ dArm: [0, 0, -0.3] }) });
      break;
    case 'morph': {
      const s2 = SHAPES[sign.shape2 ?? 'open'];
      tEnd = tA + 0.55;
      frames.push({ t: tEnd, bones: f({ shape: s2, dArm: [-0.12, 0, 0.08] }) });
      tEnd += 0.3;
      frames.push({ t: tEnd, bones: f({ shape: s2, dArm: [-0.12, 0, 0.08] }) });
      break;
    }
  }
  return { frames, tEnd };
}

/** Собирает жест слова из словаря. */
export function buildWordGesture(lemma: string): GestureJSON | null {
  const sign = WORDS[lemma];
  if (!sign) return null;

  const frames: GestureFrame[] = [{ t: 0, bones: restFrameBones(sign) }];
  frames.push({ t: RAISE, bones: poseFrameBones(sign) });
  const { frames: motion, tEnd } = motionSegment(sign, RAISE);
  frames.push(...motion);
  frames.push({ t: tEnd + LOWER, bones: restFrameBones(sign) });

  return {
    name: `слово:${lemma}`,
    rotation_order: 'XYZ',
    unit: 'radians',
    description: `Жест «${lemma}» (процедурный, приближение к РЖЯ)`,
    frames,
  };
}

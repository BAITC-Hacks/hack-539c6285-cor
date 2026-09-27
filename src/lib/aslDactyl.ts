import * as tf from '@tensorflow/tfjs';
import { LEFT_HAND_OFFSET, RIGHT_HAND_OFFSET, NUM_HAND } from '@/lib/landmarks';

/**
 * ASL-дактиль: покадровое распознавание букв A-Z по одной кисти.
 *
 * Отдельная лёгкая голова (~1 МБ) рядом с основной моделью: Conv1D по
 * 63 координатам кисти MediaPipe, 29 классов (A-Z + DEL + NOTHING + SPACE).
 * Источник: huggingface.co/ademaulana/CNN-ASL-Alphabet-Sign-Recognition (MIT),
 * конверсия — ml/export_asl_tfjs.py, паритет — scripts/check-asl-parity.mjs.
 *
 * ИСТОРИЯ ВЕСОВ. Сначала здесь стояли веса автора модели — на независимой
 * проверке (416 эталонных кистей) они дали 21.6% и сваливались в букву X:
 * классическое переобучение под утёкший сплит. Текущие веса обучены нами
 * (ml/train_asl_head.py) на тех же эталонных кистях с аугментациями:
 * честная 5-fold кросс-валидация 87.3% ± 3.3.
 *
 * ВАЖНО про вход: обучение шло на НОРМАЛИЗОВАННОЙ кисти — центр в запястье,
 * масштаб = длина ладони (запястье -> пястье среднего пальца). Ровно эта же
 * нормализация обязана происходить здесь перед инференсом (normalizeHand),
 * иначе получится тот же провал, что у исходных весов.
 *
 * Решающий слой — та же логика, что у слов: удержание конфигурации несколько
 * тиков подряд коммитит букву, повтор той же буквы блокируется до «паузы»
 * (NOTHING) или другой буквы. DEL работает как backspace по чипам.
 */

/** Порог уверенности: ниже — конфигурация не показывается вовсе. */
const DISPLAY_CONF = 0.55;
/** Порог коммита буквы. */
const COMMIT_CONF = 0.75;
/** Сколько тиков подряд буква должна продержаться до коммита (~0.5 с). */
const COMMIT_TICKS = 4;
/** Сколько тиков NOTHING снимает блокировку повтора. */
const REARM_TICKS = 3;

export interface AslTickResult {
  /** Текущая устойчивая буква под камерой (для индикации), null — рука пуста. */
  letter: string | null;
  confidence: number;
  /** Прогресс удержания до коммита, 0..1. */
  progress: number;
  /** Закоммиченная на этом тике буква (или 'DEL'), null — ничего. */
  committed: string | null;
  /** Топ-5 букв с вероятностями — для боковой панели. */
  top: { label: string; confidence: number }[];
}

/** Индексы точек кисти MediaPipe: запястье и пястье среднего пальца. */
const WRIST = 0;
const MID_MCP = 9;

/**
 * Нормализация кисти — зеркало ml/train_asl_head.py: запястье в ноль,
 * деление на длину ладони по (x, y). Инвариант к позиции и удалённости
 * руки от камеры — то, чего не хватало исходным весам.
 */
function normalizeHand(hand: Float32Array): Float32Array {
  const out = new Float32Array(63);
  const wx = hand[WRIST * 3], wy = hand[WRIST * 3 + 1], wz = hand[WRIST * 3 + 2];
  const mx = hand[MID_MCP * 3] - wx;
  const my = hand[MID_MCP * 3 + 1] - wy;
  const scale = Math.max(Math.hypot(mx, my), 1e-6);
  for (let i = 0; i < 21; i++) {
    out[i * 3] = (hand[i * 3] - wx) / scale;
    out[i * 3 + 1] = (hand[i * 3 + 1] - wy) / scale;
    out[i * 3 + 2] = (hand[i * 3 + 2] - wz) / scale;
  }
  return out;
}

export class AslDactyl {
  private model: tf.LayersModel;
  private labels: string[];
  private candidate = '';
  private ticks = 0;
  private blocked = '';
  private nothingStreak = 0;

  private constructor(model: tf.LayersModel, labels: string[]) {
    this.model = model;
    this.labels = labels;
  }

  static async load(): Promise<AslDactyl> {
    const [model, labels] = await Promise.all([
      tf.loadLayersModel('/model/asl_dactyl/model.json'),
      fetch('/model/asl_dactyl/labels.json').then((r) => r.json()),
    ]);
    return new AslDactyl(model, labels);
  }

  /** Сбросить решающее состояние (старт/стоп камеры, смена режима). */
  reset() {
    this.candidate = '';
    this.ticks = 0;
    this.blocked = '';
    this.nothingStreak = 0;
  }

  /**
   * Один тик: кадр 255 -> буква. Правая кисть как есть; если её нет —
   * левая, отражённая по x (модель обучена на правой руке).
   */
  tick(frame: Float32Array): AslTickResult | null {
    const hand = new Float32Array(NUM_HAND * 3);
    let alive = false;
    for (let i = 0; i < NUM_HAND * 3; i++) {
      hand[i] = frame[RIGHT_HAND_OFFSET + i];
      if (hand[i] !== 0) alive = true;
    }
    if (!alive) {
      for (let i = 0; i < NUM_HAND; i++) {
        const x = frame[LEFT_HAND_OFFSET + i * 3];
        const y = frame[LEFT_HAND_OFFSET + i * 3 + 1];
        const z = frame[LEFT_HAND_OFFSET + i * 3 + 2];
        if (x !== 0 || y !== 0) alive = true;
        hand[i * 3] = x === 0 ? 0 : 1 - x;   // зеркало: левая становится правой
        hand[i * 3 + 1] = y;
        hand[i * 3 + 2] = z;
      }
    }
    if (!alive) {
      // Руки нет — это пауза между буквами, снимаем блокировку.
      this.nothingStreak += 1;
      if (this.nothingStreak >= REARM_TICKS) this.blocked = '';
      this.candidate = '';
      this.ticks = 0;
      return null;
    }

    const probs = tf.tidy(() => {
      const x = tf.tensor(normalizeHand(hand), [1, 63, 1]);
      return (this.model.predict(x) as tf.Tensor).dataSync();
    });

    const order = Array.from(probs)
      .map((p, i) => ({ label: this.labels[i], confidence: p }))
      .sort((a, b) => b.confidence - a.confidence);
    const top = order.filter((o) => o.label.length === 1).slice(0, 5);
    const best = order[0];

    if (best.label === 'NOTHING' || best.confidence < DISPLAY_CONF) {
      this.nothingStreak += 1;
      if (this.nothingStreak >= REARM_TICKS) this.blocked = '';
      this.candidate = '';
      this.ticks = 0;
      return { letter: null, confidence: best.confidence, progress: 0, committed: null, top };
    }
    this.nothingStreak = 0;

    // SPACE не буква: показываем как паузу, она же снимает блокировку.
    if (best.label === 'SPACE') {
      this.blocked = '';
      this.candidate = '';
      this.ticks = 0;
      return { letter: null, confidence: best.confidence, progress: 0, committed: null, top };
    }

    // Другая устойчивая буква тоже перевзводит повтор.
    if (best.label !== this.blocked && this.blocked && best.confidence >= COMMIT_CONF) {
      this.blocked = '';
    }
    if (best.label === this.blocked) {
      return { letter: best.label, confidence: best.confidence, progress: 0, committed: null, top };
    }

    if (best.confidence >= COMMIT_CONF) {
      if (this.candidate === best.label) this.ticks += 1;
      else { this.candidate = best.label; this.ticks = 1; }
    } else {
      this.candidate = best.label;
      this.ticks = 0;
    }

    if (this.ticks >= COMMIT_TICKS) {
      this.blocked = this.candidate;
      const committed = this.candidate;
      this.candidate = '';
      this.ticks = 0;
      return { letter: best.label, confidence: best.confidence, progress: 1, committed, top };
    }
    return {
      letter: best.label,
      confidence: best.confidence,
      progress: Math.min(this.ticks / COMMIT_TICKS, 1),
      committed: null,
      top,
    };
  }
}

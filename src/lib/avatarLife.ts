import * as THREE from 'three';

/**
 * Живость аватара: лицо и дыхание.
 *
 * Сурдопереводчика-человека отличают от «манекена с руками» три вещи:
 * артикуляция губ (глухие зрители читают её параллельно жесту — это
 * полноценный канал смысла в РЖЯ), моргание и дыхание. Аватар с идеальными
 * руками, но мёртвым лицом читается хуже, чем человек с посредственными
 * руками. Морфы для всего этого в avatar.glb есть с самого начала
 * (15 виземов Oculus + eyeBlink + mouthSmile) — этот модуль их оживляет.
 *
 * Модуль не трогает кости рук и не знает о GesturePlayer: лицо и тело
 * анимируются поверх, в конце кадра.
 */

/**
 * Буква -> визем Oculus. Артикуляция не фонетически точная (для этого нужен
 * настоящий G2P), а «как проговаривают слово губами»: гласные держатся
 * дольше, согласные — короткие смычки. Для чтения с губ этого достаточно:
 * зритель опирается на контур слова, не на точную фонему.
 */
const VISEME_BY_LETTER: Record<string, string> = {
  а: 'viseme_aa', я: 'viseme_aa',
  о: 'viseme_O', ё: 'viseme_O',
  у: 'viseme_U', ю: 'viseme_U',
  э: 'viseme_E', е: 'viseme_E',
  и: 'viseme_I', ы: 'viseme_I', й: 'viseme_I',
  б: 'viseme_PP', п: 'viseme_PP', м: 'viseme_PP',
  в: 'viseme_FF', ф: 'viseme_FF',
  с: 'viseme_SS', з: 'viseme_SS', ц: 'viseme_SS',
  ч: 'viseme_CH', ш: 'viseme_CH', щ: 'viseme_CH', ж: 'viseme_CH',
  т: 'viseme_DD', д: 'viseme_DD',
  н: 'viseme_nn', л: 'viseme_nn',
  р: 'viseme_RR',
  к: 'viseme_kk', г: 'viseme_kk', х: 'viseme_kk',
};

const VOWELS = new Set(['а', 'я', 'о', 'ё', 'у', 'ю', 'э', 'е', 'и', 'ы']);

/** Отрезок артикуляции: какой визем держать в [start, end]. */
interface VisemeSegment {
  start: number;
  end: number;
  viseme: string;
}

const BLINK_DURATION = 0.16;
const SMILE_IDLE = 0.18;     // лёгкая доброжелательность, не «улыбка до ушей»
const SMILE_SPEAKING = 0.08; // во время артикуляции рот занят виземами
const VISEME_MAX = 0.85;

/**
 * У аватаров разная номенклатура морфов: Ева (RPM) — Oculus-виземы
 * (viseme_aa, eyeBlinkLeft, mouthSmile), Адам (Rodin) — свои
 * (viseme_A, viseme_MBP, blink.L, smile). Каждый канонический ключ
 * перечисляет синонимы; при создании берём первый найденный в словаре меша.
 * Чего у аватара нет (у Адама нет согласных SS/CH/DD…) — просто молчит.
 */
const MORPH_ALIASES: Record<string, string[]> = {
  viseme_aa: ['viseme_aa', 'viseme_A'],
  viseme_E: ['viseme_E'],
  viseme_I: ['viseme_I'],
  viseme_O: ['viseme_O'],
  viseme_U: ['viseme_U'],
  viseme_PP: ['viseme_PP', 'viseme_MBP'],
  viseme_FF: ['viseme_FF', 'viseme_FV'],
  viseme_SS: ['viseme_SS'],
  viseme_CH: ['viseme_CH'],
  viseme_DD: ['viseme_DD'],
  viseme_nn: ['viseme_nn'],
  viseme_RR: ['viseme_RR'],
  viseme_kk: ['viseme_kk'],
  blinkL: ['eyeBlinkLeft', 'blink.L'],
  blinkR: ['eyeBlinkRight', 'blink.R'],
  smile: ['mouthSmile', 'smile'],
};

function smoothstep(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}

interface FaceMesh {
  influences: number[];
  /** канонический ключ -> индекс морфа этого меша */
  map: Map<string, number>;
}

export class AvatarFace {
  private meshes: FaceMesh[] = [];
  private nextBlink = 0;
  private blinkStart = -Infinity;
  private segments: VisemeSegment[] = [];

  constructor(root: THREE.Object3D) {
    root.traverse((obj) => {
      const m = obj as THREE.SkinnedMesh;
      if (!m.morphTargetInfluences || !m.morphTargetDictionary) return;
      const map = new Map<string, number>();
      for (const [key, aliases] of Object.entries(MORPH_ALIASES)) {
        for (const alias of aliases) {
          const idx = m.morphTargetDictionary[alias];
          if (idx !== undefined) {
            map.set(key, idx);
            break;
          }
        }
      }
      if (map.size) this.meshes.push({ influences: m.morphTargetInfluences, map });
    });
  }

  hasMorphs(): boolean {
    return this.meshes.length > 0;
  }

  /**
   * Проговорить слово губами за время жеста. Кривая веса каждого визема —
   * плавный вход/выход, гласные держатся примерно вдвое дольше согласных.
   */
  say(word: string, duration: number) {
    const now = performance.now() / 1000;
    const letters = word.toLowerCase().split('').filter((ch) => VISEME_BY_LETTER[ch]);
    if (!letters.length || duration < 0.1) {
      this.segments = [];
      return;
    }
    // Артикуляция занимает начало жеста и не растягивается на весь долгий
    // клип: человек проговаривает слово в своём темпе, а не тянет «п-р-и-в-е-т»
    // три секунды.
    const speakTime = Math.min(duration * 0.8, 0.16 * letters.length + 0.2);
    const units = letters.map((ch) => (VOWELS.has(ch) ? 1.8 : 1));
    const totalUnits = units.reduce((a, b) => a + b, 0);
    let t = now + 0.05;
    this.segments = letters.map((ch, i) => {
      const seg = { start: t, end: t + (speakTime * units[i]) / totalUnits, viseme: VISEME_BY_LETTER[ch] };
      t = seg.end;
      return seg;
    });
  }

  /** Замолчать (рот в нейтраль). */
  quiet() {
    this.segments = [];
  }

  update(now: number) {
    if (!this.meshes.length) return;

    // Моргание: раз в 2.5–5.5 секунд, двойное веко, 160 мс.
    if (now >= this.nextBlink) {
      this.blinkStart = now;
      this.nextBlink = now + 2.5 + Math.random() * 3;
    }
    const blinkPhase = (now - this.blinkStart) / BLINK_DURATION;
    const blink = blinkPhase >= 0 && blinkPhase <= 1 ? Math.sin(Math.PI * blinkPhase) : 0;

    // Виземы активных отрезков (с плавным входом и выходом по четверти длины).
    const visemeWeights = new Map<string, number>();
    let speaking = false;
    for (const seg of this.segments) {
      if (now < seg.start || now > seg.end + 0.08) continue;
      speaking = true;
      const len = seg.end - seg.start;
      const attack = smoothstep((now - seg.start) / (len * 0.35));
      const release = smoothstep((seg.end + 0.08 - now) / (len * 0.35 + 0.08));
      const w = Math.min(attack, release) * VISEME_MAX;
      visemeWeights.set(seg.viseme, Math.max(visemeWeights.get(seg.viseme) ?? 0, w));
    }
    if (this.segments.length && now > this.segments[this.segments.length - 1].end + 0.3) {
      this.segments = [];
    }

    const smile = speaking ? SMILE_SPEAKING : SMILE_IDLE;

    for (const { influences, map } of this.meshes) {
      for (const [key, idx] of map) {
        if (key.startsWith('viseme_')) {
          influences[idx] = visemeWeights.get(key) ?? 0;
        } else if (key === 'blinkL' || key === 'blinkR') {
          influences[idx] = blink;
        } else if (key === 'smile') {
          // Плавно, чтобы улыбка не щёлкала при старте/конце слова.
          influences[idx] += (smile - influences[idx]) * 0.08;
        }
      }
    }
  }
}

/**
 * Дыхание и еле заметное покачивание в покое.
 *
 * Пока плеер стоит, пишет АБСОЛЮТНЫЕ углы (база, снятая при создании, плюс
 * синус) — не накапливает. Во время жеста амплитуда плавно гасится до нуля, и
 * пока она гаснет, дыхание ложится ПОВЕРХ позы плеера (он каждый кадр ставит
 * кости сам, так что прибавка не копится). Иначе абсолютная запись полторы
 * секунды затирала бы наклон головы из жеста — например, поднятый подбородок
 * вопроса, — а потом голова дёргалась бы в позу жеста.
 */
const BREATH_BONES: [string, number, number, number][] = [
  // имя кости, амплитуда X (наклон вперёд), частота, фаза
  ['mixamorigSpine1', 0.010, 1.55, 0],
  ['mixamorigSpine2', 0.014, 1.55, 0.15],
  ['mixamorigNeck', 0.008, 1.55, 0.5],
];
const HEAD_BONE = 'mixamorigHead';

/** В Blender кости зовутся `mixamorig:Spine2`, glTF-экспорт двоеточие съедает. */
function findBone(bones: Map<string, THREE.Bone>, name: string): THREE.Bone | undefined {
  return bones.get(name) ?? bones.get(name.replace('mixamorig', 'mixamorig:'));
}

export class IdleBody {
  private base = new Map<string, THREE.Euler>();
  private resolved = new Map<string, THREE.Bone>();
  private amp = 0;

  constructor(bones: Map<string, THREE.Bone>) {
    for (const name of [...BREATH_BONES.map(([n]) => n), HEAD_BONE]) {
      const b = findBone(bones, name);
      if (b) {
        this.resolved.set(name, b);
        this.base.set(name, b.rotation.clone());
      }
    }
  }

  /**
   * @param idle        ничего не показывается — дыхание на полную
   * @param playerPosed плеер в этом кадре сам выставил кости (GesturePlayer.drivesBones)
   */
  update(now: number, idle: boolean, playerPosed = false) {
    this.amp += ((idle ? 1 : 0) - this.amp) * 0.05;
    if (this.amp < 0.01) return;

    for (const [name, ax, freq, phase] of BREATH_BONES) {
      const bone = this.resolved.get(name);
      const base = this.base.get(name);
      if (!bone || !base) continue;
      bone.rotation.x = (playerPosed ? bone.rotation.x : base.x) + Math.sin(now * freq + phase) * ax * this.amp;
    }
    const head = this.resolved.get(HEAD_BONE);
    const headBase = this.base.get(HEAD_BONE);
    if (head && headBase) {
      // Медленный микро-поворот головы: живой взгляд, а не сканирующий робот.
      head.rotation.y = (playerPosed ? head.rotation.y : headBase.y) + Math.sin(now * 0.27) * 0.02 * this.amp;
      head.rotation.x = (playerPosed ? head.rotation.x : headBase.x) + Math.sin(now * 0.21 + 1.3) * 0.012 * this.amp;
    }
  }
}

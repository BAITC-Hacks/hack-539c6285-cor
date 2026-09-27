import * as THREE from 'three';
import { resolveBone } from './avatarBoneMap';
import { STANCE_ARM_X, IDLE_ARM_X } from './avatarLoader';

export interface GestureFrame {
  t: number;
  bones: Record<string, [number, number, number]>;
}

export interface GestureJSON {
  name: string;
  rotation_order?: string;
  unit?: string;
  description?: string;
  frames: GestureFrame[];
}

export class GesturePlayer {
  private bones: Map<string, THREE.Bone>;
  /** База жестов: поза, относительно которой заданы дельты во всех анимациях. */
  private restRotations = new Map<string, THREE.Euler>();
  /**
   * Поза покоя для показа: как аватар стоит, когда ничего не играет.
   *
   * Отличается от базы только разворотом плеч (IDLE_ARM_X против STANCE_ARM_X).
   * Разделено намеренно: при 1.25 рад руки развешены на 1.97 ширины плеч против
   * человеческих 1.1–1.3, и это читается как раздутые плечи. Поправить показ,
   * сдвинув базу, нельзя — уехали бы все 966 клипов SLOVO и весь процедурный
   * словарь, потому что кадр кладётся как `rest + дельта`.
   */
  private idleRotations = new Map<string, THREE.Euler>();
  private gesture: GestureJSON | null = null;
  private startWallClock = 0;
  private playing = false;
  public speed = 1;
  public loop = true;
  public onEnd: (() => void) | null = null;

  /**
   * Плавный вход в жест и возврат в покой.
   *
   * Без этого первый кадр жеста ставится скачком из любой позы — на смене
   * слов в фразе руки телепортируются. Человек так не двигается, и скачок
   * рвёт зрителю слитность показа. Вход — слерп из позы на момент load(),
   * выход — слерп из последнего кадра в позу покоя.
   */
  private blendFrom = new Map<string, THREE.Quaternion>();
  private blendStart = -Infinity;
  private returning = false;
  private static readonly BLEND_IN = 0.18;
  private static readonly BLEND_OUT = 0.3;

  constructor(bones: Map<string, THREE.Bone>) {
    this.bones = bones;
    for (const [name, bone] of bones) {
      this.restRotations.set(name, bone.rotation.clone());
      this.idleRotations.set(name, bone.rotation.clone());
    }
    // Поза покоя = база плюс доворот плеч. Загрузчик уже применил STANCE_ARM_X,
    // поэтому здесь добавляется только разница.
    const dArm = IDLE_ARM_X - STANCE_ARM_X;
    for (const armBone of ['i', '13']) {
      const idle = this.idleRotations.get(armBone);
      if (idle) idle.x += dArm;
    }
    this.resetToIdle();
  }

  load(gesture: GestureJSON) {
    this.snapshotBlendFrom();
    this.gesture = gesture;
    this.startWallClock = performance.now() / 1000;
    this.blendStart = this.startWallClock;
    this.returning = false;
    this.playing = true;
  }

  stop() {
    // Всегда доезжаем в покой слерпом за BLEND_OUT (без телепорта). Вызов
    // в уже стоящей позе безвреден: бленд из покоя в покой ничего не меняет.
    this.snapshotBlendFrom();
    this.blendStart = performance.now() / 1000;
    this.returning = true;
    this.playing = false;
  }

  private snapshotBlendFrom() {
    for (const [name, bone] of this.bones) {
      const q = this.blendFrom.get(name);
      if (q) q.copy(bone.quaternion);
      else this.blendFrom.set(name, bone.quaternion.clone());
    }
  }

  /** Слерп всех костей из снятой позы к только что выставленной. k=1 — цель. */
  private applyBlend(k: number) {
    const s = k * k * (3 - 2 * k);
    for (const [name, bone] of this.bones) {
      const from = this.blendFrom.get(name);
      if (!from) continue;
      _target.copy(bone.quaternion);
      bone.quaternion.copy(from).slerp(_target, s);
    }
  }

  /** Вернуть скелет в БАЗУ жестов (нужна перед наложением кадра). */
  resetToRest() {
    for (const [name, bone] of this.bones) {
      const r = this.restRotations.get(name);
      if (r) bone.rotation.copy(r);
    }
  }

  /** Вернуть скелет в позу покоя ДЛЯ ПОКАЗА — руки вдоль тела. */
  resetToIdle() {
    for (const [name, bone] of this.bones) {
      const r = this.idleRotations.get(name);
      if (r) bone.rotation.copy(r);
    }
  }

  isPlaying() {
    return this.playing;
  }

  /**
   * Выставил ли плеер кости в этом кадре сам (жест или возврат в покой).
   * Тогда всё, что пишут поверх (дыхание), ложится на свежую позу, а не копится.
   */
  drivesBones() {
    return this.playing || this.returning;
  }

  currentName(): string | null {
    return this.gesture?.name ?? null;
  }

  update() {
    const nowSec = performance.now() / 1000;

    // Возврат в покой после stop(): слерп из позы на момент остановки.
    if (this.returning) {
      const k = (nowSec - this.blendStart) / GesturePlayer.BLEND_OUT;
      this.resetToIdle();
      if (k < 1) {
        this.applyBlend(k);
      } else {
        this.returning = false;
      }
      return;
    }

    if (!this.playing || !this.gesture || this.gesture.frames.length === 0) return;

    const duration = this.gesture.frames[this.gesture.frames.length - 1].t;
    let t = (performance.now() / 1000 - this.startWallClock) * this.speed;

    if (t >= duration) {
      if (this.loop) {
        // На повторе тоже без телепорта: последний кадр -> первый через слерп.
        this.snapshotBlendFrom();
        this.startWallClock = nowSec;
        this.blendStart = nowSec;
        t = 0;
      } else {
        t = duration;
        this.playing = false;
        this.onEnd?.();
      }
    }

    const frames = this.gesture.frames;
    let i = 0;
    while (i < frames.length - 1 && frames[i + 1].t <= t) i++;

    const a = frames[i];
    const b = frames[Math.min(i + 1, frames.length - 1)];
    const span = Math.max(b.t - a.t, 1e-6);
    const alpha = Math.min(Math.max((t - a.t) / span, 0), 1);

    this.resetToRest();

    for (const jsonName of Object.keys(a.bones)) {
      const entry = resolveBone(jsonName);
      const bone = this.bones.get(entry.target);
      if (!bone) continue;

      const ra = a.bones[jsonName];
      const rb = b.bones[jsonName] ?? ra;
      const [fx, fy, fz] = entry.axisFlip ?? [1, 1, 1];

      const rx = (ra[0] + (rb[0] - ra[0]) * alpha) * fx;
      const ry = (ra[1] + (rb[1] - ra[1]) * alpha) * fy;
      const rz = (ra[2] + (rb[2] - ra[2]) * alpha) * fz;

      const rest = this.restRotations.get(entry.target);
      if (rest) {
        bone.rotation.set(rest.x + rx, rest.y + ry, rest.z + rz, 'XYZ');
      } else {
        bone.rotation.set(rx, ry, rz, 'XYZ');
      }
    }

    // Плавный вход: первые BLEND_IN секунд доезжаем из позы на момент load().
    const kIn = (nowSec - this.blendStart) / GesturePlayer.BLEND_IN;
    if (kIn < 1) this.applyBlend(kIn);
  }
}

const _target = new THREE.Quaternion();

export async function fetchGesture(name: string): Promise<GestureJSON> {
  const res = await fetch(`/gestures/${name}.json`);
  if (!res.ok) throw new Error(`Failed to load gesture ${name}`);
  return res.json();
}

export async function listGestures(): Promise<string[]> {
  try {
    const res = await fetch('/gestures/index.json');
    if (res.ok) {
      const arr = await res.json();
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch {
    /* ignore */
  }
  return [];
}

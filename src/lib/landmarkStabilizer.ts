/**
 * Стабилизация лэндмарков MediaPipe между трекером и отрисовкой/классификатором.
 *
 * Слои (каждый можно выключить в конфиге):
 *  1. One Euro Filter — независимо по x/y/z каждой точки. В покое давит дрожь,
 *     при быстром движении почти не отстаёт (частота среза растёт со скоростью).
 *  2. Отсев физически невозможных скачков — смещение точки за кадр сравнивается
 *     с порогом из dt и размера кисти. Одиночный выброс заменяется предсказанием
 *     по скорости. Если «прыгнула» вся кисть и новое место подтверждается
 *     jumpConfirmFrames кадров подряд — это настоящее быстрое движение:
 *     принимаем без лага (фильтры сбрасываются на новое место).
 *  3. Экстраполяция при потере — кисть не вернулась из трекера: продолжаем по
 *     последней скорости (с затуханием) extrapolateFrames кадров, затем плавно
 *     гасим (alpha → 0) fadeMs и только потом убираем.
 *  4. Кинематика — длины костей кисти калибруются по первым кадрам (как доля
 *     размера ладони) и удерживаются в диапазоне boneClamp: шум в одной точке
 *     не может растянуть или сжать палец.
 *
 * Модель распознавания эти данные по умолчанию НЕ получает: фильтр стоит между
 * трекером и отрисовкой; подача в классификатор — отдельный флаг у вызывающего
 * кода (обучение шло на сырых точках).
 *
 * Без зависимостей; работает в браузере и в node (тесты: scripts/check-stabilizer.mjs).
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type TrackStatus = 'none' | 'tracked' | 'rejected' | 'extrapolated' | 'fading';

export interface StabilizerConfig {
  /** One Euro: базовая частота среза, Гц. Меньше — глаже в покое, но больше лаг. */
  minCutoff: number;
  /** One Euro: чувствительность к скорости. Больше — меньше лаг на быстрых движениях, больше дрожь. */
  beta: number;
  /** One Euro: частота среза для оценки скорости. */
  dCutoff: number;
  /** Отсев скачков: допустимая скорость точки, доли кадра в секунду (0..1 по ширине кадра). */
  maxSpeed: number;
  /** Отсев скачков: порог за кадр не меньше k × размер кисти (запястье → основание среднего пальца). */
  jumpHandScale: number;
  /** Сколько подряд кадров новое положение всей кисти должно подтвердиться, чтобы принять «прыжок». */
  jumpConfirmFrames: number;
  /** visibility ниже порога → точка считается пропавшей (Holistic для кистей visibility не отдаёт; работает для позы). */
  minConfidence: number;
  /** Сколько кадров экстраполировать по скорости, когда набор пропал. */
  extrapolateFrames: number;
  /** Затухание скорости на каждом экстраполированном кадре. */
  velocityDecay: number;
  /** После экстраполяции: сколько мс плавно гасить (alpha 1 → 0), удерживая позу. */
  fadeMs: number;
  /** Допустимая длина кости относительно калибровки: [min, max]. */
  boneClamp: [number, number];
  /** Кадров для калибровки длин костей. */
  calibFrames: number;
  enableFilter: boolean;
  enableJumpReject: boolean;
  enableExtrapolation: boolean;
  enableBoneConstraints: boolean;
}

export const DEFAULT_CONFIG: StabilizerConfig = {
  minCutoff: 1.0,
  beta: 4.0,
  dCutoff: 1.0,
  maxSpeed: 4.0,
  jumpHandScale: 1.2,
  jumpConfirmFrames: 2,
  minConfidence: 0.3,
  extrapolateFrames: 6,
  velocityDecay: 0.8,
  fadeMs: 400,
  boneClamp: [0.6, 1.45],
  calibFrames: 30,
  enableFilter: true,
  enableJumpReject: true,
  enableExtrapolation: true,
  enableBoneConstraints: true,
};

/** Кости кисти MediaPipe (21 точка) от запястья — родитель всегда раньше ребёнка. */
export const HAND_BONES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
];
/** Кость, задающая масштаб кисти: запястье → основание среднего пальца. */
export const HAND_PALM_BONE: [number, number] = [0, 9];

const MIN_DT = 1 / 120;
const MAX_DT = 0.25;

// ---------------------------------------------------------------- One Euro
class LowPass {
  private y = 0;
  private has = false;
  filter(x: number, alpha: number): number {
    this.y = this.has ? alpha * x + (1 - alpha) * this.y : x;
    this.has = true;
    return this.y;
  }
  set(x: number) { this.y = x; this.has = true; }
  get value() { return this.y; }
  reset() { this.has = false; }
}

/** One Euro Filter (Casiez, Roussel, Vogel 2012) для одного скаляра. */
export class OneEuroFilter {
  private x = new LowPass();
  private dx = new LowPass();
  private tPrev: number | null = null;
  constructor(public cfg: Pick<StabilizerConfig, 'minCutoff' | 'beta' | 'dCutoff'>) {}

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  /** @param t время в секундах */
  filter(value: number, t: number): number {
    if (this.tPrev === null) {
      this.tPrev = t;
      this.dx.set(0);
      return this.x.filter(value, 1);
    }
    const dt = Math.min(MAX_DT, Math.max(MIN_DT, t - this.tPrev));
    this.tPrev = t;
    const dRaw = (value - this.x.value) / dt;
    const dHat = this.dx.filter(dRaw, OneEuroFilter.alpha(this.cfg.dCutoff, dt));
    const cutoff = this.cfg.minCutoff + this.cfg.beta * Math.abs(dHat);
    return this.x.filter(value, OneEuroFilter.alpha(cutoff, dt));
  }

  /** Поставить фильтр в значение (после подтверждённого скачка / экстраполяции). */
  set(value: number, t: number) { this.x.set(value); this.dx.set(0); this.tPrev = t; }
  reset() { this.x.reset(); this.dx.reset(); this.tPrev = null; }
}

// ---------------------------------------------------------------- набор точек
export interface StabilizedSet {
  points: Landmark[] | null;
  status: TrackStatus;
  /** 1 — уверенно; при затухании плавно к 0. */
  alpha: number;
  /** Сколько точек отброшено как скачок в этом кадре. */
  rejected: number;
}

interface SetOptions {
  bones?: Array<[number, number]>;
  scaleBone?: [number, number];
}

const dist3 = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const median = (v: number[]) => { const s = [...v].sort((p, q) => p - q); return s[s.length >> 1]; };

/** Стабилизатор одного набора точек (кисть 21, поза 33 …). Времена — мс performance.now(). */
export class LandmarkStabilizer {
  private fx: OneEuroFilter[] = [];
  private fy: OneEuroFilter[] = [];
  private fz: OneEuroFilter[] = [];
  private points: Landmark[] | null = null;
  private vel: Landmark[] = [];
  private tPrev = 0;
  private missing = 0;
  private fadeStart = 0;
  private pending: Landmark[] | null = null;
  private pendingCount = 0;
  private calib: number[][] = [];
  private boneRatio: number[] | null = null;
  status: TrackStatus = 'none';

  constructor(public readonly n: number, public cfg: StabilizerConfig = DEFAULT_CONFIG,
              private readonly opts: SetOptions = {}) {
    for (let i = 0; i < n; i++) {
      this.fx.push(new OneEuroFilter(cfg)); this.fy.push(new OneEuroFilter(cfg)); this.fz.push(new OneEuroFilter(cfg));
      this.vel.push({ x: 0, y: 0, z: 0 });
    }
  }

  setConfig(cfg: StabilizerConfig) {
    this.cfg = cfg;
    for (let i = 0; i < this.n; i++) { this.fx[i].cfg = cfg; this.fy[i].cfg = cfg; this.fz[i].cfg = cfg; }
  }

  /** Сбросить и калибровку костей тоже (например, при смене человека). */
  recalibrate() { this.calib = []; this.boneRatio = null; }

  reset() {
    this.points = null; this.status = 'none'; this.missing = 0; this.pending = null; this.pendingCount = 0;
    for (let i = 0; i < this.n; i++) {
      this.fx[i].reset(); this.fy[i].reset(); this.fz[i].reset(); this.vel[i] = { x: 0, y: 0, z: 0 };
    }
  }

  private scaleOf(p: Landmark[]): number {
    const sb = this.opts.scaleBone;
    if (!sb) return 1;
    return Math.max(1e-4, dist3(p[sb[0]], p[sb[1]]));
  }

  private snapTo(raw: Landmark[], t: number) {
    this.points = raw.map((p) => ({ x: p.x, y: p.y, z: p.z }));
    for (let i = 0; i < this.n; i++) {
      this.fx[i].set(raw[i].x, t); this.fy[i].set(raw[i].y, t); this.fz[i].set(raw[i].z, t);
      this.vel[i] = { x: 0, y: 0, z: 0 };
    }
  }

  private applyBones(p: Landmark[]) {
    const bones = this.opts.bones;
    if (!bones || !this.cfg.enableBoneConstraints) return;
    const scale = this.scaleOf(p);
    if (!this.boneRatio) {
      this.calib.push(bones.map(([a, b]) => dist3(p[a], p[b]) / scale));
      if (this.calib.length >= this.cfg.calibFrames) {
        this.boneRatio = bones.map((_, k) => median(this.calib.map((row) => row[k])));
      }
      return;
    }
    const [lo, hi] = this.cfg.boneClamp;
    bones.forEach(([a, b], k) => {
      const ref = this.boneRatio![k] * scale;
      const dx = p[b].x - p[a].x, dy = p[b].y - p[a].y, dz = p[b].z - p[a].z;
      const len = Math.hypot(dx, dy, dz);
      if (len < 1e-6) return;
      const target = len < ref * lo ? ref * lo : len > ref * hi ? ref * hi : len;
      if (target !== len) {
        const s = target / len;
        p[b] = { x: p[a].x + dx * s, y: p[a].y + dy * s, z: p[a].z + dz * s };
      }
    });
  }

  /**
   * @param raw точки из трекера (или null/undefined, если набор не найден)
   * @param tMs время кадра, мс
   */
  update(raw: Landmark[] | null | undefined, tMs: number): StabilizedSet {
    const t = tMs / 1000;
    const dt = this.points ? Math.min(MAX_DT, Math.max(MIN_DT, t - this.tPrev)) : 1 / 30;
    const cfg = this.cfg;
    let input: Array<Landmark | null> | null = raw && raw.length === this.n ? raw : null;
    if (input && cfg.minConfidence > 0) {
      input = input.map((p) => (p && p.visibility !== undefined && p.visibility < cfg.minConfidence ? null : p));
      if (input.every((p) => p === null)) input = null;
    }

    if (!input) return this.onMissing(t, dt);

    this.missing = 0;
    if (!this.points) {
      if (input.some((p) => p === null)) return this.onMissing(t, dt);
      this.snapTo(input as Landmark[], t);
      this.tPrev = t; this.status = 'tracked';
      this.applyBones(this.points!);
      return { points: this.points, status: this.status, alpha: 1, rejected: 0 };
    }

    // предсказание по скорости — база для отсева скачков и замена выбросов
    const pred = this.points.map((p, i) => ({
      x: p.x + this.vel[i].x * dt, y: p.y + this.vel[i].y * dt, z: p.z + this.vel[i].z * dt,
    }));
    let rejectedMask: boolean[] = input.map(() => false);
    if (cfg.enableJumpReject) {
      const scale = this.scaleOf(input.map((p, i) => p ?? pred[i]));
      const thresh = Math.max(cfg.maxSpeed * dt, cfg.jumpHandScale * scale);
      rejectedMask = input.map((p, i) => !!p && Math.hypot(p.x - pred[i].x, p.y - pred[i].y) > thresh);
      const nRej = rejectedMask.filter(Boolean).length;
      if (nRej > this.n / 2) {
        // скачок всего набора: настоящее движение или мусор трекера?
        const cur = input.map((p, i) => p ?? pred[i]);
        const near = !!this.pending && this.pending.every((q, i) => Math.hypot(q.x - cur[i].x, q.y - cur[i].y) <= thresh);
        if (near) this.pendingCount++; else { this.pending = cur.map((p) => ({ ...p })); this.pendingCount = 1; }
        if (this.pendingCount >= cfg.jumpConfirmFrames) {
          this.pending = null; this.pendingCount = 0;
          this.snapTo(cur, t); this.tPrev = t; this.status = 'tracked';
          this.applyBones(this.points!);
          return { points: this.points, status: 'tracked', alpha: 1, rejected: 0 };
        }
        this.status = 'rejected';
        this.commit(pred, t, dt, false);
        return { points: this.points, status: 'rejected', alpha: 1, rejected: nRej };
      }
      this.pending = null; this.pendingCount = 0;
    }

    const src = input.map((p, i) => (!p || rejectedMask[i] ? pred[i] : p));
    const out = cfg.enableFilter
      ? src.map((p, i) => ({ x: this.fx[i].filter(p.x, t), y: this.fy[i].filter(p.y, t), z: this.fz[i].filter(p.z, t) }))
      : src.map((p) => ({ x: p.x, y: p.y, z: p.z }));
    this.status = 'tracked';
    this.commit(out, t, dt, true);
    this.applyBones(this.points!);
    return { points: this.points, status: 'tracked', alpha: 1, rejected: rejectedMask.filter(Boolean).length };
  }

  private commit(out: Landmark[], t: number, dt: number, updateVel: boolean) {
    const prev = this.points!;
    if (updateVel) {
      for (let i = 0; i < this.n; i++) {
        const vx = (out[i].x - prev[i].x) / dt, vy = (out[i].y - prev[i].y) / dt, vz = (out[i].z - prev[i].z) / dt;
        this.vel[i] = { x: 0.5 * this.vel[i].x + 0.5 * vx, y: 0.5 * this.vel[i].y + 0.5 * vy, z: 0.5 * this.vel[i].z + 0.5 * vz };
      }
    }
    this.points = out;
    this.tPrev = t;
  }

  private onMissing(t: number, dt: number): StabilizedSet {
    if (!this.points) { this.status = 'none'; return { points: null, status: 'none', alpha: 0, rejected: 0 }; }
    this.missing++;
    this.pending = null; this.pendingCount = 0;
    const cfg = this.cfg;
    if (cfg.enableExtrapolation && this.missing <= cfg.extrapolateFrames) {
      const out = this.points.map((p, i) => ({
        x: p.x + this.vel[i].x * dt, y: p.y + this.vel[i].y * dt, z: p.z + this.vel[i].z * dt,
      }));
      for (let i = 0; i < this.n; i++) {
        const d = cfg.velocityDecay;
        this.vel[i] = { x: this.vel[i].x * d, y: this.vel[i].y * d, z: this.vel[i].z * d };
        this.fx[i].set(out[i].x, t); this.fy[i].set(out[i].y, t); this.fz[i].set(out[i].z, t);
      }
      this.points = out; this.tPrev = t; this.status = 'extrapolated';
      this.fadeStart = t;
      return { points: this.points, status: 'extrapolated', alpha: 1, rejected: 0 };
    }
    if (!cfg.enableExtrapolation && this.missing === 1) this.fadeStart = t;
    const elapsed = (t - this.fadeStart) * 1000;
    if (cfg.fadeMs > 0 && elapsed < cfg.fadeMs) {
      this.tPrev = t; this.status = 'fading';
      return { points: this.points, status: 'fading', alpha: Math.max(0, 1 - elapsed / cfg.fadeMs), rejected: 0 };
    }
    this.reset();
    return { points: null, status: 'none', alpha: 0, rejected: 0 };
  }
}

// ---------------------------------------------------------------- Holistic-обёртка
export interface HolisticLike {
  poseLandmarks?: Landmark[];
  faceLandmarks?: Landmark[];
  leftHandLandmarks?: Landmark[];
  rightHandLandmarks?: Landmark[];
}

export interface StabilizedHolistic<T extends HolisticLike = HolisticLike> {
  /** Копия результата трекера с заменёнными наборами точек — то, что рисовать. */
  results: T;
  /** Исходные точки — для отладочной отрисовки другим цветом. */
  raw: T;
  left: StabilizedSet;
  right: StabilizedSet;
  pose: StabilizedSet;
}

/**
 * Стабилизатор результата MediaPipe Holistic: обе кисти независимо (с кинематикой)
 * и поза (без ограничений костей, скачки — относительно ширины плеч).
 *
 *   const s = stabilizer.update(results, performance.now());
 *   draw(s.results);                       // сглаженные
 *   if (DEBUG_RAW) drawRaw(s.raw);         // сырые другим цветом
 *   classify(APPLY_TO_MODEL ? s.results : results);
 */
export class HolisticStabilizer {
  readonly left: LandmarkStabilizer;
  readonly right: LandmarkStabilizer;
  readonly pose: LandmarkStabilizer;

  constructor(cfg: StabilizerConfig = DEFAULT_CONFIG) {
    this.left = new LandmarkStabilizer(21, cfg, { bones: HAND_BONES, scaleBone: HAND_PALM_BONE });
    this.right = new LandmarkStabilizer(21, cfg, { bones: HAND_BONES, scaleBone: HAND_PALM_BONE });
    this.pose = new LandmarkStabilizer(33, { ...cfg, enableBoneConstraints: false }, { scaleBone: [11, 12] });
  }

  setConfig(cfg: StabilizerConfig) {
    this.left.setConfig(cfg); this.right.setConfig(cfg);
    this.pose.setConfig({ ...cfg, enableBoneConstraints: false });
  }

  reset() { this.left.reset(); this.right.reset(); this.pose.reset(); }

  update<T extends HolisticLike>(results: T, tMs: number): StabilizedHolistic<T> {
    const left = this.left.update(results.leftHandLandmarks, tMs);
    const right = this.right.update(results.rightHandLandmarks, tMs);
    const pose = this.pose.update(results.poseLandmarks, tMs);
    const out: T = {
      ...results,
      leftHandLandmarks: left.points ?? undefined,
      rightHandLandmarks: right.points ?? undefined,
      poseLandmarks: pose.points ?? results.poseLandmarks,
    };
    return { results: out, raw: results, left, right, pose };
  }
}

/**
 * useSignModel — React hook for loading and running the Qyran sign language model.
 *
 * Usage:
 *   const { predict, isLoaded, labels, featuresPerFrame } = useSignModel();
 *
 *   // landmarks = Float32Array of shape [60, featuresPerFrame] flattened,
 *   // or number[][] of shape [60][featuresPerFrame]
 *   const result = await predict(landmarks);
 *   // result = { label: "хороший", confidence: 0.92, top5: [...], probs: Float32Array }
 *
 * Модель одна — Кыран-240: ансамбль из трёх сетей, чьи вероятности
 * усредняются, как на тестовом стенде (ml/youtube_rsl/webtest), где мерили её
 * точность. SLOVO-1001 с сайта убрана (28.09). Число признаков на кадр берётся
 * из входа загруженной модели (319).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';

const DEBUG = false;

interface PredictionResult {
  label: string;
  confidence: number;
  classIndex: number;
  top5: { label: string; confidence: number }[];
  /** Full probability vector over all classes (softmax output). */
  probs: Float32Array;
}

interface UseSignModelReturn {
  predict: (landmarks: Float32Array | number[][]) => Promise<PredictionResult | null>;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  labels: string[];
  numClasses: number;
  /** Per-frame feature count derived from the model input shape (255 legacy, 259 new). */
  featuresPerFrame: number;
  /**
   * Download progress of the weights, 0..1. Three members are ~21 MB, which is tens
   * of seconds on a weak connection — without a number the page just sits on
   * "Loading" and reads as frozen.
   */
  progress: number;
  labelMap: Record<string, number>;
  idxToLabel: Record<number, string>;
}

/**
 * Кыран-240 в public/: label_map.json и model_config.json лежат в `base`,
 * `members` — подпапки с model.json трёх участников ансамбля. Веса те же
 * байт в байт, что на стенде (webtest/model, model_e2, model_e3).
 */
export const QYRAN_MODEL = { base: '/model/qyran240', members: ['m1', 'm2', 'm3'] } as const;

const SEQ_LEN = 60;
const DEFAULT_FEATURES = 319;

export function useSignModel(): UseSignModelReturn {
  const spec = QYRAN_MODEL;
  /** Участники ансамбля. */
  const modelsRef = useRef<(tf.GraphModel | tf.LayersModel)[]>([]);
  const featuresRef = useRef<number>(DEFAULT_FEATURES);
  const [featuresPerFrame, setFeaturesPerFrame] = useState<number>(DEFAULT_FEATURES);
  const [labelMap, setLabelMap] = useState<Record<string, number>>({});
  const [idxToLabel, setIdxToLabel] = useState<Record<number, string>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load the three ensemble members + label map
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setIsLoaded(false);
      setProgress(0);
      setError(null);
      const old = modelsRef.current;
      modelsRef.current = [];
      old.forEach((m) => m.dispose());

      try {
        const lmRes = await fetch(`${spec.base}/label_map.json`);
        if (!lmRes.ok) throw new Error(`Failed to load label_map.json: ${lmRes.status}`);

        const lm: Record<string, number> = await lmRes.json();
        if (cancelled) return;

        setLabelMap(lm);
        const i2l: Record<number, string> = {};
        for (const [label, idx] of Object.entries(lm)) {
          i2l[idx] = label;
        }
        setIdxToLabel(i2l);

        // Load as layers model (Keras export)
        // Прогресс загрузки.
        //
        // Родной onProgress у tf.js щёлкает раз на ФАЙЛ, а весов всего два
        // шарда — получается 0 / 50 / 100 и долгое молчание между. Поэтому
        // считаем байты сами: подсовываем свой fetch, читаем тело потоком и
        // отдаём дальше те же байты. Лишних запросов это не добавляет.
        // Считаем только шарды весов (.bin) — на них приходятся все 8 МБ.
        // Мешать в счётчик model.json нельзя: он приходит первым, и прогресс
        // сразу показал бы 100%, а потом висел бы на нём всю настоящую загрузку.
        // У ансамбля свой счётчик на каждого участника, общий прогресс — среднее.
        const nMembers = spec.members.length;
        const loadedB = new Array<number>(nMembers).fill(0);
        const totalB = new Array<number>(nMembers).fill(0);
        const fileFrac = new Array<number>(nMembers).fill(0);
        const report = () => {
          if (cancelled) return;
          let sum = 0;
          for (let k = 0; k < nMembers; k++) sum += totalB[k] > 0 ? loadedB[k] / totalB[k] : fileFrac[k];
          setProgress(Math.max(0, Math.min(1, sum / nMembers)));
        };

        const loadMember = async (k: number): Promise<tf.GraphModel | tf.LayersModel> => {
          const url = `${spec.base}${spec.members[k] ? `/${spec.members[k]}` : ''}/model.json`;
          // Запасной путь: если байты посчитать не вышло, берём грубый
          // пофайловый прогресс от tf.js.
          const onProgress = (fraction: number) => { fileFrac[k] = fraction; if (totalB[k] === 0) report(); };
          const fetchFunc: typeof fetch = async (input, init) => {
            const u = typeof input === 'string' ? input : (input as Request).url ?? '';
            const res = await fetch(input as RequestInfo, init);
            const len = Number(res.headers.get('content-length') || 0);
            // Без content-length (сжатие «на лету», chunked) считать нечего.
            if (!/\.bin(\?|$)/.test(u) || !res.body || !len || !res.ok) return res;

            totalB[k] += len;
            const reader = res.body.getReader();
            const chunks: Uint8Array[] = [];
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
              loadedB[k] += value.length;
              report();
            }
            return new Response(new Blob(chunks as BlobPart[]), {
              status: res.status,
              statusText: res.statusText,
              headers: res.headers,
            });
          };
          try {
            const m = await tf.loadLayersModel(url, { strict: false, onProgress, fetchFunc });
            console.log(`[Qyran] ${url}: LayersModel`);
            return m;
          } catch (e1: any) {
            console.warn('[Qyran] LayersModel failed:', e1.message);
            try {
              const m = await tf.loadGraphModel(url, { onProgress, fetchFunc });
              console.log(`[Qyran] ${url}: GraphModel`);
              return m;
            } catch (e2: any) {
              throw new Error(`LayersModel: ${e1.message} | GraphModel: ${e2.message}`);
            }
          }
        };

        const members = await Promise.all(spec.members.map((_, k) => loadMember(k)));
        const model = members[0];

        if (cancelled) { members.forEach((m) => m.dispose()); return; }

        // Derive per-frame feature count from the model's input shape [null, 60, F]
        let features = DEFAULT_FEATURES;
        try {
          const inShape = model.inputs?.[0]?.shape;
          const last = inShape ? inShape[inShape.length - 1] : null;
          if (typeof last === 'number' && last > 0) features = last;
        } catch {
          // keep default
        }
        featuresRef.current = features;
        setFeaturesPerFrame(features);

        modelsRef.current = members;
        setIsLoaded(true);
        console.log(`[Qyran] Qyran-240 ready. Classes: ${Object.keys(lm).length}, features/frame: ${features}, ensemble: ${members.length}`);

        // Warmup inference
        const dummy = tf.zeros([1, SEQ_LEN, features]);
        for (const m of members) {
          const warmup = m instanceof tf.GraphModel ? m.predict(dummy) : (m as tf.LayersModel).predict(dummy);
          if (warmup instanceof tf.Tensor) warmup.dispose();
          else if (Array.isArray(warmup)) warmup.forEach(t => t.dispose());
        }
        dummy.dispose();
        console.log('[Qyran] Warmup done');
      } catch (err: any) {
        if (!cancelled) {
          console.error('[Qyran] Load error:', err);
          setError(err.message || 'Failed to load model');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Уход со страницы — сети освобождаем (ансамбль держит в памяти три).
  useEffect(() => () => {
    modelsRef.current.forEach((m) => m.dispose());
    modelsRef.current = [];
  }, []);

  // Predict
  const predict = useCallback(async (
    landmarks: Float32Array | number[][]
  ): Promise<PredictionResult | null> => {
    const members = modelsRef.current;
    if (!members.length || Object.keys(idxToLabel).length === 0) return null;

    const features = featuresRef.current;

    return tf.tidy(() => {
      // Convert input to tensor [1, 60, features]
      let input: tf.Tensor3D;

      if (landmarks instanceof Float32Array) {
        if (landmarks.length !== SEQ_LEN * features) {
          console.warn(`[Qyran] Expected ${SEQ_LEN * features} values, got ${landmarks.length}`);
          return null;
        }
        input = tf.tensor3d(landmarks, [1, SEQ_LEN, features]);
      } else {
        if (landmarks.length !== SEQ_LEN || (landmarks[0] && landmarks[0].length !== features)) {
          console.warn(`[Qyran] Expected [${SEQ_LEN}][${features}] frames, got [${landmarks.length}][${landmarks[0]?.length}]`);
          return null;
        }
        input = tf.tensor3d([landmarks], [1, SEQ_LEN, features]);
      }

      // Run inference: вероятности трёх участников усредняются, как на стенде
      let probs: Float32Array | null = null;
      for (const m of members) {
        const output = m instanceof tf.GraphModel ? m.predict(input) : (m as tf.LayersModel).predict(input);
        const probsTensor = output instanceof tf.Tensor ? output : (output as tf.Tensor[])[0];
        const p = probsTensor.dataSync() as Float32Array;
        if (!probs) probs = members.length === 1 ? p : new Float32Array(p.length);
        if (members.length > 1) for (let i = 0; i < p.length; i++) probs[i] += p[i] / members.length;
      }
      if (!probs) return null;

      const indexed = Array.from(probs).map((p, i) => ({ idx: i, prob: p }));
      indexed.sort((a, b) => b.prob - a.prob);
      if (indexed.length === 0) return null;
      const top5 = indexed.slice(0, 5).map(({ idx, prob }) => ({
        label: idxToLabel[idx] || `class_${idx}`,
        confidence: prob,
      }));

      // Debug logging
      if (DEBUG) {
        const probArr = Array.from(probs);
        const maxProb = Math.max(...probArr);
        const minProb = Math.min(...probArr);
        const sumProb = probArr.reduce((a, b) => a + b, 0);
        console.log(
          '[Qyran] Predict →',
          top5[0].label,
          `(${(top5[0].confidence * 100).toFixed(1)}%)`,
          '| range:', minProb.toFixed(4), '-', maxProb.toFixed(4),
          '| sum:', sumProb.toFixed(3),
          '| top5:', top5.map(t => `${t.label}=${(t.confidence*100).toFixed(0)}%`).join(', ')
        );
      }

      return {
        label: top5[0].label,
        confidence: top5[0].confidence,
        classIndex: indexed[0].idx,
        top5,
        probs,
      };
    });
  }, [idxToLabel]);

  return {
    predict,
    isLoaded,
    isLoading,
    error,
    labels: Object.keys(labelMap),
    numClasses: Object.keys(labelMap).length,
    featuresPerFrame,
    progress,
    labelMap,
    idxToLabel,
  };
}

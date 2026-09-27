import { useCallback, useEffect, useRef, useState } from 'react';
import { extractHolisticFrame, extractPoseVisibility, FRAME_FEATURES } from '@/lib/landmarks';
import { drawTrackedSkeleton, type OverlayState } from '@/lib/skeletonOverlay';

/**
 * Захват жеста с веб-камеры: камера + MediaPipe Holistic + буфер записи.
 *
 * Отдаёт сырые кадры (255 чисел, раскладка SLOVO) — их принимает
 * retargetSequence из src/lib/retarget.ts.
 */

const SEND_MIN_INTERVAL_MS = 33;   // не чаще ~30 fps — как в распознавателе
const MAX_RECORD_MS = 8000;        // страховка от бесконечной записи
// Ретаргетинг формально работает от 4 кадров, но ниже 5 «живых» кадров Python
// пропускает сглаживание и считает во float32 — там порт расходится с ним на
// ~1e-4. Практического смысла в записи короче трети секунды нет, поэтому берём
// запас и держимся в области, где паритет побитовый.
const MIN_FRAMES = 10;

export interface CaptureState {
  cameraReady: boolean;
  holisticReady: boolean;
  isRecording: boolean;
  frameCount: number;
  error: string | null;
}

export interface UseGestureCapture extends CaptureState {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Включить камеру и трекинг. */
  start: () => Promise<void>;
  /** Выключить камеру, освободить устройство. */
  stop: () => void;
  startRecording: () => void;
  /** Останавливает запись и возвращает накопленные кадры. */
  stopRecording: () => Float32Array[];
  /** Реальная длительность последней записи, секунды. */
  lastDurationSec: number;
  /** Достоверность точек позы по кадрам последней записи. */
  recordedVisibility: () => Float32Array[];
}

export function useGestureCapture(
  mirrored = true,
  /**
   * Вызывается на КАЖДОМ кадре трекинга — для живого управления аватаром.
   * visibility — достоверность точек позы, без неё аватар будет двигать
   * руками, которых нет в кадре.
   */
  onFrame?: (frame: Float32Array, visibility: Float32Array) => void,
): UseGestureCapture {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holisticRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastSendAtRef = useRef(0);
  const runningRef = useRef(false);
  const recordingRef = useRef(false);
  const bufferRef = useRef<Float32Array[]>([]);
  const recordStartRef = useRef(0);
  const mirroredRef = useRef(mirrored);
  const drawRef = useRef<((results: any) => void) | null>(null);
  const overlayStateRef = useRef<OverlayState>({});
  const onFrameRef = useRef(onFrame);
  const lastVisibilityRef = useRef<Float32Array>(new Float32Array(33));
  const visBufferRef = useRef<Float32Array[]>([]);
  const recordedVisibilityRef = useRef<Float32Array[]>([]);

  const [state, setState] = useState<CaptureState>({
    cameraReady: false,
    holisticReady: false,
    isRecording: false,
    frameCount: 0,
    error: null,
  });
  const [lastDurationSec, setLastDurationSec] = useState(0);

  useEffect(() => { mirroredRef.current = mirrored; }, [mirrored]);
  useEffect(() => { onFrameRef.current = onFrame; }, [onFrame]);

  // Рисование скелета поверх видео — отдельно от логики записи.
  useEffect(() => {
    drawRef.current = (results: any) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.save();
      ctx.drawImage(video, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      // overlayStateRef хранит, какая кисть была ближе: без памяти порядок
      // отрисовки мерцает, когда глубины почти равны.
      drawTrackedSkeleton(ctx, results, canvas.width, canvas.height, {
        state: overlayStateRef.current,
      });
    };
    return () => { drawRef.current = null; };
  }, []);

  // Инициализация Holistic — один раз на время жизни хука.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Holistic } = await import('@mediapipe/holistic');
        const holistic = new Holistic({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
        });
        holistic.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });
        holistic.onResults((results: any) => {
          drawRef.current?.(results);

          // Живое управление: аватар повторяет за человеком постоянно,
          // независимо от того, идёт запись или нет.
          const vis = extractPoseVisibility(results);
          if (onFrameRef.current) {
            const live = extractHolisticFrame(results, mirroredRef.current);
            onFrameRef.current(Float32Array.from(live), vis);
          }
          lastVisibilityRef.current = vis;

          if (!recordingRef.current) return;
          // страховка: пользователь мог забыть отпустить пробел
          if (performance.now() - recordStartRef.current > MAX_RECORD_MS) {
            recordingRef.current = false;
            setState((s) => ({ ...s, isRecording: false }));
            return;
          }
          const frame = extractHolisticFrame(results, mirroredRef.current);
          bufferRef.current.push(Float32Array.from(frame));
          visBufferRef.current.push(vis);
          setState((s) => ({ ...s, frameCount: bufferRef.current.length }));
        });
        if (!cancelled) {
          holisticRef.current = holistic;
          setState((s) => ({ ...s, holisticReady: true }));
        }
      } catch (err: any) {
        if (!cancelled) {
          setState((s) => ({ ...s, error: `Не удалось загрузить трекинг: ${err.message}` }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const pump = useCallback(async () => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const holistic = holisticRef.current;
    if (video && holistic && video.readyState >= 2) {
      const now = performance.now();
      if (now - lastSendAtRef.current >= SEND_MIN_INTERVAL_MS) {
        lastSendAtRef.current = now;
        try {
          await holistic.send({ image: video });
        } catch {
          /* teardown */
        }
      }
    }
    if (runningRef.current) rafRef.current = requestAnimationFrame(pump);
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      runningRef.current = true;
      setState((s) => ({ ...s, cameraReady: true, error: null }));
      rafRef.current = requestAnimationFrame(pump);
    } catch {
      setState((s) => ({ ...s, error: 'Нет доступа к камере. Разрешите доступ в браузере.' }));
    }
  }, [pump]);

  const stop = useCallback(() => {
    runningRef.current = false;
    recordingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState((s) => ({ ...s, cameraReady: false, isRecording: false }));
  }, []);

  const startRecording = useCallback(() => {
    if (!runningRef.current || recordingRef.current) return;
    bufferRef.current = [];
    visBufferRef.current = [];
    recordStartRef.current = performance.now();
    recordingRef.current = true;
    setState((s) => ({ ...s, isRecording: true, frameCount: 0 }));
  }, []);

  const stopRecording = useCallback((): Float32Array[] => {
    if (!recordingRef.current) return [];
    recordingRef.current = false;
    const elapsed = (performance.now() - recordStartRef.current) / 1000;
    setLastDurationSec(elapsed);
    setState((s) => ({ ...s, isRecording: false }));
    const frames = bufferRef.current;
    recordedVisibilityRef.current = visBufferRef.current;
    bufferRef.current = [];
    visBufferRef.current = [];
    return frames.length >= MIN_FRAMES ? frames : [];
  }, []);

  useEffect(() => () => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    holisticRef.current?.close?.();
  }, []);

  return {
    ...state,
    videoRef,
    canvasRef,
    start,
    stop,
    startRecording,
    stopRecording,
    lastDurationSec,
    recordedVisibility: () => recordedVisibilityRef.current,
  };
}

export { FRAME_FEATURES };

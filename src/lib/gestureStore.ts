import { supabase } from '@/lib/supabase';
import type { GestureJSON } from '@/lib/retarget';

/**
 * Хранение записанных жестов в Supabase.
 *
 * Схема: supabase/migrations/0001_gestures.sql
 *  - таблица `gestures` — готовая анимация (jsonb) + метаданные;
 *  - приватный бакет `gesture-landmarks` — сырые кадры MediaPipe,
 *    из которых анимацию можно пересобрать заново, когда ретаргетинг улучшится.
 */

export type SignLanguage = 'ksl' | 'rsl';

export interface SavedGesture {
  id: string;
  word: string;
  language: SignLanguage;
  frame_count: number;
  duration_ms: number | null;
  created_at: string;
}

export interface SaveGestureInput {
  word: string;
  language: SignLanguage;
  clip: GestureJSON;
  /** Сырые кадры записи (255 чисел на кадр) — опционально. */
  landmarks?: Float32Array[];
  /** Согласие на использование записи для обучения модели. */
  consentTraining: boolean;
  durationMs?: number;
}

/** Float32-кадры -> один бинарный буфер (little-endian, row-major). */
function packLandmarks(frames: Float32Array[]): Blob {
  const dim = frames[0]?.length ?? 0;
  const buf = new Float32Array(frames.length * dim);
  frames.forEach((f, i) => buf.set(f, i * dim));
  return new Blob([buf.buffer], { type: 'application/octet-stream' });
}

/**
 * Сохранить жест. Повторная запись того же слова перезаписывает предыдущую
 * (уникальность по owner+word+language в схеме).
 */
export async function saveGesture(input: SaveGestureInput): Promise<SavedGesture> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    throw new Error('Войдите в аккаунт, чтобы сохранять жесты.');
  }
  const owner = userData.user.id;

  const row: Record<string, unknown> = {
    owner,
    word: input.word.trim(),
    language: input.language,
    clip: input.clip,
    fps_target: input.clip.fps_target ?? 30,
    duration_ms: input.durationMs ?? null,
    consent_ml_training: input.consentTraining,
    source: 'user_recording',
  };

  const { data, error } = await supabase
    .from('gestures')
    .upsert(row, { onConflict: 'owner,word_norm,language' })
    .select('id, word, language, frame_count, duration_ms, created_at')
    .single();

  if (error) throw new Error(`Не удалось сохранить: ${error.message}`);
  const saved = data as SavedGesture;

  // Сырые кадры — только с явного согласия, и уже после того, как строка создана
  // (путь в бакете завязан на id жеста).
  if (input.consentTraining && input.landmarks?.length) {
    const path = `${owner}/${saved.id}.f32`;
    const { error: upErr } = await supabase.storage
      .from('gesture-landmarks')
      .upload(path, packLandmarks(input.landmarks), {
        contentType: 'application/octet-stream',
        upsert: true,
      });
    if (upErr) {
      // Анимация уже сохранена — не роняем весь сценарий из-за сырых данных.
      console.warn('[Qyran] не удалось выгрузить сырые кадры:', upErr.message);
    } else {
      await supabase
        .from('gestures')
        .update({
          landmarks_path: path,
          landmarks_bytes: input.landmarks.length * (input.landmarks[0]?.length ?? 0) * 4,
          landmark_frames: input.landmarks.length,
          landmark_dim: input.landmarks[0]?.length ?? 255,
        })
        .eq('id', saved.id);
    }
  }

  return saved;
}

/** Список жестов текущего пользователя (без тяжёлого поля clip). */
export async function listMyGestures(): Promise<SavedGesture[]> {
  const { data, error } = await supabase
    .from('gestures')
    .select('id, word, language, frame_count, duration_ms, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SavedGesture[];
}

/** Загрузить анимацию конкретного жеста. */
export async function fetchGestureClip(id: string): Promise<GestureJSON> {
  const { data, error } = await supabase
    .from('gestures')
    .select('clip')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return (data as { clip: GestureJSON }).clip;
}

export async function deleteGesture(id: string): Promise<void> {
  const { error } = await supabase.from('gestures').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

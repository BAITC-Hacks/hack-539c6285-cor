import { useCallback, useEffect, useState } from 'react';

export interface SpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

/**
 * Wrapper around `window.speechSynthesis` for browser text-to-speech.
 * Defaults to Russian voice (ru-RU). Picks a Russian system voice when available.
 */
export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Load available voices (async on some browsers)
  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported]);

  const speak = useCallback(
    (text: string, opts: SpeechOptions = {}) => {
      if (!supported || !text.trim()) return;
      // Cancel anything currently playing
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = opts.lang ?? 'ru-RU';
      utterance.rate = opts.rate ?? 1.0;
      utterance.pitch = opts.pitch ?? 1.0;
      utterance.volume = opts.volume ?? 1.0;

      // Prefer a Russian voice if available
      const russian =
        voices.find(v => v.lang === utterance.lang) ||
        voices.find(v => v.lang.startsWith('ru'));
      if (russian) utterance.voice = russian;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [supported, voices]
  );

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [supported]);

  return { speak, cancel, isSpeaking, supported };
}

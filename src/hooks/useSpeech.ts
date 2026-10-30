import { useCallback, useEffect, useState } from 'react';
import { speechService, voicesFor, type SpeakOutcome, type SpeechLanguage } from '../services/speechService';
import { useSettings } from './useAppContext';

export function useSpeech() {
  const { settings } = useSettings();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [lastOutcome, setLastOutcome] = useState<SpeakOutcome | null>(null);

  useEffect(() => {
    let alive = true;
    speechService.loadVoices().then((v) => alive && setVoices(v));
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    const onChange = () => setVoices(synth?.getVoices() ?? []);
    synth?.addEventListener?.('voiceschanged', onChange);
    return () => {
      alive = false;
      synth?.removeEventListener?.('voiceschanged', onChange);
    };
  }, []);

  const speak = useCallback(
    (text: string, opts: { lang?: SpeechLanguage; fallbackText?: string } = {}) => {
      const lang = opts.lang ?? settings.speechLanguage;
      const outcome = speechService.speak({
        text,
        fallbackText: opts.fallbackText,
        options: {
          lang,
          voiceURI: lang === settings.speechLanguage ? settings.voiceURI || undefined : undefined,
          rate: settings.speechRate,
          pitch: settings.speechPitch,
          volume: settings.speechVolume,
        },
      });
      setLastOutcome(outcome);
      return outcome;
    },
    [settings.speechLanguage, settings.voiceURI, settings.speechRate, settings.speechPitch, settings.speechVolume],
  );

  return {
    supported: speechService.supported,
    voices,
    englishVoices: voicesFor(voices, 'en-IN'),
    hindiVoices: voicesFor(voices, 'hi-IN'),
    hasHindi: voicesFor(voices, 'hi-IN').length > 0,
    speak,
    pause: () => speechService.pause(),
    resume: () => speechService.resume(),
    stop: () => speechService.stop(),
    repeat: () => setLastOutcome(speechService.repeat()),
    lastOutcome,
  };
}

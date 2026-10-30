export type SpeechLanguage = 'en-IN' | 'hi-IN';

export interface SpeakOptions {
  lang: SpeechLanguage;
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface SpeakRequest {
  text: string;
  /** Text to use if `lang` has no installed voice (e.g. English when Hindi is missing). */
  fallbackText?: string;
  options: SpeakOptions;
}

export interface SpeakOutcome {
  spoken: boolean;
  usedFallback: boolean;
  voice: string | null;
  reason?: string;
}

const FALLBACK_LANG: Record<SpeechLanguage, SpeechLanguage> = { 'hi-IN': 'en-IN', 'en-IN': 'en-IN' };

/** Match voices by exact locale first, then by language prefix (e.g. any "hi" or "en"). */
export function voicesFor(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice[] {
  const norm = (l: string) => l.replace('_', '-').toLowerCase();
  const target = norm(lang);
  const prefix = target.split('-')[0];
  const exact = voices.filter((v) => norm(v.lang) === target);
  const partial = voices.filter((v) => norm(v.lang) !== target && norm(v.lang).split('-')[0] === prefix);
  return [...exact, ...partial];
}

/** Thin wrapper around the Web Speech API (SpeechSynthesis) — runs entirely in the browser. */
export class SpeechService {
  private last: SpeakRequest | null = null;

  constructor(private synth: SpeechSynthesis | null = typeof window !== 'undefined' ? (window.speechSynthesis ?? null) : null) {}

  get supported(): boolean {
    return this.synth !== null && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  get speaking(): boolean {
    return this.synth?.speaking ?? false;
  }

  get paused(): boolean {
    return this.synth?.paused ?? false;
  }

  /** Voices load asynchronously in Chrome; wait for `voiceschanged` (with a timeout). */
  async loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
    if (!this.synth) return [];
    const now = this.synth.getVoices();
    if (now.length) return now;
    const synth = this.synth;
    return new Promise((resolve) => {
      const finish = () => {
        synth.removeEventListener?.('voiceschanged', finish);
        clearTimeout(timer);
        resolve(synth.getVoices());
      };
      const timer = setTimeout(finish, timeoutMs);
      synth.addEventListener?.('voiceschanged', finish);
    });
  }

  hasVoiceFor(lang: string): boolean {
    return this.synth ? voicesFor(this.synth.getVoices(), lang).length > 0 : false;
  }

  private pickVoice(lang: SpeechLanguage, voiceURI?: string): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    const voices = this.synth.getVoices();
    const chosen = voiceURI ? voices.find((v) => v.voiceURI === voiceURI) : undefined;
    if (chosen && voicesFor([chosen], lang).length) return chosen;
    return voicesFor(voices, lang)[0] ?? null;
  }

  speak(request: SpeakRequest): SpeakOutcome {
    if (!this.supported || !this.synth) return { spoken: false, usedFallback: false, voice: null, reason: 'Speech synthesis is not supported in this browser.' };
    const text = request.text.trim();
    if (!text) return { spoken: false, usedFallback: false, voice: null, reason: 'Nothing to speak.' };

    let { lang } = request.options;
    let content = text;
    let voice = this.pickVoice(lang, request.options.voiceURI);
    let usedFallback = false;
    const hasAnyVoices = this.synth.getVoices().length > 0;
    if (!voice && hasAnyVoices && lang !== FALLBACK_LANG[lang]) {
      lang = FALLBACK_LANG[lang];
      content = request.fallbackText?.trim() || text;
      voice = this.pickVoice(lang);
      usedFallback = true;
    }

    const u = new SpeechSynthesisUtterance(content);
    u.lang = lang;
    if (voice) u.voice = voice;
    u.rate = clamp(request.options.rate ?? 1, 0.1, 10);
    u.pitch = clamp(request.options.pitch ?? 1, 0, 2);
    u.volume = clamp(request.options.volume ?? 1, 0, 1);
    this.synth.cancel();
    this.synth.speak(u);
    this.last = request;
    return { spoken: true, usedFallback, voice: voice?.name ?? null };
  }

  pause(): void {
    this.synth?.pause();
  }

  resume(): void {
    this.synth?.resume();
  }

  stop(): void {
    this.synth?.cancel();
  }

  repeat(): SpeakOutcome {
    if (!this.last) return { spoken: false, usedFallback: false, voice: null, reason: 'Nothing has been spoken yet.' };
    return this.speak(this.last);
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export const speechService = new SpeechService();

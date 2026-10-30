import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeechService, voicesFor } from '../src/services/speechService';

class FakeUtterance {
  lang = '';
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  pitch = 1;
  volume = 1;
  constructor(public text: string) {}
}

const voice = (name: string, lang: string) => ({ name, lang, voiceURI: name, default: false, localService: true }) as SpeechSynthesisVoice;

function fakeSynth(voices: SpeechSynthesisVoice[]) {
  return {
    getVoices: vi.fn(() => voices),
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    speaking: false,
    paused: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

beforeEach(() => {
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
});

describe('speech synthesis', () => {
  it('matches voices by exact locale, then language', () => {
    const voices = [voice('US', 'en-US'), voice('India', 'en-IN'), voice('Hindi', 'hi-IN')];
    expect(voicesFor(voices, 'en-IN').map((v) => v.name)).toEqual(['India', 'US']);
    expect(voicesFor(voices, 'hi-IN').map((v) => v.name)).toEqual(['Hindi']);
  });

  it('speaks English with an en-IN voice and the configured rate/pitch/volume', () => {
    const synth = fakeSynth([voice('India', 'en-IN'), voice('US', 'en-US')]);
    const svc = new SpeechService(synth as unknown as SpeechSynthesis);
    const out = svc.speak({ text: 'Hello', options: { lang: 'en-IN', rate: 1.5, pitch: 0.8, volume: 0.5 } });
    expect(out).toMatchObject({ spoken: true, usedFallback: false, voice: 'India' });
    const u = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(u).toMatchObject({ text: 'Hello', lang: 'en-IN', rate: 1.5, pitch: 0.8, volume: 0.5 });
  });

  it('speaks Hindi with a Hindi voice when installed', () => {
    const synth = fakeSynth([voice('India', 'en-IN'), voice('Hindi', 'hi-IN')]);
    const svc = new SpeechService(synth as unknown as SpeechSynthesis);
    expect(svc.hasVoiceFor('hi-IN')).toBe(true);
    svc.speak({ text: 'नमस्ते', fallbackText: 'Hello', options: { lang: 'hi-IN' } });
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).text).toBe('नमस्ते');
  });

  it('falls back to English text when no Hindi voice exists', () => {
    const synth = fakeSynth([voice('India', 'en-IN')]);
    const svc = new SpeechService(synth as unknown as SpeechSynthesis);
    expect(svc.hasVoiceFor('hi-IN')).toBe(false);
    const out = svc.speak({ text: 'नमस्ते', fallbackText: 'Hello', options: { lang: 'hi-IN' } });
    expect(out.usedFallback).toBe(true);
    const u = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(u.text).toBe('Hello');
    expect(u.lang).toBe('en-IN');
  });

  it('supports pause, resume, stop and repeat', () => {
    const synth = fakeSynth([voice('India', 'en-IN')]);
    const svc = new SpeechService(synth as unknown as SpeechSynthesis);
    expect(svc.repeat().spoken).toBe(false);
    svc.speak({ text: 'Thank you', options: { lang: 'en-IN' } });
    svc.pause();
    svc.resume();
    svc.stop();
    svc.repeat();
    expect(synth.pause).toHaveBeenCalled();
    expect(synth.resume).toHaveBeenCalled();
    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(2);
    expect((synth.speak.mock.calls[1][0] as FakeUtterance).text).toBe('Thank you');
  });

  it('does nothing for empty text or unsupported browsers', () => {
    const synth = fakeSynth([]);
    expect(new SpeechService(synth as unknown as SpeechSynthesis).speak({ text: '  ', options: { lang: 'en-IN' } }).spoken).toBe(false);
    const none = new SpeechService(null);
    expect(none.supported).toBe(false);
    expect(none.speak({ text: 'Hi', options: { lang: 'en-IN' } }).spoken).toBe(false);
  });
});

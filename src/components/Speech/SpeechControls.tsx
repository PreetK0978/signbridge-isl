import { Pause, Play, Repeat, Square, Volume2 } from 'lucide-react';
import { useSettings } from '../../hooks/useAppContext';
import { useSpeech } from '../../hooks/useSpeech';
import { Alert, Button, Slider } from '../Common/ui';
import { inputClass } from '../Common/ui';

/** Language, voice and playback controls for browser speech synthesis. */
export function SpeechControls({ compact = false }: { compact?: boolean }) {
  const { settings, update } = useSettings();
  const speech = useSpeech();
  const voices = settings.speechLanguage === 'hi-IN' ? speech.hindiVoices : speech.englishVoices;

  if (!speech.supported) {
    return (
      <Alert tone="red" icon={Volume2} title="Speech unavailable">
        This browser does not support the Web Speech API. Text output still works.
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-white/10 bg-navy-950/60 p-1" role="group" aria-label="Speech language">
          {(['en-IN', 'hi-IN'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => update({ speechLanguage: lang, voiceURI: '' })}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${settings.speechLanguage === lang ? 'bg-cyan-500 text-navy-950' : 'text-slate-300 hover:text-white'}`}
              aria-pressed={settings.speechLanguage === lang}
            >
              {lang === 'en-IN' ? 'English (en-IN)' : 'हिन्दी (hi-IN)'}
            </button>
          ))}
        </div>
        <select
          className={`${inputClass} !w-auto max-w-[14rem] !py-1.5 text-xs`}
          value={settings.voiceURI}
          onChange={(e) => update({ voiceURI: e.target.value })}
          aria-label="Voice"
        >
          <option value="">Auto voice</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </div>

      {settings.speechLanguage === 'hi-IN' && !speech.hasHindi && (
        <Alert tone="amber" title="No Hindi voice installed">
          Your system has no hi-IN voice, so SignBridge will speak the English word instead. Install a Hindi voice (Windows: Settings → Time &amp; language → Speech; Android/ChromeOS: Text-to-speech settings) or use Chrome/Edge, which include online Hindi voices.
        </Alert>
      )}
      {speech.lastOutcome?.usedFallback && <p className="text-xs text-amber-300">Spoke English fallback — Hindi voice not available.</p>}

      {!compact && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Slider label="Rate" value={settings.speechRate} min={0.5} max={2} step={0.1} onChange={(v) => update({ speechRate: v })} format={(v) => `${v.toFixed(1)}×`} />
          <Slider label="Pitch" value={settings.speechPitch} min={0} max={2} step={0.1} onChange={(v) => update({ speechPitch: v })} format={(v) => v.toFixed(1)} />
          <Slider label="Volume" value={settings.speechVolume} min={0} max={1} step={0.05} onChange={(v) => update({ speechVolume: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={Pause} onClick={speech.pause}>Pause</Button>
        <Button size="sm" icon={Play} onClick={speech.resume}>Resume</Button>
        <Button size="sm" icon={Square} onClick={speech.stop}>Stop</Button>
        <Button size="sm" icon={Repeat} onClick={speech.repeat}>Repeat</Button>
      </div>
    </div>
  );
}

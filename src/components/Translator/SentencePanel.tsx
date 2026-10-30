import { useState } from 'react';
import { Copy, Delete, Save, Trash2, Volume2 } from 'lucide-react';
import { useSentence, useSettings } from '../../hooks/useAppContext';
import { useSpeech } from '../../hooks/useSpeech';
import { Button } from '../Common/ui';

export function SentencePanel({ hindiFor, onSaved }: { hindiFor?: (word: string) => string | undefined; onSaved?: () => void }) {
  const sentence = useSentence();
  const speech = useSpeech();
  const { settings } = useSettings();
  const [note, setNote] = useState<string | null>(null);

  const flash = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote(null), 2000);
  };

  const speakSentence = () => {
    const hindi = hindiFor ? sentence.state.words.map((w) => hindiFor(w) ?? w).join(' ') : undefined;
    speech.speak(settings.speechLanguage === 'hi-IN' && hindi ? hindi : sentence.text, { fallbackText: sentence.text });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sentence.text);
      flash('Copied to clipboard');
    } catch {
      flash('Clipboard unavailable — select the text and copy manually');
    }
  };

  const save = async () => {
    const ok = await sentence.saveToHistory();
    if (ok) onSaved?.();
    flash(ok ? 'Saved to conversation history' : 'Nothing to save');
  };

  return (
    <div>
      <div className="min-h-[3.5rem] rounded-xl border border-white/10 bg-navy-950/60 p-3" aria-live="polite" aria-label="Sentence">
        {sentence.state.words.length ? (
          <div className="flex flex-wrap gap-1.5">
            {sentence.state.words.map((w, i) => (
              <span key={`${w}-${i}`} className="animate-fade-up rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-sm text-cyan-50">
                {w}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Recognised words will appear here.</p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" icon={Volume2} onClick={speakSentence} disabled={!sentence.text}>Speak sentence</Button>
        <Button size="sm" icon={Delete} onClick={sentence.removeLast} disabled={!sentence.text}>Remove last</Button>
        <Button size="sm" icon={Trash2} onClick={sentence.clear} disabled={!sentence.text}>Clear</Button>
        <Button size="sm" icon={Copy} onClick={copy} disabled={!sentence.text}>Copy</Button>
        <Button size="sm" icon={Save} onClick={save} disabled={!sentence.text}>Save</Button>
      </div>
      {note && <p className="mt-2 text-xs text-cyan-300" role="status">{note}</p>}
    </div>
  );
}

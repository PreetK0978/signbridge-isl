import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, Copy, History, MessageSquareText, Pencil, Plus, ScanLine, Trash2, Volume2, X } from 'lucide-react';
import { Button, Card, CardTitle, EmptyState, inputClass, PageHeader } from '../components/Common/ui';
import { SpeechControls } from '../components/Speech/SpeechControls';
import { SentencePanel } from '../components/Translator/SentencePanel';
import { useAppData, useSentence } from '../hooks/useAppContext';
import { useSpeech } from '../hooks/useSpeech';
import { clearHistory, deleteHistory, getHistory } from '../services/databaseService';
import type { HistoryEntry } from '../types';
import { formatDateTime } from '../utils/format';

export default function SentenceBuilder() {
  const sentence = useSentence();
  const speech = useSpeech();
  const { labels } = useAppData();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const loadHistory = useCallback(() => getHistory().then(setHistory), []);
  useEffect(() => {
    loadHistory();
  }, [loadHistory, sentence.text]);

  const hindiFor = useCallback((w: string) => labels.find((l) => l.english === w)?.hindi || undefined, [labels]);
  const vocab = labels.filter((l) => !l.isBackground);

  return (
    <div>
      <PageHeader
        eyebrow="Compose"
        title="Sentence Builder"
        subtitle="Words recognised in the Live Translator are collected here. Edit them, add words manually, speak the sentence and keep a conversation history."
        actions={<Link to="/translate"><Button variant="primary" icon={ScanLine}>Back to translator</Button></Link>}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card glow>
            <CardTitle
              icon={MessageSquareText}
              action={
                editing ? null : (
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => { setDraft(sentence.text); setEditing(true); }}>Edit text</Button>
                )
              }
            >
              Current sentence
            </CardTitle>
            {editing ? (
              <div>
                <textarea className={`${inputClass} min-h-[6rem] text-base`} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit sentence" autoFocus />
                <div className="mt-3 flex gap-2">
                  <Button variant="primary" size="sm" icon={Check} onClick={() => { sentence.setText(draft); setEditing(false); }}>Apply</Button>
                  <Button size="sm" icon={X} onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                {sentence.text && <p className="mb-3 font-display text-2xl text-white">{sentence.text}</p>}
                <SentencePanel hindiFor={hindiFor} onSaved={loadHistory} />
              </>
            )}
          </Card>

          <Card>
            <CardTitle icon={Plus}>Add a word manually</CardTitle>
            {vocab.length ? (
              <div className="flex flex-wrap gap-2">
                {vocab.map((l) => (
                  <button key={l.id} type="button" onClick={() => sentence.append(l.english)} className="rounded-xl border border-white/10 bg-navy-950/60 px-3 py-1.5 text-sm text-slate-200 transition hover:border-cyan-400/50 hover:text-white">
                    {l.english} {l.hindi && <span className="text-xs text-cyan-300">{l.hindi}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Your vocabulary is empty. Add signs in the Sign Library.</p>
            )}
          </Card>

          <Card>
            <CardTitle icon={Volume2}>Speech settings</CardTitle>
            <SpeechControls />
          </Card>
        </div>

        <Card>
          <CardTitle icon={History} action={history.length ? <Button size="sm" variant="ghost" icon={Trash2} onClick={async () => { await clearHistory(); loadHistory(); }}>Clear all</Button> : null}>
            Conversation history
          </CardTitle>
          {history.length ? (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="group rounded-xl border border-white/5 bg-navy-950/50 p-3">
                  <p className="text-sm text-white">{h.text}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3 w-3" /> {formatDateTime(h.createdAt)}</span>
                    <span className="flex gap-1">
                      <button type="button" className="rounded p-1 text-slate-400 hover:text-cyan-300" aria-label="Speak" onClick={() => speech.speak(h.text)}><Volume2 className="h-3.5 w-3.5" /></button>
                      <button type="button" className="rounded p-1 text-slate-400 hover:text-cyan-300" aria-label="Copy" onClick={() => navigator.clipboard?.writeText(h.text).catch(() => undefined)}><Copy className="h-3.5 w-3.5" /></button>
                      <button type="button" className="rounded p-1 text-slate-400 hover:text-cyan-300" aria-label="Load into editor" onClick={() => sentence.setText(h.text)}><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" className="rounded p-1 text-slate-400 hover:text-red-300" aria-label="Delete" onClick={async () => { await deleteHistory(h.id); loadHistory(); }}><Trash2 className="h-3.5 w-3.5" /></button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={History} title="No saved sentences">Press "Save" on a sentence to keep it here (stored only in this browser).</EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}

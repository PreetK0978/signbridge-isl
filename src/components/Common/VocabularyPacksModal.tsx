import { useMemo, useState } from 'react';
import { Check, Library, Plus } from 'lucide-react';
import { ALL_PACK_WORD_COUNT, VOCABULARY_PACKS } from '../../data/vocabularyPacks';
import { addVocabularyPacks, addWords, CATEGORIES, ISLRTC_DICTIONARY_URL, parseWordList } from '../../services/vocabularyService';
import type { SignCategory, SignLabel } from '../../types';
import { Alert, Button, inputClass, Modal } from './ui';

/** Pick ready-made word lists to add to the vocabulary in one go. */
export function VocabularyPacksModal({ open, labels, onClose, onAdded }: { open: boolean; labels: SignLabel[]; onClose: () => void; onAdded: (count: number) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState('');
  const [customCategory, setCustomCategory] = useState<SignCategory>('other');
  const existing = useMemo(() => new Set(labels.map((l) => l.english.trim().toLowerCase())), [labels]);

  const missing = (packId: string) => VOCABULARY_PACKS.find((p) => p.id === packId)!.words.filter((w) => !existing.has(w.english.toLowerCase())).length;
  const toAdd = [...selected].reduce((n, id) => n + missing(id), 0);
  const allIds = VOCABULARY_PACKS.map((p) => p.id);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const customWords = useMemo(() => parseWordList(custom, customCategory), [custom, customCategory]);
  const customNew = customWords.filter((w) => !existing.has(w.english.toLowerCase())).length;

  const addCustom = async () => {
    setBusy(true);
    try {
      const n = await addWords(customWords, 'a pasted list');
      setCustom('');
      onAdded(n);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    setBusy(true);
    try {
      const n = await addVocabularyPacks([...selected]);
      setSelected(new Set());
      onAdded(n);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Add vocabulary packs"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={() => setSelected(selected.size === allIds.length ? new Set() : new Set(allIds))}>
            {selected.size === allIds.length ? 'Clear selection' : `Select all (${ALL_PACK_WORD_COUNT} words)`}
          </Button>
          <Button variant="primary" icon={Library} onClick={add} loading={busy} disabled={toAdd === 0}>
            Add {toAdd} word{toAdd === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <Alert tone="amber">
        Packs add <strong>words with Hindi translations only</strong>. Each sign is recognised only after you record samples for it (20–30 each) and retrain. Learn the signs from the{' '}
        <a href={ISLRTC_DICTIONARY_URL} target="_blank" rel="noreferrer" className="underline">ISLRTC dictionary</a>. Start with a small set; more signs need more data.
      </Alert>
      <ul className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {VOCABULARY_PACKS.map((p) => {
          const left = missing(p.id);
          const on = selected.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle(p.id)}
                disabled={left === 0}
                aria-pressed={on}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition disabled:opacity-50 ${on ? 'border-cyan-400/60 bg-cyan-400/10' : 'border-white/10 bg-navy-950/50 hover:border-white/20'}`}
              >
                <span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border ${on ? 'border-cyan-400 bg-cyan-500 text-navy-950' : 'border-white/20'}`}>
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2 text-sm font-medium text-white">
                    {p.name}
                    <span className="whitespace-nowrap text-xs font-normal text-slate-400">{left === 0 ? 'all added' : `${left} new / ${p.words.length}`}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{p.words.slice(0, 8).map((x) => x.english).join(', ')}…</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-sm font-medium text-white">Or paste your own words</p>
        <p className="mt-0.5 text-xs text-slate-500">One per line. Add Hindi after a | if you like, e.g. <code className="text-cyan-300">Thank you | धन्यवाद</code></p>
        <textarea
          className={`${inputClass} mt-2 min-h-[6rem] font-mono text-xs`}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={'Goodbye | अलविदा\nWater | पानी\nMy own sign'}
          aria-label="Paste your own words"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select className={`${inputClass} !w-auto !py-1.5 text-xs`} value={customCategory} onChange={(e) => setCustomCategory(e.target.value as SignCategory)} aria-label="Category for pasted words">
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <Button size="sm" icon={Plus} onClick={addCustom} loading={busy} disabled={customNew === 0}>
            Add {customNew} new word{customNew === 1 ? '' : 's'}
          </Button>
          {customWords.length > customNew && <span className="text-xs text-slate-500">{customWords.length - customNew} already in your library</span>}
        </div>
      </div>
    </Modal>
  );
}

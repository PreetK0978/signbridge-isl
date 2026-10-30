import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ExternalLink, Pencil, Plus, ScanLine, Library, Search, Trash2 } from 'lucide-react';
import { MIN_SAMPLES_PER_CLASS, RECOMMENDED_SAMPLES_PER_CLASS } from '../ai/trainingService';
import { LabelFormModal } from '../components/Common/LabelFormModal';
import { VocabularyPacksModal } from '../components/Common/VocabularyPacksModal';
import { Alert, Badge, Button, Card, EmptyState, inputClass, Modal, PageHeader, ProgressBar } from '../components/Common/ui';
import { useAppData } from '../hooks/useAppContext';
import { CATEGORIES, categoryLabel, ISLRTC_DICTIONARY_URL, removeLabel } from '../services/vocabularyService';
import type { SignLabel } from '../types';

type StatusFilter = 'all' | 'recognised' | 'ready' | 'collecting' | 'empty';

export default function SignLibrary() {
  const { labels, sampleCounts, modelMeta, refresh } = useAppData();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SignLabel | null>(null);
  const [deleting, setDeleting] = useState<SignLabel | null>(null);
  const [packsOpen, setPacksOpen] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  const inModel = useMemo(() => new Set(modelMeta?.labelIds ?? []), [modelMeta]);

  const statusOf = (l: SignLabel): Exclude<StatusFilter, 'all'> => {
    const n = sampleCounts.get(l.id) ?? 0;
    if (inModel.has(l.id)) return 'recognised';
    if (n >= MIN_SAMPLES_PER_CLASS) return 'ready';
    if (n > 0) return 'collecting';
    return 'empty';
  };

  const filtered = labels.filter((l) => {
    const q = query.trim().toLowerCase();
    const matches = !q || l.english.toLowerCase().includes(q) || l.hindi.includes(query.trim()) || (l.notes ?? '').toLowerCase().includes(q);
    return matches && (category === 'all' || l.category === category) && (status === 'all' || statusOf(l) === status);
  });

  const STATUS_BADGE = {
    recognised: { tone: 'green' as const, text: 'In current model' },
    ready: { tone: 'blue' as const, text: 'Ready to train' },
    collecting: { tone: 'amber' as const, text: 'Collecting samples' },
    empty: { tone: 'slate' as const, text: 'No samples' },
  };

  return (
    <div>
      <PageHeader
        eyebrow="Vocabulary"
        title="Sign Library"
        subtitle="Your sign vocabulary, its training status and references. SignBridge ships no sign definitions — learn each sign from an authoritative source such as the ISLRTC dictionary."
        actions={
          <>
            <Button icon={Library} onClick={() => setPacksOpen(true)}>Add vocabulary packs</Button>
            <Button variant="primary" icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>Add sign</Button>
          </>
        }
      />

      <Alert tone="cyan" icon={BookOpen} title="Official reference">
        Indian Sign Language Research and Training Centre (ISLRTC), Department of Empowerment of Persons with Disabilities, Govt. of India — <a href={ISLRTC_DICTIONARY_URL} target="_blank" rel="noreferrer" className="underline">ISL dictionary</a>. Dictionary videos are © ISLRTC and are linked, not copied or redistributed, by SignBridge.
      </Alert>

      {added !== null && (
        <div className="mt-4">
          <Alert tone="green">{added ? `Added ${added} words. Use the status filter "No samples" to see what still needs recording.` : 'Those words are already in your library.'}</Alert>
        </div>
      )}

      <Card className="mt-5">
        <div className="mb-5 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input className={`${inputClass} pl-9`} placeholder="Search English, Hindi or notes…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search signs" />
          </div>
          <select className={`${inputClass} md:w-48`} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select className={`${inputClass} md:w-48`} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="recognised">In current model</option>
            <option value="ready">Ready to train</option>
            <option value="collecting">Collecting samples</option>
            <option value="empty">No samples</option>
          </select>
        </div>

        {labels.length === 0 ? (
          <EmptyState icon={BookOpen} title="Your library is empty" action={<div className="flex flex-wrap justify-center gap-2"><Button variant="primary" icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>Add a sign</Button><Button icon={Library} onClick={() => setPacksOpen(true)}>Add vocabulary packs</Button></div>}>
            Add signs you know (with English and Hindi), or load ready-made vocabulary packs: alphabet, numbers and everyday words.
          </EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Search} title="No matching signs">Try a different search or filter.</EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((l) => {
              const n = sampleCounts.get(l.id) ?? 0;
              const st = STATUS_BADGE[statusOf(l)];
              return (
                <div key={l.id} className="group flex flex-col rounded-2xl border border-white/[0.07] bg-navy-950/50 p-4 transition hover:border-cyan-400/30 hover:shadow-glow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg text-white">{l.english}</h3>
                      <p className="text-cyan-200" lang="hi">{l.hindi || <span className="text-slate-600">no Hindi yet</span>}</p>
                    </div>
                    <Badge tone={st.tone}>{st.text}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{categoryLabel(l.category)}{l.isBackground ? ' · background class, never spoken' : ''}</p>
                  {l.notes && <p className="mt-2 line-clamp-2 text-xs text-slate-400">{l.notes}</p>}
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-slate-400"><span>Samples</span><span className="font-mono">{n}/{RECOMMENDED_SAMPLES_PER_CLASS}</span></div>
                    <ProgressBar value={n} max={RECOMMENDED_SAMPLES_PER_CLASS} tone={n >= RECOMMENDED_SAMPLES_PER_CLASS ? 'green' : 'cyan'} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-1.5 pt-1">
                    {l.referenceUrl ? (
                      <a href={l.referenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-400/10">
                        <ExternalLink className="h-3 w-3" /> Reference
                      </a>
                    ) : (
                      <span className="px-2 text-xs text-slate-600">No reference</span>
                    )}
                    <span className="flex-1" />
                    <Button size="sm" variant="ghost" icon={ScanLine} onClick={() => navigate(inModel.has(l.id) ? '/translate' : '/training')} title={inModel.has(l.id) ? 'Test in the live translator' : 'Record samples'}>
                      {inModel.has(l.id) ? 'Test' : 'Train'}
                    </Button>
                    <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" aria-label={`Edit ${l.english}`} onClick={() => { setEditing(l); setFormOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-300" aria-label={`Delete ${l.english}`} onClick={() => setDeleting(l)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <LabelFormModal open={formOpen} label={editing} onClose={() => setFormOpen(false)} onSaved={() => refresh()} />
      <VocabularyPacksModal open={packsOpen} labels={labels} onClose={() => setPacksOpen(false)} onAdded={async (n) => { await refresh(); setAdded(n); }} />
      <Modal
        open={!!deleting}
        title="Delete sign?"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" icon={Trash2} onClick={async () => { if (deleting) { await removeLabel(deleting.id); await refresh(); } setDeleting(null); }}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">"{deleting?.english}" and its {sampleCounts.get(deleting?.id ?? '') ?? 0} samples will be removed. Retrain the model afterwards.</p>
      </Modal>
    </div>
  );
}

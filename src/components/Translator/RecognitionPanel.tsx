import { CheckCircle2, HelpCircle, Hand, Plus, ScanSearch, Volume2 } from 'lucide-react';
import type { RecognitionStatus } from '../../ai/predictionService';
import { formatPercent } from '../../utils/format';
import { Badge, Button, ProgressBar } from '../Common/ui';

export interface RecognitionView {
  status: RecognitionStatus;
  english: string | null;
  hindi: string | null;
  confidence: number;
  top: Array<{ name: string; p: number }>;
}

const STATUS: Record<RecognitionStatus, { text: string; tone: 'green' | 'amber' | 'red' | 'slate' | 'cyan'; icon: typeof Hand }> = {
  idle: { text: 'Waiting', tone: 'slate', icon: Hand },
  'no-hands': { text: 'No hands in view', tone: 'slate', icon: Hand },
  detecting: { text: 'Analysing motion…', tone: 'cyan', icon: ScanSearch },
  unknown: { text: 'Unknown sign', tone: 'amber', icon: HelpCircle },
  recognized: { text: 'Recognised', tone: 'green', icon: CheckCircle2 },
};

export function RecognitionPanel({
  view,
  lastWord,
  onAdd,
  onSpeak,
  pendingConfirmation,
}: {
  view: RecognitionView;
  lastWord: { english: string; hindi: string } | null;
  onAdd: () => void;
  onSpeak: () => void;
  pendingConfirmation: boolean;
}) {
  const s = STATUS[view.status];
  const Icon = s.icon;
  const showUnknown = view.status === 'unknown';
  const word = view.status === 'recognized' ? view.english : null;
  return (
    <div>
      <div className="flex items-center justify-between">
        <Badge tone={s.tone}>
          <Icon className="h-3 w-3" /> {s.text}
        </Badge>
        <span className="font-mono text-xs text-slate-400">confidence {formatPercent(view.confidence)}</span>
      </div>

      <div className="my-5 min-h-[7.5rem] rounded-2xl border border-white/5 bg-gradient-to-br from-navy-950 to-navy-800 p-5 text-center" aria-live="polite">
        {word ? (
          <>
            <p className="font-display text-4xl font-semibold text-white drop-shadow-[0_0_18px_rgba(62,230,245,0.45)] md:text-5xl">{word}</p>
            <p className="mt-2 text-xl text-cyan-200">{view.hindi || '—'}</p>
          </>
        ) : showUnknown ? (
          <>
            <p className="font-display text-3xl font-semibold tracking-wide text-amber-300">UNKNOWN SIGN</p>
            <p className="mt-2 text-xs text-slate-400">Confidence is below the threshold — no word is guessed.</p>
          </>
        ) : lastWord ? (
          <>
            <p className="text-xs uppercase tracking-widest text-slate-500">Last recognised</p>
            <p className="font-display text-3xl text-slate-300">{lastWord.english}</p>
            <p className="mt-1 text-lg text-slate-400">{lastWord.hindi || '—'}</p>
          </>
        ) : (
          <p className="pt-8 text-sm text-slate-500">Perform a trained sign in front of the camera.</p>
        )}
      </div>

      <ProgressBar value={view.confidence} tone={view.status === 'recognized' ? 'green' : view.status === 'unknown' ? 'amber' : 'cyan'} label="Model confidence" />

      {view.top.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Model output (top classes)</p>
          {view.top.map((t) => (
            <div key={t.name} className="flex items-center gap-2 text-xs">
              <span className="w-24 truncate text-slate-300">{t.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-700">
                <div className="h-full bg-electric-400" style={{ width: `${t.p * 100}%` }} />
              </div>
              <span className="w-12 text-right font-mono text-slate-400">{formatPercent(t.p, 0)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant={pendingConfirmation ? 'primary' : 'secondary'} icon={Plus} onClick={onAdd} disabled={!lastWord} className={pendingConfirmation ? 'animate-pulse' : ''}>
          {pendingConfirmation ? 'Confirm & add' : 'Add to sentence'}
        </Button>
        <Button icon={Volume2} onClick={onSpeak} disabled={!lastWord}>Speak word</Button>
      </div>
    </div>
  );
}

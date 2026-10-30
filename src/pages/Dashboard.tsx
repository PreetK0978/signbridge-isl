import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, BookOpen, BrainCircuit, Database, Layers, ScanLine } from 'lucide-react';
import { RECOMMENDED_SAMPLES_PER_CLASS } from '../ai/trainingService';
import { Badge, Button, Card, CardTitle, EmptyState, PageHeader, StatCard } from '../components/Common/ui';
import { BarList, LineChart } from '../components/Dashboard/Charts';
import { useAppData } from '../hooks/useAppContext';
import { getActivity, getMeta, getSamples, SESSION_COUNT_KEY } from '../services/databaseService';
import { categoryLabel } from '../services/vocabularyService';
import type { ActivityEntry } from '../types';
import { formatPercent, formatRelativeTime } from '../utils/format';

export default function Dashboard() {
  const { labels, sampleCounts, totalSamples, modelMeta, modelStatus, modelStale } = useAppData();
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [sessions, setSessions] = useState(0);
  const [sources, setSources] = useState<Record<string, number>>({});
  const [recordingSessions, setRecordingSessions] = useState(0);

  useEffect(() => {
    getActivity(12).then(setActivity);
    getMeta<number>(SESSION_COUNT_KEY).then((n) => setSessions(n ?? 0));
    getSamples().then((samples) => {
      const s: Record<string, number> = {};
      for (const x of samples) s[x.source] = (s[x.source] ?? 0) + 1;
      setSources(s);
      setRecordingSessions(new Set(samples.map((x) => x.sessionId)).size);
    });
  }, [totalSamples]);

  const trainedSigns = modelMeta?.labelIds.length ?? 0;
  const byCategory = new Map<string, number>();
  labels.forEach((l) => byCategory.set(categoryLabel(l.category), (byCategory.get(categoryLabel(l.category)) ?? 0) + 1));

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        subtitle="Everything below is computed from data stored locally in this browser."
        actions={
          <>
            <Link to="/training"><Button icon={BrainCircuit}>Training Studio</Button></Link>
            <Link to="/translate"><Button variant="primary" icon={ScanLine}>Start translating</Button></Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BrainCircuit} label="Trained signs" value={trainedSigns} hint={`${labels.length} in vocabulary`} />
        <StatCard icon={Database} label="Training samples" value={totalSamples} hint={`${recordingSessions} recording session(s)`} />
        <StatCard icon={ScanLine} label="Translation sessions" value={sessions} hint="Camera starts in the translator" />
        <StatCard
          icon={Layers}
          label="Model status"
          value={<span className="text-xl">{modelStatus === 'ready' ? (modelStale ? 'Outdated' : 'Ready') : modelStatus === 'loading' ? 'Loading' : modelStatus === 'error' ? 'Error' : 'Not trained'}</span>}
          hint={modelMeta ? `Validation accuracy ${formatPercent(modelMeta.evaluation?.accuracy)}` : 'Train a model to begin'}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle icon={Database} action={<Badge tone="slate">target {RECOMMENDED_SAMPLES_PER_CLASS}/sign</Badge>}>Dataset statistics</CardTitle>
          {labels.length ? (
            <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
              <BarList target={RECOMMENDED_SAMPLES_PER_CLASS} items={labels.map((l) => ({ label: l.english, value: sampleCounts.get(l.id) ?? 0, sub: l.hindi || undefined }))} />
              <div className="space-y-4 text-sm">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Sample sources</p>
                  {Object.keys(sources).length ? (
                    Object.entries(sources).map(([k, v]) => (
                      <p key={k} className="flex justify-between text-slate-300"><span className="capitalize">{k}</span><span className="font-mono">{v}</span></p>
                    ))
                  ) : (
                    <p className="text-slate-500">No samples yet</p>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Categories</p>
                  {[...byCategory.entries()].map(([k, v]) => (
                    <p key={k} className="flex justify-between text-slate-300"><span>{k}</span><span className="font-mono">{v}</span></p>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon={BookOpen} title="No vocabulary yet" action={<Link to="/training"><Button variant="primary">Create your first sign</Button></Link>}>
              Add sign labels and record samples in the Training Studio.
            </EmptyState>
          )}
        </Card>

        <Card>
          <CardTitle icon={Activity}>Recent activity</CardTitle>
          {activity.length ? (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-cyan-400" />
                  <span className="flex-1 text-slate-300">{a.message}</span>
                  <span className="whitespace-nowrap text-xs text-slate-500">{formatRelativeTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Nothing yet — your training and translation activity appears here.</p>
          )}
        </Card>
      </div>

      {modelMeta && modelMeta.history.length > 0 && (
        <Card className="mt-6">
          <CardTitle icon={BrainCircuit}>Last training run</CardTitle>
          <LineChart
            yLabel="Accuracy per epoch"
            series={[
              { name: 'Train accuracy', color: '#4d8dff', values: modelMeta.history.map((h) => h.acc) },
              { name: 'Validation accuracy', color: '#3ee6f5', values: modelMeta.history.map((h) => h.valAcc), dashed: true },
            ]}
          />
          <p className="mt-2 text-xs text-slate-500">
            {modelMeta.epochs} epochs · {modelMeta.split.trainCount} train / {modelMeta.split.valCount} validation samples ({modelMeta.split.strategy}-level split) · dataset {modelMeta.datasetVersion}
          </p>
        </Card>
      )}
    </div>
  );
}

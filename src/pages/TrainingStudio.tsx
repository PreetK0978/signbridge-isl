import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Circle,
  Database,
  Download,
  FlaskConical,
  FolderInput,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  Undo2,
  Upload,
  XCircle,
} from 'lucide-react';
import { SEQUENCE_LENGTH } from '../ai/constants';
import { buildSequence } from '../ai/sequenceProcessor';
import { decide } from '../ai/predictionService';
import {
  evaluateClassifier,
  MIN_SAMPLES_PER_CLASS,
  RECOMMENDED_SAMPLES_PER_CLASS,
  splitDataset,
  trainClassifier,
  TrainingError,
} from '../ai/trainingService';
import { extractDataset, groupVideosByFolder } from '../ai/videoExtractor';
import { TrackedCamera } from '../components/Camera/TrackedCamera';
import { BarList, ConfusionMatrix, TrainingCharts } from '../components/Dashboard/Charts';
import { LabelFormModal } from '../components/Common/LabelFormModal';
import { Alert, Badge, Button, Card, CardTitle, EmptyState, Field, inputClass, Modal, PageHeader, ProgressBar, Slider, Toggle } from '../components/Common/ui';
import { useAppData, useSettings } from '../hooks/useAppContext';
import { useLandmarkDetector } from '../hooks/useDetectors';
import type { Detection } from '../hooks/useHandTracking';
import { addSample, deleteSample, exportDataset, getSamples, importDataset, logActivity } from '../services/databaseService';
import { addStarterWords, categoryLabel, removeLabel } from '../services/vocabularyService';
import type { EpochMetrics, EvaluationResult, FrameData, SignLabel } from '../types';
import { downloadJson, readJsonFile } from '../utils/file';
import { formatPercent } from '../utils/format';
import { createId } from '../utils/id';

type Phase = 'idle' | 'countdown' | 'recording';
type Purpose = 'train' | 'test';
type RecordResult = { ok: true; validRatio: number; purpose: Purpose; test?: Array<{ name: string; p: number }>; verdict?: string } | { ok: false; reason: string };

const newSessionId = () => `sess_${createId()}`;

export default function TrainingStudio() {
  const { settings, update } = useSettings();
  const app = useAppData();
  const { labels, sampleCounts, classifier, modelMeta, refresh } = app;
  const detector = useLandmarkDetector(settings.engine, settings.delegate);

  const [selectedId, setSelectedId] = useState<string>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SignLabel | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SignLabel | null>(null);
  const [sessionId, setSessionId] = useState(newSessionId);
  const [sessionCount, setSessionCount] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [countdown, setCountdown] = useState(0);
  const [recProgress, setRecProgress] = useState(0);
  const [result, setResult] = useState<RecordResult | null>(null);
  const [burst, setBurst] = useState(0);
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'green' | 'red' | 'cyan'; text: string } | null>(null);

  const [training, setTraining] = useState(false);
  const [history, setHistory] = useState<EpochMetrics[]>([]);
  const [trainError, setTrainError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<{ result: EvaluationResult; note: string } | null>(null);
  const [videoProgress, setVideoProgress] = useState<{ done: number; total: number; name: string } | null>(null);
  const stopRef = useRef(false);

  const recording = useRef<{ frames: FrameData[]; start: number; purpose: Purpose } | null>(null);
  const timers = useRef<number[]>([]);
  const importRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedId && labels.length) setSelectedId(labels[0].id);
    if (selectedId && !labels.some((l) => l.id === selectedId)) setSelectedId(labels[0]?.id ?? '');
  }, [labels, selectedId]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  useEffect(() => {
    if (folderRef.current) folderRef.current.setAttribute('webkitdirectory', '');
  }, []);

  const selected = labels.find((l) => l.id === selectedId);

  const finishRecording = useCallback(async () => {
    const rec = recording.current;
    recording.current = null;
    setPhase('idle');
    setRecProgress(0);
    if (!rec) return;
    const seq = buildSequence(rec.frames);
    if (!seq.ok) {
      setResult({
        ok: false,
        reason:
          seq.reason === 'too-few-frames'
            ? 'Too few camera frames were captured. Check that the camera is running smoothly.'
            : `Hands were visible in only ${Math.round(seq.validRatio * 100)}% of the sequence (need 60%). Keep your hands in frame and try again.`,
      });
      setBurst(0);
      return;
    }
    if (rec.purpose === 'test') {
      if (!classifier) return;
      const pred = classifier.predict(seq.frames);
      const top = pred.probabilities
        .map((p, i) => ({ name: app.labelById(classifier.labelIds[i])?.english ?? modelMeta?.labelNames[i] ?? '?', p }))
        .sort((a, b) => b.p - a.p)
        .slice(0, 3);
      const d = decide(pred, classifier.labelIds, { confidenceThreshold: settings.confidenceThreshold, minMargin: settings.minMargin });
      const verdict = d.kind === 'sign' ? `Recognised as "${top[0].name}"` : d.kind === 'unknown' ? 'UNKNOWN SIGN (below threshold)' : 'Background / no sign';
      setResult({ ok: true, validRatio: seq.validRatio, purpose: 'test', test: top, verdict });
      return;
    }
    if (!selected) return;
    await addSample({
      id: createId('s_'),
      labelId: selected.id,
      sessionId,
      frames: seq.frames,
      validity: seq.validity,
      source: 'webcam',
      createdAt: Date.now(),
    });
    await logActivity('sample-recorded', `Recorded a sample for "${selected.english}"`);
    setSessionCount((c) => c + 1);
    setResult({ ok: true, validRatio: seq.validRatio, purpose: 'train' });
    await refresh();
    setBurst((b) => Math.max(0, b - 1));
  }, [selected, sessionId, refresh, classifier, settings.confidenceThreshold, settings.minMargin, app, modelMeta]);

  const startRecording = useCallback(
    (purpose: Purpose) => {
      if (phase !== 'idle' || !live) return;
      setResult(null);
      const begin = () => {
        recording.current = { frames: [], start: performance.now(), purpose };
        setPhase('recording');
        timers.current.push(window.setTimeout(finishRecording, settings.recordingDurationMs));
      };
      if (settings.countdownSeconds <= 0) return begin();
      setPhase('countdown');
      setCountdown(settings.countdownSeconds);
      for (let i = 1; i <= settings.countdownSeconds; i++) {
        timers.current.push(
          window.setTimeout(() => {
            if (i === settings.countdownSeconds) begin();
            else setCountdown(settings.countdownSeconds - i);
          }, i * 1000),
        );
      }
    },
    [phase, live, settings.countdownSeconds, settings.recordingDurationMs, finishRecording],
  );

  // Burst mode: record several samples back to back.
  useEffect(() => {
    if (burst > 0 && phase === 'idle' && live && result?.ok !== false) {
      const t = window.setTimeout(() => startRecording('train'), 700);
      return () => clearTimeout(t);
    }
  }, [burst, phase, live, result, startRecording]);

  const cancelRecording = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    recording.current = null;
    setPhase('idle');
    setBurst(0);
  };

  const onDetection = useCallback((d: Detection) => {
    const rec = recording.current;
    if (!rec) return;
    rec.frames.push(d.frame);
    setRecProgress(Math.min(1, (performance.now() - rec.start) / settings.recordingDurationMs));
  }, [settings.recordingDurationMs]);

  // Space bar records a training sample.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && tag !== 'BUTTON' && selected) {
        e.preventDefault();
        startRecording('train');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startRecording, selected]);

  const undoLast = async () => {
    if (!selected) return;
    const samples = (await getSamples(selected.id)).sort((a, b) => b.createdAt - a.createdAt);
    if (!samples[0]) return;
    await deleteSample(samples[0].id);
    await refresh();
    setNotice({ tone: 'cyan', text: `Removed the latest sample of "${selected.english}".` });
  };

  const train = async () => {
    setTraining(true);
    setTrainError(null);
    setHistory([]);
    setEvaluation(null);
    stopRef.current = false;
    try {
      const all = await getSamples();
      const res = await trainClassifier({
        labels,
        samples: all,
        epochs: settings.epochs,
        augment: settings.augment,
        onEpoch: (m) => setHistory((h) => [...h, m]),
        shouldStop: () => stopRef.current,
      });
      await app.saveTrainedModel(res, res.history.length);
      if (res.evaluation) setEvaluation({ result: res.evaluation, note: 'Held-out validation set (never used for training).' });
      setNotice({ tone: 'green', text: `Model trained on ${res.labels.length} signs and saved to IndexedDB.` });
    } catch (err) {
      setTrainError(err instanceof TrainingError ? err.message : `Training failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTraining(false);
    }
  };

  const evaluate = async () => {
    if (!classifier || !modelMeta) return;
    const all = (await getSamples()).filter((s) => classifier.labelIds.includes(s.labelId));
    const split = splitDataset(all, 0.2, 42);
    const names = new Map(classifier.labelIds.map((id, i) => [id, app.labelById(id)?.english ?? modelMeta.labelNames[i]]));
    if (!split.validation.length) {
      setEvaluation(null);
      setNotice({ tone: 'red', text: 'Not enough data for a held-out evaluation. Record samples in at least two sessions per sign.' });
      return;
    }
    setEvaluation({
      result: evaluateClassifier(classifier, split.validation, names),
      note: app.modelStale
        ? 'Dataset changed since training — the validation split may now contain samples the model was trained on. Retrain for a clean estimate.'
        : 'Held-out validation split (same deterministic split as training).',
    });
  };

  const deleteModel = async () => {
    await app.deleteModel();
    setHistory([]);
    setEvaluation(null);
    setNotice({ tone: 'cyan', text: 'Trained model deleted. Your samples are kept.' });
  };

  const doExport = async () => {
    const data = await exportDataset();
    downloadJson(data, `signbridge-dataset-${new Date().toISOString().slice(0, 10)}.json`);
    setNotice({ tone: 'green', text: `Exported ${data.samples.length} samples across ${data.labels.length} labels (landmarks only, no video).` });
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const report = await importDataset(await readJsonFile(file));
      await logActivity('samples-imported', `Imported ${report.samplesAdded} samples from ${file.name}`);
      await refresh();
      setNotice({ tone: 'green', text: `Imported ${report.samplesAdded} samples (${report.samplesSkipped} skipped), ${report.labelsAdded} new labels.${report.errors.length ? ` ${report.errors.length} warning(s).` : ''}` });
    } catch (err) {
      setNotice({ tone: 'red', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const doVideoImport = async (files: FileList | null) => {
    const videos = groupVideosByFolder(Array.from(files ?? []));
    if (!videos.length) {
      setNotice({ tone: 'red', text: 'No videos found. Pick a folder laid out as dataset/LABEL/video.mp4.' });
      return;
    }
    try {
      const raw = await extractDataset(videos, (done, total, name) => setVideoProgress({ done, total, name }));
      const report = await importDataset(raw);
      await logActivity('samples-imported', `Extracted ${report.samplesAdded} samples from ${videos.length} local videos`);
      await refresh();
      setNotice({ tone: 'green', text: `Extracted ${report.samplesAdded} sequences from ${videos.length} videos (${report.samplesSkipped} rejected for missing hands).` });
    } catch (err) {
      setNotice({ tone: 'red', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setVideoProgress(null);
    }
  };

  const addStarter = async () => {
    const n = await addStarterWords();
    await refresh();
    setNotice({ tone: 'cyan', text: n ? `Added ${n} starter words. Learn each sign from the ISLRTC dictionary before recording.` : 'Starter words are already in your vocabulary.' });
  };

  const counts = labels.map((l) => sampleCounts.get(l.id) ?? 0);
  const trainableCount = counts.filter((c) => c >= MIN_SAMPLES_PER_CLASS).length;
  const shownHistory = history.length ? history : (modelMeta?.history ?? []);
  const shownEval = evaluation?.result ?? null;
  const evalNames = shownEval?.labelIds.map((id, i) => app.labelById(id)?.english ?? modelMeta?.labelNames[i] ?? id) ?? [];

  const overlay =
    phase === 'countdown' ? (
      <div className="absolute inset-0 flex items-center justify-center bg-navy-950/40">
        <span className="font-display text-8xl font-bold text-white drop-shadow-[0_0_30px_rgba(62,230,245,0.8)]">{countdown}</span>
      </div>
    ) : phase === 'recording' ? (
      <>
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-4 ring-inset ring-red-500/80" />
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> REC {recording.current?.purpose === 'test' ? '· TEST' : `· ${selected?.english ?? ''}`}
        </div>
        <div className="absolute inset-x-3 bottom-3">
          <ProgressBar value={recProgress} label="Recording progress" />
        </div>
      </>
    ) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Teach the model"
        title="Training Studio"
        subtitle={`Record ${SEQUENCE_LENGTH}-frame landmark sequences for each sign, then train an LSTM in your browser. Only landmark coordinates are saved — never video.`}
        actions={
          <>
            <Button icon={Upload} onClick={() => importRef.current?.click()}>Import JSON</Button>
            <Button icon={Download} onClick={doExport} disabled={!app.totalSamples}>Export JSON</Button>
            <Button icon={FolderInput} onClick={() => folderRef.current?.click()} loading={!!videoProgress}>Import video folder</Button>
            <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ''; }} data-testid="import-input" />
            <input ref={folderRef} type="file" multiple accept="video/*" className="hidden" onChange={(e) => { doVideoImport(e.target.files); e.target.value = ''; }} />
          </>
        }
      />

      {notice && (
        <div className="mb-4">
          <Alert tone={notice.tone} icon={notice.tone === 'red' ? XCircle : CheckCircle2}>
            <span className="flex items-start justify-between gap-4">
              {notice.text}
              <button type="button" className="text-xs underline opacity-70" onClick={() => setNotice(null)}>dismiss</button>
            </span>
          </Alert>
        </div>
      )}
      {videoProgress && (
        <Card className="mb-4">
          <p className="mb-2 text-sm text-slate-300">Extracting landmarks locally: {videoProgress.done}/{videoProgress.total} {videoProgress.name}</p>
          <ProgressBar value={videoProgress.done} max={videoProgress.total} />
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <TrackedCamera createDetector={detector} onDetection={onDetection} overlay={overlay} onLiveChange={setLive} />

          <Card>
            <CardTitle icon={Circle}>Record samples</CardTitle>
            {labels.length === 0 ? (
              <EmptyState
                icon={Plus}
                title="Create your first sign label"
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="primary" icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>New label</Button>
                    <Button icon={Database} onClick={addStarter}>Add starter word list</Button>
                  </div>
                }
              >
                Enter the English word, its Hindi translation and a category. Then perform the sign repeatedly to record samples.
              </EmptyState>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[12rem] flex-1">
                    <Field label="Sign to record">
                      <select className={inputClass} value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={phase !== 'idle'}>
                        {labels.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.english}{l.hindi ? ` · ${l.hindi}` : ''} ({sampleCounts.get(l.id) ?? 0})
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Button icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>New label</Button>
                </div>

                {selected && (
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-slate-400">
                      <span>{categoryLabel(selected.category)}{selected.isBackground ? ' · not spoken' : ''}</span>
                      <span>{sampleCounts.get(selected.id) ?? 0} / {RECOMMENDED_SAMPLES_PER_CLASS} recommended</span>
                    </div>
                    <ProgressBar value={sampleCounts.get(selected.id) ?? 0} max={RECOMMENDED_SAMPLES_PER_CLASS} tone={(sampleCounts.get(selected.id) ?? 0) >= RECOMMENDED_SAMPLES_PER_CLASS ? 'green' : 'cyan'} />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {phase === 'idle' ? (
                    <>
                      <Button variant="primary" icon={Circle} onClick={() => startRecording('train')} disabled={!live || !selected}>Record sample</Button>
                      <Button icon={RefreshCw} onClick={() => { setResult(null); setBurst(5); }} disabled={!live || !selected || burst > 0}>Record 5 in a row</Button>
                      <Button icon={Undo2} onClick={undoLast} disabled={!selected || !(sampleCounts.get(selected.id) ?? 0)}>Undo last</Button>
                    </>
                  ) : (
                    <Button variant="danger" icon={Square} onClick={cancelRecording}>Cancel</Button>
                  )}
                </div>
                {!live && <p className="text-xs text-slate-500">Start the camera to record. Tip: press <kbd className="rounded bg-navy-700 px-1">Space</kbd> to record.</p>}

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-navy-950/50 px-3 py-2 text-xs text-slate-400">
                  <span>Session <code className="text-cyan-300">{sessionId.slice(-6)}</code> · {sessionCount} sample(s) this session</span>
                  <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => { setSessionId(newSessionId()); setSessionCount(0); }}>New session</Button>
                </div>
                <p className="text-xs text-slate-500">
                  Start a new session when you change lighting, position, clothing or signer. Validation holds out whole sessions, so accuracy reflects new conditions instead of near-duplicate recordings.
                </p>

                {result && (
                  result.ok ? (
                    result.purpose === 'test' ? (
                      <Alert tone="cyan" icon={FlaskConical} title={`Test recording: ${result.verdict}`}>
                        {result.test?.map((t) => `${t.name} ${formatPercent(t.p, 0)}`).join(' · ')} — not saved.
                      </Alert>
                    ) : (
                      <Alert tone="green" icon={CheckCircle2}>Sample saved ({Math.round(result.validRatio * 100)}% frames with hands).</Alert>
                    )
                  ) : (
                    <Alert tone="red" icon={XCircle} title="Sample rejected">{result.reason}</Alert>
                  )
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle icon={Database} action={<Badge tone="slate">{app.totalSamples} samples</Badge>}>Dataset overview</CardTitle>
            {labels.length === 0 ? (
              <p className="text-sm text-slate-400">No labels yet.</p>
            ) : (
              <>
                <BarList target={RECOMMENDED_SAMPLES_PER_CLASS} items={labels.map((l) => ({ label: l.english, value: sampleCounts.get(l.id) ?? 0, sub: l.hindi || undefined }))} />
                <div className="mt-4 max-h-56 space-y-1 overflow-y-auto pr-1">
                  {labels.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
                      <button type="button" className="truncate text-left text-slate-200 hover:text-cyan-300" onClick={() => setSelectedId(l.id)}>
                        {l.english} <span className="text-slate-500">{l.hindi}</span>
                      </button>
                      <span className="flex gap-1">
                        <button type="button" className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label={`Edit ${l.english}`} onClick={() => { setEditing(l); setFormOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" className="rounded p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-300" aria-label={`Delete ${l.english}`} onClick={() => setConfirmDelete(l)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Collect {RECOMMENDED_SAMPLES_PER_CLASS}+ samples per sign across 2+ sessions. A "Background" label (hands resting or moving without signing) greatly reduces false positives.
            </p>
          </Card>

          <Card glow>
            <CardTitle icon={BrainCircuit} action={modelMeta ? <Badge tone={app.modelStale ? 'amber' : 'green'}>{app.modelStale ? 'Outdated' : 'Up to date'}</Badge> : <Badge>No model</Badge>}>Train classifier</CardTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Slider label="Epochs" value={settings.epochs} min={10} max={150} step={5} onChange={(v) => update({ epochs: v })} />
              <Toggle label="Augmentation" hint="Adds jittered copies of training samples" checked={settings.augment} onChange={(v) => update({ augment: v })} />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {trainableCount} of {labels.length} signs have ≥{MIN_SAMPLES_PER_CLASS} samples. Architecture: LSTM(64) → Dropout(0.3) → Dense(64, ReLU) → Dropout → Softmax({Math.max(trainableCount, 0)}).
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {training ? (
                <Button variant="danger" icon={Square} onClick={() => { stopRef.current = true; }}>Stop after this epoch</Button>
              ) : (
                <Button variant="primary" icon={modelMeta ? RefreshCw : Play} onClick={train} disabled={trainableCount < 2}>{modelMeta ? 'Retrain model' : 'Train model'}</Button>
              )}
              <Button icon={CheckCircle2} onClick={evaluate} disabled={!classifier || training}>Evaluate</Button>
              <Button icon={FlaskConical} onClick={() => startRecording('test')} disabled={!classifier || !live || phase !== 'idle'}>Test with new recording</Button>
              <Button variant="danger" icon={Trash2} onClick={deleteModel} disabled={!modelMeta || training}>Delete model</Button>
            </div>
            {trainableCount < 2 && <p className="mt-2 text-xs text-amber-300">Need at least two signs with {MIN_SAMPLES_PER_CLASS}+ samples to train.</p>}
            {trainError && <div className="mt-3"><Alert tone="red" icon={AlertTriangle}>{trainError}</Alert></div>}

            {training && (
              <div className="mt-4">
                <p className="mb-1 text-xs text-slate-400">Epoch {history.length} / {settings.epochs}</p>
                <ProgressBar value={history.length} max={settings.epochs} />
              </div>
            )}

            {shownHistory.length > 0 && (
              <div className="mt-5">
                <TrainingCharts history={shownHistory} />
                {(() => {
                  const last = shownHistory[shownHistory.length - 1];
                  return (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                      {[
                        ['Train acc', formatPercent(last.acc)],
                        ['Val acc', formatPercent(last.valAcc)],
                        ['Train loss', last.loss.toFixed(3)],
                        ['Val loss', last.valLoss === null ? '—' : last.valLoss.toFixed(3)],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-navy-950/60 p-2">
                          <p className="text-slate-500">{k}</p>
                          <p className="font-mono text-sm text-white">{v}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {modelMeta && !training && (
                  <p className="mt-2 text-xs text-slate-500">
                    Split: {modelMeta.split.trainCount} train / {modelMeta.split.valCount} validation ({modelMeta.split.strategy}-level){modelMeta.split.duplicatesRemoved ? ` · ${modelMeta.split.duplicatesRemoved} duplicates removed` : ''}.
                    {modelMeta.split.labelsWithSampleLevelSplit.length > 0 && ' Some signs were recorded in a single session, so their validation samples come from the same session and accuracy may be optimistic.'}
                    {modelMeta.split.valCount === 0 && ' No validation set — record more samples / sessions for a real accuracy estimate.'}
                  </p>
                )}
              </div>
            )}

            {shownEval && (
              <div className="mt-5 space-y-3">
                <p className="text-sm text-white">
                  Evaluation accuracy <span className="font-mono text-cyan-300">{formatPercent(shownEval.accuracy)}</span> on {shownEval.sampleCount} held-out samples
                </p>
                <p className="text-xs text-slate-500">{evaluation?.note}</p>
                <ConfusionMatrix names={evalNames} matrix={shownEval.confusion} />
                <table className="w-full text-xs">
                  <thead className="text-slate-500">
                    <tr><th className="text-left font-normal">Sign</th><th className="font-normal">Precision</th><th className="font-normal">Recall</th><th className="font-normal">Support</th></tr>
                  </thead>
                  <tbody>
                    {shownEval.perClass.map((c, i) => (
                      <tr key={c.labelId} className="text-center text-slate-300">
                        <td className="text-left">{evalNames[i]}</td>
                        <td>{formatPercent(c.precision, 0)}</td>
                        <td>{formatPercent(c.recall, 0)}</td>
                        <td>{c.support}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      <LabelFormModal open={formOpen} label={editing} onClose={() => setFormOpen(false)} onSaved={async (l) => { await refresh(); setSelectedId(l.id); }} />
      <Modal
        open={!!confirmDelete}
        title="Delete sign?"
        onClose={() => setConfirmDelete(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" icon={Trash2} onClick={async () => { if (confirmDelete) { await removeLabel(confirmDelete.id); await refresh(); } setConfirmDelete(null); }}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          "{confirmDelete?.english}" and its {sampleCounts.get(confirmDelete?.id ?? '') ?? 0} recorded samples will be permanently removed from this browser. Retrain the model afterwards.
        </p>
      </Modal>
    </div>
  );
}

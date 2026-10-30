import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BrainCircuit, FlaskConical, MessageSquareText, ScanLine, Volume2 } from 'lucide-react';
import { PredictionService, RecognitionSmoother } from '../ai/predictionService';
import { TrackedCamera } from '../components/Camera/TrackedCamera';
import { Alert, Badge, Button, Card, CardTitle, EmptyState, PageHeader } from '../components/Common/ui';
import { SpeechControls } from '../components/Speech/SpeechControls';
import { RecognitionPanel, type RecognitionView } from '../components/Translator/RecognitionPanel';
import { SentencePanel } from '../components/Translator/SentencePanel';
import { useAppData, useSentence, useSettings } from '../hooks/useAppContext';
import { useGestureDetector, useLandmarkDetector } from '../hooks/useDetectors';
import type { Detection } from '../hooks/useHandTracking';
import { useSpeech } from '../hooks/useSpeech';
import { incrementTranslationSessions, logActivity } from '../services/databaseService';
import type { FrameData } from '../types';
import { formatDateTime, formatPercent } from '../utils/format';

type Mode = 'isl' | 'generic';
const EMPTY_VIEW: RecognitionView = { status: 'idle', english: null, hindi: null, confidence: 0, top: [] };

export default function LiveTranslator() {
  const { settings } = useSettings();
  const { classifier, labels, modelMeta, modelStatus, modelStale, labelById } = useAppData();
  const sentence = useSentence();
  const speech = useSpeech();
  const [mode, setMode] = useState<Mode>('isl');
  const [view, setView] = useState<RecognitionView>(EMPTY_VIEW);
  const [lastWord, setLastWord] = useState<{ english: string; hindi: string } | null>(null);
  const [pending, setPending] = useState(false);

  const landmarkDetector = useLandmarkDetector(settings.engine, settings.delegate);
  const gestureDetector = useGestureDetector(settings.delegate);

  const thresholds = useMemo(
    () => ({ confidenceThreshold: settings.confidenceThreshold, minMargin: settings.minMargin, maxNovelty: settings.maxNovelty }),
    [settings.confidenceThreshold, settings.minMargin, settings.maxNovelty],
  );
  const smoothing = useMemo(
    () => ({ windowSize: settings.smoothingWindow, stableCount: Math.min(settings.stableFrames, settings.smoothingWindow), cooldownMs: settings.cooldownMs }),
    [settings.smoothingWindow, settings.stableFrames, settings.cooldownMs],
  );

  const service = useMemo(() => (classifier ? new PredictionService(classifier, labels, thresholds, smoothing) : null), [classifier, labels]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => service?.configure(thresholds, smoothing), [service, thresholds, smoothing]);
  const genericSmoother = useMemo(() => new RecognitionSmoother(smoothing), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => genericSmoother.setOptions(smoothing), [genericSmoother, smoothing]);

  const buffer = useRef<FrameData[]>([]);
  const lastPrediction = useRef(0);
  const latest = useRef({ settings, sentence, speech, labelById, modelMeta });
  latest.current = { settings, sentence, speech, labelById, modelMeta };

  const speakWord = useCallback((english: string, hindi: string) => {
    const { settings: s, speech: sp } = latest.current;
    sp.speak(s.speechLanguage === 'hi-IN' && hindi ? hindi : english, { fallbackText: english });
  }, []);

  const onEmit = useCallback(
    (english: string, hindi: string) => {
      const { settings: s, sentence: sn } = latest.current;
      setLastWord({ english, hindi });
      if (s.manualConfirmation) {
        setPending(true);
      } else {
        sn.append(english);
      }
      if (s.autoSpeak) speakWord(english, hindi);
    },
    [speakWord],
  );

  const onDetection = useCallback(
    (d: Detection) => {
      const now = performance.now();
      const { settings: s, labelById: byId, modelMeta: meta } = latest.current;

      if (mode === 'generic') {
        const g = d.gesture;
        const decision =
          d.frame.hands.length === 0
            ? ({ kind: 'no-hands' } as const)
            : g?.text && g.score >= 0.6
              ? ({ kind: 'sign', labelId: g.text, confidence: g.score } as const)
              : ({ kind: 'unknown', confidence: g?.score ?? 0, bestLabelId: g?.text ?? '' } as const);
        const st = genericSmoother.push(decision, now);
        setView({ status: st.status, english: st.labelId, hindi: null, confidence: st.confidence, top: [] });
        if (st.emitted && st.labelId) onEmit(st.labelId, '');
        return;
      }

      if (!service) return;
      buffer.current.push(d.frame);
      const cutoff = d.frame.timestamp - s.recordingDurationMs;
      while (buffer.current.length && buffer.current[0].timestamp < cutoff) buffer.current.shift();
      if (now - lastPrediction.current < s.predictionIntervalMs) return;
      lastPrediction.current = now;

      const out = service.process(buffer.current, now, s.recordingDurationMs * 0.8);
      const nameOf = (id: string, i: number) => byId(id)?.english ?? meta?.labelNames[i] ?? id;
      const top = out.prediction
        ? out.prediction.probabilities
            .map((p, i) => ({ name: nameOf(service.labelIds[i], i), p }))
            .sort((a, b) => b.p - a.p)
            .slice(0, 3)
        : [];
      const label = out.state.labelId ? byId(out.state.labelId) : undefined;
      const idx = out.state.labelId ? service.labelIds.indexOf(out.state.labelId) : -1;
      const english = label?.english ?? (idx >= 0 ? meta?.labelNames[idx] : null) ?? null;
      setView({ status: out.state.status, english, hindi: label?.hindi ?? null, confidence: out.prediction?.confidence ?? 0, top });
      if (out.state.emitted && english) onEmit(english, label?.hindi ?? '');
    },
    [mode, service, genericSmoother, onEmit],
  );

  useEffect(() => {
    buffer.current = [];
    service?.reset();
    genericSmoother.reset();
    setView(EMPTY_VIEW);
  }, [mode, service, genericSmoother]);

  const onLiveChange = useCallback(
    (live: boolean) => {
      if (!live) return;
      incrementTranslationSessions().catch(() => undefined);
      logActivity('translation-session', mode === 'isl' ? 'Started a live translation session' : 'Started the generic gesture demo').catch(() => undefined);
    },
    [mode],
  );

  const addCurrent = () => {
    if (!lastWord) return;
    // Manual adds bypass the duplicate filter's window by design only when confirming.
    sentence.append(lastWord.english);
    setPending(false);
  };

  const hindiFor = useCallback((w: string) => labels.find((l) => l.english === w)?.hindi || undefined, [labels]);
  const islReady = modelStatus === 'ready' && service;

  return (
    <div>
      <PageHeader
        eyebrow="Real-time recognition"
        title="Live Translator"
        subtitle="Hand landmarks are extracted on-device with MediaPipe and classified by your locally trained LSTM. Only the signs you trained can be recognised."
        actions={
          <div className="inline-flex rounded-xl border border-white/10 bg-navy-900 p-1" role="tablist" aria-label="Recognition mode">
            <button type="button" role="tab" aria-selected={mode === 'isl'} onClick={() => setMode('isl')} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${mode === 'isl' ? 'bg-gradient-to-r from-electric-500 to-cyan-500 text-white' : 'text-slate-300'}`}>
              <BrainCircuit className="h-4 w-4" /> ISL vocabulary
            </button>
            <button type="button" role="tab" aria-selected={mode === 'generic'} onClick={() => setMode('generic')} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${mode === 'generic' ? 'bg-amber-400 text-navy-950' : 'text-slate-300'}`}>
              <FlaskConical className="h-4 w-4" /> Generic gesture demo
            </button>
          </div>
        }
      />

      {mode === 'generic' && (
        <div className="mb-5 rounded-xl border-2 border-amber-400/60 bg-amber-400/10 p-3 text-center font-display text-sm font-semibold tracking-wider text-amber-200" role="note">
          GENERIC GESTURE DEMO — NOT ISL TRANSLATION. Uses MediaPipe's stock gesture model (thumbs up, open palm, …). These are not Indian Sign Language words.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          {mode === 'isl' && !islReady ? (
            <Card>
              {modelStatus === 'loading' ? (
                <EmptyState icon={BrainCircuit} title="Loading your model…" />
              ) : (
                <EmptyState
                  icon={BrainCircuit}
                  title={modelStatus === 'error' ? 'Saved model could not be loaded' : 'No trained model yet'}
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Link to="/training"><Button variant="primary" icon={BrainCircuit}>Open Training Studio</Button></Link>
                      <Button icon={FlaskConical} onClick={() => setMode('generic')}>Try generic gesture demo</Button>
                    </div>
                  }
                >
                  SignBridge does not ship a pre-trained ISL model. Record samples for at least two signs (20–30 each recommended) and train the classifier — it takes a couple of minutes.
                </EmptyState>
              )}
            </Card>
          ) : (
            <TrackedCamera
              key={mode}
              createDetector={mode === 'isl' ? landmarkDetector : gestureDetector}
              detectorLabel={mode === 'isl' ? 'MediaPipe Hand Landmarker' : 'MediaPipe Gesture Recognizer'}
              onDetection={onDetection}
              onLiveChange={onLiveChange}
            />
          )}

          <Card>
            <CardTitle icon={ScanLine}>Model status</CardTitle>
            {mode === 'isl' ? (
              modelMeta ? (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={modelStatus === 'ready' ? 'green' : 'red'}>{modelStatus === 'ready' ? 'Loaded' : 'Error'}</Badge>
                    <Badge tone="blue">{modelMeta.labelIds.length} classes</Badge>
                    <Badge tone="slate">{modelMeta.sampleCount} samples</Badge>
                    <Badge tone="cyan">val. acc. {formatPercent(modelMeta.evaluation?.accuracy)}</Badge>
                  </div>
                  <p className="text-xs text-slate-400">Trained {formatDateTime(modelMeta.trainedAt)} · dataset {modelMeta.datasetVersion}</p>
                  <p className="text-xs text-slate-400">Vocabulary: {modelMeta.labelIds.map((id, i) => labelById(id)?.english ?? modelMeta.labelNames[i]).join(', ')}</p>
                  {modelStale && (
                    <Alert tone="amber" icon={AlertTriangle}>
                      Your samples changed since this model was trained. <Link className="underline" to="/training">Retrain</Link> to include them.
                    </Alert>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No model trained.</p>
              )
            ) : (
              <p className="text-sm text-slate-400">MediaPipe Gesture Recognizer (Google, canned 7-gesture model). Requires <code className="text-cyan-300">gesture_recognizer.task</code> from <code className="text-cyan-300">npm run models:download</code>.</p>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Threshold {formatPercent(settings.confidenceThreshold, 0)} · margin {formatPercent(settings.minMargin, 0)} · {settings.stableFrames}/{settings.smoothingWindow} stable windows · cooldown {settings.cooldownMs} ms ·{' '}
              <Link to="/settings" className="text-cyan-400 hover:underline">adjust</Link>
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card glow>
            <CardTitle icon={BrainCircuit}>{mode === 'isl' ? 'Recognised sign' : 'Detected generic gesture'}</CardTitle>
            <RecognitionPanel
              view={view}
              lastWord={lastWord}
              pendingConfirmation={pending}
              onAdd={addCurrent}
              onSpeak={() => lastWord && speakWord(lastWord.english, lastWord.hindi)}
            />
          </Card>
          <Card>
            <CardTitle icon={MessageSquareText} action={<Link to="/sentence" className="text-xs text-cyan-400 hover:underline">Open builder</Link>}>Sentence</CardTitle>
            <SentencePanel hindiFor={hindiFor} />
          </Card>
          <Card>
            <CardTitle icon={Volume2}>Speech</CardTitle>
            <SpeechControls compact />
          </Card>
        </div>
      </div>
    </div>
  );
}

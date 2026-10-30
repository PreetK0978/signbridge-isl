import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FEATURE_VERSION } from '../ai/featureExtractor';
import { DEFAULT_CLASSIFIER_CONFIG, LstmClassifier } from '../ai/lstmClassifier';
import { MIN_SAMPLES_PER_CLASS, type TrainResult } from '../ai/trainingService';
import {
  addHistory,
  countSamplesByLabel,
  deleteMeta,
  getLabels,
  getModelMeta,
  logActivity,
  MODEL_META_KEY,
  setMeta,
} from '../services/databaseService';
import type { AppSettings, ModelMeta, SignLabel } from '../types';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../utils/settings';
import {
  appendWord,
  clearSentence,
  EMPTY_SENTENCE,
  removeLastWord,
  sentenceText,
  setSentenceText,
  type SentenceState,
} from '../utils/sentence';
import { AppDataContext, SentenceContext, SettingsContext, type ModelStatus } from './contexts';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);
  const reset = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  }, []);
  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<SignLabel[]>([]);
  const [sampleCounts, setSampleCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [classifier, setClassifier] = useState<LstmClassifier | null>(null);
  const [modelMeta, setModelMeta] = useState<ModelMeta | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('loading');
  const [modelError, setModelError] = useState<string | null>(null);
  const classifierRef = useRef<LstmClassifier | null>(null);

  const refresh = useCallback(async () => {
    const [l, c] = await Promise.all([getLabels(), countSamplesByLabel()]);
    setLabels(l);
    setSampleCounts(c);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      const meta = await getModelMeta();
      if (cancelled) return;
      if (!meta) {
        setModelStatus('none');
        return;
      }
      if (!meta.normalization || meta.normalization.version !== FEATURE_VERSION) {
        setModelMeta(meta);
        setModelStatus('error');
        setModelError('Your saved model was trained by an older SignBridge version with less accurate motion features. Your samples are kept: open the Training Studio and press "Retrain model".');
        return;
      }
      try {
        const loaded = await LstmClassifier.load(meta.labelIds, meta.normalization, undefined, meta.openSet ?? null);
        if (cancelled) {
          loaded.dispose();
          return;
        }
        classifierRef.current = loaded;
        setClassifier(loaded);
        setModelMeta(meta);
        setModelStatus('ready');
      } catch (err) {
        setModelMeta(meta);
        setModelStatus('error');
        setModelError(`Saved model could not be loaded: ${err instanceof Error ? err.message : String(err)}. Retrain to fix.`);
      }
    })().catch((err) => {
      setLoading(false);
      setModelStatus('error');
      setModelError(err instanceof Error ? err.message : String(err));
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => () => classifierRef.current?.dispose(), []);

  const saveTrainedModel = useCallback(async (result: TrainResult, epochs: number) => {
    await result.classifier.save();
    const meta: ModelMeta = {
      labelIds: result.classifier.labelIds,
      labelNames: result.labels.map((l) => l.english),
      datasetVersion: result.datasetVersion,
      trainedAt: Date.now(),
      sampleCount: result.sampleCount,
      epochs,
      history: result.history,
      evaluation: result.evaluation,
      split: result.split,
      architecture: DEFAULT_CLASSIFIER_CONFIG,
      normalization: result.classifier.normalization,
      openSet: result.classifier.openSet,
    };
    await setMeta(MODEL_META_KEY, meta);
    const acc = result.evaluation ? ` — validation accuracy ${(result.evaluation.accuracy * 100).toFixed(1)}%` : '';
    await logActivity('model-trained', `Trained model on ${meta.labelIds.length} signs, ${meta.sampleCount} samples${acc}`);
    if (classifierRef.current && classifierRef.current !== result.classifier) classifierRef.current.dispose();
    classifierRef.current = result.classifier;
    setClassifier(result.classifier);
    setModelMeta(meta);
    setModelStatus('ready');
    setModelError(null);
  }, []);

  const deleteModel = useCallback(async () => {
    await LstmClassifier.remove();
    await deleteMeta(MODEL_META_KEY);
    await logActivity('model-deleted', 'Deleted the trained model');
    classifierRef.current?.dispose();
    classifierRef.current = null;
    setClassifier(null);
    setModelMeta(null);
    setModelStatus('none');
    setModelError(null);
  }, []);

  const modelStale = useMemo(() => {
    if (!modelMeta) return false;
    const trained = new Set(modelMeta.labelIds);
    const total = modelMeta.labelIds.reduce((a, id) => a + (sampleCounts.get(id) ?? 0), 0);
    const missing = modelMeta.labelIds.some((id) => !labels.some((l) => l.id === id));
    const newTrainable = labels.some((l) => !trained.has(l.id) && (sampleCounts.get(l.id) ?? 0) >= MIN_SAMPLES_PER_CLASS);
    return total !== modelMeta.sampleCount || missing || newTrainable;
  }, [modelMeta, labels, sampleCounts]);

  const labelById = useCallback((id: string) => labels.find((l) => l.id === id), [labels]);
  const totalSamples = useMemo(() => [...sampleCounts.values()].reduce((a, b) => a + b, 0), [sampleCounts]);

  const value = useMemo(
    () => ({
      labels,
      sampleCounts,
      totalSamples,
      loading,
      refresh,
      classifier,
      modelMeta,
      modelStatus,
      modelError,
      modelStale,
      saveTrainedModel,
      deleteModel,
      labelById,
    }),
    [labels, sampleCounts, totalSamples, loading, refresh, classifier, modelMeta, modelStatus, modelError, modelStale, saveTrainedModel, deleteModel, labelById],
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function SentenceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SentenceState>(EMPTY_SENTENCE);
  const stateRef = useRef(state);
  stateRef.current = state;

  const append = useCallback((word: string) => {
    const next = appendWord(stateRef.current, word, Date.now());
    const changed = next !== stateRef.current;
    if (changed) {
      stateRef.current = next;
      setState(next);
    }
    return changed;
  }, []);
  const removeLast = useCallback(() => setState((s) => removeLastWord(s)), []);
  const clear = useCallback(() => setState(clearSentence()), []);
  const setText = useCallback((text: string) => setState(setSentenceText(text)), []);
  const saveToHistory = useCallback(async () => {
    const text = sentenceText(stateRef.current.words);
    if (!text) return false;
    await addHistory(text);
    await logActivity('sentence-saved', `Saved sentence "${text.length > 40 ? `${text.slice(0, 40)}…` : text}"`);
    return true;
  }, []);

  const value = useMemo(
    () => ({ state, text: sentenceText(state.words), append, removeLast, clear, setText, saveToHistory }),
    [state, append, removeLast, clear, setText, saveToHistory],
  );
  return <SentenceContext.Provider value={value}>{children}</SentenceContext.Provider>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <AppDataProvider>
        <SentenceProvider>{children}</SentenceProvider>
      </AppDataProvider>
    </SettingsProvider>
  );
}

import * as tf from '@tensorflow/tfjs';
import { FEATURE_SIZE, SEQUENCE_LENGTH } from './constants';
import { DEFAULT_CLASSIFIER_CONFIG, LstmClassifier } from './lstmClassifier';
import { fnv1a, seededRandom, shuffle } from '../utils/hash';
import type {
  ClassReport,
  ClassifierConfig,
  EpochMetrics,
  EvaluationResult,
  SignLabel,
  SplitInfo,
  TrainingSample,
} from '../types';

export const MIN_SAMPLES_PER_CLASS = 4;
export const RECOMMENDED_SAMPLES_PER_CLASS = 25;

/** Content fingerprint of a sample, used to drop exact / near-exact duplicates before splitting. */
export function sampleFingerprint(sample: TrainingSample): string {
  return fnv1a(sample.frames.map((row) => row.map((v) => v.toFixed(4)).join(',')).join(';'));
}

export function dedupeSamples(samples: TrainingSample[]): { unique: TrainingSample[]; removed: number } {
  const seen = new Set<string>();
  const unique: TrainingSample[] = [];
  for (const s of samples) {
    const key = sampleFingerprint(s);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }
  return { unique, removed: samples.length - unique.length };
}

/** Version string that changes whenever labels or samples change. */
export function computeDatasetVersion(labels: SignLabel[], samples: TrainingSample[]): string {
  const l = labels.map((x) => `${x.id}:${x.english}:${x.isBackground ? 1 : 0}`).sort().join('|');
  const s = samples.map((x) => `${x.id}:${x.labelId}`).sort().join('|');
  return `ds-${fnv1a(l)}${fnv1a(s)}`;
}

export interface DatasetSplit {
  train: TrainingSample[];
  validation: TrainingSample[];
  info: SplitInfo;
}

/**
 * Hold out whole recording sessions per label so near-identical consecutive recordings
 * never appear in both train and validation. Labels recorded in a single session fall
 * back to a sample-level split (reported in `labelsWithSampleLevelSplit`, since that
 * split can overestimate accuracy). Duplicates are removed first.
 */
export function splitDataset(samples: TrainingSample[], validationRatio = 0.2, seed = 42): DatasetSplit {
  const { unique, removed } = dedupeSamples(samples);
  const rand = seededRandom(seed);
  const byLabel = new Map<string, TrainingSample[]>();
  for (const s of unique) byLabel.set(s.labelId, [...(byLabel.get(s.labelId) ?? []), s]);

  const train: TrainingSample[] = [];
  const validation: TrainingSample[] = [];
  const sampleLevel: string[] = [];
  let sessionLevel = 0;

  for (const [labelId, items] of byLabel) {
    const sessions = new Map<string, TrainingSample[]>();
    for (const s of items) sessions.set(s.sessionId, [...(sessions.get(s.sessionId) ?? []), s]);
    const target = Math.max(1, Math.round(items.length * validationRatio));

    if (sessions.size >= 2) {
      sessionLevel++;
      const order = shuffle([...sessions.keys()], rand);
      let held = 0;
      for (let i = 0; i < order.length; i++) {
        const group = sessions.get(order[i])!;
        // Always keep at least one session for training.
        if (held < target && i < order.length - 1) {
          validation.push(...group);
          held += group.length;
        } else {
          train.push(...group);
        }
      }
    } else if (items.length >= 5) {
      sampleLevel.push(labelId);
      const shuffled = shuffle(items, rand);
      validation.push(...shuffled.slice(0, target));
      train.push(...shuffled.slice(target));
    } else {
      train.push(...items);
    }
  }

  let strategy: SplitInfo['strategy'] = 'none';
  if (validation.length > 0) {
    if (sessionLevel > 0 && sampleLevel.length > 0) strategy = 'mixed';
    else if (sessionLevel > 0) strategy = 'session';
    else strategy = 'sample';
  }

  return {
    train,
    validation,
    info: {
      trainCount: train.length,
      valCount: validation.length,
      strategy,
      duplicatesRemoved: removed,
      labelsWithSampleLevelSplit: sampleLevel,
    },
  };
}

/** Small jitter + scale augmentation applied to present-hand values only (padding stays zero). */
export function augmentSample(sample: TrainingSample, rand: () => number, noise = 0.02, scaleJitter = 0.05): TrainingSample {
  const gauss = () => {
    const u = Math.max(rand(), 1e-9);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const scale = 1 + (rand() * 2 - 1) * scaleJitter;
  const half = FEATURE_SIZE / 2;
  const frames = sample.frames.map((row, t) =>
    row.map((v, i) => (sample.validity[t][i < half ? 0 : 1] ? v * scale + gauss() * noise : 0)),
  );
  return { ...sample, id: `${sample.id}-aug`, frames };
}

export function countSamples(samples: TrainingSample[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of samples) counts.set(s.labelId, (counts.get(s.labelId) ?? 0) + 1);
  return counts;
}

/** Which labels have enough data to be part of a model. */
export function trainableLabels(labels: SignLabel[], samples: TrainingSample[], min = MIN_SAMPLES_PER_CLASS): SignLabel[] {
  const counts = countSamples(samples);
  return labels.filter((l) => (counts.get(l.id) ?? 0) >= min);
}

function toTensors(samples: TrainingSample[], labelIds: string[]) {
  const index = new Map(labelIds.map((id, i) => [id, i]));
  const xs = tf.tensor3d(
    samples.map((s) => s.frames),
    [samples.length, SEQUENCE_LENGTH, FEATURE_SIZE],
  );
  const ys = tf.tidy(() =>
    tf.oneHot(
      tf.tensor1d(
        samples.map((s) => index.get(s.labelId)!),
        'int32',
      ),
      labelIds.length,
    ),
  );
  return { xs, ys };
}

export function evaluateClassifier(
  classifier: LstmClassifier,
  samples: TrainingSample[],
  labelNames: Map<string, string>,
): EvaluationResult {
  const ids = classifier.labelIds;
  const index = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const confusion = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const relevant = samples.filter((s) => index.has(s.labelId));
  const predictions = classifier.predictBatch(relevant.map((s) => s.frames));
  let correct = 0;
  relevant.forEach((s, i) => {
    const actual = index.get(s.labelId)!;
    const predicted = predictions[i].index;
    confusion[actual][predicted]++;
    if (actual === predicted) correct++;
  });
  const perClass: ClassReport[] = ids.map((id, i) => {
    const tp = confusion[i][i];
    const support = confusion[i].reduce((a, b) => a + b, 0);
    const predictedCount = confusion.reduce((a, row) => a + row[i], 0);
    return {
      labelId: id,
      name: labelNames.get(id) ?? id,
      precision: predictedCount ? tp / predictedCount : 0,
      recall: support ? tp / support : 0,
      support,
    };
  });
  return {
    accuracy: relevant.length ? correct / relevant.length : 0,
    confusion,
    labelIds: ids,
    perClass,
    sampleCount: relevant.length,
  };
}

export interface TrainOptions {
  labels: SignLabel[];
  samples: TrainingSample[];
  epochs?: number;
  batchSize?: number;
  validationRatio?: number;
  augment?: boolean;
  config?: ClassifierConfig;
  seed?: number;
  onEpoch?: (metrics: EpochMetrics) => void;
  shouldStop?: () => boolean;
}

export interface TrainResult {
  classifier: LstmClassifier;
  history: EpochMetrics[];
  evaluation: EvaluationResult | null;
  split: SplitInfo;
  labels: SignLabel[];
  datasetVersion: string;
  sampleCount: number;
}

export class TrainingError extends Error {}

const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Train a fresh LSTM on the current vocabulary. Metrics are the real values reported by TF.js. */
export async function trainClassifier(options: TrainOptions): Promise<TrainResult> {
  const {
    epochs = 40,
    batchSize = 16,
    validationRatio = 0.2,
    augment = true,
    config = DEFAULT_CLASSIFIER_CONFIG,
    seed = 42,
  } = options;

  const labels = trainableLabels(options.labels, options.samples);
  if (labels.length < 2) {
    throw new TrainingError(
      `Need at least two signs with ${MIN_SAMPLES_PER_CLASS}+ samples each (found ${labels.length}).`,
    );
  }
  const labelIds = labels.map((l) => l.id);
  const allowed = new Set(labelIds);
  const samples = options.samples.filter((s) => allowed.has(s.labelId));
  const split = splitDataset(samples, validationRatio, seed);

  let train = split.train;
  if (augment) {
    const rand = seededRandom(seed + 1);
    train = [...train, ...train.map((s) => augmentSample(s, rand))];
  }

  const classifier = LstmClassifier.create(labelIds, config);
  const { xs, ys } = toTensors(train, labelIds);
  const val = split.validation.length ? toTensors(split.validation, labelIds) : null;
  const history: EpochMetrics[] = [];

  try {
    await classifier.model.fit(xs, ys, {
      epochs,
      batchSize,
      shuffle: true,
      validationData: val ? [val.xs, val.ys] : undefined,
      // TF.js's default yielding uses requestAnimationFrame, which stalls in background tabs.
      // Yield with timers instead so training keeps progressing and the UI stays responsive.
      yieldEvery: 'never',
      callbacks: {
        onBatchEnd: () => yieldToEventLoop(),
        onEpochEnd: async (epoch, logs) => {
          const m: EpochMetrics = {
            epoch: epoch + 1,
            loss: logs?.loss ?? NaN,
            acc: logs?.acc ?? logs?.accuracy ?? NaN,
            valLoss: val ? (logs?.val_loss ?? null) : null,
            valAcc: val ? (logs?.val_acc ?? logs?.val_accuracy ?? null) : null,
          };
          history.push(m);
          options.onEpoch?.(m);
          if (options.shouldStop?.()) classifier.model.stopTraining = true;
          await yieldToEventLoop();
        },
      },
    });
  } catch (err) {
    classifier.dispose();
    throw err;
  } finally {
    xs.dispose();
    ys.dispose();
    val?.xs.dispose();
    val?.ys.dispose();
  }

  const names = new Map(labels.map((l) => [l.id, l.english]));
  const evaluation = split.validation.length ? evaluateClassifier(classifier, split.validation, names) : null;

  return {
    classifier,
    history,
    evaluation,
    split: split.info,
    labels,
    datasetVersion: computeDatasetVersion(labels, samples),
    sampleCount: samples.length,
  };
}

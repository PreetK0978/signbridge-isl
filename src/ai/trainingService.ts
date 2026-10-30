import * as tf from '@tensorflow/tfjs';
import { FEATURE_SIZE, SEQUENCE_LENGTH } from './constants';
import { applyNormalization, computeNormalization, extractFeatures, MODEL_FEATURES } from './featureExtractor';
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

const gaussian = (rand: () => number) => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-9))) * Math.cos(2 * Math.PI * rand());

/**
 * Realistic augmentation on the stored landmark sequence (padding stays zero):
 * in-plane rotation of the whole signer (±0.25 rad), global scale, time warp (speed 0.8–1.25×
 * with a random start offset, so the gesture lands at different points of the window),
 * landmark jitter, and occasional dropped frames.
 */
export function augmentSample(sample: TrainingSample, rand: () => number, copyIndex = 0): TrainingSample {
  const T = sample.frames.length;
  const angle = (rand() * 2 - 1) * 0.25;
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  const k = 1 + (rand() * 2 - 1) * 0.1;
  const speed = 0.8 + rand() * 0.45;
  const span = (T - 1) * speed;
  const offset = (rand() * 2 - 1) * Math.abs(T - 1 - span) * 0.5 + (T - 1 - span) / 2;
  const noise = 0.03;
  const half = FEATURE_SIZE / 2;
  const frames: number[][] = [];
  const validity: number[][] = [];
  for (let t = 0; t < T; t++) {
    const src = Math.min(T - 1, Math.max(0, offset + (t * span) / (T - 1)));
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, T - 1);
    const f = src - i0;
    const row = new Array<number>(FEATURE_SIZE).fill(0);
    const val = [0, 0];
    for (let s = 0; s < 2; s++) {
      const v0 = sample.validity[i0][s];
      const v1 = sample.validity[i1][s];
      if (!v0 && !v1) continue;
      if (rand() < 0.03) continue; // dropped detection
      val[s] = 1;
      for (let j = s * half; j < (s + 1) * half; j += 3) {
        const p = [0, 1, 2].map((d) => (v0 && v1 ? sample.frames[i0][j + d] * (1 - f) + sample.frames[i1][j + d] * f : (v0 ? sample.frames[i0] : sample.frames[i1])[j + d]));
        row[j] = (p[0] * c - p[1] * sn) * k + gaussian(rand) * noise;
        row[j + 1] = (p[0] * sn + p[1] * c) * k + gaussian(rand) * noise;
        row[j + 2] = p[2] * k + gaussian(rand) * noise;
      }
    }
    frames.push(row);
    validity.push(val);
  }
  return { ...sample, id: `${sample.id}-aug${copyIndex}`, frames, validity };
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

function toTensors(inputs: number[][][], samples: TrainingSample[], labelIds: string[]) {
  const index = new Map(labelIds.map((id, i) => [id, i]));
  const xs = tf.tensor3d(inputs, [inputs.length, SEQUENCE_LENGTH, MODEL_FEATURES]);
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
  /** Augmented copies per training sample. */
  augmentCopies?: number;
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
    augmentCopies = 2,
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
    const copies: TrainingSample[] = [];
    for (let c = 0; c < augmentCopies; c++) for (const s of split.train) copies.push(augmentSample(s, rand, c));
    train = [...train, ...copies];
  }

  // Standardisation statistics come from the training split only (no validation leakage).
  const trainFeatures = train.map((s) => extractFeatures(s.frames, s.validity));
  const normalization = computeNormalization(trainFeatures);
  const classifier = LstmClassifier.create(labelIds, normalization, config);
  const { xs, ys } = toTensors(
    trainFeatures.map((f) => applyNormalization(f, normalization)),
    train,
    labelIds,
  );
  const val = split.validation.length
    ? toTensors(
        split.validation.map((s) => applyNormalization(extractFeatures(s.frames, s.validity), normalization)),
        split.validation,
        labelIds,
      )
    : null;
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

  // Open-set statistics from the real (non-augmented) training samples.
  const labelIndex = new Map(labelIds.map((id, i) => [id, i]));
  classifier.fitOpenSet(
    trainFeatures.slice(0, split.train.length).map((f) => applyNormalization(f, normalization)),
    split.train.map((s) => labelIndex.get(s.labelId)!),
  );

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

import * as tf from '@tensorflow/tfjs';
import { SEQUENCE_LENGTH } from './constants';
import { FEATURE_VERSION, MODEL_FEATURES, toModelInput, type FeatureNormalization } from './featureExtractor';
import type { ClassifierConfig } from '../types';

export const DEFAULT_CLASSIFIER_CONFIG: ClassifierConfig = {
  convFilters: 64,
  lstmUnits: 64,
  denseUnits: 64,
  dropout: 0.3,
  learningRate: 0.002,
};

export const MODEL_STORAGE_URL = 'indexeddb://signbridge-isl-classifier';

/**
 * Input [30, MODEL_FEATURES] → Conv1D (local motion patterns, k=3) → LSTM → Dropout →
 * Dense(ReLU) → Dropout → Dense(softmax, numClasses). Set convFilters to 0 for a plain LSTM.
 * The output layer is sized from the current vocabulary.
 */
export function buildLstmModel(numClasses: number, config: ClassifierConfig = DEFAULT_CLASSIFIER_CONFIG, inputSize = MODEL_FEATURES): tf.LayersModel {
  if (numClasses < 2) throw new Error('A classifier needs at least two classes.');
  const model = tf.sequential({ name: 'signbridge_lstm' });
  model.add(tf.layers.inputLayer({ inputShape: [SEQUENCE_LENGTH, inputSize] }));
  if (config.convFilters > 0) model.add(tf.layers.conv1d({ filters: config.convFilters, kernelSize: 3, padding: 'same', activation: 'relu' }));
  // Glorot instead of the default orthogonal recurrent initialiser: same accuracy here, much faster to build.
  model.add(tf.layers.lstm({ units: config.lstmUnits, returnSequences: false, recurrentInitializer: 'glorotUniform' }));
  model.add(tf.layers.dropout({ rate: config.dropout }));
  model.add(tf.layers.dense({ units: config.denseUnits, activation: 'relu' }));
  model.add(tf.layers.dropout({ rate: config.dropout }));
  model.add(tf.layers.dense({ units: numClasses, activation: 'softmax' }));
  model.compile({
    optimizer: tf.train.adam(config.learningRate),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });
  return model;
}

export interface Prediction {
  index: number;
  confidence: number;
  /** Difference between best and second-best probability. */
  margin: number;
  probabilities: number[];
  /**
   * Open-set novelty: distance from the input's embedding to the predicted class centre,
   * divided by that class's radius on training data. > 1 means "unlike anything trained".
   */
  novelty?: number;
}

/** Class centres and radii in the penultimate-layer embedding space (open-set rejection). */
export interface OpenSetStats {
  centroids: number[][];
  radii: number[];
}

function euclid(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

/** Turn a probability vector into the top prediction. */
export function topPrediction(probabilities: number[]): Prediction {
  let best = 0;
  let second = -1;
  for (let i = 1; i < probabilities.length; i++) {
    if (probabilities[i] > probabilities[best]) {
      second = best;
      best = i;
    } else if (second === -1 || probabilities[i] > probabilities[second]) {
      second = i;
    }
  }
  const secondP = second >= 0 ? probabilities[second] : 0;
  return { index: best, confidence: probabilities[best], margin: probabilities[best] - secondP, probabilities };
}

/** Trained model + the feature normalisation it was trained with. Accepts stored [30,126] sequences. */
export class LstmClassifier {
  private embedder: tf.LayersModel;

  constructor(
    public model: tf.LayersModel,
    public readonly labelIds: string[],
    public readonly normalization: FeatureNormalization,
    public openSet: OpenSetStats | null = null,
  ) {
    const units = (model.outputs[0].shape as number[])[1];
    if (units !== labelIds.length) throw new Error(`Model has ${units} outputs but ${labelIds.length} labels were supplied.`);
    if (normalization.version !== FEATURE_VERSION) throw new Error('This model was trained with an older feature format. Retrain it.');
    // Penultimate Dense layer (before the final dropout + softmax) = embedding used for open-set checks.
    this.embedder = tf.model({ inputs: model.inputs, outputs: model.layers[model.layers.length - 3].output as tf.SymbolicTensor });
  }

  static create(labelIds: string[], normalization: FeatureNormalization, config?: ClassifierConfig): LstmClassifier {
    return new LstmClassifier(buildLstmModel(labelIds.length, config), labelIds, normalization);
  }

  /** Embeddings for pre-computed model inputs. */
  embedInputs(inputs: number[][][]): number[][] {
    if (inputs.length === 0) return [];
    return tf.tidy(() => (this.embedder.predict(tf.tensor3d(inputs, [inputs.length, SEQUENCE_LENGTH, MODEL_FEATURES])) as tf.Tensor2D).arraySync());
  }

  /**
   * Fit open-set statistics from training inputs: per-class centre of the embeddings and a
   * radius = 95th-percentile distance × margin factor.
   */
  fitOpenSet(inputs: number[][][], labelIdx: number[], factor = 1.5): void {
    const emb = this.embedInputs(inputs);
    const dim = emb[0]?.length ?? 0;
    const centroids = this.labelIds.map((_, c) => {
      const rows = emb.filter((_, i) => labelIdx[i] === c);
      const m = new Array<number>(dim).fill(0);
      for (const r of rows) for (let d = 0; d < dim; d++) m[d] += r[d] / rows.length;
      return m;
    });
    const radii = this.labelIds.map((_, c) => {
      const ds = emb.filter((_, i) => labelIdx[i] === c).map((r) => euclid(r, centroids[c])).sort((a, b) => a - b);
      const q = ds.length ? ds[Math.min(ds.length - 1, Math.floor(ds.length * 0.95))] : 1;
      return Math.max(q * factor, 1e-3);
    });
    this.openSet = { centroids, radii };
  }

  /** Probabilities (and novelty, when open-set stats exist) for model inputs [n, 30, F]. */
  predictInputs(inputs: number[][][]): Prediction[] {
    if (inputs.length === 0) return [];
    const data = tf.tidy(() => (this.model.predict(tf.tensor3d(inputs, [inputs.length, SEQUENCE_LENGTH, MODEL_FEATURES])) as tf.Tensor2D).arraySync());
    const preds = data.map(topPrediction);
    if (this.openSet) {
      const emb = this.embedInputs(inputs);
      preds.forEach((p, i) => {
        p.novelty = euclid(emb[i], this.openSet!.centroids[p.index]) / this.openSet!.radii[p.index];
      });
    }
    return preds;
  }

  /** Predict one stored [30, 126] sequence. */
  predict(sequence: number[][]): Prediction {
    return this.predictInputs([toModelInput(sequence, this.normalization)])[0];
  }

  predictBatch(sequences: number[][][]): Prediction[] {
    return this.predictInputs(sequences.map((s) => toModelInput(s, this.normalization)));
  }

  async save(url = MODEL_STORAGE_URL): Promise<void> {
    await this.model.save(url);
  }

  static async load(labelIds: string[], normalization: FeatureNormalization, url = MODEL_STORAGE_URL, openSet: OpenSetStats | null = null): Promise<LstmClassifier> {
    const model = await tf.loadLayersModel(url);
    return new LstmClassifier(model, labelIds, normalization, openSet);
  }

  static async remove(url = MODEL_STORAGE_URL): Promise<void> {
    try {
      await tf.io.removeModel(url);
    } catch {
      // nothing stored
    }
  }

  dispose(): void {
    this.model.dispose();
  }
}

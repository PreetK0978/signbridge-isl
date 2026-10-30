import * as tf from '@tensorflow/tfjs';
import { FEATURE_SIZE, SEQUENCE_LENGTH } from './constants';
import type { ClassifierConfig } from '../types';

export const DEFAULT_CLASSIFIER_CONFIG: ClassifierConfig = {
  lstmUnits: 64,
  denseUnits: 64,
  dropout: 0.3,
  learningRate: 0.001,
};

export const MODEL_STORAGE_URL = 'indexeddb://signbridge-isl-classifier';

/**
 * Input [30, 126] → LSTM → Dropout → Dense(ReLU) → Dropout → Dense(softmax, numClasses).
 * The output layer is sized from the current vocabulary, so the model is rebuilt whenever
 * the set of labels changes.
 */
export function buildLstmModel(numClasses: number, config: ClassifierConfig = DEFAULT_CLASSIFIER_CONFIG): tf.LayersModel {
  if (numClasses < 2) throw new Error('A classifier needs at least two classes.');
  const model = tf.sequential({ name: 'signbridge_lstm' });
  model.add(tf.layers.inputLayer({ inputShape: [SEQUENCE_LENGTH, FEATURE_SIZE] }));
  model.add(tf.layers.lstm({ units: config.lstmUnits, returnSequences: false }));
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

export class LstmClassifier {
  constructor(
    public model: tf.LayersModel,
    public readonly labelIds: string[],
  ) {
    const units = (model.outputs[0].shape as number[])[1];
    if (units !== labelIds.length) {
      throw new Error(`Model has ${units} outputs but ${labelIds.length} labels were supplied.`);
    }
  }

  static create(labelIds: string[], config?: ClassifierConfig): LstmClassifier {
    return new LstmClassifier(buildLstmModel(labelIds.length, config), labelIds);
  }

  /** Predict probabilities for one [30, 126] sequence. */
  predict(sequence: number[][]): Prediction {
    const probs = tf.tidy(() => {
      const input = tf.tensor3d([sequence], [1, SEQUENCE_LENGTH, FEATURE_SIZE]);
      return (this.model.predict(input) as tf.Tensor).dataSync();
    });
    return topPrediction(Array.from(probs));
  }

  predictBatch(sequences: number[][][]): Prediction[] {
    if (sequences.length === 0) return [];
    const data = tf.tidy(() => {
      const input = tf.tensor3d(sequences, [sequences.length, SEQUENCE_LENGTH, FEATURE_SIZE]);
      return (this.model.predict(input) as tf.Tensor2D).arraySync();
    });
    return data.map(topPrediction);
  }

  async save(url = MODEL_STORAGE_URL): Promise<void> {
    await this.model.save(url);
  }

  static async load(labelIds: string[], url = MODEL_STORAGE_URL): Promise<LstmClassifier> {
    const model = await tf.loadLayersModel(url);
    return new LstmClassifier(model, labelIds);
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

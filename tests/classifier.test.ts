import { afterAll, describe, expect, it } from 'vitest';
import { FEATURE_SIZE, SEQUENCE_LENGTH } from '../src/ai/constants';
import { buildLstmModel, LstmClassifier, topPrediction } from '../src/ai/lstmClassifier';
import {
  computeDatasetVersion,
  dedupeSamples,
  splitDataset,
  trainClassifier,
  TrainingError,
  type TrainResult,
} from '../src/ai/trainingService';
import type { SignLabel, TrainingSample } from '../src/types';
import { makeSample, type Motion } from './helpers';

const label = (id: string, english: string): SignLabel => ({ id, english, hindi: '', category: 'other', createdAt: 0, updatedAt: 0 });
const LABELS = [label('a', 'Swipe'), label('b', 'Raise'), label('c', 'Twist')];
const MOTIONS: Record<string, Motion> = { a: 'swipe', b: 'raise', c: 'twist' };

function dataset(perSession = 5, sessions = 3): TrainingSample[] {
  const out: TrainingSample[] = [];
  let seed = 1;
  for (const l of LABELS) for (let s = 0; s < sessions; s++) for (let i = 0; i < perSession; i++) out.push(makeSample(l.id, MOTIONS[l.id], seed++, `${l.id}-sess${s}`));
  return out;
}

describe('LSTM model', () => {
  it('builds input [30,126] and a softmax sized to the vocabulary', () => {
    const model = buildLstmModel(4);
    expect(model.inputs[0].shape).toEqual([null, SEQUENCE_LENGTH, FEATURE_SIZE]);
    expect(model.outputs[0].shape).toEqual([null, 4]);
    expect(model.layers.map((l) => l.getClassName())).toEqual(['InputLayer', 'LSTM', 'Dropout', 'Dense', 'Dropout', 'Dense']);
    model.dispose();
  });

  it('refuses to build a single-class classifier', () => {
    expect(() => buildLstmModel(1)).toThrow();
  });

  it('computes top prediction and margin', () => {
    const p = topPrediction([0.1, 0.7, 0.2]);
    expect(p.index).toBe(1);
    expect(p.confidence).toBeCloseTo(0.7);
    expect(p.margin).toBeCloseTo(0.5);
  });
});

describe('dataset preparation', () => {
  it('splits by recording session without leaking sessions across sets', () => {
    const samples = dataset(4, 3);
    const { train, validation, info } = splitDataset(samples, 0.25, 7);
    expect(info.strategy).toBe('session');
    const trainSessions = new Set(train.map((s) => s.sessionId));
    for (const v of validation) expect(trainSessions.has(v.sessionId)).toBe(false);
    expect(train.length + validation.length).toBe(samples.length);
  });

  it('falls back to a sample-level split for single-session labels and reports it', () => {
    const samples = dataset(8, 1);
    const { info } = splitDataset(samples, 0.25);
    expect(info.strategy).toBe('sample');
    expect(info.labelsWithSampleLevelSplit.sort()).toEqual(['a', 'b', 'c']);
  });

  it('removes exact duplicate sequences before splitting', () => {
    const s = makeSample('a', 'swipe', 99);
    const dup = { ...s, id: 'copy', sessionId: 'other' };
    expect(dedupeSamples([s, dup]).removed).toBe(1);
    const { train, validation } = splitDataset([s, dup, ...dataset(3, 2)]);
    const ids = [...train, ...validation].map((x) => x.id);
    expect(ids.includes(s.id) && ids.includes('copy')).toBe(false);
  });

  it('changes the dataset version when samples change', () => {
    const samples = dataset(2, 1);
    const v1 = computeDatasetVersion(LABELS, samples);
    const v2 = computeDatasetVersion(LABELS, samples.slice(1));
    expect(v1).not.toBe(v2);
    expect(computeDatasetVersion(LABELS, [...samples].reverse())).toBe(v1);
  });
});

describe('classifier training and prediction', () => {
  let result: TrainResult;
  afterAll(() => result?.classifier.dispose());

  it('rejects training with fewer than two trainable classes', async () => {
    await expect(trainClassifier({ labels: LABELS, samples: dataset(5, 1).filter((s) => s.labelId === 'a'), epochs: 1 })).rejects.toBeInstanceOf(TrainingError);
  });

  it('learns distinguishable motions and reports real held-out metrics', async () => {
    const epochs: number[] = [];
    result = await trainClassifier({ labels: LABELS, samples: dataset(5, 3), epochs: 25, augment: false, onEpoch: (m) => epochs.push(m.epoch) });
    expect(epochs).toHaveLength(25);
    expect(result.history.every((h) => Number.isFinite(h.loss) && h.valAcc !== null)).toBe(true);
    expect(result.history[result.history.length - 1].loss).toBeLessThan(result.history[0].loss);
    expect(result.evaluation).not.toBeNull();
    expect(result.evaluation!.accuracy).toBeGreaterThanOrEqual(0.8);
    expect(result.split.valCount).toBeGreaterThan(0);
  });

  it('predicts unseen recordings correctly', () => {
    const fresh: Array<[string, Motion]> = [['a', 'swipe'], ['b', 'raise'], ['c', 'twist']];
    let correct = 0;
    for (const [id, motion] of fresh) {
      for (let k = 0; k < 3; k++) {
        const s = makeSample(id, motion, 5000 + k * 17 + id.charCodeAt(0));
        const p = result.classifier.predict(s.frames);
        if (result.classifier.labelIds[p.index] === id) correct++;
        expect(p.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
      }
    }
    expect(correct).toBeGreaterThanOrEqual(8);
  });

  it('saves to and loads from IndexedDB with identical predictions', async () => {
    const url = 'indexeddb://signbridge-test-model';
    await result.classifier.save(url);
    const loaded = await LstmClassifier.load(result.classifier.labelIds, url);
    const s = makeSample('a', 'swipe', 777);
    const a = result.classifier.predict(s.frames).probabilities;
    const b = loaded.predict(s.frames).probabilities;
    a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 5));
    loaded.dispose();
    await LstmClassifier.remove(url);
    await expect(LstmClassifier.load(['a', 'b', 'c'], url)).rejects.toThrow();
  });
});

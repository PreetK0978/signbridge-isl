/**
 * Motion-recognition benchmark (npm run benchmark).
 *
 * Scenario A ("personal"): train on ONE simulated signer across 3 sessions, test on a 4th
 * session of the same signer — this mirrors how SignBridge is used (you train it yourself).
 * Scenario B ("new people"): the same model tested on 5 unseen signers.
 *
 * Compares pipeline variants and writes docs/BENCHMARK.md. Synthetic data only — see motionSynth.ts.
 * Env: BENCH_EPOCHS (default 30), BENCH_VARIANTS (comma list, default "legacy,current").
 */
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import * as tf from '@tensorflow/tfjs';
import { describe, expect, it } from 'vitest';
import { FEATURE_SIZE, SEQUENCE_LENGTH } from '../../src/ai/constants';
import { buildLstmModel, DEFAULT_CLASSIFIER_CONFIG, topPrediction, type Prediction } from '../../src/ai/lstmClassifier';
import { decide } from '../../src/ai/predictionService';
import { buildSequence, type Slotting } from '../../src/ai/sequenceProcessor';
import { trainClassifier } from '../../src/ai/trainingService';
import type { ClassifierConfig, SignLabel, TrainingSample } from '../../src/types';
import { GESTURES, HARD_GROUPS, makeSigner, OOV_GESTURES, recordGesture, sessionOf, type Signer } from './motionSynth';

const CLASSES = Object.keys(GESTURES);
const EPOCHS = Number(process.env.BENCH_EPOCHS ?? 20);
const VARIANTS = (process.env.BENCH_VARIANTS ?? 'legacy,current').split(',').map((v) => v.trim());
const TRAIN_SESSIONS = 3;
const TRAIN_REPS = 5; // per class per session → 15 per class (the app recommends 20–30)
const TEST_REPS = 4;
const UNSEEN_SIGNERS = 5;
const UNSEEN_REPS = 2;
const THRESHOLDS = { confidenceThreshold: 0.8, minMargin: 0.25, maxNovelty: 1 };

const labels: SignLabel[] = CLASSES.map((c) => ({ id: c, english: c, hindi: '', category: 'other', createdAt: 0, updatedAt: 0 }));

interface Variant {
  name: string;
  slotting: Slotting;
  train: (samples: TrainingSample[]) => Promise<Pipeline>;
}

interface Pipeline {
  predict: (frames: number[][][]) => Prediction[];
  dispose: () => void;
}

/** Legacy v1 representation from a stored v2 sequence: wrist trajectory + wrist-relative landmarks. */
function legacyFeatures(frames: number[][]): number[][] {
  return frames.map((row) => {
    const out = row.slice();
    for (let s = 0; s < 2; s++) {
      const o = s * 63;
      if (!row.slice(o, o + 63).some((v) => v !== 0)) continue;
      for (let i = 1; i < 21; i++) for (let c = 0; c < 3; c++) out[o + i * 3 + c] = row[o + i * 3 + c] - row[o + c];
    }
    return out;
  });
}

const legacy: Variant = {
  name: 'Legacy (v1 features, per-frame slots, LSTM, no standardisation)',
  slotting: 'per-frame',
  train: async (train) => {
    const model = buildLstmModel(CLASSES.length, { convFilters: 0, lstmUnits: 64, denseUnits: 64, dropout: 0.3, learningRate: 0.001 }, FEATURE_SIZE);
    const xs = tf.tensor3d(train.map((s) => legacyFeatures(s.frames)), [train.length, SEQUENCE_LENGTH, FEATURE_SIZE]);
    const ys = tf.oneHot(tf.tensor1d(train.map((s) => CLASSES.indexOf(s.labelId)), 'int32'), CLASSES.length);
    // Legacy training also added one jittered copy per sample; approximated by plain training.
    await model.fit(xs, ys, { epochs: EPOCHS, batchSize: 16, shuffle: true, yieldEvery: 'never' });
    xs.dispose();
    ys.dispose();
    return {
      predict: (frames) =>
        tf.tidy(() => (model.predict(tf.tensor3d(frames.map(legacyFeatures), [frames.length, SEQUENCE_LENGTH, FEATURE_SIZE])) as tf.Tensor2D).arraySync()).map(topPrediction),
      dispose: () => model.dispose(),
    };
  },
};

function current(name: string, config: Partial<ClassifierConfig> = {}, extra: { augmentCopies?: number; augment?: boolean } = {}): Variant {
  return {
    name,
    slotting: 'tracked',
    train: async (train) => {
      const res = await trainClassifier({ labels, samples: train, epochs: EPOCHS, config: { ...DEFAULT_CLASSIFIER_CONFIG, ...config }, ...extra });
      const remap = CLASSES.map((c) => res.classifier.labelIds.indexOf(c));
      return {
        predict: (frames) => res.classifier.predictBatch(frames).map((p) => ({ ...topPrediction(remap.map((j) => p.probabilities[j])), novelty: p.novelty })),
        dispose: () => res.classifier.dispose(),
      };
    },
  };
}

const ALL_VARIANTS: Record<string, Variant> = {
  legacy,
  current: current('Current (app pipeline, 1 augmented copy)', {}, { augmentCopies: 1 }),
  noconv: current('Current without Conv1D', { convFilters: 0 }),
  noaug: current('Current without augmentation', {}, { augment: false }),
  aug1: current('Current, 1 augmented copy', {}, { augmentCopies: 1 }),
};

let uid = 0;
function record(signers: Signer[], reps: number, gestures: Record<string, unknown>, slotting: Slotting, seedBase: number): TrainingSample[] {
  const out: TrainingSample[] = [];
  for (const s of signers)
    for (const [name, fn] of Object.entries(gestures))
      for (let r = 0; r < reps; r++) {
        const seq = buildSequence(recordGesture(fn as never, s, seedBase + uid++), { slotting });
        if (seq.ok) out.push({ id: `b${uid}`, labelId: name, sessionId: s.id, frames: seq.frames, validity: seq.validity, source: 'webcam', createdAt: 0, format: 2 });
      }
  return out;
}

function evaluate(p: Pipeline, samples: TrainingSample[]) {
  const preds = p.predict(samples.map((s) => s.frames));
  const correct = preds.map((pr, i) => CLASSES[pr.index] === samples[i].labelId);
  const acc = (filter: (s: TrainingSample) => boolean) => {
    const idx = samples.map((s, i) => (filter(s) ? i : -1)).filter((i) => i >= 0);
    return idx.length ? idx.filter((i) => correct[i]).length / idx.length : 0;
  };
  const decisions = preds.map((pr) => decide(pr, CLASSES, THRESHOLDS));
  const acceptedCorrect = decisions.filter((d, i) => d.kind === 'sign' && d.labelId === samples[i].labelId).length / samples.length;
  return {
    acc: acc(() => true),
    groups: HARD_GROUPS.map((g) => acc((s) => g.includes(s.labelId))),
    perClass: CLASSES.map((c) => acc((s) => s.labelId === c)),
    acceptedCorrect,
  };
}

function oovRejected(p: Pipeline, oov: TrainingSample[]) {
  return p.predict(oov.map((s) => s.frames)).filter((pr) => decide(pr, CLASSES, THRESHOLDS).kind === 'unknown').length / oov.length;
}

function latencyMs(p: Pipeline, sample: TrainingSample) {
  for (let i = 0; i < 3; i++) p.predict([sample.frames]);
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) p.predict([sample.frames]);
  return (performance.now() - t0) / 20;
}

/**
 * Rating out of 10 (synthetic benchmark, no free points):
 *  3.0 × personal accuracy (same signer, new session)
 *  1.5 × accuracy on new people
 *  2.0 × hard-group accuracy (mean of groups that share arm motion and differ only in hand
 *        motion or motion order; personal and new-people sets pooled)
 *  1.0 × accuracy under heavy perturbation (label flicker 25 %, dropout 12 %, 2× noise)
 *  1.5 × unknown handling = mean(OOV motions rejected, in-vocabulary motions accepted & correct)
 *  1.0 × real-time: full ≤ 30 ms per prediction, zero ≥ 150 ms
 */
function rate(m: { personal: number; unseen: number; hard: number; robust: number; oov: number; accepted: number; latency: number }) {
  const rt = Math.max(0, Math.min(1, (150 - m.latency) / 120));
  return 3 * m.personal + 1.5 * m.unseen + 2 * m.hard + 1 * m.robust + 1.5 * ((m.oov + m.accepted) / 2) + rt;
}

describe('motion recognition benchmark', () => {
  it('trains per scenario and reports a rating', async () => {
    await tf.setBackend('cpu');
    await tf.ready();
    const base = makeSigner(7);
    const unseen = Array.from({ length: UNSEEN_SIGNERS }, (_, i) => makeSigner(100 + i));

    const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
    const rows: string[] = [];
    const details: string[] = [];
    for (const key of VARIANTS) {
      const v = ALL_VARIANTS[key];
      if (!v) throw new Error(`Unknown variant ${key}`);
      uid = 0;
      const train = record([0, 1, 2].slice(0, TRAIN_SESSIONS).map((k) => sessionOf(base, k)), TRAIN_REPS, GESTURES, v.slotting, 1000);
      const personal = record([sessionOf(base, 9)], TEST_REPS, GESTURES, v.slotting, 50000);
      const others = record(unseen, UNSEEN_REPS, GESTURES, v.slotting, 60000);
      const perturbed = record([{ ...sessionOf(base, 10), flicker: 0.25, dropout: 0.12, noise: base.noise * 2 }], 3, GESTURES, v.slotting, 80000);
      const oov = record([sessionOf(base, 9), ...unseen.slice(0, 2)], 3, OOV_GESTURES, v.slotting, 70000);

      const t0 = performance.now();
      const p = await v.train(train);
      const trainSeconds = (performance.now() - t0) / 1000;
      const ep = evaluate(p, personal);
      const eu = evaluate(p, others);
      const er = evaluate(p, perturbed);
      const hard = ep.groups.map((g, i) => (g + eu.groups[i]) / 2).reduce((a, b) => a + b, 0) / HARD_GROUPS.length;
      const oov_ = oovRejected(p, oov);
      const latency = latencyMs(p, personal[0]);
      const m = { personal: ep.acc, unseen: eu.acc, hard, robust: er.acc, oov: oov_, accepted: (ep.acceptedCorrect + eu.acceptedCorrect) / 2, latency };
      const score = rate(m);
      rows.push(
        `| ${v.name} | ${pct(m.personal)} | ${pct(m.unseen)} | ${pct(m.hard)} | ${pct(m.robust)} | ${pct(m.oov)} | ${pct(m.accepted)} | ${latency.toFixed(1)} ms | ${trainSeconds.toFixed(0)} s | **${score.toFixed(1)}** |`,
      );
      details.push(
        `**${v.name}**\n- hard groups (personal / new people): ${HARD_GROUPS.map((g, i) => `${g.join(' vs ')} ${pct(ep.groups[i])} / ${pct(eu.groups[i])}`).join('; ')}\n- per class (personal): ${CLASSES.map((c, i) => `${c} ${pct(ep.perClass[i])}`).join(', ')}\n- per class (new people): ${CLASSES.map((c, i) => `${c} ${pct(eu.perClass[i])}`).join(', ')}`,
      );
      process.stderr.write(`${rows[rows.length - 1]}\n`);
      p.dispose();
    }

    const table = [
      '| Pipeline | Personal (new session) | New people | Hard groups | Perturbed | Unknown motions rejected | Known motions accepted & correct | Latency / prediction | Train time | **Rating /10** |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...rows,
    ].join('\n');
    const report = `# Motion recognition benchmark

Generated by \`npm run benchmark\` on ${new Date().toISOString().slice(0, 10)} (TF.js backend: ${tf.getBackend()}, ${EPOCHS} epochs).

- **Classes (${CLASSES.length}):** ${CLASSES.join(', ')}
- **Training:** one simulated signer, ${TRAIN_SESSIONS} sessions × ${TRAIN_REPS} recordings per class (${TRAIN_SESSIONS * TRAIN_REPS} per class), like a person using the Training Studio.
- **Personal test:** the same signer in a new session, ${TEST_REPS} recordings per class.
- **New people:** ${UNSEEN_SIGNERS} unseen signers × ${UNSEEN_REPS} recordings per class.
- **Unknown motions:** ${Object.keys(OOV_GESTURES).join(', ')} (never trained; should be rejected).
- Thresholds: confidence ≥ ${THRESHOLDS.confidenceThreshold * 100}%, margin ≥ ${THRESHOLDS.minMargin * 100}%, novelty ≤ ${THRESHOLDS.maxNovelty}.

${table}

${details.join('\n\n')}

**Rating formula (out of 10):** 3 × personal accuracy + 1.5 × new-people accuracy + 2 × hard-group accuracy (groups share the same arm motion and differ only in hand motion or motion order) + 1 × perturbed accuracy + 1.5 × unknown handling (mean of unknown motions rejected and known motions accepted correctly) + 1 × real-time (full ≤ 30 ms, zero ≥ 150 ms).

> **Synthetic data.** Signers are simulated by a kinematic hand model (\`tests/benchmark/motionSynth.ts\`) with varied hand size, proportions, handedness, angle, position, speed, timing, noise, dropped frames and Left/Right label flicker. The rating measures how well the pipeline separates complete motions on this benchmark. It is **not** a measurement of accuracy on real people, which depends on your recordings.
`;
    writeFileSync(process.env.BENCH_OUT ?? 'docs/BENCHMARK.md', report);
    console.log(`\n${table}\n\n${details.join('\n\n')}\n`);
    expect(rows.length).toBe(VARIANTS.length);
  });
});

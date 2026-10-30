import { describe, expect, it, vi } from 'vitest';
import { topPrediction } from '../src/ai/lstmClassifier';
import { decide, RecognitionSmoother, type FrameDecision } from '../src/ai/predictionService';

const IDS = ['hello', 'thanks', 'bg'];
const T = { confidenceThreshold: 0.8, minMargin: 0.25 };
const sign = (labelId: string, confidence = 0.95): FrameDecision => ({ kind: 'sign', labelId, confidence });

describe('confidence threshold & unknown-sign rejection', () => {
  it('accepts a confident, unambiguous prediction', () => {
    expect(decide(topPrediction([0.92, 0.05, 0.03]), IDS, T)).toEqual({ kind: 'sign', labelId: 'hello', confidence: 0.92 });
  });

  it('returns unknown below the confidence threshold', () => {
    const d = decide(topPrediction([0.6, 0.3, 0.1]), IDS, T);
    expect(d.kind).toBe('unknown');
  });

  it('returns unknown when the margin to the runner-up is too small', () => {
    const d = decide(topPrediction([0.81, 0.19, 0]), IDS, { confidenceThreshold: 0.8, minMargin: 0.7 });
    expect(d.kind).toBe('unknown');
  });

  it('maps the background class to "background", never to a word', () => {
    expect(decide(topPrediction([0.01, 0.01, 0.98]), IDS, T, new Set(['bg'])).kind).toBe('background');
  });

  it('respects a stricter threshold', () => {
    expect(decide(topPrediction([0.9, 0.1, 0]), IDS, { ...T, confidenceThreshold: 0.95 }).kind).toBe('unknown');
  });
});

describe('recognition smoothing', () => {
  const opts = { windowSize: 5, stableCount: 3, cooldownMs: 1000 };

  it('requires a stable prediction before recognising', () => {
    const s = new RecognitionSmoother(opts);
    expect(s.push(sign('hello'), 0).status).toBe('detecting');
    expect(s.push(sign('hello'), 100).status).toBe('detecting');
    const third = s.push(sign('hello'), 200);
    expect(third.status).toBe('recognized');
    expect(third.emitted).toBe(true);
    expect(third.labelId).toBe('hello');
  });

  it('ignores flickering predictions', () => {
    const s = new RecognitionSmoother(opts);
    const seq = ['hello', 'thanks', 'hello', 'thanks', 'bg'];
    const states = seq.map((id, i) => s.push(sign(id), i * 100));
    expect(states.some((x) => x.emitted)).toBe(false);
  });

  it('does not repeat a held sign (cooldown / hold suppression)', () => {
    const s = new RecognitionSmoother(opts);
    let emits = 0;
    for (let i = 0; i < 40; i++) if (s.push(sign('hello'), i * 100).emitted) emits++;
    expect(emits).toBe(1);
  });

  it('re-arms after the hands are lowered', () => {
    const s = new RecognitionSmoother(opts);
    for (let i = 0; i < 3; i++) s.push(sign('hello'), i * 100);
    s.push({ kind: 'no-hands' }, 400);
    let emitted = false;
    for (let i = 0; i < 3; i++) emitted = s.push(sign('hello'), 1500 + i * 100).emitted || emitted;
    expect(emitted).toBe(true);
  });

  it('still respects the cooldown after re-arming too quickly', () => {
    const s = new RecognitionSmoother(opts);
    for (let i = 0; i < 3; i++) s.push(sign('hello'), i * 100);
    s.push({ kind: 'no-hands' }, 300);
    let emitted = false;
    for (let i = 0; i < 3; i++) emitted = s.push(sign('hello'), 400 + i * 50).emitted || emitted;
    expect(emitted).toBe(false);
  });

  it('emits a different sign immediately', () => {
    const s = new RecognitionSmoother(opts);
    for (let i = 0; i < 3; i++) s.push(sign('hello'), i * 100);
    let emitted: string | null = null;
    for (let i = 0; i < 5; i++) {
      const st = s.push(sign('thanks'), 300 + i * 100);
      if (st.emitted) emitted = st.labelId;
    }
    expect(emitted).toBe('thanks');
  });

  it('reports unknown and no-hands states', () => {
    const s = new RecognitionSmoother(opts);
    expect(s.push({ kind: 'unknown', confidence: 0.4, bestLabelId: 'hello' }, 0).status).toBe('unknown');
    expect(s.push({ kind: 'no-hands' }, 10).status).toBe('no-hands');
    expect(s.push({ kind: 'background', confidence: 0.99 }, 20).status).toBe('idle');
  });
});

describe('live window guard', () => {
  it('does not classify windows that cover too little time', async () => {
    const { PredictionService } = await import('../src/ai/predictionService');
    const { makeMotionFrames } = await import('./helpers');
    const predict = vi.fn();
    const fake = { labelIds: ['a', 'b'], predict } as never;
    const svc = new PredictionService(fake, [], T, { windowSize: 5, stableCount: 3, cooldownMs: 1000 });
    const frames = makeMotionFrames('swipe', 1, 10); // 10 frames ≈ 300 ms
    const out = svc.process(frames, 0, 1200);
    expect(out.decision.kind).toBe('insufficient');
    expect(predict).not.toHaveBeenCalled();
  });
});

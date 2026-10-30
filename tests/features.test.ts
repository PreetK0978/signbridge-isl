import { describe, expect, it } from 'vitest';
import { applyNormalization, computeNormalization, extractFeatures, MODEL_FEATURES, PER_HAND_FEATURES } from '../src/ai/featureExtractor';
import { buildSequence, deriveValidity, migrateV1Frames, trackHandSlots } from '../src/ai/sequenceProcessor';
import type { FrameData } from '../src/types';
import { makeHand, makeMotionFrames } from './helpers';

const seq = (frames: FrameData[]) => {
  const r = buildSequence(frames);
  if (!r.ok) throw new Error('rejected');
  return r;
};

describe('tracked hand slots', () => {
  it('keeps one hand in one slot when MediaPipe flips its Left/Right label', () => {
    const frames = makeMotionFrames('swipe', 1).map((f, i) => ({
      ...f,
      hands: f.hands.map((h) => ({ ...h, handedness: (i % 4 === 1 ? 'Left' : 'Right') as 'Left' | 'Right' })),
    }));
    const slots = trackHandSlots(frames);
    expect(slots.every((s) => s[0] !== null && s[1] === null)).toBe(true);
    const r = seq(frames);
    expect(r.validity.every((v) => v[0] === 1 && v[1] === 0)).toBe(true);
    // Legacy per-frame slotting splits the same hand across both slots
    const legacy = buildSequence(frames, { slotting: 'per-frame', maxGap: 0 });
    if (legacy.ok) expect(legacy.validity.some((v) => v[1] === 1)).toBe(true);
  });

  it('follows two hands by position even if both get the same label', () => {
    const frames: FrameData[] = Array.from({ length: 20 }, (_, i) => ({
      timestamp: i * 33,
      hands: [makeHand({ handedness: 'Right', x: 0.3 + i * 0.005 }), makeHand({ handedness: i % 3 ? 'Left' : 'Right', x: 0.7 - i * 0.005 })],
    }));
    const slots = trackHandSlots(frames);
    const slot0x = slots.map((s) => s[0]!.landmarks[0].x);
    for (let i = 1; i < slot0x.length; i++) expect(Math.abs(slot0x[i] - slot0x[i - 1])).toBeLessThan(0.05);
  });
});

describe('model features', () => {
  it('has the expected size and zero rows for missing hands', () => {
    const r = seq(makeMotionFrames('raise', 2));
    const f = extractFeatures(r.frames, r.validity);
    expect(f).toHaveLength(30);
    expect(f[0]).toHaveLength(MODEL_FEATURES);
    expect(f[5].slice(PER_HAND_FEATURES, 2 * PER_HAND_FEATURES).every((v) => v === 0)).toBe(true);
    expect(f[5][PER_HAND_FEATURES - 1]).toBe(1); // present flag of slot 0
  });

  it('describes hand shape independently of arm rotation', () => {
    const shapeOf = (angle: number) => {
      const frames: FrameData[] = Array.from({ length: 10 }, (_, i) => ({ timestamp: i * 33, hands: [makeHand({ angle, curl: 0.4 })] }));
      return extractFeatures(seq(frames).frames)[3].slice(0, 60);
    };
    const a = shapeOf(0);
    const b = shapeOf(0.9);
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 4));
  });

  it('captures finger motion as fingertip velocity even when the wrist is still', () => {
    const frames: FrameData[] = Array.from({ length: 20 }, (_, i) => ({ timestamp: i * 33, hands: [makeHand({ curl: i / 19 })] }));
    const f = extractFeatures(seq(frames).frames);
    const wristVel = f[10].slice(69, 72);
    const tipVel = f[10].slice(72, 87);
    expect(Math.max(...wristVel.map(Math.abs))).toBeLessThan(1e-6);
    expect(Math.max(...tipVel.map(Math.abs))).toBeGreaterThan(0.01);
  });

  it('standardises features and keeps absent hands at zero', () => {
    const feats = [1, 2, 3].map((s) => extractFeatures(seq(makeMotionFrames('swipe', s)).frames));
    const norm = computeNormalization(feats);
    const z = applyNormalization(feats[0], norm);
    expect(z[4].slice(PER_HAND_FEATURES, 2 * PER_HAND_FEATURES - 1).every((v) => v === 0)).toBe(true);
    expect(Math.max(...z.flat().map(Math.abs))).toBeLessThanOrEqual(6);
  });
});

describe('stored-format migration', () => {
  it('converts v1 samples (wrist-relative shape + trajectory) to v2 absolute palm units', () => {
    const v2 = seq(makeMotionFrames('swipe', 5));
    // Build what a v1 sample would have stored for the same window
    const v1 = v2.frames.map((row) => {
      const out = row.slice();
      for (let i = 1; i < 21; i++) for (let c = 0; c < 3; c++) out[i * 3 + c] = row[i * 3 + c] - row[c];
      return out;
    });
    const migrated = migrateV1Frames(v1, v2.validity);
    migrated.forEach((row, t) => row.forEach((v, i) => expect(v).toBeCloseTo(v2.frames[t][i], 9)));
    expect(deriveValidity(v2.frames)).toEqual(v2.validity);
  });
});

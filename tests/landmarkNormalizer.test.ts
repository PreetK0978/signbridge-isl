import { describe, expect, it } from 'vitest';
import { HAND_FEATURES } from '../src/ai/constants';
import { normalizeHand, palmSize } from '../src/ai/landmarkNormalizer';
import { makeHand } from './helpers';

describe('landmark normalisation', () => {
  it('puts the wrist at the origin and returns 63 values', () => {
    const v = normalizeHand(makeHand().landmarks);
    expect(v).toHaveLength(HAND_FEATURES);
    expect(v.slice(0, 3)).toEqual([0, 0, 0]);
  });

  it('is invariant to translation and scale', () => {
    const a = normalizeHand(makeHand({ x: 0.3, y: 0.4, scale: 0.1 }).landmarks);
    const b = normalizeHand(makeHand({ x: 0.7, y: 0.65, scale: 0.3 }).landmarks);
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));
  });

  it('preserves hand orientation (rotation changes features)', () => {
    const upright = normalizeHand(makeHand({ angle: 0 }).landmarks);
    const rotated = normalizeHand(makeHand({ angle: Math.PI / 2 }).landmarks);
    const diff = upright.reduce((s, v, i) => s + Math.abs(v - rotated[i]), 0);
    expect(diff).toBeGreaterThan(1);
  });

  it('palm size scales linearly with hand size', () => {
    const small = palmSize(makeHand({ scale: 0.1 }).landmarks);
    const big = palmSize(makeHand({ scale: 0.2 }).landmarks);
    expect(big / small).toBeCloseTo(2, 6);
  });

  it('rejects hands without 21 landmarks', () => {
    expect(() => normalizeHand(makeHand().landmarks.slice(0, 20))).toThrow(/21 landmarks/);
  });
});

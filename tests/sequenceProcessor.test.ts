import { describe, expect, it } from 'vitest';
import { FEATURE_SIZE, HAND_FEATURES, SEQUENCE_LENGTH } from '../src/ai/constants';
import { assignHandSlots, buildSequence, fillGaps, isValidSequenceShape, resampleTrack } from '../src/ai/sequenceProcessor';
import type { FrameData } from '../src/types';
import { makeHand, makeMotionFrames } from './helpers';

describe('sequence extraction', () => {
  it('produces a [30, 126] sequence with validity flags', () => {
    const res = buildSequence(makeMotionFrames('swipe', 1, 45));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.frames).toHaveLength(SEQUENCE_LENGTH);
    expect(res.frames.every((r) => r.length === FEATURE_SIZE)).toBe(true);
    expect(res.validity.every((r) => r[0] === 1 && r[1] === 0)).toBe(true);
    expect(isValidSequenceShape(res.frames, res.validity)).toBe(true);
  });

  it('zero-pads the missing hand slot', () => {
    const res = buildSequence(makeMotionFrames('raise', 2));
    if (!res.ok) throw new Error('rejected');
    for (const row of res.frames) expect(row.slice(HAND_FEATURES).every((v) => v === 0)).toBe(true);
  });

  it('places Left and Right hands in fixed slots', () => {
    const frames: FrameData[] = Array.from({ length: 20 }, (_, i) => ({
      timestamp: i * 33,
      hands: [makeHand({ handedness: 'Left', x: 0.3 }), makeHand({ handedness: 'Right', x: 0.7 })],
    }));
    const res = buildSequence(frames);
    if (!res.ok) throw new Error('rejected');
    expect(res.validity.every((r) => r[0] === 1 && r[1] === 1)).toBe(true);
  });

  it('resolves two hands labelled with the same side', () => {
    const slots = assignHandSlots([makeHand({ handedness: 'Right', score: 0.6 }), makeHand({ handedness: 'Right', score: 0.9 })]);
    expect(slots[0]?.score).toBe(0.9);
    expect(slots[1]?.score).toBe(0.6);
  });

  it('preserves temporal movement in the wrist slot', () => {
    const res = buildSequence(makeMotionFrames('swipe', 3));
    if (!res.ok) throw new Error('rejected');
    expect(res.frames[0][0]).toBeCloseTo(0, 1);
    // swipe moves right by ~2 palm widths: wrist x should grow over time
    expect(res.frames[SEQUENCE_LENGTH - 1][0]).toBeGreaterThan(1);
  });

  it('rejects sequences with too few frames containing hands', () => {
    const frames: FrameData[] = makeMotionFrames('swipe', 4, 40).map((f, i) => (i % 5 === 0 ? f : { ...f, hands: [] }));
    const res = buildSequence(frames, { maxGap: 0 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('insufficient-valid-frames');
  });

  it('rejects empty input', () => {
    expect(buildSequence([]).ok).toBe(false);
  });
});

describe('missing-hand handling and resampling', () => {
  it('interpolates short gaps but not long ones', () => {
    const track = [[0], null, null, [3], null, null, null, null, null, null, [10]];
    const filled = fillGaps(track, 2);
    expect(filled[1]![0]).toBeCloseTo(1);
    expect(filled[2]![0]).toBeCloseTo(2);
    expect(filled[5]).toBeNull();
  });

  it('downsamples 60 frames to 30 by linear interpolation', () => {
    const track = Array.from({ length: 60 }, (_, i) => [i]);
    const out = resampleTrack(track, 30);
    expect(out).toHaveLength(30);
    expect(out[0]![0]).toBe(0);
    expect(out[29]![0]).toBe(59);
    expect(out[15]![0]).toBeCloseTo((15 * 59) / 29, 6);
  });

  it('upsamples 10 frames to 30', () => {
    const track = Array.from({ length: 10 }, (_, i) => [i * 2]);
    const out = resampleTrack(track, 30);
    expect(out[29]![0]).toBe(18);
    for (let i = 1; i < 30; i++) expect(out[i]![0]).toBeGreaterThanOrEqual(out[i - 1]![0]);
  });

  it('keeps missing frames missing when both neighbours are absent', () => {
    const out = resampleTrack([null, null, null, [1]], 8);
    expect(out[0]).toBeNull();
    expect(out[7]![0]).toBe(1);
  });
});

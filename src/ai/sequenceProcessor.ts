import {
  FEATURE_SIZE,
  HAND_FEATURES,
  HAND_SLOTS,
  MAX_INTERPOLATION_GAP,
  MIN_VALID_RATIO,
  SEQUENCE_LENGTH,
  WRIST,
} from './constants';
import { isFiniteLandmarks, normalizeHand, palmSize } from './landmarkNormalizer';
import type { FrameData, HandData } from '../types';

/** Per-slot vector carried through interpolation: 63 normalised coords + wrist x,y,z + palm size. */
type SlotVector = number[] | null;

export interface SequenceOptions {
  length?: number;
  minValidRatio?: number;
  maxGap?: number;
}

export type SequenceResult =
  | { ok: true; frames: number[][]; validity: number[][]; validRatio: number }
  | { ok: false; reason: 'too-few-frames' | 'insufficient-valid-frames'; validRatio: number };

/**
 * Put hands into fixed slots so the same hand always occupies the same feature columns:
 * slot 0 = "Right", slot 1 = "Left" as labelled by MediaPipe. If MediaPipe labels two hands
 * with the same side, the more confident one keeps its slot and the other takes the free slot.
 */
export function assignHandSlots(hands: HandData[]): Array<HandData | null> {
  const slots: Array<HandData | null> = [null, null];
  const valid = hands.filter((h) => isFiniteLandmarks(h.landmarks)).sort((a, b) => b.score - a.score);
  for (const hand of valid.slice(0, HAND_SLOTS)) {
    const preferred = hand.handedness === 'Right' ? 0 : 1;
    if (slots[preferred] === null) slots[preferred] = hand;
    else if (slots[1 - preferred] === null) slots[1 - preferred] = hand;
  }
  return slots;
}

function handToSlotVector(hand: HandData): number[] {
  const v = normalizeHand(hand.landmarks);
  const w = hand.landmarks[WRIST];
  v.push(w.x, w.y, w.z, palmSize(hand.landmarks));
  return v;
}

function lerp(a: number[], b: number[], t: number): number[] {
  const out = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

/** Linearly interpolate interior gaps of at most `maxGap` missing frames. Leading/trailing gaps stay missing. */
export function fillGaps(track: SlotVector[], maxGap: number): SlotVector[] {
  const out = track.slice();
  let lastValid = -1;
  for (let i = 0; i < out.length; i++) {
    if (out[i] === null) continue;
    const gap = i - lastValid - 1;
    if (lastValid >= 0 && gap > 0 && gap <= maxGap) {
      const a = out[lastValid] as number[];
      const b = out[i] as number[];
      for (let k = 1; k <= gap; k++) out[lastValid + k] = lerp(a, b, k / (gap + 1));
    }
    lastValid = i;
  }
  return out;
}

/** Resample a track to `length` frames by linear interpolation over the time index. */
export function resampleTrack(track: SlotVector[], length: number): SlotVector[] {
  const n = track.length;
  const out: SlotVector[] = new Array(length).fill(null);
  if (n === 0) return out;
  for (let t = 0; t < length; t++) {
    const src = length === 1 ? 0 : (t * (n - 1)) / (length - 1);
    const i0 = Math.floor(src);
    const i1 = Math.min(Math.ceil(src), n - 1);
    const a = track[i0];
    const b = track[i1];
    if (a && b) out[t] = i0 === i1 ? a.slice() : lerp(a, b, src - i0);
    else if (a || b) out[t] = ((src - i0 < 0.5 ? a : b) ?? a ?? b)!.slice();
  }
  return out;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Convert a variable-length list of raw MediaPipe frames into a fixed
 * [SEQUENCE_LENGTH, FEATURE_SIZE] sequence.
 *
 * Per hand slot (63 features):
 *  - landmarks 1..20 are wrist-relative and divided by palm size (shape + orientation);
 *  - the wrist slot (landmark 0) holds the wrist trajectory relative to the hand's first
 *    valid position in the sequence, scaled by the median palm size (temporal movement).
 * Missing hands are zero-padded and flagged 0 in `validity`. A present hand is never
 * all-zero (fingers are always offset from the wrist), so padding is unambiguous.
 */
export function buildSequence(raw: FrameData[], options: SequenceOptions = {}): SequenceResult {
  const length = options.length ?? SEQUENCE_LENGTH;
  const minValidRatio = options.minValidRatio ?? MIN_VALID_RATIO;
  const maxGap = options.maxGap ?? MAX_INTERPOLATION_GAP;

  if (raw.length < 2) return { ok: false, reason: 'too-few-frames', validRatio: 0 };

  const tracks: SlotVector[][] = Array.from({ length: HAND_SLOTS }, () => []);
  for (const frame of raw) {
    const slots = assignHandSlots(frame.hands);
    for (let s = 0; s < HAND_SLOTS; s++) {
      const hand = slots[s];
      tracks[s].push(hand ? handToSlotVector(hand) : null);
    }
  }

  const resampled = tracks.map((t) => resampleTrack(fillGaps(t, maxGap), length));

  const frames: number[][] = Array.from({ length }, () => new Array<number>(FEATURE_SIZE).fill(0));
  const validity: number[][] = Array.from({ length }, () => new Array<number>(HAND_SLOTS).fill(0));

  for (let s = 0; s < HAND_SLOTS; s++) {
    const track = resampled[s];
    const present = track.filter((v): v is number[] => v !== null);
    if (present.length === 0) continue;
    const ref = present[0];
    const scale = Math.max(median(present.map((v) => v[HAND_FEATURES + 3])), 1e-6);
    for (let t = 0; t < length; t++) {
      const v = track[t];
      if (!v) continue;
      const offset = s * HAND_FEATURES;
      for (let i = 3; i < HAND_FEATURES; i++) frames[t][offset + i] = v[i];
      frames[t][offset] = (v[HAND_FEATURES] - ref[HAND_FEATURES]) / scale;
      frames[t][offset + 1] = (v[HAND_FEATURES + 1] - ref[HAND_FEATURES + 1]) / scale;
      frames[t][offset + 2] = (v[HAND_FEATURES + 2] - ref[HAND_FEATURES + 2]) / scale;
      validity[t][s] = 1;
    }
  }

  const validFrames = validity.filter((row) => row.some((x) => x === 1)).length;
  const validRatio = validFrames / length;
  if (validRatio < minValidRatio) return { ok: false, reason: 'insufficient-valid-frames', validRatio };
  return { ok: true, frames, validity, validRatio };
}

/** True when `frames` / `validity` have the exact shapes the classifier expects. */
export function isValidSequenceShape(frames: unknown, validity: unknown): boolean {
  if (!Array.isArray(frames) || frames.length !== SEQUENCE_LENGTH) return false;
  if (!frames.every((r) => Array.isArray(r) && r.length === FEATURE_SIZE && r.every(Number.isFinite))) return false;
  if (!Array.isArray(validity) || validity.length !== SEQUENCE_LENGTH) return false;
  return validity.every((r) => Array.isArray(r) && r.length === HAND_SLOTS && r.every((x) => x === 0 || x === 1));
}

export function countHands(frame: FrameData | null): number {
  return frame ? frame.hands.length : 0;
}


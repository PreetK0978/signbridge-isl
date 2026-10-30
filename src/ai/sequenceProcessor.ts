import { COORDS, FEATURE_SIZE, HAND_FEATURES, HAND_SLOTS, MAX_INTERPOLATION_GAP, MIN_VALID_RATIO, SEQUENCE_LENGTH, WRIST } from './constants';
import { isFiniteLandmarks, palmSize } from './landmarkNormalizer';
import type { FrameData, HandData } from '../types';

/**
 * Stored sequence format (v2), shape [SEQUENCE_LENGTH, 126]:
 * for each hand slot, the 21 landmarks expressed relative to that hand's first wrist position
 * in the window and divided by the hand's median palm size ("palm units"). Model features
 * (hand shape in a hand-local frame, orientation, velocities, …) are derived from this by
 * `featureExtractor`, so better features never require re-recording.
 */
export const SEQUENCE_FORMAT_VERSION = 2;

/** Per-slot vector carried through interpolation: 63 image-space coords + palm size. */
type SlotVector = number[] | null;

export type Slotting = 'tracked' | 'per-frame';

export interface SequenceOptions {
  length?: number;
  minValidRatio?: number;
  maxGap?: number;
  /**
   * 'tracked' (default) keeps each physical hand in the same slot across the whole window.
   * 'per-frame' trusts MediaPipe's per-frame Left/Right label (legacy behaviour; kept for benchmarks).
   */
  slotting?: Slotting;
}

export type SequenceResult =
  | { ok: true; frames: number[][]; validity: number[][]; validRatio: number }
  | { ok: false; reason: 'too-few-frames' | 'insufficient-valid-frames'; validRatio: number };

const slotOf = (hand: HandData) => (hand.handedness === 'Right' ? 0 : 1);

/**
 * Legacy per-frame slotting: slot 0 = "Right", slot 1 = "Left" as labelled by MediaPipe.
 * Two hands with the same label: the more confident one keeps its slot.
 */
export function assignHandSlots(hands: HandData[]): Array<HandData | null> {
  const slots: Array<HandData | null> = [null, null];
  const valid = hands.filter((h) => isFiniteLandmarks(h.landmarks)).sort((a, b) => b.score - a.score);
  for (const hand of valid.slice(0, HAND_SLOTS)) {
    const preferred = slotOf(hand);
    if (slots[preferred] === null) slots[preferred] = hand;
    else if (slots[1 - preferred] === null) slots[1 - preferred] = hand;
  }
  return slots;
}

const wristDist = (a: HandData, p: { x: number; y: number }) => Math.hypot(a.landmarks[WRIST].x - p.x, a.landmarks[WRIST].y - p.y);

/**
 * Tracked slotting. MediaPipe's handedness label can flip between frames (especially while the
 * hand rotates or closes), which made a single hand jump between feature columns mid-gesture
 * and destroyed the motion signal. Here a hand keeps its slot by spatial continuity; labels only
 * decide the initial slot (single-hand windows use the label that wins across the whole window).
 */
export function trackHandSlots(frames: FrameData[]): Array<Array<HandData | null>> {
  const tally = [0, 0];
  for (const f of frames) for (const h of f.hands) if (isFiniteLandmarks(h.landmarks)) tally[slotOf(h)] += Math.max(h.score, 0.01);
  const dominant = tally[0] >= tally[1] ? 0 : 1;

  const last: Array<{ x: number; y: number } | null> = [null, null];
  const out: Array<Array<HandData | null>> = [];
  for (const frame of frames) {
    const hands = frame.hands.filter((h) => isFiniteLandmarks(h.landmarks)).sort((a, b) => b.score - a.score).slice(0, HAND_SLOTS);
    const slots: Array<HandData | null> = [null, null];
    if (hands.length === 2) {
      const [a, b] = hands;
      if (last[0] && last[1]) {
        const keep = wristDist(a, last[0]) + wristDist(b, last[1]);
        const swap = wristDist(a, last[1]) + wristDist(b, last[0]);
        [slots[0], slots[1]] = keep <= swap ? [a, b] : [b, a];
      } else if (last[0] || last[1]) {
        const known = last[0] ? 0 : 1;
        const aCloser = wristDist(a, last[known]!) <= wristDist(b, last[known]!);
        slots[known] = aCloser ? a : b;
        slots[1 - known] = aCloser ? b : a;
      } else if (slotOf(a) !== slotOf(b)) {
        slots[slotOf(a)] = a;
        slots[slotOf(b)] = b;
      } else {
        // Same label on both: the person's right hand appears on the image's left in an unmirrored feed.
        const [l, r] = a.landmarks[WRIST].x <= b.landmarks[WRIST].x ? [a, b] : [b, a];
        slots[0] = l;
        slots[1] = r;
      }
    } else if (hands.length === 1) {
      const h = hands[0];
      if (last[0] && last[1]) slots[wristDist(h, last[0]) <= wristDist(h, last[1]) ? 0 : 1] = h;
      else if (last[0] || last[1]) slots[last[0] ? 0 : 1] = h;
      else slots[dominant] = h;
    }
    for (let s = 0; s < HAND_SLOTS; s++) {
      const h = slots[s];
      if (h) last[s] = { x: h.landmarks[WRIST].x, y: h.landmarks[WRIST].y };
    }
    out.push(slots);
  }
  return out;
}

function handToSlotVector(hand: HandData): number[] {
  const v = new Array<number>(HAND_FEATURES + 1);
  hand.landmarks.forEach((p, i) => {
    v[i * COORDS] = p.x;
    v[i * COORDS + 1] = p.y;
    v[i * COORDS + 2] = p.z;
  });
  v[HAND_FEATURES] = palmSize(hand.landmarks);
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
 * [SEQUENCE_LENGTH, 126] stored sequence (see SEQUENCE_FORMAT_VERSION).
 * Missing hands are zero-padded and flagged 0 in `validity`; short gaps are interpolated;
 * windows where fewer than `minValidRatio` of frames contain a hand are rejected.
 */
export function buildSequence(raw: FrameData[], options: SequenceOptions = {}): SequenceResult {
  const length = options.length ?? SEQUENCE_LENGTH;
  const minValidRatio = options.minValidRatio ?? MIN_VALID_RATIO;
  const maxGap = options.maxGap ?? MAX_INTERPOLATION_GAP;

  if (raw.length < 2) return { ok: false, reason: 'too-few-frames', validRatio: 0 };

  const slotted = options.slotting === 'per-frame' ? raw.map((f) => assignHandSlots(f.hands)) : trackHandSlots(raw);
  const tracks: SlotVector[][] = Array.from({ length: HAND_SLOTS }, (_, s) => slotted.map((slots) => (slots[s] ? handToSlotVector(slots[s]!) : null)));
  const resampled = tracks.map((t) => resampleTrack(fillGaps(t, maxGap), length));

  const frames: number[][] = Array.from({ length }, () => new Array<number>(FEATURE_SIZE).fill(0));
  const validity: number[][] = Array.from({ length }, () => new Array<number>(HAND_SLOTS).fill(0));

  for (let s = 0; s < HAND_SLOTS; s++) {
    const track = resampled[s];
    const present = track.filter((v): v is number[] => v !== null);
    if (present.length === 0) continue;
    const ref = present[0];
    const scale = Math.max(median(present.map((v) => v[HAND_FEATURES])), 1e-6);
    for (let t = 0; t < length; t++) {
      const v = track[t];
      if (!v) continue;
      const offset = s * HAND_FEATURES;
      for (let i = 0; i < HAND_FEATURES; i++) frames[t][offset + i] = (v[i] - ref[i % COORDS]) / scale;
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

/** Derive validity from a stored sequence: a present hand block is never all zeros. */
export function deriveValidity(frames: number[][]): number[][] {
  return frames.map((row) =>
    Array.from({ length: HAND_SLOTS }, (_, s) => (row.slice(s * HAND_FEATURES, (s + 1) * HAND_FEATURES).some((v) => v !== 0) ? 1 : 0)),
  );
}

/**
 * Convert a v1 sample (wrist-relative shape + wrist trajectory in the wrist slot) to v2
 * (absolute palm-unit coordinates): landmark_i = trajectory + relative_i.
 */
export function migrateV1Frames(frames: number[][], validity: number[][]): number[][] {
  return frames.map((row, t) => {
    const out = row.slice();
    for (let s = 0; s < HAND_SLOTS; s++) {
      if (!validity[t][s]) continue;
      const o = s * HAND_FEATURES;
      for (let i = 1; i < HAND_FEATURES / COORDS; i++) for (let c = 0; c < COORDS; c++) out[o + i * COORDS + c] = row[o + i * COORDS + c] + row[o + c];
    }
    return out;
  });
}

export function countHands(frame: FrameData | null): number {
  return frame ? frame.hands.length : 0;
}

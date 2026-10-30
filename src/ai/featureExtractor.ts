import { COORDS, HAND_FEATURES, HAND_SLOTS, INDEX_MCP, LANDMARKS_PER_HAND, MIDDLE_MCP, PINKY_MCP, WRIST } from './constants';
import { deriveValidity } from './sequenceProcessor';

/**
 * Model features (version 3), computed from a stored [30, 126] landmark sequence.
 *
 * Earlier versions fed wrist-relative landmarks plus raw wrist trajectory straight into the
 * LSTM. Trajectory values were several times larger than finger values and nothing was
 * standardised, so the network mostly learned *arm direction*; finger shape was also entangled
 * with wrist rotation. Each hand slot now contributes:
 *
 *  - shape (60):        landmarks 1–20 in a hand-local frame (knuckle axis × palm axis),
 *                       scaled by palm size → finger configuration independent of arm angle
 *  - orientation (6):   palm "up" axis and palm normal in camera space
 *  - position (3):      wrist position in palm units relative to the window start
 *  - wrist velocity (3)
 *  - fingertip velocity (15): per-frame change of the 5 fingertips in the hand-local frame
 *                       → finger motions such as wiggling, beckoning, opening/closing
 *  - present flag (1)
 *
 * plus the vector between the two wrists (3). Features are standardised with statistics
 * computed on the training set (see computeNormalization) before reaching the model.
 */
export const FEATURE_VERSION = 3;

const SHAPE = (LANDMARKS_PER_HAND - 1) * COORDS; // 60
const TIPS = [4, 8, 12, 16, 20];
export const PER_HAND_FEATURES = SHAPE + 6 + 3 + 3 + TIPS.length * COORDS + 1; // 88
export const MODEL_FEATURES = HAND_SLOTS * PER_HAND_FEATURES + 3; // 179
const PRESENT = PER_HAND_FEATURES - 1;

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
function norm(a: V3, fallback: V3): V3 {
  const l = len(a);
  return l > 1e-6 ? scale(a, 1 / l) : fallback;
}

function point(row: number[], slot: number, i: number): V3 {
  const o = slot * HAND_FEATURES + i * COORDS;
  return [row[o], row[o + 1], row[o + 2]];
}

interface HandFrame {
  shape: number[];
  up: V3;
  normal: V3;
  wrist: V3;
}

function describeHand(row: number[], slot: number): HandFrame {
  const pts = Array.from({ length: LANDMARKS_PER_HAND }, (_, i) => point(row, slot, i));
  const w = pts[WRIST];
  const across = norm(sub(pts[INDEX_MCP], pts[PINKY_MCP]), [1, 0, 0]);
  const up0 = norm(sub(pts[MIDDLE_MCP], w), [0, -1, 0]);
  const up = norm(sub(up0, scale(across, dot(up0, across))), [0, -1, 0]);
  const normal = norm(cross(across, up), [0, 0, 1]);
  const palm =
    Math.max((len(sub(pts[INDEX_MCP], w)) + len(sub(pts[MIDDLE_MCP], w)) + len(sub(pts[PINKY_MCP], w)) + len(sub(pts[INDEX_MCP], pts[PINKY_MCP]))) / 4, 1e-6);
  const shape: number[] = [];
  for (let i = 1; i < LANDMARKS_PER_HAND; i++) {
    const d = scale(sub(pts[i], w), 1 / palm);
    shape.push(dot(d, across), dot(d, up), dot(d, normal));
  }
  return { shape, up, normal, wrist: w };
}

/** [T, 126] stored sequence → [T, MODEL_FEATURES] raw (unstandardised) features. */
export function extractFeatures(frames: number[][], validity: number[][] = deriveValidity(frames)): number[][] {
  const T = frames.length;
  const hands: Array<Array<HandFrame | null>> = Array.from({ length: HAND_SLOTS }, (_, s) =>
    frames.map((row, t) => (validity[t][s] ? describeHand(row, s) : null)),
  );
  const out: number[][] = [];
  for (let t = 0; t < T; t++) {
    const row = new Array<number>(MODEL_FEATURES).fill(0);
    for (let s = 0; s < HAND_SLOTS; s++) {
      const h = hands[s][t];
      if (!h) continue;
      const prev = t > 0 ? hands[s][t - 1] : null;
      const o = s * PER_HAND_FEATURES;
      let k = o;
      for (const v of h.shape) row[k++] = v;
      for (const v of h.up) row[k++] = v;
      for (const v of h.normal) row[k++] = v;
      for (const v of h.wrist) row[k++] = v;
      const wv = prev ? sub(h.wrist, prev.wrist) : [0, 0, 0];
      for (const v of wv) row[k++] = v;
      for (const tip of TIPS) {
        const j = (tip - 1) * COORDS;
        for (let c = 0; c < COORDS; c++) row[k++] = prev ? h.shape[j + c] - prev.shape[j + c] : 0;
      }
      row[o + PRESENT] = 1;
    }
    const a = hands[0][t];
    const b = hands[1][t];
    if (a && b) {
      const d = sub(b.wrist, a.wrist);
      row[MODEL_FEATURES - 3] = d[0];
      row[MODEL_FEATURES - 2] = d[1];
      row[MODEL_FEATURES - 1] = d[2];
    }
    out.push(row);
  }
  return out;
}

export interface FeatureNormalization {
  version: number;
  mean: number[];
  std: number[];
}

/** Which slot "owns" feature i: 0/1 for per-hand features, 2 for the two-hand vector, -1 for present flags. */
function owner(i: number): number {
  if (i >= HAND_SLOTS * PER_HAND_FEATURES) return 2;
  const s = Math.floor(i / PER_HAND_FEATURES);
  return i - s * PER_HAND_FEATURES === PRESENT ? -1 : s;
}
const OWNERS = Array.from({ length: MODEL_FEATURES }, (_, i) => owner(i));

const isOn = (row: number[], o: number) =>
  o === 2 ? row[PRESENT] === 1 && row[PER_HAND_FEATURES + PRESENT] === 1 : row[o * PER_HAND_FEATURES + PRESENT] === 1;

/** Per-feature mean/std over frames where the owning hand is present. */
export function computeNormalization(sequences: number[][][]): FeatureNormalization {
  const sum = new Float64Array(MODEL_FEATURES);
  const sq = new Float64Array(MODEL_FEATURES);
  const n = new Float64Array(MODEL_FEATURES);
  for (const seq of sequences)
    for (const row of seq)
      for (let i = 0; i < MODEL_FEATURES; i++) {
        const o = OWNERS[i];
        if (o === -1 || !isOn(row, o)) continue;
        sum[i] += row[i];
        sq[i] += row[i] * row[i];
        n[i]++;
      }
  const mean = Array.from(sum, (s, i) => (n[i] ? s / n[i] : 0));
  const std = Array.from(sq, (s, i) => (n[i] ? Math.sqrt(Math.max(s / n[i] - mean[i] ** 2, 0)) : 1)).map((v) => Math.max(v, 1e-2));
  OWNERS.forEach((o, i) => {
    if (o === -1) {
      mean[i] = 0;
      std[i] = 1;
    }
  });
  return { version: FEATURE_VERSION, mean, std };
}

/** Standardise; absent hands stay exactly 0 and values are clipped to ±6σ. */
export function applyNormalization(seq: number[][], normalization: FeatureNormalization): number[][] {
  const { mean, std } = normalization;
  return seq.map((row) =>
    row.map((v, i) => {
      const o = OWNERS[i];
      if (o === -1) return v;
      if (!isOn(row, o)) return 0;
      return Math.max(-6, Math.min(6, (v - mean[i]) / std[i]));
    }),
  );
}

/** Stored sequence → standardised model input. */
export function toModelInput(frames: number[][], normalization: FeatureNormalization): number[][] {
  return applyNormalization(extractFeatures(frames), normalization);
}

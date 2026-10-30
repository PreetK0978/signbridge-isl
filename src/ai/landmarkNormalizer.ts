import { COORDS, HAND_FEATURES, INDEX_MCP, LANDMARKS_PER_HAND, MIDDLE_MCP, PINKY_MCP, WRIST } from './constants';
import type { Landmark } from '../types';

const EPSILON = 1e-6;

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Palm size used as the scale reference: mean of wrist→index MCP, wrist→middle MCP,
 * wrist→pinky MCP and index MCP→pinky MCP. Averaging several bones keeps the scale
 * stable when one of them is foreshortened by hand rotation.
 */
export function palmSize(landmarks: Landmark[]): number {
  if (landmarks.length !== LANDMARKS_PER_HAND) {
    throw new Error(`Expected ${LANDMARKS_PER_HAND} landmarks, received ${landmarks.length}`);
  }
  const w = landmarks[WRIST];
  const size =
    (dist(w, landmarks[INDEX_MCP]) +
      dist(w, landmarks[MIDDLE_MCP]) +
      dist(w, landmarks[PINKY_MCP]) +
      dist(landmarks[INDEX_MCP], landmarks[PINKY_MCP])) /
    4;
  return Math.max(size, EPSILON);
}

/**
 * Normalise one hand: translate so the wrist is the origin and divide by palm size.
 * Orientation is intentionally preserved (no rotation) because hand orientation is
 * meaningful in sign language. Returns HAND_FEATURES (63) numbers; the wrist slot
 * (first 3 values) is always 0 here and is later filled with the wrist trajectory
 * by the sequence processor.
 */
export function normalizeHand(landmarks: Landmark[]): number[] {
  const scale = palmSize(landmarks);
  const w = landmarks[WRIST];
  const out = new Array<number>(HAND_FEATURES);
  for (let i = 0; i < LANDMARKS_PER_HAND; i++) {
    const p = landmarks[i];
    out[i * COORDS] = (p.x - w.x) / scale;
    out[i * COORDS + 1] = (p.y - w.y) / scale;
    out[i * COORDS + 2] = (p.z - w.z) / scale;
  }
  return out;
}

export function isFiniteLandmarks(landmarks: Landmark[]): boolean {
  return (
    landmarks.length === LANDMARKS_PER_HAND &&
    landmarks.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))
  );
}

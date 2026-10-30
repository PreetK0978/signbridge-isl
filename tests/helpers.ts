import { buildSequence } from '../src/ai/sequenceProcessor';
import type { FrameData, HandData, Handedness, Landmark, TrainingSample } from '../src/types';
import { seededRandom } from '../src/utils/hash';

/**
 * Deterministic synthetic hand geometry for tests. This is test scaffolding only —
 * it is not used by the app and is not sign-language data.
 */
const FINGER_ANGLES = [-0.9, -0.35, 0, 0.3, 0.6];
const JOINTS = [0.35, 0.55, 0.72, 0.88];

export function makeHand(opts: { x?: number; y?: number; scale?: number; angle?: number; curl?: number; handedness?: Handedness; score?: number } = {}): HandData {
  const { x = 0.5, y = 0.6, scale = 0.2, angle = 0, curl = 0, handedness = 'Right', score = 0.95 } = opts;
  const pts: Landmark[] = [{ x: 0, y: 0, z: 0 }];
  FINGER_ANGLES.forEach((a, f) => {
    JOINTS.forEach((d, j) => {
      const bend = curl * j * 0.4;
      const theta = a + bend * (f === 0 ? -1 : 1);
      pts.push({ x: Math.sin(theta) * d, y: -Math.cos(theta) * d, z: -0.02 * j });
    });
  });
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    handedness,
    score,
    landmarks: pts.map((p) => ({ x: x + (p.x * c - p.y * s) * scale, y: y + (p.x * s + p.y * c) * scale, z: p.z * scale })),
  };
}

export type Motion = 'swipe' | 'raise' | 'twist';

/** Raw frames for one synthetic motion, with seeded jitter. */
export function makeMotionFrames(motion: Motion, seed: number, n = 40): FrameData[] {
  const rand = seededRandom(seed);
  const jitter = () => (rand() - 0.5) * 0.01;
  const scale = 0.16 + rand() * 0.08;
  const frames: FrameData[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let hand: HandData;
    if (motion === 'swipe') hand = makeHand({ x: 0.3 + 0.4 * t + jitter(), y: 0.6 + jitter(), scale });
    else if (motion === 'raise') hand = makeHand({ x: 0.5 + jitter(), y: 0.75 - 0.4 * t + jitter(), scale, curl: 0.5 });
    else hand = makeHand({ x: 0.5 + jitter(), y: 0.6 + jitter(), scale, angle: 1.2 * t });
    frames.push({ timestamp: i * 33, hands: [hand] });
  }
  return frames;
}

let counter = 0;
export function makeSample(labelId: string, motion: Motion, seed: number, sessionId = 'session-1'): TrainingSample {
  const seq = buildSequence(makeMotionFrames(motion, seed));
  if (!seq.ok) throw new Error('synthetic sequence rejected');
  return { id: `s${counter++}`, labelId, sessionId, frames: seq.frames, validity: seq.validity, source: 'webcam', createdAt: Date.now() };
}

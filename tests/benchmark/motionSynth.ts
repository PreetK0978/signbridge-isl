/**
 * Synthetic signer simulator for the motion benchmark.
 *
 * A kinematic 3-D hand (wrist, thumb CMC + 3 segments, 4 fingers × MCP + 3 segments) is posed
 * per frame and projected into MediaPipe-style normalised image coordinates. Signers differ in
 * hand size, finger proportions, handedness, resting angle, position, speed, amplitude, timing,
 * sensor noise, dropped detections and Left/Right label flicker.
 *
 * This is test scaffolding to measure the recognition pipeline reproducibly. It is NOT sign
 * language data and is never used to train the app's models.
 */
import type { FrameData, HandData, Landmark } from '../../src/types';
import { seededRandom } from '../../src/utils/hash';

type V3 = [number, number, number];

const BASES: Array<[number, number]> = [
  [-0.25, 0.25],
  [-0.32, 0.95],
  [-0.08, 1.0],
  [0.15, 0.95],
  [0.35, 0.82],
];
const SEGMENTS = [
  [0.4, 0.32, 0.27],
  [0.45, 0.27, 0.22],
  [0.5, 0.3, 0.24],
  [0.46, 0.28, 0.22],
  [0.36, 0.22, 0.2],
];
const ANGLES = [-0.9, -0.12, 0, 0.1, 0.22];
const MAX_FLEX = [1.4, 1.7, 1.2];

export interface Pose {
  x: number;
  y: number;
  roll: number;
  yaw: number;
  pitch: number;
  /** thumb, index, middle, ring, pinky in [0,1] */
  curl: number[];
}

export interface Signer {
  id: string;
  side: 'Right' | 'Left';
  scale: number;
  fingerScale: number[];
  roll: number;
  yaw: number;
  pitch: number;
  cx: number;
  cy: number;
  amplitude: number;
  speed: number;
  noise: number;
  flicker: number;
  dropout: number;
}

function rotate(p: V3, roll: number, yaw: number, pitch: number): V3 {
  let [x, y, z] = p;
  // roll (around z)
  [x, y] = [x * Math.cos(roll) - y * Math.sin(roll), x * Math.sin(roll) + y * Math.cos(roll)];
  // yaw (around y)
  [x, z] = [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
  // pitch (around x)
  [y, z] = [y * Math.cos(pitch) - z * Math.sin(pitch), y * Math.sin(pitch) + z * Math.cos(pitch)];
  return [x, y, z];
}

/** Local hand points (y towards the fingers, palm facing the camera, curling towards −z). */
function localHand(curl: number[], fingerScale: number[]): V3[] {
  const pts: V3[] = [[0, 0, 0]];
  for (let f = 0; f < 5; f++) {
    const [bx, by] = BASES[f];
    let p: V3 = [bx, by, 0];
    pts.push(p);
    const a = ANGLES[f];
    const d0: V3 = [Math.sin(a), Math.cos(a), 0];
    const n: V3 = f === 0 ? [0.78, 0, -0.62] : [0, 0, -1];
    let phi = 0;
    for (let j = 0; j < 3; j++) {
      phi += curl[f] * MAX_FLEX[j];
      const dir: V3 = [d0[0] * Math.cos(phi) + n[0] * Math.sin(phi), d0[1] * Math.cos(phi) + n[1] * Math.sin(phi), d0[2] * Math.cos(phi) + n[2] * Math.sin(phi)];
      const l = SEGMENTS[f][j] * fingerScale[f];
      p = [p[0] + dir[0] * l, p[1] + dir[1] * l, p[2] + dir[2] * l];
      pts.push(p);
    }
  }
  // wrist + 5 fingers × (base + 3 joints) = 21 landmarks, in MediaPipe order
  return pts;
}

export function renderHand(pose: Pose, signer: Signer, side: 'Right' | 'Left'): Landmark[] {
  const mirror = side === 'Left' ? -1 : 1;
  return localHand(pose.curl, signer.fingerScale).map(([x, y, z]) => {
    const [rx, ry, rz] = rotate([x * mirror, y, z], pose.roll * mirror, pose.yaw * mirror, pose.pitch);
    return { x: pose.x + rx * signer.scale, y: pose.y - ry * signer.scale, z: rz * signer.scale };
  });
}

const OPEN = [0, 0, 0, 0, 0];
const FIST = [0.85, 1, 1, 1, 1];
const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

/** Dominant-hand pose (and optional second hand) at phase t ∈ [0,1], in a signer-neutral frame. */
type GestureFn = (t: number) => { dx: number; dy: number; roll?: number; yaw?: number; curl: number[]; second?: { dx: number; dy: number; yaw: number; curl: number[] } };

export const GESTURES: Record<string, GestureFn> = {
  swipe_right_open: (t) => ({ dx: -0.15 + 0.3 * t, dy: 0, curl: OPEN }),
  swipe_right_close: (t) => ({ dx: -0.15 + 0.3 * t, dy: 0, curl: lerp(OPEN, FIST, Math.min(1, t * 1.3)) }),
  // Same arm path and the same two hand shapes as swipe_right_close, but in the opposite order.
  swipe_right_open_from_fist: (t) => ({ dx: -0.15 + 0.3 * t, dy: 0, curl: lerp(FIST, OPEN, Math.min(1, t * 1.3)) }),
  swipe_right_wiggle: (t) => ({ dx: -0.15 + 0.3 * t, dy: 0, curl: [0.1, ...[0, 1, 2, 3].map((f) => 0.4 + 0.4 * Math.sin(2 * Math.PI * 2.5 * t + f * 0.9))] }),
  swipe_left_open: (t) => ({ dx: 0.15 - 0.3 * t, dy: 0, curl: OPEN }),
  close_hand: (t) => ({ dx: 0, dy: 0, curl: lerp(OPEN, FIST, Math.min(1, t * 1.2)) }),
  open_hand: (t) => ({ dx: 0, dy: 0, curl: lerp(FIST, OPEN, Math.min(1, t * 1.2)) }),
  beckon: (t) => ({ dx: 0, dy: 0, curl: [0.8, 0.5 - 0.5 * Math.cos(2 * Math.PI * 2 * t), 1, 1, 1] }),
  wave: (t) => ({ dx: 0, dy: 0, roll: 0.45 * Math.sin(2 * Math.PI * 2 * t), curl: OPEN }),
  twist: (t) => ({ dx: 0, dy: 0, yaw: 2.6 * t, curl: OPEN }),
  circle: (t) => ({ dx: 0.1 * Math.cos(2 * Math.PI * t) - 0.1, dy: 0.1 * Math.sin(2 * Math.PI * t), curl: OPEN }),
  circle_reverse: (t) => ({ dx: 0.1 * Math.cos(2 * Math.PI * t) - 0.1, dy: -0.1 * Math.sin(2 * Math.PI * t), curl: OPEN }),
  raise_fist: (t) => ({ dx: 0, dy: 0.15 - 0.3 * t, curl: FIST }),
  raise_open: (t) => ({ dx: 0, dy: 0.15 - 0.3 * t, curl: OPEN }),
  clap: (t) => {
    const d = 0.05 + 0.13 * (0.5 + 0.5 * Math.cos(2 * Math.PI * 2 * t));
    return { dx: d, dy: 0, yaw: -1.2, curl: OPEN, second: { dx: -d, dy: 0, yaw: -1.2, curl: OPEN } };
  },
};

/** Out-of-vocabulary motions used to test unknown-sign rejection. */
export const OOV_GESTURES: Record<string, GestureFn> = {
  swipe_down_open: (t) => ({ dx: 0, dy: -0.15 + 0.3 * t, curl: OPEN }),
  thumbs_up: () => ({ dx: 0, dy: 0, curl: [0, 1, 1, 1, 1] }),
  pinch_repeat: (t) => ({ dx: 0, dy: 0, curl: [0.5 - 0.5 * Math.cos(2 * Math.PI * 2 * t), 0.5 - 0.5 * Math.cos(2 * Math.PI * 2 * t), 0, 0, 0] }),
  diagonal_close: (t) => ({ dx: -0.1 + 0.2 * t, dy: 0.1 - 0.2 * t, curl: lerp(OPEN, FIST, t) }),
};

/** Pairs/groups that share arm motion (or stillness) and differ only in hand motion. */
export const HARD_GROUPS = [
  ['swipe_right_open', 'swipe_right_close', 'swipe_right_open_from_fist', 'swipe_right_wiggle'],
  ['close_hand', 'open_hand', 'beckon'],
  ['circle', 'circle_reverse'],
  ['raise_fist', 'raise_open'],
  ['wave', 'twist'],
];

/** Same person on another day: small shifts in position, angle, distance and noise. */
export function sessionOf(signer: Signer, session: number): Signer {
  const r = seededRandom(session * 31337 + signer.cx * 1e6);
  const u = (a: number, b: number) => a + (b - a) * r();
  return {
    ...signer,
    id: `${signer.id}-s${session}`,
    cx: signer.cx + u(-0.05, 0.05),
    cy: signer.cy + u(-0.04, 0.04),
    roll: signer.roll + u(-0.1, 0.1),
    yaw: signer.yaw + u(-0.1, 0.1),
    scale: signer.scale * u(0.9, 1.1),
    noise: signer.noise * u(0.8, 1.3),
    speed: signer.speed * u(0.9, 1.1),
  };
}

export function makeSigner(seed: number, overrides: Partial<Signer> = {}): Signer {
  const r = seededRandom(seed * 7919 + 13);
  const u = (a: number, b: number) => a + (b - a) * r();
  return {
    id: `signer-${seed}`,
    side: r() < 0.8 ? 'Right' : 'Left',
    scale: u(0.13, 0.22),
    fingerScale: Array.from({ length: 5 }, () => u(0.92, 1.08)),
    roll: u(-0.3, 0.3),
    yaw: u(-0.35, 0.35),
    pitch: u(-0.25, 0.25),
    cx: u(0.4, 0.6),
    cy: u(0.47, 0.63),
    amplitude: u(0.8, 1.25),
    speed: u(0.8, 1.25),
    noise: u(0.002, 0.006),
    flicker: u(0.06, 0.12),
    dropout: u(0.02, 0.06),
    ...overrides,
  };
}

/** Simulate one 1.5 s recording (45 frames @ 30 fps) of `gesture` by `signer`. */
export function recordGesture(gesture: GestureFn, signer: Signer, seed: number, frames = 45): FrameData[] {
  const r = seededRandom(seed * 104729 + 7);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-9))) * Math.cos(2 * Math.PI * r());
  // Live-like timing: the gesture may start late in the window and occasionally run past its end.
  const delay = r() * 0.35;
  const duration = 1.1 / (signer.speed * (0.9 + r() * 0.2));
  const amp = signer.amplitude * (0.85 + r() * 0.3);
  const mx = signer.side === 'Left' ? -1 : 1;
  const out: FrameData[] = [];
  for (let i = 0; i < frames; i++) {
    const time = i / 30;
    const t = Math.min(1, Math.max(0, (time - delay) / duration));
    const g = gesture(t);
    const hands: HandData[] = [];
    const add = (dx: number, dy: number, yaw: number, roll: number, curl: number[], side: 'Right' | 'Left', sign: number) => {
      if (r() < signer.dropout) return;
      const pose: Pose = { x: signer.cx + dx * amp * sign, y: signer.cy + dy * amp, roll: signer.roll + roll, yaw: signer.yaw + yaw, pitch: signer.pitch, curl };
      const lm = renderHand(pose, signer, side).map((p) => ({ x: p.x + gauss() * signer.noise, y: p.y + gauss() * signer.noise, z: p.z + gauss() * signer.noise }));
      const flipped = r() < signer.flicker;
      hands.push({ landmarks: lm, handedness: flipped ? (side === 'Right' ? 'Left' : 'Right') : side, score: 0.7 + r() * 0.29 });
    };
    add(g.dx, g.dy, g.yaw ?? 0, g.roll ?? 0, g.curl, signer.side, mx);
    if (g.second) add(g.second.dx, g.second.dy, g.second.yaw, 0, g.second.curl, signer.side === 'Right' ? 'Left' : 'Right', mx);
    out.push({ timestamp: Math.round(time * 1000), hands });
  }
  return out;
}

import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { FrameData, HandData } from '../types';

/** Convert a MediaPipe result into SignBridge's FrameData. Pure, so it is unit-testable. */
export function toFrameData(result: Pick<HandLandmarkerResult, 'landmarks'> & Partial<HandLandmarkerResult>, timestamp: number): FrameData {
  // `handedness` replaced the deprecated `handednesses` field in newer releases.
  const categories = result.handedness ?? (result as { handednesses?: HandLandmarkerResult['handedness'] }).handednesses ?? [];
  const hands: HandData[] = result.landmarks.map((lms, i) => {
    const top = categories[i]?.[0];
    return {
      landmarks: lms.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      handedness: top?.categoryName === 'Left' ? 'Left' : 'Right',
      score: top?.score ?? 0,
    };
  });
  return { timestamp, hands };
}

/** detectForVideo requires strictly increasing timestamps; this keeps them monotonic. */
export class MonotonicClock {
  private last = -1;
  next(timestamp: number): number {
    const ts = Math.max(Math.round(timestamp), this.last + 1);
    this.last = ts;
    return ts;
  }
}

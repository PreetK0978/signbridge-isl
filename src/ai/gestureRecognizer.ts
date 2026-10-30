import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
import { MonotonicClock, toFrameData } from './handLandmarkerUtils';
import { assertAssetAvailable, GESTURE_RECOGNIZER_MODEL, MEDIAPIPE_WASM_BASE } from './modelAssets';
import type { FrameData } from '../types';

/**
 * GENERIC GESTURE DEMO — NOT ISL TRANSLATION.
 * Display text for MediaPipe's canned gesture classes. These are generic hand gestures,
 * deliberately NOT mapped to Indian Sign Language vocabulary.
 */
export const GENERIC_GESTURE_TEXT: Record<string, string> = {
  Closed_Fist: 'Closed fist',
  Open_Palm: 'Open palm',
  Pointing_Up: 'Pointing up',
  Thumb_Down: 'Thumbs down',
  Thumb_Up: 'Thumbs up',
  Victory: 'Victory sign',
  ILoveYou: '"I love you" hand shape',
};

export interface GenericGestureResult {
  frame: FrameData;
  gesture: string | null;
  text: string | null;
  score: number;
}

export class GenericGestureRecognizer {
  private clock = new MonotonicClock();
  private constructor(private recognizer: GestureRecognizer) {}

  static async create(delegate: 'GPU' | 'CPU' = 'GPU'): Promise<GenericGestureRecognizer> {
    await assertAssetAvailable(GESTURE_RECOGNIZER_MODEL);
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);
    const make = (d: 'GPU' | 'CPU') =>
      GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath: GESTURE_RECOGNIZER_MODEL, delegate: d },
        runningMode: 'VIDEO',
        numHands: 2,
      });
    try {
      return new GenericGestureRecognizer(await make(delegate));
    } catch (err) {
      if (delegate === 'CPU') throw err;
      return new GenericGestureRecognizer(await make('CPU'));
    }
  }

  recognize(video: HTMLVideoElement, timestamp: number): GenericGestureResult {
    const ts = this.clock.next(timestamp);
    const result = this.recognizer.recognizeForVideo(video, ts);
    const frame = toFrameData({ landmarks: result.landmarks, handedness: result.handedness }, ts);
    let best: { name: string; score: number } | null = null;
    for (const hand of result.gestures) {
      const top = hand[0];
      if (top && top.categoryName !== 'None' && (!best || top.score > best.score)) {
        best = { name: top.categoryName, score: top.score };
      }
    }
    return {
      frame,
      gesture: best?.name ?? null,
      text: best ? (GENERIC_GESTURE_TEXT[best.name] ?? best.name.replace(/_/g, ' ')) : null,
      score: best?.score ?? 0,
    };
  }

  close(): void {
    this.recognizer.close();
  }
}

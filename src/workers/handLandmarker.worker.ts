/// <reference lib="webworker" />
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { MonotonicClock, toFrameData } from '../ai/handLandmarkerUtils';

type Request =
  | { type: 'init'; wasmBase: string; modelPath: string; numHands: number }
  | { type: 'detect'; id: number; bitmap: ImageBitmap; timestamp: number }
  | { type: 'close' };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let landmarker: HandLandmarker | null = null;
const clock = new MonotonicClock();

ctx.addEventListener('message', async (e: MessageEvent<Request>) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      const vision = await FilesetResolver.forVisionTasks(msg.wasmBase);
      landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: msg.modelPath, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numHands: msg.numHands,
      });
      ctx.postMessage({ type: 'ready' });
    } else if (msg.type === 'detect') {
      if (!landmarker) {
        msg.bitmap.close();
        return;
      }
      const ts = clock.next(msg.timestamp);
      const result = landmarker.detectForVideo(msg.bitmap, ts);
      msg.bitmap.close();
      ctx.postMessage({ type: 'result', id: msg.id, frame: toFrameData(result, ts) });
    } else if (msg.type === 'close') {
      landmarker?.close();
      landmarker = null;
    }
  } catch (err) {
    ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
});

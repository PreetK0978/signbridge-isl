import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { MonotonicClock, toFrameData } from './handLandmarkerUtils';
import { assertAssetAvailable, HAND_LANDMARKER_MODEL, MEDIAPIPE_WASM_BASE } from './modelAssets';
import type { FrameData, HandTrackingEngine } from '../types';

export { MonotonicClock, toFrameData };

export interface HandLandmarkerOptions {
  wasmBase?: string;
  modelPath?: string;
  numHands?: number;
  delegate?: 'GPU' | 'CPU';
  minDetectionConfidence?: number;
  minPresenceConfidence?: number;
  minTrackingConfidence?: number;
}

export async function createMediaPipeHandLandmarker(options: HandLandmarkerOptions = {}): Promise<HandLandmarker> {
  const modelPath = options.modelPath ?? HAND_LANDMARKER_MODEL;
  await assertAssetAvailable(modelPath);
  const vision = await FilesetResolver.forVisionTasks(options.wasmBase ?? MEDIAPIPE_WASM_BASE);
  const make = (delegate: 'GPU' | 'CPU') =>
    HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: modelPath, delegate },
      runningMode: 'VIDEO',
      numHands: options.numHands ?? 2,
      minHandDetectionConfidence: options.minDetectionConfidence ?? 0.5,
      minHandPresenceConfidence: options.minPresenceConfidence ?? 0.5,
      minTrackingConfidence: options.minTrackingConfidence ?? 0.5,
    });
  const delegate = options.delegate ?? 'GPU';
  try {
    return await make(delegate);
  } catch (err) {
    if (delegate === 'CPU') throw err;
    console.warn('[SignBridge] GPU delegate unavailable, falling back to CPU.', err);
    return make('CPU');
  }
}

/** Common interface for main-thread and Web Worker hand tracking. */
export interface HandTracker {
  readonly engine: HandTrackingEngine;
  detect(video: HTMLVideoElement, timestamp: number): Promise<FrameData>;
  close(): void;
}

/** Runs MediaPipe on the main thread (GPU delegate where available). */
export class MainThreadHandTracker implements HandTracker {
  readonly engine = 'main' as const;
  private clock = new MonotonicClock();

  private constructor(private landmarker: HandLandmarker) {}

  static async create(options?: HandLandmarkerOptions): Promise<MainThreadHandTracker> {
    return new MainThreadHandTracker(await createMediaPipeHandLandmarker(options));
  }

  async detect(source: HTMLVideoElement, timestamp: number): Promise<FrameData> {
    const ts = this.clock.next(timestamp);
    return toFrameData(this.landmarker.detectForVideo(source, ts), ts);
  }

  /** Synchronous variant used by the offline video extractor. */
  detectSync(source: HTMLVideoElement, timestamp: number): FrameData {
    const ts = this.clock.next(timestamp);
    return toFrameData(this.landmarker.detectForVideo(source, ts), ts);
  }

  close(): void {
    this.landmarker.close();
  }
}

type WorkerResponse =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'result'; id: number; frame: FrameData };

/**
 * Runs MediaPipe inside a dedicated Web Worker so inference never blocks React rendering.
 * Frames are transferred as ImageBitmaps. Uses the CPU delegate inside the worker.
 */
export class WorkerHandTracker implements HandTracker {
  readonly engine = 'worker' as const;
  private nextId = 0;
  private pending = new Map<number, { resolve: (f: FrameData) => void; reject: (e: Error) => void }>();

  private constructor(private worker: Worker) {
    worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === 'error') {
        const error = new Error(e.data.message);
        for (const p of this.pending.values()) p.reject(error);
        this.pending.clear();
        return;
      }
      if (e.data.type !== 'result') return;
      this.pending.get(e.data.id)?.resolve(e.data.frame);
      this.pending.delete(e.data.id);
    });
    worker.addEventListener('error', (e) => {
      for (const p of this.pending.values()) p.reject(new Error(e.message || 'Hand tracking worker crashed'));
      this.pending.clear();
    });
  }

  static async create(options: HandLandmarkerOptions = {}): Promise<WorkerHandTracker> {
    const modelPath = options.modelPath ?? HAND_LANDMARKER_MODEL;
    await assertAssetAvailable(modelPath);
    const worker = new Worker(new URL('../workers/handLandmarker.worker.ts', import.meta.url));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Hand tracking worker timed out while loading.')), 30000);
      worker.addEventListener('message', function onMessage(e: MessageEvent<WorkerResponse>) {
        if (e.data.type === 'ready') {
          clearTimeout(timer);
          worker.removeEventListener('message', onMessage);
          resolve();
        } else if (e.data.type === 'error') {
          clearTimeout(timer);
          worker.removeEventListener('message', onMessage);
          reject(new Error(e.data.message));
        }
      });
      worker.addEventListener('error', (e) => {
        clearTimeout(timer);
        reject(new Error(e.message || 'Hand tracking worker failed to start.'));
      });
      worker.postMessage({
        type: 'init',
        wasmBase: options.wasmBase ?? MEDIAPIPE_WASM_BASE,
        modelPath,
        numHands: options.numHands ?? 2,
      });
    }).catch((err) => {
      worker.terminate();
      throw err;
    });
    return new WorkerHandTracker(worker);
  }

  async detect(video: HTMLVideoElement, timestamp: number): Promise<FrameData> {
    const bitmap = await createImageBitmap(video);
    const id = this.nextId++;
    return new Promise<FrameData>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'detect', id, bitmap, timestamp }, [bitmap]);
    });
  }

  close(): void {
    this.worker.postMessage({ type: 'close' });
    this.worker.terminate();
    for (const p of this.pending.values()) p.reject(new Error('Hand tracker closed'));
    this.pending.clear();
  }
}

/** Create the requested tracker, falling back to the main thread if the worker cannot start. */
export async function createHandTracker(
  engine: HandTrackingEngine,
  options?: HandLandmarkerOptions,
): Promise<HandTracker> {
  if (engine === 'worker' && typeof Worker !== 'undefined' && typeof createImageBitmap !== 'undefined') {
    try {
      return await WorkerHandTracker.create(options);
    } catch (err) {
      console.warn('[SignBridge] Worker hand tracking failed, using main thread.', err);
    }
  }
  return MainThreadHandTracker.create(options);
}

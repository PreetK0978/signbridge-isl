import { useCallback } from 'react';
import { GenericGestureRecognizer } from '../ai/gestureRecognizer';
import { createHandTracker } from '../ai/handLandmarker';
import type { Detector } from './useHandTracking';
import type { AppSettings } from '../types';

/** Detector factory for the MediaPipe Hand Landmarker (main thread or worker). */
export function useLandmarkDetector(engine: AppSettings['engine'], delegate: AppSettings['delegate']) {
  return useCallback(async (): Promise<Detector> => {
    const tracker = await createHandTracker(engine, { delegate });
    return {
      detect: async (video, ts) => ({ frame: await tracker.detect(video, ts) }),
      close: () => tracker.close(),
    };
  }, [engine, delegate]);
}

/** Detector factory for the GENERIC gesture demo (not ISL). */
export function useGestureDetector(delegate: AppSettings['delegate']) {
  return useCallback(async (): Promise<Detector> => {
    const recognizer = await GenericGestureRecognizer.create(delegate);
    return {
      detect: async (video, ts) => {
        const r = recognizer.recognize(video, ts);
        return { frame: r.frame, gesture: { text: r.text, score: r.score } };
      },
      close: () => recognizer.close(),
    };
  }, [delegate]);
}

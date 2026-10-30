import { useEffect, useRef, useState, type RefObject } from 'react';
import type { FrameData } from '../types';

export interface Detection {
  frame: FrameData;
  /** Extra output from detectors such as the generic gesture recogniser. */
  gesture?: { text: string | null; score: number };
}

export interface Detector {
  detect(video: HTMLVideoElement, timestamp: number): Promise<Detection>;
  close(): void;
}

export type TrackingStatus = 'idle' | 'loading' | 'ready' | 'error';

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Start the loop only while the camera is live. */
  active: boolean;
  /** Factory for the detector; changing its identity recreates the detector. */
  createDetector: () => Promise<Detector>;
  targetFps: number;
  onDetection: (d: Detection) => void;
}

/**
 * Runs a throttled detection loop on the camera. A new frame is processed only when the
 * previous inference finished, the video produced a new frame and the FPS budget allows,
 * so slow devices degrade gracefully instead of queueing work and freezing the UI.
 */
export function useHandTracking({ videoRef, active, createDetector, targetFps, onDetection }: Options) {
  const [status, setStatus] = useState<TrackingStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [handCount, setHandCount] = useState(0);
  const onDetectionRef = useRef(onDetection);
  onDetectionRef.current = onDetection;
  const fpsRef = useRef(targetFps);
  fpsRef.current = targetFps;

  useEffect(() => {
    if (!active) {
      setStatus('idle');
      setFps(0);
      setHandCount(0);
      return;
    }
    let cancelled = false;
    let detector: Detector | null = null;
    let timer = 0;
    let busy = false;
    let lastRun = 0;
    let lastVideoTime = -1;
    let frames = 0;
    let fpsWindowStart = performance.now();
    let lastHands = -1;

    setStatus('loading');
    setError(null);

    // Timer-driven (not requestAnimationFrame) so tracking keeps running when the tab is in the background.
    const schedule = (delay: number) => {
      if (!cancelled) timer = window.setTimeout(loop, delay);
    };
    const loop = () => {
      if (cancelled) return;
      const interval = 1000 / Math.max(1, fpsRef.current);
      const video = videoRef.current;
      const now = performance.now();
      // While an inference is in flight no timer is pending; `finally` below reschedules.
      if (busy) return;
      if (!detector || !video || video.readyState < 2 || video.currentTime === lastVideoTime) return schedule(8);
      if (now - lastRun < interval) return schedule(interval - (now - lastRun));
      lastVideoTime = video.currentTime;
      lastRun = now;
      busy = true;
      detector
        .detect(video, now)
        .then((d) => {
          if (cancelled) return;
          frames++;
          if (now - fpsWindowStart >= 1000) {
            setFps(Math.round((frames * 1000) / (now - fpsWindowStart)));
            frames = 0;
            fpsWindowStart = now;
          }
          if (d.frame.hands.length !== lastHands) {
            lastHands = d.frame.hands.length;
            setHandCount(lastHands);
          }
          onDetectionRef.current(d);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
          setStatus('error');
          cancelled = true;
        })
        .finally(() => {
          busy = false;
          schedule(0);
        });
    };

    createDetector()
      .then((d) => {
        if (cancelled) {
          d.close();
          return;
        }
        detector = d;
        setStatus('ready');
        schedule(0);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      detector?.close();
    };
  }, [active, createDetector, videoRef]);

  return { status, error, fps, handCount };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { attachStream, CameraError, startCamera, stopStream, toCameraError } from '../services/cameraService';

export type CameraStatus = 'idle' | 'starting' | 'live' | 'error';

export function useCamera(deviceId?: string) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<CameraError | null>(null);

  const stop = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    setStatus('starting');
    setError(null);
    try {
      stopStream(streamRef.current);
      const stream = await startCamera({ deviceId: deviceId || undefined });
      streamRef.current = stream;
      if (!videoRef.current) throw new CameraError('unknown', 'Video element is not mounted.');
      await attachStream(videoRef.current, stream);
      setStatus('live');
    } catch (err) {
      stopStream(streamRef.current);
      streamRef.current = null;
      setError(toCameraError(err));
      setStatus('error');
    }
  }, [deviceId]);

  useEffect(() => () => stopStream(streamRef.current), []);

  return { videoRef, status, error, start, stop };
}

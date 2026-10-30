import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle, Camera, CameraOff, Cpu, Gauge, Hand, Loader2, RefreshCw } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { useHandTracking, type Detection, type Detector } from '../../hooks/useHandTracking';
import { useSettings } from '../../hooks/useAppContext';
import { drawHands } from '../../utils/drawing';
import { Badge, Button, StatusDot } from '../Common/ui';

interface Props {
  createDetector: () => Promise<Detector>;
  onDetection?: (d: Detection) => void;
  /** Rendered on top of the video (e.g. recording countdown). */
  overlay?: ReactNode;
  /** Extra controls shown next to start/stop. */
  controls?: ReactNode;
  detectorLabel?: string;
  onLiveChange?: (live: boolean) => void;
}

export function TrackedCamera({ createDetector, onDetection, overlay, controls, detectorLabel = 'MediaPipe Hand Landmarker', onLiveChange }: Props) {
  const { settings } = useSettings();
  const { videoRef, status: camStatus, error: camError, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const live = camStatus === 'live';
  const drawOpts = useRef({ mirror: settings.mirrorVideo, boxes: settings.showBoundingBoxes });
  drawOpts.current = { mirror: settings.mirrorVideo, boxes: settings.showBoundingBoxes };

  useEffect(() => onLiveChange?.(live), [live, onLiveChange]);

  const handle = useCallback(
    (d: Detection) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) drawHands(ctx, d.frame, drawOpts.current);
      }
      onDetection?.(d);
    },
    [onDetection, videoRef],
  );

  const tracking = useHandTracking({ videoRef, active: live, createDetector, targetFps: settings.targetFps, onDetection: handle });

  useEffect(() => {
    if (!live) canvasRef.current?.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, [live]);

  const handTone = tracking.handCount > 0 ? 'green' : tracking.status === 'ready' ? 'amber' : 'slate';

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-glow">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          style={{ transform: settings.mirrorVideo ? 'scaleX(-1)' : undefined }}
          playsInline
          muted
          aria-label="Webcam feed"
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover" aria-hidden />

        {!live && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-navy-900/95 to-navy-950/95 p-6 text-center">
            {camStatus === 'starting' ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                <p className="text-sm text-slate-300">Waiting for camera permission…</p>
              </>
            ) : camStatus === 'error' && camError ? (
              <>
                <CameraOff className="h-10 w-10 text-red-400" />
                <p className="max-w-md text-sm text-red-200" role="alert">{camError.message}</p>
                <Button variant="primary" icon={RefreshCw} onClick={start}>Try again</Button>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4">
                  <Camera className="h-8 w-8 text-cyan-300" />
                </div>
                <div>
                  <p className="font-display text-lg text-white">Camera is off</p>
                  <p className="mt-1 max-w-sm text-sm text-slate-400">Video stays on this device. Only hand landmarks are processed — nothing is recorded or uploaded.</p>
                </div>
                <Button variant="primary" icon={Camera} onClick={start}>Start camera</Button>
              </>
            )}
          </div>
        )}

        {live && tracking.status === 'loading' && (
          <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-navy-950/80 py-2 text-xs text-cyan-200">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading {detectorLabel}…
          </div>
        )}
        {live && tracking.status === 'error' && (
          <div className="absolute inset-x-3 top-3 flex items-start gap-2 rounded-xl border border-red-500/40 bg-navy-950/90 p-3 text-xs text-red-200" role="alert">
            <AlertTriangle className="h-4 w-4 flex-none" />
            <span>
              <strong className="block text-red-100">Model failed to load</strong>
              {tracking.error}
            </span>
          </div>
        )}
        {live && overlay}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge tone={live ? 'green' : 'slate'}>
            <StatusDot tone={live ? 'green' : 'slate'} /> {live ? 'Camera live' : 'Camera off'}
          </Badge>
          <Badge tone={handTone}>
            <Hand className="h-3 w-3" />
            {tracking.status === 'ready' ? (tracking.handCount ? `${tracking.handCount} hand${tracking.handCount > 1 ? 's' : ''} tracked` : 'No hands') : tracking.status === 'loading' ? 'Loading tracker' : tracking.status === 'error' ? 'Tracker error' : 'Tracker idle'}
          </Badge>
          <Badge tone="blue">
            <Gauge className="h-3 w-3" /> {tracking.fps} FPS
          </Badge>
          <Badge tone="slate">
            <Cpu className="h-3 w-3" /> {settings.engine === 'worker' ? 'Web Worker' : `Main thread · ${settings.delegate}`}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {controls}
          {live ? (
            <Button variant="secondary" icon={CameraOff} size="sm" onClick={stop}>Stop camera</Button>
          ) : (
            <Button variant="secondary" icon={Camera} size="sm" onClick={start} loading={camStatus === 'starting'}>Start camera</Button>
          )}
        </div>
      </div>
    </div>
  );
}

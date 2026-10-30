export type CameraErrorCode = 'unsupported' | 'insecure-context' | 'permission-denied' | 'no-camera' | 'in-use' | 'unknown';

export class CameraError extends Error {
  constructor(
    public readonly code: CameraErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CameraError';
  }
}

const MESSAGES: Record<CameraErrorCode, string> = {
  unsupported: 'This browser does not support camera access (getUserMedia). Try a recent Chrome, Edge or Firefox.',
  'insecure-context': 'Camera access needs a secure context. Open the app on http://localhost or over HTTPS.',
  'permission-denied':
    'Camera permission was denied. Click the camera icon in the address bar, allow access, then press "Start camera" again.',
  'no-camera': 'No camera was found. Connect a webcam (or pick another device in Settings) and try again.',
  'in-use': 'The camera is being used by another application. Close other apps using it and try again.',
  unknown: 'The camera could not be started.',
};

/** Map a getUserMedia DOMException to a friendly, typed error. */
export function toCameraError(err: unknown): CameraError {
  if (err instanceof CameraError) return err;
  const name = (err as { name?: string })?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return new CameraError('permission-denied', MESSAGES['permission-denied']);
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return new CameraError('no-camera', MESSAGES['no-camera']);
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new CameraError('in-use', MESSAGES['in-use']);
    default: {
      const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
      return new CameraError('unknown', MESSAGES.unknown + detail);
    }
  }
}

export interface CameraOptions {
  deviceId?: string;
  width?: number;
  height?: number;
}

export async function startCamera(options: CameraOptions = {}): Promise<MediaStream> {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    throw new CameraError('insecure-context', MESSAGES['insecure-context']);
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('unsupported', MESSAGES.unsupported);
  }
  const video: MediaTrackConstraints = {
    width: { ideal: options.width ?? 960 },
    height: { ideal: options.height ?? 540 },
    frameRate: { ideal: 30 },
  };
  if (options.deviceId) video.deviceId = { exact: options.deviceId };
  else video.facingMode = 'user';
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: false });
  } catch (err) {
    throw toCameraError(err);
  }
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}

/** Attach a stream to a <video> and wait until frames are flowing. */
export async function attachStream(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  if (video.readyState < 2) {
    await new Promise<void>((resolve) => {
      const done = () => {
        video.removeEventListener('loadeddata', done);
        resolve();
      };
      video.addEventListener('loadeddata', done);
    });
  }
  await video.play();
}

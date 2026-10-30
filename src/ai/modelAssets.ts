const base = import.meta.env.BASE_URL ?? '/';

function absolute(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const origin = typeof location !== 'undefined' ? location.origin : 'http://localhost';
  return new URL(path, origin).toString();
}

/** Where the MediaPipe WASM runtime is served from (copied by `npm run models:download`). */
export const MEDIAPIPE_WASM_BASE = absolute(import.meta.env.VITE_MEDIAPIPE_WASM_BASE || `${base}mediapipe/wasm`);
const MODEL_BASE = import.meta.env.VITE_MODEL_BASE || `${base}models`;

export const HAND_LANDMARKER_MODEL = absolute(`${MODEL_BASE}/hand_landmarker.task`);
export const GESTURE_RECOGNIZER_MODEL = absolute(`${MODEL_BASE}/gesture_recognizer.task`);

export class ModelAssetError extends Error {
  constructor(
    message: string,
    public readonly asset: string,
  ) {
    super(message);
    this.name = 'ModelAssetError';
  }
}

/** Fail fast with an actionable message when a model file has not been downloaded. */
export async function assertAssetAvailable(url: string): Promise<void> {
  let ok = false;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    // Vite's dev server answers unknown paths with index.html, so also check the content type.
    ok = res.ok && !(res.headers.get('content-type') ?? '').includes('text/html');
  } catch {
    ok = false;
  }
  if (!ok) {
    throw new ModelAssetError(
      `Model asset not found at ${url}. Run "npm run models:download" and restart the dev server.`,
      url,
    );
  }
}

import { MainThreadHandTracker } from './handLandmarker';
import type { RawFramesFile } from '../services/databaseService';
import type { FrameData } from '../types';

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)$/i;

export interface LabelledVideo {
  label: string;
  file: File;
}

/**
 * Group files picked from a folder (via <input webkitdirectory>) by their parent folder:
 *   dataset/HELLO/sample_001.mp4 → label "HELLO".
 */
export function groupVideosByFolder(files: File[]): LabelledVideo[] {
  const out: LabelledVideo[] = [];
  for (const file of files) {
    if (!VIDEO_EXT.test(file.name)) continue;
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const parts = path.split('/').filter(Boolean);
    if (parts.length < 2) continue; // need a label folder
    out.push({ label: parts[parts.length - 2], file });
  }
  return out;
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Video seek failed'));
    };
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = time;
  });
}

/** Step through a local video file at `fps`, running the hand landmarker on every frame. Nothing is uploaded. */
export async function extractFramesFromVideo(
  file: File,
  tracker: MainThreadHandTracker,
  fps = 30,
  maxSeconds = 6,
): Promise<FrameData[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error(`Cannot decode ${file.name}`));
    });
    const duration = Math.min(video.duration || 0, maxSeconds);
    const frames: FrameData[] = [];
    for (let t = 0; t < duration; t += 1 / fps) {
      await seek(video, t);
      frames.push(tracker.detectSync(video, t * 1000));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}

/** Convert a folder of labelled videos into a raw-frames file that `importDataset` understands. */
export async function extractDataset(
  videos: LabelledVideo[],
  onProgress?: (done: number, total: number, name: string) => void,
): Promise<RawFramesFile> {
  // A dedicated tracker keeps video timestamps separate from any live camera session.
  const tracker = await MainThreadHandTracker.create({ delegate: 'CPU' });
  const items: RawFramesFile['items'] = [];
  try {
    for (let i = 0; i < videos.length; i++) {
      const { label, file } = videos[i];
      onProgress?.(i, videos.length, file.name);
      try {
        items.push({ label, source: `${label}/${file.name}`, frames: await extractFramesFromVideo(file, tracker) });
      } catch (err) {
        console.warn(`[SignBridge] Skipping ${file.name}:`, err);
      }
    }
    onProgress?.(videos.length, videos.length, '');
  } finally {
    tracker.close();
  }
  return { format: 'signbridge-raw-frames', formatVersion: 1, items };
}

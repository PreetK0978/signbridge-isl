import type { AppSettings } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  confidenceThreshold: 0.8,
  minMargin: 0.25,
  maxNovelty: 1,
  stableFrames: 4,
  smoothingWindow: 6,
  cooldownMs: 1500,
  predictionIntervalMs: 150,
  recordingDurationMs: 1500,
  countdownSeconds: 3,
  targetFps: 30,
  mirrorVideo: true,
  showBoundingBoxes: true,
  manualConfirmation: false,
  autoSpeak: true,
  speechLanguage: 'en-IN',
  voiceURI: '',
  speechRate: 1,
  speechPitch: 1,
  speechVolume: 1,
  engine: 'main',
  delegate: 'GPU',
  epochs: 40,
  augment: true,
};

const KEY = 'signbridge.settings.v1';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable (private mode) — settings stay in memory
  }
}

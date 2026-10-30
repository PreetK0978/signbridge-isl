/** A single MediaPipe landmark in normalised image coordinates (x, y in [0,1], z relative depth). */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type Handedness = 'Left' | 'Right';

export interface HandData {
  landmarks: Landmark[];
  handedness: Handedness;
  /** Handedness classification score from MediaPipe (0..1). */
  score: number;
}

/** One processed camera frame: whatever hands MediaPipe found at `timestamp`. */
export interface FrameData {
  timestamp: number;
  hands: HandData[];
}

export type SignCategory =
  | 'greeting'
  | 'courtesy'
  | 'question'
  | 'need'
  | 'emotion'
  | 'family'
  | 'number'
  | 'alphabet'
  | 'action'
  | 'object'
  | 'other'
  | 'background';

export interface SignLabel {
  id: string;
  english: string;
  hindi: string;
  category: SignCategory;
  /** Link to an authoritative reference (e.g. the ISLRTC dictionary entry). */
  referenceUrl?: string;
  notes?: string;
  /**
   * Background / "no sign" class. Trained like any other class so the model learns
   * what resting hands look like, but never emitted as a word.
   */
  isBackground?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type SampleSource = 'webcam' | 'import' | 'video';

/** A fixed-length, normalised training sequence. */
export interface TrainingSample {
  id: string;
  labelId: string;
  /** Recording session. Train/validation splits never put one session in both sets. */
  sessionId: string;
  /** SEQUENCE_LENGTH x FEATURE_SIZE normalised features. */
  frames: number[][];
  /** SEQUENCE_LENGTH x HAND_SLOTS validity flags (1 = hand present / interpolated, 0 = padding). */
  validity: number[][];
  source: SampleSource;
  createdAt: number;
}

export interface EpochMetrics {
  epoch: number;
  loss: number;
  acc: number;
  valLoss: number | null;
  valAcc: number | null;
}

export interface ClassReport {
  labelId: string;
  name: string;
  precision: number;
  recall: number;
  support: number;
}

export interface EvaluationResult {
  accuracy: number;
  /** confusion[actual][predicted] */
  confusion: number[][];
  labelIds: string[];
  perClass: ClassReport[];
  sampleCount: number;
}

export interface SplitInfo {
  trainCount: number;
  valCount: number;
  /** "session" when whole sessions were held out; "sample" when a label had only one session. */
  strategy: 'session' | 'sample' | 'mixed' | 'none';
  duplicatesRemoved: number;
  labelsWithSampleLevelSplit: string[];
}

export interface ModelMeta {
  labelIds: string[];
  labelNames: string[];
  datasetVersion: string;
  trainedAt: number;
  sampleCount: number;
  epochs: number;
  history: EpochMetrics[];
  evaluation: EvaluationResult | null;
  split: SplitInfo;
  architecture: ClassifierConfig;
}

export interface ClassifierConfig {
  lstmUnits: number;
  denseUnits: number;
  dropout: number;
  learningRate: number;
}

export interface HistoryEntry {
  id: string;
  text: string;
  createdAt: number;
}

export type ActivityKind =
  | 'label-created'
  | 'label-updated'
  | 'label-deleted'
  | 'sample-recorded'
  | 'samples-imported'
  | 'model-trained'
  | 'model-deleted'
  | 'translation-session'
  | 'sentence-saved';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  message: string;
  createdAt: number;
}

export type HandTrackingEngine = 'main' | 'worker';

export interface AppSettings {
  confidenceThreshold: number;
  minMargin: number;
  stableFrames: number;
  smoothingWindow: number;
  cooldownMs: number;
  predictionIntervalMs: number;
  recordingDurationMs: number;
  countdownSeconds: number;
  targetFps: number;
  mirrorVideo: boolean;
  showBoundingBoxes: boolean;
  manualConfirmation: boolean;
  autoSpeak: boolean;
  speechLanguage: 'en-IN' | 'hi-IN';
  voiceURI: string;
  speechRate: number;
  speechPitch: number;
  speechVolume: number;
  engine: HandTrackingEngine;
  delegate: 'GPU' | 'CPU';
  epochs: number;
  augment: boolean;
}

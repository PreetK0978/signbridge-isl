/** Frames per training / inference sequence. */
export const SEQUENCE_LENGTH = 30;
/** Hands tracked per frame. Slot 0 = Right, slot 1 = Left (MediaPipe handedness labels). */
export const HAND_SLOTS = 2;
export const LANDMARKS_PER_HAND = 21;
export const COORDS = 3;
export const HAND_FEATURES = LANDMARKS_PER_HAND * COORDS; // 63
export const FEATURE_SIZE = HAND_SLOTS * HAND_FEATURES; // 126

/** Minimum fraction of resampled frames that must contain at least one hand. */
export const MIN_VALID_RATIO = 0.6;
/** Gaps of missing detections up to this many raw frames are linearly interpolated. */
export const MAX_INTERPOLATION_GAP = 4;

export const WRIST = 0;
export const INDEX_MCP = 5;
export const MIDDLE_MCP = 9;
export const PINKY_MCP = 17;

/** MediaPipe hand skeleton (pairs of landmark indices). */
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export const DATASET_FORMAT = 'signbridge-dataset';
export const RAW_FORMAT = 'signbridge-raw-frames';
/** 2 = samples store palm-unit landmark coordinates (see SEQUENCE_FORMAT_VERSION). */
export const DATASET_FORMAT_VERSION = 2;

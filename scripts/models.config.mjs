// Official MediaPipe model assets used by SignBridge.
// Source: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker
//         https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer
// The model files are NOT committed to git. Review Google's model cards for their terms
// before redistributing them (see THIRD_PARTY_NOTICES.md).
export const MODELS = [
  {
    id: 'hand_landmarker',
    required: true,
    file: 'hand_landmarker.task',
    // sha256 observed on 2026-10-30 for float16/1 (verify-models fails if it changes)
    sha256: 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1',
    url: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    description: 'MediaPipe Hand Landmarker (palm detector + 21-point hand landmark model), float16 v1',
  },
  {
    id: 'gesture_recognizer',
    required: false,
    file: 'gesture_recognizer.task',
    sha256: '97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482',
    url: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
    description: 'MediaPipe Gesture Recognizer (generic 7-gesture demo, NOT ISL), float16 v1',
  },
];

export const MODEL_DIR = 'public/models';
export const WASM_SRC = 'node_modules/@mediapipe/tasks-vision/wasm';
export const WASM_DEST = 'public/mediapipe/wasm';
export const MANIFEST = 'public/models/manifest.json';

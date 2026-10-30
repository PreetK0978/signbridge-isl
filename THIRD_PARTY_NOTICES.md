# Third-Party Notices

SignBridge's own source code is licensed under the Apache License 2.0 (see [LICENSE](LICENSE)).
It depends on the third-party software and assets listed below, which remain the property of
their respective owners and are distributed under their own licences.

## Runtime dependencies (npm)

| Package | Licence | Owner |
| --- | --- | --- |
| `@mediapipe/tasks-vision` (incl. WASM runtime in `node_modules/@mediapipe/tasks-vision/wasm`) | Apache-2.0 | Google LLC |
| `@tensorflow/tfjs` | Apache-2.0 | Google LLC / TensorFlow.js authors |
| `react`, `react-dom` | MIT | Meta Platforms, Inc. and affiliates |
| `react-router-dom` | MIT | Remix Software Inc. |
| `lucide-react` | ISC | Lucide contributors |
| `idb` | ISC | Jake Archibald |

## Development dependencies

Vite (MIT), TypeScript (Apache-2.0), Tailwind CSS (MIT), PostCSS (MIT), Autoprefixer (MIT),
Vitest (MIT), Testing Library (MIT), jsdom (MIT), fake-indexeddb (Apache-2.0),
ESLint (MIT), typescript-eslint (MIT). Run `npx license-checker --summary` for the full tree.

## Model assets (not committed to this repository)

`npm run models:download` downloads these files from Google's official MediaPipe storage
into `public/models/` (git-ignored):

| File | Source | SHA-256 (observed 2026-10-30) |
| --- | --- | --- |
| `hand_landmarker.task` | `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task` | `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1` |
| `gesture_recognizer.task` (optional demo) | `https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task` | `97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482` |

**Licence status — please read.** These model files are published by Google LLC for use with
MediaPipe Solutions. The Apache-2.0 licence of the `@mediapipe/tasks-vision` npm package does
**not** automatically cover these separately-hosted model files. The bundles contain only
`.tflite` files and no embedded licence. Their terms are described in Google's model cards linked
from the [Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
and [Gesture Recognizer](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer)
documentation pages. The SignBridge maintainers had **not** confirmed the model-card licence
terms when this file was written. For that reason:

- the files are **not** committed or redistributed by this repository;
- each user downloads them directly from Google via the setup script;
- if you plan to redistribute them (e.g. in a hosted deployment or an offline bundle), first
  read the model cards and confirm the terms yourself.

## Indian Sign Language references and datasets

SignBridge ships **no sign-language video, images or pre-recorded landmark data.**

| Resource | Use in SignBridge | Licence / terms |
| --- | --- | --- |
| [ISLRTC ISL Dictionary](https://divyangjan.depwd.gov.in/islrtc/) — Indian Sign Language Research and Training Centre, Govt. of India | Linked as the recommended reference for learning signs. Nothing copied. | © ISLRTC. Content is not redistributed; check ISLRTC terms before reuse. |
| [INCLUDE](https://zenodo.org/records/4010759) — Sridhar, Ganesan, Kumar, Khapra (AI4Bharat / IIT Madras), ACM MM 2020 | Documented as an optional source users may download themselves. Not bundled. | CC BY 4.0: attribution required; cite DOI 10.1145/3394171.3413528. |
| [ISLTranslate](https://github.com/Exploration-Lab/ISLTranslate) | Documented only (sentence-level, not used by the classifier). | CC BY-NC 4.0 (non-commercial). |

If you train a model on any third-party dataset, the resulting model and exported landmark
files are derivative works. Follow that dataset's licence, including attribution and any
non-commercial or share-alike conditions.

# Model assets

| Asset | Purpose | Location after setup |
| --- | --- | --- |
| `hand_landmarker.task` | MediaPipe Hand Landmarker (palm detector + 21-landmark model, float16 v1). **Required.** | `public/models/` |
| `gesture_recognizer.task` | MediaPipe Gesture Recognizer for the generic demo. Optional. | `public/models/` |
| MediaPipe WASM runtime | Copied from `node_modules/@mediapipe/tasks-vision/wasm` | `public/mediapipe/wasm/` |
| SignBridge LSTM | Trained by each user in the browser | Browser IndexedDB (`signbridge-isl-classifier`) |

## Reproducible download

```bash
npm run models:download        # add --force to re-download, --skip-gesture to skip the demo model
npm run models:verify          # checks presence, zip signature and pinned SHA-256
```

URLs and expected SHA-256 values are pinned in `scripts/models.config.mjs`. If Google
publishes a new version at the same URL, verification fails. Review the change and update the hash.

### Manual download

If the script cannot reach Google Cloud Storage, download the URLs listed in
`scripts/models.config.mjs` with a browser, place them in `public/models/`, and copy
`node_modules/@mediapipe/tasks-vision/wasm/*` to `public/mediapipe/wasm/`.

## Licensing

See [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md#model-assets-not-committed-to-this-repository).
In short: model files are not committed. Read Google's model cards before redistributing them.

## Hosting

`npm run build` copies `public/` into `dist/`, so a static deployment includes the model files
you downloaded. Confirm the model terms first (see above). Any static host works. Serve over
HTTPS so the camera is available.

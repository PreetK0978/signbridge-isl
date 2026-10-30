#!/usr/bin/env python3
"""
Offline alternative to the in-browser "Import video folder" feature.

Converts locally supplied, labelled videos into a SignBridge raw-frames JSON file:

    dataset/
      HELLO/sample_001.mp4
      THANK_YOU/sample_001.mp4

    python scripts/extract_video_landmarks.py dataset --out raw-frames.json

Then import raw-frames.json in the Training Studio ("Import JSON"). The app applies the
same normalisation/resampling it uses for webcam recordings, so features stay consistent.

Requirements: pip install mediapipe opencv-python
Model: public/models/hand_landmarker.task (npm run models:download)

Only process videos you have the right to use. Nothing is uploaded anywhere.
NOTE: this script was not executed in the original development environment (no Python
available there); the in-browser importer is the tested path. Please report issues.
"""
import argparse
import json
import sys
from pathlib import Path

VIDEO_EXT = {".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"}


def extract(video: Path, model: Path, max_seconds: float):
    import cv2
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    options = vision.HandLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(model)),
        running_mode=vision.RunningMode.VIDEO,
        num_hands=2,
    )
    frames = []
    # A fresh landmarker per video: VIDEO mode requires increasing timestamps.
    with vision.HandLandmarker.create_from_options(options) as landmarker:
        cap = cv2.VideoCapture(str(video))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        index = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            timestamp = int(index * 1000 / fps)
            if timestamp > max_seconds * 1000:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = landmarker.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), timestamp)
            hands = []
            for k, lms in enumerate(result.hand_landmarks):
                category = result.handedness[k][0] if k < len(result.handedness) and result.handedness[k] else None
                hands.append(
                    {
                        "landmarks": [{"x": p.x, "y": p.y, "z": p.z} for p in lms],
                        "handedness": "Left" if category and category.category_name == "Left" else "Right",
                        "score": float(category.score) if category else 0.0,
                    }
                )
            frames.append({"timestamp": timestamp, "hands": hands})
            index += 1
        cap.release()
    return frames


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dataset", type=Path, help="folder containing one sub-folder per label")
    parser.add_argument("--out", type=Path, default=Path("raw-frames.json"))
    parser.add_argument("--model", type=Path, default=Path("public/models/hand_landmarker.task"))
    parser.add_argument("--max-seconds", type=float, default=6.0)
    args = parser.parse_args()

    if not args.model.exists():
        print(f"Model not found: {args.model}. Run `npm run models:download` first.", file=sys.stderr)
        return 1

    items = []
    for label_dir in sorted(p for p in args.dataset.iterdir() if p.is_dir()):
        for video in sorted(label_dir.iterdir()):
            if video.suffix.lower() not in VIDEO_EXT:
                continue
            print(f"{label_dir.name}/{video.name}", file=sys.stderr)
            items.append({"label": label_dir.name, "source": f"{label_dir.name}/{video.name}", "frames": extract(video, args.model, args.max_seconds)})

    args.out.write_text(json.dumps({"format": "signbridge-raw-frames", "formatVersion": 1, "items": items}))
    print(f"Wrote {len(items)} items to {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())

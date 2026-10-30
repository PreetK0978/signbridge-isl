# Security Policy

## Supported versions

Only the latest `main` branch is supported while SignBridge is a pre-1.0 research prototype.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private
vulnerability reporting (*Security → Report a vulnerability* on the repository). Include:

- a description of the issue and its impact;
- steps to reproduce, or a proof of concept;
- affected browser/OS if relevant.

We aim to acknowledge reports within 7 days.

## Security & privacy model

- All inference runs in the browser. SignBridge has no backend and needs no API keys.
- Webcam frames are processed in memory and never stored or transmitted.
- Labels, landmark samples, history and trained models live in the user's IndexedDB.
- Imported JSON is validated (format, shapes, finite numbers) before it is stored.
- Model files are downloaded from Google's official MediaPipe storage and checked against pinned SHA-256 hashes (`npm run models:verify`).

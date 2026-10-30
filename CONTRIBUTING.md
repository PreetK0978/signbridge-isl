# Contributing to SignBridge

Thank you for helping make SignBridge better! We especially value input from **Deaf ISL users
and interpreters**. Please tell us when something is wrong, inaccurate or disrespectful.

## Ways to contribute

- Report bugs and usability or accessibility issues (include browser, OS and steps).
- Improve recognition: preprocessing, models, evaluation methodology.
- Add tests, documentation and translations.
- Share **properly licensed, consented** landmark datasets (never raw video of people without consent).

## Ground rules for sign-language content

- **Never invent signs** or label generic gestures as ISL vocabulary.
- Cite an authoritative reference (e.g. the ISLRTC dictionary) for any sign you add.
- Do not commit videos, webcam recordings, personal data or unlicensed datasets (`.gitignore` blocks common video formats).
- Do not report accuracy numbers you have not measured on held-out sessions.

## Development setup

```bash
npm install
npm run models:download
npm run dev
```

Before opening a pull request:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

CI runs the same commands. New logic in `src/ai` or `src/services` should come with unit tests in `tests/`.

## Pull requests

1. Fork and create a feature branch.
2. Keep changes focused and match the surrounding code style (TypeScript strict, functional React components).
3. Describe what changed and how you tested it (include real camera testing notes if relevant).
4. By contributing you agree that your contribution is licensed under the Apache License 2.0.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

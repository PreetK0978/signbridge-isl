# ISL datasets and references

SignBridge bundles **no** sign-language data. This page records what was investigated and
how to use external data responsibly. Licences change, so always re-check the source.

## Investigated resources

| Resource | What it is | Size | Licence | Redistribution | Fit for SignBridge |
| --- | --- | --- | --- | --- | --- |
| [ISLRTC ISL Dictionary](https://divyangjan.depwd.gov.in/islrtc/) | Official Govt. of India dictionary of ISL signs (videos per word) | Online only | © ISLRTC; no open licence identified | No: link only | **Reference** for learning signs before recording |
| [INCLUDE](https://zenodo.org/records/4010759) (AI4Bharat / IIT Madras) | Isolated ISL words recorded by Deaf students; 263 signs, 15 categories, 4,292 videos (paper: 4,287), official train/test split; INCLUDE-50 subset | ~56.8 GB (multi-zip) | CC BY 4.0 | Yes, with attribution | **Good fit** for isolated-word training via the video importer (use a small subset) |
| [ISLTranslate](https://github.com/Exploration-Lab/ISLTranslate) | ~30k continuous ISL ↔ English sentence pairs | Large | CC BY-NC 4.0 | Non-commercial, attribution | Not used (sentence-level) |
| data.gov.in ISL listings / Hugging Face mirrors | Various re-uploads, including a re-encoded mirror of ~75 GB | Very large | Must match the original source's licence | Check each mirror | Do **not** bulk download. Prefer the original source. |

The ISLRTC, data.gov.in and Hugging Face entries were reviewed only from public listings; no
licence was confirmed for them. INCLUDE's licence and size were checked on its Zenodo page
on 2026-10-30.

## Checklist before using any dataset

- [ ] Licence identified (and recorded here) and compatible with your use (commercial? share-alike?)
- [ ] Attribution requirements noted (authors, paper DOI)
- [ ] Size checked: never download tens of GB to evaluate an idea
- [ ] Annotation quality spot-checked (watch samples, confirm labels match the sign)
- [ ] Vocabulary labels mapped to English + Hindi without inventing signs
- [ ] Consent / signer privacy considered (faces are visible in sign videos)
- [ ] Derivative data (exported landmark JSON, trained models) labelled with the source licence

## Small-subset workflow (INCLUDE example)

1. Download **one** category archive from the Zenodo record, not the whole dataset.
2. Arrange a few signs as `dataset/<LABEL>/<video>.mp4`. Keep ≥ 20 videos per label if possible.
3. In **Training Studio → Import video folder**, select `dataset/`. Landmarks are extracted
   locally. Each video is its own session, so validation never shares a video with training.
4. Add the Hindi translation for each imported label in the Sign Library, and set the reference link.
5. Train. When sharing results or exported JSON, credit: *Sridhar, A., Ganesan, R. G., Kumar, P.,
   Khapra, M. "INCLUDE: A Large Scale Dataset for Indian Sign Language Recognition", ACM MM 2020,
   doi:10.1145/3394171.3413528*, and keep the CC BY 4.0 notice.

`dataset/`, `*.mp4` and other video files are git-ignored so private recordings are never committed.

import { AlertTriangle, BookOpen, BrainCircuit, Database, FileText, Heart, Scale } from 'lucide-react';
import { FEATURE_SIZE, SEQUENCE_LENGTH } from '../ai/constants';
import { Alert, Card, CardTitle, PageHeader } from '../components/Common/ui';
import { ISLRTC_DICTIONARY_URL } from '../services/vocabularyService';

const RESOURCES = [
  {
    name: 'ISLRTC Indian Sign Language Dictionary',
    url: ISLRTC_DICTIONARY_URL,
    notes: 'Official Government of India dictionary (Indian Sign Language Research and Training Centre). Use it to learn signs. SignBridge links to it and does not copy or redistribute its videos.',
  },
  {
    name: 'INCLUDE (AI4Bharat / IIT Madras) — Zenodo',
    url: 'https://zenodo.org/records/4010759',
    notes: 'Isolated ISL word videos: 263 signs, 15 categories, ~4,292 videos, ~57 GB. Licence CC BY 4.0 (attribution required; cite Sridhar et al., ACM MM 2020). Not downloaded automatically — see docs/DATASETS.md for a small-subset workflow.',
  },
  {
    name: 'ISLTranslate (Exploration Lab)',
    url: 'https://github.com/Exploration-Lab/ISLTranslate',
    notes: 'Continuous ISL ↔ English sentence pairs. CC BY-NC 4.0 (non-commercial). Sentence-level, so not directly usable for this isolated-word classifier.',
  },
];

export default function About() {
  return (
    <div>
      <PageHeader eyebrow="Project" title="About SignBridge" subtitle="An open-source, privacy-first research prototype for Indian Sign Language recognition and gesture-to-speech." />

      <Alert tone="amber" icon={AlertTriangle} title="Limitations — please read">
        SignBridge recognises only the signs you train, from a short isolated-sign window. It does not understand ISL grammar, facial expressions, non-manual markers or continuous signing, and it is not a substitute for a qualified ISL interpreter. Accuracy depends entirely on your data; the softmax classifier can still be confidently wrong on signs it has never seen — train a Background class and keep the confidence threshold high.
      </Alert>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle icon={Heart}>Problem & approach</CardTitle>
          <div className="space-y-3 text-sm text-slate-300">
            <p>India has millions of Deaf and hard-of-hearing people, and ISL interpreters are scarce. Everyday interactions — at a counter, a clinic or in class — often lack a shared language.</p>
            <p>SignBridge explores how far commodity laptops can go: hand landmarks from MediaPipe, a small LSTM trained in the browser on the user's own recordings, and the browser's built-in speech synthesis. Everything runs locally — no paid APIs, no cloud inference, no uploaded video.</p>
          </div>
        </Card>

        <Card>
          <CardTitle icon={BrainCircuit}>Model</CardTitle>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Input: {SEQUENCE_LENGTH} frames × {FEATURE_SIZE} features (2 hands × 21 landmarks × xyz).</li>
            <li>• Stored: 21 landmarks per hand in palm units relative to the window start. Model features per hand: finger shape in a hand-local frame (independent of arm angle), palm orientation, wrist position and velocity, fingertip velocities; plus the vector between the hands. All standardised on the training set.</li>
            <li>• Hands keep their slot by tracking position across frames (MediaPipe Left/Right labels can flip mid-gesture); missing hands are zero-padded; short gaps interpolated; sequences with &lt;60% hand frames rejected.</li>
            <li>• Conv1D(64, k=3) → LSTM(64) → Dropout(0.3) → Dense(64, ReLU) → Dropout(0.3) → Dense(N, softmax), Adam, categorical cross-entropy; training augmentation with rotation, scale, time-warp, jitter and dropped frames.</li>
            <li>• Unknown motions are rejected by confidence, margin, and an open-set distance check in the network's embedding space.</li>
            <li>• Validation holds out whole recording sessions; duplicates removed before splitting.</li>
            <li>• Live: confidence + margin thresholds, majority-vote smoothing and a per-sign cooldown.</li>
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle icon={Database}>ISL resources investigated</CardTitle>
          <div className="space-y-3">
            {RESOURCES.map((r) => (
              <div key={r.name} className="rounded-xl border border-white/5 bg-navy-950/50 p-3">
                <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-cyan-300 hover:underline">{r.name}</a>
                <p className="mt-1 text-sm text-slate-400">{r.notes}</p>
              </div>
            ))}
            <p className="text-xs text-slate-500">No external dataset is bundled. Licences change — always re-check the source before downloading or redistributing data.</p>
          </div>
        </Card>

        <Card>
          <CardTitle icon={Scale}>Licences</CardTitle>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• SignBridge source code: Apache License 2.0.</li>
            <li>• @mediapipe/tasks-vision: Apache-2.0 (Google).</li>
            <li>• MediaPipe model files (hand_landmarker.task, gesture_recognizer.task) are downloaded from Google's storage by a setup script and not committed. Check Google's model cards for their terms before redistributing.</li>
            <li>• TensorFlow.js: Apache-2.0. React, Vite, Tailwind CSS, Lucide: MIT/ISC.</li>
            <li>• See THIRD_PARTY_NOTICES.md for the full list.</li>
          </ul>
        </Card>

        <Card>
          <CardTitle icon={FileText}>Credits</CardTitle>
          <p className="text-sm text-slate-300">
            Built with Google MediaPipe and TensorFlow.js. Sign references: ISLRTC. We encourage involving Deaf ISL users in data collection and evaluation — signs recorded by non-signers may be inaccurate.
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-400">
            <BookOpen className="h-4 w-4 text-cyan-300" /> Contributions welcome — see CONTRIBUTING.md in the repository.
          </p>
        </Card>
      </div>
    </div>
  );
}

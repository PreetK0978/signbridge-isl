import { Link } from 'react-router-dom';
import { ArrowRight, BrainCircuit, Code2, Hand, Lock, MessageSquareText, Mic, Play, ScanLine, ShieldCheck, Sparkles, Volume2 } from 'lucide-react';
import { Logo } from '../components/Common/Logo';
import { Button } from '../components/Common/ui';

const STEPS = [
  { icon: ScanLine, title: 'Track', text: 'MediaPipe Hand Landmarker finds up to two hands and 21 3-D landmarks per hand, on-device, every frame.' },
  { icon: Hand, title: 'Normalise', text: 'Landmarks become wrist-relative, palm-scaled features with wrist trajectories — 30 frames × 126 values.' },
  { icon: BrainCircuit, title: 'Classify', text: 'A TensorFlow.js LSTM you train in the browser classifies the motion. Low-confidence input is rejected as UNKNOWN.' },
  { icon: Volume2, title: 'Speak', text: 'Stable predictions become words and sentences, spoken aloud in Indian English or Hindi with the Web Speech API.' },
];

const TECH = ['React + TypeScript', 'Vite', 'Tailwind CSS', 'MediaPipe Tasks Vision', 'TensorFlow.js LSTM', 'Web Speech API', 'IndexedDB', 'Vitest'];

export default function Landing() {
  return (
    <div className="min-h-screen overflow-hidden bg-navy-950 bg-grid text-slate-200">
      <div className="pointer-events-none absolute left-1/2 top-[-10rem] h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-electric-500/20 blur-[120px]" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/about" className="hidden rounded-lg px-3 py-2 text-slate-300 hover:text-white sm:block">About</Link>
          <Link to="/dashboard"><Button size="sm" variant="secondary">Open app</Button></Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl px-5 pb-20 pt-10 text-center md:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
          <Sparkles className="h-3.5 w-3.5" /> Open-source · Runs 100% in your browser · Indian Sign Language focus
        </span>
        <h1 className="mx-auto mt-6 max-w-4xl font-display text-4xl font-semibold leading-tight text-white md:text-6xl">
          Your Hands <span className="bg-gradient-to-r from-electric-400 via-cyan-400 to-cyan-300 bg-clip-text text-transparent">Have a Voice.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-slate-400 md:text-lg">
          SignBridge turns signs performed in front of a webcam into text and speech. Train your own Indian Sign Language vocabulary, recognise it in real time, and build spoken sentences — with no cloud, no API keys and no video ever leaving your device.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/training"><Button size="lg" variant="primary" icon={ArrowRight}>Get Started</Button></Link>
          <Link to="/translate"><Button size="lg" variant="secondary" icon={Play}>Live Demo</Button></Link>
        </div>
        <p className="mx-auto mt-6 max-w-xl text-xs text-slate-500">
          Research prototype with a limited, user-trained vocabulary — not a complete ISL translator.
        </p>

        <div className="relative mx-auto mt-16 max-w-4xl rounded-3xl border border-white/10 bg-gradient-to-b from-navy-800/80 to-navy-900/80 p-2 shadow-glow">
          <div className="grid gap-2 rounded-2xl bg-navy-950/80 p-4 md:grid-cols-[1.4fr_1fr]">
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br from-navy-900 to-navy-800">
              <svg viewBox="0 0 200 140" className="h-3/4 opacity-90" aria-hidden>
                {[[100, 120, 70, 90], [70, 90, 55, 60], [55, 60, 50, 38], [100, 120, 88, 70], [88, 70, 85, 40], [85, 40, 84, 20], [100, 120, 105, 68], [105, 68, 108, 36], [108, 36, 110, 14], [100, 120, 120, 72], [120, 72, 128, 46], [128, 46, 132, 28], [100, 120, 135, 82], [135, 82, 148, 64], [148, 64, 156, 50]].map(([x1, y1, x2, y2], i) => (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3ee6f5" strokeWidth="2.5" strokeLinecap="round" />
                ))}
                {[[100, 120], [70, 90], [55, 60], [50, 38], [88, 70], [85, 40], [84, 20], [105, 68], [108, 36], [110, 14], [120, 72], [128, 46], [132, 28], [135, 82], [148, 64], [156, 50]].map(([cx, cy], i) => (
                  <circle key={i} cx={cx} cy={cy} r="3" fill="#fff" />
                ))}
              </svg>
              <span className="absolute left-3 top-3 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">● 1 hand · 30 FPS</span>
            </div>
            <div className="flex flex-col justify-center rounded-xl border border-white/5 bg-navy-900 p-5 text-left">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Illustration</p>
              <p className="mt-2 font-display text-3xl text-white">Your sign</p>
              <p className="text-lg text-cyan-200">आपका संकेत</p>
              <div className="mt-4 h-2 rounded-full bg-navy-700"><div className="h-2 w-[86%] rounded-full bg-gradient-to-r from-electric-500 to-cyan-400" /></div>
              <p className="mt-2 text-xs text-slate-500">Stable prediction above your confidence threshold → spoken aloud</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center font-display text-3xl font-semibold text-white">How it works</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="relative rounded-2xl border border-white/[0.07] bg-navy-900/80 p-5">
              <span className="absolute right-4 top-4 font-mono text-xs text-slate-600">0{i + 1}</span>
              <div className="mb-4 inline-flex rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2.5"><Icon className="h-5 w-5 text-cyan-300" /></div>
              <h3 className="font-display text-lg text-white">{title}</h3>
              <p className="mt-2 text-sm text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-6 px-5 py-16 md:grid-cols-3">
        {[
          { icon: Lock, title: 'Private by design', text: 'Webcam frames are processed in memory. Only landmark numbers you explicitly record are stored — in your own browser (IndexedDB).' },
          { icon: ShieldCheck, title: 'Honest AI', text: 'No pre-baked accuracy claims and no random guesses. Metrics come from held-out recording sessions; uncertain input is shown as UNKNOWN SIGN.' },
          { icon: MessageSquareText, title: 'From signs to sentences', text: 'Temporal smoothing, cooldowns and duplicate filtering turn a stream of predictions into clean sentences you can edit, copy and speak.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-navy-800/80 to-navy-900/80 p-6">
            <Icon className="h-6 w-6 text-cyan-300" />
            <h3 className="mt-4 font-display text-lg text-white">{title}</h3>
            <p className="mt-2 text-sm text-slate-400">{text}</p>
          </div>
        ))}
      </section>

      <section className="relative mx-auto max-w-6xl px-5 py-16 text-center">
        <h2 className="font-display text-3xl font-semibold text-white">Built on open technology</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {TECH.map((t) => (
            <span key={t} className="rounded-full border border-white/10 bg-navy-900 px-4 py-2 text-sm text-slate-300">{t}</span>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-5 pb-24">
        <div className="flex flex-col items-center justify-between gap-6 rounded-3xl border border-cyan-400/20 bg-gradient-to-r from-electric-600/20 to-cyan-500/10 p-8 md:flex-row">
          <div>
            <h2 className="flex items-center gap-2 font-display text-2xl text-white"><Code2 className="h-6 w-6 text-cyan-300" /> Open source under Apache-2.0</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Contributions from Deaf signers, ISL interpreters, researchers and developers are welcome — vocabulary, datasets with clear licences, accessibility reviews and code.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/about"><Button icon={Mic}>Project details</Button></Link>
            <Link to="/dashboard"><Button variant="primary" icon={ArrowRight}>Open the app</Button></Link>
          </div>
        </div>
        <p className="mt-10 text-center text-xs text-slate-600">SignBridge · Apache-2.0 · MediaPipe and TensorFlow.js are © their respective authors.</p>
      </section>
    </div>
  );
}

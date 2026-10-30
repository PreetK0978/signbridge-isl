import { useState } from 'react';
import { Camera, Cpu, Database, Eye, RotateCcw, ScanLine, Trash2, Volume2 } from 'lucide-react';
import { LstmClassifier } from '../ai/lstmClassifier';
import { Alert, Button, Card, CardTitle, inputClass, Modal, PageHeader, Slider, Toggle, Field } from '../components/Common/ui';
import { SpeechControls } from '../components/Speech/SpeechControls';
import { useAppData, useSettings } from '../hooks/useAppContext';
import { clearAllData } from '../services/databaseService';
import { formatPercent } from '../utils/format';

export default function Settings() {
  const { settings, update, reset } = useSettings();
  const { refresh } = useAppData();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const wipe = async () => {
    await clearAllData();
    await LstmClassifier.remove();
    setConfirmWipe(false);
    setDone('All local SignBridge data was deleted. Reloading…');
    await refresh();
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div>
      <PageHeader eyebrow="Preferences" title="Settings" subtitle="All settings are stored in this browser." actions={<Button icon={RotateCcw} onClick={reset}>Reset to defaults</Button>} />
      {done && <div className="mb-4"><Alert tone="green">{done}</Alert></div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle icon={ScanLine}>Recognition</CardTitle>
          <div className="space-y-4">
            <Slider label="Confidence threshold" value={settings.confidenceThreshold} min={0.4} max={0.99} step={0.01} onChange={(v) => update({ confidenceThreshold: v })} format={(v) => formatPercent(v, 0)} />
            <Slider label="Unknown-motion strictness (lower = rejects more)" value={settings.maxNovelty} min={0.6} max={2} step={0.05} onChange={(v) => update({ maxNovelty: v })} format={(v) => `${v.toFixed(2)}×`} />
            <Slider label="Minimum margin over 2nd-best class" value={settings.minMargin} min={0} max={0.8} step={0.05} onChange={(v) => update({ minMargin: v })} format={(v) => formatPercent(v, 0)} />
            <Slider label="Smoothing window (predictions)" value={settings.smoothingWindow} min={2} max={15} step={1} onChange={(v) => update({ smoothingWindow: v, stableFrames: Math.min(settings.stableFrames, v) })} />
            <Slider label="Stable predictions required" value={settings.stableFrames} min={1} max={settings.smoothingWindow} step={1} onChange={(v) => update({ stableFrames: v })} />
            <Slider label="Repeat cooldown" value={settings.cooldownMs} min={300} max={5000} step={100} onChange={(v) => update({ cooldownMs: v })} format={(v) => `${(v / 1000).toFixed(1)} s`} />
            <Slider label="Prediction interval" value={settings.predictionIntervalMs} min={50} max={500} step={10} onChange={(v) => update({ predictionIntervalMs: v })} format={(v) => `${v} ms`} />
            <Toggle label="Manual word confirmation" hint="Recognised words wait for you to press “Confirm & add”." checked={settings.manualConfirmation} onChange={(v) => update({ manualConfirmation: v })} />
            <Toggle label="Speak recognised words automatically" checked={settings.autoSpeak} onChange={(v) => update({ autoSpeak: v })} />
          </div>
        </Card>

        <Card>
          <CardTitle icon={Camera}>Camera & recording</CardTitle>
          <div className="space-y-4">
            <Slider label="Sign window / recording length" value={settings.recordingDurationMs} min={800} max={3000} step={100} onChange={(v) => update({ recordingDurationMs: v })} format={(v) => `${(v / 1000).toFixed(1)} s`} />
            <Slider label="Countdown before recording" value={settings.countdownSeconds} min={0} max={5} step={1} onChange={(v) => update({ countdownSeconds: v })} format={(v) => `${v} s`} />
            <Slider label="Target processing FPS" value={settings.targetFps} min={5} max={60} step={1} onChange={(v) => update({ targetFps: v })} />
            <Toggle label="Mirror video (selfie view)" checked={settings.mirrorVideo} onChange={(v) => update({ mirrorVideo: v })} />
            <Toggle label="Show hand bounding boxes" checked={settings.showBoundingBoxes} onChange={(v) => update({ showBoundingBoxes: v })} />
            <p className="text-xs text-slate-500">Keep the recording length the same between training and translation — the live window uses this value too.</p>
          </div>
        </Card>

        <Card>
          <CardTitle icon={Cpu}>Inference engine</CardTitle>
          <div className="space-y-4">
            <Field label="Hand tracking runs on" hint="Web Worker keeps inference off the UI thread (CPU delegate). Falls back to the main thread automatically if the worker cannot start.">
              <select className={inputClass} value={settings.engine} onChange={(e) => update({ engine: e.target.value as 'main' | 'worker' })}>
                <option value="main">Main thread (GPU delegate, fastest on most laptops)</option>
                <option value="worker">Web Worker (experimental)</option>
              </select>
            </Field>
            <Field label="MediaPipe delegate (main thread)">
              <select className={inputClass} value={settings.delegate} onChange={(e) => update({ delegate: e.target.value as 'GPU' | 'CPU' })}>
                <option value="GPU">GPU (WebGL) — falls back to CPU</option>
                <option value="CPU">CPU (WASM)</option>
              </select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle icon={Volume2}>Speech</CardTitle>
          <SpeechControls />
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle icon={Database}>Privacy & data</CardTitle>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-1 text-sm text-slate-400">
              <p className="flex items-center gap-2"><Eye className="h-4 w-4 text-cyan-300" /> Webcam frames are never stored or uploaded. Only landmark coordinates you explicitly record are saved, in IndexedDB on this device.</p>
              <p>Use Export JSON in the Training Studio to back up your dataset before clearing data.</p>
            </div>
            <Button variant="danger" icon={Trash2} onClick={() => setConfirmWipe(true)}>Delete all local data</Button>
          </div>
        </Card>
      </div>

      <Modal
        open={confirmWipe}
        title="Delete all SignBridge data?"
        onClose={() => setConfirmWipe(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmWipe(false)}>Cancel</Button>
            <Button variant="danger" icon={Trash2} onClick={wipe}>Delete everything</Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">This permanently removes all labels, samples, the trained model, history and activity from this browser. It cannot be undone.</p>
      </Modal>
    </div>
  );
}

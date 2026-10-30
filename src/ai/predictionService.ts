import { buildSequence } from './sequenceProcessor';
import type { LstmClassifier, Prediction } from './lstmClassifier';
import type { FrameData, SignLabel } from '../types';

export interface ThresholdOptions {
  /** Minimum softmax probability to accept a prediction. */
  confidenceThreshold: number;
  /** Minimum gap between best and second-best class. */
  minMargin: number;
}

export type FrameDecision =
  | { kind: 'no-hands' }
  | { kind: 'insufficient' }
  | { kind: 'unknown'; confidence: number; bestLabelId: string }
  | { kind: 'background'; confidence: number }
  | { kind: 'sign'; labelId: string; confidence: number };

/**
 * Apply confidence + margin thresholds to one prediction. Anything that does not clear
 * both thresholds is "unknown" — the system never guesses.
 */
export function decide(
  prediction: Prediction,
  labelIds: string[],
  options: ThresholdOptions,
  backgroundIds: ReadonlySet<string> = new Set(),
): FrameDecision {
  const labelId = labelIds[prediction.index];
  if (prediction.confidence < options.confidenceThreshold || prediction.margin < options.minMargin) {
    return { kind: 'unknown', confidence: prediction.confidence, bestLabelId: labelId };
  }
  if (backgroundIds.has(labelId)) return { kind: 'background', confidence: prediction.confidence };
  return { kind: 'sign', labelId, confidence: prediction.confidence };
}

export interface SmootherOptions {
  /** Number of recent decisions considered. */
  windowSize: number;
  /** How many of those must agree on the same sign. */
  stableCount: number;
  /** Do not emit the same sign again within this many ms unless the hands were lowered / another sign was emitted. */
  cooldownMs: number;
}

export type RecognitionStatus = 'idle' | 'no-hands' | 'detecting' | 'unknown' | 'recognized';

export interface SmoothedState {
  status: RecognitionStatus;
  labelId: string | null;
  confidence: number;
  /** True exactly once per recognised sign occurrence — use it to append words / speak. */
  emitted: boolean;
}

/**
 * Temporal smoothing over per-window decisions:
 *  - a sign is reported only when `stableCount` of the last `windowSize` decisions agree;
 *  - a reported sign is emitted once, then suppressed while it is held (cooldown);
 *  - lowering the hands or emitting another sign re-arms the same sign immediately.
 */
export class RecognitionSmoother {
  private history: FrameDecision[] = [];
  private lastEmitted: { labelId: string; at: number } | null = null;
  private rearmed = true;

  constructor(private options: SmootherOptions) {}

  setOptions(options: SmootherOptions): void {
    this.options = options;
  }

  reset(): void {
    this.history = [];
    this.lastEmitted = null;
    this.rearmed = true;
  }

  push(decision: FrameDecision, now: number): SmoothedState {
    this.history.push(decision);
    if (this.history.length > this.options.windowSize) this.history.shift();

    if (decision.kind === 'no-hands') {
      this.rearmed = true;
      return { status: 'no-hands', labelId: null, confidence: 0, emitted: false };
    }
    if (decision.kind === 'background') {
      this.rearmed = true;
      return { status: 'idle', labelId: null, confidence: decision.confidence, emitted: false };
    }

    const votes = new Map<string, { count: number; total: number }>();
    for (const d of this.history) {
      if (d.kind !== 'sign') continue;
      const v = votes.get(d.labelId) ?? { count: 0, total: 0 };
      v.count++;
      v.total += d.confidence;
      votes.set(d.labelId, v);
    }
    let best: { labelId: string; count: number; total: number } | null = null;
    for (const [labelId, v] of votes) if (!best || v.count > best.count) best = { labelId, ...v };

    // A full window with no vote for the last emitted sign means the signer moved on.
    const last = this.lastEmitted;
    if (
      last &&
      this.history.length >= this.options.windowSize &&
      !this.history.some((d) => d.kind === 'sign' && d.labelId === last.labelId)
    ) {
      this.rearmed = true;
    }

    if (best && best.count >= this.options.stableCount) {
      const confidence = best.total / best.count;
      const sameAsLast = last?.labelId === best.labelId;
      const emitted = !sameAsLast || (this.rearmed && now - last!.at >= this.options.cooldownMs);
      if (emitted) {
        this.lastEmitted = { labelId: best.labelId, at: now };
        this.rearmed = false;
        // Clear votes so the next emission needs fresh, stable evidence.
        this.history = [];
      }
      return { status: 'recognized', labelId: best.labelId, confidence, emitted };
    }

    if (decision.kind === 'unknown') {
      return { status: 'unknown', labelId: null, confidence: decision.confidence, emitted: false };
    }
    return {
      status: 'detecting',
      labelId: decision.kind === 'sign' ? decision.labelId : null,
      confidence: decision.kind === 'sign' ? decision.confidence : 0,
      emitted: false,
    };
  }
}

export interface PredictionOutput {
  decision: FrameDecision;
  state: SmoothedState;
  prediction: Prediction | null;
}

/** Glues sequence building, the classifier, thresholds and smoothing together for live use. */
export class PredictionService {
  private smoother: RecognitionSmoother;
  private backgroundIds: Set<string>;

  constructor(
    private classifier: LstmClassifier,
    labels: SignLabel[],
    private thresholds: ThresholdOptions,
    smoothing: SmootherOptions,
  ) {
    this.smoother = new RecognitionSmoother(smoothing);
    this.backgroundIds = new Set(labels.filter((l) => l.isBackground).map((l) => l.id));
  }

  get labelIds(): string[] {
    return this.classifier.labelIds;
  }

  configure(thresholds: ThresholdOptions, smoothing: SmootherOptions): void {
    this.thresholds = thresholds;
    this.smoother.setOptions(smoothing);
  }

  reset(): void {
    this.smoother.reset();
  }

  /** Classify a window of raw frames (typically the last ~1.5 s of camera frames). */
  process(window: FrameData[], now: number): PredictionOutput {
    const latest = window[window.length - 1];
    if (!latest || latest.hands.length === 0) {
      const decision: FrameDecision = { kind: 'no-hands' };
      return { decision, state: this.smoother.push(decision, now), prediction: null };
    }
    const seq = buildSequence(window);
    if (!seq.ok) {
      const decision: FrameDecision = { kind: 'insufficient' };
      return { decision, state: this.smoother.push(decision, now), prediction: null };
    }
    const prediction = this.classifier.predict(seq.frames);
    const decision = decide(prediction, this.classifier.labelIds, this.thresholds, this.backgroundIds);
    return { decision, state: this.smoother.push(decision, now), prediction };
  }
}

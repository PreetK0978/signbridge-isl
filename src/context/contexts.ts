import { createContext } from 'react';
import type { LstmClassifier } from '../ai/lstmClassifier';
import type { TrainResult } from '../ai/trainingService';
import type { AppSettings, ModelMeta, SignLabel } from '../types';
import type { SentenceState } from '../utils/sentence';

export interface SettingsContextValue {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
}

export type ModelStatus = 'none' | 'loading' | 'ready' | 'error';

export interface AppDataContextValue {
  labels: SignLabel[];
  sampleCounts: Map<string, number>;
  totalSamples: number;
  loading: boolean;
  refresh: () => Promise<void>;
  classifier: LstmClassifier | null;
  modelMeta: ModelMeta | null;
  modelStatus: ModelStatus;
  modelError: string | null;
  /** True when samples/labels changed since the model was trained. */
  modelStale: boolean;
  saveTrainedModel: (result: TrainResult, epochs: number) => Promise<void>;
  deleteModel: () => Promise<void>;
  labelById: (id: string) => SignLabel | undefined;
}

export interface SentenceContextValue {
  state: SentenceState;
  text: string;
  append: (word: string) => boolean;
  removeLast: () => void;
  clear: () => void;
  setText: (text: string) => void;
  saveToHistory: () => Promise<boolean>;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);
export const AppDataContext = createContext<AppDataContextValue | null>(null);
export const SentenceContext = createContext<SentenceContextValue | null>(null);

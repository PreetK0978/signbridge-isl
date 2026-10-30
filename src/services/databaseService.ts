import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DATASET_FORMAT, DATASET_FORMAT_VERSION, FEATURE_SIZE, HAND_SLOTS, RAW_FORMAT, SEQUENCE_LENGTH } from '../ai/constants';
import { buildSequence, isValidSequenceShape } from '../ai/sequenceProcessor';
import { createId } from '../utils/id';
import type { ActivityEntry, ActivityKind, FrameData, HistoryEntry, ModelMeta, SignLabel, TrainingSample } from '../types';

export const DB_NAME = 'signbridge';
const DB_VERSION = 1;

interface SignBridgeDB extends DBSchema {
  labels: { key: string; value: SignLabel };
  samples: { key: string; value: TrainingSample; indexes: { byLabel: string; bySession: string } };
  history: { key: string; value: HistoryEntry; indexes: { byDate: number } };
  activity: { key: string; value: ActivityEntry; indexes: { byDate: number } };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<SignBridgeDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<SignBridgeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SignBridgeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('labels', { keyPath: 'id' });
        const samples = db.createObjectStore('samples', { keyPath: 'id' });
        samples.createIndex('byLabel', 'labelId');
        samples.createIndex('bySession', 'sessionId');
        db.createObjectStore('history', { keyPath: 'id' }).createIndex('byDate', 'createdAt');
        db.createObjectStore('activity', { keyPath: 'id' }).createIndex('byDate', 'createdAt');
        db.createObjectStore('meta');
      },
    });
  }
  return dbPromise;
}

/** Close and forget the connection (used by tests and "reset all data"). */
export async function closeDb(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

// ---------- labels ----------
export async function getLabels(): Promise<SignLabel[]> {
  const all = await (await getDb()).getAll('labels');
  return all.sort((a, b) => a.english.localeCompare(b.english));
}
export async function putLabel(label: SignLabel): Promise<void> {
  await (await getDb()).put('labels', label);
}
/** Deletes the label and every sample recorded for it. */
export async function deleteLabel(id: string): Promise<number> {
  const db = await getDb();
  const tx = db.transaction(['labels', 'samples'], 'readwrite');
  const keys = await tx.objectStore('samples').index('byLabel').getAllKeys(id);
  await Promise.all([...keys.map((k) => tx.objectStore('samples').delete(k)), tx.objectStore('labels').delete(id)]);
  await tx.done;
  return keys.length;
}

// ---------- samples ----------
export async function getSamples(labelId?: string): Promise<TrainingSample[]> {
  const db = await getDb();
  return labelId ? db.getAllFromIndex('samples', 'byLabel', labelId) : db.getAll('samples');
}
export async function addSample(sample: TrainingSample): Promise<void> {
  if (!isValidSequenceShape(sample.frames, sample.validity)) throw new Error('Sample has an invalid shape.');
  await (await getDb()).put('samples', sample);
}
export async function deleteSample(id: string): Promise<void> {
  await (await getDb()).delete('samples', id);
}
export async function countSamplesByLabel(): Promise<Map<string, number>> {
  const db = await getDb();
  const counts = new Map<string, number>();
  let cursor = await db.transaction('samples').store.openCursor();
  while (cursor) {
    counts.set(cursor.value.labelId, (counts.get(cursor.value.labelId) ?? 0) + 1);
    cursor = await cursor.continue();
  }
  return counts;
}

// ---------- history & activity ----------
export async function addHistory(text: string): Promise<HistoryEntry> {
  const entry: HistoryEntry = { id: createId('h_'), text, createdAt: Date.now() };
  await (await getDb()).put('history', entry);
  return entry;
}
export async function getHistory(): Promise<HistoryEntry[]> {
  return (await (await getDb()).getAllFromIndex('history', 'byDate')).reverse();
}
export async function deleteHistory(id: string): Promise<void> {
  await (await getDb()).delete('history', id);
}
export async function clearHistory(): Promise<void> {
  await (await getDb()).clear('history');
}

export async function logActivity(kind: ActivityKind, message: string): Promise<void> {
  await (await getDb()).put('activity', { id: createId('a_'), kind, message, createdAt: Date.now() });
}
export async function getActivity(limit = 20): Promise<ActivityEntry[]> {
  return (await (await getDb()).getAllFromIndex('activity', 'byDate')).reverse().slice(0, limit);
}

// ---------- meta ----------
export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await getDb()).get('meta', key)) as T | undefined;
}
export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await getDb()).put('meta', value, key);
}
export async function deleteMeta(key: string): Promise<void> {
  await (await getDb()).delete('meta', key);
}

export const MODEL_META_KEY = 'modelMeta';
export const SESSION_COUNT_KEY = 'translationSessions';

export async function getModelMeta(): Promise<ModelMeta | undefined> {
  return getMeta<ModelMeta>(MODEL_META_KEY);
}

export async function incrementTranslationSessions(): Promise<number> {
  const n = ((await getMeta<number>(SESSION_COUNT_KEY)) ?? 0) + 1;
  await setMeta(SESSION_COUNT_KEY, n);
  return n;
}

export async function clearAllData(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['labels', 'samples', 'history', 'activity', 'meta'], 'readwrite');
  await Promise.all([
    tx.objectStore('labels').clear(),
    tx.objectStore('samples').clear(),
    tx.objectStore('history').clear(),
    tx.objectStore('activity').clear(),
    tx.objectStore('meta').clear(),
    tx.done,
  ]);
}

// ---------- import / export ----------
export interface DatasetFile {
  format: typeof DATASET_FORMAT;
  formatVersion: number;
  exportedAt: string;
  sequenceLength: number;
  featureSize: number;
  handSlots: number;
  labels: SignLabel[];
  samples: TrainingSample[];
}

/** Raw landmark frames, e.g. produced by scripts/extract_video_landmarks.py. */
export interface RawFramesFile {
  format: typeof RAW_FORMAT;
  formatVersion: number;
  items: Array<{ label: string; hindi?: string; category?: SignLabel['category']; source?: string; frames: FrameData[] }>;
}

export async function exportDataset(): Promise<DatasetFile> {
  return {
    format: DATASET_FORMAT,
    formatVersion: DATASET_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    sequenceLength: SEQUENCE_LENGTH,
    featureSize: FEATURE_SIZE,
    handSlots: HAND_SLOTS,
    labels: await getLabels(),
    samples: await getSamples(),
  };
}

export interface ImportReport {
  labelsAdded: number;
  labelsMatched: number;
  samplesAdded: number;
  samplesSkipped: number;
  errors: string[];
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Merge a dataset file into the local database. Labels are matched by id, then by
 * English name (case-insensitive); samples with an existing id or bad shape are skipped.
 * Accepts both processed datasets and raw landmark frame files.
 */
export async function importDataset(data: unknown): Promise<ImportReport> {
  const report: ImportReport = { labelsAdded: 0, labelsMatched: 0, samplesAdded: 0, samplesSkipped: 0, errors: [] };
  if (!data || typeof data !== 'object') throw new Error('Not a SignBridge dataset file.');
  const format = (data as { format?: string }).format;
  if (format === RAW_FORMAT) return importRawFrames(data as RawFramesFile, report);
  if (format !== DATASET_FORMAT) throw new Error(`Unsupported file format "${format ?? 'unknown'}".`);

  const file = data as DatasetFile;
  if (file.sequenceLength !== SEQUENCE_LENGTH || file.featureSize !== FEATURE_SIZE) {
    throw new Error(
      `Dataset shape [${file.sequenceLength}, ${file.featureSize}] does not match this app [${SEQUENCE_LENGTH}, ${FEATURE_SIZE}].`,
    );
  }
  if (!Array.isArray(file.labels) || !Array.isArray(file.samples)) throw new Error('Dataset is missing labels or samples.');

  const existing = await getLabels();
  const byId = new Map(existing.map((l) => [l.id, l]));
  const byName = new Map(existing.map((l) => [norm(l.english), l]));
  const idMap = new Map<string, string>();

  for (const label of file.labels) {
    if (!label?.id || typeof label.english !== 'string' || !label.english.trim()) {
      report.errors.push('Skipped a label without an id or English name.');
      continue;
    }
    const match = byId.get(label.id) ?? byName.get(norm(label.english));
    if (match) {
      idMap.set(label.id, match.id);
      report.labelsMatched++;
    } else {
      const now = Date.now();
      const created: SignLabel = {
        id: label.id,
        english: label.english.trim(),
        hindi: label.hindi ?? '',
        category: label.category ?? 'other',
        referenceUrl: label.referenceUrl,
        notes: label.notes,
        isBackground: label.isBackground,
        createdAt: label.createdAt ?? now,
        updatedAt: now,
      };
      await putLabel(created);
      byId.set(created.id, created);
      byName.set(norm(created.english), created);
      idMap.set(label.id, created.id);
      report.labelsAdded++;
    }
  }

  const db = await getDb();
  for (const sample of file.samples) {
    const labelId = idMap.get(sample?.labelId);
    if (!labelId || !isValidSequenceShape(sample.frames, sample.validity) || (await db.getKey('samples', sample.id))) {
      report.samplesSkipped++;
      continue;
    }
    await db.put('samples', {
      id: sample.id,
      labelId,
      sessionId: sample.sessionId || `import:${sample.id}`,
      frames: sample.frames,
      validity: sample.validity,
      source: 'import',
      createdAt: sample.createdAt ?? Date.now(),
    });
    report.samplesAdded++;
  }
  return report;
}

async function importRawFrames(file: RawFramesFile, report: ImportReport): Promise<ImportReport> {
  if (!Array.isArray(file.items)) throw new Error('Raw frames file has no items.');
  const labels = await getLabels();
  const byName = new Map(labels.map((l) => [norm(l.english), l]));
  for (const item of file.items) {
    const name = String(item.label ?? '').replace(/_/g, ' ').trim();
    if (!name) {
      report.samplesSkipped++;
      continue;
    }
    let label = byName.get(norm(name));
    if (!label) {
      const now = Date.now();
      label = { id: createId('l_'), english: name, hindi: item.hindi ?? '', category: item.category ?? 'other', createdAt: now, updatedAt: now };
      await putLabel(label);
      byName.set(norm(name), label);
      report.labelsAdded++;
    } else report.labelsMatched++;
    const seq = buildSequence(item.frames ?? []);
    if (!seq.ok) {
      report.samplesSkipped++;
      report.errors.push(`${item.source ?? name}: ${seq.reason} (${Math.round(seq.validRatio * 100)}% frames with hands)`);
      continue;
    }
    await addSample({
      id: createId('s_'),
      labelId: label.id,
      // Each source video is its own session, so one video never spans train and validation.
      sessionId: `video:${item.source ?? createId()}`,
      frames: seq.frames,
      validity: seq.validity,
      source: 'video',
      createdAt: Date.now(),
    });
    report.samplesAdded++;
  }
  return report;
}

import { beforeEach, describe, expect, it } from 'vitest';
import { RAW_FORMAT } from '../src/ai/constants';
import {
  addHistory,
  addSample,
  clearAllData,
  closeDb,
  countSamplesByLabel,
  exportDataset,
  getActivity,
  getHistory,
  getLabels,
  getSamples,
  importDataset,
  incrementTranslationSessions,
} from '../src/services/databaseService';
import { addStarterWords, createLabel, removeLabel, updateLabel, VocabularyError } from '../src/services/vocabularyService';
import { makeMotionFrames, makeSample } from './helpers';

beforeEach(async () => {
  await clearAllData();
});

describe('IndexedDB persistence', () => {
  it('persists labels and samples across connections', async () => {
    const l = await createLabel({ english: 'Hello', hindi: 'नमस्ते', category: 'greeting' });
    await addSample(makeSample(l.id, 'swipe', 1));
    await closeDb();
    expect((await getLabels()).map((x) => x.english)).toEqual(['Hello']);
    expect(await getSamples(l.id)).toHaveLength(1);
    expect((await countSamplesByLabel()).get(l.id)).toBe(1);
  });

  it('rejects samples with the wrong shape', async () => {
    const s = makeSample('x', 'swipe', 2);
    await expect(addSample({ ...s, frames: s.frames.slice(1) })).rejects.toThrow(/shape/);
  });

  it('validates, edits and cascades label deletion', async () => {
    const l = await createLabel({ english: 'Water', hindi: 'पानी', category: 'need' });
    await expect(createLabel({ english: 'water', hindi: '', category: 'need' })).rejects.toBeInstanceOf(VocabularyError);
    await expect(createLabel({ english: ' ', hindi: '', category: 'need' })).rejects.toThrow(/required/);
    const edited = await updateLabel(l.id, { english: 'Drinking water', hindi: 'पीने का पानी', category: 'need', referenceUrl: 'https://example.org/sign' });
    expect(edited.english).toBe('Drinking water');
    await addSample(makeSample(l.id, 'raise', 3));
    await removeLabel(l.id);
    expect(await getLabels()).toHaveLength(0);
    expect(await getSamples()).toHaveLength(0);
    expect((await getActivity()).map((a) => a.kind)).toContain('label-deleted');
  });

  it('marks background labels', async () => {
    const l = await createLabel({ english: 'Resting', hindi: '', category: 'background' });
    expect(l.isBackground).toBe(true);
  });

  it('adds starter words once, with the ISLRTC reference link', async () => {
    expect(await addStarterWords()).toBe(10);
    expect(await addStarterWords()).toBe(0);
    const labels = await getLabels();
    expect(labels.every((l) => l.referenceUrl?.startsWith('https://divyangjan.depwd.gov.in/islrtc'))).toBe(true);
  });

  it('stores conversation history and session counts', async () => {
    await addHistory('Hello thank you');
    expect((await getHistory())[0].text).toBe('Hello thank you');
    expect(await incrementTranslationSessions()).toBe(1);
    expect(await incrementTranslationSessions()).toBe(2);
  });
});

describe('dataset export / import', () => {
  it('round-trips a dataset through JSON', async () => {
    const l = await createLabel({ english: 'Help', hindi: 'मदद', category: 'need' });
    await addSample(makeSample(l.id, 'swipe', 10, 'sess-a'));
    await addSample(makeSample(l.id, 'swipe', 11, 'sess-b'));
    const file = JSON.parse(JSON.stringify(await exportDataset()));
    expect(file.format).toBe('signbridge-dataset');
    expect(file.sequenceLength).toBe(30);
    expect(file.featureSize).toBe(126);

    await clearAllData();
    const report = await importDataset(file);
    expect(report).toMatchObject({ labelsAdded: 1, samplesAdded: 2, samplesSkipped: 0 });
    const samples = await getSamples();
    expect(new Set(samples.map((s) => s.sessionId))).toEqual(new Set(['sess-a', 'sess-b']));

    // Importing again skips existing samples and matches the label.
    const again = await importDataset(file);
    expect(again).toMatchObject({ labelsAdded: 0, labelsMatched: 1, samplesAdded: 0, samplesSkipped: 2 });
  });

  it('matches imported labels by English name', async () => {
    const local = await createLabel({ english: 'Yes', hindi: 'हाँ', category: 'other' });
    const s = makeSample('remote-id', 'raise', 20);
    const report = await importDataset({
      format: 'signbridge-dataset', formatVersion: 1, exportedAt: '', sequenceLength: 30, featureSize: 126, handSlots: 2,
      labels: [{ id: 'remote-id', english: 'YES', hindi: '', category: 'other', createdAt: 0, updatedAt: 0 }],
      samples: [s],
    });
    expect(report.labelsMatched).toBe(1);
    expect((await getSamples(local.id))).toHaveLength(1);
  });

  it('rejects foreign or mis-shaped files', async () => {
    await expect(importDataset({ format: 'something-else' })).rejects.toThrow(/Unsupported/);
    await expect(importDataset({ format: 'signbridge-dataset', sequenceLength: 20, featureSize: 126, labels: [], samples: [] })).rejects.toThrow(/shape/);
    await expect(importDataset(null)).rejects.toThrow();
  });

  it('imports raw landmark frames (video extractor output) through the same preprocessing', async () => {
    const report = await importDataset({
      format: RAW_FORMAT,
      formatVersion: 1,
      items: [
        { label: 'THANK_YOU', source: 'THANK_YOU/sample_001.mp4', frames: makeMotionFrames('swipe', 30) },
        { label: 'THANK_YOU', source: 'THANK_YOU/empty.mp4', frames: makeMotionFrames('swipe', 31).map((f) => ({ ...f, hands: [] })) },
      ],
    });
    expect(report.labelsAdded).toBe(1);
    expect(report.samplesAdded).toBe(1);
    expect(report.samplesSkipped).toBe(1);
    const [label] = await getLabels();
    expect(label.english).toBe('THANK YOU');
    const [sample] = await getSamples();
    expect(sample.source).toBe('video');
    expect(sample.sessionId).toBe('video:THANK_YOU/sample_001.mp4');
  });
});

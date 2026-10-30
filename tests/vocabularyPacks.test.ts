import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_PACK_WORD_COUNT, VOCABULARY_PACKS } from '../src/data/vocabularyPacks';
import { clearAllData, getActivity, getLabels } from '../src/services/databaseService';
import { addStarterWords, addVocabularyPacks, CATEGORIES } from '../src/services/vocabularyService';

beforeEach(async () => {
  await clearAllData();
});

describe('vocabulary packs', () => {
  it('have unique English words, Hindi translations and valid categories', () => {
    const names = VOCABULARY_PACKS.flatMap((p) => p.words.map((w) => w.english.toLowerCase()));
    expect(new Set(names).size).toBe(names.length);
    const categories = new Set(CATEGORIES.map((c) => c.value));
    for (const word of VOCABULARY_PACKS.flatMap((p) => p.words)) {
      expect(word.hindi.trim()).not.toBe('');
      expect(categories.has(word.category)).toBe(true);
    }
    expect(VOCABULARY_PACKS.find((p) => p.id === 'alphabet')!.words).toHaveLength(26);
  });

  it('adds selected packs once and skips words already present', async () => {
    await addStarterWords(); // includes Hello, Thank you, Water, …
    const before = (await getLabels()).length;
    const added = await addVocabularyPacks(VOCABULARY_PACKS.map((p) => p.id));
    expect(before + added).toBe((await getLabels()).length);
    // Every starter word also appears in a pack, so the total is exactly the pack word count.
    expect((await getLabels()).length).toBe(ALL_PACK_WORD_COUNT);
    expect(await addVocabularyPacks(VOCABULARY_PACKS.map((p) => p.id))).toBe(0);
    expect((await getActivity()).filter((a) => a.message.includes('vocabulary packs'))).toHaveLength(1);
  });

  it('adds a single pack with the ISLRTC reference link', async () => {
    expect(await addVocabularyPacks(['colours'])).toBe(11);
    const labels = await getLabels();
    expect(labels.every((l) => l.category === 'colour' && l.referenceUrl?.includes('islrtc'))).toBe(true);
  });
});

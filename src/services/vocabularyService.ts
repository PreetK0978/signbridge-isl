import { deleteLabel, getLabels, logActivity, putLabel } from './databaseService';
import { createId } from '../utils/id';
import { VOCABULARY_PACKS } from '../data/vocabularyPacks';
import type { SignCategory, SignLabel } from '../types';

export const ISLRTC_DICTIONARY_URL = 'https://divyangjan.depwd.gov.in/islrtc/';

export const CATEGORIES: Array<{ value: SignCategory; label: string }> = [
  { value: 'greeting', label: 'Greeting' },
  { value: 'courtesy', label: 'Courtesy' },
  { value: 'question', label: 'Question' },
  { value: 'need', label: 'Needs & help' },
  { value: 'emotion', label: 'Emotion' },
  { value: 'family', label: 'Family & people' },
  { value: 'number', label: 'Number' },
  { value: 'alphabet', label: 'Alphabet' },
  { value: 'action', label: 'Action' },
  { value: 'object', label: 'Object' },
  { value: 'time', label: 'Time & days' },
  { value: 'colour', label: 'Colour' },
  { value: 'place', label: 'Place' },
  { value: 'food', label: 'Food & drink' },
  { value: 'health', label: 'Health & emergency' },
  { value: 'other', label: 'Other' },
  { value: 'background', label: 'Background (no sign)' },
];

export function categoryLabel(value: SignCategory): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/**
 * Suggested starter words with Hindi translations. These are WORDS only — SignBridge ships
 * no sign definitions. Learn each sign from the official ISLRTC dictionary (or a Deaf ISL
 * signer) and record your own samples in the Training Studio.
 */
export const STARTER_WORDS: Array<Pick<SignLabel, 'english' | 'hindi' | 'category'>> = [
  { english: 'Hello', hindi: 'नमस्ते', category: 'greeting' },
  { english: 'Thank you', hindi: 'धन्यवाद', category: 'courtesy' },
  { english: 'Please', hindi: 'कृपया', category: 'courtesy' },
  { english: 'Sorry', hindi: 'माफ़ कीजिए', category: 'courtesy' },
  { english: 'Yes', hindi: 'हाँ', category: 'other' },
  { english: 'No', hindi: 'नहीं', category: 'other' },
  { english: 'Help', hindi: 'मदद', category: 'need' },
  { english: 'Water', hindi: 'पानी', category: 'need' },
  { english: 'Food', hindi: 'खाना', category: 'need' },
  { english: 'Good', hindi: 'अच्छा', category: 'emotion' },
];

export interface LabelInput {
  english: string;
  hindi: string;
  category: SignCategory;
  referenceUrl?: string;
  notes?: string;
}

export class VocabularyError extends Error {}

function validate(input: LabelInput, existing: SignLabel[], selfId?: string): void {
  const english = input.english.trim();
  if (!english) throw new VocabularyError('English word is required.');
  if (english.length > 60) throw new VocabularyError('English word must be 60 characters or fewer.');
  if (existing.some((l) => l.id !== selfId && l.english.trim().toLowerCase() === english.toLowerCase())) {
    throw new VocabularyError(`"${english}" already exists in your vocabulary.`);
  }
  if (input.referenceUrl && !/^https?:\/\//i.test(input.referenceUrl.trim())) {
    throw new VocabularyError('Reference link must start with http:// or https://');
  }
}

export async function createLabel(input: LabelInput): Promise<SignLabel> {
  validate(input, await getLabels());
  const now = Date.now();
  const label: SignLabel = {
    id: createId('l_'),
    english: input.english.trim(),
    hindi: input.hindi.trim(),
    category: input.category,
    referenceUrl: input.referenceUrl?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    isBackground: input.category === 'background' || undefined,
    createdAt: now,
    updatedAt: now,
  };
  await putLabel(label);
  await logActivity('label-created', `Added sign "${label.english}"`);
  return label;
}

export async function updateLabel(id: string, input: LabelInput): Promise<SignLabel> {
  const labels = await getLabels();
  const current = labels.find((l) => l.id === id);
  if (!current) throw new VocabularyError('Sign not found.');
  validate(input, labels, id);
  const updated: SignLabel = {
    ...current,
    english: input.english.trim(),
    hindi: input.hindi.trim(),
    category: input.category,
    referenceUrl: input.referenceUrl?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    isBackground: input.category === 'background' || undefined,
    updatedAt: Date.now(),
  };
  await putLabel(updated);
  await logActivity('label-updated', `Edited sign "${updated.english}"`);
  return updated;
}

export async function removeLabel(id: string): Promise<void> {
  const label = (await getLabels()).find((l) => l.id === id);
  const removed = await deleteLabel(id);
  await logActivity('label-deleted', `Deleted sign "${label?.english ?? id}" and ${removed} sample(s)`);
}

/**
 * Add words that are not already in the vocabulary (matched by English, case-insensitive).
 * Words only — each still needs recorded samples before it can be recognised.
 */
export async function addWords(words: Array<Pick<SignLabel, 'english' | 'hindi' | 'category'>>, source: string): Promise<number> {
  const existing = new Set((await getLabels()).map((l) => l.english.trim().toLowerCase()));
  let added = 0;
  for (const word of words) {
    const key = word.english.trim().toLowerCase();
    if (existing.has(key)) continue;
    const now = Date.now();
    await putLabel({
      id: createId('l_'),
      english: word.english.trim(),
      hindi: word.hindi.trim(),
      category: word.category,
      referenceUrl: ISLRTC_DICTIONARY_URL,
      createdAt: now,
      updatedAt: now,
    });
    existing.add(key);
    added++;
  }
  if (added) await logActivity('label-created', `Added ${added} word(s) from ${source}`);
  return added;
}

/** Add any starter words that are not already present. Returns how many were added. */
export async function addStarterWords(): Promise<number> {
  return addWords(STARTER_WORDS, 'the starter list');
}

export async function addVocabularyPacks(packIds: string[]): Promise<number> {
  const packs = VOCABULARY_PACKS.filter((p) => packIds.includes(p.id));
  return addWords(
    packs.flatMap((p) => p.words),
    packs.length === 1 ? `the "${packs[0].name}" pack` : `${packs.length} vocabulary packs`,
  );
}

export interface SentenceState {
  words: string[];
  lastAppended: { word: string; at: number } | null;
}

export const EMPTY_SENTENCE: SentenceState = { words: [], lastAppended: null };

/**
 * Append a recognised word. The same word arriving again within `dedupeWindowMs`
 * (e.g. the model re-emitting a held sign) is ignored. Deliberate repeats after the
 * window are allowed.
 */
export function appendWord(state: SentenceState, word: string, now: number, dedupeWindowMs = 2500): SentenceState {
  const w = word.trim();
  if (!w) return state;
  const last = state.lastAppended;
  if (last && last.word.toLowerCase() === w.toLowerCase() && now - last.at < dedupeWindowMs) return state;
  return { words: [...state.words, w], lastAppended: { word: w, at: now } };
}

export function removeLastWord(state: SentenceState): SentenceState {
  return { words: state.words.slice(0, -1), lastAppended: null };
}

export function clearSentence(): SentenceState {
  return EMPTY_SENTENCE;
}

export function sentenceText(words: string[]): string {
  if (words.length === 0) return '';
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Replace the sentence with manually edited text. */
export function setSentenceText(text: string): SentenceState {
  return { words: text.split(/\s+/).filter(Boolean), lastAppended: null };
}

import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { appendWord, clearSentence, EMPTY_SENTENCE, removeLastWord, sentenceText, setSentenceText } from '../src/utils/sentence';
import { RecognitionPanel } from '../src/components/Translator/RecognitionPanel';
import { AppProviders } from '../src/context/AppProviders';
import { AppRoutes } from '../src/App';

describe('sentence composition', () => {
  it('appends words and capitalises the sentence', () => {
    let s = appendWord(EMPTY_SENTENCE, 'hello', 0);
    s = appendWord(s, 'friend', 3000);
    expect(sentenceText(s.words)).toBe('Hello friend');
  });

  it('drops duplicate words from repeated predictions within the window', () => {
    let s = appendWord(EMPTY_SENTENCE, 'Thank you', 0);
    s = appendWord(s, 'thank you', 500);
    expect(s.words).toEqual(['Thank you']);
    s = appendWord(s, 'Thank you', 5000);
    expect(s.words).toEqual(['Thank you', 'Thank you']);
  });

  it('removes the last word, clears, and accepts manual edits', () => {
    let s = appendWord(appendWord(EMPTY_SENTENCE, 'a', 0), 'b', 5000);
    s = removeLastWord(s);
    expect(s.words).toEqual(['a']);
    expect(clearSentence().words).toEqual([]);
    expect(setSentenceText('  I   need help ').words).toEqual(['I', 'need', 'help']);
  });

  it('ignores blank words', () => {
    expect(appendWord(EMPTY_SENTENCE, '   ', 0)).toBe(EMPTY_SENTENCE);
  });
});

describe('UI', () => {
  it('shows UNKNOWN SIGN instead of guessing', () => {
    render(
      <RecognitionPanel
        view={{ status: 'unknown', english: null, hindi: null, confidence: 0.42, top: [{ name: 'Hello', p: 0.42 }] }}
        lastWord={null}
        onAdd={() => undefined}
        onSpeak={() => undefined}
        pendingConfirmation={false}
      />,
    );
    expect(screen.getByText('UNKNOWN SIGN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to sentence/i })).toBeDisabled();
  });

  it('shows the recognised English and Hindi words', () => {
    render(
      <RecognitionPanel
        view={{ status: 'recognized', english: 'Water', hindi: 'पानी', confidence: 0.97, top: [] }}
        lastWord={{ english: 'Water', hindi: 'पानी' }}
        onAdd={() => undefined}
        onSpeak={() => undefined}
        pendingConfirmation
      />,
    );
    expect(screen.getByText('Water')).toBeInTheDocument();
    expect(screen.getByText('पानी')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm & add/i })).toBeEnabled();
  });

  it('renders the landing page with working navigation', async () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(screen.getByRole('heading', { name: /your hands have a voice/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open app/i }));
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});

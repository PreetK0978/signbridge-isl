import { useContext } from 'react';
import { AppDataContext, SentenceContext, SettingsContext } from '../context/contexts';

function required<T>(value: T | null, name: string): T {
  if (!value) throw new Error(`${name} must be used inside <AppProviders>.`);
  return value;
}

export const useSettings = () => required(useContext(SettingsContext), 'useSettings');
export const useAppData = () => required(useContext(AppDataContext), 'useAppData');
export const useSentence = () => required(useContext(SentenceContext), 'useSentence');

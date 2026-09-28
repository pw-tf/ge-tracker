import { createStore } from './store';

export type Theme = 'dark' | 'light';

export interface Settings {
  theme: Theme;
  /** Raw text the player typed, e.g. "50M". Empty = no bankroll cap. */
  bankroll: string;
  castsPerHour: number;
  /** Nature rune price override for alching; empty = live price. */
  natureOverride: string;
}

const DEFAULTS: Settings = {
  theme: 'dark',
  bankroll: '',
  castsPerHour: 1200,
  natureOverride: '',
};

function isSettings(v: unknown): v is Settings {
  return typeof v === 'object' && v !== null && 'theme' in v;
}

const store = createStore<Settings>('ge:settings:v1', DEFAULTS, isSettings);

export const useSettings = () => ({ ...DEFAULTS, ...store.use() });
export const updateSettings = (patch: Partial<Settings>) => store.set((s) => ({ ...s, ...patch }));

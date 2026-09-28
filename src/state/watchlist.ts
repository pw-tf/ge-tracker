import { createStore } from './store';

const isIdList = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === 'number');

const store = createStore<number[]>('ge:watchlist:v1', [], isIdList);

export const useWatchlist = store.use;

export function isWatched(ids: number[], id: number): boolean {
  return ids.includes(id);
}

export function toggleWatch(id: number) {
  store.set((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
}

export function addWatch(id: number) {
  store.set((ids) => (ids.includes(id) ? ids : [...ids, id]));
}

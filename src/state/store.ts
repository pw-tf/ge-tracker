import { useSyncExternalStore } from 'react';

/**
 * A tiny value store persisted to localStorage. Storage can be unavailable
 * (private mode, blocked site data), so every access is guarded and the app
 * keeps working in memory.
 */
export function createStore<T>(key: string, initial: T, validate: (v: unknown) => v is T) {
  let value: T = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) {
      const parsed: unknown = JSON.parse(raw);
      if (validate(parsed)) value = parsed;
    }
  } catch {
    // ignore
  }
  const listeners = new Set<() => void>();

  function get(): T {
    return value;
  }
  function set(next: T | ((prev: T) => T)) {
    value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
    listeners.forEach((l) => l());
  }
  function subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  }
  function use(): T {
    return useSyncExternalStore(subscribe, get, get);
  }
  return { get, set, subscribe, use };
}

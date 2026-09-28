/**
 * OSRS Wiki real-time prices API.
 * Docs: https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices
 * Browsers cannot set a custom User-Agent, so requests go out with the browser's own.
 */
export const API_BASE = 'https://prices.runescape.wiki/api/v1/osrs';
export const ICON_BASE = 'https://oldschool.runescape.wiki/images/';
export const WIKI_BASE = 'https://oldschool.runescape.wiki/w/';

export interface MappingEntry {
  id: number;
  name: string;
  examine: string;
  members: boolean;
  lowalch?: number;
  highalch?: number;
  limit?: number;
  value: number;
  icon: string;
}

export interface LatestEntry {
  high: number | null;
  highTime: number | null;
  low: number | null;
  lowTime: number | null;
}

export interface AvgEntry {
  avgHighPrice: number | null;
  highPriceVolume: number;
  avgLowPrice: number | null;
  lowPriceVolume: number;
}

export interface TimeseriesPoint {
  timestamp: number;
  avgHighPrice: number | null;
  avgLowPrice: number | null;
  highPriceVolume: number;
  lowPriceVolume: number;
}

export type Timestep = '5m' | '1h' | '6h' | '24h';

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(API_BASE + path, { signal });
  if (!res.ok) throw new Error(`Price API ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

const MAPPING_CACHE_KEY = 'ge:mapping:v1';
const MAPPING_TTL_MS = 24 * 60 * 60 * 1000;

/** Item metadata rarely changes, so it is cached in localStorage for a day. */
export async function fetchMapping(signal?: AbortSignal): Promise<MappingEntry[]> {
  try {
    const cached = localStorage.getItem(MAPPING_CACHE_KEY);
    if (cached) {
      const { at, data } = JSON.parse(cached) as { at: number; data: MappingEntry[] };
      if (Date.now() - at < MAPPING_TTL_MS && Array.isArray(data) && data.length) return data;
    }
  } catch {
    // Storage unavailable or corrupt: fall through to the network.
  }
  const data = await getJson<MappingEntry[]>('/mapping', signal);
  try {
    localStorage.setItem(MAPPING_CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // Quota exceeded or storage blocked; the in-memory query cache still works.
  }
  return data;
}

export async function fetchLatest(signal?: AbortSignal): Promise<Record<string, LatestEntry>> {
  return (await getJson<{ data: Record<string, LatestEntry> }>('/latest', signal)).data;
}

export async function fetchAverages(window: '5m' | '1h' | '24h', signal?: AbortSignal): Promise<Record<string, AvgEntry>> {
  return (await getJson<{ data: Record<string, AvgEntry> }>('/' + window, signal)).data;
}

export async function fetchTimeseries(id: number, timestep: Timestep, signal?: AbortSignal): Promise<TimeseriesPoint[]> {
  return (await getJson<{ data: TimeseriesPoint[] }>(`/timeseries?id=${id}&timestep=${timestep}`, signal)).data;
}

export function iconUrl(icon: string): string {
  return ICON_BASE + encodeURIComponent(icon.replace(/ /g, '_'));
}

export function wikiUrl(name: string): string {
  return WIKI_BASE + encodeURIComponent(name.replace(/ /g, '_'));
}

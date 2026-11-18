// src/core/utils/compression.ts
import LZString from 'lz-string';
import { SharedPlanState } from '../../@types/user';

const HASH_PREFIX = '#plan=';

export function encodePlanToUrlHash(state: SharedPlanState): string {
  const json = JSON.stringify(state);
  const compressed = LZString.compressToEncodedURIComponent(json);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  return `${origin}${pathname}${HASH_PREFIX}${compressed}`;
}

export function encodePlanState(state: SharedPlanState): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(state));
}

export function decodePlanFromUrlHash(hash: string = typeof window !== 'undefined' ? window.location.hash : ''): SharedPlanState | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  try {
    const raw = hash.slice(HASH_PREFIX.length);
    const decompressed = LZString.decompressFromEncodedURIComponent(raw);
    if (!decompressed) return null;
    const parsed = JSON.parse(decompressed) as SharedPlanState;
    if (parsed && parsed.version === 2 && parsed.context?.term) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

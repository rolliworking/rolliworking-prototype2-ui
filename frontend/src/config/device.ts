import type { Station } from '@/api/types';

// PROTOTYPE ONLY — in production the device type comes from the registered station record (D-384), never from screen size.
// Order: station.deviceType → `?device=ipad|desktop` session override (testing from any machine) → touch + width ≤ 1366 heuristic.
const KEY = 'rollisuite.prototype.deviceOverride';
(() => { try { const v = new URLSearchParams(window.location.search).get('device'); if (v) sessionStorage.setItem(KEY, v === 'ipad' || v === 'pad' ? 'pad' : 'desktop'); } catch { /* non-browser */ } })();
export const deviceOverride = (): 'pad' | 'desktop' | null => (sessionStorage.getItem(KEY) as 'pad' | 'desktop' | null);
export const isPadDevice = (station?: Station | null): boolean => {
  if (station?.deviceType) return station.deviceType === 'pad';
  const o = deviceOverride(); if (o) return o === 'pad';
  return window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 1366;
};

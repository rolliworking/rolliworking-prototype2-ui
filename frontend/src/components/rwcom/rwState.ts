import type { Brand, ShotKey } from '@/api/watchm8';

// Shared visitor state across the three rw.com tabs (identify → check → request). Lives only in the emulator page; nothing here is persisted except via claim codes.
export interface RwState {
  ref?: string;
  brand?: Brand;
  model?: string;
  bracelet?: string;
  serialPrefix?: string;
  shots: Partial<Record<ShotKey, string>>;
  claim?: string;
}
export const EMPTY_STATE: RwState = { shots: {} };
export const shotList = (shots: Partial<Record<ShotKey, string>>) => (Object.entries(shots) as [ShotKey, string | undefined][]).filter((e): e is [ShotKey, string] => !!e[1]).map(([key, dataUrl]) => ({ key, dataUrl }));
// Serial prefix only — we never carry the full serial; the last three characters are always masked
export const maskSerial = (s: string) => { const v = s.trim().toUpperCase(); return v.length <= 3 ? v.replace(/./g, '•') : v.slice(0, -3) + '•••'; };

import { useEffect, useState } from 'react';

// Offline rule (MH 2026-09-30): the cached bench board is READ-ONLY; scans QUEUE and REPLAY when back online — never applied locally. Custody changes only on a confirmed scan.
const QUEUE_KEY = 'rollisuite.rw.scanQueue'; const FLAG_KEY = 'rollisuite.kiosk.offline';
export interface QueuedScan { id: string; kind: 'station' | 'container' | 'gate'; station?: string; code: string; at: string; by?: string }
const read = (): QueuedScan[] => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as QueuedScan[]; } catch { return []; } };
const write = (q: QueuedScan[]) => { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); window.dispatchEvent(new Event('rw-queue')); };
export const simulatedOffline = () => localStorage.getItem(FLAG_KEY) === '1';
export const setSimulatedOffline = (v: boolean) => { if (v) localStorage.setItem(FLAG_KEY, '1'); else localStorage.removeItem(FLAG_KEY); window.dispatchEvent(new Event('rw-online')); };
export const isOffline = () => (typeof navigator !== 'undefined' && !navigator.onLine) || simulatedOffline();
export const queuedScans = read;
export const enqueueScan = (s: Omit<QueuedScan, 'id' | 'at'>): QueuedScan => { const q: QueuedScan = { ...s, id: `qs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString() }; write([...read(), q]); return q; };
export const clearQueue = () => write([]);
// Replay in order; a failing scan stays queued (surfaced to the user), the rest continue
export async function replayQueue(apply: (s: QueuedScan) => Promise<void>): Promise<{ done: number; failed: QueuedScan[] }> {
  const q = read(); const failed: QueuedScan[] = []; let done = 0;
  for (const s of q) { try { await apply(s); done += 1; } catch { failed.push(s); } }
  write(failed); return { done, failed };
}
export const useOnline = () => {
  const [online, setOnline] = useState(!isOffline()); const [queued, setQueued] = useState(read().length);
  useEffect(() => { const upd = () => { setOnline(!isOffline()); setQueued(read().length); }; window.addEventListener('online', upd); window.addEventListener('offline', upd); window.addEventListener('rw-online', upd); window.addEventListener('rw-queue', upd); window.addEventListener('storage', upd); return () => { window.removeEventListener('online', upd); window.removeEventListener('offline', upd); window.removeEventListener('rw-online', upd); window.removeEventListener('rw-queue', upd); window.removeEventListener('storage', upd); }; }, []);
  return { online, queued };
};

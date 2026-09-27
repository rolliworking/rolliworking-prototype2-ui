import { API_MODE, API_SOURCE } from './config';

// Last-call health + a tiny event bus for the banner and the "API unreachable" toast. No UI here.
export interface ApiHealth { lastOk: boolean | null; lastAt?: string; lastError?: string; failures: number; realCalls: number }
const health: ApiHealth = { lastOk: null, failures: 0, realCalls: 0 };
const listeners = new Set<() => void>();
export const getApiHealth = (): ApiHealth => ({ ...health });
export const subscribeApiHealth = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const emit = () => listeners.forEach((fn) => fn());
export const noteRealOk = () => { health.lastOk = true; health.lastAt = new Date().toISOString(); health.realCalls++; emit(); };
export const noteRealFail = (e: unknown) => { health.lastOk = false; health.lastAt = new Date().toISOString(); health.lastError = e instanceof Error ? e.message : String(e); health.failures++; emit(); };

let lastToastAt = 0;
export const API_TOAST_EVENT = 'rollisuite-api-toast';
const toast = (text: string) => { const now = Date.now(); if (now - lastToastAt < 8000) return; lastToastAt = now; window.dispatchEvent(new CustomEvent(API_TOAST_EVENT, { detail: text })); };

export const isReal = (name: string) => API_MODE === 'hybrid' && API_SOURCE[name] === 'real';

// The routing layer: real when covered + hybrid; on any failure fall back to the mock for THAT call, toast once, log. Never white-screen.
export function route<A extends unknown[], R>(name: string, mock: (...a: A) => Promise<R>, real?: (...a: A) => Promise<R>): (...a: A) => Promise<R> {
  return async (...a: A) => {
    if (!real || !isReal(name)) return mock(...a);
    try { const r = await real(...a); noteRealOk(); return r; }
    catch (e) { console.warn(`[api] ${name} → real API failed, showing mock data`, e); noteRealFail(e); toast('API unreachable — showing mock data'); return mock(...a); }
  };
}

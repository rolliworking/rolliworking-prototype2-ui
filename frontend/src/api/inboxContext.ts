import { useSyncExternalStore } from 'react';

// INBOX CONTEXT (MH 2026-10-02): the Inbox is a context, not a page. Opening a message sets it; anything opened FROM that message
// (client card · job card · job page · request · estimate) carries it, through the slide-out and full-page views, until the user
// navigates via the sidebar or opens a different message. Survives full-page views via sessionStorage.
export interface InboxContext { threadId: string; clientName: string; subject: string; scrollTop: number; at: string }
const KEY = 'rollisuite.inbox.ctx';
const read = (): InboxContext | null => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); } catch { return null; } };
let ctx: InboxContext | null = read();
const listeners = new Set<() => void>();
const persist = () => { try { if (ctx) sessionStorage.setItem(KEY, JSON.stringify(ctx)); else sessionStorage.removeItem(KEY); } catch { /* private mode */ } };
const emit = () => listeners.forEach((fn) => fn());

export const getInboxContext = () => ctx;
export const setInboxContext = (c: Pick<InboxContext, 'threadId' | 'clientName' | 'subject'>) => { if (ctx?.threadId === c.threadId) { ctx = { ...ctx, ...c }; persist(); emit(); return; } ctx = { ...c, scrollTop: 0, at: new Date().toISOString() }; persist(); emit(); };
// Scroll position is written in place (no re-render) — restored when the message is shown again
export const rememberInboxScroll = (threadId: string, scrollTop: number) => { if (ctx && ctx.threadId === threadId) { ctx.scrollTop = scrollTop; persist(); } };
export const clearInboxContext = () => { if (!ctx) return; ctx = null; persist(); emit(); };
export const inboxReturnPath = (c: InboxContext) => `/inbox?thread=${encodeURIComponent(c.threadId)}`;
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const useInboxContext = () => useSyncExternalStore(subscribe, getInboxContext, getInboxContext);

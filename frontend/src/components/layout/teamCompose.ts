import type { ComposeTarget } from './MessageDirectory';

// Hand-off between surfaces: the bubble / a thread's "Reply" sets a pending compose target, navigates to Inbox → Team, and TeamMessages picks it up on mount (or live via the event when already mounted)
let pending: ComposeTarget | null = null;
export const TEAM_COMPOSE_EVENT = 'rollisuite:team-compose';
export const setPendingCompose = (t: ComposeTarget | null) => { pending = t; try { window.dispatchEvent(new CustomEvent<ComposeTarget | null>(TEAM_COMPOSE_EVENT, { detail: t })); } catch { /* non-browser */ } };
export const takePendingCompose = (): ComposeTarget | null => { const t = pending; pending = null; return t; };
export const teamInboxPath = (opts: { compose?: boolean; chip?: string; intercom?: boolean } = {}) => (opts.intercom ? '/inbox?section=intercom' : `/inbox?section=staff${opts.chip ? `&chip=${opts.chip}` : ''}${opts.compose ? '&compose=1' : ''}`);
export const rwMessagesPath = (opts: { compose?: boolean; intercom?: boolean } = {}) => (opts.intercom ? '/rw/messages?tab=intercom' : `/rw/messages${opts.compose ? '?compose=1' : ''}`);

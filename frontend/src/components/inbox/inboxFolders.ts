import type { ConvMessage, InboxFilter } from '@/api/client';

// OUTLOOK-STYLE TREE (MH 2026-10-02). PORTAL = two-way client threads (MH · VC · CM only); INTERNAL = staff one-shot messages (same store as the bubble).
// Folder = URL `?folder=`. Tag folders are VIEWS over All (tag, don't assign — a tagged thread never leaves All).
export type PortalFolder = 'all' | 'mike' | 'vienna' | 'chyna' | 'update_wo' | 'quoted' | 'answered' | 'pinned' | 'calls' | 'sent' | 'archive';
export type FolderKey = PortalFolder | 'in-all' | 'in-sent' | 'in-archive' | 'in-everyone' | `in-staff-${string}`;
export const PORTAL_THREAD_FOLDERS: PortalFolder[] = ['all', 'mike', 'vienna', 'chyna', 'update_wo', 'quoted', 'answered', 'pinned', 'archive'];
export const isInternal = (k: FolderKey) => k.startsWith('in-');
export const staffOfFolder = (k: FolderKey) => (k.startsWith('in-staff-') ? k.slice('in-staff-'.length) : undefined);
export const sectionOf = (k: FolderKey): 'threads' | 'staff' | 'calls' => (isInternal(k) ? 'staff' : k === 'calls' ? 'calls' : 'threads');
// Legacy links (?section=staff&staff=JV · ?who=vienna · ?lane=archived · ?view=open) still land in the right folder
export const resolveFolder = (p: URLSearchParams, comms: boolean): FolderKey => {
  const f = p.get('folder'); if (f) return f as FolderKey;
  const section = p.get('section');
  if (section === 'staff' || (!comms && !p.get('thread'))) { const s = p.get('staff'); return !s || s === 'me' ? 'in-all' : s === 'sent' ? 'in-sent' : s === 'all' ? 'in-everyone' : `in-staff-${s}`; }
  if (section === 'calls') return 'calls';
  const who = p.get('who'); if (who) return who as FolderKey;
  const lane = p.get('lane'); if (lane === 'archived') return 'archive'; if (lane === 'quoted' || lane === 'answered') return lane;
  return 'all';
};
export const filterForFolder = (k: FolderKey): InboxFilter => (k === 'archive' ? { lane: 'archived' } : k === 'quoted' || k === 'answered' ? { lane: k } : k === 'mike' || k === 'vienna' || k === 'chyna' || k === 'update_wo' ? { who: k } : {});
export const FOLDER_LABEL: Record<string, string> = { all: 'All', mike: 'Mike', vienna: 'Vienna', chyna: 'Chyna', update_wo: 'Update work order', quoted: 'Quoted', answered: 'Answered', pinned: 'Pinned', calls: 'Calls', sent: 'Sent', archive: 'Archive', 'in-all': 'All', 'in-sent': 'Sent', 'in-archive': 'Archive', 'in-everyone': 'Everyone' };
export const folderLabel = (k: FolderKey) => FOLDER_LABEL[k] ?? staffOfFolder(k) ?? k;

export const SOURCE_TONE: Record<ConvMessage['source'], string> = { portal: 'bg-sky-50 text-sky-700', email: 'bg-teal-50 text-teal-800', kiosk: 'bg-slate-100 text-slate-700', web: 'bg-indigo-50 text-indigo-700', approval: 'bg-moss-50 text-moss-700', photo: 'bg-violet-50 text-violet-700', parts: 'bg-amber-50 text-amber-800', pickup: 'bg-moss-50 text-moss-700', staff: 'bg-canvas text-ink-600', note: 'bg-yellow-50 text-yellow-800', system: 'bg-canvas text-ink-500' };
export const age = (h: number) => (h < 1 ? 'just now' : h < 24 ? `${h}h` : `${Math.round(h / 24)}d`);

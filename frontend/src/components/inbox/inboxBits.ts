import type { ConvMessage } from '@/api/client';

export const SOURCE_TONE: Record<ConvMessage['source'], string> = { portal: 'bg-sky-50 text-sky-700', email: 'bg-teal-50 text-teal-800', kiosk: 'bg-slate-100 text-slate-700', web: 'bg-indigo-50 text-indigo-700', approval: 'bg-moss-50 text-moss-700', photo: 'bg-violet-50 text-violet-700', parts: 'bg-amber-50 text-amber-800', pickup: 'bg-moss-50 text-moss-700', staff: 'bg-canvas text-ink-600', note: 'bg-yellow-50 text-yellow-800', system: 'bg-canvas text-ink-500' };
export const age = (h: number) => (h < 1 ? 'just now' : h < 24 ? `${h}h` : `${Math.round(h / 24)}d`);

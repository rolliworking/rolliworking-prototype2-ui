import { Megaphone, Phone } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import * as ic from '@/api/intercom';
import type { IntercomState } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useIntercom } from '@/components/inbox/IntercomSection';
import { rwMessagesPath, teamInboxPath } from './teamCompose';

// Top-bar intercom icon = SHORTCUT to the Intercom tab (Inbox → Intercom on the desktop, /rw/messages?tab=intercom on the pad). No popover of its own (MH 2026-10-02). Live dot while a call is up.
export const IntercomButton = ({ dark }: { dark?: boolean }) => {
  const { station } = useAuth(); const s = useIntercom(); const nav = useNavigate(); const loc = useLocation();
  useEffect(() => { if (station) ic.setIntercomMe(station.id); }, [station?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const target = dark ? rwMessagesPath({ intercom: true }) : teamInboxPath({ intercom: true }); const active = `${loc.pathname}${loc.search}`.startsWith(target);
  const btn = dark ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-line bg-canvas text-ink-500 hover:border-ink-400 hover:text-ink';
  return <>
    <button type="button" data-testid="intercom-btn" aria-pressed={active} title="Intercom · paging — opens the Intercom tab" onClick={() => nav(target)} className={`relative flex h-7 items-center gap-1 rounded-sm border px-1.5 text-[11px] ${btn} ${s.call ? '!border-emerald-500 !text-emerald-600' : ''} ${active ? (dark ? '!bg-white/15' : '!border-ink !text-ink') : ''}`}><Phone size={13} />{s.call && <span data-testid="intercom-live-dot" className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}</button>
    <PageOverlay s={s} />
  </>;
};

// Paging banner — shows on every station the page targets (zone rule in api/intercom.ts), independent of which tab is open. Mounted by IntercomButton and standalone (`PageBanner`) on fullscreen pads / benches.
const PageOverlay = ({ s }: { s: IntercomState }) => { const mine = s.pages.filter(ic.pageTargetsMe); return mine.length ? createPortal(<div data-testid="intercom-page-overlay" className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center p-2">{mine.slice(0, 1).map((p) => <div key={p.id} data-zone={p.zone} className="flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm text-white shadow-xl"><Megaphone size={16} className="text-amber-400" /><span><b>{p.by}</b> · {ic.intercomLabel(p.from)} → <span data-testid="intercom-page-zone-label" className="rounded bg-amber-400/20 px-1 text-[11px] font-semibold uppercase text-amber-200">{ic.PAGE_ZONES.find((z) => z.key === p.zone)?.label}</span>: “{p.text}”</span></div>)}</div>, document.body) : null; };
export const PageBanner = () => { const { station } = useAuth(); const s = useIntercom(); useEffect(() => { if (station) ic.setIntercomMe(station.id); }, [station?.id]); return <PageOverlay s={s} />; }; // eslint-disable-line react-hooks/exhaustive-deps

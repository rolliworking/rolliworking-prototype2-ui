import { Eye, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import { homeRouteFor } from '@/api/hitlist';
import { useAuth } from '@/auth/AuthContext';
import { isPadDevice } from '@/config/device';

// D-385 owner "View as" — owner-only (MH). Picking a person renders exactly their landing + screens; actions are recorded actor = MH, on-behalf-of = viewed (D-361).
export const useViewAs = () => {
  const { realUser, viewingAs, station, startViewAs, stopViewAs } = useAuth(); const nav = useNavigate();
  const isOwner = realUser?.id === api.OWNER_USER_ID;
  const pad = isPadDevice(station);
  const start = async (userId: string) => { const u = await startViewAs(userId); nav(homeRouteFor(u), { replace: true }); };
  const exit = async () => { await stopViewAs(); nav(pad ? '/choose-view' : '/', { replace: true }); };
  const own = async () => { await stopViewAs(); nav('/', { replace: true }); };
  return { isOwner, viewingAs, pad, start, exit, own, realUser };
};

export const ViewAsPicker = ({ dark }: { dark?: boolean }) => {
  const { isOwner, viewingAs, start, exit, realUser } = useViewAs();
  if (!isOwner) return null;
  const staff = api.getDivisionStaff('rolliworks').concat(api.getDivisionStaff('rollishop').filter((u) => u.division === 'rollishop')).filter((u) => u.id !== realUser!.id);
  return (
    <label data-testid="view-as-picker" title="View as — owner only. Renders that person's exact view; actions are recorded as MH (as them)" className={`inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 text-[11px] font-medium ${dark ? 'border-white/20 bg-white/5 text-white/80' : 'border-line bg-canvas text-ink-700'}`}>
      <Eye size={12} className={viewingAs ? 'text-amber-500' : undefined} /> View as
      <select data-testid="view-as-select" value={viewingAs?.id ?? ''} onChange={(e) => (e.target.value ? void start(e.target.value) : void exit())} className={`bg-transparent text-[11px] font-semibold outline-none ${dark ? 'text-white' : 'text-ink'}`}>
        <option value="" className="text-black">My own view</option>
        {staff.map((u) => <option key={u.id} value={u.id} className="text-black">{u.shortName} · {u.dutyLabel}</option>)}
      </select>
    </label>
  );
};

// Persistent on every screen while active; one tap exits (desktop → MH's own view, pad → the Choose-a-view picker)
export const ViewAsBanner = () => {
  const { viewingAs, exit, realUser, pad } = useViewAs();
  if (!viewingAs || !realUser) return null;
  return (
    <div data-testid="view-as-banner" role="status" className="pointer-events-none fixed inset-x-0 bottom-3 z-[90] flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-amber-500 bg-amber-400 px-4 py-2 text-xs font-semibold text-black shadow-lg">
        <Eye size={14} />
        <span data-testid="view-as-banner-text">Viewing as {viewingAs.shortName} — actions are recorded as {realUser.shortName} (as {viewingAs.shortName})</span>
        <button type="button" data-testid="view-as-exit" onClick={() => void exit()} className="inline-flex items-center gap-1 rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-black/80"><LogOut size={11} /> {pad ? 'Back to Choose a view' : 'Exit to my view'}</button>
      </div>
    </div>
  );
};

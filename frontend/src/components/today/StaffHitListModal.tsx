/**
 * Staff hit-list viewer (MH ruling 2026-09-24).
 * Full-screen overlay: staff picker at top, prev/next, full today (pinned + derived) for the selected person.
 * Visible to managers and admin-assistants (concierge tier); same-division staff only.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pin, PinOff, X } from 'lucide-react';
import * as api from '@/api/client';
import type { Division, TodayView, User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { fmtTime } from '@/lib/format';
import { OwnerChip } from '@/components/ui/Pills';

// ─── Pinned list (read-only) ──────────────────────────────────────────────────

const ReadPinnedList = ({ items }: { items: TodayView['pinned'] }) => (
  <ul className="divide-y divide-amber-100">
    {items.map((p) => (
      <li key={p.id} className="flex items-center gap-3 bg-amber-50/40 px-4 py-2.5">
        <Pin size={13} className="shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] text-ink">
            {p.jobId ? <Link to={`/jobs/${p.jobId}`} className="hover:underline">{p.title}</Link>
            : p.clientId ? <Link to={`/clients/${p.clientId}`} className="hover:underline">{p.title}</Link>
            : p.estimateId ? <Link to={`/estimates/${p.estimateId}`} className="hover:underline">{p.title}</Link>
            : p.title}
          </div>
          <div className="text-[11px] text-ink-400">
            pinned by {p.createdBy} · {fmtTime(p.createdAt)}
            {p.dismissedAt && <span className="ml-1 text-moss-600">· dismissed</span>}
          </div>
        </div>
        {p.createdBy !== (p.assignedTo.type === 'user' ? p.assignedTo.shortName : '') && <OwnerChip owner={p.createdBy} />}
        {p.dismissedAt && <PinOff size={11} className="text-ink-400" />}
      </li>
    ))}
  </ul>
);

// ─── Derived row (read-only) ──────────────────────────────────────────────────

const URGENCY: Record<string, string> = {
  hold: 'bg-amber-100 text-amber-800',
  discrepancy: 'bg-rose-100 text-rose-800',
  owner: 'bg-moss-50 text-moss-700',
  assignee: 'bg-canvas text-ink-600',
  task: 'bg-surface text-ink-500',
};

const ReadDerivedList = ({ rows }: { rows: TodayView['rows'] }) => (
  <ul className="divide-y divide-line/70">
    {rows.map((r) => (
      <li key={r.id} className="flex items-start gap-3 px-4 py-2.5">
        <span className={`mt-0.5 shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${URGENCY[r.source] ?? ''}`}>{r.source}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] text-ink">
            {r.jobId ? <Link to={`/jobs/${r.jobId}`} className="hover:underline">{r.title}</Link> : r.title}
            {(r.overdue || r.urgent) && <span className="ml-2 text-[10px] font-semibold text-rose-700">{r.overdue ? 'OVERDUE' : 'URGENT'}</span>}
          </div>
          <div className="truncate text-[11px] text-ink-400">{r.detail} · via {r.via}{r.sentBy ? ` · from ${r.sentBy}` : ''}</div>
        </div>
      </li>
    ))}
  </ul>
);

// ─── Main modal ───────────────────────────────────────────────────────────────

export const StaffHitListModal = ({ onClose }: { onClose: () => void }) => {
  const { station } = useAuth();
  const sessionDiv: Division = station?.division ?? 'rolliworks';
  const team = api.getDivisionStaff(sessionDiv);
  const [idx, setIdx] = useState(0);
  const [view, setView] = useState<TodayView | null>(null);
  const [loading, setLoading] = useState(false);

  const selected: User | undefined = team[idx];

  const load = useCallback(async (user: User) => {
    setLoading(true);
    setView(null);
    try {
      const v = await api.getToday(user.id);
      setView(v);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) void load(selected);
  }, [selected, load]);

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => setIdx((i) => Math.min(team.length - 1, i + 1));

  // Keyboard nav
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const divLabel = sessionDiv === 'rolliworks' ? 'Rolliworks' : 'RolliShop';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas" data-testid="staff-hitlist-modal">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-5 py-3">
        <Pin size={14} className="text-amber-600" />
        <span className="text-sm font-semibold text-ink">Staff hit lists</span>
        <span className="rounded-sm border border-line bg-canvas px-1.5 py-0.5 text-[11px] text-ink-400">{divLabel}</span>
        <span className="text-[11px] text-ink-400">· {team.length} staff in division</span>
        <button type="button" data-testid="staff-hitlist-close" onClick={onClose} className="ml-auto flex h-7 w-7 items-center justify-center rounded-sm hover:bg-canvas">
          <X size={16} className="text-ink-500" />
        </button>
      </div>

      {/* Staff picker */}
      <div className="shrink-0 border-b border-line bg-surface px-5 py-2.5">
        <div className="flex items-center gap-2">
          <button type="button" onClick={prev} disabled={idx === 0} data-testid="staff-hitlist-prev" className="flex h-7 w-7 items-center justify-center rounded-sm border border-line text-ink-500 hover:bg-canvas disabled:opacity-30">
            <ChevronLeft size={14} />
          </button>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {team.map((u, i) => (
              <button
                key={u.id}
                type="button"
                data-testid={`staff-pick-${u.shortName}`}
                onClick={() => setIdx(i)}
                className={`rounded-sm border px-2.5 py-1 text-[12px] font-medium transition-colors ${i === idx ? 'border-ink bg-ink text-white' : 'border-line bg-canvas text-ink-700 hover:border-ink-400'}`}
              >
                {u.shortName}
                {u.division === 'both' && <span className="ml-1 text-[10px] opacity-60">both</span>}
              </button>
            ))}
          </div>
          <button type="button" onClick={next} disabled={idx === team.length - 1} data-testid="staff-hitlist-next" className="flex h-7 w-7 items-center justify-center rounded-sm border border-line text-ink-500 hover:bg-canvas disabled:opacity-30">
            <ChevronRight size={14} />
          </button>
        </div>
        {selected && (
          <div className="mt-1.5 text-[11px] text-ink-500">
            <span className="font-semibold">{selected.displayName}</span>
            {' · '}roles: {selected.roles.join(', ')}
            {' · '}div: {selected.division}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <div className="flex h-40 items-center justify-center text-sm text-ink-400">Loading…</div>
        )}
        {!loading && view && (
          <div className="mx-auto max-w-3xl space-y-5 px-6 py-5">
            {/* Pinned */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Pinned</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{view.pinned.filter(p => !p.dismissedAt).length}</span>
              </div>
              {view.pinned.filter(p => !p.dismissedAt).length === 0
                ? <p className="text-xs text-ink-400 px-1">Nothing pinned for {selected?.shortName}.</p>
                : <div className="rounded-md border border-line overflow-hidden"><ReadPinnedList items={view.pinned.filter(p => !p.dismissedAt)} /></div>}
            </section>

            {/* Derived */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Derived</span>
                <span className="rounded-full bg-moss-100 px-2 py-0.5 text-[10px] font-semibold text-moss-800">{view.rows.length}</span>
                <span className="text-[11px] text-ink-400">read-only · from jobs, holds, discrepancies and tasks</span>
              </div>
              {view.rows.length === 0
                ? <p className="text-xs text-ink-400 px-1">No derived items for {selected?.shortName} today.</p>
                : <div className="rounded-md border border-line overflow-hidden bg-surface"><ReadDerivedList rows={view.rows} /></div>}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

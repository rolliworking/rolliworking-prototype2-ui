import { AlertTriangle, Check, CircleHelp, ClipboardCheck, Lock, RotateCcw, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { AuditItem, AuditLive, AuditLocationKey, AuditLocationStatus, AuditSession, AuditUnexpected } from '@/api/client';
import { PartDot, ScanInput } from '@/components/rw/RwBits';
import { fmtDate, fmtTime } from '@/lib/format';

const TIER: Record<AuditItem['tier'], { label: string; cls: string }> = { high: { label: 'HIGH VALUE', cls: 'bg-rose-500/20 text-rose-200 border-rose-400/40' }, mid: { label: 'MID', cls: 'bg-amber-400/15 text-amber-200 border-amber-400/30' }, standard: { label: 'STD', cls: 'bg-white/5 text-slate-300 border-white/10' } };
export const TierChip = ({ tier }: { tier: AuditItem['tier'] }) => <span data-testid={`tier-${tier}`} className={`rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${TIER[tier].cls}`}>{TIER[tier].label}</span>;

const Identity = ({ it }: { it: AuditItem }) => <div className="min-w-0 flex-1">
  <div className="flex flex-wrap items-center gap-2"><PartDot k={it.key} size={10} /><span className="font-mono font-semibold text-white">{it.jobNumber}</span><span className="text-slate-200">{it.partLabel} · {it.watchLabel}</span><TierChip tier={it.tier} /></div>
  <div className="text-xs text-slate-400">Ref {it.reference} · S/N {it.serial} · {it.clientName}</div>
</div>;

// Missing = the starting point of the search: identity, client, value, and who touched it last
const MissingRow = ({ it, big }: { it: AuditItem; big?: boolean }) => <li data-testid={`audit-missing-${it.id}`} className={`rounded-xl border border-rose-400/50 bg-rose-950/40 ${big ? 'p-4' : 'p-3'}`}>
  <div className="flex items-start gap-3"><AlertTriangle size={big ? 22 : 16} className="mt-0.5 shrink-0 text-rose-300" /><Identity it={it} /></div>
  {it.lastCustody && <div data-testid={`audit-missing-custody-${it.id}`} className="mt-2 rounded-md bg-black/30 px-3 py-1.5 text-xs text-rose-100">Last custody: <span className="font-semibold">{it.lastCustody.by}</span> · {it.lastCustody.where} · {fmtDate(it.lastCustody.at)} {fmtTime(it.lastCustody.at)}</div>}
</li>;

const UnexpectedRow = ({ u, onResolve, canCorrect, big }: { u: AuditUnexpected; onResolve?: (r: 'corrected' | 'investigate') => void; canCorrect: boolean; big?: boolean }) => <li data-testid={`audit-unexpected-${u.id}`} className={`rounded-xl border border-amber-400/40 bg-amber-400/5 ${big ? 'p-4' : 'p-3'}`}>
  <div className="flex items-start gap-3"><CircleHelp size={big ? 22 : 16} className="mt-0.5 shrink-0 text-amber-300" /><Identity it={u} /></div>
  <div className="mt-1.5 text-xs text-amber-100">System believes it is at <span className="font-semibold">{u.believedLabel}</span></div>
  {u.resolution ? <div data-testid={`audit-unexpected-resolution-${u.id}`} className="mt-2 text-xs font-semibold text-slate-200">{u.resolution === 'corrected' ? '✓ Location corrected (custody event · audit_correction)' : '⚑ Flagged for investigation'}</div>
    : onResolve && <div className="mt-2 flex flex-wrap gap-2">
      <button data-testid={`audit-correct-${u.id}`} disabled={!canCorrect} title={canCorrect ? undefined : 'Bins are derived from job state — investigate instead'} onClick={() => onResolve('corrected')} className={`${big ? 'min-h-[48px] px-4 text-base' : 'min-h-[36px] px-3 text-xs'} rounded-lg bg-amber-400 font-semibold text-[#161b22] disabled:opacity-40`}>Correct location → here</button>
      <button data-testid={`audit-investigate-${u.id}`} onClick={() => onResolve('investigate')} className={`${big ? 'min-h-[48px] px-4 text-base' : 'min-h-[36px] px-3 text-xs'} rounded-lg border border-white/20 text-slate-100 hover:bg-white/10`}><Search size={big ? 16 : 12} className="mr-1 inline" /> Investigate</button>
    </div>}
</li>;

const LocationPicker = ({ locs, onPick, big }: { locs: AuditLocationStatus[]; onPick: (k: AuditLocationKey) => void; big?: boolean }) => <div className="space-y-3">
  {(['station', 'bin'] as const).map((g) => <div key={g}><div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">{g === 'station' ? 'Stations & safes' : 'Bins'}</div>
    <div className={`grid gap-2 ${big ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-4'}`}>{locs.filter((l) => l.location.group === g).map((l) => <button key={l.location.key} data-testid={`audit-loc-${l.location.key}`} onClick={() => onPick(l.location.key)} className={`${big ? 'min-h-[72px]' : 'min-h-[56px]'} rounded-xl border border-white/15 px-2 py-1.5 text-left text-sm text-slate-200 hover:border-amber-400/60 hover:bg-white/5`}>
      <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1 font-medium">{l.location.key.includes('safe') && <Lock size={10} />}{l.location.label}</span><span className="font-mono text-xs text-slate-400">{l.expected}</span></div>
      <div className={`mt-0.5 text-[10px] ${l.stale ? 'text-amber-300' : 'text-slate-500'}`}>{l.lastAudited ? `audited ${l.daysSince === 0 ? 'today' : `${l.daysSince}d ago`}${l.lastResult === 'missing' ? ' · missing' : ''}` : 'never audited'}</div>
    </button>)}</div></div>)}
</div>;

const Results = ({ s, big }: { s: AuditSession; big?: boolean }) => <div data-testid="audit-result" className="space-y-3">
  <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${s.missing.length ? 'border-rose-400/50 bg-rose-950/30' : 'border-emerald-400/40 bg-emerald-950/30'}`}>
    {s.missing.length ? <AlertTriangle size={28} className="text-rose-300" /> : <ClipboardCheck size={28} className="text-emerald-300" />}
    <div><div className={`${big ? 'text-2xl' : 'text-lg'} font-semibold text-white`}>{s.locationLabel} — {s.missing.length ? `${s.missing.length} MISSING` : 'clean'}</div><div className="text-xs text-slate-300"><span data-testid="audit-result-matched">{s.matched}/{s.expectedCount} matched</span> · <span data-testid="audit-result-missing">{s.missing.length} missing</span> · <span data-testid="audit-result-unexpected">{s.unexpected.length} unexpected</span> · {s.by} · {fmtTime(s.finishedAt)}{s.pinId && ' · summary pinned to the manager hit list'}</div></div>
  </div>
  {s.missing.length > 0 && <ul className="space-y-2">{s.missing.map((m) => <MissingRow key={m.id} it={m} big={big} />)}</ul>}
  {s.unexpected.length > 0 && <ul className="space-y-2">{s.unexpected.map((u) => <UnexpectedRow key={u.id} u={u} canCorrect={false} big={big} />)}</ul>}
</div>;

// Audit: pick a location → what the system believes is there → scan everything physically present → live ✓ / ? / ⚠ → Finish writes the session
export const AuditPanel = ({ big, onFinished }: { big?: boolean; onFinished?: (s: AuditSession) => void }) => {
  const [locs, setLocs] = useState<AuditLocationStatus[]>([]); const [live, setLive] = useState<AuditLive | null>(api.getAuditLive()); const [done, setDone] = useState<AuditSession | null>(null); const [recent, setRecent] = useState<AuditSession[]>([]); const [open, setOpen] = useState<AuditSession | null>(null);
  const load = () => { void api.getAuditLocations().then(setLocs); void api.getAuditSessions().then(setRecent); };
  useEffect(load, [done]);
  const start = async (k: AuditLocationKey) => { setDone(null); setLive(await api.startAudit(k)); };
  const finish = async () => { const s = await api.finishAudit(); setLive(null); setDone(s); onFinished?.(s); };
  const cancel = async () => { await api.cancelAudit(); setLive(null); };
  if (live) {
    const matchedSet = new Set(live.matched); const remaining = live.expected.filter((e) => !matchedSet.has(e.id)); const pending = live.unexpected.filter((u) => !u.resolution);
    return <div data-testid="audit-live" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4">
        <div className="min-w-0 flex-1"><div className="text-[10px] uppercase tracking-wide text-amber-300">Auditing</div><div data-testid="audit-live-location" className={`${big ? 'text-3xl' : 'text-2xl'} font-semibold text-white`}>{live.location.label}</div><div className="text-xs text-slate-400">System believes <span data-testid="audit-expected-count" className="font-mono text-white">{live.expected.length}</span> part{live.expected.length === 1 ? '' : 's'} here · started {fmtTime(live.startedAt)}</div></div>
        <div className="flex gap-3 text-center">{[['✓', live.matched.length, 'matched', 'text-emerald-300', 'audit-count-matched'], ['?', live.unexpected.length, 'unexpected', 'text-amber-300', 'audit-count-unexpected'], ['⚠', remaining.length, 'not yet seen', 'text-rose-300', 'audit-count-remaining']].map(([g, n, l, c, t]) => <div key={String(t)} data-testid={String(t)} className="rounded-xl bg-black/30 px-3 py-1.5"><div className={`font-mono text-2xl font-bold ${c}`}>{n}</div><div className="text-[10px] text-slate-400">{g} {l}</div></div>)}</div>
        <div className="flex w-full gap-2">
          <ScanInput big={big} testId="audit-scan" placeholder={`Scan everything physically at ${live.location.label}`} onScan={async (code) => { const r = await api.auditScan(code); setLive({ ...r.live }); }} />
        </div>
        <div className="flex w-full flex-wrap gap-2">
          <button data-testid="audit-finish" onClick={() => void finish()} disabled={pending.length > 0} title={pending.length ? 'Resolve every unexpected item first' : undefined} className={`${big ? 'min-h-[56px] px-6 text-lg' : 'min-h-[40px] px-4 text-sm'} rounded-xl bg-amber-400 font-semibold text-[#161b22] disabled:opacity-40`}>Finish audit{remaining.length ? ` · ${remaining.length} missing` : ' · clean'}</button>
          <button data-testid="audit-cancel" onClick={() => void cancel()} className={`${big ? 'min-h-[56px] px-4 text-base' : 'min-h-[40px] px-3 text-sm'} rounded-xl border border-white/15 text-slate-300 hover:bg-white/10`}><X size={14} className="mr-1 inline" /> Abandon</button>
        </div>
      </div>
      {live.unexpected.length > 0 && <section><div className="mb-1.5 text-[10px] uppercase tracking-wide text-amber-300">? Unexpected — scanned here, system thinks elsewhere</div><ul className="space-y-2">{live.unexpected.map((u) => <UnexpectedRow key={u.id} u={u} big={big} canCorrect={live.location.group === 'station'} onResolve={async (r) => { try { setLive({ ...(await api.auditResolve(u.id, r)) }); } catch (e) { window.alert(e instanceof Error ? e.message : 'Failed'); } }} />)}</ul></section>}
      <section><div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-400">Expected here · greys out as items confirm</div>
        <ul data-testid="audit-expected-list" className="divide-y divide-white/5 rounded-xl border border-white/10 bg-[#1f2630]">{live.expected.map((e) => { const ok = matchedSet.has(e.id); return <li key={e.id} data-testid={`audit-expected-${e.id}`} data-matched={ok} className={`flex items-center gap-3 px-3 py-2 transition-opacity ${ok ? 'opacity-40' : ''}`}>{ok ? <Check size={16} className="text-emerald-300" /> : <span className="inline-block h-4 w-4 rounded-full border border-slate-500" />}<Identity it={e} />{ok && <span className="text-xs text-emerald-300">Matched</span>}</li>; })}{!live.expected.length && <li className="px-3 py-5 text-center text-sm text-slate-500">System believes nothing is here — anything you scan will be Unexpected.</li>}</ul></section>
      {live.scans.length > 0 && <ul data-testid="audit-scan-log" className="space-y-1 text-xs">{live.scans.slice(0, 6).map((s, i) => <li key={i} className={`flex items-center gap-2 ${s.result === 'matched' ? 'text-emerald-300' : s.result === 'unexpected' ? 'text-amber-300' : s.result === 'duplicate' ? 'text-slate-400' : 'text-rose-300'}`}><span className="font-mono text-slate-500">{fmtTime(s.at)}</span><span className="font-mono">{s.code}</span><span>· {s.label}</span></li>)}</ul>}
    </div>;
  }
  return <div data-testid="audit-panel" className="space-y-4">
    {done && <Results s={done} big={big} />}
    <div><div className="mb-2 flex items-center justify-between"><h2 className={`${big ? 'text-xl' : 'text-sm'} font-semibold text-white`}>Pick a location to audit</h2><span className="text-xs text-slate-500">amber = not audited in {api.getAuditStaleDays()} days</span></div><LocationPicker locs={locs} onPick={(k) => void start(k)} big={big} /></div>
    <section><div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-400">Recent audits</div>
      <ul data-testid="audit-recent" className="divide-y divide-white/5 rounded-xl border border-white/10 bg-[#1f2630] text-sm">{recent.slice(0, 8).map((s) => <li key={s.id}><button data-testid={`audit-session-${s.id}`} onClick={() => setOpen(open?.id === s.id ? null : s)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5">{s.missing.length ? <AlertTriangle size={14} className="text-rose-300" /> : <ClipboardCheck size={14} className="text-emerald-300" />}<span className="font-medium text-white">{s.locationLabel}</span><span className="text-xs text-slate-400">{s.matched}/{s.expectedCount} matched · {s.missing.length} missing · {s.unexpected.length} unexpected</span><span className="ml-auto text-xs text-slate-500">{s.by} · {fmtDate(s.finishedAt)} {fmtTime(s.finishedAt)}</span></button>{open?.id === s.id && <div className="px-3 pb-3"><Results s={s} /></div>}</li>)}{!recent.length && <li className="px-3 py-5 text-center text-slate-500">No audits yet.</li>}</ul></section>
  </div>;
};

// Scan-to-complete toast: "Band COMPLETE — Rosa ✓ (undo)" with a 10-second undo that reverts everything the scan did
export const CompleteToast = ({ done, onUndone }: { done: { label: string; by: string; token: string; transitioned: boolean } | null; onUndone: () => void }) => {
  const [left, setLeft] = useState(10); const [gone, setGone] = useState(false);
  useEffect(() => { setLeft(Math.round(api.SCAN_UNDO_MS / 1000)); setGone(false); if (!done) return; const i = setInterval(() => setLeft((n) => n - 1), 1000); const t = setTimeout(() => setGone(true), api.SCAN_UNDO_MS); return () => { clearInterval(i); clearTimeout(t); }; }, [done?.token]);
  if (!done || gone) return null;
  return <div data-testid="complete-toast" className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-emerald-400/40 bg-[#0f2a1e] px-5 py-3 text-emerald-100 shadow-2xl">
    <Check size={18} className="text-emerald-300" /><span className="font-semibold">{done.label} COMPLETE — {done.by} ✓</span>{done.transitioned && <span className="text-xs text-emerald-300">· all parts in → testing</span>}
    <button data-testid="complete-undo" onClick={async () => { try { await api.undoScanComplete(done.token); setGone(true); onUndone(); } catch (e) { window.alert(e instanceof Error ? e.message : 'Undo failed'); } }} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm hover:bg-white/20"><RotateCcw size={13} /> undo · {left}s</button>
  </div>;
};

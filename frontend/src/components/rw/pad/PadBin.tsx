import { Archive, CheckCircle2, ChevronDown, ChevronRight, Lock, Moon, ScanLine, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import * as api from '@/api/client';
import * as off from '@/api/offline';
import type { BinRow, BinView } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PART_NAME, PartDot } from '@/components/rw/RwBits';
import { fmtTime } from '@/lib/format';
import { Big, Sheet } from './PadBits';

// JV bin tab — the bin holds custody. Night: SAFE-VC → BIN-JV → ONE count confirm (per-ticket check only on a mismatch). Morning: BIN-JV here = everything inside lands at JV's bench.
// Day: scan a ticket in the bin → hand to Dre / Sam / Nico · scan a ticket out with the team → back in. Fresh tickets enter only at Vienna's safe.
type Say = (m: string, tone?: 'ok' | 'learn' | 'err') => void;
type Action = { label: string; testId: string; onClick: () => void };

const Row = ({ r, action, present, id }: { r: BinRow; action?: Action; present?: boolean; id: string }) => <li data-testid={`${id}-${r.jobId}`} data-state={r.state} data-present={present} className={`flex min-h-[56px] items-center gap-3 rounded-2xl border px-4 py-2 ${present ? 'border-emerald-500/40 bg-emerald-900/20' : 'border-white/10 bg-[#0f131a]'}`}>
  {present === undefined ? <PartDot k={r.key} size={12} /> : present ? <CheckCircle2 size={20} className="text-emerald-300" /> : <TriangleAlert size={20} className="text-slate-500" />}
  <div className="min-w-0 flex-1">
    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-base font-semibold text-white">{r.jobNumber.replace(/^E/, '')}</span><span className="truncate text-sm text-slate-200">{r.clientLastName} · {r.watchLabel}</span>{r.priority !== 'normal' && <span className="rounded bg-rose-500/20 px-1.5 text-[10px] uppercase text-rose-200">{r.priority}</span>}{r.inSafe && <Lock size={11} className="text-amber-300" />}</div>
    <div data-testid={`${id}-sub-${r.jobId}`} className="truncate text-xs text-slate-400">{PART_NAME[r.key]} · {r.state === 'in_bin' ? r.holder : `${r.holder} · ${r.stationLabel}`}{r.since ? ` · since ${fmtTime(r.since)}` : ''}{r.state !== 'in_bin' && r.note ? ` · ${r.note}` : ''}</div>
  </div>
  {action && <button data-testid={action.testId} onClick={action.onClick} className="min-h-[44px] rounded-xl border border-white/20 px-3 text-xs font-semibold text-slate-200 hover:bg-white/10">{action.label}</button>}
</li>;

const Section = ({ title, testId, count, empty, lit, hint, children }: { title: string; testId: string; count: number; empty: string; lit?: boolean; hint?: string; children: React.ReactNode }) => <section data-testid={testId} data-count={count} data-lit={lit} className={`rounded-2xl border p-4 ${lit ? 'border-amber-400/50 bg-amber-950/30' : 'border-white/10 bg-[#1f2630]'}`}>
  <div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-white">{title}</h2><span data-testid={`${testId}-count`} className="rounded-full bg-white/10 px-2 font-mono text-sm text-slate-200">{count}</span>{hint && <span className="text-xs text-slate-400">{hint}</span>}</div>
  <ul className="grid gap-2 lg:grid-cols-2">{children}</ul>
  {!count && <p className="text-sm text-slate-500">{empty}</p>}
</section>;

const BinLog = ({ view }: { view: BinView }) => {
  const [open, setOpen] = useState(false);
  return <section data-testid="bin-log" className="rounded-2xl border border-white/10 bg-[#1f2630] p-4">
    <button data-testid="bin-log-toggle" onClick={() => setOpen(!open)} className="flex min-h-[44px] w-full items-center gap-2 text-left text-sm font-semibold text-slate-200">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Bin log · {view.log.length} events</button>
    {open && <ul className="mt-2 space-y-1 text-xs text-slate-300">{view.log.slice(0, 12).map((e) => <li key={e.id} data-testid={`bin-log-${e.id}`} className="flex gap-2"><span className="w-14 shrink-0 font-mono text-slate-500">{fmtTime(e.at)}</span><span className="w-20 shrink-0 uppercase text-amber-200/80">{e.kind.replace(/_/g, ' ')}</span><span>{e.detail} <span className="text-slate-500">· {e.by}</span></span></li>)}</ul>}
  </section>;
};

export const PadBin = ({ say }: { say: Say }) => {
  const { user } = useAuth();
  const [view, setView] = useState<BinView | null>(null); const [code, setCode] = useState(''); const [armedSafe, setArmedSafe] = useState(false);
  const [confirm, setConfirm] = useState<'count' | 'check' | null>(null); const [present, setPresent] = useState<Set<string>>(new Set()); const [handTo, setHandTo] = useState<BinRow | null>(null);
  const load = useCallback(() => api.getBin().then(setView), []);
  useEffect(() => { void load(); }, [load]);
  if (!view) return null;
  const atBench = view.holder === 'person:JV';
  const scan = async (raw: string) => {
    const v = raw.trim(); if (!v) return; setCode('');
    if (off.isOffline()) { off.enqueueScan({ kind: 'container', station: view.key, code: v, by: user?.shortName }); say(`Offline — ${v} queued, applies on replay`); return; }
    try {
      if (api.isBinSafeCode(v)) { setArmedSafe(true); say(atBench ? `Vienna's safe armed — now scan ${view.code}` : `The bin is already in Vienna's safe — scan ${view.code} here to take it out`); return; }
      if (api.isBinCode(v)) {
        if (!atBench) { const r = await api.binOutOfSafe(); setView(r.view); setArmedSafe(false); say(`Bin out of Vienna's safe → JV's bench · ${r.moved} tickets · custody JV workshop`); return; }
        if (confirm === 'check') { say('Scan the tickets, then Finish', 'err'); return; }
        if (!armedSafe) { say(`Scan the safe first (${view.safeCode}) or tap “Night → Vienna's safe”`, 'err'); return; }
        setConfirm('count'); return;
      }
      const j = await api.findJobByLabel(v.replace(/^BAND-/i, '')); if (!j) { say(`No job matches ${v}`, 'err'); return; }
      const inBin = view.inBin.find((r) => r.jobId === j.id); const out = view.out.find((r) => r.jobId === j.id);
      if (confirm === 'check') { if (inBin) setPresent((s) => new Set(s).add(j.id)); else if (out) { await api.binTakeBack(j.id); await load(); setPresent((s) => new Set(s).add(j.id)); say(`${j.number} was out with ${out.holder} — back in the bin`); } else say(`${j.number} is not expected in the bin`, 'err'); return; }
      if (inBin) { if (!atBench) { say("The bin is in Vienna's safe — take it out first", 'err'); return; } setHandTo(inBin); return; }
      if (out) { const r = await api.binTakeBack(j.id); await load(); say(`${r.jobNumber} back in the bin from ${out.holder}`); return; }
      say(`${j.number} is not in the bin — tickets enter at Vienna's safe (${view.code} at the safe, then the ticket)`, 'err');
    } catch (e) { say(e instanceof Error ? e.message : 'Scan failed', 'err'); }
  };
  const confirmCount = async () => { try { const r = await api.binToSafe(); setView(r.view); setConfirm(null); setArmedSafe(false); say(`Count confirmed · ${r.moved} in the bin → Vienna's safe`); } catch (e) { say(e instanceof Error ? e.message : 'Failed', 'err'); } };
  const finishCheck = async () => { try { const r = await api.binToSafe({ present: [...present] }); setView(r.view); setConfirm(null); setArmedSafe(false); setPresent(new Set()); say(r.missing.length ? `${r.missing.length} MISSING (${r.missing.join(', ')}) — pinned to you and the manager list · ${r.moved} into the safe` : `All ${r.moved} present → Vienna's safe`, r.missing.length ? 'err' : 'ok'); } catch (e) { say(e instanceof Error ? e.message : 'Failed', 'err'); } };
  const doHandTo = async (tech: string) => { if (!handTo) return; try { const r = await api.binHandTo(handTo.jobId, tech); setHandTo(null); await load(); say(`${r.jobNumber} ${PART_NAME[r.key]} → ${tech} · ${r.stationLabel}`); } catch (e) { say(e instanceof Error ? e.message : 'Failed', 'err'); } };
  const backIn = async (r: BinRow) => { try { await api.binTakeBack(r.jobId); await load(); say(`${r.jobNumber} back in the bin from ${r.holder}`); } catch (e) { say(e instanceof Error ? e.message : 'Failed', 'err'); } };
  const scanHint = confirm === 'check' ? 'Checking tickets — scan each one in the bin, or tap Present' : armedSafe ? `Vienna's safe armed · scan ${view.code}` : atBench ? `Scan a ticket → hand to the team / back in · night: ${view.safeCode} then ${view.code}` : `Morning: scan ${view.code} here to take the bin out`;
  return <div data-testid="pad-bin" data-holder={view.holder} className="space-y-4">
    <section data-testid="bin-header" data-night={view.night && view.binDue} className="rounded-2xl border border-white/10 bg-[#1f2630] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Archive size={26} className="text-accent" />
        <div className="min-w-0 flex-1"><div data-testid="bin-holder" className="text-lg font-semibold text-white">{view.label} · {view.holderLabel}</div><div data-testid="bin-counts" className="text-xs text-slate-400">since {fmtTime(view.holderSince)} · {api.binCountLine(view)}{view.pending.length ? ` · ${view.pending.length} assigned, not yet entered` : ''}</div></div>
        {atBench && confirm !== 'check' && <Big testId="bin-night-btn" tone={view.night ? 'primary' : 'quiet'} onClick={() => { setArmedSafe(true); say(`Vienna's safe armed — now scan ${view.code}`); }}><Moon size={18} /> Night → Vienna's safe</Big>}
      </div>
      {view.night && view.binDue && <div data-testid="bin-night-prompt" className="mt-3 flex min-h-[44px] items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-950/40 px-4 text-sm text-amber-100"><Moon size={16} /> End of day — the bin is still out. Scan {view.safeCode} then {view.code} (one count confirm) before you leave.</div>}
      <div className="mt-3 flex items-center gap-2"><ScanLine size={18} className="text-slate-400" /><input data-testid="bin-scan" autoFocus value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void scan(code); }} placeholder={confirm === 'check' ? 'Scan a ticket in the bin' : `Scan a ticket · ${view.safeCode} · ${view.code}`} className="min-h-[52px] flex-1 rounded-2xl border border-white/15 bg-[#0f131a] px-4 text-lg text-white" /><Big testId="bin-scan-go" tone="primary" onClick={() => void scan(code)}>Scan</Big></div>
      <div data-testid="bin-scan-state" data-armed={armedSafe} data-check={confirm === 'check'} className="mt-1 text-xs text-slate-400">{scanHint}</div>
    </section>
    {confirm === 'check' && <section data-testid="bin-check" className="rounded-2xl border border-amber-400/50 bg-amber-950/30 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-white">Check tickets · {present.size}/{view.inBin.length} present</h2><span className="text-xs text-amber-100">Only because the count was off — scan each ticket in the bin or tap Present. Unscanned = MISSING → pinned to you and the manager list.</span></div>
      <ul className="grid gap-2 lg:grid-cols-2">{view.inBin.map((r) => <Row key={r.jobId} id="bin-check-row" r={r} present={present.has(r.jobId)} action={present.has(r.jobId) ? undefined : { label: 'Present', testId: `bin-check-present-${r.jobId}`, onClick: () => setPresent((s) => new Set(s).add(r.jobId)) }} />)}</ul>
      <div className="mt-3 flex gap-2"><Big testId="bin-check-finish" tone="primary" full onClick={() => void finishCheck()}>Finish · {view.inBin.length - present.size} missing → bin into safe</Big><Big testId="bin-check-cancel" tone="quiet" onClick={() => { setConfirm(null); setPresent(new Set()); }}>Cancel</Big></div>
    </section>}
    <Section title="In my bin" testId="bin-list-in" count={view.inBin.length} empty="The bin is empty." hint={atBench ? 'tap Hand to, or scan the ticket' : "in Vienna's safe"}>{view.inBin.map((r) => <Row key={r.jobId} id="bin-in" r={r} action={atBench ? { label: 'Hand to', testId: `bin-handto-open-${r.jobId}`, onClick: () => setHandTo(r) } : undefined} />)}</Section>
    <Section title="Out with team" testId="bin-list-out" count={view.out.length} empty="Nothing out — the whole bin is with you." hint="handed out of the bin · scan the ticket to take it back">{view.out.map((r) => <Row key={r.jobId} id="bin-out" r={r} action={atBench ? { label: 'Back in', testId: `bin-back-${r.jobId}`, onClick: () => void backIn(r) } : undefined} />)}</Section>
    <Section title="Due back to safe" testId="bin-list-due" count={view.dueBack.length + (view.binDue ? 1 : 0)} empty="Everything is locked up." lit={view.night} hint={view.night ? 'after 17:00 — lit' : 'lights up from 17:00'}>
      {view.binDue && <li data-testid="bin-due-bin" className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-amber-400/40 bg-[#0f131a] px-4 py-2"><Archive size={18} className="text-accent" /><div className="min-w-0 flex-1"><div className="text-base font-semibold text-white">JV bin · {view.inBin.length} inside</div><div className="text-xs text-slate-400">at JV's bench since {fmtTime(view.holderSince)} · {view.safeCode} then {view.code}</div></div></li>}
      {view.dueBack.map((r) => <Row key={r.jobId} id="bin-due" r={r} action={atBench ? { label: 'Back in', testId: `bin-due-back-${r.jobId}`, onClick: () => void backIn(r) } : undefined} />)}
    </Section>
    {view.pending.length > 0 && <Section title="Assigned · not yet entered" testId="bin-list-pending" count={view.pending.length} empty="" hint="desk queue — enters by the scan at Vienna's safe">{view.pending.map((r) => <Row key={r.jobId} id="bin-pending" r={r} />)}</Section>}
    <BinLog view={view} />
    {confirm === 'count' && <Sheet testId="bin-confirm-sheet" title="Night → Vienna's safe" sub={`${view.code} scanned at the safe`} onClose={() => setConfirm(null)}>
      <p data-testid="bin-confirm-line" className="text-2xl font-semibold leading-snug text-white">{api.binCountLine(view)} — confirm?</p>
      <p className="mt-2 text-sm text-slate-400">One tap if the count is right: the bin and everything inside lock into Vienna's safe. The {view.out.length} out with the team stay where they are.</p>
      <div className="mt-4 flex flex-col gap-2"><Big testId="bin-confirm-yes" tone="primary" full onClick={() => void confirmCount()}>Confirm · {view.inBin.length} in the bin → safe</Big><Big testId="bin-confirm-no" tone="warn" full onClick={() => { setConfirm('check'); setPresent(new Set()); }}>Something's off → check tickets</Big></div>
    </Sheet>}
    {handTo && <Sheet testId="bin-handto-sheet" title={`${handTo.jobNumber} · ${PART_NAME[handTo.key]}`} sub={`${handTo.clientLastName} · ${handTo.watchLabel} — hand to`} onClose={() => setHandTo(null)}>
      <div className="grid grid-cols-2 gap-2">{view.team.map((t) => <Big key={t} testId={`bin-handto-${t}`} tone="primary" onClick={() => void doHandTo(t)}>{t}</Big>)}</div>
      <p className="mt-3 text-xs text-slate-400">The ticket leaves the bin — custody moves to them, the bin keeps the rest. Scan it again later to take it back.</p>
    </Sheet>}
  </div>;
};

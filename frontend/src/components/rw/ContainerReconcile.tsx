import { Archive, CheckCircle2, Moon, ScanLine, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import * as api from '@/api/client';
import * as off from '@/api/offline';
import type { CustodyItem } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Big } from './pad/PadBits';

// Container reconcile — JV's bin (or any container this user owns): expected = every part in this person's custody; scan the container then each label.
// Unscanned at the end → MISSING → pinned to the owner's and the manager's hitlist. Night prompt from 17:00 local. Every target ≥ 44 pt. Offline → scans queue (kind 'container'), nothing applies locally.
const NIGHT_HOUR = 17;
export const ContainerReconcile = ({ say }: { say: (m: string, tone?: 'ok' | 'err') => void }) => {
  const { user } = useAuth(); const containers = user ? api.containersOwnedBy(user.shortName).filter((c) => c.kind === 'bin') : [];
  const [items, setItems] = useState<CustodyItem[]>([]); const [open, setOpen] = useState(false); const [container, setContainer] = useState<string | null>(null); const [seen, setSeen] = useState<Set<string>>(new Set()); const [code, setCode] = useState(''); const [finished, setFinished] = useState<{ ok: number; missing: number } | null>(null);
  const dismissedKey = `rollisuite.rw.reconcile.dismissed.${new Date().toDateString()}`;
  const night = new Date().getHours() >= NIGHT_HOUR && !localStorage.getItem(dismissedKey);
  useEffect(() => { void api.getCustodyByPerson().then((g) => setItems(g.find((x) => x.tech === user?.shortName)?.items ?? [])); }, [user?.shortName, finished]);
  const expected = useMemo(() => items.filter((i) => i.partStatus !== 'fulfilled'), [items]);
  if (!user || !containers.length) return null;
  const c = containers[0]; const containerCode = `BIN-${user.shortName.toUpperCase()}`;
  const scan = (raw: string) => {
    const v = raw.trim(); if (!v) return; setCode('');
    if (off.isOffline()) { off.enqueueScan({ kind: 'container', station: c.key, code: v, by: user.shortName }); say(`Offline — ${v} queued, applies on replay`); return; }
    if (!container) { if (v.toUpperCase() === containerCode) { setContainer(c.key); say(`${c.label} open — now scan every label inside`); } else say(`Scan the container first (${containerCode})`, 'err'); return; }
    const hit = expected.find((i) => v.toUpperCase().includes(i.jobNumber.replace(/^E/, '').toUpperCase()) || v.toUpperCase() === i.jobNumber.toUpperCase());
    if (!hit) { say(`${v} is not expected in ${c.label}`, 'err'); return; }
    setSeen((s) => new Set(s).add(hit.jobId + hit.key));
  };
  const finish = async () => {
    const missing = expected.filter((i) => !seen.has(i.jobId + i.key));
    for (const m of missing) { await api.pinToHitList({ title: `Reconcile · ${c.label}: MISSING ${m.jobNumber} ${api.PART_LABELS[m.key]} — last held by ${user.shortName}`, assignedTo: { type: 'role', role: 'manager' }, jobId: m.jobId }); await api.pinToHitList({ title: `Find ${m.jobNumber} ${api.PART_LABELS[m.key]} — missing from ${c.label} at night reconcile`, assignedTo: { type: 'user', shortName: user.shortName }, jobId: m.jobId }); }
    localStorage.setItem(dismissedKey, '1'); setFinished({ ok: expected.length - missing.length, missing: missing.length }); say(missing.length ? `${c.label}: ${missing.length} MISSING — pinned to you and the manager list` : `${c.label} reconciled clean · ${expected.length} present`, missing.length ? 'err' : 'ok');
  };
  const reset = () => { setContainer(null); setSeen(new Set()); setFinished(null); };
  return <section data-testid="container-reconcile" data-night={night} className="mb-4 rounded-2xl border border-white/10 bg-[#1f2630] p-4">
    <div className="flex flex-wrap items-center gap-3">
      <Archive size={22} className="text-accent" /><div className="min-w-0 flex-1"><div className="text-lg font-semibold text-white">{c.label} · {expected.length} expected</div><div className="text-xs text-slate-400">Parts in {user.shortName}'s custody. Night reconcile from {NIGHT_HOUR}:00 — scan the container, then every label; anything unscanned is flagged missing.</div></div>
      {!open && <Big testId="reconcile-open" tone={night ? 'primary' : 'quiet'} onClick={() => setOpen(true)}>{night ? <><Moon size={18} /> Night reconcile due</> : 'Reconcile bin'}</Big>}
    </div>
    {night && !open && <div data-testid="reconcile-night-prompt" className="mt-3 flex min-h-[44px] items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-950/40 px-4 text-sm text-amber-100"><Moon size={16} /> End of day — reconcile {c.label} before you leave.<button data-testid="reconcile-night-later" onClick={() => { localStorage.setItem(dismissedKey, '1'); window.location.reload(); }} className="ml-auto min-h-[44px] px-3 text-xs text-amber-200 underline">not tonight</button></div>}
    {open && <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2"><ScanLine size={18} className="text-slate-400" /><input data-testid="reconcile-scan" autoFocus value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') scan(code); }} placeholder={container ? 'Scan a label (est# / job#)' : `Scan the container · ${containerCode}`} className="min-h-[52px] flex-1 rounded-2xl border border-white/15 bg-[#0f131a] px-4 text-lg text-white" /><Big testId="reconcile-scan-go" tone="primary" onClick={() => scan(code)}>Scan</Big></div>
      <div className="text-xs text-slate-400" data-testid="reconcile-status">{container ? <span className="text-accent">{c.label} open</span> : `container not scanned yet (${containerCode})`} · {seen.size}/{expected.length} present</div>
      <ul className="grid gap-2 sm:grid-cols-2">{expected.map((i) => { const ok = seen.has(i.jobId + i.key); return <li key={i.jobId + i.key} data-testid={`reconcile-item-${i.jobId}-${i.key}`} data-seen={ok} className={`flex min-h-[56px] items-center gap-3 rounded-2xl border px-4 py-2 ${ok ? 'border-emerald-500/40 bg-emerald-900/20' : 'border-white/10 bg-[#0f131a]'}`}>{ok ? <CheckCircle2 size={20} className="text-emerald-300" /> : <TriangleAlert size={20} className="text-slate-500" />}<div className="min-w-0 flex-1"><div className="font-mono text-base font-semibold text-white">{i.jobNumber.replace(/^E/, '')}</div><div className="truncate text-xs text-slate-400">{api.PART_LABELS[i.key]} · {i.clientLastName} · {i.stationLabel}</div></div>{!ok && container && <button data-testid={`reconcile-present-${i.jobId}-${i.key}`} onClick={() => setSeen((s) => new Set(s).add(i.jobId + i.key))} className="min-h-[44px] rounded-xl border border-white/20 px-3 text-xs text-slate-200">Present</button>}</li>; })}{!expected.length && <li className="text-sm text-slate-500">Nothing in custody — bin should be empty.</li>}</ul>
      <div className="flex gap-2"><Big testId="reconcile-finish" tone="primary" full disabled={!container} onClick={() => void finish()}>Finish · flag {expected.length - seen.size} missing</Big><Big testId="reconcile-cancel" tone="quiet" onClick={() => { reset(); setOpen(false); }}>Close</Big></div>
      {finished && <div data-testid="reconcile-result" className="rounded-2xl bg-white/5 px-4 py-2 text-sm text-slate-200">{finished.ok} present · {finished.missing} missing{finished.missing ? ' — pinned' : ''}</div>}
    </div>}
  </section>;
};

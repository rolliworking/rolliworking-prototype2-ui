import { Briefcase, Check, ScanLine } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { Client, DeptCode, JobWithRefs, Watch } from '@/api/client';
import { TradePathStrip } from '@/components/jobs/JobBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DeptBadge } from '@/components/ui/Pills';
import { useAsync } from '@/hooks/useAsync';
import { fmtTime } from '@/lib/format';

const DEPTS: DeptCode[] = ['W', 'B', 'P', 'PM'];
type Line = { description: string; unitPrice: string; dept: DeptCode };

// Trade scan-in: trade account → scan/pick the watch → departments + internal lines → job is born IN SERVICE (custody starts; no inspection report, no estimate, no approval)
export default function TradeScanInPage() {
  const { data: accounts } = useAsync(() => api.getTradeAccounts());
  const [accountId, setAccountId] = useState(''); const [watches, setWatches] = useState<Watch[]>([]); const [watchId, setWatchId] = useState(''); const [scan, setScan] = useState('');
  const [newWatch, setNewWatch] = useState({ brand: 'Rolex' as 'Rolex' | 'Tudor', model: '', reference: '', serial: '' }); const [wf, setWf] = useState<DeptCode[]>(['B']);
  const [lines, setLines] = useState<Line[]>([{ description: '', unitPrice: '', dept: 'B' }]); const [note, setNote] = useState(''); const [created, setCreated] = useState<JobWithRefs[]>([]); const [error, setError] = useState<string | null>(null);
  const account: Client | undefined = accounts?.find((c) => c.id === accountId);
  useEffect(() => { if (accountId) void api.getWatchesForClient(accountId).then((ws) => { setWatches(ws); setWatchId(''); }); }, [accountId]);
  const matched = useMemo(() => { const q = scan.trim().toUpperCase(); return q ? watches.find((w) => w.serial.toUpperCase() === q || w.reference.toUpperCase() === q || `${w.reference}/${w.serial}`.toUpperCase() === q) : undefined; }, [scan, watches]);
  useEffect(() => { if (matched) setWatchId(matched.id); }, [matched]);
  const toggle = (d: DeptCode) => setWf((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]));
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null);
    try {
      const j = await api.tradeScanIn({ clientId: accountId, watchId: watchId || undefined, newWatch: !watchId && newWatch.model ? newWatch : undefined, workflow: wf, lines: lines.map((l) => ({ description: l.description, unitPrice: Math.round(Number(l.unitPrice || 0) * 100), dept: l.dept })), note });
      setCreated((c) => [j, ...c]); setWatchId(''); setScan(''); setNewWatch({ brand: 'Rolex', model: '', reference: '', serial: '' }); setLines([{ description: '', unitPrice: '', dept: wf[0] ?? 'B' }]); setNote('');
      void api.getWatchesForClient(accountId).then(setWatches);
    } catch (er) { setError(er instanceof Error ? er.message : 'Scan-in failed'); }
  };
  return <div data-testid="trade-scan-in-page" className="grid grid-cols-[1fr_380px] gap-4">
    <form onSubmit={submit} className="space-y-4">
      <Card title="Trade scan-in" subtitle="B2B / internal work · custody starts on scan · no inspection report, no estimate, no approval — straight to the work queue" testId="trade-scan-in-card">
        <label className="block text-[11px] font-medium uppercase tracking-wide text-ink-500">Trade account</label>
        <div className="mt-1 grid grid-cols-3 gap-2">{(accounts ?? []).map((c) => <button type="button" key={c.id} data-testid={`trade-account-${c.id}`} onClick={() => setAccountId(c.id)} className={`rounded-sm border px-3 py-2 text-left text-[13px] ${accountId === c.id ? 'border-ink bg-ink text-white' : 'border-line hover:bg-canvas'}`}><div className="flex items-center gap-1.5 font-medium"><Briefcase size={12} /> {c.company ?? `${c.firstName} ${c.lastName}`}</div><div className={`text-[11px] ${accountId === c.id ? 'text-white/70' : 'text-ink-500'}`}>{c.internal ? 'Internal · no emails' : 'External · invoice email only'} · manager {c.managerShort ?? '—'}</div></button>)}</div>
        {account && <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wide text-ink-500">Scan watch (serial / ref)</label>
            <div className="relative mt-1"><ScanLine size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" /><input data-testid="trade-scan-input" value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan serial or reference" className="h-9 w-full rounded-sm border border-line bg-canvas pl-8 pr-3 font-mono text-[13px] outline-none focus:border-ink" /></div>
            {scan && <p data-testid="trade-scan-result" className={`mt-1 text-[11px] ${matched ? 'text-moss-700' : 'text-ink-500'}`}>{matched ? `✓ ${matched.brand} ${matched.model} · ${matched.reference}` : 'No match on this account — add it below'}</p>}
            <label className="mt-3 block text-[11px] font-medium uppercase tracking-wide text-ink-500">Or pick from account stock</label>
            <select data-testid="trade-watch-select" value={watchId} onChange={(e) => setWatchId(e.target.value)} className="mt-1 h-9 w-full rounded-sm border border-line bg-canvas px-2 text-[13px]"><option value="">— new watch —</option>{watches.map((w) => <option key={w.id} value={w.id}>{w.brand} {w.model} · {w.reference} · {w.serial}</option>)}</select>
          </div>
          {!watchId && <div className="space-y-1.5">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-ink-500">New watch</label>
            <select data-testid="trade-new-brand" value={newWatch.brand} onChange={(e) => setNewWatch({ ...newWatch, brand: e.target.value as 'Rolex' | 'Tudor' })} className="h-9 w-full rounded-sm border border-line bg-canvas px-2 text-[13px]"><option>Rolex</option><option>Tudor</option></select>
            <input data-testid="trade-new-model" value={newWatch.model} onChange={(e) => setNewWatch({ ...newWatch, model: e.target.value })} placeholder="Model" className="h-9 w-full rounded-sm border border-line bg-canvas px-3 text-[13px]" />
            <input data-testid="trade-new-reference" value={newWatch.reference} onChange={(e) => setNewWatch({ ...newWatch, reference: e.target.value })} placeholder="Reference" className="h-9 w-full rounded-sm border border-line bg-canvas px-3 font-mono text-[13px]" />
            <input data-testid="trade-new-serial" value={newWatch.serial} onChange={(e) => setNewWatch({ ...newWatch, serial: e.target.value })} placeholder="Serial" className="h-9 w-full rounded-sm border border-line bg-canvas px-3 font-mono text-[13px]" />
          </div>}
        </div>}
        {account && <>
          <label className="mt-4 block text-[11px] font-medium uppercase tracking-wide text-ink-500">Departments</label>
          <div className="mt-1 flex gap-2">{DEPTS.map((d) => <button type="button" key={d} data-testid={`trade-dept-${d}`} onClick={() => toggle(d)} className={`rounded-sm border px-3 py-1.5 text-[13px] ${wf.includes(d) ? 'border-ink bg-ink text-white' : 'border-line hover:bg-canvas'}`}><DeptBadge code={d} className={wf.includes(d) ? '!bg-white/20 !text-white' : ''} /></button>)}</div>
          <label className="mt-4 block text-[11px] font-medium uppercase tracking-wide text-ink-500">Work lines (internal pricing)</label>
          <div className="mt-1 space-y-1.5">{lines.map((l, i) => <div key={i} className="grid grid-cols-[1fr_110px_90px] gap-2"><input data-testid={`trade-line-desc-${i}`} value={l.description} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, description: e.target.value } : x)))} placeholder="Description" className="h-9 rounded-sm border border-line bg-canvas px-3 text-[13px]" /><input data-testid={`trade-line-price-${i}`} value={l.unitPrice} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, unitPrice: e.target.value } : x)))} placeholder="$ 0.00" inputMode="decimal" className="h-9 rounded-sm border border-line bg-canvas px-3 text-right font-mono text-[13px]" /><select value={l.dept} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, dept: e.target.value as DeptCode } : x)))} className="h-9 rounded-sm border border-line bg-canvas px-2 text-[13px]">{DEPTS.map((d) => <option key={d}>{d}</option>)}</select></div>)}<button type="button" data-testid="trade-line-add" onClick={() => setLines([...lines, { description: '', unitPrice: '', dept: wf[0] ?? 'B' }])} className="text-xs text-ink-500 hover:text-ink">+ line</button></div>
          <textarea data-testid="trade-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Intake note (optional)" className="mt-3 w-full rounded-sm border border-line bg-canvas px-3 py-2 text-[13px]" />
          {error && <div data-testid="trade-scan-error" className="mt-3 rounded-sm bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{error}</div>}
          <div className="mt-4 flex justify-end"><Button data-testid="trade-scan-submit" variant="primary" type="submit"><ScanLine size={13} /> Scan in → In service</Button></div>
        </>}
      </Card>
    </form>
    <Card title="Scanned in this session" testId="trade-scan-created">
      {created.length === 0 && <p className="text-xs text-ink-500">Nothing yet. The two seeded RolliShop jobs are <Link to="/jobs/j-t1" className="font-mono text-ink underline">E02050</Link> (bracelet restoration, on the bench) and <Link to="/jobs/j-t2" className="font-mono text-ink underline">E02051</Link> (awaiting Walter’s review).</p>}
      <ul className="space-y-3">{created.map((j) => <li key={j.id} data-testid={`trade-created-${j.id}`} className="space-y-1.5 rounded-sm border border-line p-3"><div className="flex items-center gap-2 text-[13px]"><Check size={14} className="text-moss-700" /><Link to={`/jobs/${j.id}`} data-testid={`trade-created-open-${j.id}`} className="font-mono font-semibold text-ink hover:underline">{j.number}</Link><span>{j.watch.brand} {j.watch.model}</span><span className="ml-auto text-[11px] text-ink-500">{fmtTime(j.createdAt)}</span></div><TradePathStrip job={j} testId={`trade-created-path-${j.id}`} /></li>)}</ul>
    </Card>
  </div>;
}

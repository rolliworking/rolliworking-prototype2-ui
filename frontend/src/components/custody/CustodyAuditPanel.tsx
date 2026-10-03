import clsx from 'clsx';
import { Check, CircleDashed, ClipboardCheck, Pause, Play, ScanLine, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as api from '@/api/client';
import * as cu from '@/api/custody';
import type { AuditScanResult, CustodyAudit } from '@/api/custody';
import { Button } from '@/components/ui/Button';
import { fmtDate, fmtTime } from '@/lib/format';

const field = 'h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';
const nodeLabel = (k: string) => (k.startsWith('bin:') ? `Shelf ${k.slice(4)}` : api.custodyBridge.stations().find((s) => s.key === k)?.label ?? k);

const StartForm = ({ onStarted }: { onStarted: (a: CustodyAudit) => void }) => {
  const opts = cu.auditScopeOptionsSync(); const [sel, setSel] = useState(opts[0].key); const [err, setErr] = useState<string | null>(null);
  const start = () => { const o = opts.find((x) => x.key === sel)!; cu.startCustodyAudit(o.kind, o.kind === 'shop' ? undefined : o.key).then(onStarted).catch((e) => setErr(e instanceof Error ? e.message : 'Failed')); };
  return <div data-testid="custody-audit-start" className="flex flex-wrap items-end gap-2 text-xs">
    <label className="text-ink-500">Scope<select data-testid="custody-audit-scope" value={sel} onChange={(e) => setSel(e.target.value)} className={`${field} mt-1 block w-56`}>{opts.map((o) => <option key={o.key} value={o.key}>{o.label} · {o.kind}</option>)}</select></label>
    <Button variant="primary" data-testid="custody-audit-start-btn" onClick={start}><Play size={12} /> Start audit</Button>
    {err && <span data-testid="custody-audit-start-error" className="text-rose-700">{err}</span>}
  </div>;
};

const Progress = ({ id }: { id: string }) => {
  const p = cu.auditProgressSync(id); const closed = cu.getAuditSync(id)?.status === 'closed';
  return <div data-testid="custody-audit-progress" className="grid grid-cols-5 gap-2 text-center text-xs">
    {[['Nodes audited', `${p.nodesClosed} / ${p.nodesTotal}`, 'nodes'], ['Items scanned', String(p.itemsScanned), 'scanned'], ['Expected (open jobs)', String(p.expected), 'expected'], ['Found', String(p.found), 'found'], [closed ? 'Unaccounted' : 'Not yet seen', String(p.unaccounted), 'unaccounted']].map(([l, v, t]) => <div key={t} data-testid={`custody-audit-${t}`} className={clsx('rounded-sm bg-canvas px-2 py-1.5 ring-1 ring-line', t === 'unaccounted' && p.unaccounted > 0 && (closed ? 'bg-rose-50 text-rose-800 ring-rose-200' : 'bg-amber-50 text-amber-800 ring-amber-200'))}><div className="font-mono text-lg font-semibold">{v}</div><div className="text-[10px] uppercase tracking-wide text-ink-500">{l}</div></div>)}
  </div>;
};

const Results = ({ a }: { a: CustodyAudit }) => {
  const rows = cu.getUnaccountedSync().filter((r) => a.result?.unaccounted.includes(r.itemKey)); const stubs = cu.getFoundNoJobSync().filter((s) => a.stubIds.includes(s.id));
  return <div data-testid="custody-audit-result" className="space-y-2 text-xs">
    <div className={clsx('rounded-sm px-3 py-2 font-medium', a.result?.unaccounted.length ? 'bg-rose-50 text-rose-800' : 'bg-moss-50 text-moss-800')}>{a.scope.label} · closed {fmtDate(a.closedAt!)} {fmtTime(a.closedAt!)} by {a.closedBy} · <span data-testid="custody-audit-result-unaccounted">{a.result?.unaccounted.length ?? 0} UNACCOUNTED</span> · <span data-testid="custody-audit-result-found-no-job">{a.result?.foundNoJob.length ?? 0} found, no job</span></div>
    {rows.length > 0 && <ul className="divide-y divide-line/60 rounded-sm border border-rose-200">{rows.map((r) => <li key={r.itemKey} data-testid={`custody-unaccounted-${r.jobId}-${r.part}`} className="flex flex-wrap items-center gap-2 px-2 py-1.5"><span className="font-mono font-semibold">{r.jobNumber}</span><span>{r.partLabel}</span><span className="text-ink-600">{r.client} · {r.watch}</span><span className="text-ink-400">last seen (legacy): {r.legacy}</span><span className="ml-auto font-mono">{r.value === null ? 'unvalued' : `$${r.value.toLocaleString()}`}</span></li>)}</ul>}
    {stubs.length > 0 && <ul className="divide-y divide-line/60 rounded-sm border border-amber-200">{stubs.map((s) => <li key={s.id} data-testid={`custody-stub-${s.id}`} className="flex items-center gap-2 px-2 py-1.5"><span className="font-mono">{s.label}</span>{s.reference && <span>ref {s.reference}</span>}<span className="text-ink-500">found at {s.nodeLabel} · no open job</span></li>)}</ul>}
  </div>;
};

// Live audit: pick / scan the node → scan every item → ✓ close node → … → Close audit. Pause / resume keeps the session; several people can run several sessions.
const Live = ({ a, onChange }: { a: CustodyAudit; onChange: (a: CustodyAudit) => void }) => {
  const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null); const [unknown, setUnknown] = useState<string | null>(null); const [ref, setRef] = useState(''); const [serial, setSerial] = useState('');
  const [code, setCode] = useState(''); const input = useRef<HTMLInputElement>(null);
  const oops = (e: unknown) => { setErr(e instanceof Error ? e.message : 'Failed'); setMsg(null); };
  const refresh = () => onChange(cu.getAuditSync(a.id)!);
  const scan = () => { const c = code.trim(); if (!c) return; setCode(''); cu.custodyAuditScan(a.id, c).then((r: AuditScanResult) => { setErr(null); setUnknown(null); if (r.kind === 'node') setMsg(`Node → ${r.label}. Scan every item here.`); else if (r.kind === 'bin') setMsg(`Bin ${r.bin} recorded at ${nodeLabel(r.node)} — items scanned next ride in it`); else if (r.kind === 'item') setMsg(`${r.event.jobNumber} · ${api.custodyBridge.partLabel(r.event.part!)} → custody at ${r.event.nodeLabel}${r.event.binLabel ? ` · ${r.event.binLabel}` : ''} (source = audit)${r.moved ? ' · position corrected' : ''}${r.duplicate ? ' · already scanned' : ''}`); else { setUnknown(r.code); setMsg(null); } refresh(); }).catch(oops).finally(() => input.current?.focus()); };
  const stub = () => cu.custodyAuditStub(a.id, unknown!, { reference: ref, serial }).then((s) => { setMsg(`Item stub ${s.label} created at ${s.nodeLabel} — on the review list`); setUnknown(null); setRef(''); setSerial(''); refresh(); }).catch(oops);
  const p = cu.auditProgressSync(a.id);
  return <div data-testid="custody-audit-live" data-status={a.status} data-node={a.currentNode ?? ''} className="space-y-3">
    <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-sm bg-ink px-2 py-0.5 font-semibold uppercase tracking-wide text-white">{a.status === 'paused' ? 'Paused' : 'Auditing'}</span><span className="font-semibold text-ink">{a.scope.label}</span><span className="text-ink-500">· {a.by} · started {fmtTime(a.startedAt)}</span>
      <span className="ml-auto flex gap-1.5">{a.status === 'paused' ? <Button size="sm" data-testid="custody-audit-resume" onClick={() => cu.resumeCustodyAudit(a.id).then(onChange).catch(oops)}><Play size={12} /> Resume</Button> : <Button size="sm" data-testid="custody-audit-pause" onClick={() => cu.pauseCustodyAudit(a.id).then(onChange).catch(oops)}><Pause size={12} /> Pause</Button>}<Button size="sm" variant="primary" data-testid="custody-audit-close" onClick={() => cu.closeCustodyAudit(a.id).then(onChange).catch(oops)}><Square size={12} /> Close audit{p.unaccounted ? ` · ${p.unaccounted} not yet seen` : ''}</Button></span></div>
    <Progress id={a.id} />
    <div className="grid grid-cols-[280px_1fr] gap-3">
      <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Nodes in scope · tap the one you are at</div>
        <ul data-testid="custody-audit-nodes" className="space-y-1 text-xs">{p.byNode.map((n) => <li key={n.key}><button type="button" data-testid={`custody-audit-node-${n.key}`} data-status={n.status} aria-pressed={a.currentNode === n.key} disabled={a.status === 'paused'} onClick={() => cu.auditPickNode(a.id, n.key).then((x) => { onChange(x); setMsg(`Node → ${n.label}`); setErr(null); input.current?.focus(); }).catch(oops)} className={clsx('flex w-full items-center gap-2 rounded-sm border px-2 py-1.5 text-left disabled:opacity-50', a.currentNode === n.key ? 'border-ink bg-ink text-white' : n.status === 'closed' ? 'border-moss-200 bg-moss-50 text-moss-800' : 'border-line bg-surface hover:bg-canvas')}>{n.status === 'closed' ? <Check size={12} /> : <CircleDashed size={12} className={a.currentNode === n.key ? 'text-white' : 'text-ink-400'} />}<span className="flex-1 truncate">{n.label}</span><span className="font-mono text-[10px] opacity-70">{n.scanned}/{n.expected}</span></button></li>)}</ul></div>
      <div className="space-y-2">
        <div data-testid="custody-audit-current" className="rounded-sm border border-line bg-canvas px-3 py-2 text-xs">{a.currentNode ? <>At <b>{nodeLabel(a.currentNode)}</b>{a.currentBin && <> · bin <b data-testid="custody-audit-current-bin">{a.currentBin}</b></>} · {a.nodes[a.currentNode]?.scanned.length ?? 0} scanned here</> : 'No node selected — scan a node label (station key / shelf bin) or tap one on the left.'}</div>
        <div className="flex gap-2"><input ref={input} data-testid="custody-audit-scan" autoFocus value={code} disabled={a.status === 'paused'} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && scan()} placeholder={a.currentNode ? 'Scan item label (E0xxxx · BAND-E0xxxx · REF/SERIAL) or a bin label (BIN-04)' : 'Scan node label first (e.g. wm_bench_3, BIN-04)'} className={`${field} block w-full font-mono`} /><Button data-testid="custody-audit-scan-go" disabled={!code.trim() || a.status === 'paused'} onClick={scan}><ScanLine size={12} /> Scan</Button>{a.currentNode && <Button data-testid="custody-audit-close-node" onClick={() => cu.closeAuditNode(a.id).then((x) => { onChange(x); setMsg('Node closed ✓'); }).catch(oops)}><Check size={12} /> Node done</Button>}</div>
        {msg && <div data-testid="custody-audit-msg" className="rounded-sm bg-moss-50 px-2 py-1 text-xs text-moss-800">{msg}</div>}
        {err && <div data-testid="custody-audit-error" className="rounded-sm bg-rose-50 px-2 py-1 text-xs text-rose-700">{err}</div>}
        {unknown && <div data-testid="custody-audit-unknown" className="rounded-sm border border-amber-300 bg-amber-50 p-2 text-xs"><div className="font-semibold text-amber-900">“{unknown}” is not in the system</div><div className="mt-1 flex flex-wrap items-end gap-2"><label className="text-ink-500">Ref on label<input data-testid="custody-stub-ref" value={ref} onChange={(e) => setRef(e.target.value)} className={`${field} mt-1 block w-28`} /></label><label className="text-ink-500">Serial on label<input data-testid="custody-stub-serial" value={serial} onChange={(e) => setSerial(e.target.value)} className={`${field} mt-1 block w-32`} /></label><Button size="sm" variant="primary" data-testid="custody-stub-create" onClick={stub}>Create item stub · continue</Button><Button size="sm" data-testid="custody-stub-skip" onClick={() => setUnknown(null)}><X size={12} /> Skip</Button></div></div>}
        {a.currentNode && <ul data-testid="custody-audit-node-items" className="space-y-0.5 text-[11px] text-ink-600">{(a.nodes[a.currentNode]?.scanned ?? []).map((k) => { const [jid, part] = k.split(':'); const j = api.custodyBridge.allJobs().find((x) => x.id === jid); return <li key={k} data-testid={`custody-audit-scanned-${jid}-${part}`} className="inline-flex items-center gap-1"><Check size={10} className="text-moss-700" /> {j?.number ?? jid} · {api.custodyBridge.partLabel(part as 'head')}</li>; })}</ul>}
      </div>
    </div>
  </div>;
};

export const CustodyAuditPanel = () => {
  const [audits, setAudits] = useState<CustodyAudit[]>(cu.getAuditsSync()); const [sel, setSel] = useState<string | null>(audits.find((a) => a.status !== 'closed')?.id ?? null);
  useEffect(() => { const h = () => setAudits(cu.getAuditsSync()); window.addEventListener(cu.CUSTODY_EVENT, h); return () => window.removeEventListener(cu.CUSTODY_EVENT, h); }, []);
  const cur = audits.find((a) => a.id === sel) ?? null; const onChange = (a: CustodyAudit) => { setAudits(cu.getAuditsSync()); setSel(a.id); };
  return <div data-testid="custody-audit-panel" className="space-y-4">
    <StartForm onStarted={onChange} />
    <ul data-testid="custody-audit-sessions" className="divide-y divide-line/60 rounded-sm border border-line text-xs">{audits.map((a) => <li key={a.id}><button type="button" data-testid={`custody-audit-session-${a.id}`} data-status={a.status} onClick={() => setSel(a.id)} className={clsx('flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-canvas', sel === a.id && 'bg-canvas')}>{a.status === 'closed' ? <ClipboardCheck size={12} className="text-moss-700" /> : a.status === 'paused' ? <Pause size={12} className="text-amber-700" /> : <Play size={12} className="text-brand" />}<span className="font-medium text-ink">{a.scope.label}</span><span className="text-ink-500">· {a.by} · {fmtDate(a.startedAt)} {fmtTime(a.startedAt)}</span><span className="ml-auto uppercase tracking-wide text-ink-400">{a.status}</span>{a.result && <span className={clsx('rounded-sm px-1.5', a.result.unaccounted.length ? 'bg-rose-50 text-rose-700' : 'bg-moss-50 text-moss-800')}>{a.result.unaccounted.length} unaccounted</span>}</button></li>)}{!audits.length && <li className="px-2 py-3 text-ink-400">No audits yet — start one above.</li>}</ul>
    {cur && (cur.status === 'closed' ? <Results a={cur} /> : <Live a={cur} onChange={onChange} />)}
  </div>;
};

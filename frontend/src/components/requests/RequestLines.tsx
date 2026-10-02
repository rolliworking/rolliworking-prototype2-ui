import clsx from 'clsx';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { RequestRow } from '@/api/client';
import * as rb from '@/api/requestBuilder';
import { fmtMoney } from '@/lib/format';

const OUTCOME: Record<string, { label: string; cls: string }> = { quoted: { label: 'Auto-quoted', cls: 'bg-moss-50 text-moss-800 ring-moss-200' }, queued: { label: 'Estimate queued', cls: 'bg-amber-50 text-amber-900 ring-amber-200' }, draft: { label: 'Draft estimate', cls: 'bg-canvas text-ink-700 ring-line' } };
export const OutcomePill = ({ r, testId }: { r: Pick<RequestRow, 'builder'>; testId: string }) => (r.builder ? <span data-testid={testId} data-outcome={r.builder.outcome} className={clsx('whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ring-1', OUTCOME[r.builder.outcome].cls)}>{OUTCOME[r.builder.outcome].label}{r.builder.outcome === 'queued' && r.builder.unresolved.length ? ' · needs rates' : ''}</span> : null);

// Structured lines on a request (Requests page sheet + Client 360): quote key · bracelet · group · polish # · pre-approvals · waivers · LIVE rate (re-resolved every render, so a rate added in Setup lights the line up).
export const RequestLines = ({ r, compact }: { r: RequestRow; compact?: boolean }) => {
  const lines = r.lines ?? []; if (!lines.length) return null;
  const groups = rb.groupLabels(lines); const est = r.estimateId ? api.estimateByIdSync(r.estimateId) : undefined;
  return <section data-testid="request-lines" data-count={lines.length} className="rounded-md border border-line bg-surface p-3 text-xs">
    <div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Lines · {lines.length}</span><OutcomePill r={r} testId="request-outcome" />{r.builder?.shipment && <span data-testid="request-shipment" className="text-ink-500">Shipment · {r.builder.shipment.pieces} piece{r.builder.shipment.pieces === 1 ? '' : 's'}{r.builder.shipment.tracking ? ` · ${r.builder.shipment.tracking}` : ''}{r.builder.shipment.poNumber ? ` · PO ${r.builder.shipment.poNumber}` : ''}</span>}{est && <Link to={`/estimates/${est.id}`} data-testid="request-lines-estimate" className="ml-auto rounded-sm bg-moss-50 px-1.5 py-0.5 font-mono text-[11px] text-moss-700 hover:underline">{est.number} · {est.status} · {fmtMoney(est.total)} →</Link>}</div>
    <ul className="mt-2 divide-y divide-line/70">{lines.map((l) => { const live = api.liveRateSync(l); return <li key={l.id} data-testid={`request-line-${l.id}`} data-key={l.quoteKey} data-rate={live ? 'yes' : 'no'} className="grid gap-x-3 gap-y-1 py-2 md:grid-cols-[auto_1fr_auto]">
      <div className="flex items-start gap-1.5"><span className={clsx('rounded-sm px-1 py-0.5 text-[9px] font-bold uppercase', l.kind === 'band' ? 'bg-amber-100 text-amber-900' : 'bg-ink text-white')}>{l.kind}</span>{groups[l.id] && <span data-testid={`request-line-group-${l.id}`} className="rounded-sm bg-canvas px-1 py-0.5 font-mono text-[10px] font-semibold ring-1 ring-line">{groups[l.id]}</span>}</div>
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span data-testid={`request-line-key-${l.id}`} className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">{l.quoteKey}</span><span className="text-ink-700">{api.builderLineDescription(l)}</span></div>
        {!compact && <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-ink-500">{l.polishNumber && <span>Polish #<b className="font-mono">{l.polishNumber}</b></span>}{l.preApprovals?.length ? <span data-testid={`request-line-pre-${l.id}`}>Pre-approved: {l.preApprovals.join(' · ')}</span> : null}{l.waivers?.length ? <span data-testid={`request-line-waivers-${l.id}`} className="text-rose-700">Waivers: {l.waivers.join(' · ')}</span> : null}{l.notes && <span>“{l.notes}”</span>}</div>}</div>
      <div data-testid={`request-line-rate-${l.id}`} data-state={live ? 'rate' : 'none'} className="text-right">{live ? <><b className="text-ink">{rb.rateLabel(live)}</b><div className="text-[10px] text-ink-400">~{live.days} d · {live.key}</div></> : <><span className="text-amber-800">No rate</span><div><Link to={`/setup/rate-card?key=${encodeURIComponent(l.quoteKey)}`} data-testid={`request-line-add-rate-${l.id}`} className="text-[10px] font-medium text-brand hover:underline">Add rate for this key →</Link></div></>}</div>
    </li>; })}</ul>
  </section>;
};

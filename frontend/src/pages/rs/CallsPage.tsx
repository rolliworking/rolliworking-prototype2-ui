import { PhoneCall, PhoneMissed } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { CallDisposition, CallEvent } from '@/api/client';
import * as calls from '@/api/calls';
import type { CallFilter } from '@/api/calls';
import { CallRow } from '@/components/clients/CallLedger';
import { SimulateIncomingPanel } from '@/components/layout/CallPop';
import { MissedCallsPanel } from '@/components/layout/MissedCallsPanel';
import { PageHeader } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const Kpi = ({ label, value, tone, testId }: { label: string; value: string | number; tone?: 'warn'; testId: string }) => <div data-testid={testId} className="rounded-md border border-line bg-surface px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{label}</div><div className={`tabular text-xl font-semibold ${tone === 'warn' ? 'text-rose-700' : 'text-ink'}`}>{value}</div></div>;
const sel = 'h-7 rounded-sm border border-line bg-canvas px-1.5 text-xs';

// Global Calls list (manager tier) — every call in and out across the shop; missed-call badge lives on the sidebar entry
export default function CallsPage() {
  const [rows, setRows] = useState<CallEvent[]>([]); const [f, setF] = useState<CallFilter>({}); const [q, setQ] = useState('');
  const load = useCallback(() => calls.getCallEvents({ ...f, q }).then(setRows), [f, q]);
  useEffect(() => { void load(); return calls.subscribeCalls(() => void load()); }, [load]);
  const all = calls.callCountsSync(); const today = new Date().toISOString().slice(0, 10); const todays = rows.filter((c) => c.at.slice(0, 10) === today);
  const answered = rows.filter((c) => c.durationSec); const avg = answered.length ? Math.round(answered.reduce((t, c) => t + (c.durationSec ?? 0), 0) / answered.length) : 0;
  const staff = Array.from(new Set([...api.getDivisionStaff('rolliworks'), ...api.getDivisionStaff('rollishop')].map((u) => u.shortName)));
  return <div data-testid="calls-page" className="space-y-4">
    <PageHeader title="Calls" subtitle="Vonage call log — one row per call: time · direction · number · client · answered by · duration · disposition · note · recording (Vonage-hosted). Internal only." testId="calls-header" />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Kpi label="Calls today" value={todays.length} testId="calls-kpi-today" /><Kpi label="Missed · open" value={all.openMissed} tone={all.openMissed ? 'warn' : undefined} testId="calls-kpi-missed" /><Kpi label="This month" value={all.thisMonth} testId="calls-kpi-month" /><Kpi label="Avg duration" value={avg ? `${Math.floor(avg / 60)}:${String(avg % 60).padStart(2, '0')}` : '—'} testId="calls-kpi-avg" />
    </div>
    <SimulateIncomingPanel />
    <Card title="Missed calls — front-desk queue" subtitle="Also an inbox item for the concierge role; cleared by a call back or a note" testId="calls-missed-card"><MissedCallsPanel /><div data-testid="calls-missed-empty" className="text-xs text-ink-400">{all.openMissed === 0 ? 'Nothing waiting.' : ''}</div></Card>
    <Card title="All calls" subtitle={`${rows.length} shown`} testId="calls-list-card" action={<div className="flex flex-wrap items-center gap-1.5">
      <input data-testid="calls-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client or number…" className={`${sel} w-44`} />
      <select data-testid="calls-filter-direction" value={f.direction ?? ''} onChange={(e) => setF({ ...f, direction: (e.target.value || undefined) as CallFilter['direction'] })} className={sel}><option value="">In + out</option><option value="in">Inbound</option><option value="out">Outbound</option></select>
      <select data-testid="calls-filter-disposition" value={f.disposition ?? ''} onChange={(e) => setF({ ...f, disposition: (e.target.value || undefined) as CallDisposition | undefined })} className={sel}><option value="">Any disposition</option>{calls.DISPOSITIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select>
      <select data-testid="calls-filter-staff" value={f.staff ?? ''} onChange={(e) => setF({ ...f, staff: e.target.value || undefined })} className={sel}><option value="">Anyone</option>{staff.map((s) => <option key={s}>{s}</option>)}</select>
      <input type="date" data-testid="calls-filter-from" value={f.from?.slice(0, 10) ?? ''} onChange={(e) => setF({ ...f, from: e.target.value || undefined })} className={sel} />
      <label className="inline-flex items-center gap-1 text-xs text-ink-600"><input type="checkbox" data-testid="calls-filter-missed" checked={!!f.missedOnly} onChange={(e) => setF({ ...f, missedOnly: e.target.checked || undefined })} /> <PhoneMissed size={12} className="text-rose-600" /> missed only</label>
    </div>}>
      <ul data-testid="calls-list" className="divide-y divide-line">{rows.map((c) => <CallRow key={c.id} c={c} onChange={() => void load()} showClient testId={`calls-row-${c.id}`} />)}{!rows.length && <li className="py-6 text-center text-xs text-ink-400"><PhoneCall size={14} className="mx-auto mb-1 text-ink-300" />No calls match.</li>}</ul>
    </Card>
  </div>;
}

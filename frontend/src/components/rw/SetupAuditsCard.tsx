import { AlertTriangle, ClipboardCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { AuditLocationStatus, AuditSession } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtTime } from '@/lib/format';

// Setup → Audits: append-only session history + the stale-threshold setting (N days, default 7) that drives the amber floor chips
export const SetupAuditsCard = () => {
  const [sessions, setSessions] = useState<AuditSession[]>([]); const [locs, setLocs] = useState<AuditLocationStatus[]>([]); const [days, setDays] = useState(String(api.getAuditStaleDays())); const [saved, setSaved] = useState<string | null>(null);
  const load = useCallback(() => Promise.all([api.getAuditSessions().then(setSessions), api.getAuditLocations().then(setLocs)]).then(() => undefined), []);
  useEffect(() => { void load(); }, [load]);
  const stale = locs.filter((l) => l.stale && l.expected > 0);
  return <Card title="Stage / bin audits" subtitle="Append-only sessions from the Station Scanner and Supervisor Pad · a missing result pins a summary to the manager hit list" testId="setup-audits-card">
    <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
      <form className="flex items-center gap-2" onSubmit={async (e) => { e.preventDefault(); try { const n = await api.setAuditStaleDays(Number(days)); setSaved(`Amber after ${n} days`); await load(); } catch (er) { setSaved(er instanceof Error ? er.message : 'Failed'); } window.setTimeout(() => setSaved(null), 2500); }}>
        <span className="text-ink-500">Amber when not audited in</span><input data-testid="audit-stale-days" value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" className="h-7 w-14 rounded-sm border border-line bg-canvas px-2 text-center font-mono text-[13px]" /><span className="text-ink-500">days</span><button data-testid="audit-stale-days-save" className="h-7 rounded-sm border border-line px-2.5 font-medium hover:bg-canvas">Save</button>{saved && <span data-testid="audit-stale-days-saved" className="text-moss-700">{saved}</span>}
      </form>
      <span data-testid="audit-stale-summary" className="ml-auto inline-flex items-center gap-1 text-ink-500"><AlertTriangle size={12} className={stale.length ? 'text-amber-600' : 'text-ink-300'} /> {stale.length} location{stale.length === 1 ? '' : 's'} overdue for audit · run one from <Link to="/rw/station" className="underline">Station Scan → Audit</Link></span>
    </div>
    <Table>
      <thead><tr><Th>Location</Th><Th>When</Th><Th>By</Th><Th className="text-right">Matched</Th><Th className="text-right">Missing</Th><Th className="text-right">Unexpected</Th><Th>Resolution</Th></tr></thead>
      <tbody>{sessions.map((s) => <tr key={s.id} data-testid={`setup-audit-${s.id}`} className={s.missing.length ? 'bg-rose-50/40' : undefined}>
        <Td><span className="inline-flex items-center gap-1.5 font-medium">{s.missing.length ? <AlertTriangle size={12} className="text-rose-600" /> : <ClipboardCheck size={12} className="text-moss-700" />}{s.locationLabel}</span></Td><Td className="text-ink-500">{fmtDate(s.finishedAt)} {fmtTime(s.finishedAt)}</Td><Td>{s.by}</Td>
        <Td className="text-right font-mono">{s.matched}/{s.expectedCount}</Td><Td className={`text-right font-mono ${s.missing.length ? 'font-semibold text-rose-700' : ''}`}>{s.missing.length}</Td><Td className="text-right font-mono">{s.unexpected.length}</Td>
        <Td className="text-[11px] text-ink-500">{[...s.missing.map((m) => `⚠ ${m.jobNumber} ${m.partLabel.toLowerCase()}${m.lastCustody ? ` · last ${m.lastCustody.by}` : ''}`), ...s.unexpected.map((u) => `? ${u.jobNumber} ${u.partLabel.toLowerCase()} · ${u.resolution === 'corrected' ? 'corrected' : 'investigate'}`)].join(' · ') || 'clean'}</Td>
      </tr>)}{!sessions.length && <tr><Td colSpan={7} className="text-center text-ink-500">No audits yet.</Td></tr>}</tbody>
    </Table>
  </Card>;
};

import { Lock, ScanLine, ShieldAlert, Unlock } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { SalesOrderWithRefs } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';

// Header badge — how the customer on this order was identified
export const ClientResolutionBadge = ({ order }: { order: SalesOrderWithRefs }) => {
  const r = order.clientResolution; if (!r) return null;
  const gate = api.soScanGate(order);
  const tone = r.via === 'scan' ? 'bg-moss-50 text-moss-700' : r.via === 'linked' ? 'bg-canvas text-ink-700' : r.override ? 'bg-amber-50 text-amber-900' : 'bg-rose-50 text-rose-700';
  const label = r.via === 'scan' ? 'Customer scan-confirmed' : r.via === 'linked' ? 'Customer linked by ID' : r.override ? `Name-picked · manager override (${r.override.by})` : 'Name-picked · invoice locked';
  return <span data-testid="so-client-resolution" data-via={r.via} data-locked={gate.locked} title={r.detail} className={`inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-[11px] font-semibold ${tone}`}>{gate.locked ? <Lock size={11} /> : r.via === 'scan' ? <ScanLine size={11} /> : r.override ? <ShieldAlert size={11} /> : <Unlock size={11} />}{label}</span>;
};

// Shown only while the gate is locked: scan to confirm (preferred) or manager override with a logged reason
export const ScanGateCard = ({ order, onDone, onError }: { order: SalesOrderWithRefs; onDone: (msg: string) => Promise<void> | void; onError: (m: string) => void }) => {
  const { user } = useAuth(); const [q, setQ] = useState(''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const gate = api.soScanGate(order); if (!gate.locked) return null;
  const isManager = user?.accessTier === 'manager';
  const scan = async () => { if (!q.trim()) return; setBusy(true); try { await api.confirmSoClientByScan(order.id, q); setQ(''); await onDone('Customer scan-confirmed — invoice unlocked'); } catch (e) { onError(e instanceof Error ? e.message : 'Scan failed'); } finally { setBusy(false); } };
  const override = async () => { setBusy(true); try { await api.overrideSoScanGate(order.id, reason); await onDone('Scan gate overridden — logged on the order'); } catch (e) { onError(e instanceof Error ? e.message : 'Override failed'); } finally { setBusy(false); } };
  return <div data-testid="so-scan-gate" className="rounded-md border-2 border-rose-300 bg-rose-50/60 p-3">
    <div className="flex items-start gap-2"><Lock size={16} className="mt-0.5 shrink-0 text-rose-700" /><div className="min-w-0 flex-1">
      <div className="text-[13px] font-semibold text-rose-900">Invoice locked — customer was picked by name, not scan</div>
      <p className="mt-0.5 text-xs text-rose-800/90">{order.clientResolution?.detail} · by {order.clientResolution?.by}. Two customers can share a name; a label scan resolves by ID. Scan the job label for <span className="font-medium">{order.client.firstName} {order.client.lastName}</span> to confirm, or a manager can override with a reason.</p>
      <div className="mt-2.5 flex flex-wrap items-end gap-3">
        <label className="block text-[11px] font-medium text-ink-700"><span className="inline-flex items-center gap-1"><ScanLine size={12} /> Scan job label · or enter job / estimate #</span>
          <div className="mt-1 flex items-center gap-1.5"><input data-testid="so-gate-scan" value={q} disabled={busy} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void scan(); } }} placeholder="E02060 · PDF417 · REF-SERIAL" autoComplete="off" className="h-9 w-72 rounded-sm border border-line bg-surface px-2.5 font-mono text-[13px] focus:border-ink focus:outline-none" /><Button size="sm" data-testid="so-gate-scan-go" disabled={busy || !q.trim()} onClick={() => void scan()}>Confirm</Button></div></label>
        <div className="ml-auto text-[11px]">
          {isManager ? <div data-testid="so-gate-override" className="rounded-sm border border-amber-300 bg-amber-50 p-2">
            <div className="mb-1 inline-flex items-center gap-1 font-semibold text-amber-900"><ShieldAlert size={12} /> Manager override · label lost / damaged / unscannable</div>
            <div className="flex items-center gap-1.5"><input data-testid="so-gate-override-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required, logged)" className="h-8 w-72 rounded-sm border border-amber-300 bg-surface px-2 text-[12px] focus:border-ink focus:outline-none" /><Button size="sm" variant="secondary" data-testid="so-gate-override-go" disabled={busy || !reason.trim()} onClick={() => void override()}>Override</Button></div>
          </div> : <span data-testid="so-gate-ask-manager" className="inline-flex items-center gap-1 text-ink-500"><ShieldAlert size={12} /> No label? Ask a manager to override (logged).</span>}
        </div>
      </div>
    </div></div>
  </div>;
};

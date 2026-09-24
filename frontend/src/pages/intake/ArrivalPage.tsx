import { ArrowRight, Check, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { Carrier, PackageWithRefs } from '@/api/client';
import { ScanInput, Stamp } from '@/components/intake/IntakeBits';
import { useIntakeCounts } from '@/components/intake/IntakeLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { useAsync } from '@/hooks/useAsync';
import { fmtTime, fullName } from '@/lib/format';

export default function ArrivalPage() {
  const { data: packages, reload } = useAsync(() => api.getPackages());
  const { data: clients } = useAsync(() => api.getClients());
  const { refreshCounts } = useIntakeCounts();
  const [signature, setSignature] = useState(true);
  const [carrier, setCarrier] = useState<Carrier | 'auto'>('auto');
  const [walkInClient, setWalkInClient] = useState('unknown');
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const after = (pkg: PackageWithRefs, msg: string) => {
    setFlash(`${pkg.subNumber} · ${msg}`);
    setError(null);
    reload();
    refreshCounts();
    setTimeout(() => setFlash(null), 3500);
  };

  const scan = async (tracking: string) => {
    try {
      const pkg = await api.logArrival({ source: 'carrier', trackingNumber: tracking, carrier: carrier === 'auto' ? undefined : carrier, signatureNoted: signature });
      after(pkg, `logged from ${pkg.carrier}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log package');
    }
  };

  const walkIn = async () => {
    const pkg = await api.logArrival({ source: 'walk_in', signatureNoted: false, clientId: walkInClient === 'unknown' ? undefined : walkInClient });
    after(pkg, 'walk-in logged');
  };

  const arrived = (packages ?? []).filter((p) => p.status === 'arrived');

  return (
    <div data-testid="arrival-page" className="grid grid-cols-[380px_1fr] gap-4">
      <div className="space-y-4">
        <Card title="Scan package" subtitle="Seconds-fast as packages hit the door" testId="arrival-scan-card">
          <ScanInput label="Tracking number" testId="arrival-tracking-input" onScan={scan} error={error} placeholder="Scan tracking… then Enter" />
          <div className="mt-3 flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-ink-700">
              <input type="checkbox" data-testid="arrival-signature" checked={signature} onChange={(e) => setSignature(e.target.checked)} className="accent-ink" />
              Signature given to carrier
            </label>
            <select data-testid="arrival-carrier" value={carrier} onChange={(e) => setCarrier(e.target.value as Carrier | 'auto')} className="ml-auto h-7 rounded-sm border border-line bg-canvas px-1.5 text-xs">
              <option value="auto">Carrier: auto-detect</option>
              {api.CARRIERS.filter((c) => c !== 'Hand delivery').map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {flash && (
            <div data-testid="arrival-flash" className="mt-3 flex items-center gap-1.5 rounded-sm bg-moss-50 px-2.5 py-1.5 text-xs font-medium text-moss-700 animate-rise">
              <Check size={12} strokeWidth={3} /> {flash}
            </div>
          )}
        </Card>

        <Card title="Walk-in" subtitle="Known client or unknown — creates a Sub# record" testId="arrival-walkin-card">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <UserRound size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" />
              <select data-testid="walkin-client" value={walkInClient} onChange={(e) => setWalkInClient(e.target.value)} className="h-8 w-full rounded-sm border border-line bg-canvas pl-7 pr-2 text-[13px]">
                <option value="unknown">Unknown client</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{fullName(c)}</option>
                ))}
              </select>
            </div>
            <Button variant="primary" size="md" data-testid="walkin-submit" onClick={walkIn}>Log walk-in</Button>
          </div>
        </Card>
      </div>

      <Card title="Shelf — arrived today" subtitle={`${arrived.length} awaiting processing`} bodyClassName="p-0" testId="arrival-list-card">
        <Table testId="arrival-table">
          <thead>
            <tr><Th>Sub#</Th><Th>Via</Th><Th>Tracking</Th><Th>Client</Th><Th>Status</Th><Th>Logged</Th><Th /></tr>
          </thead>
          <tbody>
            {arrived.map((p) => (
              <tr key={p.id} data-testid={`arrival-row-${p.id}`} className="transition-colors hover:bg-canvas/70">
                <Td className="font-mono text-xs font-medium text-ink">{p.subNumber}</Td>
                <Td className="text-ink-700">{p.carrier}{p.signatureNoted && <span className="ml-1 text-[10px] text-ink-400">SIG</span>}</Td>
                <Td className="font-mono text-xs text-ink-500">{p.trackingNumber ?? '—'}</Td>
                <Td>{p.client ? <span className="font-medium text-ink">{fullName(p.client)}</span> : <span className="italic text-ink-400">unknown</span>}</Td>
                <Td><StatusPill status={p.status} /></Td>
                <Td><span className="tabular text-ink">{fmtTime(p.arrivedAt)}</span> <Stamp by={p.arrivedBy} station={p.arrivedStation} /></Td>
                <Td className="text-right">
                  <Link to={`/intake/receive/${p.id}`} data-testid={`arrival-receive-${p.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                    Receive <ArrowRight size={12} />
                  </Link>
                </Td>
              </tr>
            ))}
            {packages && arrived.length === 0 && <EmptyRow colSpan={7} text="Shelf is clear — nothing awaiting processing." />}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

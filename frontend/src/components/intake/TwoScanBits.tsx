import { Archive, Check, Mail, PackageOpen, ScanLine, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { Client, PackageCustody, PackageScan, PackageWithRefs, ShelfRow } from '@/api/client';
import { ScanInput } from '@/components/intake/IntakeBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fmtDate, fmtMoney, fmtTime, fullName } from '@/lib/format';

const sel = 'h-8 rounded-sm border border-line bg-canvas px-2 text-[13px]';

// Scan 1, second half: after the tracking scan resolved (or didn't), assign a shelf bin — manual client fallback when no label request matched
export const ShelveCard = ({ pkg, clients, onDone }: { pkg: PackageWithRefs; clients: Client[]; onDone: (p: PackageWithRefs, msg: string) => void }) => {
  const [shelf, setShelf] = useState<ShelfRow[]>([]); const [bin, setBin] = useState(''); const [clientId, setClientId] = useState(pkg.clientId ?? ''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { api.getShelf().then((s) => { setShelf(s); setBin(s.find((r) => !r.pkg)?.bin ?? ''); }); }, [pkg.id]);
  const arrival = pkg.scans?.find((s) => s.kind === 'arrival'); const matched = arrival?.matched === 'label_request';
  const go = async (b: string) => { setBusy(true); setErr(null); try { const p = await api.shelvePackage(pkg.id, { shelfBin: b, clientId: !pkg.clientId && clientId ? clientId : undefined }); onDone(p, `${p.subNumber} shelved in ${p.shelfBin}${p.client ? ` · ${fullName(p.client)} notified` : ''}`); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); } };
  return <Card title={`Scan 1 · ${pkg.subNumber}`} subtitle={pkg.trackingNumber ? `${pkg.carrier} ${pkg.trackingNumber}` : pkg.carrier} testId="shelve-card" className="border-l-[3px] border-sky-400">
    <div data-testid="shelve-match" data-state={matched ? 'matched' : pkg.clientId ? 'known' : 'none'} className={`rounded-sm px-2.5 py-2 text-xs ${matched ? 'bg-moss-50 text-moss-800' : pkg.clientId ? 'bg-sky-50 text-sky-800' : 'bg-amber-50 text-amber-900'}`}>
      {matched ? <><b>Matched label request</b> → {pkg.client ? fullName(pkg.client) : '—'}{pkg.estimate && <> · <span className="font-mono">{pkg.estimate.number}</span></>}</> : pkg.clientId ? <><b>Client known</b> → {pkg.client ? fullName(pkg.client) : '—'}</> : <><b>No label request matches this tracking #.</b> Client shipped on their own label — pick the client by hand (or shelve as unknown and resolve at the desk).</>}
    </div>
    {!pkg.clientId && <label className="mt-2 block text-xs text-ink-500">Client (manual fallback)<div className="relative mt-1"><UserRound size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" /><select data-testid="shelve-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className={`${sel} w-full pl-7`}><option value="">Unknown — resolve later</option>{clients.map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}</select></div></label>}
    <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2">
      <label className="text-xs text-ink-500">Shelf bin<select data-testid="shelve-bin" value={bin} onChange={(e) => setBin(e.target.value)} className={`${sel} mt-1 block w-full font-mono`}>{shelf.map((r) => <option key={r.bin} value={r.bin} disabled={!!r.pkg}>{r.bin}{r.pkg ? ` · ${r.pkg.subNumber}${r.pkg.client ? ` · ${r.pkg.client.lastName}` : ''}` : ' · free'}</option>)}</select></label>
      <Button variant="primary" data-testid="shelve-confirm" disabled={busy || !bin} onClick={() => go(bin)}><Archive size={13} /> Shelve{pkg.clientId || clientId ? ' & notify' : ''}</Button>
    </div>
    <ScanInput label="…or scan the bin label" testId="shelve-bin-scan" placeholder="BIN-04" onScan={go} error={err} className="mt-2" />
    <p className="mt-2 text-[11px] text-ink-400">Logs who / station / time / bin. {pkg.clientId || clientId ? 'Client gets a courtesy “package accepted, not yet opened” email.' : 'No email until a client is assigned.'}</p>
  </Card>;
};

// Scan 2 — end-of-day batch: bin, tracking # or SUB# → open event → Stage 2 (Receive Package) for that package
export const OpenScanCard = ({ compact = false }: { compact?: boolean }) => {
  const nav = useNavigate(); const [err, setErr] = useState<string | null>(null);
  const scan = async (q: string) => { try { setErr(null); const p = await api.openScan(q); nav(`/intake/receive/${p.id}`); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  return <Card title="Scan 2 · Open" subtitle={compact ? undefined : 'End of day: scan the bin or tracking # as you open each package → Stage 2'} testId="open-scan-card" className="border-l-[3px] border-violet-400">
    <ScanInput label="Bin · tracking · SUB#" testId="open-scan-input" placeholder="BIN-03 or tracking… then Enter" onScan={scan} error={err} />
  </Card>;
};

// Shelf board — bin → package → client, queryable at any time
export const ShelfBoard = ({ rows, onOpen }: { rows: ShelfRow[]; onOpen?: (bin: string) => void }) => (
  <div data-testid="shelf-board" className="grid grid-cols-6 gap-1.5">{rows.map((r) => <button key={r.bin} type="button" data-testid={`shelf-bin-${r.bin}`} data-state={r.pkg ? 'occupied' : 'free'} disabled={!r.pkg || !onOpen} onClick={() => onOpen?.(r.bin)} className={`rounded-sm border px-2 py-1.5 text-left text-[11px] leading-tight ${r.pkg ? 'border-sky-300 bg-sky-50 hover:bg-sky-100' : 'border-dashed border-line text-ink-300'}`}><div className="font-mono font-semibold">{r.bin}</div>{r.pkg ? <><div className="truncate text-ink">{r.pkg.client ? fullName(r.pkg.client) : <i className="text-amber-800">unknown</i>}</div><div className="font-mono text-[10px] text-ink-500">{r.pkg.subNumber} · {fmtTime(r.pkg.arrivedAt)}</div></> : <div>free</div>}</button>)}</div>
);

const SCAN_LABEL: Record<PackageScan['kind'], string> = { arrival: 'Scan 1 · Arrival', shelved: 'Shelved', open: 'Scan 2 · Open' };
export const ScanTrail = ({ scans, testId = 'scan-trail' }: { scans: PackageScan[]; testId?: string }) => (
  <ol data-testid={testId} className="space-y-1 text-xs">{scans.map((s) => <li key={s.id} data-testid={`scan-${s.kind}-${s.id}`} className="flex items-start gap-2"><span className={`mt-px inline-flex h-5 shrink-0 items-center gap-1 rounded-sm px-1.5 text-[10px] font-semibold ${s.kind === 'open' ? 'bg-violet-50 text-violet-800' : 'bg-sky-50 text-sky-800'}`}>{s.kind === 'open' ? <PackageOpen size={11} /> : s.kind === 'shelved' ? <Archive size={11} /> : <ScanLine size={11} />} {SCAN_LABEL[s.kind]}</span><span className="min-w-0 flex-1 text-ink-700">{s.shelfBin && <span className="mr-1 font-mono font-semibold">{s.shelfBin}</span>}{s.trackingNumber && s.kind === 'arrival' && <span className="mr-1 font-mono text-ink-500">{s.trackingNumber}</span>}{s.note?.includes('courtesy email') ? <span className="inline-flex items-center gap-1 text-moss-700"><Mail size={11} /> {s.note}</span> : s.note}</span><span className="tabular whitespace-nowrap text-[11px] text-ink-400">{fmtDate(s.at)} {fmtTime(s.at)} · <b className="text-ink-600">{s.by}</b> · {s.station}</span></li>)}{!scans.length && <li className="text-ink-400">No scan events (walk-in or pre-procedure package).</li>}</ol>
);

// Chain of custody for one package: label request → scans → into intake. Mounted on job detail + receive page.
export const PackageCustodyCard = ({ packageId }: { packageId: string }) => {
  const [c, setC] = useState<PackageCustody | null>(null);
  useEffect(() => { api.getPackageCustody(packageId).then(setC); }, [packageId]);
  if (!c) return null;
  return <Card title="Chain of custody · package" subtitle={`${c.pkg.subNumber}${c.pkg.trackingNumber ? ` · ${c.pkg.carrier} ${c.pkg.trackingNumber}` : ''}${c.pkg.shelfBin ? ` · ${c.pkg.shelfBin}` : ''}`} testId="package-custody-card">
    {c.shipment && <div data-testid="custody-label" className="mb-2 flex items-center gap-1.5 rounded-sm bg-canvas px-2 py-1 text-[11px] text-ink-600"><Check size={11} className="text-moss-700" /> Label {c.shipment.confirmationId ?? ''} sent {c.shipment.labelSentAt ? fmtDate(c.shipment.labelSentAt) : ''} · insured {fmtMoney(c.shipment.declaredValue)} · {c.shipment.service}</div>}
    <ScanTrail scans={c.scans} />
  </Card>;
};

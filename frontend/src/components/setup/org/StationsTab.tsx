import { Camera, Clock3, Link2, MonitorSmartphone, Plus, Tablet, TabletSmartphone } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import * as org from '@/api/org';
import type { StationInput } from '@/api/org';
import type { Division, Station } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Table, Td, Th } from '@/components/ui/Table';
import { Lbl, Toggle, field } from './OrgBits';

const blank: StationInput = { name: '', division: 'rolliworks', deviceType: 'desktop', receptionMode: false, clockPoint: false };
const KIND_ICON = { desktop: MonitorSmartphone, pad: Tablet, kiosk: TabletSmartphone } as const;

const StationForm = ({ init, onClose, onSaved }: { init: StationInput; onClose: () => void; onSaved: (s: Station) => void }) => {
  const [f, setF] = useState<StationInput>(init); const [err, setErr] = useState<string | null>(null);
  const kiosks = org.kioskStationsSync().filter((k) => k.id !== init.id);
  const save = () => org.saveStation(f).then(onSaved).catch((x) => setErr(x instanceof Error ? x.message : 'Failed'));
  return <Modal testId="station-form" title={init.id ? `Edit ${init.name}` : 'New station'} onClose={onClose}>
    <div className="grid grid-cols-2 gap-3 p-5 text-xs">
      <Lbl>Name<input data-testid="station-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={field} /></Lbl>
      <Lbl>Entity<select data-testid="station-entity" value={f.division} onChange={(e) => setF({ ...f, division: e.target.value as Division })} className={field}>{org.getEntitiesSync().map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}</select></Lbl>
      <Lbl>Device type<select data-testid="station-device" value={f.deviceType ?? 'desktop'} onChange={(e) => setF({ ...f, deviceType: e.target.value as Station['deviceType'] })} className={field}><option value="desktop">desktop</option><option value="pad">pad (iPad)</option><option value="kiosk">kiosk</option></select></Lbl>
      <Lbl>Camera role (Pickup Station)<select data-testid="station-camera" value={f.cameraRole ?? ''} onChange={(e) => setF({ ...f, cameraRole: (e.target.value || undefined) as Station['cameraRole'] })} className={field}><option value="">— none</option><option value="counter">counter cam (item · QR · hand-back)</option><option value="client">client cam (hand-over strip)</option></select></Lbl>
      <Lbl className="col-span-2">Paired kiosk (this counter pushes check-ins and ≥ $10k pickup confirmations to it)<select data-testid="station-kiosk" value={f.pairedKioskId ?? ''} disabled={f.deviceType === 'kiosk'} onChange={(e) => setF({ ...f, pairedKioskId: e.target.value || undefined })} className={`${field} disabled:opacity-50`}><option value="">— none</option>{kiosks.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Lbl>
      <Lbl className="col-span-2">Notes<input data-testid="station-notes" value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} className={field} /></Lbl>
      <div className="col-span-2 flex flex-wrap items-center gap-4"><Toggle on={!!f.receptionMode} onChange={(v) => setF({ ...f, receptionMode: v })} testId="station-reception" label="Reception mode (no IN-HOUSE badges / estimate numbers)" /><Toggle on={!!f.clockPoint} onChange={(v) => setF({ ...f, clockPoint: v })} testId="station-clock-point" label="Clock-in point (Time Clock)" /></div>
      {err && <p data-testid="station-error" className="col-span-2 font-medium text-rose-700">{err}</p>}
      <div className="col-span-2 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="station-save" onClick={save}>Save</Button></div>
    </div>
  </Modal>;
};

export const StationsTab = ({ onFlash }: { onFlash: (m: string, err?: boolean) => void }) => {
  const { station: mine } = useAuth();
  const [list, setList] = useState<Station[]>(() => org.getStationsSync()); const [edit, setEdit] = useState<StationInput | null>(null);
  const byId = (id?: string) => list.find((s) => s.id === id);
  return <div data-testid="org-stations" className="space-y-3">
    <Card title="Stations" subtitle="Device registry · one row per screen in the building · kiosk pairing is data (FD1 → check-in kiosk, FD2 → its own confirm kiosk) · camera roles feed the Pickup Station · clock points feed the Time Clock" action={<Button size="sm" data-testid="station-new" onClick={() => setEdit(blank)}><Plus size={12} /> Add station</Button>} bodyClassName="p-0">
      <Table><thead><tr><Th>Station</Th><Th>Entity</Th><Th>Device</Th><Th>Paired kiosk</Th><Th>Camera</Th><Th>Flags</Th><Th /></tr></thead><tbody>
        {list.map((s) => { const Icon = KIND_ICON[s.deviceType ?? 'desktop']; const k = byId(s.pairedKioskId); return <tr key={s.id} data-testid={`station-row-${s.id}`} data-kiosk={s.pairedKioskId ?? ''} className={s.id === mine?.id ? 'bg-moss-50/40' : ''}>
          <Td className="text-xs font-medium text-ink"><span className="inline-flex items-center gap-1.5"><Icon size={13} className="text-ink-400" /> {s.name}{s.id === mine?.id && <span className="rounded-sm bg-moss-50 px-1 text-[9px] font-semibold uppercase text-moss-700">this device</span>}</span><div className="font-mono text-[10px] text-ink-400">{s.id}</div></Td>
          <Td className="text-xs text-ink-500">{api.entityName(s.division)}</Td>
          <Td className="text-xs capitalize text-ink-500">{s.deviceType ?? 'desktop'}</Td>
          <Td data-testid={`station-kiosk-${s.id}`} className="text-xs">{k ? <span className="inline-flex items-center gap-1 text-ink"><Link2 size={11} className="text-ink-400" /> {k.name}</span> : <span className="text-ink-300">—</span>}</Td>
          <Td className="text-xs">{s.cameraRole ? <span className="inline-flex items-center gap-1 rounded-sm bg-canvas px-1.5 py-0.5"><Camera size={11} /> {s.cameraRole}</span> : <span className="text-ink-300">—</span>}</Td>
          <Td className="text-[11px] text-ink-500">{[s.receptionMode && 'reception', s.clockPoint && <span key="c" className="inline-flex items-center gap-0.5"><Clock3 size={10} /> clock point</span>].filter(Boolean).map((x, i) => <span key={i} className="mr-2">{x}</span>)}</Td>
          <Td className="text-right"><Button size="sm" variant="ghost" data-testid={`station-edit-${s.id}`} onClick={() => setEdit({ id: s.id, name: s.name, division: s.division, deviceType: s.deviceType ?? 'desktop', cameraRole: s.cameraRole, receptionMode: s.receptionMode, pairedKioskId: s.pairedKioskId, clockPoint: s.clockPoint, notes: s.notes })}>Edit</Button></Td>
        </tr>; })}
      </tbody></Table>
    </Card>
    {edit && <StationForm init={edit} onClose={() => setEdit(null)} onSaved={(s) => { setEdit(null); setList(org.getStationsSync()); onFlash(`${s.name} saved`); }} />}
  </div>;
};

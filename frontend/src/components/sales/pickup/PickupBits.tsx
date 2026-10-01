import clsx from 'clsx';
import { Camera, Check, ShieldAlert, Smartphone, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as api from '@/api/client';
import type { PackagePhoto, User } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useCamera } from '@/hooks/useCamera';

export const field = 'h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';
export const DEV = import.meta.env.DEV; // Simulate scan · placeholder shots · ?fast=1 only exist in dev builds — production has none of them
export type CameraRole = 'counter' | 'client';
const PREFS_KEY = 'rollisuite.pickup.cameras';
export const cameraPrefs = (): Partial<Record<CameraRole, string>> => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}'); } catch { return {}; } };
export const setCameraPref = (role: CameraRole, deviceId: string) => localStorage.setItem(PREFS_KEY, JSON.stringify({ ...cameraPrefs(), [role]: deviceId || undefined }));
export const readFile = (file: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onerror = () => rej(new Error('Could not read file')); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
export const shotId = () => `ph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
export const placeholderShot = (label: string): PackagePhoto => ({ id: shotId(), source: 'webcam', dataUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#334155"/><circle cx="160" cy="105" r="52" fill="#cbd5e1"/><text x="160" y="200" font-family="monospace" font-size="13" fill="#f8fafc" text-anchor="middle">${label.replace(/&/g, '&amp;')}</text></svg>`) });

// One live camera for a ROLE (counter / client). Falls back to upload when there is no hardware; dev builds also get a placeholder shutter so flows stay testable headless.
export const CameraPane = ({ role, label, onShot, testId, placeholderLabel, className }: { role: CameraRole; label: string; onShot: (p: PackagePhoto) => void; testId: string; placeholderLabel: string; className?: string }) => {
  const prefs = cameraPrefs();
  const { videoRef, status, capture } = useCamera(true, prefs[role]);
  const fileRef = useRef<HTMLInputElement>(null);
  const snap = () => { const s = capture(); if (s.dataUrl) onShot({ id: shotId(), source: 'webcam', dataUrl: s.dataUrl }); };
  return (
    <div data-testid={testId} data-status={status} className={clsx('rounded-sm border border-line bg-ink/95 p-2 text-white', className)}>
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-white/70"><span>{label} · {role} cam</span><span data-testid={`${testId}-status`}>{status === 'ready' ? 'live' : status}</span></div>
      <div className="relative mt-1 aspect-[4/3] overflow-hidden rounded-sm bg-black">
        <video ref={videoRef} autoPlay muted playsInline className={clsx('h-full w-full object-cover', status !== 'ready' && 'opacity-0')} />
        {status !== 'ready' && <div className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-white/60">{status === 'denied' ? 'Camera permission denied' : status === 'starting' ? 'Starting camera…' : 'No camera on this device — upload a photo instead'}</div>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="primary" data-testid={`${testId}-shutter`} disabled={status !== 'ready'} onClick={snap}><Camera size={12} /> Capture</Button>
        <Button size="sm" data-testid={`${testId}-upload`} onClick={() => fileRef.current?.click()}><Upload size={12} /> Upload</Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) onShot({ id: shotId(), source: 'upload', dataUrl: await readFile(f), fileName: f.name }); e.target.value = ''; }} />
        {DEV && <Button size="sm" data-testid={`${testId}-placeholder`} onClick={() => onShot(placeholderShot(placeholderLabel))} title="Dev build only">Placeholder shot</Button>}
      </div>
    </div>
  );
};

// Assign physical cameras to the two roles — persisted per device
export const CameraSettings = ({ onClose }: { onClose: () => void }) => {
  const { devices, status } = useCamera(true);
  const [prefs, setPrefs] = useState(cameraPrefs());
  const pick = (role: CameraRole, id: string) => { setCameraPref(role, id); setPrefs(cameraPrefs()); };
  return (
    <Modal testId="pickup-camera-settings" title="Pickup Station cameras" onClose={onClose} width="w-[520px]">
      <div className="space-y-3 p-5 text-xs">
        <p className="text-ink-500">Two roles, two devices: the <b>counter</b> camera shoots the item, the client’s QR and the hand-back photo; the <b>client</b> camera records the 60 s hand-over strip (6 frames). Status: {status}{devices.length ? ` · ${devices.length} camera${devices.length > 1 ? 's' : ''} found` : ' · no cameras enumerated yet'}.</p>
        {(['counter', 'client'] as CameraRole[]).map((role) => (
          <label key={role} className="block">{role === 'counter' ? 'Counter camera' : 'Client camera (station role: client)'}
            <select data-testid={`camera-pref-${role}`} value={prefs[role] ?? ''} onChange={(e) => pick(role, e.target.value)} className={`${field} mt-1 block w-full`}>
              <option value="">Default camera</option>{devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
            </select>
          </label>
        ))}
        <div className="flex justify-end"><Button variant="primary" data-testid="camera-settings-done" onClick={onClose}>Done</Button></div>
      </div>
    </Modal>
  );
};

// Second-person rule: a manager who is NOT the staffer at the counter picks their name, enters their PIN and writes the reason
export const ManagerApprovalModal = ({ title, hint, confirmLabel = 'Approve', testId, onClose, onApprove }: { title: string; hint: string; confirmLabel?: string; testId: string; onClose: () => void; onApprove: (input: api.ManagerApprovalInput) => Promise<void> }) => {
  const [managers, setManagers] = useState<User[]>([]);
  const [managerId, setManagerId] = useState('');
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.getApprovingManagers().then((m) => { setManagers(m); setManagerId(m[0]?.id ?? ''); }); }, []);
  const go = async () => { setBusy(true); try { await onApprove({ managerId, pin, reason }); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); } };
  return (
    <Modal testId={testId} title={title} onClose={onClose} width="w-[480px]">
      <div className="space-y-3 p-5 text-xs">
        <p className="inline-flex items-start gap-1.5 text-ink-500"><ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-700" /> {hint} The approver must be a different person from the staffer running this pickup; the approval lands on the sales order, the job and the Hitlist.</p>
        <label className="block">Approving manager<select data-testid={`${testId}-manager`} value={managerId} onChange={(e) => setManagerId(e.target.value)} className={`${field} mt-1 block w-full`}>{managers.map((m) => <option key={m.id} value={m.id}>{m.displayName} · {m.dutyLabel}</option>)}</select></label>
        <label className="block">Their PIN<input data-testid={`${testId}-pin`} type="password" value={pin} onChange={(e) => setPin(e.target.value)} className={`${field} mt-1 block w-full font-mono`} autoComplete="off" /></label>
        <label className="block">Reason (required, logged)<textarea data-testid={`${testId}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 block w-full rounded-sm border border-line bg-canvas px-2 py-1 text-[13px] focus:border-ink focus:outline-none" /></label>
        {err && <div data-testid={`${testId}-error`} className="rounded-sm bg-rose-50 px-2 py-1 text-rose-700">{err}</div>}
        <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid={`${testId}-confirm`} disabled={busy || !managerId || !pin || !reason.trim()} onClick={go}><Check size={12} /> {confirmLabel}</Button></div>
      </div>
    </Modal>
  );
};

// Mock phone — PROTOTYPE ONLY (NOT-KEEPER). The prototype keeps its state per tab, so the client's "phone" renders inline here; on a real device this is the client's own browser.
export const PhoneFrame = ({ children, caption }: { children: ReactNode; caption: string }) => (
  <div data-testid="mock-phone" className="mx-auto w-[300px]">
    <div className="rounded-[28px] border-[6px] border-ink bg-ink p-1 shadow-pop">
      <div className="mx-auto mb-1 h-4 w-24 rounded-full bg-black" />
      <div className="h-[520px] overflow-y-auto rounded-[20px] bg-rc-cream text-rc-ink">{children}</div>
    </div>
    <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-800"><Smartphone size={11} /> {caption}</p>
  </div>
);

// Every gate can stop the pickup — reason required, it becomes a record on the SO (and a Hitlist pin for an item mismatch)
export const StopPickup = ({ step, onStop, label = 'Stop pickup', testId }: { step: string; onStop: (reason: string) => Promise<void>; label?: string; testId: string }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <Button data-testid={testId} className="text-rose-700" onClick={() => setOpen(true)}><X size={12} /> {label}</Button>
      {open && <Modal testId={`${testId}-modal`} title={`Stop pickup · ${step}`} onClose={() => setOpen(false)} width="w-[440px]">
        <div className="space-y-3 p-5 text-xs">
          <p className="text-ink-500">The stop is logged on the sales order and the job (who, when, why). The customer keeps nothing.</p>
          <textarea data-testid={`${testId}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="What did not match / why the hand-over stops" className="block w-full rounded-sm border border-line bg-canvas px-2 py-1 text-[13px] focus:border-ink focus:outline-none" />
          {err && <div className="rounded-sm bg-rose-50 px-2 py-1 text-rose-700">{err}</div>}
          <div className="flex justify-end gap-2"><Button onClick={() => setOpen(false)}>Back</Button><Button variant="primary" className="bg-rose-700 hover:bg-rose-800" data-testid={`${testId}-confirm`} disabled={!reason.trim()} onClick={() => onStop(reason).then(() => setOpen(false)).catch((e) => setErr(e instanceof Error ? e.message : 'Failed'))}>Stop and log</Button></div>
        </div>
      </Modal>}
    </>
  );
};

export const GateBanner = ({ tone, children, testId }: { tone: 'ok' | 'block' | 'warn'; children: ReactNode; testId: string }) => (
  <div data-testid={testId} data-tone={tone} className={clsx('rounded-sm px-3 py-2 text-xs font-medium', tone === 'ok' ? 'bg-moss-50 text-moss-800' : tone === 'block' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800')}>{children}</div>
);

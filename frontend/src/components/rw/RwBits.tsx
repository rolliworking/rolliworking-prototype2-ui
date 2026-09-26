import { Camera, KeyRound, ScanLine, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as api from '@/api/client';
import type { ComponentKey, FloorDot, JobPhotoView, User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';

// Part colours — BY PART, never by status
export const PART_COLOR: Record<ComponentKey, string> = { head: '#2563eb', case: '#9333ea', band: '#16a34a' };
export const PART_NAME: Record<ComponentKey, string> = { head: 'Watch head', case: 'Case', band: 'Bracelet' };

export const PartDot = ({ k, hollow, size = 12, title, testId }: { k: ComponentKey; hollow?: boolean; size?: number; title?: string; testId?: string }) => (
  <span data-testid={testId} title={title ?? PART_NAME[k]} style={{ width: size, height: size, background: hollow ? 'transparent' : PART_COLOR[k], borderColor: PART_COLOR[k] }} className="inline-block shrink-0 rounded-full border-2" />
);

export const PartLocations = ({ parts }: { parts: FloorDot[] }) => (
  <div className="flex flex-wrap gap-2 text-[11px]">{parts.map((p) => <span key={p.key} data-testid={`part-loc-${p.jobId}-${p.key}`} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-slate-200"><PartDot k={p.key} size={9} /> {p.label} · {api.RW_STATIONS.find((s) => s.key === p.station)?.label}{p.tech && <span className="text-slate-500">· {p.tech}</span>}</span>)}</div>
);

// Keyboard-wedge scan field: auto-focus, Enter = scan
export const ScanInput = ({ onScan, placeholder, testId, big }: { onScan: (code: string) => Promise<void> | void; placeholder: string; testId: string; big?: boolean }) => {
  const ref = useRef<HTMLInputElement>(null); const [v, setV] = useState(''); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { ref.current?.focus(); const t = setInterval(() => { if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'SELECT') ref.current?.focus(); }, 1500); return () => clearInterval(t); }, []);
  return <form onSubmit={async (e) => { e.preventDefault(); if (!v.trim()) return; try { await onScan(v.trim()); setErr(null); } catch (x) { setErr(x instanceof Error ? x.message : 'Scan failed'); } setV(''); ref.current?.focus(); }} className="space-y-1">
    <div className="relative"><ScanLine size={big ? 20 : 14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" /><input ref={ref} data-testid={testId} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} autoComplete="off" className={`w-full rounded-lg border border-amber-400/40 bg-[#0f131a] font-mono text-slate-100 outline-none focus:border-amber-400 ${big ? 'py-4 pl-11 pr-4 text-xl' : 'py-2 pl-9 pr-3 text-sm'}`} /></div>
    {err && <p data-testid={`${testId}-error`} className="rounded-md bg-rose-950/60 px-3 py-1.5 text-xs text-rose-300">{err}</p>}
  </form>;
};

// PIN user switch for shared terminals
export const PinSwitch = ({ big }: { big?: boolean }) => {
  const { user, switchWithPin } = useAuth(); const [open, setOpen] = useState(false); const [sel, setSel] = useState<User | null>(null); const [pin, setPin] = useState(''); const [err, setErr] = useState<string | null>(null);
  const users = api.getDivisionStaff(api.getSessionDivision());
  return <>
    <button data-testid="rw-pin-switch" onClick={() => { setOpen(true); setSel(null); setPin(''); setErr(null); }} className={`inline-flex items-center gap-2 rounded-full border border-white/15 text-slate-200 hover:bg-white/10 ${big ? 'min-h-[44px] px-4 py-2 text-base' : 'px-3 py-1.5 text-xs'}`}><KeyRound size={big ? 18 : 13} /> {user?.shortName ?? '—'} · switch</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}><div data-testid="rw-pin-modal" onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl border border-white/10 bg-[#1f2630] p-5 text-slate-100">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Switch tech</h2><button onClick={() => setOpen(false)} className="p-2"><X size={18} /></button></div>
      <div className="grid grid-cols-2 gap-2">{users.map((u) => <button key={u.id} data-testid={`rw-pin-card-${u.id}`} onClick={() => setSel(u)} className={`min-h-[56px] rounded-xl border p-3 text-left ${sel?.id === u.id ? 'border-amber-400 bg-amber-400/10' : 'border-white/10'}`}><div className="font-semibold">{u.shortName}</div><div className="text-xs text-slate-400">{u.dutyLabel}</div></button>)}</div>
      {sel && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); switchWithPin(sel.id, pin.trim()).then(() => setOpen(false)).catch((x) => setErr(x.message)); }}><input data-testid="rw-pin-input" autoFocus inputMode="numeric" type="password" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="4-digit PIN" className="min-h-[48px] flex-1 rounded-xl border border-white/10 bg-[#0f131a] px-4 text-lg tracking-widest" /><button data-testid="rw-pin-go" className="min-h-[48px] rounded-xl bg-amber-400 px-5 font-semibold text-[#161b22]">Go</button></form>}
      {err && <p data-testid="rw-pin-error" className="text-sm text-rose-400">{err}</p>}
    </div></div>}
  </>;
};

export const Clock = () => { const [t, setT] = useState(new Date()); useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []); return <span data-testid="rw-clock" className="font-mono text-2xl font-semibold tabular-nums text-white">{t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>; };

// Photo grid + lightbox (tap to zoom)
export const PhotoGrid = ({ jobId, onClose, title }: { jobId: string; onClose: () => void; title: string }) => {
  const [photos, setPhotos] = useState<JobPhotoView[]>([]); const [open, setOpen] = useState<JobPhotoView | null>(null); const [zoom, setZoom] = useState(false);
  useEffect(() => { api.getJobPhotoViews(jobId).then(setPhotos); }, [jobId]);
  return <div className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white" data-testid="rw-photo-view">
    <div className="flex items-center justify-between px-5 py-3"><div className="flex items-center gap-2 text-lg font-semibold"><Camera size={20} /> {title} · {photos.length} photo{photos.length === 1 ? '' : 's'}</div><button data-testid="rw-photo-close" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-full bg-white/10 p-2"><X size={22} /></button></div>
    <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-5 sm:grid-cols-3 lg:grid-cols-4">{photos.map((p) => <button key={p.id} data-testid={`rw-photo-${p.id}`} onClick={() => { setOpen(p); setZoom(false); }} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-white/5"><img src={p.url} alt={p.slot} className="h-full w-full object-cover" /><span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1.5 text-left text-sm"><span className={`mr-1.5 rounded-sm px-1 text-[10px] uppercase ${p.kind === 'intake' ? 'bg-sky-500/80' : 'bg-amber-500/80 text-black'}`}>{p.kind}</span>{p.slot}</span></button>)}{!photos.length && <p className="col-span-full py-10 text-center text-slate-400">No photos on this job yet.</p>}</div>
    {open && <div data-testid="rw-lightbox" className="absolute inset-0 flex flex-col bg-black" onClick={() => setOpen(null)}><div className="flex items-center justify-between px-5 py-3 text-sm"><span>{open.slot} · {open.kind} · {open.by}</span><span className="text-slate-400">tap image to zoom · tap outside to close</span></div><div className="flex flex-1 items-center justify-center overflow-auto p-4"><img src={open.url} alt={open.slot} onClick={(e) => { e.stopPropagation(); setZoom((z) => !z); }} className={`rounded-lg transition-transform duration-200 ${zoom ? 'scale-[1.8] cursor-zoom-out' : 'max-h-full cursor-zoom-in'}`} /></div></div>}
  </div>;
};

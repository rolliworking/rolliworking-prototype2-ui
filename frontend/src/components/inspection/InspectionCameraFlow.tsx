import { Camera, Check, Microscope, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCamera, type CameraDevice } from '@/hooks/useCamera';

export type ShotSource = 'ipevo' | 'microscope';
// No hardware (dev / demo) → these names keep the flow readable; real device labels replace them once the browser reports video inputs
export const MOCK_CAMERAS: CameraDevice[] = [
  { deviceId: 'mock-ipevo', label: 'IPEVO V4K (mock)' },
  { deviceId: 'mock-scope', label: 'HY-3307 (mock)' },
];
const isScopeLabel = (l: string) => /hy-?3307|microscope|scope|dino/i.test(l);
const isIpevoLabel = (l: string) => /ipevo|v4k/i.test(l);
const sourceOf = (d: CameraDevice, stage: ShotSource): ShotSource => (isIpevoLabel(d.label) ? 'ipevo' : isScopeLabel(d.label) ? 'microscope' : stage);

interface Props { onShot: (p: { source: ShotSource; dataUrl: string; device: string }) => Promise<unknown>; onDone: () => void; onClose: () => void; title?: string }

// Inspection camera sequence — IPEVO fires first for exactly 2 overview shots, then hands off to the microscope with no cap. Header selector shows the active device and allows a manual switch. SPACE = shutter.
export const InspectionCameraFlow = ({ onShot, onDone, onClose, title }: Props) => {
  const [count, setCount] = useState(0); const [manual, setManual] = useState<string | null>(null); const [devId, setDevId] = useState<string | undefined>(undefined);
  const { videoRef, status, capture, devices } = useCamera(true, devId); const [flash, setFlash] = useState(false); const [shots, setShots] = useState<{ url: string; source: ShotSource }[]>([]); const [busy, setBusy] = useState(false);
  const stage: ShotSource = count < 2 ? 'ipevo' : 'microscope';
  const cams = devices.length ? devices : MOCK_CAMERAS;
  const auto = cams.find((d) => (stage === 'ipevo' ? isIpevoLabel(d.label) : isScopeLabel(d.label))) ?? cams[stage === 'ipevo' ? 0 : Math.min(1, cams.length - 1)];
  const active = (manual && cams.find((d) => d.deviceId === manual)) || auto;
  const source = sourceOf(active, stage);
  useEffect(() => { setManual(null); }, [stage]); // hand-off: the stage change re-arms auto device selection
  useEffect(() => { setDevId(active.deviceId.startsWith('mock-') ? undefined : active.deviceId); }, [active.deviceId]);

  const snap = async () => {
    if (busy) return; setBusy(true);
    try { const s = capture(); const dataUrl = s.dataUrl || placeholder(active.label, source, count); setFlash(true); setTimeout(() => setFlash(false), 200); await onShot({ source, dataUrl, device: active.label }); setShots((x) => [...x, { url: dataUrl, source }]); setCount((x) => x + 1); } finally { setBusy(false); }
  };
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target instanceof HTMLSelectElement)) { e.preventDefault(); void snap(); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }); // eslint-disable-line react-hooks/exhaustive-deps

  return <div data-testid="inspection-camera" data-step={count} data-stage={stage} data-device={active.label} className="fixed inset-0 z-[85] flex flex-col bg-black/90 text-white">
    <div className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className="text-sm font-semibold" data-testid="inspection-camera-stage">{stage === 'ipevo' ? <><Camera size={16} className="mr-1 inline" /> IPEVO overview · shot {count + 1} of 2</> : <><Microscope size={16} className="mr-1 inline text-cyan-300" /> Microscope detail · shot {count - 1} · no cap</>}</span>
      {title && <span className="text-xs text-white/60">{title}</span>}
      <label className="ml-auto inline-flex items-center gap-2 rounded-md bg-white/10 px-2.5 py-1 text-xs"><RefreshCw size={12} className="text-white/60" /><span className="text-white/60">Camera</span>
        <select data-testid="inspection-camera-select" value={active.deviceId} onChange={(e) => setManual(e.target.value)} className="max-w-[260px] bg-transparent font-medium text-white focus:outline-none">{cams.map((d) => <option key={d.deviceId} value={d.deviceId} className="text-black">{d.label}</option>)}</select>
        <span data-testid="inspection-camera-active" className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase ${source === 'ipevo' ? 'bg-white/20' : 'bg-cyan-500/30 text-cyan-100'}`}>{source === 'ipevo' ? 'IPEVO' : 'MICRO'}{manual ? ' · manual' : ' · auto'}</span>
      </label>
      <span className="text-xs text-white/60" data-testid="inspection-camera-status">{status === 'ready' ? 'camera live' : status === 'denied' || status === 'unavailable' ? 'no camera — shutter drops a placeholder frame' : 'starting camera…'}</span>
      <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs">SPACE = shutter</span>
      <button data-testid="inspection-camera-close" onClick={onClose} className="rounded-full bg-white/10 p-1.5" aria-label="Close camera"><X size={16} /></button>
    </div>
    <div className="relative mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-5"><video ref={videoRef} autoPlay playsInline muted className={`max-h-[60vh] w-full rounded-xl bg-black object-cover ${source === 'microscope' ? 'ring-4 ring-cyan-400/60' : ''}`} />{flash && <div className="absolute inset-0 rounded-xl bg-white/80" />}<span className="pointer-events-none absolute left-8 top-3 rounded bg-black/60 px-2 py-0.5 text-xs">{active.label}</span></div>
    <div className="flex items-center justify-center gap-3 px-5 py-4">
      <div className="flex max-w-[50vw] gap-2 overflow-x-auto">{shots.map((s, i) => <span key={i} className="relative shrink-0"><img src={s.url} alt="" className={`h-14 w-20 rounded object-cover ring-1 ${s.source === 'ipevo' ? 'ring-white/30' : 'ring-cyan-400/60'}`} /><span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] uppercase">{s.source === 'ipevo' ? 'ipevo' : 'micro'}</span></span>)}</div>
      <span data-testid="inspection-camera-count" className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{count} captured</span>
      <button data-testid="inspection-camera-shutter" onClick={() => void snap()} disabled={busy} className="ml-2 h-16 w-16 rounded-full border-4 border-white bg-white/20 disabled:opacity-50" aria-label="Shutter" />
      <button data-testid="inspection-camera-done" onClick={onDone} disabled={count < 2} title={count < 2 ? 'Take the 2 IPEVO overview shots first' : undefined} className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-5 py-3 font-semibold text-black disabled:opacity-40"><Check size={15} /> Done</button>
    </div>
  </div>;
};

const placeholder = (device: string, source: ShotSource, n: number) => { const c = document.createElement('canvas'); c.width = 320; c.height = 200; const g = c.getContext('2d')!; g.fillStyle = source === 'ipevo' ? '#1f2630' : '#0e3b4a'; g.fillRect(0, 0, 320, 200); g.fillStyle = '#fff'; g.font = '15px sans-serif'; g.fillText(device, 20, 90); g.fillText(`${source === 'ipevo' ? 'Overview' : 'Detail'} shot ${n + 1} · no camera`, 20, 115); return c.toDataURL('image/jpeg', 0.6); };

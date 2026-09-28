import { AlertTriangle, Camera, Check, ChevronRight, HelpCircle, Microscope, ShieldCheck, ShieldX, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as ac from '@/api/authCapture';
import type { AuthFlag, AuthSession } from '@/api/authCapture';
import { MOCK_CAMERAS } from '@/components/inspection/InspectionCameraFlow';
import { Button } from '@/components/ui/Button';
import { useCamera } from '@/hooks/useCamera';
import { fmtDate } from '@/lib/format';

const isScope = (l: string) => /hy-?3307|microscope|scope/i.test(l); const isIpevo = (l: string) => /ipevo|v4k/i.test(l);
const placeholder = (label: string, cam: string) => { const c = document.createElement('canvas'); c.width = 320; c.height = 200; const g = c.getContext('2d')!; g.fillStyle = cam === 'ipevo' ? '#1f2630' : '#0e3b4a'; g.fillRect(0, 0, 320, 200); g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText(label, 16, 90); g.fillText(`${cam} · no camera`, 16, 112); return c.toDataURL('image/jpeg', 0.6); };
const FLAGS: { v: AuthFlag; label: string; icon: React.ReactNode; cls: string }[] = [{ v: 'authentic', label: 'Authentic', icon: <ShieldCheck size={12} />, cls: 'border-moss bg-moss text-white' }, { v: 'unsure', label: 'Unsure', icon: <HelpCircle size={12} />, cls: 'border-amber-500 bg-amber-500 text-black' }, { v: 'fake', label: 'Fake', icon: <ShieldX size={12} />, cls: 'border-rose-600 bg-rose-600 text-white' }];

// Guided 11-step sequence: label + assigned camera per step, auto-switch (manual override kept), per-step authenticity flag, Next to advance
export const GuidedAuthCapture = ({ session, onShot, onClose }: { session: AuthSession; onShot: (s: AuthSession) => void; onClose: () => void }) => {
  const [idx, setIdx] = useState(Math.min(session.shots.length, ac.AUTH_STEPS.length - 1)); const step = ac.AUTH_STEPS[idx]; const total = ac.AUTH_STEPS.length;
  const [manual, setManual] = useState<string | null>(null); const [devId, setDevId] = useState<string | undefined>(); const { videoRef, status, capture, devices } = useCamera(true, devId);
  const cams = devices.length ? devices : MOCK_CAMERAS; const auto = cams.find((d) => (step.cam === 'ipevo' ? isIpevo(d.label) : isScope(d.label))) ?? cams[step.cam === 'ipevo' ? 0 : Math.min(1, cams.length - 1)]; const active = (manual && cams.find((d) => d.deviceId === manual)) || auto;
  useEffect(() => { setManual(null); }, [idx]); useEffect(() => { setDevId(active.deviceId.startsWith('mock-') ? undefined : active.deviceId); }, [active.deviceId]);
  const existing = session.shots.find((s) => s.step === step.key); const [shot, setShot] = useState<string | null>(null); const [flag, setFlag] = useState<AuthFlag>('authentic'); const [note, setNote] = useState('');
  useEffect(() => { setShot(existing?.dataUrl ?? null); setFlag(existing?.flag ?? 'authentic'); setNote(existing?.note ?? ''); }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps
  const snap = () => { const c = capture(); setShot(c.dataUrl || placeholder(step.label, step.cam)); };
  const next = async () => { if (!shot) return; const s = await ac.recordAuthShot(session.id, { step: step.key, dataUrl: shot, device: active.label, cam: isScope(active.label) ? 'microscope' : isIpevo(active.label) ? 'ipevo' : step.cam, flag, note: flag === 'authentic' ? undefined : note || undefined }); onShot(s); if (idx < total - 1) setIdx(idx + 1); else onClose(); };
  const done = session.shots.length;
  return <div data-testid="auth-capture" data-step={idx + 1} data-step-key={step.key} data-cam={step.cam} data-device={active.label} className="fixed inset-0 z-[85] flex flex-col bg-black/90 text-white">
    <div className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold" data-testid="auth-step-counter">Step {idx + 1} of {total}</span>
      <span className="text-base font-semibold" data-testid="auth-step-label">{step.label}</span><span className="text-xs text-white/60">{step.hint}</span>
      <span data-testid="auth-step-cam" className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-[11px] uppercase ${step.cam === 'ipevo' ? 'bg-white/20' : 'bg-cyan-500/30 text-cyan-100'}`}>{step.cam === 'ipevo' ? <Camera size={11} /> : <Microscope size={11} />} {step.cam === 'ipevo' ? 'IPEVO cam' : 'Microscope cam'}</span>
      <label className="ml-auto inline-flex items-center gap-2 rounded-md bg-white/10 px-2.5 py-1 text-xs"><span className="text-white/60">Active camera</span><select data-testid="auth-camera-select" value={active.deviceId} onChange={(e) => setManual(e.target.value)} className="max-w-[240px] bg-transparent font-medium text-white focus:outline-none">{cams.map((d) => <option key={d.deviceId} value={d.deviceId} className="text-black">{d.label}</option>)}</select><span data-testid="auth-camera-mode" className="rounded-sm bg-white/20 px-1.5 text-[10px] uppercase">{manual ? 'manual' : 'auto'}</span></label>
      <span className="text-xs text-white/60">{status === 'ready' ? 'camera live' : 'no camera — placeholder frames'}</span>
      <button data-testid="auth-close" onClick={onClose} className="rounded-full bg-white/10 p-1.5" aria-label="Close"><X size={16} /></button>
    </div>
    <div className="flex flex-wrap gap-1 px-5" data-testid="auth-step-strip">{ac.AUTH_STEPS.map((s, i) => { const sh = session.shots.find((x) => x.step === s.key); return <button key={s.key} type="button" data-testid={`auth-step-${s.key}`} data-state={sh ? sh.flag : i === idx ? 'current' : 'todo'} onClick={() => setIdx(i)} className={`h-7 rounded-full border px-2.5 text-[11px] ${i === idx ? 'border-white bg-white text-black' : sh ? (sh.flag === 'authentic' ? 'border-emerald-400/60 text-emerald-200' : sh.flag === 'unsure' ? 'border-amber-400 text-amber-200' : 'border-rose-500 text-rose-200') : 'border-white/20 text-white/60'}`}>{i + 1} · {s.label}{s.cam === 'microscope' ? ' ·µ' : ''}</button>; })}</div>
    <div className="relative mx-auto grid w-full max-w-5xl flex-1 grid-cols-[1fr_320px] gap-4 px-5 py-4">
      <div className="relative"><video ref={videoRef} autoPlay playsInline muted className={`h-full max-h-[52vh] w-full rounded-xl bg-black object-cover ${step.cam === 'microscope' ? 'ring-4 ring-cyan-400/60' : ''}`} /><span className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 text-xs">{active.label}</span>{shot && <img src={shot} alt="" data-testid="auth-shot-preview" className="absolute bottom-3 right-3 h-28 w-40 rounded-md object-cover ring-2 ring-white" />}</div>
      <div className="space-y-3 rounded-xl bg-white/5 p-3 text-sm">
        <div className="text-xs text-white/60">Authenticity — this component</div>
        <div className="flex gap-1.5" data-testid="auth-flag-group">{FLAGS.map((f) => <button key={f.v} type="button" data-testid={`auth-flag-${f.v}`} aria-pressed={flag === f.v} onClick={() => setFlag(f.v)} className={`inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-full border text-xs font-semibold ${flag === f.v ? f.cls : 'border-white/20 text-white/70'}`}>{f.icon} {f.label}</button>)}</div>
        {flag === 'authentic' ? <p className="text-[11px] text-white/50">Default — no action needed. Flag only if this part looks off.</p> : <textarea data-testid="auth-flag-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What looks wrong on this part?" className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-white/40" />}
        <div className="border-t border-white/10 pt-3 text-xs text-white/60">{done} of {total} captured{ac.flagSummary(session).length > 0 && <span className="ml-1 text-amber-200"><AlertTriangle size={11} className="inline" /> {ac.flagSummary(session).join(' · ')}</span>}</div>
        <div className="flex items-center gap-2"><button type="button" data-testid="auth-shutter" onClick={snap} className="h-14 w-14 rounded-full border-4 border-white bg-white/20" aria-label="Shutter" /><Button variant="primary" data-testid="auth-next" disabled={!shot} onClick={() => void next()} className="flex-1">{idx < total - 1 ? <>Next <ChevronRight size={14} /></> : <><Check size={14} /> Finish</>}</Button></div>
        <p className="text-[10px] text-white/40">Rehaut (step 8) is confirmed in the sequence. Cyclops magnification and the crystal micro-etched crown are still open with MH — not captured here.</p>
      </div>
    </div>
  </div>;
};

// Job-page summary — sessions with per-step flags; launches the guided flow
export const AuthCapturePanel = ({ jobId }: { jobId: string }) => {
  const [sessions, setSessions] = useState<AuthSession[]>([]); const [open, setOpen] = useState<AuthSession | null>(null);
  const load = () => ac.getAuthSessions(jobId).then(setSessions); useEffect(() => { void load(); }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div data-testid="auth-capture-panel" className="space-y-2">
    <div className="flex items-center gap-2 text-xs"><Button size="sm" variant="primary" data-testid="auth-start" onClick={() => void ac.startAuthSession(jobId).then((s) => { setOpen(s); void load(); })}><Camera size={12} /> Start guided capture · 11 steps</Button><span className="text-ink-400">IPEVO for wide shots · microscope for dial / hands / bezel / rehaut · per-step Fake / Unsure flag</span></div>
    {sessions.map((s) => <div key={s.id} data-testid={`auth-session-${s.id}`} className="rounded-md border border-line p-2 text-xs">
      <div className="flex items-center gap-2"><span className="font-semibold text-ink">{s.shots.length} of {ac.AUTH_STEPS.length} steps</span><span className="text-ink-500">{s.by} · {fmtDate(s.startedAt)}{s.completedAt ? ' · complete' : ' · in progress'}</span>{ac.flagSummary(s).length ? <span data-testid={`auth-session-flags-${s.id}`} className="rounded-sm bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">{ac.flagSummary(s).join(' · ')}</span> : <span className="rounded-sm bg-moss-50 px-1.5 py-0.5 font-medium text-moss-700">all default-authentic</span>}{!s.completedAt && <Button size="sm" className="ml-auto" data-testid={`auth-resume-${s.id}`} onClick={() => setOpen(s)}>Resume</Button>}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">{ac.AUTH_STEPS.map((st, i) => { const sh = s.shots.find((x) => x.step === st.key); return <figure key={st.key} data-testid={`auth-thumb-${s.id}-${st.key}`} data-flag={sh?.flag ?? 'none'} className="w-[84px]">{sh ? <img src={sh.dataUrl} alt="" className={`h-14 w-full rounded-sm object-cover ring-2 ${sh.flag === 'authentic' ? 'ring-line' : sh.flag === 'unsure' ? 'ring-amber-400' : 'ring-rose-500'}`} /> : <div className="grid h-14 w-full place-items-center rounded-sm bg-canvas text-ink-300">{i + 1}</div>}<figcaption className="truncate text-[9px] text-ink-500">{i + 1} · {st.label} <span className="uppercase text-ink-400">{st.cam === 'ipevo' ? 'ipevo' : 'micro'}</span>{sh && sh.flag !== 'authentic' && <b className={sh.flag === 'unsure' ? 'text-amber-700' : 'text-rose-700'}> · {sh.flag}</b>}</figcaption></figure>; })}</div>
    </div>)}
    {open && <GuidedAuthCapture session={open} onShot={(s) => { setOpen(s); void load(); }} onClose={() => { setOpen(null); void load(); }} />}
  </div>;
};

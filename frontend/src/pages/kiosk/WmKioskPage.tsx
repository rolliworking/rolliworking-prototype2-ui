import { AtSign, Camera, Check, ChevronRight, Microscope, ScanLine, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { KioskSession, KioskStatus, ScanResolution } from '@/api/client';
import { flagToHitlist } from '@/api/hitlist';
import { Button, PageHeader } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { camKind, placeholderFrame, useStepCamera, type StepCam } from '@/hooks/useStepCamera';

// Camera header shared by both kiosk modes — same dual-camera plumbing as the guided authentication capture (auto per step, manual override)
const CamBar = ({ cam, stepKey, title, hint, onClose, children }: { cam: StepCam; stepKey: string; title: string; hint?: string; onClose: () => void; children: (c: ReturnType<typeof useStepCamera>) => React.ReactNode }) => {
  const c = useStepCamera(cam, stepKey);
  return <div data-testid="wmk-capture" data-cam={cam} data-device={c.active.label} className="fixed inset-0 z-[85] flex flex-col bg-black/90 text-white">
    <div className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className="text-base font-semibold" data-testid="wmk-capture-title">{title}</span>{hint && <span className="text-xs text-white/60">{hint}</span>}
      <span data-testid="wmk-capture-cam" className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-[11px] uppercase ${cam === 'ipevo' ? 'bg-white/20' : 'bg-cyan-500/30 text-cyan-100'}`}>{cam === 'ipevo' ? <Camera size={11} /> : <Microscope size={11} />} {cam === 'ipevo' ? 'IPEVO cam' : 'Microscope cam'}</span>
      <label className="ml-auto inline-flex items-center gap-2 rounded-md bg-white/10 px-2.5 py-1 text-xs"><span className="text-white/60">Active camera</span><select data-testid="wmk-camera-select" value={c.active.deviceId} onChange={(e) => c.setManual(e.target.value)} className="max-w-[240px] bg-transparent font-medium text-white focus:outline-none">{c.cams.map((d) => <option key={d.deviceId} value={d.deviceId} className="text-black">{d.label}</option>)}</select><span data-testid="wmk-camera-mode" className="rounded-sm bg-white/20 px-1.5 text-[10px] uppercase">{c.manual ? 'manual' : 'auto'}</span></label>
      <span className="text-xs text-white/60">{c.status === 'ready' ? 'camera live' : 'no camera — placeholder frames'}</span>
      <button data-testid="wmk-capture-close" onClick={onClose} className="rounded-full bg-white/10 p-1.5" aria-label="Close"><X size={16} /></button>
    </div>
    <div className="relative mx-auto grid w-full max-w-5xl flex-1 grid-cols-[1fr_340px] gap-4 px-5 py-4">
      <div className="relative"><video ref={c.videoRef} autoPlay playsInline muted className={`h-full max-h-[56vh] w-full rounded-xl bg-black object-cover ${cam === 'microscope' ? 'ring-4 ring-cyan-400/60' : ''}`} /><span className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 text-xs">{c.active.label}</span></div>
      <div className="space-y-3 rounded-xl bg-white/5 p-3 text-sm">{children(c)}</div>
    </div>
  </div>;
};

// Required 4-step sequence — Scan → dial front → dial back → movement back → case back → FINISHED
const GuidedKiosk = ({ session, onShot, onClose }: { session: KioskSession; onShot: (s: KioskSession) => void; onClose: () => void }) => {
  const [idx, setIdx] = useState(Math.min(session.shots.length, api.KIOSK_STEPS.length - 1)); const step = api.KIOSK_STEPS[idx]; const total = api.KIOSK_STEPS.length; const [shot, setShot] = useState<string | null>(null);
  useEffect(() => { setShot(session.shots.find((s) => s.step === step.key)?.dataUrl ?? null); }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps
  return <CamBar cam={step.cam} stepKey={step.key} title={`Step ${idx + 1} of ${total} · ${step.label}`} hint={step.hint} onClose={onClose}>{(c) => <>
    <div data-testid="wmk-step" data-step={idx + 1} data-step-key={step.key} className="flex flex-wrap gap-1">{api.KIOSK_STEPS.map((s, i) => { const done = session.shots.some((x) => x.step === s.key); return <button key={s.key} type="button" data-testid={`wmk-step-${s.key}`} data-state={done ? 'done' : i === idx ? 'current' : 'todo'} onClick={() => setIdx(i)} className={`h-7 rounded-full border px-2.5 text-[11px] ${i === idx ? 'border-white bg-white text-black' : done ? 'border-emerald-400/60 text-emerald-200' : 'border-white/20 text-white/60'}`}>{i + 1} · {s.label}{s.cam === 'microscope' ? ' ·µ' : ''}</button>; })}</div>
    {shot && <img src={shot} alt="" data-testid="wmk-shot-preview" className="h-32 w-full rounded-md object-cover ring-2 ring-white" />}
    <div className="flex items-center gap-2"><button type="button" data-testid="wmk-shutter" onClick={() => { const r = c.capture(); setShot(r.dataUrl || placeholderFrame(step.label, step.cam)); }} className="h-14 w-14 rounded-full border-4 border-white bg-white/20" aria-label="Shutter" /><Button variant="primary" data-testid="wmk-next" disabled={!shot} onClick={async () => { const s = await api.recordKioskShot(session.id, { step: step.key, dataUrl: shot!, device: c.active.label, cam: camKind(c.active.label, step.cam) }); onShot(s); if (idx < total - 1) setIdx(idx + 1); else onClose(); }} className="flex-1">{idx < total - 1 ? <>Next <ChevronRight size={14} /></> : <><Check size={14} /> Finished</>}</Button></div>
    <p className="text-[10px] text-white/40">Camera per step is a PROPOSED default (microscope ×3, IPEVO for case back) — override above if the shot needs the other camera.</p>
  </>}</CamBar>;
};

// Ad-hoc photo — same "flag to" mechanism as every other photo-with-note in the system (Inbox + Pinned hitlist), extended to multiple @-mentions
const AdHocKiosk = ({ jobId, watchmaker, onDone, onClose }: { jobId: string; watchmaker: string; onDone: (msg: string) => void; onClose: () => void }) => {
  const [shot, setShot] = useState<string | null>(null); const [note, setNote] = useState(''); const [tags, setTags] = useState<string[]>(['MH']); const [busy, setBusy] = useState(false);
  const people = api.getDivisionStaff('rolliworks').filter((u) => u.shortName !== watchmaker);
  const send = async (c: ReturnType<typeof useStepCamera>) => { if (!shot) return; setBusy(true); try { const photo = await api.addKioskPhoto(jobId, shot, c.active.label, note); for (const t of tags) await flagToHitlist({ to: { type: 'user', shortName: t }, text: note.trim() || undefined, photo, jobId, from: watchmaker }); onDone(`Photo added to the job${tags.length ? ` · pinged ${tags.map((t) => `@${t}`).join(' ')}` : ''}`); onClose(); } finally { setBusy(false); } };
  return <CamBar cam="ipevo" stepKey="adhoc" title="Add a photo to this job" hint="defect · pre-existing damage · parts-approval support" onClose={onClose}>{(c) => <>
    {shot ? <img src={shot} alt="" data-testid="wmk-adhoc-preview" className="h-32 w-full rounded-md object-cover ring-2 ring-white" /> : <div className="grid h-32 place-items-center rounded-md border border-dashed border-white/20 text-xs text-white/50">No photo yet — press the shutter</div>}
    <button type="button" data-testid="wmk-adhoc-shutter" onClick={() => { const r = c.capture(); setShot(r.dataUrl || placeholderFrame('Ad-hoc', 'ipevo')); }} className="h-12 w-12 rounded-full border-4 border-white bg-white/20" aria-label="Shutter" />
    <textarea data-testid="wmk-adhoc-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What does this show, and why are you sending it?" className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-white/40" />
    <div className="text-xs text-white/60"><AtSign size={11} className="inline" /> Ping for review</div>
    <div data-testid="wmk-adhoc-tags" className="flex flex-wrap gap-1.5">{people.map((u) => { const on = tags.includes(u.shortName); return <button key={u.id} type="button" data-testid={`wmk-tag-${u.shortName}`} aria-pressed={on} onClick={() => setTags((v) => (on ? v.filter((x) => x !== u.shortName) : [...v, u.shortName]))} className={`h-7 rounded-full border px-2.5 text-[11px] font-semibold ${on ? 'border-white bg-white text-black' : 'border-white/20 text-white/70'}`}>@{u.shortName}{u.shortName === 'Vienna' ? ' (VC)' : ''}</button>; })}</div>
    <Button variant="primary" data-testid="wmk-adhoc-send" disabled={!shot || busy} onClick={() => void send(c)} className="w-full"><Check size={14} /> Add photo{tags.length ? ` & ping ${tags.map((t) => `@${t}`).join(' ')}` : ''}</Button>
    <p className="text-[10px] text-white/40">Attributed to {watchmaker} (the job's assigned watchmaker). Replies land on {watchmaker}'s hitlist / bench iPad, not this kiosk.</p>
  </>}</CamBar>;
};

export default function WmKioskPage() {
  const [q, setQ] = useState(''); const [res, setRes] = useState<ScanResolution | null>(null); const [status, setStatus] = useState<KioskStatus | null>(null); const [err, setErr] = useState<string | null>(null); const [flash, setFlash] = useState<string | null>(null);
  const [guided, setGuided] = useState<KioskSession | null>(null); const [adhoc, setAdhoc] = useState(false);
  const required = api.kioskRequiredSetting();
  const load = async (jobId: string) => setStatus(await api.getKioskStatus(jobId));
  const scan = async () => { setErr(null); const r = await api.resolveScan(q); if (!r?.job) { setErr(`No job matched “${q.trim()}” — scan the job label (ref-serial or PDF417) or enter the job #`); return; } setRes(r); setQ(''); await load(r.job.id); };
  const job = res?.job;
  return <div data-testid="wm-kiosk-page" className="mx-auto max-w-4xl space-y-4">
    <PageHeader title="Watchmaker room · photo kiosk" subtitle={`Shared station · microscope + IPEVO · no login — attribution comes from the scanned job’s assigned watchmaker · required set is ${required ? 'ON' : 'OFF'} (Setup)`} />
    <Card title="1 · Scan the job label" subtitle="Ref-serial or PDF417 — resolves straight to the job, no name lookup" testId="wmk-scan-card">
      <div className="relative"><ScanLine size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input data-testid="wmk-scan" autoFocus value={q} onChange={(e) => { setQ(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void scan(); } }} placeholder="Scan · E02014 · 126610LN-7F2K9R41 · PDF417 payload" autoComplete="off" className="h-12 w-full rounded-sm border-2 border-ink bg-surface pl-10 pr-28 font-mono text-base tracking-wide focus:outline-none" /><Button data-testid="wmk-scan-go" disabled={!q.trim()} onClick={() => void scan()} className="absolute right-1.5 top-1/2 -translate-y-1/2">Look up</Button></div>
      {err && <p data-testid="wmk-scan-error" className="mt-2 text-xs text-rose-700">{err}</p>}
    </Card>
    {flash && <div data-testid="wmk-flash" className="rounded-sm bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-700">{flash}</div>}
    {job && status && <Card title={`2 · ${job.number}`} subtitle={`${res!.client.firstName} ${res!.client.lastName}${res!.watch ? ` · ${res!.watch.brand} ${res!.watch.model}` : ''}`} testId="wmk-job-card">
      <div className="flex flex-wrap items-center gap-2 text-xs"><span data-testid="wmk-watchmaker" className="rounded-sm bg-ink px-2 py-0.5 font-semibold text-white">Attributed to {status.watchmaker}</span><span className="text-ink-500">assigned watchmaker on the job · not a kiosk login</span><Link to={`/jobs/${job.id}`} className="ml-auto font-mono text-brand hover:underline">open job</Link></div>
      <div data-testid="wmk-required" data-required={status.required} data-done={status.done} className={`mt-3 rounded-md border p-3 ${!status.required ? 'border-line bg-canvas/60' : status.done ? 'border-moss-200 bg-moss-50' : 'border-amber-300 bg-amber-50'}`}>
        <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink">{status.required ? (status.done ? <><Check size={14} className="text-moss-700" /> Required photo set complete</> : 'Required photo set outstanding') : 'No required set for this job'}<span className="text-xs font-normal text-ink-500">· {status.reason}</span></div>
        {status.session && <div data-testid="wmk-session-shots" className="mt-2 flex flex-wrap gap-1.5">{api.KIOSK_STEPS.map((k, i) => { const sh = status.session!.shots.find((x) => x.step === k.key); return <figure key={k.key} data-testid={`wmk-thumb-${k.key}`} data-done={!!sh} className="w-[96px]">{sh ? <img src={sh.dataUrl} alt="" className="h-16 w-full rounded-sm object-cover ring-1 ring-line" /> : <div className="grid h-16 place-items-center rounded-sm bg-canvas text-ink-300">{i + 1}</div>}<figcaption className="truncate text-[9px] text-ink-500">{i + 1} · {k.label} <span className="uppercase text-ink-400">{k.cam === 'ipevo' ? 'ipevo' : 'micro'}</span></figcaption></figure>; })}</div>}
        {status.required && !status.done && <Button variant="primary" data-testid="wmk-start-guided" className="mt-3" onClick={() => void api.startKioskSession(job.id).then((s) => setGuided(s))}><Camera size={13} /> {status.session ? 'Resume' : 'Start'} required 4-step set</Button>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><Button data-testid="wmk-adhoc" onClick={() => setAdhoc(true)}><Camera size={13} /> Add a photo to this job</Button><span className="text-xs text-ink-500">defect · pre-existing damage · parts-approval support · @-mention for review</span><Button variant="ghost" data-testid="wmk-clear" className="ml-auto" onClick={() => { setRes(null); setStatus(null); }}>Done — next watch</Button></div>
    </Card>}
    {guided && job && <GuidedKiosk session={guided} onShot={(s) => { setGuided(s); void load(job.id); }} onClose={() => { setGuided(null); void load(job.id).then(() => setFlash('Required photo set saved — bench task clears for the assigned watchmaker')); }} />}
    {adhoc && job && status && <AdHocKiosk jobId={job.id} watchmaker={status.watchmaker} onDone={setFlash} onClose={() => { setAdhoc(false); void load(job.id); }} />}
  </div>;
}

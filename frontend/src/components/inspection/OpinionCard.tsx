import { AlertTriangle, Camera, Database, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as il from '@/api/inspectionLabels';
import type { LabelComponent } from '@/api/inspectionLabels';
import { useAuth } from '@/auth/AuthContext';
import { CollapsedCard } from '@/components/jobs/CollapsedCard';
import { GuidedShotCapture, ShotGrid } from './GuidedShots';
import { OpinionDotsRow } from './OpinionBits';
import { OpinionRow } from './OpinionRow';

// Specimen capture gate (item 7) — any Aftermarket / Counterfeit → full controlled shot list before release; manager waive with reason; optional "Offer to acquire" → job note + MH inbox
export const SpecimenBanner = ({ jobId, onChange, compact }: { jobId: string; onChange: () => void; compact?: boolean }) => {
  const { user } = useAuth(); const s = il.specimenStatus(jobId); const [reason, setReason] = useState('');
  if (!s.required) return null;
  return <div data-testid="specimen-banner" data-done={s.done} data-waived={!!s.waived} className={`rounded-md border px-3 py-2 text-xs ${s.done || s.waived ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-300 bg-rose-50 text-rose-900'}`}>
    <div className="flex flex-wrap items-center gap-2"><ShieldAlert size={13} /><span className="font-semibold">Specimen capture {s.done ? 'complete' : s.waived ? 'waived' : 'PENDING'}</span><span>· {s.flagged.map((c) => il.componentLabel(c)).join(', ')} marked not genuine → full controlled shot list on every component before release / pickup</span>
      {!compact && <label className="ml-auto inline-flex items-center gap-1"><input type="checkbox" data-testid="specimen-offer-acquire" checked={s.offerToAcquire} onChange={(e) => { il.setOfferToAcquire(jobId, e.target.checked); onChange(); }} /> Offer to acquire (note + MH inbox)</label>}</div>
    {s.waived && <div data-testid="specimen-waived" className="mt-1">Waived by {s.waived.by} — “{s.waived.reason}”</div>}
    {!s.done && !s.waived && <div className="mt-1.5 flex flex-wrap items-center gap-2"><span data-testid="specimen-missing">Missing controlled shots: {s.missing.map((m) => `${m.label} ${m.have}/${m.total}`).join(' · ') || 'none'}</span>
      {user?.accessTier === 'manager' && !compact && <span className="ml-auto inline-flex items-center gap-1"><input data-testid="specimen-waive-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Waive reason (manager)" className="h-7 rounded-md border border-rose-300 bg-white px-2 text-xs" /><button type="button" data-testid="specimen-waive" disabled={!reason.trim()} onClick={() => { il.waiveSpecimen(jobId, reason.trim()); onChange(); }} className="h-7 rounded-md bg-rose-700 px-2 font-semibold text-white disabled:opacity-40">Waive</button></span>}</div>}
  </div>;
};

// Job page Inspection card — collapsed header = per-component dots (G-orig / G-service / AM / CF / U); expanded = scantron rows with initials, confidence, tags, revisions + the guided shot grid per component
export const OpinionCard = ({ jobId, onChange }: { jobId: string; onChange?: () => void }) => {
  il.ensureSeed(); const [tick, setTick] = useState(0); const [shoot, setShoot] = useState<LabelComponent | null>(null); const { station } = useAuth();
  const bump = () => { setTick((t) => t + 1); onChange?.(); }; const done = il.latestLabels(jobId).length; const wm8 = il.watchm8Export(jobId).length;
  return <CollapsedCard title="Inspection · opinion labels" count={done} subtitle={<span className="inline-flex items-center gap-2"><OpinionDotsRow jobId={jobId} key={tick} />{done < il.COMPONENTS.length && <span>{il.COMPONENTS.length - done} rows open</span>}{il.sheetComplete(jobId) && <span className="text-emerald-700">sheet complete</span>}</span>} testId="job-opinions">
    <div className="space-y-3" data-testid="job-opinions-body" data-tick={tick}>
      <p className="text-[11px] text-ink-500">Opinions are revisable — nothing here is a verdict. Every row inherits ref · serial era · model from the job; every saved row writes a label to m3ke (<code>inspection_opinion</code>) and the read-only WatchM8 export.</p>
      <SpecimenBanner jobId={jobId} onChange={bump} />
      {il.COMPONENTS.map((c) => { const p = il.listProgress(jobId, c.key); return <div key={c.key} className="space-y-1.5">
        <OpinionRow jobId={jobId} component={c.key} onSaved={bump} />
        {il.shotLists[c.key].length > 0 && <div className="flex flex-wrap items-start gap-3 px-1">
          <button type="button" data-testid={`shoot-${c.key}`} onClick={() => setShoot(c.key)} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-line px-2 text-[11px] text-ink-700 hover:border-ink-300"><Camera size={12} /> {p.complete ? 'Retake shots' : p.have ? `Resume shots · ${p.have}/${p.total}` : `Shoot list · ${p.total}`}</button>
          <ShotGrid jobId={jobId} component={c.key} onRetake={() => setShoot(c.key)} />
        </div>}
      </div>; })}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-2 text-[11px] text-ink-500"><Database size={12} /> <span data-testid="job-wm8-count">{wm8} WatchM8 record{wm8 === 1 ? '' : 's'} from this job</span><Link to="/setup/inspection" className="text-brand hover:underline">Setup → Inspection (variant sets · shot lists · tags · export)</Link>{!station && <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle size={11} /> no station — shots stamp as ad-hoc</span>}</div>
    </div>
    {shoot && <GuidedShotCapture jobId={jobId} component={shoot} onShot={bump} onClose={() => { setShoot(null); bump(); }} />}
  </CollapsedCard>;
};

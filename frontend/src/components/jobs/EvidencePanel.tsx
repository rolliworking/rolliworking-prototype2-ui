import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { EvidenceItem, EvidenceSlot, Job, PackagePhoto, PartsGrade } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { PhotoCapture } from '@/components/intake/ReceiveBits';
import { field } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fmtDate } from '@/lib/format';

const slotLabel = (k: EvidenceSlot) => api.EVIDENCE_SLOTS.find((s) => s.key === k)!.label;

export const EvidenceThumb = ({ e }: { e: EvidenceItem }) => (
  <figure data-testid={`evidence-${e.id}`} className="w-[150px] shrink-0">
    <img src={e.photo.dataUrl} alt={slotLabel(e.slot)} className="h-[92px] w-full rounded-md border border-line object-cover" />
    <figcaption className="mt-1 text-[11px] leading-tight text-ink-600"><span className="font-medium text-ink">{slotLabel(e.slot)}</span>{e.depthRating && <span data-testid={`evidence-depth-${e.id}`} className="ml-1 rounded bg-teal-50 px-1 font-mono text-[10px] text-teal-800">{e.depthRating}</span>}{e.grades?.map((g) => <span key={g} data-testid={`evidence-grade-${e.id}-${g}`} className="ml-1 rounded bg-amber-50 px-1 font-mono text-[10px] text-amber-800">{g}</span>)}{e.note && <div className="text-ink-400">{e.note}</div>}<div className="text-ink-400">{fmtDate(e.at)} · {e.by} · {e.station}</div></figcaption>
  </figure>
);

// Job detail: four-slot capture at QC, keyed to the watch label
export function EvidencePanel({ job, run }: { job: Job; run: (a: () => Promise<unknown>, m: string) => Promise<void> }) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [slot, setSlot] = useState<EvidenceSlot | null>(null);
  const [scan, setScan] = useState('');
  const [depth, setDepth] = useState('');
  const [grades, setGrades] = useState<PartsGrade[]>([]);
  const [photo, setPhoto] = useState<PackagePhoto | null>(null);
  const reload = () => api.getEvidenceForJob(job.id).then(setItems);
  useEffect(() => { void reload(); }, [job.id, job.timeline.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const required = api.EVIDENCE_REQUIRED[job.kind];
  const gaps = api.evidenceGaps(job);
  const save = () => run(async () => { if (!slot || !photo) throw new Error('Take or upload the photo first'); await api.captureEvidence(job.id, { slot, photo, labelScan: scan, depthRating: depth, grades }); setSlot(null); setPhoto(null); setDepth(''); setGrades([]); await reload(); }, 'Evidence filed');
  return (
    <div data-testid="evidence-panel" className="space-y-3">
      <div className="text-[11px] text-ink-500">Expected for <b>{api.JOB_KIND_CONFIG[job.kind].label}</b>: {required.map(slotLabel).join(' · ')} {job.kind !== 'service' && <Provisional note="Reduced slot set for small_job / warranty — MH has not ruled the exact set" />}{job.status === 'testing' && gaps.length > 0 && <span data-testid="evidence-gate" className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">QC pass blocked · missing {gaps.map(slotLabel).join(', ')}</span>}</div>
      <div className="grid grid-cols-4 gap-2">{api.EVIDENCE_SLOTS.map((s) => { const have = items.filter((e) => e.slot === s.key); const need = required.includes(s.key); return <button key={s.key} data-testid={`evidence-slot-${s.key}`} onClick={() => { setSlot(s.key); setPhoto(null); }} className={`rounded-md border p-2 text-left text-xs transition-colors hover:bg-canvas ${have.length ? 'border-moss-200 bg-moss-50/40' : need ? 'border-amber-200' : 'border-line'} ${slot === s.key ? 'ring-2 ring-ink/20' : ''}`}><div className="font-medium text-ink">{s.label} {have.length > 0 && <span className="text-moss-700">✓{have.length > 1 ? have.length : ''}</span>}</div><div className="text-[10px] text-ink-400">{s.hint}</div></button>; })}</div>
      {slot && <div data-testid="evidence-capture" className="space-y-2 rounded-md border border-line bg-canvas/50 p-3">
        <label className="block text-xs text-ink-500">Scan / enter the watch label (job # · ref · serial)<input data-testid="evidence-scan" autoFocus value={scan} onChange={(e) => setScan(e.target.value)} placeholder={`${job.number} or ref/serial`} className={`${field} mt-1 block w-full font-mono`} /></label>
        {slot === 'pressure_test' && <label className="block text-xs text-ink-500">Depth rating tested<input data-testid="evidence-depth" value={depth} onChange={(e) => setDepth(e.target.value)} placeholder="50M/164ft" className={`${field} mt-1 block w-40 font-mono`} /></label>}
        {slot === 'parts_grading' && <div className="text-xs text-ink-500">Grades<div className="mt-1 flex gap-2">{api.PARTS_GRADES.map((g) => <label key={g} className="inline-flex items-center gap-1 font-mono"><input data-testid={`evidence-grade-${g}`} type="checkbox" checked={grades.includes(g)} onChange={(e) => setGrades(e.target.checked ? [...grades, g] : grades.filter((x) => x !== g))} />{g}</label>)}</div></div>}
        {slot === 'timing_sheet' && <div className="text-[11px] text-ink-500">Convention: <b>before</b> on the left · <b>after</b> on the right</div>}
        {photo ? <div className="flex items-center gap-2 text-xs"><img src={photo.dataUrl} alt="" className="h-14 rounded border border-line" /><span className="text-moss-700">photo ready</span><Button size="sm" variant="ghost" onClick={() => setPhoto(null)}>retake</Button></div> : <PhotoCapture onAdd={(p) => setPhoto(p[0] ?? null)} />}
        <div className="flex justify-end gap-2"><Button size="sm" onClick={() => setSlot(null)}>Cancel</Button><Button size="sm" variant="primary" data-testid="evidence-save" onClick={save}>File {slotLabel(slot)}</Button></div>
      </div>}
      {items.length > 0 && <div className="flex flex-wrap gap-3">{items.map((e) => <EvidenceThumb key={e.id} e={e} />)}</div>}
    </div>
  );
}

// Client 360 / watch pages: grouped by service date
export function EvidenceSection({ clientId, watchId, title = 'Service evidence' }: { clientId?: string; watchId?: string; title?: string }) {
  const [rows, setRows] = useState<(EvidenceItem & { jobNumber: string; serviceDate: string; watchLabel?: string })[]>([]);
  useEffect(() => { if (clientId) api.getEvidenceForClient(clientId).then(setRows); else if (watchId) api.getEvidenceForWatch(watchId).then(setRows); }, [clientId, watchId]);
  const groups = Array.from(new Set(rows.map((r) => r.serviceDate))).sort().reverse();
  return (
    <Card title={title} subtitle={`${rows.length} items · grouped by service date · hidden serial, timing sheet, pressure test, parts grading`} testId="evidence-section">
      {!rows.length && <p className="text-xs text-ink-400">No evidence on file.</p>}
      <div className="space-y-3">{groups.map((d) => { const g = rows.filter((r) => r.serviceDate === d); return <div key={d} data-testid={`evidence-group-${d}`}><div className="mb-1 text-[11px] font-semibold text-ink-600">{fmtDate(d)} · <span className="font-mono">{g[0].jobNumber}</span>{g[0].watchLabel && <> · {g[0].watchLabel}</>}</div><div className="flex flex-wrap gap-3">{g.map((e) => <EvidenceThumb key={e.id} e={e} />)}</div></div>; })}</div>
    </Card>
  );
}

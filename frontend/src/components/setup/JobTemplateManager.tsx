import { AlertTriangle, Check, Copy, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { DeptCode, LineType } from '@/api/client';
import * as jt from '@/api/jobTemplates';
import type { JobTemplate, JobTemplateInput } from '@/api/jobTemplates';
import { field, Flash } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { DeptBadge } from '@/components/ui/Pills';
import { fmtDate, fmtMoneyCents } from '@/lib/format';

const DEPTS: DeptCode[] = ['W', 'B', 'P', 'PM'];
const DeptToggle = ({ value, onChange, testId }: { value: DeptCode[]; onChange: (d: DeptCode[]) => void; testId: string }) => <div className="flex gap-1" data-testid={testId}>{DEPTS.map((d) => <button key={d} type="button" data-testid={`${testId}-${d}`} aria-pressed={value.includes(d)} onClick={() => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d])} className={`rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold ${value.includes(d) ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-400 hover:bg-canvas'}`}>{d}</button>)}</div>;

// Job Template Manager — lives under Bill Audit (MH relocation). Search / filter for 100+, lines + W/B/P/PM flags, create · edit · duplicate · archive, migration review queue.
export const JobTemplateManager = () => {
  const [rows, setRows] = useState<JobTemplate[]>([]); const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [dept, setDept] = useState<DeptCode | ''>(''); const [unreviewed, setUnreviewed] = useState(false); const [archived, setArchived] = useState(false);
  const [open, setOpen] = useState<string | null>(null); const [form, setForm] = useState<JobTemplateInput | null>(null); const [msg, setMsg] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => jt.getJobTemplates({ q, category: cat || undefined, dept: dept || undefined, unreviewedOnly: unreviewed, includeArchived: archived }).then(setRows), [q, cat, dept, unreviewed, archived]);
  useEffect(() => { void load(); }, [load]);
  const run = async (fn: () => Promise<unknown>, m: string) => { try { setError(null); await fn(); await load(); setMsg(m); setTimeout(() => setMsg(null), 2500); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } };
  const counts = jt.jobTemplateCounts();
  return <div data-testid="job-template-manager" className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <input data-testid="jt-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name · category · line text" className={`${field} w-72`} />
      <select data-testid="jt-category" value={cat} onChange={(e) => setCat(e.target.value)} className={field}><option value="">All categories</option>{jt.JOB_TEMPLATE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      <select data-testid="jt-dept" value={dept} onChange={(e) => setDept(e.target.value as DeptCode | '')} className={field}><option value="">Any dept flag</option>{DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}</select>
      <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" data-testid="jt-unreviewed" checked={unreviewed} onChange={(e) => setUnreviewed(e.target.checked)} /> Show unreviewed only <span data-testid="jt-unreviewed-count" className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-900">{counts.unreviewed}</span></label>
      <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" data-testid="jt-archived" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Include archived ({counts.archived})</label>
      <span className="ml-auto text-xs text-ink-500" data-testid="jt-total">{counts.total} active templates</span>
      <Button size="sm" variant="primary" data-testid="jt-new" onClick={() => setForm({ name: '', category: jt.JOB_TEMPLATE_CATEGORIES[0], depts: ['W'], lines: [{ description: '', dept: 'W', type: 'service', qty: 1, unitPrice: 0 }] })}><Plus size={12} /> New template</Button>
    </div>
    <Flash error={error} msg={msg} />
    <Card bodyClassName="p-0" testId="jt-list">
      <ul className="divide-y divide-line/70 text-xs">{rows.map((t) => <li key={t.id} data-testid={`jt-row-${t.id}`} data-reviewed={t.reviewed} className={t.archived ? 'opacity-50' : ''}>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <button data-testid={`jt-open-${t.id}`} onClick={() => setOpen(open === t.id ? null : t.id)} className="font-medium text-ink hover:underline">{t.name}</button>
          <span className="text-ink-500">{t.category}</span>
          <span className="flex gap-0.5">{t.depts.map((d) => <DeptBadge key={d} code={d} />)}</span>
          {!t.reviewed && <span data-testid={`jt-needs-review-${t.id}`} className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900"><AlertTriangle size={10} /> Needs review · inferred {t.inferredDepts.join('/')}</span>}
          {t.archived && <span className="rounded-sm bg-canvas px-1.5 py-0.5 text-[10px] text-ink-500">archived</span>}
          <span className="ml-auto text-ink-400">{t.lines.length} lines · {fmtMoneyCents(t.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0))} · used {t.usedCount}× · {t.reviewed ? `reviewed ${t.reviewedBy} ${t.reviewedAt ? fmtDate(t.reviewedAt) : ''}` : t.source}</span>
          <span className="flex gap-1"><Button size="sm" variant="ghost" data-testid={`jt-edit-${t.id}`} onClick={() => setForm({ id: t.id, name: t.name, category: t.category, depts: t.depts, lines: t.lines.map(({ description, dept, type, qty, unitPrice }) => ({ description, dept, type, qty, unitPrice })) })}>Edit</Button><Button size="sm" variant="ghost" data-testid={`jt-dup-${t.id}`} onClick={() => run(() => jt.duplicateJobTemplate(t.id), 'Duplicated')}><Copy size={11} /></Button><Button size="sm" variant="ghost" data-testid={`jt-archive-${t.id}`} onClick={() => run(() => jt.archiveJobTemplate(t.id, !t.archived), t.archived ? 'Restored' : 'Archived')}>{t.archived ? 'Restore' : 'Archive'}</Button></span>
        </div>
        {open === t.id && <div data-testid={`jt-detail-${t.id}`} className="border-t border-line/70 bg-canvas/50 px-3 py-2">
          <table className="w-full"><tbody>{t.lines.map((l) => <tr key={l.id} data-testid={`jt-line-${l.id}`}><td className="py-0.5"><DeptBadge code={l.dept} /></td><td className="py-0.5">{l.description}</td><td className="py-0.5 capitalize text-ink-500">{l.type}</td><td className="py-0.5 text-right tabular">{l.qty} × {fmtMoneyCents(l.unitPrice)}</td></tr>)}</tbody></table>
          {!t.reviewed && <ReviewRow t={t} onDone={(m) => run(async () => undefined, m)} />}
        </div>}
      </li>)}{!rows.length && <li className="px-3 py-6 text-center text-ink-400">No templates match.</li>}</ul>
    </Card>
    {form && <TemplateForm init={form} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); void run(async () => undefined, m); }} />}
  </div>;
};

const ReviewRow = ({ t, onDone }: { t: JobTemplate; onDone: (m: string) => void }) => {
  const [d, setD] = useState<DeptCode[]>(t.depts); const [err, setErr] = useState<string | null>(null);
  return <div data-testid={`jt-review-${t.id}`} className="mt-2 flex flex-wrap items-center gap-2 rounded-sm border border-amber-200 bg-amber-50/70 px-2 py-1.5"><span className="font-medium text-amber-900">Migration review — confirm or correct the W/B/P/PM combo inferred from the lines</span><DeptToggle value={d} onChange={setD} testId={`jt-review-depts-${t.id}`} /><Button size="sm" variant="primary" data-testid={`jt-review-confirm-${t.id}`} onClick={async () => { try { await jt.reviewJobTemplate(t.id, d); onDone(`Reviewed · ${t.name}`); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } }}><Check size={11} /> {d.join() === t.inferredDepts.join() ? 'Confirm' : 'Save correction'}</Button>{err && <span className="text-rose-700">{err}</span>}</div>;
};

function TemplateForm({ init, onClose, onSaved }: { init: JobTemplateInput; onClose: () => void; onSaved: (m: string) => void }) {
  const [f, setF] = useState<JobTemplateInput>(init); const [err, setErr] = useState<string | null>(null);
  const setLine = (i: number, p: Partial<JobTemplateInput['lines'][number]>) => setF({ ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, ...p } : l)) });
  const inferred = jt.inferDepts(f.lines);
  return <Modal testId="jt-modal" title={f.id ? 'Edit job template' : 'New job template'} width="w-[720px]" onClose={onClose}>
    <div className="space-y-3 text-xs text-ink-500">
      <div className="grid grid-cols-[1fr_220px] gap-2"><label>Name<input data-testid="jt-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={`${field} mt-1 block w-full`} /></label><label>Category<select data-testid="jt-form-category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={`${field} mt-1 block w-full`}>{jt.JOB_TEMPLATE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label></div>
      <div><div className="mb-1">Lines — populate the job when applied</div><div className="space-y-1">{f.lines.map((l, i) => <div key={i} className="grid grid-cols-[1fr_70px_90px_50px_90px_28px] gap-1"><input data-testid={`jt-line-desc-${i}`} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Service / part" className={field} /><select data-testid={`jt-line-dept-${i}`} value={l.dept} onChange={(e) => setLine(i, { dept: e.target.value as DeptCode })} className={field}>{DEPTS.map((d) => <option key={d}>{d}</option>)}</select><select value={l.type} onChange={(e) => setLine(i, { type: e.target.value as LineType })} className={field}><option value="service">service</option><option value="part">part</option><option value="shipping">shipping</option></select><input type="number" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} className={`${field} text-right`} /><input data-testid={`jt-line-price-${i}`} type="number" min={0} value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })} className={`${field} text-right`} /><Button size="sm" variant="ghost" onClick={() => setF({ ...f, lines: f.lines.filter((_, k) => k !== i) })}>×</Button></div>)}</div><Button size="sm" className="mt-1" data-testid="jt-add-line" onClick={() => setF({ ...f, lines: [...f.lines, { description: '', dept: 'W', type: 'service', qty: 1, unitPrice: 0 }] })}>+ line</Button></div>
      <div className="flex flex-wrap items-center gap-2">Department flags set on the job when applied <DeptToggle value={f.depts} onChange={(d) => setF({ ...f, depts: d })} testId="jt-form-depts" /><button data-testid="jt-use-inferred" onClick={() => setF({ ...f, depts: inferred })} className="text-ink-500 underline">use inferred ({inferred.join('/') || '—'})</button></div>
      {err && <div data-testid="jt-form-error" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
      <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="jt-save" onClick={async () => { try { const t = await jt.saveJobTemplate(f); onSaved(`Template saved · ${t.name}`); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } }}>{f.id ? 'Save changes' : 'Create template'}</Button></div>
    </div>
  </Modal>;
}

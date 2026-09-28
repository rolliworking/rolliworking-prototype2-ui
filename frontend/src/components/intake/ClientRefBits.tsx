import { Barcode, Check, Mail, PenLine, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { clientRefSubject } from '@/api/client';

// Live effect of the reference on outbound mail — shown wherever the field is edited
export const SubjectPreview = ({ clientRef, sample, testId = 'client-ref-preview' }: { clientRef: string; sample: string; testId?: string }) => (
  <p data-testid={testId} data-has-ref={!!clientRef.trim()} className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500">
    <Mail size={11} className="text-ink-400" /> Email subject will read: <span data-testid={`${testId}-text`} className={`rounded-sm px-1.5 py-0.5 font-medium ${clientRef.trim() ? 'bg-amber-50 text-amber-900' : 'bg-canvas text-ink-700'}`}>{clientRefSubject(sample, clientRef)}</span>
    {!clientRef.trim() && <span className="text-ink-400">· unchanged (no reference)</span>}
  </p>
);

// Scanner-friendly: scanners type fast and finish with Enter — Enter just blurs, never submits or moves focus
export const ClientRefInput = ({ value, onChange, disabled, testId = 'client-ref-input', className = '' }: { value: string; onChange: (v: string) => void; disabled?: boolean; testId?: string; className?: string }) => (
  <div className={`relative ${className}`}>
    <Barcode size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
    <input data-testid={testId} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} placeholder="Scan or type · optional" autoComplete="off" className="h-9 w-full rounded-sm border border-line bg-canvas pl-8 pr-2.5 font-mono text-[13px] tracking-wide focus:border-ink focus:bg-surface focus:outline-none disabled:opacity-60" />
  </div>
);

// Header pill on estimate / job detail — click to edit inline, Enter/✓ saves, Esc/× cancels
export const ClientRefPill = ({ value, onSave, readOnly, sample, testId = 'client-ref' }: { value?: string; onSave: (v: string) => Promise<unknown>; readOnly?: boolean; sample: string; testId?: string }) => {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(value ?? ''); const [busy, setBusy] = useState(false);
  useEffect(() => { setDraft(value ?? ''); }, [value]);
  const save = async () => { setBusy(true); try { await onSave(draft); setEditing(false); } finally { setBusy(false); } };
  if (editing) return <span data-testid={`${testId}-editor`} className="inline-flex items-center gap-1">
    <input autoFocus data-testid={`${testId}-edit-input`} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save(); } if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); } }} placeholder="Client reference #" className="h-7 w-44 rounded-sm border border-line bg-canvas px-2 font-mono text-[11px] focus:border-ink focus:outline-none" />
    <button type="button" data-testid={`${testId}-save`} disabled={busy} onClick={() => void save()} className="text-moss-700 hover:text-moss"><Check size={13} /></button>
    <button type="button" data-testid={`${testId}-cancel`} onClick={() => { setDraft(value ?? ''); setEditing(false); }} className="text-ink-400 hover:text-ink"><X size={13} /></button>
  </span>;
  return <span className="inline-flex items-center gap-1">
    <button type="button" data-testid={`${testId}-pill`} data-value={value ?? ''} disabled={readOnly} onClick={() => setEditing(true)} title={readOnly ? 'Client reference' : `Client reference — click to edit · subject: ${clientRefSubject(sample, value)}`} className={`inline-flex h-6 items-center gap-1 rounded-sm border px-1.5 font-mono text-[11px] ${value ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-dashed border-line text-ink-400'} ${readOnly ? 'cursor-default' : 'hover:border-ink-300'}`}><Barcode size={11} />{value ? `Client ref ${value}` : 'Client ref —'}{!readOnly && <PenLine size={10} className="opacity-60" />}</button>
  </span>;
};

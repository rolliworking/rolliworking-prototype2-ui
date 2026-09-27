import { Check, Copy, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import { draftJobSummary, type SummaryFields } from '@/api/ai';

// "Generate summary" → editable draft → Copy. AI fills the fixed template's fields; a person reviews and pastes into their own reply. Nothing is sent from here.
export const JobSummaryDraft = ({ jobId, dark = false, compact = false }: { jobId: string; dark?: boolean; compact?: boolean }) => {
  const [text, setText] = useState(''); const [fields, setFields] = useState<SummaryFields | null>(null); const [source, setSource] = useState<'claude' | 'local' | null>(null); const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(false); const [err, setErr] = useState<string | null>(null);
  const gen = async () => { setBusy(true); setErr(null); setCopied(false); try { const ctx = await api.jobSummaryContext(jobId); const r = await draftJobSummary(ctx); setText(r.text); setFields(r.fields); setSource(r.source); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not draft'); } finally { setBusy(false); } };
  const copy = async () => { try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked — text stays selectable */ } setCopied(true); window.setTimeout(() => setCopied(false), 2000); };
  const btn = dark ? 'border-white/15 text-slate-100 hover:bg-white/10' : 'border-line bg-surface text-ink hover:bg-canvas'; const sub = dark ? 'text-slate-400' : 'text-ink-500';
  return <div data-testid="job-summary-draft" className={compact ? 'space-y-1.5' : 'space-y-2'}>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" data-testid="job-summary-generate" disabled={busy} onClick={() => void gen()} className={`inline-flex h-8 items-center gap-1.5 rounded-sm border px-3 text-xs font-semibold ${dark ? 'border-amber-400/60 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25' : 'border-ink bg-ink text-white hover:bg-ink/90'} disabled:opacity-50`}>{busy ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />} {text ? 'Regenerate summary' : 'Generate summary'}</button>
      {source && <span data-testid="job-summary-source" className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${source === 'claude' ? (dark ? 'bg-violet-900/60 text-violet-200' : 'bg-violet-50 text-violet-800') : (dark ? 'bg-white/10 text-slate-300' : 'bg-canvas text-ink-600 ring-1 ring-line')}`}>{source === 'claude' ? 'Claude draft · template fill' : 'Rule-based draft (AI unavailable)'}</span>}
      {fields && <span data-testid="job-summary-variant" className={`text-[10px] ${sub}`}>variant: {fields.variant}</span>}
      <span className={`ml-auto text-[10px] ${sub}`}>Draft only — review, edit, then paste into your own reply. Never sent automatically.</span>
    </div>
    {err && <div data-testid="job-summary-error" className="text-xs text-rose-600">{err}</div>}
    {text && <>
      <textarea data-testid="job-summary-text" value={text} onChange={(e) => setText(e.target.value)} rows={compact ? 5 : 6} className={`w-full rounded-sm border p-2.5 text-[13px] leading-relaxed ${dark ? 'border-white/10 bg-[#0f131a] text-slate-100' : 'border-line bg-canvas text-ink focus:border-ink focus:bg-surface'} focus:outline-none`} />
      <div className="flex items-center gap-2"><button type="button" data-testid="job-summary-copy" onClick={() => void copy()} className={`inline-flex h-8 items-center gap-1.5 rounded-sm border px-3 text-xs font-medium ${btn}`}>{copied ? <Check size={13} className="text-moss-700" /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy to clipboard'}</button><span className={`text-[10px] ${sub}`}>Paste into email / text / chat yourself.</span></div>
    </>}
  </div>;
};

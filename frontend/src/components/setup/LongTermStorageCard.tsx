import { Archive } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { LtsSettings } from '@/api/client';
import { field } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Setup → Long-term storage (MH 2026-10-02): the threshold in days (default 90) and the client notice template (one row in the message_templates store, key long_term_storage)
export const LongTermStorageCard = () => {
  const [s, setS] = useState<LtsSettings | null>(null); const [days, setDays] = useState(''); const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const load = async () => { const v = await api.getLtsSettings(); setS(v); setDays(String(v.thresholdDays)); setSubject(v.template.subject); setBody(v.template.body); };
  useEffect(() => { void load(); }, []);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setErr(null); try { await fn(); await load(); setMsg(ok); window.setTimeout(() => setMsg(null), 3000); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  if (!s) return null;
  const dirtyDays = Number(days) !== s.thresholdDays; const dirtyTpl = subject !== s.template.subject || body !== s.template.body;
  return <Card title={<span className="inline-flex items-center gap-2"><Archive size={13} className="text-indigo-700" /> Long-term storage</span>} subtitle="Finished jobs with the invoice unpaid past this many days land on MH's Hitlist card · the move into the LTS safe is a scan (never a status click) · the notice goes to the client as a Sent record" testId="setup-lts-card">
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <div className="space-y-2 text-xs">
        <label className="block text-ink-500">Days unpaid before it qualifies<input data-testid="lts-days" type="number" min={1} max={3650} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className={`${field} mt-1 block w-full font-mono`} /></label>
        <p className="text-[11px] text-ink-400">Counted from the first invoice send (fallback: order created) — same basis as Sales. Default 90.</p>
        <Button size="sm" variant="primary" data-testid="lts-days-save" disabled={!dirtyDays || !days} onClick={() => void run(() => api.setLtsThresholdDays(Number(days)), `Threshold saved · ${days} days`)}>Save threshold</Button>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between"><span className="font-medium text-ink">Client notice template</span><span className="font-mono text-[10px] text-ink-400">long_term_storage · {s.template.updatedBy}</span></div>
        <input data-testid="lts-template-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={`${field} block w-full`} />
        <textarea data-testid="lts-template-body" rows={7} value={body} onChange={(e) => setBody(e.target.value)} className={`${field} block w-full font-mono text-[11px]`} />
        <p className="text-[11px] text-ink-400">Merge fields: {'{{client.first_name}} {{watch.brand}} {{watch.model}} {{job.number}} {{storage.since}} {{balance_due}} {{portal.link}} {{shop.name}}'}</p>
        <div className="flex items-center gap-2"><Button size="sm" variant="primary" data-testid="lts-template-save" disabled={!dirtyTpl} onClick={() => void run(() => api.saveTemplate('long_term_storage', subject, body), 'Notice template saved')}>Save template</Button>{dirtyTpl && <button type="button" data-testid="lts-template-reset" onClick={() => { setSubject(s.template.subject); setBody(s.template.body); }} className="text-[11px] text-ink-500 hover:text-ink">Discard edits</button>}</div>
      </div>
    </div>
    {msg && <div data-testid="lts-flash" className="mt-3 rounded-md bg-moss-50 px-3 py-1.5 text-xs text-moss-700">{msg}</div>}
    {err && <div data-testid="lts-error" className="mt-3 rounded-md bg-rose-50 px-3 py-1.5 text-xs text-rose-700">{err}</div>}
  </Card>;
};

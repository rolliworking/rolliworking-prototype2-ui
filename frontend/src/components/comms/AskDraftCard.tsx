import { Check, RefreshCw, Send, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { ConvMessage } from '@/api/client';
import { draftJobSummary } from '@/api/ai';
import { Button } from '@/components/ui/Button';
import { fmtDate, fmtTime } from '@/lib/format';

// Portal "Ask about this" on the staff side: the client-update draft is ALREADY here (rule-based at arrival). Internal reason stays internal. Review → edit → Send once; Regenerate with Claude on demand. Never auto-sent.
export const AskDraftCard = ({ m, onDone }: { m: ConvMessage; onDone: (msg: string) => void }) => {
  const ask = m.ask!; const [text, setText] = useState(ask.text); const [busy, setBusy] = useState<'send' | 'regen' | null>(null); const [err, setErr] = useState<string | null>(null); const [source, setSource] = useState(ask.source);
  useEffect(() => { setText(ask.text); setSource(ask.source); }, [ask.text, ask.source]);
  const regen = async () => { setBusy('regen'); setErr(null); try { const ctx = await api.askContext(m.conversationId, m.id); const r = await draftJobSummary(ctx); await api.updateAskDraft(m.conversationId, m.id, { text: r.text, fields: r.fields, source: r.source }); setText(r.text); setSource(r.source); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not regenerate'); } finally { setBusy(null); } };
  const send = async () => { setBusy('send'); setErr(null); try { await api.sendAskReply(m.conversationId, m.id, text); onDone(`Update sent → portal thread + email · ${ask.jobNumber} ${ask.componentLabel.toLowerCase()}`); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not send'); } finally { setBusy(null); } };
  return <div data-testid={`ask-draft-${m.id}`} data-sent={!!ask.sentAt} data-source={source} className="mt-2 rounded-md border border-sky-200 bg-sky-50/40 p-2.5 text-xs">
    <div className="flex flex-wrap items-center gap-2"><span className="rounded-sm bg-sky-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">portal ask · {ask.componentLabel}</span><span className="font-mono text-ink-700">{ask.jobNumber}</span><span className="text-ink-500">client-update draft · {source === 'claude' ? 'Claude · template fill' : 'rule-based · template fill'} · {fmtDate(ask.generatedAt)} {fmtTime(ask.generatedAt)}</span></div>
    <div data-testid={`ask-internal-${m.id}`} className="mt-2 rounded-sm border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900"><b>Internal reason (never sent):</b> {ask.internal}</div>
    {ask.sentAt ? <div data-testid={`ask-sent-${m.id}`} className="mt-2 rounded-sm border border-line bg-surface p-2"><div className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-moss-700"><Check size={11} /> Sent {fmtDate(ask.sentAt)} {fmtTime(ask.sentAt)} by {ask.sentBy} → portal thread + email</div><div className="whitespace-pre-line text-ink-800">{ask.text}</div></div>
      : <>
        <textarea data-testid={`ask-text-${m.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={5} className="mt-2 w-full rounded-sm border border-line bg-surface p-2 text-[12px] leading-relaxed text-ink focus:border-ink focus:outline-none" />
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" data-testid={`ask-send-${m.id}`} disabled={!!busy || !text.trim()} onClick={() => void send()}><Send size={12} /> Send to client · portal + email</Button>
          <Button size="sm" data-testid={`ask-regen-${m.id}`} disabled={!!busy} onClick={() => void regen()}>{busy === 'regen' ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />} Regenerate with Claude</Button>
          <span className="text-[10px] text-ink-400">Review and edit first — one tap sends to the portal thread and queues the email. Logs on the job timeline.</span>
        </div>
        {err && <div data-testid={`ask-error-${m.id}`} className="mt-1 text-[11px] text-rose-700">{err}</div>}
      </>}
  </div>;
};

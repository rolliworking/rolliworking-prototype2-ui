import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { Assignee, Role, ConvMessage, ConversationWithRefs, InboxView, PackagePhoto, RenderedTemplate, TemplateKey, ThreadView } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Provisional } from '@/components/estimates/EstimateBits';
import { PhotoCapture } from '@/components/intake/ReceiveBits';
import { field, Flash, Head } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { fmtDate, fmtTime } from '@/lib/format';

const VIEWS: { key: InboxView; label: string }[] = [{ key: 'needs_reply', label: 'Needs reply' }, { key: 'mine', label: 'Assigned to me' }, { key: 'open', label: 'All open' }, { key: 'snoozed', label: 'Snoozed' }, { key: 'closed', label: 'Closed' }];
const SOURCE_TONE: Record<ConvMessage['source'], string> = { portal: 'bg-sky-50 text-sky-700', email: 'bg-teal-50 text-teal-800', kiosk: 'bg-slate-100 text-slate-700', approval: 'bg-moss-50 text-moss-700', photo: 'bg-violet-50 text-violet-700', parts: 'bg-amber-50 text-amber-800', pickup: 'bg-moss-50 text-moss-700', staff: 'bg-canvas text-ink-600', note: 'bg-yellow-50 text-yellow-800', system: 'bg-canvas text-ink-500' };
const age = (h: number) => (h < 1 ? 'just now' : h < 24 ? `${h}h` : `${Math.round(h / 24)}d`);

export default function InboxPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as InboxView) || 'needs_reply'; const clientId = params.get('client') ?? undefined; const threadId = params.get('thread') ?? undefined;
  const [rows, setRows] = useState<ConversationWithRefs[]>([]); const [counts, setCounts] = useState<Record<InboxView, number> | null>(null); const [thread, setThread] = useState<ThreadView | null>(null);
  const [error, setError] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const reload = async () => { setRows(clientId ? await api.getClientFolder(clientId) : await api.getInbox(view, user?.id)); setCounts(await api.getInboxCounts(user?.id)); if (threadId) { setThread(await api.getThread(threadId)); await api.markConversationRead(threadId); } else setThread(null); };
  useEffect(() => { reload().catch((e) => setError(e.message)); }, [view, clientId, threadId]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (f: () => Promise<unknown>, ok?: string) => { try { setError(null); await f(); await reload(); if (ok) { setMsg(ok); setTimeout(() => setMsg(null), 2500); } } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } };
  const go = (patch: Record<string, string | undefined>) => { const p = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k))); setParams(p); };
  return (
    <div data-testid="inbox-page" className="flex h-full flex-col gap-3">
      <Head title="Inbox — comms hub" sub={<>One thread-space per client · every send queues to the Outbox · reply-token routing shown on inbound <Provisional note="Email/kiosk/photo inbound are mocked; tokens are matched by a simulate button" /></>} />
      <Flash error={error} msg={msg} />
      <div className="grid min-h-0 flex-1 grid-cols-[170px_360px_1fr] gap-3">
        <nav data-testid="inbox-views" className="space-y-0.5">{VIEWS.map((v) => <button key={v.key} data-testid={`inbox-view-${v.key}`} onClick={() => go({ view: v.key, client: undefined, thread: undefined })} className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs ${view === v.key && !clientId ? 'bg-ink text-white' : 'text-ink-600 hover:bg-canvas'}`}><span>{v.label}</span><span data-testid={`inbox-count-${v.key}`} className={`rounded-full px-1.5 text-[10px] ${view === v.key && !clientId ? 'bg-white/20' : 'bg-canvas'}`}>{counts?.[v.key] ?? '·'}</span></button>)}
          {clientId && <div data-testid="inbox-folder-chip" className="mt-2 rounded-md border border-line px-2 py-1.5 text-[11px] text-ink-600">Folder: <b>{rows[0]?.client ? `${rows[0].client.firstName} ${rows[0].client.lastName}` : clientId}</b><button data-testid="inbox-folder-exit" onClick={() => go({ client: undefined, thread: undefined })} className="ml-1 text-brand hover:underline">× all</button></div>}
        </nav>
        <ul data-testid="inbox-list" className="min-h-0 space-y-1 overflow-y-auto pr-1">
          {rows.map((r) => <li key={r.id}><button data-testid={`thread-row-${r.id}`} onClick={() => go({ thread: r.id })} className={`w-full rounded-md border p-2 text-left text-xs transition-colors ${threadId === r.id ? 'border-ink bg-canvas' : 'border-line hover:bg-canvas/60'}`}>
            <div className="flex items-center justify-between gap-2"><span className="font-medium text-ink">{r.client.firstName} {r.client.lastName}{r.unread > 0 && <span data-testid={`thread-unread-${r.id}`} className="ml-1.5 rounded-full bg-brand px-1.5 text-[10px] font-semibold text-white">{r.unread}</span>}</span><span className="text-[10px] text-ink-400">{r.needsReply ? <span data-testid={`thread-age-${r.id}`} className="font-semibold text-rose-700">waiting {age(r.ageHours)}</span> : r.status === 'snoozed' ? `snoozed → ${fmtDate(r.snoozedUntil!)}` : r.status}</span></div>
            <div className="truncate text-ink-700">{r.subject}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-ink-400">{r.anchorLabel && <span className="rounded bg-canvas px-1 font-mono">{r.anchorLabel}</span>}{r.assigneeLabel && <span>→ {r.assigneeLabel}</span>}{r.last && <span className={`rounded px-1 ${SOURCE_TONE[r.last.source]}`}>{r.last.source}</span>}</div>
          </button></li>)}
          {!rows.length && <li className="px-2 py-6 text-center text-xs text-ink-400">Nothing here</li>}
        </ul>
        <section className="min-h-0 overflow-y-auto">{thread ? <Thread t={thread} run={run} onFolder={() => go({ client: thread.conversation.clientId, thread: thread.conversation.id })} /> : <div data-testid="thread-empty" className="grid h-full place-items-center text-xs text-ink-400">Select a thread</div>}</section>
      </div>
    </div>
  );
}

function Thread({ t, run, onFolder }: { t: ThreadView; run: (f: () => Promise<unknown>, ok?: string) => Promise<void>; onFolder: () => void }) {
  const c = t.conversation; const div = api.getSessionDivision(); const staff = api.getDivisionStaff(div); const roles = api.getDivisionRoles(div);
  const [text, setText] = useState(''); const [subject, setSubject] = useState(''); const [tpl, setTpl] = useState<TemplateKey | ''>(''); const [preview, setPreview] = useState<RenderedTemplate | null>(null); const [photos, setPhotos] = useState<PackagePhoto[]>([]); const [note, setNote] = useState(''); const [snooze, setSnooze] = useState(''); const [sim, setSim] = useState('');
  useEffect(() => { setText(''); setPreview(null); setTpl(''); setPhotos([]); }, [c.id]);
  const pickTemplate = async (k: TemplateKey | '') => { setTpl(k); if (!k) { setPreview(null); return; } const r = await api.renderTemplate(c.id, k); setPreview(r); setText(r.body); setSubject(r.subject); };
  const assign = (v: string) => { const a: Assignee | null = !v ? null : v.startsWith('role:') ? { type: 'role', role: v.slice(5) as Role } : { type: 'user', shortName: v }; return run(() => api.assignConversation(c.id, a), 'Assigned'); };
  return <div data-testid="thread-view" className="flex h-full flex-col gap-2">
    <div className="rounded-md border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-sm font-semibold text-ink">{c.subject}</span>{c.anchorLabel && <Link data-testid="thread-anchor" to={c.anchorPath ?? '#'} className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-brand hover:underline">{c.anchorLabel} →</Link>}<span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.needsReply ? 'bg-rose-50 text-rose-700' : 'bg-canvas text-ink-500'}`} data-testid="thread-status">{c.needsReply ? `needs reply · ${age(c.ageHours)}` : c.status}</span><button data-testid="thread-folder" onClick={onFolder} className="text-[11px] text-brand hover:underline">{c.client.firstName} {c.client.lastName}’s folder ({t.folder.length})</button><Link to={`/clients/${c.clientId}`} className="text-[11px] text-ink-400 hover:underline">Client 360</Link></div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <select data-testid="thread-assign" value={c.assignedTo ? (c.assignedTo.type === 'role' ? `role:${c.assignedTo.role}` : c.assignedTo.shortName) : ''} onChange={(e) => assign(e.target.value)} className={field}><option value="">Unassigned</option>{staff.map((u) => <option key={u.id} value={u.shortName}>{u.shortName}</option>)}{roles.map((r) => <option key={r} value={`role:${r}`}>role: {r}</option>)}</select>
        {c.status !== 'snoozed' && <><input data-testid="thread-snooze-date" type="date" value={snooze} onChange={(e) => setSnooze(e.target.value)} className={field} /><Button size="sm" data-testid="thread-snooze" onClick={() => run(() => api.snoozeConversation(c.id, snooze ? `${snooze}T09:00:00.000Z` : ''), 'Snoozed')}>Snooze</Button></>}
        {c.status === 'snoozed' && <Button size="sm" data-testid="thread-wake" onClick={() => run(() => api.wakeConversation(c.id), 'Woken')}>Wake now</Button>}
        {c.status !== 'closed' ? <Button size="sm" data-testid="thread-close" onClick={() => run(() => api.closeConversation(c.id), 'Closed')}>Close</Button> : <Button size="sm" data-testid="thread-reopen" onClick={() => run(() => api.reopenConversation(c.id), 'Reopened')}>Reopen</Button>}
      </div>
    </div>
    <ol data-testid="thread-messages" className="space-y-2">{t.messages.map((m) => <li key={m.id} data-testid={`msg-${m.id}`} className={`rounded-md border p-2 text-xs ${m.direction === 'internal' ? 'border-yellow-200 bg-yellow-50/60' : m.direction === 'out' ? 'ml-10 border-line bg-canvas/50' : 'mr-10 border-line bg-surface'}`}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-500"><span className={`rounded px-1 font-semibold ${SOURCE_TONE[m.source]}`} data-testid={`msg-source-${m.id}`}>{m.direction === 'internal' ? 'internal note · never sent' : m.source}</span><b className="text-ink-700">{m.by}</b>{m.station && <span>· {m.station}</span>}<span>· {fmtDate(m.at)} {fmtTime(m.at)}</span>{m.token && <span data-testid={`msg-token-${m.id}`} className="rounded bg-ink px-1 font-mono text-white">{m.token}</span>}{m.matchedToken && <span data-testid={`msg-matched-${m.id}`} className="rounded bg-moss-50 px-1 font-mono text-moss-700">↩ matched {m.matchedToken}</span>}{m.event && <span data-testid={`msg-event-${m.id}`} className="rounded bg-moss-100 px-1 text-moss-800">{m.event.label}</span>}{m.templateKey && <span className="rounded bg-canvas px-1">template {m.templateKey}</span>}{m.emailId && <Link to="/intake/outbox" className="text-brand hover:underline">Outbox</Link>}{m.direction === 'in' && !m.readByStaff && <span className="rounded bg-brand px-1 text-white">new</span>}</div>
      <div className="whitespace-pre-line text-ink-800">{m.text}</div>
      {m.photos?.length ? <div className="mt-1 flex gap-1">{m.photos.map((p) => <img key={p.id} src={p.dataUrl} alt="" className="h-12 rounded border border-line" />)}</div> : null}
    </li>)}</ol>
    <div data-testid="composer" className="rounded-md border border-line bg-surface p-3">
      <div className="flex items-center gap-2 text-xs"><span className="font-semibold text-ink">Reply</span><select data-testid="composer-template" value={tpl} onChange={(e) => pickTemplate(e.target.value as TemplateKey | '')} className={field}><option value="">Template…</option>{['intake_confirmation', 'estimate_sent', 'job_in_progress', 'back_in_progress', 'ready_for_pickup', 'shipped'].map((k) => <option key={k} value={k}>{k}</option>)}</select><span className="text-[10px] text-ink-400">merge fields fill from this thread’s client / anchor</span></div>
      {preview && <div data-testid="composer-preview" className="mt-2 rounded border border-line bg-canvas/60 p-2 text-[11px]"><div className="font-semibold text-ink">Preview · {preview.subject}</div><pre className="mt-1 whitespace-pre-wrap font-sans text-ink-700">{preview.body}</pre>{preview.missing.length > 0 && <div data-testid="composer-missing" className="mt-1 text-amber-800">Unfilled: {preview.missing.join(' ')}</div>}</div>}
      <input data-testid="composer-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={`Re: ${c.subject}`} className={`${field} mt-2 block w-full`} />
      <textarea data-testid="composer-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write to the client…" className={`${field} mt-1 block w-full`} />
      <div className="mt-2 flex items-center justify-between gap-2"><div className="flex items-center gap-2">{photos.length > 0 && <span data-testid="composer-photos" className="text-[11px] text-ink-500">{photos.length} photo{photos.length === 1 ? '' : 's'} attached</span>}<details className="text-[11px]"><summary className="cursor-pointer text-brand">Attach photos</summary><div className="mt-1"><PhotoCapture onAdd={(p) => setPhotos([...photos, ...p])} /></div></details></div><Button variant="primary" data-testid="composer-send" onClick={() => run(async () => { await api.replyInThread(c.id, { text, subject, templateKey: tpl || undefined, photos }); setText(''); setPhotos([]); setPreview(null); setTpl(''); }, 'Queued to Outbox · thread updated')}>Queue to Outbox</Button></div>
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-2"><input data-testid="note-text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note — never sent, audited" className={`${field} flex-1 bg-yellow-50/50`} /><Button size="sm" data-testid="note-save" onClick={() => run(async () => { await api.addThreadNote(c.id, note); setNote(''); }, 'Note added')}>Add note</Button></div>
      <div className="mt-2 flex items-center gap-2 text-[11px]"><Provisional note="Mock: emulates a client email reply routed back by the last outbound reply token" /><input data-testid="simulate-text" value={sim} onChange={(e) => setSim(e.target.value)} placeholder="simulate client reply…" className={`${field} flex-1`} /><Button size="sm" data-testid="simulate-inbound" onClick={() => run(async () => { await api.simulateInboundReply(c.id, sim); setSim(''); }, 'Inbound matched by token')}>Simulate inbound</Button></div>
    </div>
  </div>;
}

import { BadgeCheck, Check, Route } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { AskAnswer, BriefLine, ClientBrief, EvidenceItem, JobWithRefs, KnowledgeCard, PhotoLabel, PriceMemoryAnswer, RoutedQuestion } from '@/api/client';
import { field } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { fmtDate } from '@/lib/format';

const Err = ({ e }: { e: string | null }) => (e ? <div data-testid="companion-error" className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">{e}</div> : null);
const useErr = () => { const [e, setE] = useState<string | null>(null); const run = async (f: () => Promise<unknown>) => { try { setE(null); await f(); } catch (x) { setE(x instanceof Error ? x.message : 'Failed'); } }; return { e, run }; };
const money = (n: number) => `$${n.toLocaleString('en-US')}`;

// 1 — Price memory
export function PriceTab({ manager }: { manager: boolean }) {
  const [q, setQ] = useState(''); const [ans, setAns] = useState<PriceMemoryAnswer | null>(null); const { e, run } = useErr();
  const ask = (text: string) => run(async () => setAns(await api.priceMemory(text)));
  return <div className="space-y-2">
    <p className="text-ink-500">Ask in plain words — “how much is a crystal for a 16234”, “crown for a 2010 Daytona”.</p>
    <form className="flex gap-1" onSubmit={(ev) => { ev.preventDefault(); if (q.trim()) ask(q); }}><input data-testid="price-input" autoFocus value={q} onChange={(x) => setQ(x.target.value)} placeholder="how much is a … for a …" className={`${field} flex-1`} /><Button size="sm" variant="primary" data-testid="price-ask">Ask</Button></form>
    <Err e={e} />
    {ans && <div className="space-y-2">
      <div data-testid="price-answer-text" className={`rounded px-2 py-1.5 ${ans.resolution.clarify && !ans.candidates.length ? 'bg-amber-50 text-amber-800' : 'bg-canvas text-ink-700'}`}>{ans.text}</div>
      {ans.candidates.map((c, i) => { const ok = !!c.verified && !c.stale; return <div key={c.part.id} data-testid={`price-candidate-${c.part.id}`} className={`rounded-md border p-2 ${ok ? 'border-moss-200 bg-moss-50/40' : 'border-line'}`}>
        <div className="flex items-start justify-between gap-2"><div><span className="font-mono text-[10px] text-ink-400">#{i + 1}</span> <span className="font-mono font-semibold text-ink">{c.part.partNumber}</span> <span className="text-ink-500">{c.part.name}</span>{c.fits && ans.resolution.reference && <span className="ml-1 rounded bg-canvas px-1 text-[10px] text-ink-500">fits {ans.resolution.reference}</span>}</div>
          {ok ? <span data-testid={`price-verified-${c.part.id}`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-moss-700"><BadgeCheck size={12} /> verified</span> : <button data-testid={`price-verify-${c.part.id}`} onClick={() => run(async () => { await api.verifyPrice(c.part.id); await ask(ans.query); })} className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-500 hover:border-ink-400 hover:text-ink"><Check size={11} /> Verify</button>}</div>
        <div data-testid={`price-evidence-${c.part.id}`} className="mt-1 text-ink-600">{manager ? <>used {c.uses}× · avg <b>{money(c.avg)}</b>{c.last && <> · last {fmtDate(c.last).replace(/, \d{4}$/, '')} {new Date(c.last).getFullYear()}</>}</> : <>used {c.uses}× · price hidden for this tier</>}</div>
        {c.verified && <div className={`mt-0.5 text-[10px] ${c.stale ? 'text-amber-800' : 'text-moss-700'}`}>{c.stale && <span data-testid={`price-stale-${c.part.id}`} className="mr-1 rounded bg-amber-50 px-1 font-semibold">re-verify pricing</span>}checked by {c.verified.by} · {fmtDate(c.verified.at)} · {c.verified.station}</div>}
      </div>; })}
      <p className="text-[10px] text-ink-400">Verifications write to the <Link to="/parts/knowledge" className="text-brand hover:underline">knowledge log</Link>. Resolution via model_references fixture.</p>
    </div>}
  </div>;
}

// 2 — Client brief
export function ClientTab({ clientId }: { clientId?: string }) {
  const [brief, setBrief] = useState<ClientBrief | null>(null); const [edit, setEdit] = useState<BriefLine | null>(null); const [text, setText] = useState(''); const { e, run } = useErr();
  const load = () => clientId ? api.getClientBrief(clientId).then(setBrief) : Promise.resolve();
  useEffect(() => { setBrief(null); void load(); }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!clientId) return <p data-testid="client-brief-empty" className="text-ink-400">Open a client, job or estimate and the brief follows the record on screen.</p>;
  return <div className="space-y-2">
    <div className="flex items-center justify-between"><span className="font-semibold text-ink">Client brief</span><Button size="sm" data-testid="client-brief-refresh" onClick={() => run(load)}>Summarize this client</Button></div>
    <Err e={e} />
    {brief && <ol data-testid="client-brief" className="space-y-2">{brief.lines.map((l) => <li key={l.key} data-testid={`brief-${l.key}`} className={`rounded-md border p-2 ${l.key === 'service_debt' && brief.debt ? 'border-amber-200 bg-amber-50/50' : 'border-line'}`}>
      <div className="text-ink-800">{l.text}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-ink-400">{l.citations.map((c) => <Link key={c.hitKey + c.label} data-testid={`brief-cite-${c.hitKey}`} to={`/clients/${clientId}?hit=${c.hitKey}`} className="rounded bg-canvas px-1 font-mono text-ink-500 hover:text-brand">{c.label}</Link>)}{l.corrected && <span data-testid={`brief-corrected-${l.key}`} className="rounded bg-violet-50 px-1 text-violet-700">corrected by {l.corrected.by} · {fmtDate(l.corrected.at)}</span>}{l.moneyMasked && <span className="rounded bg-amber-50 px-1 text-amber-800">money hidden</span>}<button data-testid={`brief-correct-${l.key}`} onClick={() => { setEdit(l); setText(l.text); }} className="ml-auto text-brand hover:underline">correct</button></div>
    </li>)}</ol>}
    {edit && <div data-testid="brief-correct-form" className="space-y-1 rounded-md border border-line bg-canvas/60 p-2"><textarea data-testid="brief-correct-text" rows={3} value={text} onChange={(x) => setText(x.target.value)} className={`${field} block w-full`} /><div className="flex justify-end gap-1"><Button size="sm" onClick={() => setEdit(null)}>Cancel</Button><Button size="sm" variant="primary" data-testid="brief-correct-save" onClick={() => run(async () => { await api.correctBriefLine(clientId, edit.key, text, edit.text); setEdit(null); await load(); })}>Save correction</Button></div></div>}
  </div>;
}

// 3 — Ask the shop
export function AskTab({ manager }: { manager: boolean }) {
  const [q, setQ] = useState(''); const [ans, setAns] = useState<AskAnswer | null>(null); const [routed, setRouted] = useState<(RoutedQuestion & { task?: unknown })[]>([]); const [cards, setCards] = useState<KnowledgeCard[]>([]); const { e, run } = useErr();
  const [answering, setAnswering] = useState<RoutedQuestion | null>(null); const [form, setForm] = useState({ title: '', body: '', tags: '' });
  const load = async () => { setRouted(await api.getRoutedQuestions()); setCards(await api.getKnowledgeCards()); };
  useEffect(() => { void load(); }, []);
  const openQs = routed.filter((r) => r.status === 'open');
  return <div className="space-y-2">
    <form className="flex gap-1" onSubmit={(ev) => { ev.preventDefault(); if (q.trim()) run(async () => setAns(await api.askShop(q))); }}><input data-testid="ask-input" value={q} onChange={(x) => setQ(x.target.value)} placeholder="e.g. what's our water resistance policy?" className={`${field} flex-1`} /><Button size="sm" variant="primary" data-testid="ask-submit">Ask</Button></form>
    <Err e={e} />
    {ans && (ans.card ? <div data-testid="ask-card" className="rounded-md border border-line p-2"><div className="text-[10px] text-ink-400">{ans.text}</div><div className="font-semibold text-ink">{ans.card.title}</div><p className="mt-1 whitespace-pre-line text-ink-700">{ans.card.body}</p><div className="mt-1 text-[10px] text-ink-400">card {ans.card.id} · {ans.card.by} · {fmtDate(ans.card.at)}{ans.card.sourceTaskId && <> · from routed question</>}</div></div>
      : <div data-testid="ask-miss" className="rounded-md border border-amber-200 bg-amber-50/60 p-2"><div className="text-amber-800">{ans.text}</div><Button size="sm" variant="primary" data-testid="ask-route" onClick={() => run(async () => { await api.routeQuestion(ans.query); setAns(null); await load(); })}><Route size={12} /> Route to MH/MM</Button></div>)}
    <div className="pt-1 text-[11px] font-semibold text-ink-600">Routed questions ({openQs.length} open)</div>
    <ul className="space-y-1">{routed.map((r) => <li key={r.id} data-testid={`routed-${r.id}`} className="rounded border border-line px-2 py-1"><div className="text-ink-800">{r.question}</div><div className="flex items-center gap-2 text-[10px] text-ink-400">{r.by} · {fmtDate(r.at)} · <span className={r.status === 'answered' ? 'text-moss-700' : 'text-amber-800'}>{r.status}</span>{r.cardId && <span className="font-mono">→ {r.cardId}</span>}{manager && r.status === 'open' && <button data-testid={`routed-answer-${r.id}`} onClick={() => { setAnswering(r); setForm({ title: '', body: '', tags: '' }); }} className="ml-auto text-brand hover:underline">answer → card</button>}</div></li>)}</ul>
    {answering && <div data-testid="answer-form" className="space-y-1 rounded-md border border-line bg-canvas/60 p-2"><div className="text-[11px] text-ink-500">Answering: {answering.question}</div><input data-testid="answer-title" value={form.title} onChange={(x) => setForm({ ...form, title: x.target.value })} placeholder="Card title" className={`${field} block w-full`} /><textarea data-testid="answer-body" rows={3} value={form.body} onChange={(x) => setForm({ ...form, body: x.target.value })} placeholder="Answer" className={`${field} block w-full`} /><input data-testid="answer-tags" value={form.tags} onChange={(x) => setForm({ ...form, tags: x.target.value })} placeholder="tags, comma separated" className={`${field} block w-full`} /><div className="flex justify-end gap-1"><Button size="sm" onClick={() => setAnswering(null)}>Cancel</Button><Button size="sm" variant="primary" data-testid="answer-save" onClick={() => run(async () => { await api.answerQuestion(answering.id, form.title, form.body, form.tags.split(',')); setAnswering(null); await load(); })}>Create card & close task</Button></div></div>}
    <div className="pt-1 text-[11px] font-semibold text-ink-600">Knowledge cards ({cards.length})</div>
    <ul className="space-y-0.5">{cards.map((c) => <li key={c.id} data-testid={`card-${c.id}`} className="truncate text-ink-600">• {c.title} <span className="text-[10px] text-ink-400">{c.by}</span></li>)}</ul>
  </div>;
}

// 4 — Photo labels
export function LabelsTab({ jobId }: { jobId?: string }) {
  const [job, setJob] = useState<JobWithRefs | null>(null); const [evidence, setEvidence] = useState<EvidenceItem[]>([]); const [labels, setLabels] = useState<PhotoLabel[]>([]); const [sel, setSel] = useState<Record<string, string[]>>({}); const { e, run } = useErr();
  const load = async () => { if (jobId) { setJob(await api.getJob(jobId)); setEvidence(await api.getEvidenceForJob(jobId)); } setLabels(await api.getPhotoLabels()); };
  useEffect(() => { void load(); }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps
  const photos = [...(job?.photos.map((p) => ({ id: p.id, url: p.dataUrl, source: 'inspection' as const, title: 'Inspection photo' })) ?? []), ...evidence.map((ev) => ({ id: ev.id, url: ev.photo.dataUrl, source: 'evidence' as const, title: api.EVIDENCE_SLOTS.find((s) => s.key === ev.slot)!.label }))];
  const toggle = (pid: string, tag: string) => setSel({ ...sel, [pid]: (sel[pid] ?? []).includes(tag) ? (sel[pid] ?? []).filter((t) => t !== tag) : [...(sel[pid] ?? []), tag] });
  return <div className="space-y-2">
    {!jobId && <p data-testid="labels-empty" className="text-ink-400">Open a job to label its inspection and evidence photos. Labels are stored per photo with who-labeled provenance.</p>}
    <Err e={e} />
    {job && photos.map((p) => { const done = labels.filter((l) => l.photoId === p.id); return <div key={p.id} data-testid={`label-photo-${p.id}`} className="rounded-md border border-line p-2">
      <div className="flex items-start gap-2"><img src={p.url} alt="" className="h-12 w-16 rounded border border-line object-cover" /><div className="min-w-0 flex-1"><div className="font-medium text-ink">{p.title} <span className="text-[10px] text-ink-400">{p.source}</span></div>{done.length > 0 && <div className="mt-0.5 flex flex-wrap gap-1">{done.map((l) => l.skipped ? <span key={l.id} className="rounded bg-canvas px-1 text-[10px] text-ink-400">skipped · {l.by}</span> : l.tags.map((t) => <span key={l.id + t} data-testid={`label-tag-${p.id}-${t.replace(/[^a-z0-9]+/gi, '_')}`} className="rounded bg-violet-50 px-1 text-[10px] text-violet-700" title={`${l.by} · ${fmtDate(l.at)} · ${l.station}`}>{t}</span>))}</div>}</div></div>
      {!done.some((l) => !l.skipped) && <div className="mt-2 space-y-1">{api.LABEL_PILLS.map((g) => <div key={g.group} className="flex flex-wrap items-center gap-1"><span className="w-14 text-[10px] uppercase tracking-wide text-ink-400">{g.label}</span>{g.tags.map((t) => <button key={t} data-testid={`pill-${p.id}-${t.replace(/[^a-z0-9]+/gi, '_')}`} onClick={() => toggle(p.id, t)} className={`rounded-full border px-2 py-0.5 text-[10px] ${(sel[p.id] ?? []).includes(t) ? 'border-violet-400 bg-violet-50 text-violet-800' : 'border-line text-ink-600 hover:border-ink-400'}`}>{t}</button>)}</div>)}
        <div className="flex justify-end gap-1 pt-1"><Button size="sm" data-testid={`label-skip-${p.id}`} onClick={() => run(async () => { await api.labelPhoto({ photoId: p.id, jobId: job.id, source: p.source, tags: [], skipped: true }); await load(); })}>Skip</Button><Button size="sm" variant="primary" data-testid={`label-save-${p.id}`} onClick={() => run(async () => { await api.labelPhoto({ photoId: p.id, jobId: job.id, source: p.source, tags: sel[p.id] ?? [] }); await load(); })}>Save labels</Button></div></div>}
    </div>; })}
    {job && !photos.length && <p className="text-ink-400">No photos on this job yet.</p>}
    <div className="pt-1 text-[11px] font-semibold text-ink-600">Labels log ({labels.length})</div>
    <ul data-testid="labels-log" className="space-y-0.5">{labels.slice(0, 20).map((l) => <li key={l.id} data-testid={`labels-log-${l.id}`} className="text-[11px] text-ink-600"><span className="font-mono text-ink-400">{l.photoId}</span> · {l.skipped ? 'skipped' : l.tags.join(', ')} · {l.by} · {fmtDate(l.at)}</li>)}</ul>
  </div>;
}

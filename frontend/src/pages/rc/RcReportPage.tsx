import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { ComponentGrade, PolishChoice, PortalInspectionReport } from '@/api/client';
import { RcDecisionRecord } from '@/rc/RcDecisionRecord';
import { LinkExpired } from '@/rc/RcAuthBits';
import { RcButton, RcCard, RcError, RcLabel, rcDate } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

const GRADE: Record<ComponentGrade, { word: string; tone: string }> = { good: { word: 'Good', tone: 'bg-emerald-50 text-emerald-800' }, fair: { word: 'Fair', tone: 'bg-amber-50 text-amber-800' }, worn: { word: 'Worn', tone: 'bg-orange-50 text-orange-800' }, replace: { word: 'Needs replacing', tone: 'bg-rose-50 text-rose-800' } };

export default function RcReportPage() {
  const { token = '' } = useParams(); const navigate = useNavigate(); const { client } = useRcSession();
  const [data, setData] = useState<PortalInspectionReport | null>(null); const [error, setError] = useState<string | null>(null); const [decideError, setDecideError] = useState<string | null>(null); const [reason, setReason] = useState(''); const [polish, setPolish] = useState<PolishChoice>('light'); const [answers, setAnswers] = useState<string[]>(api.INSPECTION_SURVEY.map(() => '')); const [signature, setSignature] = useState(''); const [question, setQuestion] = useState(''); const [asked, setAsked] = useState<string | null>(null); const [declining, setDeclining] = useState(false);
  useEffect(() => { api.portalGetInspectionReport(token).then(setData).catch((e) => setError(e.message)); }, [token]);
  useEffect(() => { if (data?.newerToken) { const t = setTimeout(() => navigate(`/rc/report/${data.newerToken}`, { replace: true }), 2500); return () => clearTimeout(t); } }, [data?.newerToken, navigate]);
  if (error) return <LinkExpired message={api.LINK_EXPIRED_COPY} />;
  if (!data) return null;
  const { report: r, watch: w, photos } = data;
  const decide = (d: 'approve' | 'decline') => api.portalDecideInspectionReport(token, d, reason, { polish, survey: api.INSPECTION_SURVEY.map((q, i) => ({ q, a: answers[i] })).filter((x) => x.a.trim()), signature }).then((x) => { setData(x); setDecideError(null); setDeclining(false); }).catch((e) => setDecideError(e.message));
  return (
    <div data-testid="rc-report-page" className="space-y-6">
      {data.newerToken && <div data-testid="rc-report-superseded" className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">A newer report replaces this one — taking you to it… <Link to={`/rc/report/${data.newerToken}`} className="underline">open now</Link></div>}
      <RcCard eyebrow={`Inspection report · version ${r.version}`} title={`${w.brand} ${w.model}`} testId="rc-report-head">
        <p className="text-sm text-rc-muted">Ref. {w.reference} · inspected {rcDate(r.issuedAt)} by our {r.station.toLowerCase().includes('bench') ? 'inspection bench' : 'team'}</p>
        {r.status !== 'issued' && <p data-testid="rc-report-decided" className="mt-3 rounded-md bg-rc-paper px-3 py-2 text-sm">{r.status === 'approved' ? `You approved this report on ${rcDate(r.decidedAt!)}. Work is queued for the bench.` : r.status === 'declined' ? `You declined this report on ${rcDate(r.decidedAt!)}: “${r.declineReason}”. We’ll be in touch.` : 'Superseded.'}</p>}
      </RcCard>
      <RcCard eyebrow="Condition by component" testId="rc-report-grades">
        <ul className="divide-y divide-rc-line">{r.grades.map((g) => <li key={g.component} data-testid={`rc-grade-${g.component.replace(/[^a-z]/gi, '_')}`} className="flex items-start justify-between gap-4 py-3"><div><div className="font-medium">{g.component}</div>{g.note && <div className="text-sm text-rc-muted">{g.note}</div>}</div><span className={`rounded-full px-3 py-1 text-xs font-medium ${GRADE[g.grade].tone}`}>{GRADE[g.grade].word}</span></li>)}</ul>
      </RcCard>
      <RcCard eyebrow="Photos from the bench" testId="rc-report-photos">{photos.length ? <div className="flex flex-wrap gap-3">{photos.map((p) => <img key={p.id} src={p.dataUrl} alt="" className="h-28 w-40 rounded-md border border-rc-line object-cover" />)}</div> : <p className="text-sm text-rc-muted">No photos attached to this report.</p>}</RcCard>
      <RcCard eyebrow="Our notes" testId="rc-report-notes"><p className="whitespace-pre-line text-sm">{r.notes}</p>{data.estimate && <p className="mt-3 text-sm">The matching estimate <Link to={`/rc/estimates/${data.estimate.id}`} className="text-rc-accent underline">{data.estimate.number}</Link> reflects this report.</p>}</RcCard>
      {data.decision && <RcDecisionRecord d={data.decision} testId="rc-report-decision-record" />}
      {r.status === 'issued' && !data.newerToken && <RcCard eyebrow="Your choices" testId="rc-report-choices">
        <div className="text-[15px] font-medium">How much polish?</div>
        <div className="mt-2 flex flex-wrap gap-2">{([['none', 'None — keep every original edge'], ['light', 'Light — remove marks, keep the lines'], ['full', 'Full refinish — like new']] as [PolishChoice, string][]).map(([k, l]) => <button key={k} type="button" data-testid={`rc-polish-${k}`} aria-pressed={polish === k} onClick={() => setPolish(k)} className={`rounded-full border px-4 py-1.5 text-sm ${polish === k ? 'border-rc-ink bg-rc-ink text-white' : 'border-rc-line bg-rc-paper hover:border-rc-ink'}`}>{l}</button>)}</div>
        <div className="mt-5 space-y-3">{api.INSPECTION_SURVEY.map((q, i) => <div key={q}><RcLabel htmlFor={`rc-survey-${i}`}>{q}</RcLabel><input id={`rc-survey-${i}`} data-testid={`rc-survey-${i}`} value={answers[i]} onChange={(e) => setAnswers(answers.map((a, k) => (k === i ? e.target.value : a)))} className="mt-1 w-full rounded-md border border-rc-line bg-rc-paper px-3 py-2 text-[15px] outline-none focus:border-rc-ink" /></div>)}</div>
      </RcCard>}
      {r.status === 'issued' && !data.newerToken && !client && <RcCard eyebrow="Not sure? Ask us before you decide" testId="rc-report-ask-signin"><p className="text-[15px] text-rc-muted">Questions go through your account so a person can reply where you’ll see it. <Link to={`/rc?email=${encodeURIComponent(data.client.email)}&next=${encodeURIComponent(`/rc/report/${token}`)}`} data-testid="rc-report-ask-signin-link" className="text-rc-ink underline decoration-rc-accent underline-offset-4">Sign in to ask</Link> — this link only shows the report.</p></RcCard>}
      {r.status === 'issued' && !data.newerToken && client && <RcCard eyebrow="Not sure? Ask us before you decide" testId="rc-report-ask">
        {asked ? <p data-testid="rc-report-asked" className="text-[15px] text-rc-muted">Sent — “{asked}”. We will answer in your <Link to="/rc/messages" className="text-rc-ink underline decoration-rc-accent underline-offset-4">messages</Link>; this page stays open for your decision.</p>
          : <div className="flex flex-wrap gap-3"><input data-testid="rc-report-question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Can you leave the bracelet un-polished?" className="min-w-[280px] flex-1 rounded-md border border-rc-line bg-rc-paper px-3 py-2 text-[15px] outline-none focus:border-rc-ink" /><RcButton tone="quiet" data-testid="rc-report-ask-send" disabled={!question.trim()} onClick={() => api.portalAskAboutReport(token, question).then(() => { setAsked(question.trim()); setQuestion(''); }).catch((e) => setDecideError(e.message))}>Ask</RcButton></div>}
      </RcCard>}
      {r.status === 'issued' && !data.newerToken && <RcCard eyebrow="Your decision" testId="rc-report-decision">
        <div className="mb-4"><RcLabel htmlFor="rc-signature">Sign with your name</RcLabel><input id="rc-signature" data-testid="rc-report-signature" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Your full name" className="mt-1 w-full max-w-[360px] rounded-md border border-rc-line bg-rc-paper px-3 py-2 font-serif text-xl italic outline-none focus:border-rc-ink" /></div>
        <RcError text={decideError} />
        {!declining ? <div className="flex flex-wrap gap-3"><RcButton data-testid="rc-report-approve" onClick={() => decide('approve')}>Approve — go ahead</RcButton><RcButton tone="quiet" data-testid="rc-report-decline" onClick={() => setDeclining(true)}>Decline…</RcButton></div>
          : <div className="space-y-3"><RcLabel htmlFor="rc-decline-reason">Tell us why (required)</RcLabel><textarea id="rc-decline-reason" data-testid="rc-report-decline-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-md border border-rc-line bg-white px-3 py-2 text-sm" /><div className="flex gap-3"><RcButton data-testid="rc-report-decline-confirm" onClick={() => decide('decline')}>Send decline</RcButton><RcButton tone="quiet" onClick={() => setDeclining(false)}>Back</RcButton></div></div>}
      </RcCard>}
    </div>
  );
}

import { FileCheck2 } from 'lucide-react';
import { Fragment } from 'react';
import type { InspectionDecisionRecord } from '@/api/client';
import { RcCard, rcDate } from '@/rc/RcBits';

const POLISH: Record<InspectionDecisionRecord['polish'], string> = { none: 'No polish — original edges kept', light: 'Light polish', full: 'Full refinish' };
// Permanent record of what the client approved / declined / chose / signed — the same document staff see on the job
export const RcDecisionRecord = ({ d, testId, compact }: { d: InspectionDecisionRecord; testId?: string; compact?: boolean }) => (
  <RcCard eyebrow={`Your decisions · ${rcDate(d.decidedAt)}`} title={compact ? undefined : `Inspection report v${d.reportVersion} · ${d.jobNumber}`} testId={testId ?? `rc-decision-${d.id}`}>
    <div className="flex items-start gap-3"><FileCheck2 size={18} className="mt-0.5 shrink-0 text-emerald-700" />
      <dl className="grid flex-1 gap-2 text-[15px] sm:grid-cols-[140px_1fr]">
        <dt className="text-rc-muted">Decision</dt><dd data-testid={`${testId ?? `rc-decision-${d.id}`}-decision`} className="font-medium">{d.decision === 'approve' ? 'Approved — go ahead' : `Declined${d.reason ? ` — “${d.reason}”` : ''}`}</dd>
        <dt className="text-rc-muted">Polish</dt><dd>{POLISH[d.polish]}</dd>
        {d.survey.map((s) => <Fragment key={s.q}><dt className="text-rc-muted">{s.q}</dt><dd>{s.a}</dd></Fragment>)}
        <dt className="text-rc-muted">Signed</dt><dd className="font-serif text-lg italic">{d.signature} <span className="font-sans text-sm not-italic text-rc-muted">· {rcDate(d.decidedAt)} {new Date(d.decidedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · via {d.via === 'portal' ? 'RolliConnect' : 'our team'}</span></dd>
      </dl></div>
  </RcCard>
);

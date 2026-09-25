import { BookOpen, Link2, Tag, XCircle, BadgeCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { Part, PartsKnowledgeEntry } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { Card } from '@/components/ui/Card';
import { Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtTime } from '@/lib/format';

const ICON = { association_confirmed: Link2, alias_added: Tag, rejected: XCircle, price_verified: BadgeCheck, model_resolved: Link2 };
const TONE = { association_confirmed: 'text-moss-700', alias_added: 'text-brand', rejected: 'text-rose-700', price_verified: 'text-moss-700', model_resolved: 'text-ink-500' };

export default function PartsKnowledgePage() {
  const [log, setLog] = useState<PartsKnowledgeEntry[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  useEffect(() => { api.getPartsKnowledge().then(setLog); api.getParts().then(setParts); }, []);
  return (
    <div data-testid="parts-knowledge-page" className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Parts knowledge</h1>
        <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-ink-500">The labeling loop made visible: every supervisor approval confirms a part ↔ reference and turns the requester's own words into aliases; rejections land too <Provisional note="Scripted assistant + seeded catalog — no AI, no real supplier data" /></p>
      </div>
      <div className="grid grid-cols-[1fr_420px] gap-4">
        <Card title={<span className="inline-flex items-center gap-1.5"><BookOpen size={13} /> Knowledge log</span>} subtitle={`${log.length} entries`} testId="knowledge-log" bodyClassName="p-0">
          <ul className="divide-y divide-line/70">{log.map((e) => { const I = ICON[e.kind]; return <li key={e.id} data-testid={`knowledge-${e.id}`} className="flex items-start gap-3 px-4 py-2 text-xs"><I size={13} className={`mt-0.5 shrink-0 ${TONE[e.kind]}`} /><div className="min-w-0 flex-1"><div className="text-ink">{e.detail}</div><div className="text-[11px] text-ink-400">{e.kind.replace('_', ' ')} · <span className="font-mono">{e.partNumber}</span>{e.reference && <> · ref <span className="font-mono">{e.reference}</span></>}{e.alias && <> · alias “{e.alias}”</>} · {fmtDate(e.at)} {fmtTime(e.at)} · {e.by} · {e.station}</div></div></li>; })}</ul>
        </Card>
        <Card title="Catalog" subtitle={`${parts.length} seeded parts · aliases grow with approvals`} testId="parts-catalog" bodyClassName="p-0">
          <Table><thead><tr><Th>Part</Th><Th>Fits</Th><Th className="text-right">Stock</Th></tr></thead><tbody>{parts.map((p) => <tr key={p.id} data-testid={`catalog-${p.id}`}><Td><div className="font-mono text-xs font-semibold text-ink">{p.partNumber}</div><div className="text-xs text-ink-700">{p.name}</div><div className="text-[11px] text-ink-400" data-testid={`catalog-aliases-${p.id}`}>{p.aliases.join(' · ')}</div></Td><Td className="font-mono text-[11px] text-ink-500">{p.compatibleRefs.join(', ')}{p.calibers.length ? ` · cal. ${p.calibers.join('/')}` : ''}</Td><Td className={`tabular text-right text-xs ${p.stock === 0 ? 'text-rose-700' : ''}`}>{p.stock}</Td></tr>)}</tbody></Table>
        </Card>
      </div>
    </div>
  );
}

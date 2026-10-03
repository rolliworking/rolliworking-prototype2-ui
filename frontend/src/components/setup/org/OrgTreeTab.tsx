import clsx from 'clsx';
import { useState } from 'react';
import * as api from '@/api/client';
import type { OrgNode } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { StatusDot } from './OrgBits';
import * as org from '@/api/org';

const Node = ({ n, depth }: { n: OrgNode; depth: number }) => {
  const st = org.staffStatusSync(n.user);
  return <li data-testid={`org-node-${n.user.id}`} data-depth={depth} className="relative">
    <div className={clsx('flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-canvas', depth === 0 && 'bg-canvas font-semibold')}>
      <span className={clsx('grid h-7 w-7 place-items-center rounded-full font-mono text-[10px] font-semibold', st === 'active' ? 'bg-ink text-white' : 'bg-ink-200 text-ink-500')}>{n.user.shortName.slice(0, 2)}</span>
      <span className="text-ink">{n.user.shortName}</span><span className="text-ink-500">{n.user.dutyLabel}</span>
      <span className="text-[10px] text-ink-400">{api.entityName(n.user.division)} · {n.user.accessTier}{n.user.departmentCode ? ` · ${n.user.departmentCode}` : ''}</span>
      {st !== 'active' && <StatusDot status={st} />}
      {n.reports.length > 0 && <span className="ml-auto rounded-full bg-surface px-1.5 font-mono text-[10px] text-ink-500 shadow-card">{n.reports.length}</span>}
    </div>
    {n.reports.length > 0 && <ul className="ml-5 border-l border-line pl-2">{n.reports.map((r) => <Node key={r.user.id} n={r} depth={depth + 1} />)}</ul>}
  </li>;
};

export const OrgTreeTab = () => {
  const [tree] = useState(() => api.getOrgTree());
  const count = (n: OrgNode): number => 1 + n.reports.reduce((t, r) => t + count(r), 0);
  return <div data-testid="org-tree" className="grid grid-cols-[1fr_320px] gap-4">
    <Card title="Org tree" subtitle="Reports-to chain — data scope, view-as groups and escalation walk this tree. Edit a person's manager in Staff → Edit (or the Access control Limits drawer).">
      <ul className="space-y-1">{tree.map((n) => <Node key={n.user.id} n={n} depth={0} />)}</ul>
    </Card>
    <Card title="Entities & departments" subtitle="Who sits where">
      {org.getEntitiesSync().map((e) => <div key={e.id} data-testid={`org-entity-block-${e.id}`} className="mb-3"><div className="text-xs font-semibold text-ink">{e.name} <span className="font-mono text-[10px] text-ink-400">{e.shortName}</span></div>
        <ul className="mt-1 space-y-0.5 text-[11px] text-ink-600">{org.getDepartmentsSync().filter((d) => d.active && (d.entity === e.id || d.entity === 'both')).map((d) => { const people = api.getOrgTree().flatMap(function walk(n): string[] { return [n.user.departmentCode === d.code ? n.user.shortName : '', ...n.reports.flatMap(walk)].filter(Boolean); }); return <li key={d.code} className="flex justify-between gap-2"><span>{d.code} · {d.name}</span><span className="text-ink-400">{people.join(', ') || '—'}</span></li>; })}</ul></div>)}
      <p className="mt-2 text-[10px] text-ink-400">{tree.reduce((t, n) => t + count(n), 0)} people · {tree.length} root{tree.length === 1 ? '' : 's'}</p>
    </Card>
  </div>;
};

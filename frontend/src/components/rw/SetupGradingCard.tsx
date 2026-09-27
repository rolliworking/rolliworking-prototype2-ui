import { useCallback, useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { GradeCategory, GradeScope } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table, Td, Th } from '@/components/ui/Table';

const SCOPES: GradeScope[] = ['head', 'case', 'bracelet', 'whole'];

// Setup lookup for work-grading categories (same pattern as photo labels) — add without code changes; each applies to head / case / bracelet / whole watch
export const SetupGradingCard = () => {
  const [cats, setCats] = useState<GradeCategory[]>([]); const [label, setLabel] = useState(''); const [hint, setHint] = useState(''); const [scopes, setScopes] = useState<GradeScope[]>(['whole']); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => api.getGradeCategories().then(setCats), []);
  useEffect(() => { void load(); }, [load]);
  return <Card title="Work grading categories" subtitle="Scored 1–5 at /rw/testing before a timing test can start · low grades (≤2) pin to the manager hit list" testId="setup-grading-card">
    <Table><thead><tr><Th>Category</Th><Th>Applies to</Th><Th>Hint</Th><Th>Added</Th><Th></Th></tr></thead>
      <tbody>{cats.map((c) => <tr key={c.id} data-testid={`grade-cat-${c.key}`} className={c.active ? undefined : 'opacity-50'}><Td className="font-medium">{c.label}</Td><Td className="text-xs">{c.scopes.join(' · ')}</Td><Td className="text-xs text-ink-500">{c.hint}</Td><Td className="text-xs text-ink-500">{c.createdBy}</Td><Td><button data-testid={`grade-cat-toggle-${c.key}`} onClick={() => void api.toggleGradeCategory(c.id).then(load)} className="text-xs underline">{c.active ? 'disable' : 'enable'}</button></Td></tr>)}</tbody></Table>
    <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={async (e) => { e.preventDefault(); try { await api.addGradeCategory(label, hint, scopes); setLabel(''); setHint(''); setErr(null); await load(); } catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); } }}>
      <input data-testid="grade-cat-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New category (e.g. Bracelet finish)" className="h-8 rounded-sm border border-line bg-canvas px-2 text-[13px]" />
      <input data-testid="grade-cat-hint" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="What 5 looks like" className="h-8 min-w-[220px] rounded-sm border border-line bg-canvas px-2 text-[13px]" />
      {SCOPES.map((s) => <button type="button" key={s} data-testid={`grade-cat-scope-${s}`} onClick={() => setScopes((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))} className={`h-8 rounded-sm border px-2 text-xs ${scopes.includes(s) ? 'border-ink bg-ink text-white' : 'border-line'}`}>{s}</button>)}
      <Button data-testid="grade-cat-add" type="submit" variant="primary">Add</Button>{err && <span data-testid="grade-cat-error" className="text-xs text-rose-700">{err}</span>}
    </form>
  </Card>;
};

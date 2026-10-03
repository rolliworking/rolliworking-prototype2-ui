import { ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as sf from '@/api/safes';
import type { SafesBoard } from '@/api/safes';
import { Card } from '@/components/ui/Card';
import { fmtMoney } from '@/lib/format';

// MH Hitlist tile — shown only while any safe is over its insurance limit (the hitlist items for MH + VC are system pins; this is the owner's at-a-glance tile)
export const SafesOverCard = () => {
  const [board, setBoard] = useState<SafesBoard | null>(null);
  useEffect(() => { const load = () => void sf.getSafesBoard().then(setBoard); load(); window.addEventListener(sf.SAFES_ALERT_EVENT, load); return () => window.removeEventListener(sf.SAFES_ALERT_EVENT, load); }, []);
  if (!board?.anyOver) return null; const over = board.safes.filter((r) => r.status === 'over');
  return <Card testId="safes-over-card" bodyClassName="p-0" className="border-l-[3px] border-rose-600" title={<span className="inline-flex items-center gap-2"><ShieldAlert size={13} className="text-rose-700" /> Safes vs insurance · <span className="text-rose-700">OVER</span> <span data-testid="safes-over-total" className="rounded-sm bg-rose-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-rose-700">+{fmtMoney(board.totals.over)}</span></span>} subtitle="A safe holds more than its insured limit — move pieces to another safe (Assign / Move); clears on its own when back under" action={<Link to="/analytics" data-testid="safes-over-open" className="text-xs font-medium text-brand hover:underline">Analytics →</Link>}>
    <ul className="divide-y divide-line/70 text-xs">{over.map((r) => <li key={r.container.key} data-testid={`safes-over-row-${r.container.key}`} className="flex items-center gap-3 px-4 py-2"><span className="font-semibold text-ink">{r.container.label}</span><span className="text-ink-500">{r.count} items · <span className="font-mono">{fmtMoney(r.value)}</span> on hand vs <span className="font-mono">{fmtMoney(r.limit ?? 0)}</span> insured</span><span className="ml-auto font-mono font-semibold text-rose-700">over by {fmtMoney(r.overage)}</span></li>)}</ul>
  </Card>;
};

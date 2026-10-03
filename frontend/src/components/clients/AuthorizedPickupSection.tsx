import { UserRoundCheck, UserRoundPlus, X } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { AuthorizedPickup } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fmtDate } from '@/lib/format';

const field = 'h-7 rounded-sm border border-line bg-canvas px-2 text-xs focus:border-ink focus:outline-none';

// Authorized pickup persons — the client pre-approves who may collect; the Pickup Station reads this list at step 3 (ID photo still required, no manager approval)
export const AuthorizedPickupSection = ({ clientId, people, reload }: { clientId: string; people: AuthorizedPickup[]; reload: () => void }) => {
  const [adding, setAdding] = useState(false); const [name, setName] = useState(''); const [relation, setRelation] = useState(''); const [phone, setPhone] = useState(''); const [err, setErr] = useState<string | null>(null);
  const add = () => api.addAuthorizedPickup(clientId, { name, relation, phone }).then(() => { setAdding(false); setName(''); setRelation(''); setPhone(''); setErr(null); reload(); }).catch((e) => setErr(e instanceof Error ? e.message : 'Failed'));
  return (
    <Card title="Authorized pickup persons" subtitle="Pre-approved by the client — may collect with their own ID, no manager approval" testId="client360-authorized" action={<Button size="sm" data-testid="client360-authorized-add" onClick={() => setAdding((v) => !v)}><UserRoundPlus size={12} /> Add</Button>}>
      {people.length === 0 && !adding && <p data-testid="client360-authorized-empty" className="text-xs text-ink-400">Nobody on the list — only the client (code / QR / phone confirmation) or a manager-approved proxy can collect.</p>}
      <ul className="divide-y divide-line/60">
        {people.map((p) => (
          <li key={p.id} data-testid={`client360-authorized-${p.id}`} className="flex items-center gap-2 py-1.5 text-xs">
            <UserRoundCheck size={12} className="text-moss-700" /><span className="font-medium text-ink">{p.name}</span>{p.relation && <span className="text-ink-500">· {p.relation}</span>}{p.phone && <span className="font-mono text-ink-400">· {p.phone}</span>}
            <span className="ml-auto text-[10px] text-ink-400">since {fmtDate(p.addedAt)} · {p.addedBy} · {p.via}</span>
            <button type="button" data-testid={`client360-authorized-remove-${p.id}`} aria-label={`Remove ${p.name}`} onClick={() => api.removeAuthorizedPickup(clientId, p.id).then(reload).catch((e) => setErr(e instanceof Error ? e.message : 'Failed'))} className="text-ink-400 hover:text-rose-700"><X size={12} /></button>
          </li>
        ))}
      </ul>
      {adding && (
        <div data-testid="client360-authorized-form" className="mt-2 flex flex-wrap items-center gap-1.5">
          <input data-testid="client360-authorized-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={`${field} w-40`} />
          <input data-testid="client360-authorized-relation" value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="Relation (optional)" className={`${field} w-32`} />
          <input data-testid="client360-authorized-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className={`${field} w-32`} />
          <Button size="sm" variant="primary" data-testid="client360-authorized-save" disabled={name.trim().length < 3} onClick={add}>Save</Button>
        </div>
      )}
      {err && <p data-testid="client360-authorized-error" className="mt-1 text-xs text-rose-700">{err}</p>}
    </Card>
  );
};

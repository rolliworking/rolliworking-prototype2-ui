import { PhoneIncoming } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import { Button } from '@/components/ui/Button';

// Unknown caller → one-tap "New client / new request" lands here with the number pre-filled
export const NewClientFromCall = () => {
  const [sp] = useSearchParams(); const nav = useNavigate(); const phone = sp.get('phone') ?? ''; const [f, setF] = useState({ firstName: '', lastName: '', email: '' }); const [err, setErr] = useState<string | null>(null);
  if (sp.get('new') !== '1') return null;
  return <form data-testid="new-client-from-call" onSubmit={async (e) => { e.preventDefault(); try { const c = await api.createClient({ ...f, phone }); nav(`/clients/${c.id}`); } catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); } }} className="flex flex-wrap items-center gap-2 rounded-md border border-moss-200 bg-moss-50/60 px-3 py-2 text-xs">
    <PhoneIncoming size={14} className="text-moss-700" /><span className="font-medium text-ink">New client from call</span><span data-testid="new-client-phone" className="font-mono text-ink-600">{phone}</span>
    <input data-testid="new-client-first" required value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} placeholder="First name" className="h-8 rounded-sm border border-line bg-surface px-2" /><input data-testid="new-client-last" required value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} placeholder="Last name" className="h-8 rounded-sm border border-line bg-surface px-2" /><input data-testid="new-client-email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Email (optional)" className="h-8 rounded-sm border border-line bg-surface px-2" />
    <Button data-testid="new-client-create" type="submit" variant="primary">Create → Client 360</Button>{err && <span className="text-rose-700">{err}</span>}
  </form>;
};

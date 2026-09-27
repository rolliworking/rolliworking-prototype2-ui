import { Archive, ArrowRightLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { LegacyMeta } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';

export const LegacyBadge = ({ testId = 'legacy-badge', small = false }: { testId?: string; small?: boolean }) => (
  <span data-testid={testId} title="Imported from the legacy system — read-only" className={`inline-flex items-center gap-1 rounded-sm border border-stone-300 bg-stone-100 font-semibold uppercase tracking-wide text-stone-700 ${small ? 'px-1 py-px text-[9px]' : 'px-1.5 py-0.5 text-[10px]'}`}><Archive size={small ? 9 : 11} /> Legacy · read-only</span>
);

// Banner on a legacy estimate / invoice: no edit affordances anywhere; managers may convert (duplicate into a native record, original untouched)
export const LegacyBanner = ({ kind, id, legacy, convertedFrom }: { kind: 'estimate' | 'sales_order'; id: string; legacy?: LegacyMeta; convertedFrom?: { id: string; number: string } }) => {
  const { user } = useAuth(); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const base = kind === 'estimate' ? '/estimates' : '/sales';
  if (convertedFrom) return <div data-testid="legacy-converted-from" className="rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-700"><ArrowRightLeft size={12} className="mr-1 inline" /> Converted from legacy <Link to={`${base}/${convertedFrom.id}`} className="font-mono font-semibold underline">{convertedFrom.number}</Link> — the original stays read-only in the archive.</div>;
  if (!legacy) return null;
  const convert = async () => { setBusy(true); setErr(null); try { const r = await api.convertLegacy(kind, id); window.location.assign(`${base}/${r.id}`); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); setBusy(false); } };
  return <div data-testid="legacy-banner" className="flex flex-wrap items-center gap-3 rounded-md border border-stone-300 bg-stone-100 px-3 py-2 text-xs text-stone-800">
    <LegacyBadge testId="legacy-banner-badge" /><span>Imported from <b>{legacy.source}</b> as <span className="font-mono">{legacy.number}</span> · nothing here can be edited, sent or paid.</span>
    <span className="ml-auto flex items-center gap-2">{legacy.convertedToId ? <Link data-testid="legacy-open-converted" to={`${base}/${legacy.convertedToId}`} className="font-medium underline">Converted → open the editable copy</Link>
      : user?.accessTier === 'manager' ? <Button size="sm" variant="primary" data-testid="legacy-convert" disabled={busy} onClick={() => void convert()}><ArrowRightLeft size={12} /> Convert to editable</Button> : <span className="text-stone-500">Manager tier can convert</span>}</span>
    {err && <span data-testid="legacy-convert-error" className="w-full text-rose-700">{err}</span>}
  </div>;
};

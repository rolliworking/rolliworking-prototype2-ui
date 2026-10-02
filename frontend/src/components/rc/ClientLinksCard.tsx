import { Ban, Link2, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { ClientLink, ClientLinkType } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fmtDate, fmtTime } from '@/lib/format';

// LINK tier bookkeeping for one object: every send logged, opens counted, revoke (manager) kills it — the client then sees "this link has expired — sign in to see your watch."
export const ClientLinksCard = ({ type, objectId, disabled }: { type: ClientLinkType; objectId: string; disabled?: boolean }) => {
  const [links, setLinks] = useState<ClientLink[]>([]); const [err, setErr] = useState<string | null>(null);
  const load = () => api.getClientLinks(objectId).then(setLinks);
  useEffect(() => { void load(); }, [objectId]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = (fn: () => Promise<unknown>) => fn().then(load).catch((e) => setErr(e instanceof Error ? e.message : 'Failed'));
  return (
    <Card title="Client links" subtitle={`LINK tier · one ${type === 'parts' ? 'parts approval' : type}, one purpose · expiry: ${api.LINK_EXPIRY[type]}`} testId="client-links-card" action={<Button size="sm" data-testid="client-link-send" disabled={disabled} onClick={() => run(() => api.sendClientLink(type, objectId))}><Send size={12} /> Send link again</Button>}>
      {links.length === 0 ? <p className="text-xs text-ink-500">No link issued yet — sending the {type} issues one.</p> : (
        <ul className="divide-y divide-line/70 text-xs" data-testid="client-links">{links.map((l) => { const dead = !!l.revokedAt || (l.expiresAt && new Date(l.expiresAt).getTime() < Date.now()); return (
          <li key={l.token} data-testid={`client-link-${l.token}`} data-dead={dead} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
            <Link2 size={12} className={dead ? 'text-ink-300' : 'text-moss-700'} /><span className="font-mono text-[11px] text-ink-500">…{l.token.slice(-8)}</span>
            <span className="text-ink-700">{l.sends.length} send{l.sends.length === 1 ? '' : 's'} · last {fmtDate(l.sends[l.sends.length - 1].at)} {fmtTime(l.sends[l.sends.length - 1].at)} by {l.sends[l.sends.length - 1].by}</span>
            <span className="text-ink-500">{l.opens} open{l.opens === 1 ? '' : 's'}{l.lastOpenedAt ? ` · last ${fmtTime(l.lastOpenedAt)}` : ''}</span>
            {l.revokedAt ? <span className="rounded-sm bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">revoked by {l.revokedBy}</span> : <Button size="sm" data-testid={`client-link-revoke-${l.token}`} className="ml-auto text-rose-700" onClick={() => run(() => api.revokeClientLink(l.token))}><Ban size={11} /> Revoke</Button>}
          </li>); })}</ul>
      )}
      {err && <div className="mt-2 rounded-sm bg-rose-50 px-2 py-1 text-xs text-rose-700">{err}</div>}
    </Card>
  );
};

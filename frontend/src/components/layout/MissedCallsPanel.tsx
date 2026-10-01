import { PhoneMissed, PhoneOutgoing } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as calls from '@/api/calls';
import * as tel from '@/api/telephony';
import type { MissedCallRow } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { fmtDate, fmtTime, fullName } from '@/lib/format';

// Inbox · Needs reply: a missed call sits here like an unanswered message until someone clears it (after-hours calls float to the top of the morning)
export const MissedCallsPanel = () => {
  const [rows, setRows] = useState<MissedCallRow[]>([]); const [note, setNote] = useState<Record<string, string>>({}); const nav = useNavigate();
  const load = useCallback(() => calls.getMissedCalls().then(setRows), []);
  useEffect(() => { void load(); return calls.subscribeCalls(() => void load()); }, [load]);
  if (!rows.length) return null;
  const clear = async (id: string, how: 'called_back' | 'handled') => { await calls.resolveMissedCall(id, how, note[id]); await load(); };
  return <ul data-testid="missed-calls" className="mb-2 space-y-1">{rows.map(({ call: c, client, badge }) => <li key={c.id} data-testid={`missed-call-${c.id}`} className="rounded-md border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs">
    <div className="flex flex-wrap items-center gap-2"><PhoneMissed size={13} className="text-rose-700" /><span className="font-semibold text-ink">{c.outcome === 'voicemail' ? 'Voicemail' : 'Missed call'} — {client ? <Link to={`/clients/${client.id}`} data-testid={`missed-call-client-${c.id}`} className="hover:underline">{fullName(client)}</Link> : `Unknown (${c.number})`}</span>{badge && <span className="rounded-sm border border-line bg-surface px-1 font-mono text-[10px]">{badge}</span>}<span className="text-ink-500">· {fmtDate(c.at)} {fmtTime(c.at)}{c.afterHours && ' · after hours'}</span>{c.notes[0] && <span className="text-ink-600">· “{c.notes[0].text}”</span>}</div>
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><input data-testid={`missed-call-note-${c.id}`} value={note[c.id] ?? ''} onChange={(e) => setNote({ ...note, [c.id]: e.target.value })} placeholder="Note (what happened)" className="h-7 min-w-[200px] flex-1 rounded-sm border border-line bg-surface px-2" />
      {client ? <><Button data-testid={`missed-call-dial-${c.id}`} variant="primary" title="Click-to-call from your extension — clears this item on hang-up" onClick={() => { try { tel.dial({ clientId: client.id, number: c.number, jobId: c.jobId }); } catch (e) { window.alert(e instanceof Error ? e.message : 'Busy'); } }}><PhoneOutgoing size={12} /> Call back</Button><Button data-testid={`missed-call-back-${c.id}`} title="Already called them back (off-system) — logs an outbound call" onClick={() => void clear(c.id, 'called_back')}>Mark called back</Button><Button data-testid={`missed-call-handled-${c.id}`} onClick={() => void clear(c.id, 'handled')}>Handled</Button><Button data-testid={`missed-call-open-${c.id}`} onClick={() => nav(`/clients/${client.id}`)}>Open client</Button></>
        : <><Button data-testid={`missed-call-capture-${c.id}`} variant="primary" onClick={() => nav(`/clients?new=1&phone=${encodeURIComponent(c.number)}`)}>New client / request</Button><Button data-testid={`missed-call-handled-${c.id}`} onClick={() => void clear(c.id, 'handled')}>Handled</Button></>}</div>
  </li>)}</ul>;
};

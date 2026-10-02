import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import { LinkExpired } from '@/rc/RcAuthBits';
import { RcCard } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

// Magic-link landing (/rc/auth/:token): single-use, bound to the email it was sent to; signs in and continues to ?next
export default function RcMagicPage() {
  const { token = '' } = useParams(); const [sp] = useSearchParams(); const { refresh } = useRcSession();
  const [state, setState] = useState<'checking' | 'ok' | 'bad'>('checking'); const [err, setErr] = useState<string | null>(null); const [next, setNext] = useState('/rc/home');
  useEffect(() => { api.rcVerifyMagicLink(token).then(async (r) => { const n = sp.get('next') ?? r.next; setNext(n && n.startsWith('/rc/') ? n : '/rc/home'); await refresh(); setState('ok'); }).catch((e) => { setErr(e.message); setState('bad'); }); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  if (state === 'ok') return <Navigate to={next} replace />;
  if (state === 'bad') return <LinkExpired message={err ?? undefined} />;
  return <div className="mx-auto max-w-[520px] pt-8" data-testid="rc-magic-checking"><RcCard eyebrow="Signing you in" title={<span className="inline-flex items-center gap-2"><ShieldCheck size={20} className="text-rc-accent" /> One moment…</span>}><p className="text-[15px] text-rc-muted">Checking your link.</p></RcCard></div>;
}

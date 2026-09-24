import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import { RcCard } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

export default function RcAuthPage() {
  const { token = '' } = useParams();
  const { refresh } = useRcSession();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.portalRedeemMagicLink(token)
      .then(() => refresh())
      .then(() => navigate('/rc/home', { replace: true }))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'This link is invalid'));
  }, [token, refresh, navigate]);

  return (
    <div className="mx-auto max-w-[520px] pt-8" data-testid="rc-auth-page">
      <RcCard eyebrow={err ? 'Sign-in failed' : 'Signing you in'} title={err ? 'That link didn’t work' : 'One moment…'}>
        {err ? (
          <p className="text-[15px] text-rc-muted" data-testid="rc-auth-error">{err} <Link to="/rc" className="text-rc-ink underline decoration-rc-accent underline-offset-4">Request a new one</Link>.</p>
        ) : (
          <p className="text-[15px] text-rc-muted">Checking your link.</p>
        )}
      </RcCard>
    </div>
  );
}

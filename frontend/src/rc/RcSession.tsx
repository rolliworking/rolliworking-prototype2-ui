import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as api from '@/api/client';
import type { Client } from '@/api/client';

interface RcSessionValue { client: Client | null; loading: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> }

const Ctx = createContext<RcSessionValue | null>(null);

// Portal session — separate from the staff session; keyed on rollisuite.rc.session
export function RcSessionProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const s = await api.portalGetSession();
    setClient(s?.client ?? null);
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const signOut = useCallback(async () => { await api.portalSignOut(); setClient(null); }, []);
  return <Ctx.Provider value={{ client, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}

export function useRcSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRcSession outside RcSessionProvider');
  return v;
}

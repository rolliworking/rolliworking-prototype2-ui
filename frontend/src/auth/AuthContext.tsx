import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as api from '@/api/client';
import type { Station, User, VerificationPhoto } from '@/api/client';

interface AuthValue {
  user: User | null;
  realUser: User | null;
  viewingAs: User | null;
  station: Station | null;
  loading: boolean;
  signInWithPassword: (userId: string, password: string, photo: VerificationPhoto) => Promise<User>;
  switchWithPin: (userId: string, pin: string) => Promise<User>;
  signOut: () => Promise<void>;
  refreshStation: () => Promise<void>;
  startViewAs: (userId: string) => Promise<User>;
  stopViewAs: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [realUser, setRealUser] = useState<User | null>(null);
  const [viewingAs, setViewingAs] = useState<User | null>(null);
  const [station, setStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);

  // `user` is the VIEWED identity (D-385) — every guard and screen reads it; `realUser` is the device sign-in
  const syncIdentity = useCallback(async () => {
    const [u, va] = await Promise.all([api.getCurrentUser(), api.getViewAs()]);
    setUser(u); setRealUser(va?.real ?? u); setViewingAs(va?.viewing ?? null);
    return u;
  }, []);

  useEffect(() => {
    Promise.all([api.getStation(), syncIdentity()]).then(([st]) => { setStation(st); setLoading(false); });
  }, [syncIdentity]);

  const signInWithPassword = useCallback(async (userId: string, password: string, photo: VerificationPhoto) => {
    const u = await api.signInWithPassword(userId, password, photo);
    await syncIdentity();
    return u;
  }, [syncIdentity]);

  const switchWithPin = useCallback(async (userId: string, pin: string) => {
    const u = await api.switchUserWithPin(userId, pin);
    await syncIdentity();
    return u;
  }, [syncIdentity]);

  const signOut = useCallback(async () => {
    await api.signOut();
    setUser(null); setRealUser(null); setViewingAs(null);
  }, []);

  const refreshStation = useCallback(async () => {
    const st = await api.getStation();
    setStation(st);
    await syncIdentity();
  }, [syncIdentity]);

  const startViewAs = useCallback(async (userId: string) => { const u = await api.startViewAs(userId); await syncIdentity(); return u; }, [syncIdentity]);
  const stopViewAs = useCallback(async () => { await api.stopViewAs(); await syncIdentity(); }, [syncIdentity]);

  return (
    <AuthContext.Provider value={{ user, realUser, viewingAs, station, loading, signInWithPassword, switchWithPin, signOut, refreshStation, startViewAs, stopViewAs }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

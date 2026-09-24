import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as api from '@/api/client';
import type { Station, User, VerificationPhoto } from '@/api/client';

interface AuthValue {
  user: User | null;
  station: Station | null;
  loading: boolean;
  signInWithPassword: (userId: string, password: string, photo: VerificationPhoto) => Promise<User>;
  switchWithPin: (userId: string, pin: string) => Promise<User>;
  signOut: () => Promise<void>;
  refreshStation: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [station, setStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getStation(), api.getCurrentUser()]).then(([st, u]) => {
      setStation(st);
      setUser(u);
      setLoading(false);
    });
  }, []);

  const signInWithPassword = useCallback(async (userId: string, password: string, photo: VerificationPhoto) => {
    const u = await api.signInWithPassword(userId, password, photo);
    setUser(u);
    return u;
  }, []);

  const switchWithPin = useCallback(async (userId: string, pin: string) => {
    const u = await api.switchUserWithPin(userId, pin);
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut();
    setUser(null);
  }, []);

  const refreshStation = useCallback(async () => {
    const [st, u] = await Promise.all([api.getStation(), api.getCurrentUser()]);
    setStation(st);
    setUser(u);
  }, []);

  return (
    <AuthContext.Provider value={{ user, station, loading, signInWithPassword, switchWithPin, signOut, refreshStation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

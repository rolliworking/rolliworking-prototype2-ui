import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthenticatorAssuranceLevels } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, ROLE_PERMISSIONS, RolePermissions } from '@/types/database';

interface MFAInfo {
  factorId: string | null;
  currentLevel: AuthenticatorAssuranceLevels | null;
  nextLevel: AuthenticatorAssuranceLevels | null;
  needsMFA: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  permissions: RolePermissions;
  isAdmin: boolean;
  isManager: boolean;
  isOffice: boolean;
  mfaInfo: MFAInfo;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; needsMFA?: boolean; factorId?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshMFAStatus: () => Promise<void>;
}

const defaultPermissions: RolePermissions = {
  canDeleteJobs: false,
  canManageUsers: false,
  canManageSettings: false,
  canAccessSetup: false,
  canExportCSV: false,
  canEditTestsAnytime: false,
  canEditTestsWithin24Hours: false,
  canAccessIntake: false,
  canAccessInspections: false,
  canAccessReceiveWatch: false,
  canAccessReportAnalytics: false,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [mfaInfo, setMfaInfo] = useState<MFAInfo>({
    factorId: null,
    currentLevel: null,
    nextLevel: null,
    needsMFA: false,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setRole(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching user role:', error);
        setRole('office');
        return;
      }
      
      setRole(data?.role as AppRole || 'office');
    } catch (err) {
      console.error('Error fetching user role:', err);
      setRole('office');
    }
  };

  const refreshMFAStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (error) {
        console.error('Error getting MFA status:', error);
        return;
      }

      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verifiedFactors = factorsData?.totp?.filter(f => f.status === 'verified') || [];
      const factorId = verifiedFactors.length > 0 ? verifiedFactors[0].id : null;
      
      // User needs MFA if they have factors enrolled but haven't verified yet
      const needsMFA = data.currentLevel === 'aal1' && data.nextLevel === 'aal2';

      setMfaInfo({
        factorId,
        currentLevel: data.currentLevel,
        nextLevel: data.nextLevel,
        needsMFA,
      });
    } catch (err) {
      console.error('Error refreshing MFA status:', err);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error as Error };
    }

    // Check if MFA is required
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    
    const verifiedFactors = factorsData?.totp?.filter(f => f.status === 'verified') || [];
    
    if (aalData?.currentLevel === 'aal1' && aalData?.nextLevel === 'aal2' && verifiedFactors.length > 0) {
      return { 
        error: null, 
        needsMFA: true, 
        factorId: verifiedFactors[0].id 
      };
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  const permissions = role ? ROLE_PERMISSIONS[role] : defaultPermissions;

  const value = {
    user,
    session,
    loading,
    role,
    permissions,
    isAdmin: role === 'admin',
    isManager: role === 'manager',
    isOffice: role === 'office',
    mfaInfo,
    signIn,
    signUp,
    signOut,
    refreshMFAStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper to check if a test can be edited
export function canEditTest(createdAt: string, role: AppRole | null): boolean {
  if (!role) return false;
  
  const permissions = ROLE_PERMISSIONS[role];
  if (permissions.canEditTestsAnytime) return true;
  
  if (permissions.canEditTestsWithin24Hours) {
    const createdDate = new Date(createdAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 24;
  }
  
  return false;
}

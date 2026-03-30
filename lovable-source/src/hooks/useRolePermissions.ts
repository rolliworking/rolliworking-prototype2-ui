import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionKey, ROLE_PERMISSIONS } from '@/types/database';

interface RolePermissionRow {
  id: string;
  role: string;
  permission_key: string;
  enabled: boolean;
}

export function useRolePermissions() {
  const { role, isAdmin } = useAuth();

  const { data: dbPermissions, isLoading } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*');

      if (error) throw error;
      return data as RolePermissionRow[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const hasPermission = (permissionKey: PermissionKey): boolean => {
    // Admin always has all permissions
    if (isAdmin) return true;
    if (!role) return false;

    // Map office/staff to 'team' for database lookup
    const dbRole = role === 'office' || role === 'staff' ? 'team' : role;

    // Check database first
    const dbPerm = dbPermissions?.find(
      p => p.role === dbRole && p.permission_key === permissionKey
    );

    if (dbPerm !== undefined) {
      return dbPerm.enabled;
    }

    // Fall back to defaults
    return ROLE_PERMISSIONS[role]?.[permissionKey] ?? false;
  };

  return {
    hasPermission,
    isLoading,
    canAccessSetup: hasPermission('canAccessSetup'),
    canAccessIntake: hasPermission('canAccessIntake'),
    canAccessInspections: hasPermission('canAccessInspections'),
    canAccessReceiveWatch: hasPermission('canAccessReceiveWatch'),
    canDeleteJobs: hasPermission('canDeleteJobs'),
    canManageUsers: hasPermission('canManageUsers'),
    canManageSettings: hasPermission('canManageSettings'),
    canExportCSV: hasPermission('canExportCSV'),
    canEditTestsAnytime: hasPermission('canEditTestsAnytime'),
    canEditTestsWithin24Hours: hasPermission('canEditTestsWithin24Hours'),
  };
}
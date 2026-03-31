import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export type Permission = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
};

export type RolePermission = {
  id: string;
  role: "owner" | "manager" | "staff";
  permission_key: string;
};

export function usePermissions() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissions")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Permission[];
    },
  });
}

export function useRolePermissions() {
  return useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*");

      if (error) throw error;
      return data as RolePermission[];
    },
  });
}

export function useUpdateRolePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      role,
      permissionKey,
      enabled,
    }: {
      role: "owner" | "manager" | "staff";
      permissionKey: string;
      enabled: boolean;
    }) => {
      if (enabled) {
        // Add permission
        const { error } = await supabase
          .from("role_permissions")
          .insert({ role, permission_key: permissionKey });
        if (error) throw error;
      } else {
        // Remove permission
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role", role)
          .eq("permission_key", permissionKey);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
    },
  });
}

// Hook to check if current user has a specific permission
export function useHasPermission(permissionKey: string) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["user-permission", userId, permissionKey],
    queryFn: async () => {
      if (!userId) return false;

      const { data, error } = await supabase.rpc("has_permission", {
        _user_id: userId,
        _permission_key: permissionKey,
      });

      if (error) throw error;
      return data as boolean;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook to get all permissions for the current user
export function useUserPermissions() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: async () => {
      if (!userId) return [];

      // Get user's role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (roleError) throw roleError;
      if (!roleData) return [];

      // Get permissions for that role
      const { data: permData, error: permError } = await supabase
        .from("role_permissions")
        .select("permission_key")
        .eq("role", roleData.role);

      if (permError) throw permError;
      return permData.map((p) => p.permission_key);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// Utility function to check permission from the permissions array
export function hasPermission(
  permissions: string[] | undefined,
  permissionKey: string
): boolean {
  return permissions?.includes(permissionKey) ?? false;
}

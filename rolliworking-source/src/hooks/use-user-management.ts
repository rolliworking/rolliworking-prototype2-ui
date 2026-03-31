import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "owner" | "manager" | "staff";

export interface ManagedUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  last_sign_in_at: string | null;
}

async function callManageUsers(action: string, params: Record<string, any> = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await supabase.functions.invoke("manage-users", {
    body: { action, ...params },
    headers: {
      // Use the public project key for the platform-level JWT check.
      // The function itself verifies the real user JWT from X-User-JWT.
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      "X-User-JWT": session.access_token,
    },
  });

  // Check for auth errors in multiple places
  const status = (response.error as any)?.context?.status as number | undefined;
  const contextBody = (response.error as any)?.context?.body;
  const errorMessage =
    contextBody?.error ||
    contextBody?.message ||
    response.data?.error ||
    response.error?.message ||
    "Request failed";

  const isInvalidAuth = 
    status === 401 || 
    status === 403 ||
    /invalid jwt|invalid token|session expired|not authenticated|missing.*jwt/i.test(String(errorMessage));

  if (response.error || response.data?.error) {
    if (isInvalidAuth) {
      console.log("Session invalid, signing out...");
      await supabase.auth.signOut();
      window.location.href = "/login";
      throw new Error("Session expired. Please sign in again.");
    }
    if (response.error) {
      throw new Error(errorMessage);
    }
    throw new Error(response.data.error);
  }

  return response.data;
}

export function useUsers() {
  return useQuery({
    queryKey: ["managed-users"],
    queryFn: async () => {
      const result = await callManageUsers("list");
      return result.users as ManagedUser[];
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { email: string; password: string; full_name?: string; role?: string }) => {
      return callManageUsers("create", params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managed-users"] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { user_id: string; email?: string; password?: string; full_name?: string; role?: string }) => {
      return callManageUsers("update", params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managed-users"] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (user_id: string) => {
      return callManageUsers("delete", { user_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managed-users"] });
    },
  });
}

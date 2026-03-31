import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export type UserRole = "owner" | "manager" | "staff";

export function useUserRole() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["user-role", userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return (data?.role as UserRole) || "staff";
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function canEditJobFields(role: UserRole | null | undefined): boolean {
  return role === "owner" || role === "manager";
}

export function canSetPartPrice(role: UserRole | null | undefined): boolean {
  return role === "owner" || role === "manager";
}

export function canAddPartsRequest(role: UserRole | null | undefined): boolean {
  // Only manager/owner can add parts on the Edit Job page
  return role === "owner" || role === "manager";
}

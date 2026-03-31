import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

async function callSecurityFunction(action: string, params: Record<string, unknown> = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData?.session?.access_token;

  if (!jwt) {
    throw new Error("Not authenticated");
  }

  const response = await supabase.functions.invoke("security", {
    body: { action, ...params },
    headers: { "x-user-jwt": jwt },
  });

  if (response.error) {
    throw new Error(response.error.message || "Security operation failed");
  }

  return response.data;
}

export interface SecurityStatus {
  hasPin: boolean;
  totpEnabled: boolean;
  totpVerified: boolean;
  sessionTimeoutMinutes: number;
  loginNotificationEnabled: boolean;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Get security status for current user or a target user (owner only)
export function useSecurityStatus(targetUserId?: string) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["security-status", targetUserId || session?.user?.id],
    queryFn: () => callSecurityFunction("get-status", { targetUserId }),
    enabled: !!session?.user,
  });
}

// Set PIN for a user (owner only)
export function useSetUserPin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ targetUserId, pin }: { targetUserId: string; pin: string }) =>
      callSecurityFunction("set-pin", { targetUserId, pin }),
    onSuccess: (_, { targetUserId }) => {
      queryClient.invalidateQueries({ queryKey: ["security-status", targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["security-status"] });
    },
  });
}

// Clear PIN for a user (owner only)
export function useClearUserPin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetUserId: string) =>
      callSecurityFunction("clear-pin", { targetUserId }),
    onSuccess: (_, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: ["security-status", targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["security-status"] });
    },
  });
}

// Verify current user's PIN
export function useVerifyPin() {
  return useMutation({
    mutationFn: (pin: string) => callSecurityFunction("verify-pin", { pin }),
  });
}

// Update security settings
export function useUpdateSecuritySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      targetUserId?: string;
      sessionTimeoutMinutes?: number;
      loginNotificationEnabled?: boolean;
    }) => callSecurityFunction("update-settings", params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-status"] });
    },
  });
}

// Log an audit event
export function useLogAuditEvent() {
  return useMutation({
    mutationFn: (params: {
      eventAction: string;
      resourceType?: string;
      resourceId?: string;
      details?: Record<string, unknown>;
    }) => callSecurityFunction("log-event", params),
  });
}

// Get audit logs (owner only)
export function useAuditLogs(options?: {
  limit?: number;
  offset?: number;
  actionFilter?: string;
  userFilter?: string;
}) {
  return useQuery({
    queryKey: ["audit-logs", options],
    queryFn: () => callSecurityFunction("get-logs", options || {}),
  });
}

// Session lock state management
const SESSION_LOCK_KEY = "session_locked_at";
const LAST_ACTIVITY_KEY = "last_activity_at";

export function useSessionLock(timeoutMinutes: number = 30) {
  const [isLocked, setIsLocked] = React.useState(false);
  const { session } = useAuth();

  // Update last activity on user interaction
  const updateActivity = React.useCallback(() => {
    if (session?.user) {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    }
  }, [session]);

  // Check if session should be locked
  const checkLock = React.useCallback(() => {
    if (!session?.user) return;

    const lastActivity = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || "0", 10);
    const lockedAt = localStorage.getItem(SESSION_LOCK_KEY);

    if (lockedAt) {
      setIsLocked(true);
      return;
    }

    const timeSinceActivity = Date.now() - lastActivity;
    const timeoutMs = timeoutMinutes * 60 * 1000;

    if (lastActivity > 0 && timeSinceActivity > timeoutMs) {
      localStorage.setItem(SESSION_LOCK_KEY, Date.now().toString());
      setIsLocked(true);
    }
  }, [session, timeoutMinutes]);

  // Unlock session
  const unlock = React.useCallback(() => {
    localStorage.removeItem(SESSION_LOCK_KEY);
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    setIsLocked(false);
  }, []);

  // Lock session manually
  const lock = React.useCallback(() => {
    localStorage.setItem(SESSION_LOCK_KEY, Date.now().toString());
    setIsLocked(true);
  }, []);

  // Set up activity listeners and check interval
  React.useEffect(() => {
    if (!session?.user) return;

    // Initialize last activity
    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    }

    // Check lock state on mount
    checkLock();

    // Set up interval to check lock
    const interval = setInterval(checkLock, 60000); // Check every minute

    // Activity listeners
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, updateActivity));

    return () => {
      clearInterval(interval);
      events.forEach((event) => window.removeEventListener(event, updateActivity));
    };
  }, [session, checkLock, updateActivity]);

  // Clear lock on logout
  React.useEffect(() => {
    if (!session?.user) {
      localStorage.removeItem(SESSION_LOCK_KEY);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      setIsLocked(false);
    }
  }, [session]);

  return { isLocked, lock, unlock };
}

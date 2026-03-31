import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

// Simple hash function compatible with Deno edge runtime (no Web Workers)
async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = new TextDecoder().decode(encodeHex(salt));
  const data = new TextEncoder().encode(saltHex + pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = new TextDecoder().decode(encodeHex(new Uint8Array(hashBuffer)));
  return `${saltHex}:${hashHex}`;
}

async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const [saltHex, expectedHash] = storedHash.split(":");
  if (!saltHex || !expectedHash) return false;
  const data = new TextEncoder().encode(saltHex + pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = new TextDecoder().decode(encodeHex(new Uint8Array(hashBuffer)));
  return hashHex === expectedHash;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-jwt",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get JWT from header
    const jwt = req.headers.get("x-user-jwt") || req.headers.get("authorization")?.replace("Bearer ", "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify JWT
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // Check if user is owner for admin actions
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isOwner = roleData?.role === "owner";

    switch (action) {
      // ============ PIN MANAGEMENT (Owner only) ============
      case "set-pin": {
        if (!isOwner) {
          return new Response(JSON.stringify({ error: "Only owners can set PINs" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { targetUserId, pin } = body;
        if (!targetUserId || !pin || pin.length < 4 || pin.length > 6) {
          return new Response(JSON.stringify({ error: "PIN must be 4-6 digits" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Hash the PIN
        const pinHash = await hashPin(pin);

        // Upsert user_security record
        const { error: upsertError } = await supabaseAdmin
          .from("user_security")
          .upsert({
            user_id: targetUserId,
            pin_hash: pinHash,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        if (upsertError) {
          throw upsertError;
        }

        // Log the action
        await supabaseAdmin.from("audit_logs").insert({
          user_id: user.id,
          user_email: user.email,
          action: "set_user_pin",
          resource_type: "user_security",
          resource_id: targetUserId,
          details: { target_user_id: targetUserId },
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
          user_agent: req.headers.get("user-agent"),
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "clear-pin": {
        if (!isOwner) {
          return new Response(JSON.stringify({ error: "Only owners can clear PINs" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { targetUserId } = body;

        const { error: updateError } = await supabaseAdmin
          .from("user_security")
          .update({ pin_hash: null, updated_at: new Date().toISOString() })
          .eq("user_id", targetUserId);

        if (updateError) {
          throw updateError;
        }

        // Log the action
        await supabaseAdmin.from("audit_logs").insert({
          user_id: user.id,
          user_email: user.email,
          action: "clear_user_pin",
          resource_type: "user_security",
          resource_id: targetUserId,
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
          user_agent: req.headers.get("user-agent"),
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ============ PIN VERIFICATION (User verifying their own PIN) ============
      case "verify-pin": {
        const { pin } = body;
        
        const { data: securityData } = await supabaseAdmin
          .from("user_security")
          .select("pin_hash")
          .eq("user_id", user.id)
          .single();

        if (!securityData?.pin_hash) {
          return new Response(JSON.stringify({ valid: false, error: "No PIN set" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const isValid = await verifyPin(pin, securityData.pin_hash);

        // Log verification attempt
        await supabaseAdmin.from("audit_logs").insert({
          user_id: user.id,
          user_email: user.email,
          action: isValid ? "pin_verified" : "pin_failed",
          resource_type: "user_security",
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
          user_agent: req.headers.get("user-agent"),
        });

        return new Response(JSON.stringify({ valid: isValid }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ============ GET USER SECURITY STATUS ============
      case "get-status": {
        const { targetUserId } = body;
        const checkUserId = isOwner && targetUserId ? targetUserId : user.id;

        const { data: securityData } = await supabaseAdmin
          .from("user_security")
          .select("totp_enabled, totp_verified, session_timeout_minutes, login_notification_enabled, pin_hash")
          .eq("user_id", checkUserId)
          .single();

        return new Response(JSON.stringify({
          hasPin: !!securityData?.pin_hash,
          totpEnabled: securityData?.totp_enabled || false,
          totpVerified: securityData?.totp_verified || false,
          sessionTimeoutMinutes: securityData?.session_timeout_minutes || 30,
          loginNotificationEnabled: securityData?.login_notification_enabled ?? true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ============ UPDATE SECURITY SETTINGS (Owner for others, self for some) ============
      case "update-settings": {
        const { targetUserId, sessionTimeoutMinutes, loginNotificationEnabled } = body;
        const updateUserId = isOwner && targetUserId ? targetUserId : user.id;

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (typeof sessionTimeoutMinutes === "number") {
          updates.session_timeout_minutes = Math.max(5, Math.min(120, sessionTimeoutMinutes));
        }
        if (typeof loginNotificationEnabled === "boolean") {
          updates.login_notification_enabled = loginNotificationEnabled;
        }

        const { error: updateError } = await supabaseAdmin
          .from("user_security")
          .upsert({
            user_id: updateUserId,
            ...updates,
          }, { onConflict: "user_id" });

        if (updateError) {
          throw updateError;
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ============ LOG AUDIT EVENT ============
      case "log-event": {
        const { eventAction, resourceType, resourceId, details } = body;

        await supabaseAdmin.from("audit_logs").insert({
          user_id: user.id,
          user_email: user.email,
          action: eventAction,
          resource_type: resourceType,
          resource_id: resourceId,
          details: details || {},
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
          user_agent: req.headers.get("user-agent"),
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ============ GET AUDIT LOGS (Owner only) ============
      case "get-logs": {
        if (!isOwner) {
          return new Response(JSON.stringify({ error: "Only owners can view audit logs" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { limit = 100, offset = 0, actionFilter, userFilter } = body;

        let query = supabaseAdmin
          .from("audit_logs")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (actionFilter) {
          query = query.ilike("action", `%${actionFilter}%`);
        }
        if (userFilter) {
          query = query.ilike("user_email", `%${userFilter}%`);
        }

        const { data: logs, count, error: logsError } = await query;

        if (logsError) {
          throw logsError;
        }

        return new Response(JSON.stringify({ logs, total: count }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: unknown) {
    console.error("Security function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

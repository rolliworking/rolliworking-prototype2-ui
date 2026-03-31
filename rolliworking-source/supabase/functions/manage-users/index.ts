import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-user-jwt, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting (10 requests per minute per user)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // NOTE: Platform-level JWT check may not accept the user session token.
    // We therefore accept the real user JWT via X-User-JWT and validate it here.
    const userJwt = req.headers.get("x-user-jwt") ?? req.headers.get("X-User-JWT");
    if (!userJwt) {
      return new Response(JSON.stringify({ error: "Missing X-User-JWT header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use getClaims to validate token without session check
    const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(userJwt);

    if (claimsError || !claimsData?.claims) {
      console.error("Token validation error:", claimsError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const caller = { id: claimsData.claims.sub as string, email: claimsData.claims.email as string };

    // Apply rate limiting
    if (!checkRateLimit(caller.id)) {
      console.warn(`Rate limit exceeded for user: ${caller.id}`);
      return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    // Check if caller is owner (only owners can manage users)
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "owner")
      .single();

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Unauthorized - owner access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case "list": {
        // Get all users with their roles
        const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        // Get roles for all users
        const { data: roles } = await supabaseAdmin.from("user_roles").select("*");
        const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

        // Get profiles for full names
        const { data: profiles } = await supabaseAdmin.from("profiles").select("*");
        const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        const users = authUsers.users.map(u => ({
          id: u.id,
          email: u.email,
          full_name: profilesMap.get(u.id)?.full_name || null,
          role: rolesMap.get(u.id) || "staff",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
        }));

        return new Response(JSON.stringify({ users }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create": {
        const { email, password, full_name, role } = params;
        
        if (!email || !password) {
          return new Response(JSON.stringify({ error: "Email and password required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Validate password strength
        const passwordErrors = [];
        if (password.length < 12) passwordErrors.push("at least 12 characters");
        if (!/[A-Z]/.test(password)) passwordErrors.push("an uppercase letter");
        if (!/[a-z]/.test(password)) passwordErrors.push("a lowercase letter");
        if (!/[0-9]/.test(password)) passwordErrors.push("a number");
        if (!/[^A-Za-z0-9]/.test(password)) passwordErrors.push("a special character");
        
        if (passwordErrors.length > 0) {
          return new Response(JSON.stringify({ 
            error: `Password must contain ${passwordErrors.join(", ")}` 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });

        if (createError) throw createError;

        // Profile is created via trigger, but update full_name if needed
        if (full_name) {
          await supabaseAdmin
            .from("profiles")
            .update({ full_name })
            .eq("user_id", newUser.user.id);
        }

        // Set role
        await supabaseAdmin.from("user_roles").upsert({
          user_id: newUser.user.id,
          role: role || "staff",
        }, { onConflict: "user_id,role" });

        return new Response(JSON.stringify({ user: newUser.user }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update": {
        const { user_id, email, password, full_name, role } = params;
        
        if (!user_id) {
          return new Response(JSON.stringify({ error: "User ID required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Validate password strength if updating
        if (password) {
          const passwordErrors = [];
          if (password.length < 12) passwordErrors.push("at least 12 characters");
          if (!/[A-Z]/.test(password)) passwordErrors.push("an uppercase letter");
          if (!/[a-z]/.test(password)) passwordErrors.push("a lowercase letter");
          if (!/[0-9]/.test(password)) passwordErrors.push("a number");
          if (!/[^A-Za-z0-9]/.test(password)) passwordErrors.push("a special character");
          
          if (passwordErrors.length > 0) {
            return new Response(JSON.stringify({ 
              error: `Password must contain ${passwordErrors.join(", ")}` 
            }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Update auth user (email/password)
        const updates: Record<string, string> = {};
        if (email) updates.email = email;
        if (password) updates.password = password;

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, updates);
          if (updateError) throw updateError;
        }

        // Update profile
        if (full_name !== undefined) {
          await supabaseAdmin
            .from("profiles")
            .update({ full_name, email })
            .eq("user_id", user_id);
        }

        // Update role
        if (role) {
          // Delete existing roles first
          await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
          // Insert new role
          await supabaseAdmin.from("user_roles").insert({ user_id, role });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const { user_id } = params;
        
        if (!user_id) {
          return new Response(JSON.stringify({ error: "User ID required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Prevent self-deletion
        if (user_id === caller.id) {
          return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
        if (deleteError) throw deleteError;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

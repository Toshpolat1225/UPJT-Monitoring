import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { full_name, email, department_id, company_id, roles, password } = body;

    // Validation
    if (!full_name || typeof full_name !== "string" || !full_name.trim()) {
      return new Response(JSON.stringify({ error: "full_name is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return new Response(JSON.stringify({ error: "password must be at least 8 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return new Response(JSON.stringify({ error: "at least one role is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Verify the caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: callerRoles } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const isAdmin = (callerRoles ?? []).some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin permission required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = authData.user.id;

    // Update profile with department_id and company_id
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: full_name.trim(),
        email: email.trim(),
        department_id: department_id || null,
        company_id: company_id || null,
      })
      .eq("id", newUserId);

    if (profileError) {
      // User created but profile update failed — still return success
      console.error("Profile update failed:", profileError.message);
    }

    // Insert roles
    const roleRows = roles.map((r: string) => ({ user_id: newUserId, role: r }));
    const { error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .insert(roleRows);

    if (rolesError) {
      console.error("Roles insert failed:", rolesError.message);
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: newUserId,
      message: "User created successfully",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

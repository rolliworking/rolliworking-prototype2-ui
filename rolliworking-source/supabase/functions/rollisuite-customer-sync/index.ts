import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// RS customers endpoint
const RS_CUSTOMERS_URL =
  "https://djbjwcoddddywkgljuja.supabase.co/functions/v1/customers-sync";

interface RSWatch {
  estimate_number: string;
  brand?: string;
  model?: string;
  reference_number?: string;
  target_date?: string;
}

interface RSCustomer {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  external_id?: string;
  watches?: RSWatch[];
}

interface SyncResult {
  success: boolean;
  customersImported: number;
  customersSkipped: number;
  watchesImported: number;
  watchesSkipped: number;
  errors: string[];
}

type NormalizedCustomer = {
  name: string;
  email: string | null;
  phone: string | null;
};

function normalizeName(name: string) {
  return (name ?? "").trim();
}

function normalizeEmail(email?: string | null) {
  const e = (email ?? "").trim();
  return e ? e.toLowerCase() : null;
}

function normalizePhone(phone?: string | null) {
  const p = (phone ?? "").trim();
  if (!p) return null;
  const cleaned = p.replace(/[^\d+]/g, "");
  return cleaned || null;
}

function customerKey(c: NormalizedCustomer) {
  const name = c.name.toLowerCase();
  const email = c.email ?? "";
  const phone = c.phone ?? "";
  return `${name}||${email}||${phone}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function safeJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function applyFilter(customers: RSCustomer[], filter: string) {
  const f = filter.trim().toLowerCase();
  if (!f) return customers;

  return customers.filter((c) => {
    const name = (c.name ?? "").toLowerCase();
    const email = (c.email ?? "").toLowerCase();
    if (name.includes(f) || email.includes(f)) return true;

    if (Array.isArray(c.watches)) {
      return c.watches.some((w) => {
        const est = (w.estimate_number ?? "").toLowerCase();
        const ref = (w.reference_number ?? "").toLowerCase();
        return est.includes(f) || ref.includes(f);
      });
    }

    return false;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ROLLISUITE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ROLLISUITE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (req.method !== "GET" && req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Require a signed-in RW user (manager/owner)
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(
      jwt,
    );

    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: canEdit, error: permError } = await supabase.rpc(
      "can_edit_data",
      {
        _user_id: userData.user.id,
      },
    );

    if (permError) {
      console.error("Permission check failed:", permError);
      return new Response(JSON.stringify({ error: "Permission check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!canEdit) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const body = req.method === "POST" ? await safeJson(req) : {};

    const filter = (url.searchParams.get("filter") ?? body?.filter ?? "")
      .toString()
      .trim();
    const since = (url.searchParams.get("since") ?? body?.since ?? "")
      .toString()
      .trim();

    const rsLimitRaw = (url.searchParams.get("limit") ?? body?.limit ?? "20000")
      .toString()
      .trim();
    const rsLimit = Math.min(
      Math.max(parseInt(rsLimitRaw, 10) || 20000, 1),
      50000,
    );

    console.log("Fetching customers from RS with pagination...", {
      filter: filter || undefined,
      since: since || undefined,
      targetLimit: rsLimit,
    });

    // Paginate through RS to get all customers (RS has 1000-row default cap)
    const RS_PAGE_SIZE = 1000;
    let customers: RSCustomer[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && customers.length < rsLimit) {
      const remoteUrl = new URL(RS_CUSTOMERS_URL);
      remoteUrl.searchParams.set("limit", String(RS_PAGE_SIZE));
      remoteUrl.searchParams.set("offset", String(offset));
      if (filter) remoteUrl.searchParams.set("filter", filter);

      console.log(`Fetching RS page: offset=${offset}, limit=${RS_PAGE_SIZE}`);

      const response = await fetch(remoteUrl.toString(), {
        method: "GET",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("RS fetch failed:", response.status, errorText);
        return new Response(
          JSON.stringify({ error: "Failed to fetch customers from RS", details: errorText }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const pageCustomers: RSCustomer[] = data?.customers || data?.records || data || [];

      if (!Array.isArray(pageCustomers)) {
        return new Response(
          JSON.stringify({
            error: "Invalid response format from RS",
            received: typeof pageCustomers,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      console.log(`RS page returned ${pageCustomers.length} customers`);
      customers = customers.concat(pageCustomers);
      offset += pageCustomers.length;

      // Stop if we got fewer than requested (no more pages) or hit our limit
      if (pageCustomers.length < RS_PAGE_SIZE || customers.length >= rsLimit) {
        hasMore = false;
      }
    }

    // Trim to requested limit
    if (customers.length > rsLimit) {
      customers = customers.slice(0, rsLimit);
    }

    if (filter) customers = applyFilter(customers, filter);

    console.log(`Total received from RS: ${customers.length} customers (${Math.ceil(offset / RS_PAGE_SIZE)} pages)`);

    const result: SyncResult = {
      success: true,
      customersImported: 0,
      customersSkipped: 0,
      watchesImported: 0,
      watchesSkipped: 0,
      errors: [],
    };

    // =========================================================================
    // STEP 1: Load all existing customers (paged to avoid 1000-row limit)
    // =========================================================================
    const customerIdByKey = new Map<string, string>();
    const PAGE_SIZE = 1000;

    for (let from = 0; ; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1;
      const { data: existing, error } = await supabase
        .from("customers")
        .select("id,name,email,phone")
        .range(from, to);

      if (error) throw new Error(`Failed to load existing customers: ${error.message}`);

      for (const c of existing || []) {
        const normalized: NormalizedCustomer = {
          name: normalizeName(c.name),
          email: normalizeEmail(c.email),
          phone: normalizePhone(c.phone),
        };
        customerIdByKey.set(customerKey(normalized), c.id);
      }

      if (!existing || existing.length < PAGE_SIZE) break;
    }

    console.log(`Loaded ${customerIdByKey.size} existing customers from RW`);

    // =========================================================================
    // STEP 2: Determine new customers to insert (dedup incoming + skip existing)
    // =========================================================================
    const customersToInsert: Array<{ key: string; row: NormalizedCustomer }> = [];
    const seenIncomingKeys = new Set<string>();

    for (const c of customers) {
      const name = normalizeName(c.name);
      if (!name) {
        result.customersSkipped++;
        continue;
      }

      const normalized: NormalizedCustomer = {
        name,
        email: normalizeEmail(c.email),
        phone: normalizePhone(c.phone),
      };

      const key = customerKey(normalized);
      if (seenIncomingKeys.has(key)) {
        result.customersSkipped++;
        continue;
      }
      seenIncomingKeys.add(key);

      if (!customerIdByKey.has(key)) {
        customersToInsert.push({ key, row: normalized });
      } else {
        result.customersSkipped++;
      }
    }

    // =========================================================================
    // STEP 3: Batch insert new customers
    // =========================================================================
    for (const group of chunk(customersToInsert, 500)) {
      const payload = group.map((g) => ({
        name: g.row.name,
        email: g.row.email,
        phone: g.row.phone,
      }));

      const { data: inserted, error } = await supabase
        .from("customers")
        .insert(payload)
        .select("id,name,email,phone");

      if (error) {
        console.error("Error inserting customer batch:", error);
        result.errors.push(`Failed inserting customer batch: ${error.message}`);
        continue;
      }

      for (const c of inserted || []) {
        const normalized: NormalizedCustomer = {
          name: normalizeName(c.name),
          email: normalizeEmail(c.email),
          phone: normalizePhone(c.phone),
        };
        customerIdByKey.set(customerKey(normalized), c.id);
      }

      result.customersImported += inserted?.length || 0;
    }

    // =========================================================================
    // STEP 4: Build watch candidates (dedup by estimate_number)
    // =========================================================================
    type WatchRow = {
      customer_id: string;
      estimate_number: string;
      brand: string;
      model: string | null;
      reference_number: string | null;
      target_date: string | null;
    };

    const watchByEstimate = new Map<string, WatchRow>();

    for (const c of customers) {
      const normalized: NormalizedCustomer = {
        name: normalizeName(c.name),
        email: normalizeEmail(c.email),
        phone: normalizePhone(c.phone),
      };
      const id = customerIdByKey.get(customerKey(normalized));
      if (!id) continue;

      if (!Array.isArray(c.watches)) continue;

      for (const w of c.watches) {
        const estimate = (w.estimate_number ?? "").trim();
        if (!estimate) {
          result.watchesSkipped++;
          continue;
        }

        if (!watchByEstimate.has(estimate)) {
          watchByEstimate.set(estimate, {
            customer_id: id,
            estimate_number: estimate,
            brand: (w.brand ?? "Unknown").trim() || "Unknown",
            model: (w.model ?? "").trim() || null,
            reference_number: (w.reference_number ?? "").trim() || null,
            target_date: (w.target_date ?? "").trim() || null,
          });
        }
      }
    }

    // =========================================================================
    // STEP 5: Load existing watches by estimate_number (batched)
    // =========================================================================
    const estimates = [...watchByEstimate.keys()];
    const existingEstimates = new Set<string>();

    for (const group of chunk(estimates, 500)) {
      const { data: existing, error } = await supabase
        .from("watches")
        .select("estimate_number")
        .in("estimate_number", group);

      if (error) {
        console.error("Error loading existing watches:", error);
        result.errors.push(`Failed loading existing watches: ${error.message}`);
        continue;
      }

      for (const w of existing || []) existingEstimates.add(w.estimate_number);
    }

    // =========================================================================
    // STEP 6: Batch insert new watches
    // =========================================================================
    const watchesToInsert = estimates
      .filter((e) => !existingEstimates.has(e))
      .map((e) => watchByEstimate.get(e)!)
      .filter(Boolean);

    result.watchesSkipped += existingEstimates.size;

    for (const group of chunk(watchesToInsert, 500)) {
      const { error } = await supabase.from("watches").insert(group);
      if (error) {
        console.error("Error inserting watches batch:", error);
        result.errors.push(`Failed inserting watches batch: ${error.message}`);
        continue;
      }
      result.watchesImported += group.length;
    }

    result.success = result.errors.length === 0;

    console.log("Sync complete:", result);

    return new Response(
      JSON.stringify({
        success: result.success,
        filter: filter || null,
        rsCustomersReceived: customers.length,
        rsLimitRequested: rsLimit,
        rsPagesLoaded: Math.ceil(offset / 1000),
        customersImported: result.customersImported,
        customersSkipped: result.customersSkipped,
        watchesImported: result.watchesImported,
        watchesSkipped: result.watchesSkipped,
        errors: result.errors,
        message: filter
          ? `Synced matches for "${filter}" (imported ${result.customersImported} clients, ${result.watchesImported} watches)`
          : `Imported ${result.customersImported} clients, ${result.watchesImported} watches`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in rollisuite-customer-sync:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLatestMeaningfulApprovalsByInspection } from "@/lib/inspection-approval-utils";

export type SearchResultType = "estimate" | "approval" | "part" | "customer" | "band_only";

export interface SearchResultLink {
  label: string;
  url: string;
}

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  jobStatus?: string | null;
  link: string;
  secondaryLinks?: SearchResultLink[];
}

interface UseGlobalSearchOptions {
  minChars?: number;
  debounceMs?: number;
  limit?: number;
}

function normalizeEstimateNumber(input: string): string {
  const trimmed = input.trim().toUpperCase();
  const withoutPrefix = trimmed
    .replace(/^E-?/i, "")
    .replace(/^EST-?/i, "");
  return withoutPrefix.replace(/[^\d]/g, "") || trimmed;
}

export function useGlobalSearch(
  searchTerm: string,
  options: UseGlobalSearchOptions = {}
) {
  const { minChars = 2, debounceMs = 200, limit = 10 } = options;

  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [debouncedTerm, setDebouncedTerm] = useState("");

  useEffect(() => {
    if (searchTerm.length < minChars) {
      setDebouncedTerm("");
      setResults([]);
      return;
    }
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), debounceMs);
    return () => clearTimeout(timer);
  }, [searchTerm, minChars, debounceMs]);

  useEffect(() => {
    if (!debouncedTerm) {
      setResults([]);
      return;
    }

    const abortController = new AbortController();

    async function performSearch() {
      setIsLoading(true);
      try {
        const term = debouncedTerm.trim();
        const normalizedEstimate = normalizeEstimateNumber(term);
        const ilikeTerm = `%${term}%`;

        const [estimatesRes, approvalsRes, orphanApprovalsRes, partsRes, customersRes, bandOnlyRes] = await Promise.all([
          supabase
            .from("jobs")
            .select("id, estimate_number, client_name, status, watch_brand, watch_model")
            .or(`estimate_number.ilike.%${normalizedEstimate}%,serial_number.ilike.${ilikeTerm}`)
            .limit(limit),

          supabase
            .from("inspection_approvals")
            .select("id, status, client_name, client_email, approved_at, inspection_id, inspections!inner(watch_id, watches!inner(estimate_number, brand, model))")
            .or(`client_name.ilike.${ilikeTerm},client_email.ilike.${ilikeTerm}`)
            .limit(limit),

          supabase
            .from("inspections")
            .select("id, watches!inner(estimate_number, reference_number, brand, model, customers(name))")
            .or(`watches.estimate_number.ilike.%${normalizedEstimate}%,watches.reference_number.ilike.${ilikeTerm}`)
            .limit(limit),

          supabase
            .from("model_references")
            .select("id, part_number, brand, model, notes")
            .or(`part_number.ilike.${ilikeTerm},notes.ilike.${ilikeTerm},brand.ilike.${ilikeTerm}`)
            .limit(limit),

          supabase
            .from("customers")
            .select("id, name, email, phone")
            .or(`name.ilike.${ilikeTerm},email.ilike.${ilikeTerm},phone.ilike.${ilikeTerm}`)
            .limit(limit),

          supabase
            .from("inspections")
            .select("id, inspection_type, watches!inner(estimate_number, brand, model, customers(name, email))")
            .eq("inspection_type", "bracelet_only")
            .or(`watches.estimate_number.ilike.%${normalizedEstimate}%,watches.customers.name.ilike.${ilikeTerm}`)
            .limit(limit),
        ]);

        if (abortController.signal.aborted) return;

        const allResults: SearchResult[] = [];

        if (estimatesRes.data) {
          for (const job of estimatesRes.data) {
            const watchInfo = [job.watch_brand, job.watch_model].filter(Boolean).join(" ");
            const preApproval = ["intake", "inspection", "waiting_approval"].includes(job.status);
            const primaryLink = preApproval ? `/history` : `/work-queue?job=${job.id}`;
            const secondaryLinks = preApproval
              ? [
                  { label: "History", url: `/history` },
                  { label: "Follow Up", url: `/band-work-queue` },
                ]
              : [
                  { label: "Work Queue", url: `/work-queue?job=${job.id}` },
                  { label: "History", url: `/history` },
                ];
            allResults.push({
              type: "estimate",
              id: job.id,
              title: job.estimate_number || `Job ${job.id.slice(0, 8)}`,
              subtitle: [job.client_name, watchInfo].filter(Boolean).join(" • "),
              jobStatus: job.status,
              link: primaryLink,
              secondaryLinks,
            });
          }
        }

        const seenApprovalInspectionIds = new Set<string>();

        if (approvalsRes.data) {
          const latestByInspection = getLatestMeaningfulApprovalsByInspection(
            approvalsRes.data.map((approval) => ({
              ...approval,
              created_at: approval.approved_at || new Date().toISOString(),
            }))
          );

          for (const approval of latestByInspection.values()) {
            seenApprovalInspectionIds.add(approval.inspection_id);
            const inspection = approval.inspections as any;
            const watch = inspection?.watches;
            const estimateNum = watch?.estimate_number || "";
            const watchInfo = [watch?.brand, watch?.model].filter(Boolean).join(" ");
            allResults.push({
              type: "approval",
              id: approval.id,
              title: estimateNum ? `${estimateNum}` : `Approval`,
              subtitle: [approval.client_name, watchInfo, approval.status].filter(Boolean).join(" • "),
              jobStatus: approval.status === "approved" ? "finished" : approval.status === "declined" ? "parts_approval" : "waiting_approval",
              link: `/history?approval=${approval.id}`,
            });
          }
        }

        if (orphanApprovalsRes.data) {
          for (const inspection of orphanApprovalsRes.data) {
            if (seenApprovalInspectionIds.has(inspection.id)) continue;
            const watch = inspection.watches as any;
            const estimateNum = watch?.estimate_number || "";
            const watchInfo = [watch?.brand, watch?.model].filter(Boolean).join(" ");
            allResults.push({
              type: "approval",
              id: inspection.id,
              title: estimateNum ? `${estimateNum}` : `Approval`,
              subtitle: [watch?.customers?.name, watchInfo, "inspection only"].filter(Boolean).join(" • "),
              jobStatus: "waiting_approval",
              link: `/history`,
            });
          }
        }

        if (partsRes.data) {
          for (const part of partsRes.data) {
            allResults.push({
              type: "part",
              id: part.id,
              title: part.part_number,
              subtitle: [part.brand, part.model].filter(Boolean).join(" "),
              link: `/data-management?part=${part.id}`,
            });
          }
        }

        if (customersRes.data) {
          for (const customer of customersRes.data) {
            allResults.push({
              type: "customer",
              id: customer.id,
              title: customer.name,
              subtitle: customer.email || customer.phone || null,
              link: `/clients?customer=${customer.id}`,
            });
          }
        }

        if (bandOnlyRes.data) {
          // Check which band-only inspections already have a job
          const bandInspectionIds = bandOnlyRes.data.map((i) => i.id);
          const { data: existingJobs } = bandInspectionIds.length > 0
            ? await supabase
                .from("jobs")
                .select("id, inspection_id")
                .in("inspection_id", bandInspectionIds)
            : { data: [] };

          const jobByInspection = new Map(
            (existingJobs || []).map((j) => [j.inspection_id, j.id])
          );

          for (const insp of bandOnlyRes.data) {
            // Skip if already shown as an estimate result
            const watch = insp.watches as any;
            const estNum = watch?.estimate_number || "";
            if (allResults.some((r) => r.type === "estimate" && r.title === estNum)) continue;

            const watchInfo = [watch?.brand, watch?.model].filter(Boolean).join(" ");
            const customerName = watch?.customers?.name || "";
            const existingJobId = jobByInspection.get(insp.id);

            allResults.push({
              type: "band_only",
              id: insp.id,
              title: estNum || `Inspection ${insp.id.slice(0, 8)}`,
              subtitle: [customerName, watchInfo, "Band Only"].filter(Boolean).join(" • "),
              jobStatus: existingJobId ? "has_job" : null,
              link: existingJobId
                ? `/parts-request?job=${existingJobId}`
                : `/work-queue?create_band_job=${insp.id}`,
            });
          }
        }

        setResults(allResults);
      } catch (error) {
        console.error("Global search error:", error);
        setResults([]);
      } finally {
        if (!abortController.signal.aborted) setIsLoading(false);
      }
    }

    performSearch();
    return () => { abortController.abort(); };
  }, [debouncedTerm, limit]);

  const groupedResults = useMemo(() => {
    const groups: Record<SearchResultType, SearchResult[]> = {
      estimate: [],
      approval: [],
      part: [],
      customer: [],
      band_only: [],
    };
    for (const result of results) {
      groups[result.type].push(result);
    }
    return groups;
  }, [results]);

  return {
    results,
    groupedResults,
    isLoading,
    isEmpty: debouncedTerm.length >= minChars && !isLoading && results.length === 0,
    hasQuery: debouncedTerm.length >= minChars,
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ModelReference {
  id: string;
  part_number: string;
  brand: string;
  model: string | null;
  caliber: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export function useModelReferences() {
  return useQuery({
    queryKey: ["model-references"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("model_references")
        .select("*")
        .order("brand", { ascending: true });

      if (error) throw error;
      return data as ModelReference[];
    },
  });
}

export function useCheckReferenceExists() {
  return useMutation({
    mutationFn: async (partNumber: string) => {
      const refPart = partNumber.split("-")[0].trim().toUpperCase();
      
      const { data, error } = await supabase
        .from("model_references")
        .select("id, part_number, brand, model")
        .ilike("part_number", refPart)
        .limit(1);

      if (error) throw error;
      return data.length > 0 ? data[0] : null;
    },
  });
}

export function useAddModelReference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      partNumber,
      brand,
      model,
    }: {
      partNumber: string;
      brand: string;
      model?: string;
    }) => {
      // Extract just the reference part (before any dash)
      const refPart = partNumber.split("-")[0].trim().toUpperCase();

      const { data, error } = await supabase
        .from("model_references")
        .upsert(
          {
            part_number: refPart,
            brand,
            model: model || null,
            source: "portal",
          },
          { onConflict: "part_number" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["model-references"] });
      toast.success("Reference saved to library");
    },
    onError: (error) => {
      console.error("Error saving reference:", error);
      toast.error("Failed to save reference");
    },
  });
}

/**
 * Look up a reference number in the model_references table.
 * Returns brand/model if found, null otherwise.
 */
export async function lookupReferenceInDatabase(
  referenceNumber: string
): Promise<{ brand: string; model: string } | null> {
  if (!referenceNumber) return null;

  const refPart = referenceNumber.split("-")[0].trim().toUpperCase();

  const { data, error } = await supabase
    .from("model_references")
    .select("brand, model")
    .ilike("part_number", refPart)
    .limit(1);

  if (error || !data || data.length === 0) return null;

  return {
    brand: data[0].brand,
    model: data[0].model || "",
  };
}

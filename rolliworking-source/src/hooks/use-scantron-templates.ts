import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ScantronTemplate {
  id: string;
  version: string;
  label: string | null;
  storage_path: string;
  is_active: boolean;
  uploaded_by: string | null;
  created_at: string;
}

export function useScantronTemplates() {
  return useQuery({
    queryKey: ["scantron-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scantron_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ScantronTemplate[];
    },
  });
}

export function useActiveScantronTemplate() {
  return useQuery({
    queryKey: ["scantron-templates", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scantron_templates")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data as ScantronTemplate | null;
    },
  });
}

/** Get the public URL for the active template image */
export async function getActiveTemplateUrl(): Promise<string | null> {
  const { data, error } = await supabase
    .from("scantron_templates")
    .select("storage_path")
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  
  const { data: urlData } = supabase.storage
    .from("scantron-templates")
    .getPublicUrl(data.storage_path);
  
  return urlData?.publicUrl || null;
}

export function useUploadScantronTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, version, label }: { file: File; version: string; label?: string }) => {
      const ext = file.name.split(".").pop() || "pdf";
      const storagePath = `${version}.${ext}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("scantron-templates")
        .upload(storagePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Deactivate all other templates
      await supabase
        .from("scantron_templates")
        .update({ is_active: false } as any)
        .neq("id", "00000000-0000-0000-0000-000000000000"); // update all

      // Upsert template record (handle duplicate versions)
      const { data, error } = await supabase
        .from("scantron_templates")
        .upsert({
          version,
          label: label || null,
          storage_path: storagePath,
          is_active: true,
        } as any, { onConflict: "version" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["scantron-templates"] });
      toast.success(`Template ${vars.version} uploaded and set as active`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to upload template");
    },
  });
}

export function useSetActiveTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Deactivate all
      await supabase
        .from("scantron_templates")
        .update({ is_active: false } as any)
        .neq("id", "00000000-0000-0000-0000-000000000000");
      // Activate selected
      const { error } = await supabase
        .from("scantron_templates")
        .update({ is_active: true } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scantron-templates"] });
      toast.success("Active template updated");
    },
  });
}

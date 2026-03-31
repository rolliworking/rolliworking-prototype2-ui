import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CustomNote {
  id: string;
  section: string;
  note: string;
  created_by: string | null;
  created_at: string;
}

export function useCustomNotes(section?: string) {
  return useQuery({
    queryKey: ["custom-notes", section],
    queryFn: async () => {
      let query = supabase
        .from("custom_notes")
        .select("*")
        .order("note", { ascending: true });

      if (section) {
        query = query.eq("section", section);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CustomNote[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useAddCustomNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ section, note }: { section: string; note: string }) => {
      const { data, error } = await supabase
        .from("custom_notes")
        .insert({ section, note: note.trim() })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("This note already exists");
        }
        throw error;
      }
      return data as CustomNote;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["custom-notes", variables.section] });
      queryClient.invalidateQueries({ queryKey: ["custom-notes"] });
      toast.success("Note saved to library");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save note");
    },
  });
}

export function useDeleteCustomNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-notes"] });
      toast.success("Note removed from library");
    },
    onError: () => {
      toast.error("Failed to remove note");
    },
  });
}

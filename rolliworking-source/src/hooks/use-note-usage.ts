import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NoteUsage {
  id: string;
  section: string;
  note: string;
  usage_count: number;
  last_used_at: string;
}

export function useNoteUsage(section?: string) {
  return useQuery({
    queryKey: ["note-usage", section],
    queryFn: async () => {
      let query = supabase
        .from("note_usage")
        .select("*")
        .order("usage_count", { ascending: false });

      if (section) {
        query = query.eq("section", section);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as NoteUsage[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useTopNotes(section: string, limit = 3) {
  const { data: usageData = [] } = useNoteUsage(section);
  
  // Return top N notes for this section
  return usageData
    .slice(0, limit)
    .map((u) => u.note);
}

export function useTrackNoteUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ section, notes }: { section: string; notes: string[] }) => {
      // Use upsert to increment usage count for each note
      for (const note of notes) {
        // First try to get existing record
        const { data: existing } = await supabase
          .from("note_usage")
          .select("id, usage_count")
          .eq("section", section)
          .eq("note", note)
          .single();

        if (existing) {
          // Update existing - increment count
          await supabase
            .from("note_usage")
            .update({ 
              usage_count: existing.usage_count + 1,
              last_used_at: new Date().toISOString()
            })
            .eq("id", existing.id);
        } else {
          // Insert new
          await supabase
            .from("note_usage")
            .insert({ section, note, usage_count: 1 });
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["note-usage", variables.section] });
      queryClient.invalidateQueries({ queryKey: ["note-usage"] });
    },
  });
}

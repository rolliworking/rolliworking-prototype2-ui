import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EmailTemplateType = 
  | "movement_service_update"
  | "bracelet_work_update"
  | "parts_approval"
  | "inspection_complete"
  | "inspection_notes"
  | "inspection_approval"
  | "waiting_approval"
  | "job_complete"
  | "liability_waiver"
  | "status_downgrade"
  | "bracelet_reply_confirmation"
  | "follow_up"
  | "custom";

export interface EmailTemplate {
  id: string;
  name: string;
  type: EmailTemplateType;
  subject: string;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateInsert {
  name: string;
  type: EmailTemplateType;
  subject: string;
  body: string;
  is_active?: boolean;
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: ["email_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as EmailTemplate[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - templates change rarely
  });
}

export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: EmailTemplateInsert) => {
      const { data, error } = await supabase
        .from("email_templates")
        .insert(template)
        .select()
        .single();
      if (error) throw error;
      return data as EmailTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_templates"] });
    },
  });
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EmailTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from("email_templates")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as EmailTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_templates"] });
    },
  });
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_templates"] });
    },
  });
}

export const TEMPLATE_TYPE_LABELS: Record<EmailTemplateType, string> = {
  movement_service_update: "Movement Service Update",
  bracelet_work_update: "Bracelet Work Update",
  parts_approval: "Parts Approval",
  inspection_complete: "Inspection Complete",
  inspection_notes: "Inspection Notes",
  inspection_approval: "Inspection Approval",
  waiting_approval: "Waiting Approval",
  job_complete: "Job Complete",
  liability_waiver: "Liability Waiver",
  status_downgrade: "Status Downgrade",
  bracelet_reply_confirmation: "Bracelet Reply Confirmation",
  follow_up: "Follow Up",
  custom: "Custom",
};

export const TEMPLATE_TYPE_COLORS: Record<EmailTemplateType, string> = {
  movement_service_update: "bg-blue-100 text-blue-700",
  bracelet_work_update: "bg-purple-100 text-purple-700",
  parts_approval: "bg-amber-100 text-amber-700",
  inspection_complete: "bg-green-100 text-green-700",
  inspection_notes: "bg-teal-100 text-teal-700",
  inspection_approval: "bg-indigo-100 text-indigo-700",
  waiting_approval: "bg-orange-100 text-orange-700",
  job_complete: "bg-emerald-100 text-emerald-700",
  liability_waiver: "bg-rose-100 text-rose-700",
  status_downgrade: "bg-red-100 text-red-700",
  bracelet_reply_confirmation: "bg-cyan-100 text-cyan-700",
  follow_up: "bg-yellow-100 text-yellow-700",
  custom: "bg-slate-100 text-slate-700",
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EstimateTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EstimateTemplateLine {
  id: string;
  template_id: string;
  part_id: string | null;
  part?: {
    id: string;
    part_number: string;
    description: string;
    default_sell_price: number | null;
  } | null;
  service_subcategory_id: string | null;
  line_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  taxable: boolean;
  sort_order: number | null;
  created_at: string;
}

export interface EstimateTemplateWithLines extends EstimateTemplate {
  lines: EstimateTemplateLine[];
}

export function useEstimateTemplates() {
  return useQuery({
    queryKey: ['estimate-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimate_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as EstimateTemplate[];
    },
  });
}

export function useEstimateTemplate(id: string | null) {
  return useQuery({
    queryKey: ['estimate-template', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data: template, error: templateError } = await supabase
        .from('estimate_templates')
        .select('*')
        .eq('id', id)
        .single();
      if (templateError) throw templateError;

      const { data: lines, error: linesError } = await supabase
        .from('estimate_template_lines')
        .select('*, part:parts(id, part_number, description, default_sell_price)')
        .eq('template_id', id)
        .order('sort_order');
      if (linesError) throw linesError;

      return {
        ...template,
        lines: lines || [],
      } as EstimateTemplateWithLines;
    },
    enabled: !!id,
  });
}

export function useCreateEstimateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      lines: Array<{
        part_id?: string | null;
        service_subcategory_id?: string | null;
        line_type: string;
        description: string;
        quantity: number;
        unit_price: number;
        taxable: boolean;
        sort_order?: number;
      }>;
    }) => {
      const { data: template, error: templateError } = await supabase
        .from('estimate_templates')
        .insert({
          name: data.name,
          description: data.description || null,
        })
        .select()
        .single();
      if (templateError) throw templateError;

      if (data.lines.length > 0) {
        const { error: linesError } = await supabase
          .from('estimate_template_lines')
          .insert(
            data.lines.map((line, index) => ({
              template_id: template.id,
              part_id: line.part_id || null,
              service_subcategory_id: line.service_subcategory_id || null,
              line_type: line.line_type,
              description: line.description,
              quantity: line.quantity,
              unit_price: line.unit_price,
              taxable: line.taxable,
              sort_order: line.sort_order ?? index,
            }))
          );
        if (linesError) throw linesError;
      }

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-templates'] });
      toast.success('Template created successfully');
    },
    onError: (error) => {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
    },
  });
}

export function useUpdateEstimateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      name: string;
      description?: string;
      lines: Array<{
        id?: string;
        part_id?: string | null;
        service_subcategory_id?: string | null;
        line_type: string;
        description: string;
        quantity: number;
        unit_price: number;
        taxable: boolean;
        sort_order?: number;
      }>;
    }) => {
      const { error: templateError } = await supabase
        .from('estimate_templates')
        .update({
          name: data.name,
          description: data.description || null,
        })
        .eq('id', data.id);
      if (templateError) throw templateError;

      // Delete existing lines and re-insert
      const { error: deleteError } = await supabase
        .from('estimate_template_lines')
        .delete()
        .eq('template_id', data.id);
      if (deleteError) throw deleteError;

      if (data.lines.length > 0) {
        const { error: linesError } = await supabase
          .from('estimate_template_lines')
          .insert(
            data.lines.map((line, index) => ({
              template_id: data.id,
              part_id: line.part_id || null,
              service_subcategory_id: line.service_subcategory_id || null,
              line_type: line.line_type,
              description: line.description,
              quantity: line.quantity,
              unit_price: line.unit_price,
              taxable: line.taxable,
              sort_order: line.sort_order ?? index,
            }))
          );
        if (linesError) throw linesError;
      }

      return data.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['estimate-templates'] });
      queryClient.invalidateQueries({ queryKey: ['estimate-template', id] });
      toast.success('Template updated successfully');
    },
    onError: (error) => {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    },
  });
}

export function useDeleteEstimateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('estimate_templates')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-templates'] });
      toast.success('Template deleted');
    },
    onError: (error) => {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    },
  });
}

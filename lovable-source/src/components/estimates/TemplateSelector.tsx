import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText, ChevronDown, Loader2, Plus } from 'lucide-react';
import { useEstimateTemplates, useEstimateTemplate, useCreateEstimateTemplate } from '@/hooks/useEstimateTemplates';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface LineItem {
  id: string;
  product: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
  taxable: boolean;
}

interface TemplateSelectorProps {
  onLoadTemplate: (lines: LineItem[]) => void;
  currentLineItems?: LineItem[];
}

export function TemplateSelector({ onLoadTemplate, currentLineItems = [] }: TemplateSelectorProps) {
  const { data: templates, isLoading: templatesLoading } = useEstimateTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const createTemplate = useCreateEstimateTemplate();
  
  const { data: templateDetails, isLoading: detailsLoading } = useEstimateTemplate(selectedTemplateId);

  // When template details are loaded, transform and send to parent
  const handleSelectTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    setOpen(false);
  };

  const handleAddNew = async () => {
    try {
      // Convert current line items to template line format
      const templateLines = currentLineItems.map((item, index) => ({
        description: item.description || item.product || '',
        quantity: item.qty,
        unit_price: item.rate,
        taxable: item.taxable,
        sort_order: index,
        line_type: 'service' as const,
      }));

      await createTemplate.mutateAsync({
        name: 'Blank',
        description: '',
        lines: templateLines,
      });
      toast.success('Created new template from current lines');
      setOpen(false);
    } catch (error) {
      toast.error('Failed to create template');
    }
  };

  // Effect to load template when details are fetched
  if (templateDetails && selectedTemplateId) {
    const lines: LineItem[] = templateDetails.lines.map((line, index) => ({
      id: String(Date.now() + index),
      product: line.description.split(' - ')[0] || '',
      description: line.description,
      qty: Number(line.quantity),
      rate: Number(line.unit_price),
      amount: Number(line.quantity) * Number(line.unit_price),
      taxable: line.taxable,
    }));
    
    onLoadTemplate(lines);
    setSelectedTemplateId(null); // Reset to prevent re-loading
  }

  const hasTemplates = templates && templates.length > 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="text-sm border-slate-300 text-slate-700"
          disabled={detailsLoading || createTemplate.isPending}
        >
        {(detailsLoading || createTemplate.isPending) ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <FileText className="h-4 w-4 mr-1" />
        )}
        Load Template
        <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
        {templatesLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        ) : hasTemplates ? (
          <>
            <DropdownMenuItem
              onClick={handleAddNew}
              className="cursor-pointer text-[#0077c5]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {templates.map((template) => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => handleSelectTemplate(template.id)}
                className="cursor-pointer"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{template.name}</span>
                  {template.description && (
                    <span className="text-xs text-slate-500">{template.description}</span>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/estimates/templates" className="cursor-pointer text-[#0077c5]">
                Manage templates...
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <div className="px-2 py-3 text-center text-sm text-slate-500">
              No templates created yet
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/estimates/templates" className="cursor-pointer text-[#0077c5]">
                Create a template...
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

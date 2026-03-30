import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface TemplateVariable {
  token: string;
  label: string;
  description: string;
  category: 'customer' | 'watch' | 'estimate' | 'job' | 'general';
}

export const EMAIL_TEMPLATE_VARIABLES: TemplateVariable[] = [
  // Customer variables
  { token: '{{first_name}}', label: 'First Name', description: 'Customer first name', category: 'customer' },
  { token: '{{last_name}}', label: 'Last Name', description: 'Customer last name', category: 'customer' },
  { token: '{{full_name}}', label: 'Full Name', description: 'Customer full name', category: 'customer' },
  { token: '{{email}}', label: 'Email', description: 'Customer email address', category: 'customer' },
  { token: '{{phone}}', label: 'Phone', description: 'Customer phone number', category: 'customer' },
  
  // Watch variables
  { token: '{{brand}}', label: 'Brand', description: 'Watch brand (e.g., Rolex)', category: 'watch' },
  { token: '{{model}}', label: 'Model', description: 'Watch model name', category: 'watch' },
  { token: '{{part_number}}', label: 'Part #', description: 'Watch part number', category: 'watch' },
  { token: '{{serial_number}}', label: 'Serial #', description: 'Watch serial number', category: 'watch' },
  
  // Estimate variables
  { token: '{{estimate_number}}', label: 'Estimate #', description: 'Estimate number (e.g., EST-001)', category: 'estimate' },
  { token: '{{estimate_total}}', label: 'Total', description: 'Estimate total amount', category: 'estimate' },
  { token: '{{valid_until}}', label: 'Valid Until', description: 'Estimate expiration date', category: 'estimate' },
  { token: '{{items_received}}', label: 'Items Received', description: 'List of items received (e.g., "watch and bracelet")', category: 'estimate' },
  
  // Job variables
  { token: '{{job_id}}', label: 'Job ID', description: 'Job identifier', category: 'job' },
  { token: '{{set_number}}', label: 'Set #', description: 'Job set number', category: 'job' },
  { token: '{{status}}', label: 'Status', description: 'Current job status', category: 'job' },
  { token: '{{due_date}}', label: 'Due Date', description: 'Expected completion date', category: 'job' },
  
  // General variables
  { token: '{{today_date}}', label: 'Today', description: 'Current date', category: 'general' },
  { token: '{{company_name}}', label: 'Company', description: 'Your company name', category: 'general' },
];

const CATEGORY_LABELS: Record<TemplateVariable['category'], string> = {
  customer: 'Customer',
  watch: 'Watch',
  estimate: 'Estimate',
  job: 'Job',
  general: 'General',
};

const CATEGORY_COLORS: Record<TemplateVariable['category'], string> = {
  customer: 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  watch: 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  estimate: 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300',
  job: 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
  general: 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300',
};

interface EmailTemplateVariablesProps {
  onInsert: (token: string) => void;
  compact?: boolean;
}

export function EmailTemplateVariables({ onInsert, compact = false }: EmailTemplateVariablesProps) {
  const categories = ['customer', 'watch', 'estimate', 'job', 'general'] as const;
  
  const groupedVariables = categories.reduce((acc, category) => {
    acc[category] = EMAIL_TEMPLATE_VARIABLES.filter(v => v.category === category);
    return acc;
  }, {} as Record<typeof categories[number], TemplateVariable[]>);

  if (compact) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap gap-1.5">
          {EMAIL_TEMPLATE_VARIABLES.map((variable) => (
            <Tooltip key={variable.token}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onInsert(variable.token)}
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${CATEGORY_COLORS[variable.category]}`}
                >
                  {variable.label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium">{variable.token}</p>
                <p className="text-muted-foreground">{variable.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">Insert Variable</span>
          <span>— Click to add to your template</span>
        </div>
        
        {categories.map((category) => (
          <div key={category} className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {CATEGORY_LABELS[category]}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {groupedVariables[category].map((variable) => (
                <Tooltip key={variable.token}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onInsert(variable.token)}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${CATEGORY_COLORS[variable.category]}`}
                    >
                      {variable.label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-mono font-medium">{variable.token}</p>
                    <p className="text-muted-foreground">{variable.description}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}

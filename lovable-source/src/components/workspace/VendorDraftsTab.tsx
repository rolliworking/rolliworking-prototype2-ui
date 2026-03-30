import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, FileText, DollarSign } from 'lucide-react';

interface VendorDraft {
  vendor_id: string;
  vendor_name: string;
  draft_count: number;
  total_value: number;
  po_ids: string[];
  po_numbers: string[];
}

export function VendorDraftsTab() {
  const { openTab } = useWorkspace();

  // Fetch draft POs grouped by vendor
  const { data: vendorDrafts, isLoading } = useQuery({
    queryKey: ['vendor-drafts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          vendor_id,
          total_amount,
          vendors (id, name)
        `)
        .eq('status', 'draft')
        .order('vendor_id');

      if (error) throw error;

      // Group by vendor
      const grouped = data.reduce((acc: Record<string, VendorDraft>, po) => {
        const vendorId = po.vendor_id;
        const vendorName = po.vendors?.name || 'Unknown Vendor';

        if (!acc[vendorId]) {
          acc[vendorId] = {
            vendor_id: vendorId,
            vendor_name: vendorName,
            draft_count: 0,
            total_value: 0,
            po_ids: [],
            po_numbers: [],
          };
        }

        acc[vendorId].draft_count += 1;
        acc[vendorId].total_value += po.total_amount || 0;
        acc[vendorId].po_ids.push(po.id);
        acc[vendorId].po_numbers.push(po.po_number);

        return acc;
      }, {});

      return Object.values(grouped).sort((a, b) => 
        a.vendor_name.localeCompare(b.vendor_name)
      );
    },
  });

  const handleOpenVendorDraft = (draft: VendorDraft) => {
    // Open the first draft PO for this vendor
    if (draft.po_ids.length > 0) {
      openTab({
        type: 'po',
        title: `PO: ${draft.po_numbers[0]}`,
        recordId: draft.po_ids[0],
      });
    }
  };

  const handleOpenVendor = (vendorId: string, vendorName: string) => {
    openTab({
      type: 'vendor',
      title: `Vendor: ${vendorName}`,
      recordId: vendorId,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Vendor Drafts</h1>
        <p className="text-muted-foreground">
          Draft purchase orders grouped by vendor - consolidate orders before issuing
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : !vendorDrafts || vendorDrafts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No draft purchase orders</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a new PO or add items from reorder alerts
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vendorDrafts.map((draft) => (
            <Card 
              key={draft.vendor_id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleOpenVendorDraft(draft)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base font-medium">
                      {draft.vendor_name}
                    </CardTitle>
                  </div>
                  <Badge variant="outline">
                    {draft.draft_count} {draft.draft_count === 1 ? 'Draft' : 'Drafts'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-sm">Total Value</span>
                  </div>
                  <span className="font-mono font-semibold">
                    ${draft.total_value.toFixed(2)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {draft.po_numbers.slice(0, 3).map((num) => (
                    <Badge key={num} variant="secondary" className="text-xs font-mono">
                      {num}
                    </Badge>
                  ))}
                  {draft.po_numbers.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{draft.po_numbers.length - 3} more
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

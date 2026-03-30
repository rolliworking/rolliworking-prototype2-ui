import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HelpCircle, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface CSVInstructionsDialogProps {
  defaultTab?: 'export' | 'import';
}

export function CSVInstructionsDialog({ defaultTab = 'export' }: CSVInstructionsDialogProps) {
  const { toast } = useToast();

  const downloadTemplate = () => {
    const headers = ['id', 'part_number', 'item_type'];
    const exampleRows = [
      ['abc123-uuid-here', 'PART-001', 'inventory'],
      ['def456-uuid-here', 'PART-002', 'service'],
      ['ghi789-uuid-here', 'PART-003', 'delete'],
    ];
    
    const csvContent = [
      headers.join(','),
      ...exampleRows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'parts-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
    
    toast({ title: 'Template downloaded', description: 'Replace example data with your actual part IDs' });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="CSV Instructions">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>CSV Import / Export Guide</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue={defaultTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>
          
          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Export your parts list to review or prepare for bulk edits.
              </p>
              
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="font-medium">What gets exported?</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>All parts matching your current <strong>search</strong> and <strong>type filter</strong></li>
                  <li>Full data including: id, part_number, description, item_type, costs, prices, etc.</li>
                </ul>
              </div>
              
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="font-medium">Steps</p>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                  <li>Optionally filter by type or search to narrow results</li>
                  <li>Click the <strong>Download</strong> icon to export</li>
                  <li>Open in Excel or Google Sheets</li>
                  <li>Edit the <code className="bg-background px-1 rounded">item_type</code> column as needed</li>
                  <li>Save and re-import to apply changes</li>
                </ol>
              </div>

              <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-2">
                <p className="font-medium">Important</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li><strong>Never change the <code className="bg-background px-1 rounded">id</code> column</strong> — it's how we match records</li>
                  <li>You can delete columns you don't need, but keep <code className="bg-background px-1 rounded">id</code> and <code className="bg-background px-1 rounded">item_type</code></li>
                </ul>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">
                  Import a CSV to update item types or deactivate parts in bulk.
                </p>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              {/* Required Format */}
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <p className="font-medium">Required CSV Format</p>
                <div className="border rounded-lg overflow-hidden bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono text-xs">id</TableHead>
                        <TableHead className="font-mono text-xs">part_number</TableHead>
                        <TableHead className="font-mono text-xs">item_type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-mono text-xs text-muted-foreground">abc123...</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">PART-001</TableCell>
                        <TableCell className="font-mono text-xs">inventory</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono text-xs text-muted-foreground">def456...</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">SVC-002</TableCell>
                        <TableCell className="font-mono text-xs">service</TableCell>
                      </TableRow>
                      <TableRow className="bg-destructive/5">
                        <TableCell className="font-mono text-xs text-muted-foreground">ghi789...</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">OLD-003</TableCell>
                        <TableCell className="font-mono text-xs text-destructive font-medium">delete</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">
                  The <code className="bg-background px-1 rounded">part_number</code> column is optional but helps identify records in the preview.
                </p>
              </div>

              {/* How to Edit */}
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <p className="font-medium">How to Edit the CSV</p>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium shrink-0">1</span>
                    <div>
                      <p className="font-medium">Change Item Type</p>
                      <p className="text-muted-foreground">Edit the <code className="bg-background px-1 rounded">item_type</code> column to one of: <code className="bg-background px-1 rounded">inventory</code>, <code className="bg-background px-1 rounded">non_inventory</code>, <code className="bg-background px-1 rounded">service</code>, <code className="bg-background px-1 rounded">assembly</code>, <code className="bg-background px-1 rounded">client_watch</code></p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium shrink-0">2</span>
                    <div>
                      <p className="font-medium">Deactivate (Remove) Items</p>
                      <p className="text-muted-foreground">Set <code className="bg-background px-1 rounded">item_type</code> to <code className="bg-background px-1 rounded">delete</code> — this marks the part as inactive without permanently deleting it</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="bg-muted-foreground text-background rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium shrink-0">3</span>
                    <div>
                      <p className="font-medium">Keep Items Unchanged</p>
                      <p className="text-muted-foreground">Leave the <code className="bg-background px-1 rounded">item_type</code> as-is, or remove the row entirely — parts not in the CSV are not affected</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* What Happens */}
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="font-medium">What Happens on Import</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li><strong>Preview first</strong> — you'll see exactly what will change before confirming</li>
                  <li><strong>Updates only</strong> — rows with IDs not in the database are skipped</li>
                  <li><strong>No effect on missing rows</strong> — parts not in your CSV remain unchanged</li>
                  <li><strong>Reversible</strong> — deactivated items can be reactivated later</li>
                </ul>
              </div>

              {/* Workflow Summary */}
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-2">
                <p className="font-medium">Quick Workflow</p>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                  <li>Export your current parts (or download the template above)</li>
                  <li>Open in Excel/Sheets and edit the <code className="bg-background px-1 rounded">item_type</code> column</li>
                  <li>Save as CSV</li>
                  <li>Click the Upload icon to import</li>
                  <li>Review the preview and click Confirm</li>
                </ol>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

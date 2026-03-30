import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HelpCircle, Download } from 'lucide-react';

interface CustomerCSVInstructionsDialogProps {
  defaultTab?: 'export' | 'import';
}

export function CustomerCSVInstructionsDialog({ defaultTab = 'export' }: CustomerCSVInstructionsDialogProps) {
  const [open, setOpen] = useState(false);

  const downloadTemplate = () => {
    const headers = ['id', 'first_name', 'last_name', 'display_name', 'email', 'phone', 'company_name', 'address', 'city', 'state', 'zip'];
    const exampleRows = [
      ['abc123-uuid-here', 'John', 'Doe', 'John Doe', 'john@example.com', '555-123-4567', 'Acme Inc', '123 Main St', 'Miami', 'FL', '33132'],
      ['def456-uuid-here', 'Jane', 'Smith', 'Jane Smith', 'jane@example.com', '555-987-6543', '', '456 Oak Ave', 'Orlando', 'FL', '32801'],
    ];

    const csvContent = [
      headers.join(','),
      ...exampleRows.map((row) => row.map(v => `"${v}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customer-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="CSV Import/Export Help">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Customer CSV Import/Export Guide</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="space-y-3">
              <h3 className="font-semibold">Exporting Customer Data</h3>
              <p className="text-sm text-muted-foreground">
                Click the <strong>Export CSV</strong> button to download all customers matching your current search filter.
              </p>
              
              <h4 className="font-medium text-sm">Exported Fields</h4>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li><code>id</code> - Unique identifier (required for import updates)</li>
                <li><code>first_name</code>, <code>last_name</code>, <code>display_name</code> - Name fields</li>
                <li><code>email</code>, <code>phone</code>, <code>mobile_phone</code> - Contact info</li>
                <li><code>company_name</code> - Business name</li>
                <li><code>address</code>, <code>city</code>, <code>state</code>, <code>zip</code> - Address fields</li>
                <li><code>notes</code> - Customer notes</li>
              </ul>

              <h4 className="font-medium text-sm">How to Use Export</h4>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>Use the search bar to filter customers if needed</li>
                <li>Click the Export CSV button</li>
                <li>Open the downloaded file in Excel or Google Sheets</li>
                <li>Make your edits</li>
                <li>Save as CSV and re-import</li>
              </ol>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Importing Customer Data</h3>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <h4 className="font-medium text-sm">Required CSV Format</h4>
              <div className="bg-muted p-3 rounded-lg overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 pr-4">id</th>
                      <th className="text-left py-1 pr-4">first_name</th>
                      <th className="text-left py-1 pr-4">last_name</th>
                      <th className="text-left py-1 pr-4">email</th>
                      <th className="text-left py-1">phone</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    <tr>
                      <td className="py-1 pr-4">abc123...</td>
                      <td className="py-1 pr-4">John</td>
                      <td className="py-1 pr-4">Doe</td>
                      <td className="py-1 pr-4">john@email.com</td>
                      <td className="py-1">555-1234</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h4 className="font-medium text-sm">How to Edit the CSV</h4>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-2">
                <li>
                  <strong>Update customer info:</strong> Modify any field except <code>id</code>. 
                  Changes to first_name, last_name, email, phone, address, etc. will be applied.
                </li>
                <li>
                  <strong>Add new customers:</strong> Leave the <code>id</code> column empty for new rows. 
                  The system will create new customer records.
                </li>
              </ol>

              <h4 className="font-medium text-sm">Editable Fields</h4>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li><code>first_name</code>, <code>last_name</code> - Required for new customers</li>
                <li><code>display_name</code> - Auto-generated if left empty</li>
                <li><code>email</code>, <code>phone</code>, <code>mobile_phone</code></li>
                <li><code>company_name</code></li>
                <li><code>address</code>, <code>city</code>, <code>state</code>, <code>zip</code></li>
                <li><code>notes</code>, <code>internal_notes</code></li>
              </ul>

              <h4 className="font-medium text-sm">What Happens During Import</h4>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>A preview dialog shows all changes before they're applied</li>
                <li>Existing customers (with matching <code>id</code>) are updated</li>
                <li>New rows (empty <code>id</code>) create new customer records</li>
                <li>Rows not in the CSV are left unchanged</li>
              </ul>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Do not modify the <code>id</code> column for existing customers. 
                  The id is used to match records for updates.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

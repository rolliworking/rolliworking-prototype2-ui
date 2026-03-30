import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, QrCode, Barcode, Download } from 'lucide-react';

interface PartLabelData {
  type: 'part';
  partNumber: string;
  description: string;
  binLocation?: string;
}

interface ClientPropertyLabelData {
  type: 'client_property';
  brand: string;
  model?: string;
  partNumber?: string;
  serialNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  jobId?: string;
  dateReceived: string;
}

type LabelData = PartLabelData | ClientPropertyLabelData;

interface LabelPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: LabelData;
}

export function LabelPrintDialog({ open, onOpenChange, data }: LabelPrintDialogProps) {
  const [labelSize, setLabelSize] = useState('small');
  const [copies, setCopies] = useState(1);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Label</title>
          <style>
            @page { margin: 0; }
            body { 
              margin: 0; 
              padding: 10px;
              font-family: 'Arial', sans-serif;
            }
            .label {
              border: 1px dashed #ccc;
              padding: 8px;
              margin-bottom: 10px;
              page-break-inside: avoid;
            }
            .label-small { width: 2in; }
            .label-medium { width: 3in; }
            .label-large { width: 4in; }
            .barcode-placeholder {
              font-family: 'Libre Barcode 128', monospace;
              font-size: 40px;
              text-align: center;
            }
            .qr-placeholder {
              width: 80px;
              height: 80px;
              border: 2px solid #000;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
            }
            .text-xs { font-size: 10px; }
            .text-sm { font-size: 12px; }
            .text-lg { font-size: 16px; font-weight: bold; }
            .font-mono { font-family: monospace; }
            .mt-1 { margin-top: 4px; }
            .mt-2 { margin-top: 8px; }
            .text-center { text-align: center; }
          </style>
        </head>
        <body>
          ${Array(copies).fill(printContent.innerHTML).join('')}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  const renderBarcodeLabel = () => {
    if (data.type === 'part') {
      return (
        <div className={`label label-${labelSize}`}>
          <div className="text-lg font-mono">{data.partNumber}</div>
          <div className="barcode-placeholder">*{data.partNumber}*</div>
          <div className="text-sm mt-1">{data.description}</div>
          {data.binLocation && (
            <div className="text-xs mt-1">Location: {data.binLocation}</div>
          )}
        </div>
      );
    }

    // Client property label
    const labelCode = `${data.partNumber || data.model || ''}-${data.serialNumber}`;
    return (
      <div className={`label label-${labelSize}`}>
        <div className="barcode-placeholder">*{labelCode}*</div>
        <div className="text-xs mt-2">
          <div>{new Date(data.dateReceived).toLocaleDateString()} / {data.brand} {data.model}</div>
          <div>{data.customerName} / {data.jobId || 'No Job'}</div>
        </div>
      </div>
    );
  };

  const renderQRLabel = () => {
    if (data.type === 'part') {
      return (
        <div className={`label label-${labelSize}`} style={{ display: 'flex', gap: '10px' }}>
          <div className="qr-placeholder">QR</div>
          <div>
            <div className="text-lg font-mono">{data.partNumber}</div>
            <div className="text-sm">{data.description}</div>
          </div>
        </div>
      );
    }

    // Client property QR - encodes customer info
    const qrData = `${data.customerName}^^${data.customerEmail || ''}^^${data.customerPhone || ''}`;
    return (
      <div className={`label label-${labelSize}`} style={{ display: 'flex', gap: '10px' }}>
        <div className="qr-placeholder" title={qrData}>QR</div>
        <div>
          <div className="text-lg">{data.brand}</div>
          <div className="text-sm">{data.model}</div>
          <div className="text-xs font-mono mt-1">S/N: {data.serialNumber}</div>
          <div className="text-xs mt-1">{data.customerName}</div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Label
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="barcode">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="barcode" className="flex items-center gap-2">
              <Barcode className="h-4 w-4" />
              Barcode
            </TabsTrigger>
            <TabsTrigger value="qr" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              QR Code
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Label Size</Label>
                <Select value={labelSize} onValueChange={setLabelSize}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small (2")</SelectItem>
                    <SelectItem value="medium">Medium (3")</SelectItem>
                    <SelectItem value="large">Large (4")</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Copies</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={copies}
                  onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-muted/30">
              <p className="text-sm text-muted-foreground mb-2">Preview:</p>
              <TabsContent value="barcode" className="mt-0">
                <div ref={printRef}>{renderBarcodeLabel()}</div>
              </TabsContent>
              <TabsContent value="qr" className="mt-0">
                <div ref={printRef}>{renderQRLabel()}</div>
              </TabsContent>
            </div>
          </div>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Printer, QrCode, Package, ArrowRight, Check, ChevronLeft } from 'lucide-react';
import { LabelPreview } from './LabelPreview';
import {
  generateQRLabelZPL,
  generateIntakePartLabelZPL,
  printZPL,
  repeatLabel,
  type QRLabelData,
  type IntakePartLabelData,
} from '@/lib/zpl-generator';

interface IntakeLabelWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerData: {
    fullName: string;
    lastName: string;
    email: string;
    phone: string;
    brand: string;
    model: string;
    estimateNumber: string;
    partNumber?: string;
  };
}

type WizardStep = 'customer' | 'parts';

export function IntakeLabelWizard({ 
  open, 
  onOpenChange, 
  customerData,
}: IntakeLabelWizardProps) {
  const [step, setStep] = useState<WizardStep>('customer');
  const [customerCopies, setCustomerCopies] = useState(2);
  const [partCopies, setPartCopies] = useState(13);
  const [customerPrinted, setCustomerPrinted] = useState(false);
  const [partsPrinted, setPartsPrinted] = useState(false);

  // Part label data for intake
  const [partData, setPartData] = useState<IntakePartLabelData>({
    partNumber: customerData.partNumber || '',
    date: new Date().toISOString().split('T')[0],
    model: customerData.model || '',
    lastName: customerData.lastName || '',
    estimateNumber: customerData.estimateNumber || '',
  });

  // QR data built from customer data
  const qrData: QRLabelData = {
    fullName: customerData.fullName,
    email: customerData.email,
    phone: customerData.phone,
    partNumber: customerData.partNumber || '',
    date: new Date().toISOString().split('T')[0],
    brand: customerData.brand,
    model: customerData.model,
    estimateNumber: customerData.estimateNumber,
  };

  const handlePrintCustomer = () => {
    const zpl = generateQRLabelZPL(qrData);
    const repeated = customerCopies > 1 ? repeatLabel(zpl, customerCopies) : zpl;
    printZPL(repeated);
    setCustomerPrinted(true);
  };

  const handlePrintParts = () => {
    const zpl = generateIntakePartLabelZPL(partData);
    const repeated = partCopies > 1 ? repeatLabel(zpl, partCopies) : zpl;
    printZPL(repeated);
    setPartsPrinted(true);
  };

  const handleNext = () => {
    setStep('parts');
  };

  const handleBack = () => {
    setStep('customer');
  };

  const handleDone = () => {
    // Reset state
    setStep('customer');
    setCustomerPrinted(false);
    setPartsPrinted(false);
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset on close
      setStep('customer');
      setCustomerPrinted(false);
      setPartsPrinted(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Intake Labels
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          <div className={`flex items-center gap-1.5 ${step === 'customer' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${step === 'customer' ? 'bg-primary text-primary-foreground' : customerPrinted ? 'bg-green-600 text-white' : 'bg-muted'}`}>
              {customerPrinted ? <Check className="h-3 w-3" /> : '1'}
            </div>
            <span>Customer QR</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className={`flex items-center gap-1.5 ${step === 'parts' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${step === 'parts' ? 'bg-primary text-primary-foreground' : partsPrinted ? 'bg-green-600 text-white' : 'bg-muted'}`}>
              {partsPrinted ? <Check className="h-3 w-3" /> : '2'}
            </div>
            <span>Part Labels</span>
          </div>
        </div>

        {/* Step 1: Customer QR Labels */}
        {step === 'customer' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <QrCode className="h-4 w-4" />
              Customer Info Label
            </div>
            
            <LabelPreview type="qrcode" qrData={qrData} />

            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <p><strong>{customerData.fullName}</strong></p>
              <p className="text-muted-foreground">{customerData.email}</p>
              <p className="text-muted-foreground">{customerData.phone}</p>
              <p className="text-muted-foreground">{customerData.brand} {customerData.model}</p>
              {customerData.estimateNumber && (
                <p className="font-mono text-xs">{customerData.estimateNumber}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap">Copies:</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={customerCopies}
                onChange={(e) => setCustomerCopies(parseInt(e.target.value) || 1)}
                className="w-20"
              />
              <Button onClick={handlePrintCustomer} className="flex-1">
                <Printer className="h-4 w-4 mr-2" />
                Print {customerCopies} Label{customerCopies !== 1 ? 's' : ''}
              </Button>
            </div>

            {customerPrinted && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <Check className="h-4 w-4" /> Customer labels sent to printer
              </p>
            )}
          </div>
        )}

        {/* Step 2: Part Labels */}
        {step === 'parts' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4" />
              Part Labels
            </div>

            <LabelPreview type="intakePart" intakePartData={partData} />

            <div className="space-y-3">
              <div>
                <Label>Part # (barcode)</Label>
                <Input
                  value={partData.partNumber}
                  onChange={(e) => setPartData({ ...partData, partNumber: e.target.value })}
                  placeholder="e.g., 126610LN"
                  className="font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date</Label>
                  <Input
                    value={partData.date}
                    onChange={(e) => setPartData({ ...partData, date: e.target.value })}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div>
                  <Label>Model</Label>
                  <Input
                    value={partData.model}
                    onChange={(e) => setPartData({ ...partData, model: e.target.value })}
                    placeholder="e.g., Submariner"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Last Name</Label>
                  <Input
                    value={partData.lastName}
                    onChange={(e) => setPartData({ ...partData, lastName: e.target.value })}
                    placeholder="e.g., Smith"
                  />
                </div>
                <div>
                  <Label>Estimate #</Label>
                  <Input
                    value={partData.estimateNumber}
                    onChange={(e) => setPartData({ ...partData, estimateNumber: e.target.value })}
                    placeholder="e.g., EST-001234"
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap">Copies:</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={partCopies}
                onChange={(e) => setPartCopies(parseInt(e.target.value) || 1)}
                className="w-20"
              />
              <Button onClick={handlePrintParts} className="flex-1">
                <Printer className="h-4 w-4 mr-2" />
                Print {partCopies} Label{partCopies !== 1 ? 's' : ''}
              </Button>
            </div>

            {partsPrinted && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <Check className="h-4 w-4" /> Part labels sent to printer
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          {step === 'customer' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleNext}>
                Next: Part Labels
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleDone}>
                <Check className="h-4 w-4 mr-2" />
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

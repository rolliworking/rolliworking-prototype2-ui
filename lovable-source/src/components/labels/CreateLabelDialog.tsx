import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, MapPin, Package, Watch, FileText, Download, Copy, Eye, QrCode } from 'lucide-react';
import { LabelPreview } from './LabelPreview';
import { CustomerSearchInput, PartSearchInput, EstimateSearchInput } from './QRLabelSearchInputs';
import {
  generateLocationLabelZPL,
  generatePartLabelZPL,
  generateClientWatchLabelZPL,
  generateIntakeConfirmationLabelZPL,
  generateQRLabelZPL,
  printZPL,
  downloadZPL,
  repeatLabel,
  type LocationLabelData,
  type PartLabelData,
  type ClientWatchLabelData,
  type IntakeConfirmationLabelData,
  type QRLabelData,
} from '@/lib/zpl-generator';
import { CustomerSidePanel } from '@/components/customers/CustomerSidePanel';
import { Customer } from '@/types/database';

type LabelType = 'location' | 'part' | 'watch' | 'intake' | 'qrcode';

interface CreateLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: LabelType;
  prefillData?: Partial<LocationLabelData | PartLabelData | ClientWatchLabelData | IntakeConfirmationLabelData>;
  prefillQRData?: Partial<QRLabelData>;
}

export function CreateLabelDialog({ 
  open, 
  onOpenChange, 
  defaultType = 'location',
  prefillData,
  prefillQRData,
}: CreateLabelDialogProps) {
  const [activeTab, setActiveTab] = useState<LabelType>(defaultType);
  const [copies, setCopies] = useState(1);
  const [showPreview, setShowPreview] = useState(true);
  
  // Location label state
  const [locationData, setLocationData] = useState<LocationLabelData>({
    storeName: 'Store 01',
    locationName: '',
    barcodeValue: '',
  });

  // Part label state
  const [partData, setPartData] = useState<PartLabelData>({
    partNumber: '',
    description: '',
    line2: '',
  });

  // Client watch label state
  const [watchData, setWatchData] = useState<ClientWatchLabelData>({
    jobId: '',
    brand: '',
    serialNumber: '',
    watchTagNumber: '',
  });

  // Intake confirmation label state
  const [intakeData, setIntakeData] = useState<IntakeConfirmationLabelData>({
    customerNumber: '',
    customerName: '',
    estimateNumber: '',
    dateIn: new Date().toISOString().split('T')[0],
    watchRef: '',
  });

  // QR Code label state - initialize with prefill data if provided
  const [qrData, setQrData] = useState<QRLabelData>({
    fullName: prefillQRData?.fullName || '',
    email: prefillQRData?.email || '',
    phone: prefillQRData?.phone || '',
    partNumber: prefillQRData?.partNumber || '',
    date: prefillQRData?.date || new Date().toISOString().split('T')[0],
    brand: prefillQRData?.brand || '',
    model: prefillQRData?.model || '',
    estimateNumber: prefillQRData?.estimateNumber || '',
  });

  // Update QR data when prefillQRData changes (e.g., dialog reopens with new data)
  useEffect(() => {
    if (prefillQRData) {
      setQrData({
        fullName: prefillQRData.fullName || '',
        email: prefillQRData.email || '',
        phone: prefillQRData.phone || '',
        partNumber: prefillQRData.partNumber || '',
        date: prefillQRData.date || new Date().toISOString().split('T')[0],
        brand: prefillQRData.brand || '',
        model: prefillQRData.model || '',
        estimateNumber: prefillQRData.estimateNumber || '',
      });
      setActiveTab('qrcode');
    }
  }, [prefillQRData]);

  // Customer panel state for adding new customers
  const [customerPanelOpen, setCustomerPanelOpen] = useState(false);

  const handleCustomerSelect = (customer: Customer) => {
    setQrData({
      ...qrData,
      fullName: `${customer.first_name} ${customer.last_name}`,
      email: customer.email || '',
      phone: customer.phone || '',
    });
  };

  const handleCustomerSaved = (customer: Customer) => {
    handleCustomerSelect(customer);
    setCustomerPanelOpen(false);
  };

  const generateZPL = (): string => {
    let zpl = '';
    switch (activeTab) {
      case 'location':
        zpl = generateLocationLabelZPL(locationData);
        break;
      case 'part':
        zpl = generatePartLabelZPL(partData);
        break;
      case 'watch':
        zpl = generateClientWatchLabelZPL(watchData);
        break;
      case 'intake':
        zpl = generateIntakeConfirmationLabelZPL(intakeData);
        break;
      case 'qrcode':
        zpl = generateQRLabelZPL(qrData);
        break;
    }
    return copies > 1 ? repeatLabel(zpl, copies) : zpl;
  };

  const handlePrint = () => {
    const zpl = generateZPL();
    printZPL(zpl);
  };

  const handleDownload = () => {
    const zpl = generateZPL();
    const filename = `${activeTab}-label-${Date.now()}.zpl`;
    downloadZPL(zpl, filename);
  };

  const isValid = (): boolean => {
    switch (activeTab) {
      case 'location':
        return !!(locationData.storeName && locationData.locationName && locationData.barcodeValue);
      case 'part':
        return !!(partData.partNumber && partData.description);
      case 'watch':
        return !!(watchData.jobId && watchData.brand && watchData.serialNumber && watchData.watchTagNumber);
      case 'intake':
        return !!(intakeData.customerNumber && intakeData.customerName && intakeData.estimateNumber && intakeData.dateIn);
      case 'qrcode':
        return !!(qrData.fullName && qrData.email && qrData.estimateNumber);
    }
  };

  // Auto-generate location barcode
  const updateLocationBarcode = (storeName: string, locationName: string) => {
    const storePrefix = storeName === 'Store 01' ? 'S01' : 'S02';
    const locCode = locationName.toUpperCase().replace(/\s+/g, '-').substring(0, 10);
    return `${storePrefix}-LOC-${locCode}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Create Label
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LabelType)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="location" className="flex items-center gap-1 text-xs">
              <MapPin className="h-3 w-3" />
              Location
            </TabsTrigger>
            <TabsTrigger value="part" className="flex items-center gap-1 text-xs">
              <Package className="h-3 w-3" />
              Part
            </TabsTrigger>
            <TabsTrigger value="watch" className="flex items-center gap-1 text-xs">
              <Watch className="h-3 w-3" />
              Watch
            </TabsTrigger>
            <TabsTrigger value="intake" className="flex items-center gap-1 text-xs">
              <FileText className="h-3 w-3" />
              Intake
            </TabsTrigger>
            <TabsTrigger value="qrcode" className="flex items-center gap-1 text-xs">
              <QrCode className="h-3 w-3" />
              QR
            </TabsTrigger>
          </TabsList>

          {/* Location Label Form */}
          <TabsContent value="location" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Store</Label>
                <Select 
                  value={locationData.storeName} 
                  onValueChange={(v) => {
                    const newBarcode = updateLocationBarcode(v, locationData.locationName);
                    setLocationData({ ...locationData, storeName: v, barcodeValue: newBarcode });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Store 01">Store 01</SelectItem>
                    <SelectItem value="Store 02">Store 02</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Location Name</Label>
                <Input
                  placeholder="e.g., Shelf A-1"
                  value={locationData.locationName}
                  onChange={(e) => {
                    const newBarcode = updateLocationBarcode(locationData.storeName, e.target.value);
                    setLocationData({ ...locationData, locationName: e.target.value, barcodeValue: newBarcode });
                  }}
                />
              </div>
            </div>
            <div>
              <Label>Barcode Value</Label>
              <Input
                placeholder="S01-LOC-XXXX"
                value={locationData.barcodeValue}
                onChange={(e) => setLocationData({ ...locationData, barcodeValue: e.target.value })}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">Auto-generated from store and location</p>
            </div>
          </TabsContent>

          {/* Part Label Form */}
          <TabsContent value="part" className="space-y-4 mt-4">
            <div>
              <Label>Part Number</Label>
              <PartSearchInput
                value={partData.partNumber}
                onChange={(v) => setPartData((prev) => ({ ...prev, partNumber: v }))}
                onPartSelect={(part) =>
                  setPartData((prev) => ({
                    ...prev,
                    partNumber: part.part_number,
                    description: part.description ? part.description.substring(0, 30) : prev.description,
                  }))
                }
              />
            </div>
            <div>
              <Label>Description (Line 1)</Label>
              <Input
                placeholder="e.g., Main Spring"
                value={partData.description}
                onChange={(e) => setPartData({ ...partData, description: e.target.value })}
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground mt-1">{partData.description.length}/30 characters</p>
            </div>
            <div>
              <Label>Description (Line 2, optional)</Label>
              <Input
                placeholder="e.g., Rolex 3135"
                value={partData.line2 || ''}
                onChange={(e) => setPartData({ ...partData, line2: e.target.value })}
                maxLength={30}
              />
            </div>
          </TabsContent>

          {/* Client Watch Label Form */}
          <TabsContent value="watch" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Job ID</Label>
                <Input
                  placeholder="e.g., E12345"
                  value={watchData.jobId}
                  onChange={(e) => setWatchData({ ...watchData, jobId: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div>
                <Label>Watch Tag #</Label>
                <Input
                  placeholder="Barcode value"
                  value={watchData.watchTagNumber}
                  onChange={(e) => setWatchData({ ...watchData, watchTagNumber: e.target.value })}
                  className="font-mono"
                />
              </div>
            </div>
            <div>
              <Label>Brand</Label>
              <Input
                placeholder="e.g., Rolex"
                value={watchData.brand}
                onChange={(e) => setWatchData({ ...watchData, brand: e.target.value })}
              />
            </div>
            <div>
              <Label>Serial Number (Full)</Label>
              <Input
                placeholder="Full serial number"
                value={watchData.serialNumber}
                onChange={(e) => setWatchData({ ...watchData, serialNumber: e.target.value })}
                className="font-mono"
              />
            </div>
          </TabsContent>

          {/* Intake Confirmation Label Form */}
          <TabsContent value="intake" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Number</Label>
                <Input
                  placeholder="Barcode value"
                  value={intakeData.customerNumber}
                  onChange={(e) => setIntakeData({ ...intakeData, customerNumber: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div>
                <Label>Estimate Number</Label>
                <Input
                  placeholder="e.g., EST-001234"
                  value={intakeData.estimateNumber}
                  onChange={(e) => setIntakeData({ ...intakeData, estimateNumber: e.target.value })}
                  className="font-mono"
                />
              </div>
            </div>
            <div>
              <Label>Customer Name</Label>
              <Input
                placeholder="Customer name"
                value={intakeData.customerName}
                onChange={(e) => setIntakeData({ ...intakeData, customerName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date In</Label>
                <Input
                  type="date"
                  value={intakeData.dateIn}
                  onChange={(e) => setIntakeData({ ...intakeData, dateIn: e.target.value })}
                />
              </div>
              <div>
                <Label>Part # (optional)</Label>
                <Input
                  placeholder="e.g., Submariner"
                  value={intakeData.watchRef || ''}
                  onChange={(e) => setIntakeData({ ...intakeData, watchRef: e.target.value })}
                />
              </div>
            </div>
          </TabsContent>

          {/* QR Code Label Form */}
          <TabsContent value="qrcode" className="space-y-3 mt-4">
            <div>
              <Label>Full Name *</Label>
              <CustomerSearchInput
                value={qrData.fullName}
                onChange={(v) => setQrData({ ...qrData, fullName: v })}
                onCustomerSelect={handleCustomerSelect}
                onAddNew={() => setCustomerPanelOpen(true)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="customer@email.com"
                  value={qrData.email}
                  onChange={(e) => setQrData({ ...qrData, email: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  placeholder="Phone number"
                  value={qrData.phone}
                  onChange={(e) => setQrData({ ...qrData, phone: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>
            <div>
              <Label>Part Number</Label>
              <PartSearchInput
                value={qrData.partNumber}
                onChange={(v) => setQrData({ ...qrData, partNumber: v })}
                onPartSelect={(part) => setQrData({ ...qrData, partNumber: part.part_number })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Brand</Label>
                <Input
                  placeholder="e.g., Rolex"
                  value={qrData.brand}
                  onChange={(e) => setQrData({ ...qrData, brand: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div>
                <Label>Model</Label>
                <Input
                  placeholder="e.g., Submariner"
                  value={qrData.model}
                  onChange={(e) => setQrData({ ...qrData, model: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={qrData.date}
                  onChange={(e) => setQrData({ ...qrData, date: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div>
                <Label>Estimate Number *</Label>
                <EstimateSearchInput
                  value={qrData.estimateNumber}
                  onChange={(v) => setQrData({ ...qrData, estimateNumber: v })}
                  onEstimateSelect={(est) => setQrData({ ...qrData, estimateNumber: est.estimate_number })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              QR encodes: full_name^email^phone^part_number^date^brand^model^estimate_number
            </p>
          </TabsContent>
        </Tabs>

        {/* Copies selector */}
        <div className="flex items-center gap-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-muted-foreground" />
            <Label>Copies:</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20"
            />
          </div>
        </div>

        {/* Label Preview Toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Label Preview</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowPreview(!showPreview)}
              disabled={!isValid()}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </Button>
          </div>
          
          {showPreview && isValid() && (
            <LabelPreview
              type={activeTab}
              locationData={activeTab === 'location' ? locationData : undefined}
              partData={activeTab === 'part' ? partData : undefined}
              watchData={activeTab === 'watch' ? watchData : undefined}
              intakeData={activeTab === 'intake' ? intakeData : undefined}
              qrData={activeTab === 'qrcode' ? qrData : undefined}
            />
          )}
          
          {/* ZPL Code Preview */}
          <div className="border rounded-lg p-3 bg-muted/30 max-h-32 overflow-auto">
            <p className="text-xs text-muted-foreground mb-1">ZPL Code (2" x 1" @ 203 DPI):</p>
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
              {isValid() ? generateZPL().split('\n').slice(0, 8).join('\n') + (copies > 1 ? '\n...' : '') : 'Fill in required fields to preview'}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleDownload} disabled={!isValid()}>
            <Download className="h-4 w-4 mr-2" />
            Download .zpl
          </Button>
          <Button onClick={handlePrint} disabled={!isValid()}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </DialogContent>

      {/* Customer Side Panel for adding new customers */}
      <CustomerSidePanel
        open={customerPanelOpen}
        onOpenChange={setCustomerPanelOpen}
        customer={null}
        onSave={handleCustomerSaved}
      />
    </Dialog>
  );
}

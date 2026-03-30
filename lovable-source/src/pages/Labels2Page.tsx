import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Save, Search, Tag, X, Box } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import JsBarcode from 'jsbarcode';
import { downloadZPL } from '@/lib/zpl-generator';
import { Code128Barcode } from '@/components/labels/Code128Barcode';

type ItemType = 'client_watch' | 'inventory' | 'non_inventory' | 'service';

interface PartResult {
  id: string;
  part_number: string;
  description: string;
  item_type: ItemType;
}

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  client_watch: 'Client Watch',
  inventory: 'Inventory',
  non_inventory: 'Non-Inventory',
  service: 'Service',
};

// ZPL Generator for Part# Label (2"x1" @ 203 DPI)
// Layout: Barcode at top, then Part#, Desc1, Desc2
function generatePartLabel2ZPL(data: {
  partNumber: string;
  description1: string;
  description2: string;
}): string {
  const LABEL_WIDTH = 406;
  const LABEL_HEIGHT = 203;
  
  const desc1 = data.description1.substring(0, 40);
  const desc2 = data.description2.substring(0, 40);
  
  return `^XA
^PW${LABEL_WIDTH}
^LL${LABEL_HEIGHT}
^BY2
^FO30,10^BCN,60,N,N,N
^FD${data.partNumber}^FS
^CF0,24
^FO20,80^FD${data.partNumber}^FS
^CF0,20
^FO20,110^FD${desc1}^FS
^CF0,18
^FO20,138^FD${desc2}^FS
^XZ`;
}

// Escape text for safe HTML printing
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createCode128SvgMarkup(value: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, value, {
    format: 'CODE128',
    displayValue: false,
    width: 1.8,
    height: 40,
    margin: 0,
  });
  return svg.outerHTML;
}

// Open Windows print dialog for Part Label (2" x 1" landscape)
function openLabelPreviewPrintDialog(data: {
  partNumber: string;
  description1: string;
  description2: string;
  copies: number;
}) {
  const printWindow = window.open('', '_blank', 'width=600,height=500');
  if (!printWindow) {
    toast.error('Please allow popups to print labels');
    return;
  }

  const part = escapeHtml(data.partNumber);
  const d1 = escapeHtml(data.description1 || '');
  const d2 = escapeHtml(data.description2 || '');

  let labelsHtml = '';
  for (let i = 0; i < Math.max(1, data.copies); i++) {
    const barcodeSvg = createCode128SvgMarkup(data.partNumber);
    labelsHtml += `
      <div class="label">
        <div class="barcode">${barcodeSvg}</div>
        <div class="line line1">${part}</div>
        <div class="line line2">${d1 || '&#8212;'}</div>
        <div class="line line3">${d2 || '&#8212;'}</div>
      </div>
    `;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Label</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { size: 2in 1in; margin: 0; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: 2in; }
        .label {
          width: 2in;
          height: 1in;
          max-height: 1in;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 1px;
          padding: 4px 4px 2px;
          page-break-after: always;
          page-break-inside: avoid;
        }
        .barcode { display: flex; justify-content: center; width: 100%; height: 24px; max-height: 24px; overflow: hidden; }
        .barcode svg { width: auto; max-width: 100%; height: 22px; }
        .line { width: 100%; text-align: center; font-family: 'Arial Narrow', Arial, sans-serif; line-height: 1.0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .line1 { font-size: 11px; font-weight: 700; }
        .line2 { font-size: 9px; }
        .line3 { font-size: 9px; }
      </style>
    </head>
    <body>
      ${labelsHtml}
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// Open Windows print dialog for Bin Label (1" x 2" portrait)
function openBinLabelPrintDialog(data: {
  partNumber: string;
  description2: string;
  copies: number;
}) {
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    toast.error('Please allow popups to print labels');
    return;
  }

  const part = escapeHtml(data.partNumber);
  const d2 = escapeHtml(data.description2 || '');

  let labelsHtml = '';
  for (let i = 0; i < Math.max(1, data.copies); i++) {
    labelsHtml += `
      <div class="label">
        <div class="desc">${d2 || '&#8212;'}</div>
        <div class="part">${part}</div>
      </div>
    `;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Bin Label</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { size: 1in 2in; margin: 0; }
        body { margin: 0; padding: 0; }
        .label {
          width: 1in;
          height: 2in;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-sizing: border-box;
          padding: 8px 4px;
          page-break-after: always;
        }
        .desc { 
          width: 100%; 
          text-align: center; 
          font-family: 'Arial Narrow', Arial, sans-serif; 
          font-size: 16px; 
          font-weight: 700;
          word-wrap: break-word;
        }
        .part { 
          width: 100%; 
          text-align: center; 
          font-family: 'Arial Narrow', Arial, sans-serif; 
          font-size: 12px;
          word-wrap: break-word;
        }
      </style>
    </head>
    <body>
      ${labelsHtml}
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

export default function Labels2Page() {
  // Part Label state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PartResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPart, setSelectedPart] = useState<PartResult | null>(null);
  
  // Form fields
  const [partNumber, setPartNumber] = useState('');
  const [description1, setDescription1] = useState('');
  const [description2, setDescription2] = useState('');
  const [itemType, setItemType] = useState<ItemType>('inventory');
  const [copies, setCopies] = useState(1);
  
  const [isSaving, setIsSaving] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Bin Label state
  const [binSearchTerm, setBinSearchTerm] = useState('');
  const [binSearchResults, setBinSearchResults] = useState<PartResult[]>([]);
  const [binShowResults, setBinShowResults] = useState(false);
  const [binIsSearching, setBinIsSearching] = useState(false);
  const [binSelectedPart, setBinSelectedPart] = useState<PartResult | null>(null);
  
  const [binPartNumber, setBinPartNumber] = useState('');
  const [binDescription1, setBinDescription1] = useState('');
  const [binDescription2, setBinDescription2] = useState('');
  const [binItemType, setBinItemType] = useState<ItemType>('inventory');
  const [binCopies, setBinCopies] = useState(1);
  
  const binSearchRef = useRef<HTMLDivElement>(null);

  // Search parts as user types
  useEffect(() => {
    const searchParts = async () => {
      if (searchTerm.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      const { data, error } = await supabase
        .from('parts')
        .select('id, part_number, description, item_type')
        .eq('is_active', true)
        .or(`part_number.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .limit(10);

      if (!error && data) {
        setSearchResults(data as PartResult[]);
        setShowResults(true);
      }
      setIsSearching(false);
    };

    const debounce = setTimeout(searchParts, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  // Close dropdown when clicking outside (Part Label)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search parts for Bin Label as user types
  useEffect(() => {
    const searchParts = async () => {
      if (binSearchTerm.length < 2) {
        setBinSearchResults([]);
        return;
      }

      setBinIsSearching(true);
      const { data, error } = await supabase
        .from('parts')
        .select('id, part_number, description, item_type')
        .eq('is_active', true)
        .or(`part_number.ilike.%${binSearchTerm}%,description.ilike.%${binSearchTerm}%`)
        .limit(10);

      if (!error && data) {
        setBinSearchResults(data as PartResult[]);
        setBinShowResults(true);
      }
      setBinIsSearching(false);
    };

    const debounce = setTimeout(searchParts, 300);
    return () => clearTimeout(debounce);
  }, [binSearchTerm]);

  // Close dropdown when clicking outside (Bin Label)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (binSearchRef.current && !binSearchRef.current.contains(event.target as Node)) {
        setBinShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPart = (part: PartResult) => {
    setSelectedPart(part);
    setPartNumber(part.part_number);
    setDescription1(part.description);
    setDescription2('');
    setItemType(part.item_type);
    setSearchTerm(part.part_number);
    setShowResults(false);
  };

  const handleClear = () => {
    setSelectedPart(null);
    setPartNumber('');
    setDescription1('');
    setDescription2('');
    setItemType('inventory');
    setSearchTerm('');
    setSearchResults([]);
  };

  // Bin Label handlers
  const handleBinSelectPart = (part: PartResult) => {
    setBinSelectedPart(part);
    setBinPartNumber(part.part_number);
    setBinDescription1(part.description);
    setBinDescription2('');
    setBinItemType(part.item_type);
    setBinSearchTerm(part.part_number);
    setBinShowResults(false);
  };

  const handleBinClear = () => {
    setBinSelectedPart(null);
    setBinPartNumber('');
    setBinDescription1('');
    setBinDescription2('');
    setBinItemType('inventory');
    setBinSearchTerm('');
    setBinSearchResults([]);
  };

  const handleBinPrint = () => {
    if (!binPartNumber.trim()) {
      toast.error('Part number is required');
      return;
    }

    openBinLabelPrintDialog({
      partNumber: binPartNumber.trim(),
      description2: binDescription2.trim(),
      copies: binCopies,
    });
  };

  const handleSave = async () => {
    if (!partNumber.trim()) {
      toast.error('Part number is required');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('parts')
        .insert([{
          part_number: partNumber.trim(),
          description: description1.trim() || partNumber.trim(),
          item_type: itemType,
          uom: 'ea' as const,
          is_serialized: false,
          track_lot: false,
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('Part number already exists');
        } else {
          toast.error(`Failed to save: ${error.message}`);
        }
        return;
      }

      setSelectedPart(data as PartResult);
      toast.success(`Part ${partNumber} saved successfully`);
    } catch (err) {
      toast.error('Failed to save part');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    if (!partNumber.trim()) {
      toast.error('Part number is required');
      return;
    }

    openLabelPreviewPrintDialog({
      partNumber: partNumber.trim(),
      description1: description1.trim(),
      description2: description2.trim(),
      copies,
    });
  };

  const handleDownload = () => {
    if (!partNumber.trim()) {
      toast.error('Part number is required');
      return;
    }

    const zpl = generatePartLabel2ZPL({
      partNumber: partNumber.trim(),
      description1: description1.trim(),
      description2: description2.trim(),
    });

    const allLabels = Array(copies).fill(zpl).join('\n');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    downloadZPL(allLabels, `part-label-${partNumber}-${timestamp}.zpl`);
  };

  const isNewPart = !selectedPart && partNumber.trim().length > 0;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Part# Labels</h1>
          <p className="text-muted-foreground">
            Print part number labels for Zebra LP 2824 (2" × 1")
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Create Part Label</CardTitle>
              <CardDescription>
                Search for existing parts or enter new part details
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search / Part Number Input */}
          <div className="space-y-2" ref={searchRef}>
            <Label htmlFor="partSearch">Part # (search or enter new)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="partSearch"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPartNumber(e.target.value);
                  setSelectedPart(null);
                }}
                placeholder="Search or enter part number..."
                className="pl-10 pr-10"
              />
              {(searchTerm || partNumber) && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              
              {/* Search Results Dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                  {searchResults.map((part) => (
                    <button
                      key={part.id}
                      onClick={() => handleSelectPart(part)}
                      className="w-full px-3 py-2 text-left hover:bg-accent flex flex-col"
                    >
                      <span className="font-medium">{part.part_number}</span>
                      <span className="text-sm text-muted-foreground truncate">
                        {part.description} • {ITEM_TYPE_LABELS[part.item_type]}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              
              {showResults && searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                  No parts found.{' '}
                  <button
                    type="button"
                    onClick={() => window.open('/inventory/parts', '_blank')}
                    className="text-primary hover:underline font-medium"
                  >
                    Create a new part →
                  </button>
                </div>
              )}
            </div>
            {selectedPart && (
              <p className="text-sm text-green-600">
                ✓ Loaded from library: {ITEM_TYPE_LABELS[selectedPart.item_type]}
              </p>
            )}
            {isNewPart && (
              <p className="text-sm text-amber-600">
                New part - will be printed without saving (or save below)
              </p>
            )}
          </div>

          {/* Description 1 */}
          <div className="space-y-2">
            <Label htmlFor="desc1">Description Line 1</Label>
            <Input
              id="desc1"
              value={description1}
              onChange={(e) => setDescription1(e.target.value)}
              placeholder="Main description (40 chars max)"
              maxLength={40}
            />
          </div>

          {/* Description 2 */}
          <div className="space-y-2">
            <Label htmlFor="desc2">Description Line 2</Label>
            <Input
              id="desc2"
              value={description2}
              onChange={(e) => setDescription2(e.target.value)}
              placeholder="Additional details (40 chars max)"
              maxLength={40}
            />
          </div>

          {/* Item Type (for saving) */}
          <div className="space-y-2">
            <Label htmlFor="itemType">Category</Label>
            <Select value={itemType} onValueChange={(v) => setItemType(v as ItemType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client_watch">Client Watch</SelectItem>
                <SelectItem value="inventory">Inventory</SelectItem>
                <SelectItem value="non_inventory">Non-Inventory</SelectItem>
                <SelectItem value="service">Service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Copies */}
          <div className="space-y-2">
            <Label htmlFor="copies">Number of Copies</Label>
            <Input
              id="copies"
              type="number"
              min={1}
              max={50}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              className="w-24"
            />
          </div>

          {/* Label Preview */}
          {partNumber && (
            <div className="space-y-2">
              <Label>Label Preview</Label>
              <div className="border rounded-lg p-4 bg-white">
                <div 
                  className="mx-auto border-2 border-dashed border-muted-foreground/30 p-2"
                  style={{ width: '300px', height: '150px' }}
                >
                  <div className="flex justify-center mb-2 text-foreground">
                    <Code128Barcode value={partNumber} height={32} />
                  </div>
                  {/* Text lines */}
                  <div className="text-center space-y-1" style={{ fontFamily: "'Arial Narrow', Arial, sans-serif" }}>
                    <div className="font-bold" style={{ fontSize: '16px' }}>{partNumber}</div>
                    <div className="truncate" style={{ fontSize: '14px' }}>{description1 || '—'}</div>
                    <div className="text-muted-foreground truncate" style={{ fontSize: '14px' }}>{description2 || '—'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            {isNewPart && (
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={isSaving || !partNumber.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save to Library'}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={!partNumber.trim()}
            >
              Download .zpl
            </Button>
            <Button
              onClick={handlePrint}
              disabled={!partNumber.trim()}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print {copies > 1 ? `(${copies} copies)` : ''}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bin Label Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Box className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Create Bin Label</CardTitle>
              <CardDescription>
                Portrait labels for parts storage bins (1" × 2")
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search / Part Number Input */}
          <div className="space-y-2" ref={binSearchRef}>
            <Label htmlFor="binPartSearch">Part # (search or enter new)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="binPartSearch"
                value={binSearchTerm}
                onChange={(e) => {
                  setBinSearchTerm(e.target.value);
                  setBinPartNumber(e.target.value);
                  setBinSelectedPart(null);
                }}
                placeholder="Search or enter part number..."
                className="pl-10 pr-10"
              />
              {(binSearchTerm || binPartNumber) && (
                <button
                  onClick={handleBinClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              
              {/* Search Results Dropdown */}
              {binShowResults && binSearchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                  {binSearchResults.map((part) => (
                    <button
                      key={part.id}
                      onClick={() => handleBinSelectPart(part)}
                      className="w-full px-3 py-2 text-left hover:bg-accent flex flex-col"
                    >
                      <span className="font-medium">{part.part_number}</span>
                      <span className="text-sm text-muted-foreground truncate">
                        {part.description} • {ITEM_TYPE_LABELS[part.item_type]}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              
              {binShowResults && binSearchTerm.length >= 2 && binSearchResults.length === 0 && !binIsSearching && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                  No parts found.{' '}
                  <button
                    type="button"
                    onClick={() => window.open('/inventory/parts', '_blank')}
                    className="text-primary hover:underline font-medium"
                  >
                    Create a new part →
                  </button>
                </div>
              )}
            </div>
            {binSelectedPart && (
              <p className="text-sm text-green-600">
                ✓ Loaded from library: {ITEM_TYPE_LABELS[binSelectedPart.item_type]}
              </p>
            )}
          </div>

          {/* Description 1 */}
          <div className="space-y-2">
            <Label htmlFor="binDesc1">Description Line 1</Label>
            <Input
              id="binDesc1"
              value={binDescription1}
              onChange={(e) => setBinDescription1(e.target.value)}
              placeholder="Main description (40 chars max)"
              maxLength={40}
            />
          </div>

          {/* Description 2 */}
          <div className="space-y-2">
            <Label htmlFor="binDesc2">Description Line 2 (printed on label)</Label>
            <Input
              id="binDesc2"
              value={binDescription2}
              onChange={(e) => setBinDescription2(e.target.value)}
              placeholder="Short name for bin (40 chars max)"
              maxLength={40}
            />
          </div>

          {/* Item Type */}
          <div className="space-y-2">
            <Label htmlFor="binItemType">Category</Label>
            <Select value={binItemType} onValueChange={(v) => setBinItemType(v as ItemType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client_watch">Client Watch</SelectItem>
                <SelectItem value="inventory">Inventory</SelectItem>
                <SelectItem value="non_inventory">Non-Inventory</SelectItem>
                <SelectItem value="service">Service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Copies */}
          <div className="space-y-2">
            <Label htmlFor="binCopies">Number of Copies</Label>
            <Input
              id="binCopies"
              type="number"
              min={1}
              max={50}
              value={binCopies}
              onChange={(e) => setBinCopies(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              className="w-24"
            />
          </div>

          {/* Label Preview */}
          {binPartNumber && (
            <div className="space-y-2">
              <Label>Label Preview (Portrait 1" × 2")</Label>
              <div className="border rounded-lg p-4 bg-white">
                <div 
                  className="mx-auto border-2 border-dashed border-muted-foreground/30 p-2 flex flex-col items-center justify-center"
                  style={{ width: '100px', height: '200px' }}
                >
                  {/* Description Line 2 at top */}
                  <div 
                    className="font-bold text-center break-words w-full" 
                    style={{ fontFamily: "'Arial Narrow', Arial, sans-serif", fontSize: '14px' }}
                  >
                    {binDescription2 || '—'}
                  </div>
                  {/* Part # below */}
                  <div 
                    className="text-center break-words w-full mt-2" 
                    style={{ fontFamily: "'Arial Narrow', Arial, sans-serif", fontSize: '11px' }}
                  >
                    {binPartNumber}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button
              onClick={handleBinPrint}
              disabled={!binPartNumber.trim()}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print {binCopies > 1 ? `(${binCopies} copies)` : ''}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Printer Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Printer Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p><strong>Part Labels:</strong> 2" × 1" landscape (Zebra LP 2824)</p>
          <p><strong>Bin Labels:</strong> 1" × 2" portrait</p>
          <p><strong>Format:</strong> Text-based labels with Arial Narrow font</p>
        </CardContent>
      </Card>
    </div>
  );
}

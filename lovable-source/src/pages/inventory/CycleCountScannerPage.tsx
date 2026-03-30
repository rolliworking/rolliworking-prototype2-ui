import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { QRScanner } from '@/components/inventory/QRScanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Lock, Unlock, Package, MapPin, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type ScanMode = 'location' | 'part';

interface ScannedPart {
  id: string;
  part_number: string;
  description: string;
  binQty: number;
  globalQty: number;
  average_cost: number | null;
}

export default function CycleCountScannerPage() {
  const { countId } = useParams<{ countId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [scanMode, setScanMode] = useState<ScanMode>('location');
  const [locationLocked, setLocationLocked] = useState(false);
  const [lockedBin, setLockedBin] = useState<{ id: string; name: string } | null>(null);
  const [scannedPart, setScannedPart] = useState<ScannedPart | null>(null);
  const [actualQty, setActualQty] = useState<string>('');
  const [lastScannedCode, setLastScannedCode] = useState<string>('');

  // Fetch cycle count details
  const { data: cycleCount, isLoading: countLoading } = useQuery({
    queryKey: ['cycle-count', countId],
    queryFn: async () => {
      if (!countId) return null;
      const { data, error } = await supabase
        .from('cycle_counts')
        .select('*, location:locations(name), bin:bins(name)')
        .eq('id', countId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!countId,
  });

  // Fetch all bins for QR matching
  const { data: bins } = useQuery({
    queryKey: ['bins-qr'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bins')
        .select('id, name, qr_code_id')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch counted lines for this count
  const { data: countedLines } = useQuery({
    queryKey: ['cycle-count-lines', countId],
    queryFn: async () => {
      if (!countId) return [];
      const { data, error } = await supabase
        .from('cycle_count_lines')
        .select('*, part:parts(part_number, description)')
        .eq('cycle_count_id', countId);
      if (error) throw error;
      return data;
    },
    enabled: !!countId,
  });

  // Save count line mutation
  const saveCountLine = useMutation({
    mutationFn: async (data: {
      partId: string;
      binId: string;
      systemQty: number;
      countedQty: number;
    }) => {
      const varianceQty = data.countedQty - data.systemQty;
      
      // Check if line already exists
      const { data: existing } = await supabase
        .from('cycle_count_lines')
        .select('id')
        .eq('cycle_count_id', countId)
        .eq('part_id', data.partId)
        .eq('bin_id', data.binId)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('cycle_count_lines')
          .update({
            counted_qty: data.countedQty,
            variance_qty: varianceQty,
            counted_at: new Date().toISOString(),
            counted_by: user?.id,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('cycle_count_lines')
          .insert({
            cycle_count_id: countId,
            part_id: data.partId,
            bin_id: data.binId,
            system_qty: data.systemQty,
            counted_qty: data.countedQty,
            variance_qty: varianceQty,
            counted_at: new Date().toISOString(),
            counted_by: user?.id,
          });
        if (error) throw error;
      }

      // Update cycle count status to in_progress
      await supabase
        .from('cycle_counts')
        .update({ status: 'in_progress' })
        .eq('id', countId)
        .eq('status', 'draft');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-count-lines', countId] });
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      toast({
        title: 'Count Saved',
        description: `${scannedPart?.part_number} updated with qty ${actualQty}`,
      });
      // Reset for next scan
      setScannedPart(null);
      setActualQty('');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleScan = useCallback(async (code: string) => {
    // Debounce same code
    if (code === lastScannedCode) return;
    setLastScannedCode(code);
    
    // Haptic feedback on scan
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    if (scanMode === 'location' && !locationLocked) {
      // Look for bin by QR code or name
      const bin = bins?.find(b => 
        b.qr_code_id === code || 
        b.name.toLowerCase() === code.toLowerCase()
      );
      
      if (bin) {
        setLockedBin({ id: bin.id, name: bin.name });
        setScanMode('part');
        toast({
          title: 'Location Set',
          description: `Now scanning parts for ${bin.name}`,
        });
      } else {
        toast({
          title: 'Unknown Location',
          description: 'QR code does not match any bin',
          variant: 'destructive',
        });
      }
    } else if (scanMode === 'part' && lockedBin) {
      // Look for part by part number or UPC
      const { data: part, error } = await supabase
        .from('parts')
        .select('id, part_number, description, average_cost')
        .or(`part_number.eq.${code},upc.eq.${code}`)
        .single();

      if (error || !part) {
        // Try alias lookup
        const { data: aliasMatch } = await supabase
          .from('part_aliases')
          .select('part_id, parts:parts(id, part_number, description, average_cost)')
          .eq('alias_sku', code)
          .single();

        if (aliasMatch?.parts) {
          await loadPartData(aliasMatch.parts as any);
        } else {
          toast({
            title: 'Part Not Found',
            description: `No part matches code: ${code}`,
            variant: 'destructive',
          });
        }
      } else {
        await loadPartData(part);
      }
    }
  }, [scanMode, locationLocked, lockedBin, bins, lastScannedCode, toast]);

  const loadPartData = async (part: { id: string; part_number: string; description: string; average_cost: number | null }) => {
    // Get bin qty
    const { data: binStock } = await supabase
      .from('inventory_stock')
      .select('qty_on_hand')
      .eq('part_id', part.id)
      .eq('bin_id', lockedBin!.id)
      .single();

    // Get global qty
    const { data: globalStock } = await supabase
      .from('inventory_stock')
      .select('qty_on_hand')
      .eq('part_id', part.id);

    const binQty = binStock?.qty_on_hand || 0;
    const globalQty = globalStock?.reduce((sum, s) => sum + (s.qty_on_hand || 0), 0) || 0;

    setScannedPart({
      id: part.id,
      part_number: part.part_number,
      description: part.description,
      binQty: Number(binQty),
      globalQty: Number(globalQty),
      average_cost: part.average_cost,
    });
    setActualQty(String(binQty));
  };

  const handleConfirmCount = () => {
    if (!scannedPart || !lockedBin || actualQty === '') return;

    saveCountLine.mutate({
      partId: scannedPart.id,
      binId: lockedBin.id,
      systemQty: scannedPart.binQty,
      countedQty: Number(actualQty),
    });
  };

  const handleToggleLock = (locked: boolean) => {
    setLocationLocked(locked);
    if (!locked) {
      // When unlocking, go back to location scan mode
      setScanMode('location');
      setLockedBin(null);
      setScannedPart(null);
      setActualQty('');
    }
  };

  const variance = scannedPart ? Number(actualQty) - scannedPart.binQty : 0;

  if (countLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-safe">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/inventory/cycle-count')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-medium">{cycleCount?.count_number || 'Cycle Count'}</h1>
              <p className="text-sm text-muted-foreground">
                {countedLines?.length || 0} items counted
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm">
            {scanMode === 'location' ? 'Scan Location' : 'Scan Part'}
          </Badge>
        </div>
      </div>

      {/* Scanner */}
      <div className="p-4">
        <QRScanner 
          onScan={handleScan}
          isActive={!scannedPart}
          className="max-w-md mx-auto"
        />
      </div>

      {/* Location Lock Control */}
      <div className="px-4 pb-4">
        <Card className="max-w-md mx-auto">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {lockedBin ? lockedBin.name : 'No location selected'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {locationLocked ? 'Location locked' : 'Scan a location QR code'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {locationLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                <Switch 
                  checked={locationLocked}
                  onCheckedChange={handleToggleLock}
                  disabled={!lockedBin}
                />
                <Label className="text-sm">Lock</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scanned Part Details */}
      {scannedPart && (
        <div className="px-4 pb-4">
          <Card className="max-w-md mx-auto">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-mono">{scannedPart.part_number}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{scannedPart.description}</p>
                </div>
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stock Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Bin Qty</p>
                  <p className="text-2xl font-bold">{scannedPart.binQty}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Global Qty</p>
                  <p className="text-2xl font-bold">{scannedPart.globalQty}</p>
                </div>
              </div>

              {/* Actual Qty Input */}
              <div>
                <Label className="text-sm">Actual Quantity</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={actualQty}
                  onChange={(e) => setActualQty(e.target.value)}
                  className="text-3xl font-bold h-16 text-center mt-2"
                  autoFocus
                />
              </div>

              {/* Variance Display */}
              {actualQty !== '' && variance !== 0 && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${
                  Math.abs(variance) > 5 
                    ? 'bg-destructive/10 text-destructive' 
                    : 'bg-warning/10 text-warning'
                }`}>
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Variance: {variance > 0 ? '+' : ''}{variance}
                  </span>
                </div>
              )}

              {/* Confirm Button */}
              <Button 
                onClick={handleConfirmCount}
                disabled={saveCountLine.isPending || actualQty === ''}
                className="w-full h-14 text-lg"
              >
                {saveCountLine.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Check className="h-5 w-5 mr-2" />
                )}
                Confirm Count
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

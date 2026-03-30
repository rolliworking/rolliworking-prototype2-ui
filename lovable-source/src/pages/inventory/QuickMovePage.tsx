import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { QRScanner } from '@/components/inventory/QRScanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, ArrowRight, Package, MapPin, Check, Loader2, RotateCcw } from 'lucide-react';

type MoveStep = 'source' | 'part' | 'destination';

interface SourceBin {
  id: string;
  name: string;
}

interface SelectedPart {
  id: string;
  part_number: string;
  description: string;
  sourceQty: number;
  average_cost: number | null;
}

export default function QuickMovePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [step, setStep] = useState<MoveStep>('source');
  const [sourceBin, setSourceBin] = useState<SourceBin | null>(null);
  const [selectedPart, setSelectedPart] = useState<SelectedPart | null>(null);
  const [qtyToMove, setQtyToMove] = useState<string>('');
  const [lastScannedCode, setLastScannedCode] = useState<string>('');

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

  // Move parts mutation
  const moveParts = useMutation({
    mutationFn: async (data: {
      sourceBinId: string;
      destBinId: string;
      partId: string;
      qty: number;
    }) => {
      // Get next move number
      const { data: moveNumber, error: numError } = await supabase.rpc('get_next_move_number');
      if (numError) throw numError;

      // Get current source stock
      const { data: sourceStock, error: sourceError } = await supabase
        .from('inventory_stock')
        .select('id, qty_on_hand')
        .eq('part_id', data.partId)
        .eq('bin_id', data.sourceBinId)
        .single();

      if (sourceError) throw new Error('Part not found in source bin');
      
      if (Number(sourceStock.qty_on_hand) < data.qty) {
        throw new Error(`Insufficient qty. Available: ${sourceStock.qty_on_hand}`);
      }

      // Update source bin stock
      const { error: updateSourceError } = await supabase
        .from('inventory_stock')
        .update({ 
          qty_on_hand: Number(sourceStock.qty_on_hand) - data.qty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sourceStock.id);

      if (updateSourceError) throw updateSourceError;

      // Check if dest bin has stock record
      const { data: destStock } = await supabase
        .from('inventory_stock')
        .select('id, qty_on_hand')
        .eq('part_id', data.partId)
        .eq('bin_id', data.destBinId)
        .single();

      if (destStock) {
        // Update existing record
        const { error: updateDestError } = await supabase
          .from('inventory_stock')
          .update({ 
            qty_on_hand: Number(destStock.qty_on_hand) + data.qty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', destStock.id);

        if (updateDestError) throw updateDestError;
      } else {
        // Create new stock record
        const { error: insertError } = await supabase
          .from('inventory_stock')
          .insert({
            part_id: data.partId,
            bin_id: data.destBinId,
            qty_on_hand: data.qty,
          });

        if (insertError) throw insertError;
      }

      // Log the move
      const { error: logError } = await supabase
        .from('inventory_moves')
        .insert({
          move_number: moveNumber || `MV-${Date.now()}`,
          source_bin_id: data.sourceBinId,
          destination_bin_id: data.destBinId,
          part_id: data.partId,
          qty_moved: data.qty,
          moved_by: user?.id,
        });

      if (logError) throw logError;

      return { moveNumber };
    },
    onSuccess: ({ moveNumber }) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      
      // Haptic feedback for success
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 100]);
      }
      
      toast({
        title: 'Move Complete',
        description: `${moveNumber}: Moved ${qtyToMove} of ${selectedPart?.part_number}`,
      });
      
      resetFlow();
    },
    onError: (error) => {
      // Haptic feedback for error
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
      
      toast({
        title: 'Move Failed',
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

    if (step === 'source') {
      // Look for bin by QR code or name
      const bin = bins?.find(b => 
        b.qr_code_id === code || 
        b.name.toLowerCase() === code.toLowerCase()
      );
      
      if (bin) {
        setSourceBin({ id: bin.id, name: bin.name });
        setStep('part');
        toast({
          title: 'Source Bin Set',
          description: `Now scan the part to move from ${bin.name}`,
        });
      } else {
        toast({
          title: 'Unknown Location',
          description: 'QR code does not match any bin',
          variant: 'destructive',
        });
      }
    } else if (step === 'part' && sourceBin) {
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
    } else if (step === 'destination' && sourceBin && selectedPart) {
      // Look for destination bin
      const bin = bins?.find(b => 
        b.qr_code_id === code || 
        b.name.toLowerCase() === code.toLowerCase()
      );
      
      if (bin) {
        if (bin.id === sourceBin.id) {
          toast({
            title: 'Same Location',
            description: 'Destination must be different from source',
            variant: 'destructive',
          });
          return;
        }
        
        // Execute the move
        moveParts.mutate({
          sourceBinId: sourceBin.id,
          destBinId: bin.id,
          partId: selectedPart.id,
          qty: Number(qtyToMove),
        });
      } else {
        toast({
          title: 'Unknown Location',
          description: 'QR code does not match any bin',
          variant: 'destructive',
        });
      }
    }
  }, [step, sourceBin, selectedPart, qtyToMove, bins, lastScannedCode, toast, moveParts]);

  const loadPartData = async (part: { id: string; part_number: string; description: string; average_cost: number | null }) => {
    // Get source bin qty
    const { data: binStock, error } = await supabase
      .from('inventory_stock')
      .select('qty_on_hand')
      .eq('part_id', part.id)
      .eq('bin_id', sourceBin!.id)
      .single();

    if (error || !binStock || Number(binStock.qty_on_hand) <= 0) {
      toast({
        title: 'No Stock',
        description: `${part.part_number} has no stock in ${sourceBin!.name}`,
        variant: 'destructive',
      });
      return;
    }

    setSelectedPart({
      id: part.id,
      part_number: part.part_number,
      description: part.description,
      sourceQty: Number(binStock.qty_on_hand),
      average_cost: part.average_cost,
    });
    setQtyToMove(String(binStock.qty_on_hand));
    setStep('destination');
    
    toast({
      title: 'Part Selected',
      description: `Now scan the destination bin`,
    });
  };

  const resetFlow = () => {
    setStep('source');
    setSourceBin(null);
    setSelectedPart(null);
    setQtyToMove('');
    setLastScannedCode('');
  };

  const getStepLabel = () => {
    switch (step) {
      case 'source': return 'Scan Source Bin';
      case 'part': return 'Scan Part';
      case 'destination': return 'Scan Destination';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-safe">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/inventory/parts')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-medium">Quick Move</h1>
              <p className="text-sm text-muted-foreground">Transfer parts between bins</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {getStepLabel()}
            </Badge>
            {step !== 'source' && (
              <Button variant="ghost" size="icon" onClick={resetFlow}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
          <div className={`flex-1 h-2 rounded-full ${step === 'source' ? 'bg-primary' : 'bg-primary/30'}`} />
          <div className={`flex-1 h-2 rounded-full ${step === 'part' ? 'bg-primary' : step === 'destination' ? 'bg-primary/30' : 'bg-muted'}`} />
          <div className={`flex-1 h-2 rounded-full ${step === 'destination' ? 'bg-primary' : 'bg-muted'}`} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          <span>Source</span>
          <span>Part</span>
          <span>Destination</span>
        </div>
      </div>

      {/* Scanner */}
      <div className="p-4">
        <QRScanner 
          onScan={handleScan}
          isActive={!moveParts.isPending}
          className="max-w-md mx-auto"
        />
      </div>

      {/* Current Selection Display */}
      <div className="px-4 space-y-4 max-w-md mx-auto">
        {/* Source Bin */}
        {sourceBin && (
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Source Bin</p>
                  <p className="font-medium">{sourceBin.name}</p>
                </div>
                <Check className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selected Part */}
        {selectedPart && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-mono">{selectedPart.part_number}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{selectedPart.description}</p>
                </div>
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Available in {sourceBin?.name}</p>
                <p className="text-2xl font-bold">{selectedPart.sourceQty}</p>
              </div>

              <div>
                <Label className="text-sm">Quantity to Move</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={qtyToMove}
                  onChange={(e) => {
                    const val = Math.min(Number(e.target.value), selectedPart.sourceQty);
                    setQtyToMove(String(Math.max(0, val)));
                  }}
                  max={selectedPart.sourceQty}
                  min={1}
                  className="text-2xl font-bold h-14 text-center mt-2"
                />
              </div>

              {step === 'destination' && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">Now scan the destination bin</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {moveParts.isPending && (
          <Card className="bg-primary/5 border-primary">
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-lg font-medium">Processing move...</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

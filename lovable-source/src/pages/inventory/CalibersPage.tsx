import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Loader2, Settings, Package, Link2 } from 'lucide-react';

type Caliber = {
  id: string;
  caliber_number: string;
  brand: string;
  name: string | null;
  movement_type: string | null;
  frequency: number | null;
  jewels: number | null;
  power_reserve_hours: number | null;
  notes: string | null;
  is_active: boolean;
};

type CaliberPart = {
  id: string;
  position: string | null;
  notes: string | null;
  parts: {
    id: string;
    part_number: string;
    description: string;
  };
};

const MOVEMENT_TYPES = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'manual', label: 'Manual Wind' },
  { value: 'quartz', label: 'Quartz' },
];

export default function CalibersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCaliber, setSelectedCaliber] = useState<Caliber | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCaliber, setNewCaliber] = useState({
    caliber_number: '',
    brand: '',
    name: '',
    movement_type: 'automatic',
    frequency: '28800',
    jewels: '',
    power_reserve_hours: '',
    notes: '',
  });

  // Fetch calibers
  const { data: calibers, isLoading } = useQuery({
    queryKey: ['calibers', search],
    queryFn: async () => {
      let query = supabase
        .from('calibers')
        .select('*')
        .eq('is_active', true)
        .order('brand', { ascending: true });

      if (search) {
        query = query.or(`caliber_number.ilike.%${search}%,brand.ilike.%${search}%,name.ilike.%${search}%`);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as Caliber[];
    },
  });

  // Fetch compatible parts for selected caliber
  const { data: caliberParts } = useQuery({
    queryKey: ['caliber-parts', selectedCaliber?.id],
    queryFn: async () => {
      if (!selectedCaliber) return null;
      const { data, error } = await supabase
        .from('caliber_parts')
        .select(`
          id,
          position,
          notes,
          parts (id, part_number, description)
        `)
        .eq('caliber_id', selectedCaliber.id);
      if (error) throw error;
      return data as CaliberPart[];
    },
    enabled: !!selectedCaliber,
  });

  // Create caliber mutation
  const createCaliberMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('calibers')
        .insert({
          caliber_number: newCaliber.caliber_number,
          brand: newCaliber.brand,
          name: newCaliber.name || null,
          movement_type: newCaliber.movement_type,
          frequency: parseInt(newCaliber.frequency) || null,
          jewels: parseInt(newCaliber.jewels) || null,
          power_reserve_hours: parseInt(newCaliber.power_reserve_hours) || null,
          notes: newCaliber.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibers'] });
      setIsCreateOpen(false);
      setNewCaliber({
        caliber_number: '',
        brand: '',
        name: '',
        movement_type: 'automatic',
        frequency: '28800',
        jewels: '',
        power_reserve_hours: '',
        notes: '',
      });
      toast({ title: 'Caliber created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating caliber', description: error.message, variant: 'destructive' });
    },
  });

  // Group calibers by brand
  const calibersByBrand = calibers?.reduce((acc, cal) => {
    if (!acc[cal.brand]) acc[cal.brand] = [];
    acc[cal.brand].push(cal);
    return acc;
  }, {} as Record<string, Caliber[]>) || {};

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Caliber List */}
      <div className="w-80 border-r flex flex-col bg-card">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Calibers</h2>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Caliber</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Caliber Number *</Label>
                      <Input 
                        value={newCaliber.caliber_number} 
                        onChange={(e) => setNewCaliber({ ...newCaliber, caliber_number: e.target.value })} 
                        placeholder="e.g., 3135"
                      />
                    </div>
                    <div>
                      <Label>Brand *</Label>
                      <Input 
                        value={newCaliber.brand} 
                        onChange={(e) => setNewCaliber({ ...newCaliber, brand: e.target.value })} 
                        placeholder="e.g., Rolex"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input 
                        value={newCaliber.name} 
                        onChange={(e) => setNewCaliber({ ...newCaliber, name: e.target.value })} 
                        placeholder="e.g., Oyster Perpetual"
                      />
                    </div>
                    <div>
                      <Label>Movement Type</Label>
                      <Select value={newCaliber.movement_type} onValueChange={(v) => setNewCaliber({ ...newCaliber, movement_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MOVEMENT_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Frequency (BPH)</Label>
                      <Input 
                        type="number"
                        value={newCaliber.frequency} 
                        onChange={(e) => setNewCaliber({ ...newCaliber, frequency: e.target.value })} 
                        placeholder="28800"
                      />
                    </div>
                    <div>
                      <Label>Jewels</Label>
                      <Input 
                        type="number"
                        value={newCaliber.jewels} 
                        onChange={(e) => setNewCaliber({ ...newCaliber, jewels: e.target.value })} 
                        placeholder="31"
                      />
                    </div>
                    <div>
                      <Label>Power Reserve (hrs)</Label>
                      <Input 
                        type="number"
                        value={newCaliber.power_reserve_hours} 
                        onChange={(e) => setNewCaliber({ ...newCaliber, power_reserve_hours: e.target.value })} 
                        placeholder="48"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea 
                      value={newCaliber.notes} 
                      onChange={(e) => setNewCaliber({ ...newCaliber, notes: e.target.value })} 
                      placeholder="Additional information..."
                    />
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => createCaliberMutation.mutate()}
                    disabled={!newCaliber.caliber_number || !newCaliber.brand || createCaliberMutation.isPending}
                  >
                    {createCaliberMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Caliber
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search calibers..." 
              className="pl-9" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : Object.keys(calibersByBrand).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No calibers found</p>
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(calibersByBrand).map(([brand, cals]) => (
                <div key={brand} className="mb-2">
                  <div className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                    {brand}
                  </div>
                  {cals.map((cal) => (
                    <button
                      key={cal.id}
                      onClick={() => setSelectedCaliber(cal)}
                      className={`w-full text-left px-4 py-2 hover:bg-muted/50 transition-colors ${
                        selectedCaliber?.id === cal.id ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium">{cal.caliber_number}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {cal.movement_type}
                        </Badge>
                      </div>
                      {cal.name && (
                        <p className="text-sm text-muted-foreground">{cal.name}</p>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Caliber Details */}
      <div className="flex-1 overflow-auto">
        {selectedCaliber ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-serif font-semibold">{selectedCaliber.caliber_number}</h1>
                <p className="text-muted-foreground">{selectedCaliber.brand} {selectedCaliber.name || ''}</p>
              </div>
              <Badge className="text-sm capitalize">{selectedCaliber.movement_type}</Badge>
            </div>

            <Tabs defaultValue="specs">
              <TabsList>
                <TabsTrigger value="specs">Specifications</TabsTrigger>
                <TabsTrigger value="parts">Compatible Parts ({caliberParts?.length || 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="specs" className="mt-6">
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Technical Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frequency</span>
                        <span className="font-medium">{selectedCaliber.frequency?.toLocaleString() || '-'} BPH</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Jewels</span>
                        <span className="font-medium">{selectedCaliber.jewels || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Power Reserve</span>
                        <span className="font-medium">{selectedCaliber.power_reserve_hours ? `${selectedCaliber.power_reserve_hours} hours` : '-'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {selectedCaliber.notes && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{selectedCaliber.notes}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="parts" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        Compatible Parts
                      </CardTitle>
                      <CardDescription>Parts that work with this caliber</CardDescription>
                    </div>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" /> Link Part
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {caliberParts?.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Part Number</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {caliberParts.map((cp) => (
                            <TableRow key={cp.id}>
                              <TableCell className="font-mono">{cp.parts.part_number}</TableCell>
                              <TableCell>{cp.parts.description}</TableCell>
                              <TableCell>{cp.position || '-'}</TableCell>
                              <TableCell className="text-muted-foreground">{cp.notes || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No parts linked to this caliber</p>
                        <p className="text-sm">Link parts to build a cross-reference database</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Settings className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">Select a caliber to view details</p>
              <p className="text-sm">Build your movement/parts cross-reference</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Search,
  Upload,
  Plus,
  Package,
  Wrench,
  Box,
  Loader2,
  FileDown,
  AlertCircle,
  DollarSign,
  Pencil,
  Trash2,
  X,
  Check,
  ChevronDown,
  Download,
  Shield,
} from 'lucide-react';
import { useRolePermissions } from '@/hooks/useRolePermissions';

type Product = {
  id: string;
  part_number: string;
  description: string;
  item_type: string;
  uom: string;
  average_cost: number | null;
  last_cost: number | null;
  default_sell_price: number | null;
  category: string | null;
  brand: string | null;
  is_active: boolean;
  created_at: string;
};

const ITEM_TYPES = [
  { value: 'inventory', label: 'Inventory' },
  { value: 'non_inventory', label: 'Non-Inventory' },
  { value: 'service', label: 'Service' },
];

const UOM_TYPES = [
  { value: 'ea', label: 'Each (ea)' },
  { value: 'hr', label: 'Hour (hr)' },
  { value: 'box', label: 'Box' },
  { value: 'set', label: 'Set' },
];

const ProductsServicesPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessSetup, isLoading: permissionsLoading } = useRolePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editProduct, setEditProduct] = useState<Partial<Product> | null>(null);
  const [newProduct, setNewProduct] = useState({
    part_number: '',
    description: '',
    item_type: 'service',
    uom: 'ea',
    default_sell_price: '',
  });

  // Fetch parts/products - MUST be before any conditional returns
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products-services', searchTerm, itemTypeFilter],
    queryFn: async () => {
      let query = supabase
        .from('parts')
        .select('*')
        .eq('is_active', true)
        .order('part_number');

      if (searchTerm) {
        query = query.or(`part_number.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      if (itemTypeFilter !== 'all') {
        query = query.eq('item_type', itemTypeFilter as 'inventory' | 'non_inventory' | 'service');
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !permissionsLoading && canAccessSetup,
  });

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ['products-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('item_type, default_sell_price')
        .eq('is_active', true);
      
      if (error) throw error;
      
      const counts = {
        total: data?.length || 0,
        inventory: 0,
        non_inventory: 0,
        service: 0,
        missingPrice: 0,
      };
      
      data?.forEach(p => {
        if (p.item_type === 'inventory') counts.inventory++;
        else if (p.item_type === 'non_inventory') counts.non_inventory++;
        else if (p.item_type === 'service') counts.service++;
        
        if (p.default_sell_price === null || p.default_sell_price === 0) {
          counts.missingPrice++;
        }
      });
      
      return counts;
    },
    enabled: !permissionsLoading && canAccessSetup,
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .insert({
          part_number: newProduct.part_number,
          description: newProduct.description,
          item_type: newProduct.item_type as any,
          uom: newProduct.uom as any,
          default_sell_price: newProduct.default_sell_price ? parseFloat(newProduct.default_sell_price) : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-services'] });
      queryClient.invalidateQueries({ queryKey: ['products-stats'] });
      setIsCreateOpen(false);
      setNewProduct({
        part_number: '',
        description: '',
        item_type: 'service',
        uom: 'ea',
        default_sell_price: '',
      });
      toast.success('Product created successfully');
    },
    onError: (error: any) => {
      let message = error.message;
      if (error.message?.includes('parts_part_number_key')) {
        message = 'A product with this part number already exists.';
      }
      toast.error('Error creating product', { description: message });
    },
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async (updates: Partial<Product>) => {
      if (!selectedProduct) throw new Error('No product selected');
      
      const payload: Record<string, any> = {};
      const setIfChanged = (key: keyof Product, next: any, trim = false) => {
        if (next === undefined) return;
        const prev = (selectedProduct as any)[key];
        const normalizedNext = trim && typeof next === 'string' ? next.trim() : next;
        const normalizedPrev = trim && typeof prev === 'string' ? prev.trim() : prev;
        if (normalizedNext !== normalizedPrev) payload[key as string] = normalizedNext;
      };

      setIfChanged('part_number', updates.part_number, true);
      setIfChanged('description', updates.description, true);
      setIfChanged('item_type', updates.item_type);
      setIfChanged('uom', updates.uom);
      setIfChanged('default_sell_price', updates.default_sell_price);
      setIfChanged('category', updates.category);

      if (Object.keys(payload).length === 0) return;

      const { error } = await supabase
        .from('parts')
        .update(payload)
        .eq('id', selectedProduct.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-services'] });
      setIsEditing(false);
      setEditProduct(null);
      if (selectedProduct && editProduct) {
        setSelectedProduct({ ...selectedProduct, ...editProduct } as Product);
      }
      toast.success('Product updated successfully');
    },
    onError: (error: any) => {
      let message = error.message;
      if (error.message?.includes('parts_part_number_key')) {
        message = 'A product with this part number already exists.';
      }
      toast.error('Error updating product', { description: message });
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error('No product selected');
      const { error } = await supabase
        .from('parts')
        .update({ is_active: false })
        .eq('id', selectedProduct.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-services'] });
      queryClient.invalidateQueries({ queryKey: ['products-stats'] });
      setSelectedProduct(null);
      toast.success('Product deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Error deleting product', { description: error.message });
    },
  });

  // Permission check - AFTER all hooks
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!canAccessSetup) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-5 w-5" />
              <p>You don't have permission to access this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getItemTypeBadge = (type: string) => {
    switch (type) {
      case 'inventory': return <Badge>Inventory</Badge>;
      case 'non_inventory': return <Badge variant="secondary">Non-Inventory</Badge>;
      case 'service': return <Badge variant="outline">Service</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  const startEditing = () => {
    if (!selectedProduct) return;
    setEditProduct({
      part_number: selectedProduct.part_number,
      description: selectedProduct.description,
      item_type: selectedProduct.item_type,
      uom: selectedProduct.uom,
      default_sell_price: selectedProduct.default_sell_price,
      category: selectedProduct.category,
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditProduct(null);
  };

  const saveEditing = () => {
    if (editProduct) {
      updateProductMutation.mutate(editProduct);
    }
  };

  // Export CSV
  const exportToCSV = async () => {
    let query = supabase
      .from('parts')
      .select('id, part_number, description, item_type, uom, average_cost, default_sell_price, category')
      .eq('is_active', true)
      .order('part_number');

    if (searchTerm) {
      query = query.or(`part_number.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    if (itemTypeFilter !== 'all') {
      query = query.eq('item_type', itemTypeFilter as any);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Export failed', { description: error.message });
      return;
    }

    const headers = ['id', 'part_number', 'description', 'item_type', 'uom', 'average_cost', 'default_sell_price', 'category'];
    const csvContent = [
      headers.join(','),
      ...(data || []).map(row =>
        headers.map(h => {
          const val = (row as any)[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `products-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Export complete');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Missing Price Metric */}
      {stats && stats.missingPrice > 0 && (
        <div className="p-4 border-b bg-background">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.missingPrice}</p>
                  <p className="text-sm text-muted-foreground">Products Missing Price</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Products List */}
        <div className="w-96 border-r flex flex-col bg-card">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Products & Services</h2>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Product</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Part Number *</Label>
                        <Input 
                          value={newProduct.part_number} 
                          onChange={(e) => setNewProduct({ ...newProduct, part_number: e.target.value })} 
                          placeholder="Enter part number"
                        />
                      </div>
                      <div>
                        <Label>Item Type</Label>
                        <Select value={newProduct.item_type} onValueChange={(v) => setNewProduct({ ...newProduct, item_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ITEM_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Description *</Label>
                      <Input 
                        value={newProduct.description} 
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} 
                        placeholder="Enter description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>UoM</Label>
                        <Select value={newProduct.uom} onValueChange={(v) => setNewProduct({ ...newProduct, uom: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {UOM_TYPES.map((u) => (
                              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Sell Price</Label>
                        <Input 
                          type="number" 
                          step="0.01"
                          value={newProduct.default_sell_price} 
                          onChange={(e) => setNewProduct({ ...newProduct, default_sell_price: e.target.value })} 
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={() => createProductMutation.mutate()}
                      disabled={!newProduct.part_number || !newProduct.description || createProductMutation.isPending}
                    >
                      {createProductMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create Product
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search products..." 
                className="pl-9" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={itemTypeFilter} onValueChange={setItemTypeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {ITEM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-1" />
                    Import
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate('/inventory/products/import')}>
                    <FileDown className="h-4 w-4 mr-2" />
                    From QuickBooks
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/inventory/parts/import-pricing')}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Retail Pricing (CSV)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {products && (
              <div className="text-xs text-muted-foreground">
                {products.length} items {products.length === 500 && '(max displayed)'}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : products?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No products found</p>
              </div>
            ) : (
              <div className="divide-y">
                {products?.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      if (isEditing) {
                        toast.error('Finish editing (save or cancel) before switching products');
                        return;
                      }
                      setSelectedProduct(product);
                    }}
                    className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                      selectedProduct?.id === product.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono font-medium text-sm truncate">{product.part_number}</p>
                        <p className="text-sm text-muted-foreground truncate">{product.description}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {product.item_type}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Product Details */}
        <div className="flex-1 overflow-auto">
          {selectedProduct ? (
            <div className="p-6">
              <div className="flex items-start justify-between mb-6 gap-4">
                <div className="flex-1 max-w-2xl">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={editProduct?.part_number || ''}
                        onChange={(e) => setEditProduct({ ...editProduct, part_number: e.target.value })}
                        className="text-xl font-semibold"
                        placeholder="Part Number"
                      />
                      <Textarea
                        value={editProduct?.description || ''}
                        onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })}
                        placeholder="Description"
                        className="min-h-[160px] w-full resize-y"
                      />
                    </div>
                  ) : (
                    <>
                      <h1 className="text-2xl font-serif font-semibold">{selectedProduct.part_number}</h1>
                      <p className="text-muted-foreground">{selectedProduct.description}</p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Select
                        value={editProduct?.item_type || ''}
                        onValueChange={(v) => setEditProduct({ ...editProduct, item_type: v })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ITEM_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={cancelEditing}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={saveEditing} disabled={updateProductMutation.isPending}>
                        {updateProductMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                    </>
                  ) : (
                    <>
                      {getItemTypeBadge(selectedProduct.item_type)}
                      <Button size="sm" variant="outline" onClick={startEditing}>
                        <Pencil className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Product</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{selectedProduct.part_number}"? This will deactivate the product and hide it from lists.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteProductMutation.mutate()}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deleteProductMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>

              <Tabs defaultValue="details">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="pricing">Pricing</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-6 mt-6">
                  <div className="grid grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          Product Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Part Number</span>
                          <span className="font-mono font-medium">{selectedProduct.part_number}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Type</span>
                          {getItemTypeBadge(selectedProduct.item_type)}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">UoM</span>
                          {isEditing ? (
                            <Select
                              value={editProduct?.uom || ''}
                              onValueChange={(v) => setEditProduct({ ...editProduct, uom: v })}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UOM_TYPES.map((u) => (
                                  <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="font-medium uppercase">{selectedProduct.uom}</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Category</span>
                          <span className="font-medium">{selectedProduct.category || '—'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Brand</span>
                          <span className="font-medium">{selectedProduct.brand || '—'}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <DollarSign className="h-5 w-5" />
                          Pricing
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Average Cost</span>
                          <span className="font-medium">${(selectedProduct.average_cost || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last Cost</span>
                          <span className="font-medium">${(selectedProduct.last_cost || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-muted-foreground">Sell Price</span>
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editProduct?.default_sell_price ?? ''}
                              onChange={(e) => setEditProduct({ ...editProduct, default_sell_price: e.target.value ? parseFloat(e.target.value) : null })}
                              className="w-24 text-right"
                            />
                          ) : (
                            <span className="font-bold">${(selectedProduct.default_sell_price || 0).toFixed(2)}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="pricing" className="space-y-6 mt-6">
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold">${(selectedProduct.average_cost || 0).toFixed(2)}</div>
                        <p className="text-sm text-muted-foreground">Average Cost</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold">${(selectedProduct.default_sell_price || 0).toFixed(2)}</div>
                        <p className="text-sm text-muted-foreground">Sell Price</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold">
                          {selectedProduct.default_sell_price && selectedProduct.average_cost
                            ? `${(((selectedProduct.default_sell_price - selectedProduct.average_cost) / selectedProduct.default_sell_price) * 100).toFixed(1)}%`
                            : '—'
                          }
                        </div>
                        <p className="text-sm text-muted-foreground">Margin</p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a product to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductsServicesPage;

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface AddPartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPartNumber?: string;
  onPartCreated?: (part: { id: string; part_number: string; description: string; default_sell_price: number | null }) => void;
}

export function AddPartDialog({ open, onOpenChange, initialPartNumber = '', onPartCreated }: AddPartDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    part_number: initialPartNumber,
    description: '',
    item_type: 'service' as 'inventory' | 'non_inventory' | 'service',
    default_sell_price: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.part_number.trim() || !formData.description.trim()) {
      toast.error('Part number and description are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('parts')
        .insert({
          part_number: formData.part_number.trim(),
          description: formData.description.trim(),
          item_type: formData.item_type,
          default_sell_price: formData.default_sell_price ? parseFloat(formData.default_sell_price) : null,
          is_active: true,
        })
        .select('id, part_number, description, default_sell_price')
        .single();

      if (error) throw error;

      toast.success('Part created successfully');
      queryClient.invalidateQueries({ queryKey: ['parts-search'] });
      
      onPartCreated?.(data);
      onOpenChange(false);
      
      // Reset form
      setFormData({
        part_number: '',
        description: '',
        item_type: 'service',
        default_sell_price: '',
      });
    } catch (err: any) {
      console.error('Error creating part:', err);
      if (err.code === '23505') {
        toast.error('A part with this number already exists');
      } else {
        toast.error('Failed to create part');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Part</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="part_number">Part Number *</Label>
            <Input
              id="part_number"
              value={formData.part_number}
              onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
              placeholder="Enter part number"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter description"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item_type">Type</Label>
            <Select
              value={formData.item_type}
              onValueChange={(val: 'inventory' | 'non_inventory' | 'service') => 
                setFormData({ ...formData, item_type: val })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="inventory">Inventory</SelectItem>
                <SelectItem value="non_inventory">Non-Inventory</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_sell_price">Default Price</Label>
            <Input
              id="default_sell_price"
              type="number"
              step="0.01"
              value={formData.default_sell_price}
              onChange={(e) => setFormData({ ...formData, default_sell_price: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Part'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

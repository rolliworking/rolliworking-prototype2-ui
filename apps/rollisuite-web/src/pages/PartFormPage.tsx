import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePart, useCreatePart, useUpdatePart } from '../hooks/useParts';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function PartFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = id && id !== 'new';

  const { data: existingPart, isLoading: loadingPart } = usePart(id!);
  const createMutation = useCreatePart();
  const updateMutation = useUpdatePart();

  const [formData, setFormData] = useState({
    partNumber: '',
    description: '',
    itemType: 'part' as 'part' | 'labor' | 'service' | 'other',
    uom: 'each' as 'each' | 'hour' | 'ft' | 'lb' | 'kg' | 'gram' | 'oz',
    defaultSellPrice: '',
    averageCost: '',
    reorderPoint: '',
    reorderQty: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (existingPart && isEditing) {
      setFormData({
        partNumber: existingPart.partNumber || '',
        description: existingPart.description || '',
        itemType: existingPart.itemType || 'part',
        uom: existingPart.uom || 'each',
        defaultSellPrice: existingPart.defaultSellPrice?.toString() || '',
        averageCost: existingPart.averageCost?.toString() || '',
        reorderPoint: existingPart.reorderPoint?.toString() || '',
        reorderQty: existingPart.reorderQty?.toString() || '',
      });
    }
  }, [existingPart, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.partNumber.trim()) newErrors.partNumber = 'Part number is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const data = {
        partNumber: formData.partNumber,
        description: formData.description,
        itemType: formData.itemType,
        uom: formData.uom,
        defaultSellPrice: formData.defaultSellPrice ? parseFloat(formData.defaultSellPrice) : undefined,
        averageCost: formData.averageCost ? parseFloat(formData.averageCost) : undefined,
        reorderPoint: formData.reorderPoint ? parseInt(formData.reorderPoint) : undefined,
        reorderQty: formData.reorderQty ? parseInt(formData.reorderQty) : undefined,
      };

      if (isEditing) {
        await updateMutation.mutateAsync({ id: id!, data });
        navigate(`/parts/${id}`);
      } else {
        const newPart = await createMutation.mutateAsync(data);
        navigate(`/parts/${newPart.id}`);
      }
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.error || 'Failed to save part' });
    }
  };

  if (loadingPart && isEditing) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <button onClick={() => navigate(isEditing ? `/parts/${id}` : '/parts')} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft size={20} className="mr-2" />Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{isEditing ? 'Edit Part' : 'New Part'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {errors.submit && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{errors.submit}</div>}

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Part Number <span className="text-red-500">*</span></label>
              <Input type="text" name="partNumber" value={formData.partNumber} onChange={handleChange} placeholder="e.g., CRYSTAL-30MM" disabled={isEditing} />
              {errors.partNumber && <p className="mt-1 text-sm text-red-600">{errors.partNumber}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Item Type</label>
              <select name="itemType" value={formData.itemType} onChange={handleChange} className="w-full rounded-md border border-gray-300 px-3 py-2">
                <option value="part">Part</option>
                <option value="service">Service</option>
                <option value="labor">Labor</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description <span className="text-red-500">*</span></label>
              <Input type="text" name="description" value={formData.description} onChange={handleChange} placeholder="e.g., Sapphire Crystal 30mm" />
              {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sell Price ($)</label>
              <Input type="number" name="defaultSellPrice" value={formData.defaultSellPrice} onChange={handleChange} placeholder="0.00" step="0.01" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cost ($)</label>
              <Input type="number" name="averageCost" value={formData.averageCost} onChange={handleChange} placeholder="0.00" step="0.01" />
            </div>
          </div>
        </div>

        {formData.itemType === 'part' && (
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Inventory</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reorder Point</label>
                <Input type="number" name="reorderPoint" value={formData.reorderPoint} onChange={handleChange} placeholder="10" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reorder Qty</label>
                <Input type="number" name="reorderQty" value={formData.reorderQty} onChange={handleChange} placeholder="20" />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end space-x-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => navigate(isEditing ? `/parts/${id}` : '/parts')}>Cancel</Button>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? 'Saving...' : <><Save size={16} className="mr-2" />{isEditing ? 'Save' : 'Create'}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}

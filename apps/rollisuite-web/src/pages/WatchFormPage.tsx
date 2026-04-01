import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useWatch, useCreateWatch, useUpdateWatch } from '../hooks/useWatches';
import { useCustomers } from '../hooks/useCustomers';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function WatchFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = id && id !== 'new';
  const preselectedCustomerId = searchParams.get('customerId');

  const { data: existingWatch, isLoading: loadingWatch } = useWatch(id!);
  const { data: customersData } = useCustomers({ perPage: 100 });
  const createMutation = useCreateWatch();
  const updateMutation = useUpdateWatch();

  const [formData, setFormData] = useState({
    customerId: preselectedCustomerId || '',
    brand: '',
    model: '',
    referenceNumber: '',
    serialNumber: '',
    movementType: '',
    caseMaterial: '',
    bandMaterial: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (existingWatch && isEditing) {
      setFormData({
        customerId: existingWatch.customerId || '',
        brand: existingWatch.brand || '',
        model: existingWatch.model || '',
        referenceNumber: existingWatch.referenceNumber || '',
        serialNumber: existingWatch.serialNumber || '',
        movementType: existingWatch.movementType || '',
        caseMaterial: existingWatch.caseMaterial || '',
        bandMaterial: existingWatch.bandMaterial || '',
        notes: existingWatch.notes || '',
      });
    }
  }, [existingWatch, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.customerId) {
      newErrors.customerId = 'Customer is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: id!, data: formData });
        navigate(`/watches/${id}`);
      } else {
        const newWatch = await createMutation.mutateAsync(formData);
        navigate(`/watches/${newWatch.id}`);
      }
    } catch (error: any) {
      console.error('Failed to save watch:', error);
      setErrors({ submit: error.response?.data?.error || 'Failed to save watch' });
    }
  };

  if (loadingWatch && isEditing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <button
          onClick={() => navigate(isEditing ? `/watches/${id}` : '/watches')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Edit Watch' : 'New Watch'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {errors.submit}
          </div>
        )}

        {/* Customer Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Customer <span className="text-red-500">*</span>
          </label>
          <select
            name="customerId"
            value={formData.customerId}
            onChange={handleChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            disabled={!!preselectedCustomerId}
          >
            <option value="">Select a customer...</option>
            {customersData?.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.displayName || `${customer.firstName} ${customer.lastName}`}
              </option>
            ))}
          </select>
          {errors.customerId && (
            <p className="mt-1 text-sm text-red-600">{errors.customerId}</p>
          )}
        </div>

        {/* Watch Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
            <Input
              type="text"
              name="brand"
              value={formData.brand}
              onChange={handleChange}
              placeholder="e.g., Rolex"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
            <Input
              type="text"
              name="model"
              value={formData.model}
              onChange={handleChange}
              placeholder="e.g., Submariner"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Serial Number</label>
            <Input
              type="text"
              name="serialNumber"
              value={formData.serialNumber}
              onChange={handleChange}
              placeholder="e.g., R123456"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reference Number</label>
            <Input
              type="text"
              name="referenceNumber"
              value={formData.referenceNumber}
              onChange={handleChange}
              placeholder="e.g., 116610LN"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Movement Type</label>
            <Input
              type="text"
              name="movementType"
              value={formData.movementType}
              onChange={handleChange}
              placeholder="e.g., Automatic"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Case Material</label>
            <Input
              type="text"
              name="caseMaterial"
              value={formData.caseMaterial}
              onChange={handleChange}
              placeholder="e.g., Stainless Steel"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Band Material</label>
            <Input
              type="text"
              name="bandMaterial"
              value={formData.bandMaterial}
              onChange={handleChange}
              placeholder="e.g., Oyster Bracelet"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            placeholder="Additional notes about this watch..."
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(isEditing ? `/watches/${id}` : '/watches')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" />
                {isEditing ? 'Save Changes' : 'Create Watch'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

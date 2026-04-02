import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWaitlistEntry, useCreateWaitlistEntry, useUpdateWaitlistEntry } from '../hooks/useWaitlist';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

export default function WaitlistFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: entry, isLoading: loadingEntry } = useWaitlistEntry(id || '');
  const createMutation = useCreateWaitlistEntry();
  const updateMutation = useUpdateWaitlistEntry();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    brand: '',
    model: '',
    serviceType: '' as 'repair' | 'restoration' | 'appraisal' | 'consignment' | '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    estimatedValue: '',
    notes: '',
  });

  useEffect(() => {
    if (entry) {
      setFormData({
        firstName: entry.firstName || '',
        lastName: entry.lastName || '',
        email: entry.email || '',
        phone: entry.phone || '',
        brand: entry.brand || '',
        model: entry.model || '',
        serviceType: entry.serviceType || '',
        priority: entry.priority || 'normal',
        estimatedValue: entry.estimatedValue?.toString() || '',
        notes: entry.notes || '',
      });
    }
  }, [entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: any = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone || undefined,
      brand: formData.brand || undefined,
      model: formData.model || undefined,
      serviceType: formData.serviceType || undefined,
      priority: formData.priority,
      estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue) : undefined,
      notes: formData.notes || undefined,
    };

    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, ...data });
      } else {
        await createMutation.mutateAsync(data);
      }
      navigate('/waitlist');
    } catch (error) {
      console.error('Failed to save waitlist entry:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (isEdit && loadingEntry) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/waitlist')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Waitlist
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Waitlist Entry' : 'Add to Waitlist'}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {isEdit ? 'Update customer service request details' : 'Add a new customer to the waitlist'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        {/* Customer Information */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                placeholder="Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="john.doe@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <Input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1 (415) 555-1234"
              />
            </div>
          </div>
        </div>

        {/* Watch Information */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Watch Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand
              </label>
              <Input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="Rolex, Omega, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <Input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                placeholder="Submariner, Speedmaster, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Type
              </label>
              <select
                name="serviceType"
                value={formData.serviceType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select service type</option>
                <option value="repair">Repair</option>
                <option value="restoration">Restoration</option>
                <option value="appraisal">Appraisal</option>
                <option value="consignment">Consignment</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Value
              </label>
              <Input
                type="number"
                name="estimatedValue"
                value={formData.estimatedValue}
                onChange={handleChange}
                placeholder="5000"
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Request Details */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional details about the service request..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/waitlist')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="flex items-center space-x-2"
          >
            {(createMutation.isPending || updateMutation.isPending) ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{isEdit ? 'Update Entry' : 'Add to Waitlist'}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

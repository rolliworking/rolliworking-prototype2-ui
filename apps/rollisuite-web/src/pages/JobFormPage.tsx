import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useJob, useCreateJob, useUpdateJob } from '../hooks/useJobs';
import { useCustomers } from '../hooks/useCustomers';
import { ArrowLeft, Save, Calendar } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_OPTIONS = [
  { value: 'intake', label: 'Intake' },
  { value: 'in_review', label: 'In Review' },
  { value: 'awaiting_customer_approval', label: 'Awaiting Customer Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_service', label: 'In Service' },
  { value: 'testing', label: 'Testing' },
  { value: 'ready_to_ship', label: 'Ready to Ship' },
  { value: 'closed', label: 'Closed' },
];

export default function JobFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = id && id !== 'new';
  const preselectedCustomerId = searchParams.get('customerId');
  const preselectedEstimateNumber = searchParams.get('estimateNumber');

  const { data: existingJob, isLoading: loadingJob } = useJob(id!);
  const { data: customersData } = useCustomers({ perPage: 100 });
  const createMutation = useCreateJob();
  const updateMutation = useUpdateJob(id!);

  const [formData, setFormData] = useState({
    customerId: preselectedCustomerId || '',
    estimateNumber: preselectedEstimateNumber || '',
    watchId: '',
    status: 'intake',
    priority: 'normal',
    dueDate: '',
    intakeNotes: '',
    conditionNotes: '',
    assignedTo: '',
    // Watch fields (for creating new watch)
    watchBrand: '',
    watchModel: '',
    watchSerialNumber: '',
    watchReferenceNumber: '',
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [createNewWatch, setCreateNewWatch] = useState(true);

  // Load existing job data
  useEffect(() => {
    if (existingJob) {
      setFormData({
        customerId: existingJob.customerId,
        estimateNumber: existingJob.estimateNumber || '',
        watchId: existingJob.watchId,
        status: existingJob.status,
        priority: existingJob.priority,
        dueDate: existingJob.dueDate ? existingJob.dueDate.split('T')[0] : '',
        intakeNotes: existingJob.intakeNotes || '',
        conditionNotes: existingJob.conditionNotes || '',
        assignedTo: existingJob.assignedTo || '',
        watchBrand: existingJob.watch?.brand || '',
        watchModel: existingJob.watch?.model || '',
        watchSerialNumber: existingJob.watch?.serialNumber || '',
        watchReferenceNumber: existingJob.watch?.referenceNumber || '',
      });
      setCreateNewWatch(false);
    }
  }, [existingJob]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerId) {
      alert('Please select a customer');
      return;
    }

    if (createNewWatch && !formData.watchBrand) {
      alert('Please enter watch brand');
      return;
    }

    const payload: any = {
      customerId: formData.customerId,
      estimateNumber: formData.estimateNumber || undefined,
      watchId: formData.watchId || undefined,
      status: formData.status,
      priority: formData.priority,
      dueDate: formData.dueDate || undefined,
      intakeNotes: formData.intakeNotes || undefined,
      conditionNotes: formData.conditionNotes || undefined,
      assignedTo: formData.assignedTo || undefined,
    };

    // If creating new watch, include watch data
    if (createNewWatch && !isEditing) {
      payload.watch = {
        brand: formData.watchBrand,
        model: formData.watchModel || undefined,
        serialNumber: formData.watchSerialNumber || undefined,
        referenceNumber: formData.watchReferenceNumber || undefined,
      };
    }

    try {
      if (isEditing) {
        await updateMutation.mutateAsync(payload);
        navigate(`/jobs/${id}`);
      } else {
        const newJob = await createMutation.mutateAsync(payload);
        navigate(`/jobs/${newJob.id}`);
      }
    } catch (error: any) {
      console.error('Failed to save job:', error);
      alert(error.response?.data?.error || 'Failed to save job');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const filteredCustomers = customersData?.customers?.filter((customer: any) => {
    if (!customerSearch) return true;
    const searchLower = customerSearch.toLowerCase();
    const name = (customer.displayName || customer.companyName || `${customer.firstName} ${customer.lastName}`).toLowerCase();
    return name.includes(searchLower) || customer.email?.toLowerCase().includes(searchLower);
  }) || [];

  const selectedCustomer = customersData?.customers?.find((c: any) => c.id === formData.customerId);
  const selectedCustomerName = selectedCustomer
    ? selectedCustomer.displayName || selectedCustomer.companyName || `${selectedCustomer.firstName} ${selectedCustomer.lastName}`
    : '';

  if (loadingJob && isEditing) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading job...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(isEditing ? `/jobs/${id}` : '/jobs')}
          className="mb-4"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Edit Job' : 'New Job'}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Customer Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer</h2>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Customer <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="Search customers..."
                value={formData.customerId ? selectedCustomerName : customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setFormData({ ...formData, customerId: '' });
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                disabled={isEditing}
              />
              
              {showCustomerDropdown && !formData.customerId && !isEditing && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer: any) => (
                      <div
                        key={customer.id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setFormData({ ...formData, customerId: customer.id });
                          setShowCustomerDropdown(false);
                          setCustomerSearch('');
                        }}
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {customer.displayName || customer.companyName || `${customer.firstName} ${customer.lastName}`}
                        </div>
                        {customer.email && (
                          <div className="text-xs text-gray-500">{customer.email}</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-sm text-gray-500">No customers found</div>
                  )}
                </div>
              )}

              {formData.customerId && (
                <div className="mt-3 p-3 bg-blue-50 rounded-md">
                  <div className="text-sm font-medium text-gray-900">{selectedCustomerName}</div>
                  {selectedCustomer?.email && (
                    <div className="text-xs text-gray-600">{selectedCustomer.email}</div>
                  )}
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, customerId: '' });
                        setCustomerSearch('');
                      }}
                      className="text-xs text-blue-600 hover:underline mt-1"
                    >
                      Change customer
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Watch Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Watch Information</h2>
            
            {!isEditing && (
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={createNewWatch}
                    onChange={(e) => setCreateNewWatch(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">Create new watch record</span>
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Brand <span className="text-red-500">*</span>
                </label>
                <Input
                  name="watchBrand"
                  value={formData.watchBrand}
                  onChange={handleChange}
                  placeholder="e.g., Rolex, Omega, etc."
                  required={createNewWatch}
                  disabled={isEditing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <Input
                  name="watchModel"
                  value={formData.watchModel}
                  onChange={handleChange}
                  placeholder="e.g., Submariner, Speedmaster"
                  disabled={isEditing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Serial Number
                </label>
                <Input
                  name="watchSerialNumber"
                  value={formData.watchSerialNumber}
                  onChange={handleChange}
                  disabled={isEditing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Number
                </label>
                <Input
                  name="watchReferenceNumber"
                  value={formData.watchReferenceNumber}
                  onChange={handleChange}
                  disabled={isEditing}
                />
              </div>
            </div>
          </div>

          {/* Job Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimate Number
                </label>
                <Input
                  name="estimateNumber"
                  value={formData.estimateNumber}
                  onChange={handleChange}
                  placeholder="EST-12345"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <Calendar size={16} className="mr-1" />
                  Due Date
                </label>
                <Input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Intake Notes
              </label>
              <textarea
                name="intakeNotes"
                value={formData.intakeNotes}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Initial assessment, customer requests, etc."
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condition Notes
              </label>
              <textarea
                name="conditionNotes"
                value={formData.conditionNotes}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Watch condition, damage, missing parts, etc."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(isEditing ? `/jobs/${id}` : '/jobs')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              <Save size={16} className="mr-2" />
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : isEditing
                ? 'Update Job'
                : 'Create Job'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

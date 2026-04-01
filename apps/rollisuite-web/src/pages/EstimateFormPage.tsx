import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEstimate, useCreateEstimate, useUpdateEstimate } from '../hooks/useEstimates';
import { useCustomers } from '../hooks/useCustomers';
import { ArrowLeft, Save, Plus, Trash2, Send } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  lineType: string;
  sortOrder: number;
}

const SERVICE_TYPES = [
  { value: '', label: 'Select Service Type' },
  { value: 'repair', label: 'Repair' },
  { value: 'restoration', label: 'Restoration' },
  { value: 'appraisal', label: 'Appraisal' },
  { value: 'consignment', label: 'Consignment' },
];

const LINE_TYPES = [
  { value: 'service', label: 'Service' },
  { value: 'part', label: 'Part' },
  { value: 'labor', label: 'Labor' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'discount', label: 'Discount' },
];

export default function EstimateFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = id && id !== 'new';
  const preselectedCustomerId = searchParams.get('customerId');

  const { data: existingEstimate, isLoading: loadingEstimate } = useEstimate(id!);
  const { data: customersData } = useCustomers({ perPage: 100 });
  const createMutation = useCreateEstimate();
  const updateMutation = useUpdateEstimate(id!);

  const [formData, setFormData] = useState({
    customerId: preselectedCustomerId || '',
    serviceType: '',
    notes: '',
    internalNotes: '',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      description: '',
      quantity: 1,
      unitPrice: 0,
      extendedPrice: 0,
      lineType: 'service',
      sortOrder: 0,
    },
  ]);

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Load existing estimate data
  useEffect(() => {
    if (existingEstimate) {
      setFormData({
        customerId: existingEstimate.customerId,
        serviceType: existingEstimate.serviceType || '',
        notes: existingEstimate.notes || '',
        internalNotes: existingEstimate.internalNotes || '',
      });

      if (existingEstimate.lineItems && existingEstimate.lineItems.length > 0) {
        setLineItems(
          existingEstimate.lineItems.map((item: any, index: number) => ({
            id: item.id,
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            extendedPrice: Number(item.extendedPrice),
            lineType: item.lineType,
            sortOrder: index,
          }))
        );
      }
    }
  }, [existingEstimate]);

  // Auto-calculate extended price
  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      updated[index].extendedPrice = updated[index].quantity * updated[index].unitPrice;
    }

    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        description: '',
        quantity: 1,
        unitPrice: 0,
        extendedPrice: 0,
        lineType: 'service',
        sortOrder: lineItems.length,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) {
      alert('Must have at least one line item');
      return;
    }
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.extendedPrice, 0);

  const handleSubmit = async (e: React.FormEvent, sendToCustomer = false) => {
    e.preventDefault();

    if (!formData.customerId) {
      alert('Please select a customer');
      return;
    }

    if (lineItems.some((item) => !item.description)) {
      alert('All line items must have a description');
      return;
    }

    const payload = {
      ...formData,
      lineItems: lineItems.map((item, index) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineType: item.lineType,
        sortOrder: index,
      })),
    };

    try {
      if (isEditing) {
        await updateMutation.mutateAsync(payload);
        navigate(`/estimates/${id}`);
      } else {
        const newEstimate = await createMutation.mutateAsync(payload);
        
        if (sendToCustomer) {
          // TODO: Open send email modal
          alert('Send email functionality coming soon!');
        }
        
        navigate(`/estimates/${newEstimate.id}`);
      }
    } catch (error: any) {
      console.error('Failed to save estimate:', error);
      alert(error.response?.data?.error || 'Failed to save estimate');
    }
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

  if (loadingEstimate && isEditing) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading estimate...</div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(isEditing ? `/estimates/${id}` : '/estimates')}
          className="mb-4"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Edit Estimate' : 'New Estimate'}
        </h1>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Customer & Details */}
          <div className="lg:col-span-1 space-y-6">
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
                />
                
                {showCustomerDropdown && !formData.customerId && (
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
                  </div>
                )}
              </div>
            </div>

            {/* Service Type & Notes */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service Type
                  </label>
                  <select
                    value={formData.serviceType}
                    onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    {SERVICE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Notes visible to customer..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Internal Notes
                  </label>
                  <textarea
                    value={formData.internalNotes}
                    onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Internal notes (not visible to customer)..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Line Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus size={16} className="mr-2" />
                  Add Line
                </Button>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  {lineItems.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-md p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-700">Line Item {index + 1}</h3>
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-6">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Description <span className="text-red-500">*</span>
                          </label>
                          <Input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                            placeholder="Service or part description"
                            required
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                          <select
                            value={item.lineType}
                            onChange={(e) => updateLineItem(index, 'lineType', e.target.value)}
                            className="w-full px-2 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                          >
                            {LINE_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Qty</label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Unit Price</label>
                          <Input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                          />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Total</label>
                          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-semibold text-gray-900">
                            ${item.extendedPrice.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-base text-gray-600">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                        <span>Total:</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(isEditing ? `/estimates/${id}` : '/estimates')}
                >
                  Cancel
                </Button>
                {!isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => handleSubmit(e, true)}
                    disabled={createMutation.isPending}
                  >
                    <Send size={16} className="mr-2" />
                    Save & Send
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  <Save size={16} className="mr-2" />
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : isEditing
                    ? 'Update Estimate'
                    : 'Save as Draft'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSalesOrder, useCreateSalesOrder, useUpdateSalesOrder } from '../hooks/useSalesOrders';
import { useCustomers } from '../hooks/useCustomers';
import { useJobs } from '../hooks/useJobs';
import { ArrowLeft, Save, Plus, Trash2, Calendar } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

interface LineItem {
  partId: string;
  qtyOrdered: number;
  qtyAllocated: number;
  qtyShipped: number;
  unitPrice: number;
  unitCost?: number;
  extendedPrice: number;
  notes?: string;
  sortOrder: number;
}

export default function SalesOrderFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = id && id !== 'new';
  const preselectedCustomerId = searchParams.get('customerId');
  const preselectedJobId = searchParams.get('jobId');

  const { data: existingSO, isLoading: loadingSO } = useSalesOrder(id!);
  const { data: customersData } = useCustomers({ perPage: 100 });
  const { data: jobsData } = useJobs({ customerId: preselectedCustomerId || undefined, perPage: 50 });
  const createMutation = useCreateSalesOrder();
  const updateMutation = useUpdateSalesOrder(id!);

  const [formData, setFormData] = useState({
    customerId: preselectedCustomerId || '',
    jobId: preselectedJobId || '',
    shipDate: '',
    shippingAmount: 0,
    notes: '',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      partId: '',
      qtyOrdered: 1,
      qtyAllocated: 0,
      qtyShipped: 0,
      unitPrice: 0,
      extendedPrice: 0,
      sortOrder: 0,
    },
  ]);

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Load existing sales order data
  useEffect(() => {
    if (existingSO) {
      setFormData({
        customerId: existingSO.customerId,
        jobId: existingSO.jobId || '',
        shipDate: existingSO.shipDate ? existingSO.shipDate.split('T')[0] : '',
        shippingAmount: Number(existingSO.shippingAmount) || 0,
        notes: existingSO.notes || '',
      });

      if (existingSO.lineItems && existingSO.lineItems.length > 0) {
        setLineItems(
          existingSO.lineItems.map((item: any, index: number) => ({
            partId: item.partId,
            qtyOrdered: Number(item.qtyOrdered),
            qtyAllocated: Number(item.qtyAllocated),
            qtyShipped: Number(item.qtyShipped),
            unitPrice: Number(item.unitPrice),
            unitCost: item.unitCost ? Number(item.unitCost) : undefined,
            extendedPrice: Number(item.extendedPrice),
            notes: item.notes || '',
            sortOrder: index,
          }))
        );
      }
    }
  }, [existingSO]);

  // Auto-calculate extended price
  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'qtyOrdered' || field === 'unitPrice') {
      updated[index].extendedPrice = updated[index].qtyOrdered * updated[index].unitPrice;
    }

    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        partId: '',
        qtyOrdered: 1,
        qtyAllocated: 0,
        qtyShipped: 0,
        unitPrice: 0,
        extendedPrice: 0,
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
  const totalAmount = subtotal + formData.shippingAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerId) {
      alert('Please select a customer');
      return;
    }

    if (lineItems.some((item) => !item.partId)) {
      alert('All line items must have a part ID');
      return;
    }

    const payload = {
      customerId: formData.customerId,
      jobId: formData.jobId || undefined,
      shipDate: formData.shipDate || undefined,
      notes: formData.notes || undefined,
      lineItems: lineItems.map((item, index) => ({
        partId: item.partId,
        qtyOrdered: item.qtyOrdered,
        qtyAllocated: item.qtyAllocated,
        qtyShipped: item.qtyShipped,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        notes: item.notes,
        sortOrder: index,
      })),
    };

    try {
      if (isEditing) {
        await updateMutation.mutateAsync(payload as any);
        navigate(`/sales-orders/${id}`);
      } else {
        const newSO = await createMutation.mutateAsync(payload);
        navigate(`/sales-orders/${newSO.id}`);
      }
    } catch (error: any) {
      console.error('Failed to save sales order:', error);
      alert(error.response?.data?.error || 'Failed to save sales order');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'shippingAmount' ? parseFloat(value) || 0 : value,
    }));
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

  const customerJobs = jobsData?.jobs?.filter((job: any) => job.customerId === formData.customerId) || [];

  if (loadingSO && isEditing) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading sales order...</div>
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
          onClick={() => navigate(isEditing ? `/sales-orders/${id}` : '/sales-orders')}
          className="mb-4"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Edit Sales Order' : 'New Sales Order'}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Customer & Job */}
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
                    setFormData({ ...formData, customerId: '', jobId: '' });
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
                          setFormData({ ...formData, customerId: '', jobId: '' });
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

            {/* Job Selection */}
            {formData.customerId && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Related Job (Optional)</h2>
                <select
                  name="jobId"
                  value={formData.jobId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No job selected</option>
                  {customerJobs.map((job: any) => (
                    <option key={job.id} value={job.id}>
                      {job.jobId} - {job.watch?.brand} {job.watch?.model}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Shipping & Notes */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping & Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    <Calendar size={16} className="mr-1" />
                    Ship Date
                  </label>
                  <Input
                    type="date"
                    name="shipDate"
                    value={formData.shipDate}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shipping Amount
                  </label>
                  <Input
                    type="number"
                    name="shippingAmount"
                    value={formData.shippingAmount}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                  />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Order notes, shipping instructions, etc."
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
                        <div className="col-span-4">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Part ID / Description <span className="text-red-500">*</span>
                          </label>
                          <Input
                            type="text"
                            value={item.partId}
                            onChange={(e) => updateLineItem(index, 'partId', e.target.value)}
                            placeholder="Part number or description"
                            required
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Ordered</label>
                          <Input
                            type="number"
                            value={item.qtyOrdered}
                            onChange={(e) => updateLineItem(index, 'qtyOrdered', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="1"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Allocated</label>
                          <Input
                            type="number"
                            value={item.qtyAllocated}
                            onChange={(e) => updateLineItem(index, 'qtyAllocated', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="1"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Shipped</label>
                          <Input
                            type="number"
                            value={item.qtyShipped}
                            onChange={(e) => updateLineItem(index, 'qtyShipped', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="1"
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

                        <div className="col-span-12">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Line Notes</label>
                          <Input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => updateLineItem(index, 'notes', e.target.value)}
                            placeholder="Optional notes for this line item"
                          />
                        </div>

                        <div className="col-span-12 flex justify-end">
                          <div className="text-sm font-semibold text-gray-900">
                            Line Total: {formatCurrency(item.extendedPrice)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <div className="flex justify-end">
                    <div className="w-80 space-y-2">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Shipping:</span>
                        <span>{formatCurrency(formData.shippingAmount)}</span>
                      </div>
                      <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                        <span>Total:</span>
                        <span>{formatCurrency(totalAmount)}</span>
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
                  onClick={() => navigate(isEditing ? `/sales-orders/${id}` : '/sales-orders')}
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
                    ? 'Update Sales Order'
                    : 'Create Sales Order'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSalesOrder, useSyncToQBO } from '../hooks/useSalesOrders';
import {
  ArrowLeft,
  ShoppingCart,
  User,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Edit,
  CheckCircle,
  XCircle,
  Package,
  Briefcase,
  Send,
  Shield,
} from 'lucide-react';
import { Button } from '../components/ui/button';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-800' },
  pending: { bg: 'bg-blue-100', text: 'text-blue-800' },
  fulfilled: { bg: 'bg-green-100', text: 'text-green-800' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800' },
  invoiced: { bg: 'bg-purple-100', text: 'text-purple-800' },
};

export default function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: salesOrder, isLoading } = useSalesOrder(id!);
  const syncMutation = useSyncToQBO(id!);

  const handleSyncToQBO = async () => {
    if (!confirm('Sync this sales order to QuickBooks Online as an invoice?')) return;
    
    try {
      await syncMutation.mutateAsync();
      alert('Successfully synced to QuickBooks!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to sync to QuickBooks');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading sales order...</div>
      </div>
    );
  }

  if (!salesOrder) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Sales order not found</h3>
        <Button onClick={() => navigate('/sales-orders')}>Back to Sales Orders</Button>
      </div>
    );
  }

  const statusConfig = STATUS_COLORS[salesOrder.status];

  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date?: string) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (date?: string) => {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const customerName =
    salesOrder.customer?.displayName ||
    salesOrder.customer?.companyName ||
    `${salesOrder.customer?.firstName || ''} ${salesOrder.customer?.lastName || ''}`.trim() ||
    'Unknown Customer';

  const subtotal = Number(salesOrder.subtotal) || 0;
  const shippingAmount = Number(salesOrder.shippingAmount) || 0;
  const totalAmount = Number(salesOrder.totalAmount) || 0;
  const balanceDue = Number(salesOrder.balanceDue) || 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/sales-orders')}
          className="mb-4"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Sales Orders
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{salesOrder.soNumber}</h1>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                {salesOrder.status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </span>
              {salesOrder.isPaid && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  <CheckCircle size={14} className="mr-1" />
                  Paid
                </span>
              )}
              {salesOrder.tcAgreed && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <Shield size={12} className="mr-1" />
                  T&C Accepted
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">
              Order Date: {formatDate(salesOrder.orderDate)}
              {salesOrder.shipDate && ` • Ship Date: ${formatDate(salesOrder.shipDate)}`}
            </p>
            {salesOrder.qboInvoiceId && (
              <p className="text-sm text-purple-600 mt-1">
                QuickBooks Invoice: {salesOrder.qboInvoiceId}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {!salesOrder.qboInvoiceId && salesOrder.status === 'fulfilled' && (
              <Button onClick={handleSyncToQBO} disabled={syncMutation.isPending}>
                <Send size={16} className="mr-2" />
                {syncMutation.isPending ? 'Syncing...' : 'Sync to QuickBooks'}
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate(`/sales-orders/${id}/edit`)}>
              <Edit size={16} className="mr-2" />
              Edit
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Info Cards */}
        <div className="lg:col-span-1 space-y-6">
          {/* Customer Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500">Customer</div>
                  <div
                    className="text-sm text-blue-600 hover:underline cursor-pointer"
                    onClick={() => navigate(`/customers/${salesOrder.customerId}`)}
                  >
                    {customerName}
                  </div>
                </div>
              </div>

              {salesOrder.customer?.email && (
                <div className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Email</div>
                    <a href={`mailto:${salesOrder.customer.email}`} className="text-sm text-blue-600 hover:underline">
                      {salesOrder.customer.email}
                    </a>
                  </div>
                </div>
              )}

              {salesOrder.customer?.phone && (
                <div className="flex items-start space-x-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Phone</div>
                    <a href={`tel:${salesOrder.customer.phone}`} className="text-sm text-blue-600 hover:underline">
                      {salesOrder.customer.phone}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Related Job */}
          {salesOrder.job && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Related Job</h2>
              <div className="flex items-start space-x-3">
                <Briefcase className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500">Job ID</div>
                  <div
                    className="text-sm text-blue-600 hover:underline cursor-pointer"
                    onClick={() => navigate(`/jobs/${salesOrder.jobId}`)}
                  >
                    {salesOrder.job.jobId}
                  </div>
                  {salesOrder.job.status && (
                    <div className="text-xs text-gray-500 mt-1 capitalize">
                      Status: {salesOrder.job.status.replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payment Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Status</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Status</span>
                {salesOrder.isPaid ? (
                  <span className="inline-flex items-center text-sm font-medium text-green-600">
                    <CheckCircle size={14} className="mr-1" />
                    Paid in Full
                  </span>
                ) : (
                  <span className="inline-flex items-center text-sm font-medium text-orange-600">
                    <XCircle size={14} className="mr-1" />
                    Unpaid
                  </span>
                )}
              </div>
              {balanceDue > 0 && (
                <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-900">Balance Due</span>
                  <span className="text-lg font-bold text-orange-600">
                    {formatCurrency(balanceDue)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* T&C Acceptance */}
          {salesOrder.tcAcceptances && salesOrder.tcAcceptances.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">T&C Acceptance</h2>
              <div className="space-y-3">
                {salesOrder.tcAcceptances.map((tc: any) => (
                  <div key={tc.id} className="text-sm">
                    <div className="flex items-center text-green-600 mb-1">
                      <CheckCircle size={14} className="mr-2" />
                      <span className="font-medium">Accepted</span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>Email: {tc.customerEmail}</div>
                      <div>Date: {formatDateTime(tc.acceptedAt)}</div>
                      <div>IP: {tc.ipAddress}</div>
                      <div>Version: {tc.tcVersion}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {salesOrder.notes && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{salesOrder.notes}</p>
            </div>
          )}
        </div>

        {/* Right Column - Line Items & Totals */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
            </div>

            <div className="p-6">
              {salesOrder.lineItems && salesOrder.lineItems.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Part</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ordered</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Allocated</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Shipped</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {salesOrder.lineItems.map((item: any, index: number) => (
                          <tr key={item.id || index}>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {item.part?.name || item.partId}
                              {item.notes && (
                                <div className="text-xs text-gray-500 mt-1">{item.notes}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-right">
                              {Number(item.qtyOrdered)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-right">
                              <div className="flex items-center justify-end">
                                {Number(item.qtyAllocated) > 0 && (
                                  <Package size={14} className="mr-1 text-blue-500" />
                                )}
                                {Number(item.qtyAllocated)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-right">
                              <div className="flex items-center justify-end">
                                {Number(item.qtyShipped) > 0 && (
                                  <CheckCircle size={14} className="mr-1 text-green-500" />
                                )}
                                {Number(item.qtyShipped)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-right">
                              {formatCurrency(Number(item.unitPrice))}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                              {formatCurrency(Number(item.extendedPrice))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="mt-6 border-t border-gray-200 pt-4">
                    <div className="flex justify-end">
                      <div className="w-80 space-y-2">
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(subtotal)}</span>
                        </div>
                        {shippingAmount > 0 && (
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>Shipping:</span>
                            <span>{formatCurrency(shippingAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                          <span>Total:</span>
                          <span className="flex items-center">
                            <DollarSign size={20} className="mr-1" />
                            {formatCurrency(totalAmount)}
                          </span>
                        </div>
                        {balanceDue > 0 && (
                          <div className="flex justify-between text-lg font-semibold text-orange-600 pt-2">
                            <span>Balance Due:</span>
                            <span>{formatCurrency(balanceDue)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">No line items</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

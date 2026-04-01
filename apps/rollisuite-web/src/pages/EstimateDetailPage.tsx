import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEstimate, useConvertEstimate } from '../hooks/useEstimates';
import {
  ArrowLeft,
  FileText,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../components/ui/button';

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: any }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-800', icon: FileText },
  sent: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Send },
  approved: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  converted: { bg: 'bg-purple-100', text: 'text-purple-800', icon: ArrowRight },
  declined: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
  expired: { bg: 'bg-orange-100', text: 'text-orange-800', icon: Calendar },
  on_hold: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: FileText },
};

export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: estimate, isLoading } = useEstimate(id!);
  const convertMutation = useConvertEstimate(id!);

  const handleConvertToSalesOrder = async () => {
    if (!confirm('Convert this estimate to a sales order?')) return;
    
    try {
      const salesOrder = await convertMutation.mutateAsync();
      alert('Estimate converted successfully!');
      navigate(`/sales-orders/${salesOrder.id}`);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to convert estimate');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading estimate...</div>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Estimate not found</h3>
        <Button onClick={() => navigate('/estimates')}>Back to Estimates</Button>
      </div>
    );
  }

  const statusConfig = STATUS_COLORS[estimate.status];
  const StatusIcon = statusConfig.icon;
  const subtotal = Number(estimate.totalAmount) || 0;

  const formatCurrency = (amount: number) => {
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

  const customerName =
    estimate.customer?.displayName ||
    estimate.customer?.companyName ||
    `${estimate.customer?.firstName || ''} ${estimate.customer?.lastName || ''}`.trim() ||
    'Unknown Customer';

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/estimates')}
          className="mb-4"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Estimates
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{estimate.estimateNumber}</h1>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                <StatusIcon size={14} className="mr-1.5" />
                {estimate.status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Created {formatDate(estimate.createdAt)}
              {estimate.sentAt && ` • Sent ${formatDate(estimate.sentAt)}`}
              {estimate.approvedAt && ` • Approved ${formatDate(estimate.approvedAt)}`}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {estimate.status === 'approved' && (
              <Button onClick={handleConvertToSalesOrder} disabled={convertMutation.isPending}>
                <ArrowRight size={16} className="mr-2" />
                {convertMutation.isPending ? 'Converting...' : 'Convert to Sales Order'}
              </Button>
            )}
            {estimate.status === 'draft' && (
              <Button variant="outline">
                <Send size={16} className="mr-2" />
                Send to Customer
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate(`/estimates/${id}/edit`)}>
              <Edit size={16} className="mr-2" />
              Edit
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Information */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500">Customer</div>
                  <div
                    className="text-sm text-blue-600 hover:underline cursor-pointer"
                    onClick={() => navigate(`/customers/${estimate.customerId}`)}
                  >
                    {customerName}
                  </div>
                </div>
              </div>

              {estimate.customer?.email && (
                <div className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Email</div>
                    <a href={`mailto:${estimate.customer.email}`} className="text-sm text-blue-600 hover:underline">
                      {estimate.customer.email}
                    </a>
                  </div>
                </div>
              )}

              {estimate.customer?.phone && (
                <div className="flex items-start space-x-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Phone</div>
                    <a href={`tel:${estimate.customer.phone}`} className="text-sm text-blue-600 hover:underline">
                      {estimate.customer.phone}
                    </a>
                  </div>
                </div>
              )}

              {(estimate.customer?.address || estimate.customer?.city) && (
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Address</div>
                    <div className="text-sm text-gray-900">
                      {estimate.customer.address && <div>{estimate.customer.address}</div>}
                      {(estimate.customer.city || estimate.customer.state || estimate.customer.zip) && (
                        <div>
                          {estimate.customer.city}
                          {estimate.customer.city && estimate.customer.state && ', '}
                          {estimate.customer.state} {estimate.customer.zip}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {estimate.notes && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Customer Notes</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{estimate.notes}</p>
              </div>
            )}

            {estimate.internalNotes && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Internal Notes</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{estimate.internalNotes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Line Items & Totals */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
            </div>

            <div className="p-6">
              {estimate.lineItems && estimate.lineItems.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {estimate.lineItems.map((item: any, index: number) => (
                          <tr key={item.id || index}>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-right">{Number(item.quantity)}</td>
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
                      <div className="w-64 space-y-2">
                        <div className="flex justify-between text-lg font-semibold text-gray-900">
                          <span>Total:</span>
                          <span className="flex items-center">
                            <DollarSign size={18} className="mr-1" />
                            {formatCurrency(subtotal)}
                          </span>
                        </div>
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

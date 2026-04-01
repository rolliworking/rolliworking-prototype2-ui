import React, { useState } from 'react';
import { useSalesOrders } from '../hooks/useSalesOrders';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ShoppingCart, DollarSign, Calendar, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'invoiced', label: 'Invoiced' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending: 'bg-blue-100 text-blue-800',
  fulfilled: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  invoiced: 'bg-purple-100 text-purple-800',
};

export default function SalesOrdersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const { data, isLoading } = useSalesOrders({ search, status: statusFilter || undefined, page, perPage });

  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Orders</h1>
          <p className="text-sm text-gray-600 mt-1">
            {data?.total || 0} total sales orders
          </p>
        </div>
        <Button onClick={() => navigate('/sales-orders/new')} className="flex items-center space-x-2">
          <Plus size={16} />
          <span>New Sales Order</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <Input
              type="text"
              placeholder="Search by SO number, customer, or job..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
          <div className="w-64">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sales Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-600">Loading sales orders...</div>
        ) : data && data.salesOrders.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SO Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.salesOrders.map((order: any) => (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`/sales-orders/${order.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <ShoppingCart className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {order.soNumber}
                            </div>
                            {order.qboInvoiceId && (
                              <div className="text-xs text-purple-600">
                                QBO: {order.qboInvoiceId}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {order.customer?.displayName || 
                           order.customer?.companyName || 
                           `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() ||
                           'Unknown Customer'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {order.job ? (
                          <div className="text-sm text-blue-600 hover:underline">
                            {order.job.jobId}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm font-semibold text-gray-900">
                          <DollarSign size={14} className="mr-1" />
                          {formatCurrency(Number(order.totalAmount))}
                        </div>
                        {order.balanceDue && Number(order.balanceDue) > 0 && (
                          <div className="text-xs text-orange-600">
                            Due: {formatCurrency(Number(order.balanceDue))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {order.isPaid ? (
                          <span className="inline-flex items-center text-sm text-green-600">
                            <CheckCircle size={14} className="mr-1" />
                            Paid
                          </span>
                        ) : (
                          <span className="text-sm text-orange-600">Unpaid</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center">
                          <Calendar size={14} className="mr-2" />
                          {formatDate(order.orderDate)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(page - 1) * perPage + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(page * perPage, data.total)}</span> of{' '}
                    <span className="font-medium">{data.total}</span> sales orders
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                      disabled={page === data.totalPages}
                    >
                      Next
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-8 h-8 text-gray-400" />
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No sales orders found</h3>
            <p className="text-sm text-gray-600 mb-4">
              {search || statusFilter ? 'Try adjusting your filters' : 'Get started by creating your first sales order'}
            </p>
            {!search && !statusFilter && (
              <Button onClick={() => navigate('/sales-orders/new')}>
                <Plus size={16} className="mr-2" />
                Create Sales Order
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCustomer } from '../hooks/useCustomers';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building2,
  FileText,
  Briefcase,
  ShoppingCart,
  Edit,
  Calendar,
} from 'lucide-react';
import { Button } from '../components/ui/button';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCustomer(id!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading customer...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Customer not found</h3>
        <Button onClick={() => navigate('/customers')}>Back to Customers</Button>
      </div>
    );
  }

  const displayName =
    customer.displayName ||
    customer.companyName ||
    `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
    'No Name';

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/customers')}
          className="mb-4"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Customers
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0 h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
              {customer.companyName ? (
                <Building2 className="h-8 w-8 text-blue-600" />
              ) : (
                <span className="text-2xl font-semibold text-blue-600">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
              {customer.companyName && customer.displayName && (
                <p className="text-sm text-gray-600">{customer.companyName}</p>
              )}
              <div className="flex items-center space-x-4 mt-2">
                {customer.isShipDirect && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Ship Direct
                  </span>
                )}
                {customer.isTradePricing && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Trade Pricing
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button onClick={() => navigate(`/customers/${id}/edit`)}>
            <Edit size={16} className="mr-2" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Information */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="space-y-4">
              {customer.email && (
                <div className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Email</div>
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {customer.email}
                    </a>
                  </div>
                </div>
              )}

              {customer.phone && (
                <div className="flex items-start space-x-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Phone</div>
                    <a
                      href={`tel:${customer.phone}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {customer.phone}
                    </a>
                  </div>
                </div>
              )}

              {(customer.address || customer.city || customer.state || customer.zip) && (
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Address</div>
                    <div className="text-sm text-gray-900">
                      {customer.address && <div>{customer.address}</div>}
                      {(customer.city || customer.state || customer.zip) && (
                        <div>
                          {customer.city}
                          {customer.city && customer.state && ', '}
                          {customer.state} {customer.zip}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {customer.qboCustomerId && (
                <div className="flex items-start space-x-3">
                  <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">QuickBooks ID</div>
                    <div className="text-sm text-gray-900 font-mono">{customer.qboCustomerId}</div>
                  </div>
                </div>
              )}

              <div className="flex items-start space-x-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500">Customer Since</div>
                  <div className="text-sm text-gray-900">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            {customer.notes && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Notes</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="space-y-6">
            {/* Recent Estimates */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Recent Estimates</h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/estimates/new?customerId=${id}`)}
                >
                  New Estimate
                </Button>
              </div>
              <div className="p-6">
                {customer.estimates && customer.estimates.length > 0 ? (
                  <div className="space-y-3">
                    {customer.estimates.slice(0, 5).map((estimate: any) => (
                      <div
                        key={estimate.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer transition-colors"
                        onClick={() => navigate(`/estimates/${estimate.id}`)}
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {estimate.estimateNumber}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(estimate.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          ${estimate.total?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No estimates yet</p>
                )}
              </div>
            </div>

            {/* Recent Jobs */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Briefcase className="w-5 h-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/jobs/new?customerId=${id}`)}
                >
                  New Job
                </Button>
              </div>
              <div className="p-6">
                {customer.jobs && customer.jobs.length > 0 ? (
                  <div className="space-y-3">
                    {customer.jobs.slice(0, 5).map((job: any) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer transition-colors"
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900">{job.jobId}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(job.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            job.status === 'closed'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No jobs yet</p>
                )}
              </div>
            </div>

            {/* Recent Sales Orders */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShoppingCart className="w-5 h-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Recent Sales Orders</h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/sales-orders/new?customerId=${id}`)}
                >
                  New Order
                </Button>
              </div>
              <div className="p-6">
                {customer.salesOrders && customer.salesOrders.length > 0 ? (
                  <div className="space-y-3">
                    {customer.salesOrders.slice(0, 5).map((order: any) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer transition-colors"
                        onClick={() => navigate(`/sales-orders/${order.id}`)}
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {order.orderNumber}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          ${order.total?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No sales orders yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

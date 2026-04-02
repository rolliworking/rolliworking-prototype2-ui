import { useDashboard } from '../hooks/useReports';
import {
  Users,
  Briefcase,
  ShoppingCart,
  DollarSign,
  FileText,
  Clock,
  Package as PackageIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  intake: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-blue-100 text-blue-800',
  awaiting_customer_approval: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  in_service: 'bg-orange-100 text-orange-800',
  testing: 'bg-indigo-100 text-indigo-800',
  ready_to_ship: 'bg-teal-100 text-teal-800',
  closed: 'bg-gray-100 text-gray-800',
};

export default function ReportsPage() {
  const { data, isLoading } = useDashboard();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const GrowthIndicator = ({ growth }: { growth: number }) => {
    if (growth > 0) {
      return (
        <div className="flex items-center text-green-600 text-sm">
          <TrendingUp size={16} className="mr-1" />
          <span>+{growth}%</span>
        </div>
      );
    } else if (growth < 0) {
      return (
        <div className="flex items-center text-red-600 text-sm">
          <TrendingDown size={16} className="mr-1" />
          <span>{growth}%</span>
        </div>
      );
    }
    return (
      <div className="flex items-center text-gray-500 text-sm">
        <Minus size={16} className="mr-1" />
        <span>0%</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">
          Business overview and key performance metrics
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Customers */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="text-blue-600" size={24} />
            </div>
            <GrowthIndicator growth={data.overview.customers.growth} />
          </div>
          <h3 className="text-sm text-gray-600 mb-1">Total Customers</h3>
          <p className="text-3xl font-bold text-gray-900">
            {data.overview.customers.total}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            +{data.overview.customers.newThisMonth} this month
          </p>
        </div>

        {/* Jobs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Briefcase className="text-purple-600" size={24} />
            </div>
            <GrowthIndicator growth={data.overview.jobs.growth} />
          </div>
          <h3 className="text-sm text-gray-600 mb-1">Active Jobs</h3>
          <p className="text-3xl font-bold text-gray-900">
            {data.overview.jobs.active}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {data.overview.jobs.total} total jobs
          </p>
        </div>

        {/* Sales Orders */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <ShoppingCart className="text-green-600" size={24} />
            </div>
            <GrowthIndicator growth={data.overview.sales.growth} />
          </div>
          <h3 className="text-sm text-gray-600 mb-1">Sales This Month</h3>
          <p className="text-3xl font-bold text-gray-900">
            {data.overview.sales.thisMonth}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {data.overview.sales.total} total orders
          </p>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <DollarSign className="text-orange-600" size={24} />
            </div>
            <GrowthIndicator growth={data.overview.revenue.growth} />
          </div>
          <h3 className="text-sm text-gray-600 mb-1">Revenue This Month</h3>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(data.overview.revenue.thisMonth)}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {formatCurrency(data.overview.revenue.lastMonth)} last month
          </p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* Estimates */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-indigo-100 rounded-lg mr-3">
              <FileText className="text-indigo-600" size={20} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Estimates</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total</span>
              <span className="text-sm font-semibold text-gray-900">
                {data.overview.estimates.total}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Pending</span>
              <span className="text-sm font-semibold text-yellow-600">
                {data.overview.estimates.pending}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Conversion Rate</span>
              <span className="text-sm font-semibold text-green-600">
                {data.overview.estimates.conversionRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Waitlist */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-yellow-100 rounded-lg mr-3">
              <Clock className="text-yellow-600" size={20} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Waitlist</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total</span>
              <span className="text-sm font-semibold text-gray-900">
                {data.overview.waitlist.total}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Waiting</span>
              <span className="text-sm font-semibold text-yellow-600">
                {data.overview.waitlist.waiting}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Conversion Rate</span>
              <span className="text-sm font-semibold text-green-600">
                {data.overview.waitlist.conversionRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-teal-100 rounded-lg mr-3">
              <PackageIcon className="text-teal-600" size={20} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Inventory</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Watches</span>
              <span className="text-sm font-semibold text-gray-900">
                {data.overview.inventory.watches}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Parts</span>
              <span className="text-sm font-semibold text-gray-900">
                {data.overview.inventory.parts}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Jobs</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {data.recentActivity.jobs.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No recent jobs</div>
            ) : (
              data.recentActivity.jobs.map((job) => (
                <div key={job.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900">
                          {job.jobId}
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            statusColors[job.status] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {job.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{job.customerName}</p>
                    </div>
                    <div className="text-xs text-gray-500 ml-4">
                      {formatDate(job.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Sales Orders */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Sales</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {data.recentActivity.salesOrders.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No recent sales</div>
            ) : (
              data.recentActivity.salesOrders.map((order) => (
                <div key={order.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900 mb-1">
                        {order.orderNumber}
                      </div>
                      <p className="text-sm text-gray-600">{order.customerName}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-semibold text-green-600">
                        {formatCurrency(Number(order.totalAmount))}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(order.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

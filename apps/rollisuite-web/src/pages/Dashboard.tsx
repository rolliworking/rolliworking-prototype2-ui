import React from 'react';
import { useDashboardStats, useDailyHitList } from '../hooks/useDashboard';
import { Briefcase, FileText, ShoppingCart, AlertCircle, Calendar } from 'lucide-react';

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: hitList, isLoading: hitListLoading } = useDailyHitList();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">Welcome to RolliSuite</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Active Jobs"
          value={stats?.activeJobs}
          icon={<Briefcase className="w-6 h-6" />}
          loading={statsLoading}
          color="blue"
        />
        <StatCard
          title="Pending Estimates"
          value={stats?.pendingEstimates}
          icon={<FileText className="w-6 h-6" />}
          loading={statsLoading}
          color="yellow"
        />
        <StatCard
          title="Open Sales Orders"
          value={stats?.openSalesOrders}
          icon={<ShoppingCart className="w-6 h-6" />}
          loading={statsLoading}
          color="green"
        />
      </div>

      {/* Daily Hit List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">Daily Hit List</h2>
            {hitList?.generatedAt && (
              <span className="text-xs text-gray-500">
                Updated: {new Date(hitList.generatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        <div className="p-6">
          {hitListLoading ? (
            <div className="text-center py-8 text-gray-600">Loading...</div>
          ) : hitList && hitList.items.length > 0 ? (
            <div className="space-y-3">
              {/* Metadata Summary */}
              <div className="flex items-center space-x-4 text-sm mb-4">
                <span className="text-gray-600">
                  Total: <span className="font-semibold">{hitList.metadata.totalJobs}</span>
                </span>
                <span className="text-red-600">
                  Urgent: <span className="font-semibold">{hitList.metadata.urgentCount}</span>
                </span>
                <span className="text-orange-600">
                  Overdue: <span className="font-semibold">{hitList.metadata.overdueCount}</span>
                </span>
              </div>

              {/* Hit List Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Job ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estimate #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {hitList.items.map((item: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <PriorityBadge priority={item.priority} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.jobId}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {item.estimateNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.reason}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {item.dueDate ? (
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(item.dueDate).toLocaleDateString()}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            // Empty State
            <div className="text-center py-12">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-gray-400" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No items on today's hit list</h3>
              <p className="text-sm text-gray-600">
                The daily hit list is automatically generated from RolliWorking webhooks.
              </p>
              <p className="text-sm text-gray-600 mt-1">
                When priority jobs are synced, they will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  loading,
  color,
}: {
  title: string;
  value?: number;
  icon: React.ReactNode;
  loading: boolean;
  color: 'blue' | 'yellow' | 'green';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    green: 'bg-green-50 text-green-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          {loading ? (
            <div className="mt-2 h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
          ) : (
            <p className="mt-2 text-3xl font-bold text-gray-900">{value ?? 0}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const priorityConfig: Record<string, { label: string; className: string }> = {
    urgent: { label: 'Urgent', className: 'bg-red-100 text-red-800' },
    high: { label: 'High', className: 'bg-orange-100 text-orange-800' },
    normal: { label: 'Normal', className: 'bg-blue-100 text-blue-800' },
    low: { label: 'Low', className: 'bg-gray-100 text-gray-800' },
  };

  const config = priorityConfig[priority.toLowerCase()] || priorityConfig.normal;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

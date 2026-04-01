import React, { useState } from 'react';
import { useJobs } from '../hooks/useJobs';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Briefcase, AlertCircle, Clock, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'intake', label: 'Intake' },
  { value: 'in_review', label: 'In Review' },
  { value: 'awaiting_customer_approval', label: 'Awaiting Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_service', label: 'In Service' },
  { value: 'testing', label: 'Testing' },
  { value: 'ready_to_ship', label: 'Ready to Ship' },
  { value: 'closed', label: 'Closed' },
];

const STATUS_COLORS: Record<string, string> = {
  intake: 'bg-gray-100 text-gray-800',
  in_review: 'bg-blue-100 text-blue-800',
  awaiting_customer_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  in_service: 'bg-purple-100 text-purple-800',
  testing: 'bg-orange-100 text-orange-800',
  ready_to_ship: 'bg-teal-100 text-teal-800',
  closed: 'bg-gray-100 text-gray-800',
};

const PRIORITY_COLORS: Record<string, { bg: string; icon: string }> = {
  low: { bg: 'bg-gray-100 text-gray-600', icon: '🔵' },
  normal: { bg: 'bg-blue-100 text-blue-800', icon: '🟢' },
  high: { bg: 'bg-orange-100 text-orange-800', icon: '🟠' },
  urgent: { bg: 'bg-red-100 text-red-800', icon: '🔴' },
};

export default function JobsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const { data, isLoading } = useJobs({ search, status: statusFilter || undefined, page, perPage });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-600 mt-1">
            {data?.total || 0} total jobs
          </p>
        </div>
        <Button onClick={() => navigate('/jobs/new')} className="flex items-center space-x-2">
          <Plus size={16} />
          <span>New Job</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <Input
              type="text"
              placeholder="Search by job ID, estimate number, or customer..."
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

      {/* Jobs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-600">Loading jobs...</div>
        ) : data && data.jobs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Watch
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.jobs.map((job: any) => (
                    <tr
                      key={job.id}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Briefcase className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {job.jobId}
                            </div>
                            {job.estimateNumber && (
                              <div className="text-xs text-gray-500">
                                Est: {job.estimateNumber}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {job.customer?.displayName || 
                           job.customer?.companyName || 
                           `${job.customer?.firstName || ''} ${job.customer?.lastName || ''}`.trim() ||
                           'Unknown Customer'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {job.watch?.brand || 'N/A'}
                        </div>
                        {job.watch?.model && (
                          <div className="text-xs text-gray-500">
                            {job.watch.model}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[job.priority].bg}`}>
                          <span className="mr-1">{PRIORITY_COLORS[job.priority].icon}</span>
                          {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[job.status]}`}>
                          {getStatusLabel(job.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {job.assignee ? (
                          <div className="flex items-center text-sm text-gray-900">
                            <User size={14} className="mr-2" />
                            {job.assignee.firstName} {job.assignee.lastName}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {job.dueDate ? (
                          <div className={`flex items-center text-sm ${isOverdue(job.dueDate) ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                            {isOverdue(job.dueDate) && <AlertCircle size={14} className="mr-1" />}
                            <Clock size={14} className="mr-1" />
                            {formatDate(job.dueDate)}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
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
                    <span className="font-medium">{data.total}</span> jobs
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
                <Briefcase className="w-8 h-8 text-gray-400" />
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
            <p className="text-sm text-gray-600 mb-4">
              {search || statusFilter ? 'Try adjusting your filters' : 'Get started by creating your first job'}
            </p>
            {!search && !statusFilter && (
              <Button onClick={() => navigate('/jobs/new')}>
                <Plus size={16} className="mr-2" />
                Create Job
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useJob, useUpdateJob } from '../hooks/useJobs';
import {
  ArrowLeft,
  Briefcase,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit,
  Watch,
  Clock,
  Activity,
  TestTube,
  Gauge,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { Button } from '../components/ui/button';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  intake: { bg: 'bg-gray-100', text: 'text-gray-800' },
  in_review: { bg: 'bg-blue-100', text: 'text-blue-800' },
  awaiting_customer_approval: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  approved: { bg: 'bg-green-100', text: 'text-green-800' },
  in_service: { bg: 'bg-purple-100', text: 'text-purple-800' },
  testing: { bg: 'bg-orange-100', text: 'text-orange-800' },
  ready_to_ship: { bg: 'bg-teal-100', text: 'text-teal-800' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading } = useJob(id!);
  const updateMutation = useUpdateJob(id!);

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`Change job status to ${newStatus.replace(/_/g, ' ')}?`)) return;
    
    try {
      await updateMutation.mutateAsync({ status: newStatus as any });
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading job...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Job not found</h3>
        <Button onClick={() => navigate('/jobs')}>Back to Jobs</Button>
      </div>
    );
  }

  const statusConfig = STATUS_COLORS[job.status];
  const priorityConfig = PRIORITY_COLORS[job.priority];

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
    job.customer?.displayName ||
    job.customer?.companyName ||
    `${job.customer?.firstName || ''} ${job.customer?.lastName || ''}`.trim() ||
    'Unknown Customer';

  const isOverdue = job.dueDate && new Date(job.dueDate) < new Date();

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/jobs')}
          className="mb-4"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Jobs
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{job.jobId}</h1>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                {job.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityConfig}`}>
                {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)} Priority
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Created {formatDate(job.createdAt)}
              {job.estimateNumber && ` • From Estimate ${job.estimateNumber}`}
            </p>
            {job.dueDate && (
              <div className={`flex items-center mt-2 text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                {isOverdue && <AlertCircle size={14} className="mr-1" />}
                <Clock size={14} className="mr-1" />
                Due: {formatDate(job.dueDate)}
                {isOverdue && ' (OVERDUE)'}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={() => navigate(`/jobs/${id}/edit`)}>
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
                    onClick={() => navigate(`/customers/${job.customerId}`)}
                  >
                    {customerName}
                  </div>
                </div>
              </div>

              {job.customer?.email && (
                <div className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Email</div>
                    <a href={`mailto:${job.customer.email}`} className="text-sm text-blue-600 hover:underline">
                      {job.customer.email}
                    </a>
                  </div>
                </div>
              )}

              {job.customer?.phone && (
                <div className="flex items-start space-x-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Phone</div>
                    <a href={`tel:${job.customer.phone}`} className="text-sm text-blue-600 hover:underline">
                      {job.customer.phone}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Watch Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Watch Details</h2>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Watch className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500">Brand & Model</div>
                  <div className="text-sm font-medium text-gray-900">
                    {job.watch?.brand || 'N/A'}
                  </div>
                  {job.watch?.model && (
                    <div className="text-sm text-gray-600">{job.watch.model}</div>
                  )}
                </div>
              </div>

              {job.watch?.serialNumber && (
                <div>
                  <div className="text-xs text-gray-500">Serial Number</div>
                  <div className="text-sm text-gray-900 font-mono">{job.watch.serialNumber}</div>
                </div>
              )}

              {job.watch?.referenceNumber && (
                <div>
                  <div className="text-xs text-gray-500">Reference Number</div>
                  <div className="text-sm text-gray-900">{job.watch.referenceNumber}</div>
                </div>
              )}
            </div>
          </div>

          {/* Assignment */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Assignment</h2>
            {job.assignee ? (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {job.assignee.firstName} {job.assignee.lastName}
                  </div>
                  <div className="text-xs text-gray-500">Watchmaker</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-3">No watchmaker assigned</p>
                <Button size="sm" variant="outline">
                  Assign Watchmaker
                </Button>
              </div>
            )}
          </div>

          {/* Notes */}
          {(job.intakeNotes || job.conditionNotes) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
              {job.intakeNotes && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Intake Notes</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{job.intakeNotes}</p>
                </div>
              )}
              {job.conditionNotes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Condition Notes</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{job.conditionNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Activity & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status History */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Status Timeline</h2>
            </div>
            <div className="p-6">
              {job.statusHistory && job.statusHistory.length > 0 ? (
                <div className="space-y-4">
                  {job.statusHistory.map((history: any, index: number) => (
                    <div key={history.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Activity className="w-4 h-4 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          <span className="font-medium text-gray-900">
                            Status changed to{' '}
                            <span className="font-semibold">
                              {history.toStatus.replace(/_/g, ' ')}
                            </span>
                          </span>
                          {history.fromStatus && (
                            <span className="text-gray-500">
                              {' '}
                              from {history.fromStatus.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDateTime(history.createdAt)}
                        </div>
                        {history.notes && (
                          <div className="text-sm text-gray-600 mt-1 italic">
                            "{history.notes}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No status changes yet</p>
              )}
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Activity Log</h2>
            </div>
            <div className="p-6">
              {job.activityLog && job.activityLog.length > 0 ? (
                <div className="space-y-3">
                  {job.activityLog.map((log: any) => (
                    <div key={log.id} className="flex items-start space-x-3 text-sm">
                      <Activity className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{log.action}</span>
                        {log.details && <span className="text-gray-600"> - {log.details}</span>}
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatDateTime(log.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No activity recorded</p>
              )}
            </div>
          </div>

          {/* Test Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Timing Tests */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center space-x-2">
                <Clock className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Timing Tests</h2>
              </div>
              <div className="p-6">
                {job.timingTests && job.timingTests.length > 0 ? (
                  <div className="space-y-4">
                    {job.timingTests.map((test: any) => (
                      <div key={test.id} className="border-l-4 border-blue-500 pl-3">
                        <div className="text-sm font-medium text-gray-900">
                          Position: {test.position}
                        </div>
                        <div className="text-xs text-gray-600 space-y-1 mt-1">
                          <div>Rate: {test.rate} s/d</div>
                          <div>Beat Error: {test.beatError} ms</div>
                          <div>Amplitude: {test.amplitude}°</div>
                          <div className="text-gray-500">{formatDateTime(test.performedAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No timing tests</p>
                )}
              </div>
            </div>

            {/* Pressure Tests */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center space-x-2">
                <Gauge className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Pressure Tests</h2>
              </div>
              <div className="p-6">
                {job.pressureTests && job.pressureTests.length > 0 ? (
                  <div className="space-y-4">
                    {job.pressureTests.map((test: any) => (
                      <div key={test.id} className="border-l-4 border-green-500 pl-3">
                        <div className="flex items-center space-x-2">
                          {test.result === 'pass' ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span className={`text-sm font-medium ${test.result === 'pass' ? 'text-green-700' : 'text-red-700'}`}>
                            {test.result.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          <div>Pressure: {test.pressure} ATM</div>
                          <div className="text-gray-500">{formatDateTime(test.performedAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No pressure tests</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

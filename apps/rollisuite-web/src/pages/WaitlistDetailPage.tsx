import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  useWaitlistEntry,
  useDeleteWaitlistEntry,
  useContactWaitlistEntry,
  useUpdateWaitlistEntry,
} from '../hooks/useWaitlist';
import { Button } from '../components/ui/button';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Mail,
  Phone,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  User,
  Package,
  FileText,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { useState } from 'react';

const priorityColors = {
  low: 'bg-gray-100 text-gray-800',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const statusColors = {
  waiting: 'bg-yellow-100 text-yellow-800',
  contacted: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-purple-100 text-purple-800',
  converted: 'bg-green-100 text-green-800',
  declined: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function WaitlistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: entry, isLoading } = useWaitlistEntry(id!);
  const deleteMutation = useDeleteWaitlistEntry();
  const contactMutation = useContactWaitlistEntry();
  const updateMutation = useUpdateWaitlistEntry();

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id!);
      navigate('/waitlist');
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleMarkContacted = async () => {
    try {
      await contactMutation.mutateAsync(id!);
    } catch (error) {
      console.error('Failed to mark as contacted:', error);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateMutation.mutateAsync({ id: id!, status: newStatus as any });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="p-6">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Entry Not Found</h2>
          <p className="text-gray-600 mb-4">The waitlist entry you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/waitlist')}>Back to Waitlist</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/waitlist')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Waitlist
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {entry.firstName} {entry.lastName}
            </h1>
            <div className="flex items-center space-x-3 mt-2">
              <span
                className={`inline-flex px-3 py-1 rounded-full text-sm font-medium capitalize ${
                  statusColors[entry.status]
                }`}
              >
                {entry.status}
              </span>
              <span
                className={`inline-flex px-3 py-1 rounded-full text-sm font-medium capitalize ${
                  priorityColors[entry.priority]
                }`}
              >
                {entry.priority === 'urgent' && <AlertCircle size={14} className="mr-1" />}
                {entry.priority} Priority
              </span>
            </div>
          </div>
          <div className="flex space-x-2">
            {entry.status === 'waiting' && (
              <Button
                onClick={handleMarkContacted}
                disabled={contactMutation.isPending}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <CheckCircle size={16} />
                <span>Mark Contacted</span>
              </Button>
            )}
            <Link to={`/waitlist/${id}/edit`}>
              <Button variant="outline" className="flex items-center space-x-2">
                <Edit size={16} />
                <span>Edit</span>
              </Button>
            </Link>
            <Button
              onClick={() => setShowDeleteConfirm(true)}
              variant="outline"
              className="flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User size={20} className="mr-2" />
              Customer Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500 mb-1">Name</div>
                <div className="text-gray-900">
                  {entry.firstName} {entry.lastName}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Email</div>
                <div className="text-gray-900 flex items-center">
                  <Mail size={14} className="mr-2 text-gray-400" />
                  <a href={`mailto:${entry.email}`} className="text-blue-600 hover:underline">
                    {entry.email}
                  </a>
                </div>
              </div>
              {entry.phone && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Phone</div>
                  <div className="text-gray-900 flex items-center">
                    <Phone size={14} className="mr-2 text-gray-400" />
                    <a href={`tel:${entry.phone}`} className="text-blue-600 hover:underline">
                      {entry.phone}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Watch Information */}
          {(entry.brand || entry.model) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Clock size={20} className="mr-2" />
                Watch Information
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {entry.brand && (
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Brand</div>
                    <div className="text-gray-900 font-medium">{entry.brand}</div>
                  </div>
                )}
                {entry.model && (
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Model</div>
                    <div className="text-gray-900">{entry.model}</div>
                  </div>
                )}
                {entry.serviceType && (
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Service Type</div>
                    <div className="text-gray-900 capitalize">{entry.serviceType}</div>
                  </div>
                )}
                {entry.estimatedValue && (
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Estimated Value</div>
                    <div className="text-gray-900 flex items-center">
                      <DollarSign size={14} className="mr-1 text-gray-400" />
                      {formatCurrency(entry.estimatedValue)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {entry.notes && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText size={20} className="mr-2" />
                Notes
              </h2>
              <p className="text-gray-700 whitespace-pre-wrap">{entry.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Management */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>
            <select
              value={entry.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={updateMutation.isPending}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            >
              <option value="waiting">Waiting</option>
              <option value="contacted">Contacted</option>
              <option value="scheduled">Scheduled</option>
              <option value="converted">Converted</option>
              <option value="declined">Declined</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {entry.status === 'converted' && entry.convertedToId && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                <div className="text-green-800 font-medium mb-1">Converted</div>
                <div className="text-green-600">ID: {entry.convertedToId.substring(0, 8)}...</div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar size={20} className="mr-2" />
              Timeline
            </h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">Added to Waitlist</div>
                <div className="text-gray-900 text-sm">{formatDate(entry.createdAt)}</div>
              </div>
              {entry.contactedAt && (
                <div>
                  <div className="text-sm text-gray-500">Contacted</div>
                  <div className="text-gray-900 text-sm">{formatDate(entry.contactedAt)}</div>
                </div>
              )}
              {entry.convertedAt && (
                <div>
                  <div className="text-sm text-gray-500">Converted</div>
                  <div className="text-gray-900 text-sm">{formatDate(entry.convertedAt)}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-gray-500">Last Updated</div>
                <div className="text-gray-900 text-sm">{formatDate(entry.updatedAt)}</div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href={`mailto:${entry.email}`}>
                  <Mail size={16} className="mr-2" />
                  Send Email
                </a>
              </Button>
              {entry.phone && (
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href={`tel:${entry.phone}`}>
                    <Phone size={16} className="mr-2" />
                    Call Customer
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Waitlist Entry?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this waitlist entry? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Deleting...
                  </>
                ) : (
                  'Delete Entry'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

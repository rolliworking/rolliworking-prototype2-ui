import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWatch, useDeleteWatch } from '../hooks/useWatches';
import { ArrowLeft, Edit, Trash2, Watch, Briefcase, User } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function WatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: watch, isLoading } = useWatch(id!);
  const deleteMutation = useDeleteWatch();

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this watch?')) {
      await deleteMutation.mutateAsync(id!);
      navigate('/watches');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!watch) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Watch not found</p>
        <Button onClick={() => navigate('/watches')} className="mt-4">
          Back to Watches
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/watches')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Watches
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {watch.brand} {watch.model}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Watch ID: {watch.id}
            </p>
          </div>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => navigate(`/watches/${id}/edit`)}
            >
              <Edit size={16} className="mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={16} className="mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Watch Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Watch size={20} className="mr-2" />
            Watch Information
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Brand</dt>
              <dd className="mt-1 text-sm text-gray-900">{watch.brand || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Model</dt>
              <dd className="mt-1 text-sm text-gray-900">{watch.model || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Serial Number</dt>
              <dd className="mt-1 text-sm text-gray-900">{watch.serialNumber || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Reference Number</dt>
              <dd className="mt-1 text-sm text-gray-900">{watch.referenceNumber || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Movement Type</dt>
              <dd className="mt-1 text-sm text-gray-900">{watch.movementType || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Case Material</dt>
              <dd className="mt-1 text-sm text-gray-900">{watch.caseMaterial || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Band Material</dt>
              <dd className="mt-1 text-sm text-gray-900">{watch.bandMaterial || '—'}</dd>
            </div>
          </dl>
        </div>

        {/* Customer Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <User size={20} className="mr-2" />
            Customer
          </h2>
          {watch.customer ? (
            <div>
              <p className="text-sm font-medium text-gray-900">
                {watch.customer.displayName || `${watch.customer.firstName} ${watch.customer.lastName}`}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/customers/${watch.customer.id}`)}
                className="mt-3"
              >
                View Customer
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No customer information</p>
          )}
        </div>
      </div>

      {/* Notes */}
      {watch.notes && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{watch.notes}</p>
        </div>
      )}

      {/* Related Jobs */}
      {watch.jobs && watch.jobs.length > 0 && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Briefcase size={20} className="mr-2" />
            Related Jobs ({watch.jobs.length})
          </h2>
          <div className="space-y-3">
            {watch.jobs.map((job: any) => (
              <div
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{job.jobId}</p>
                  <p className="text-xs text-gray-500">
                    Status: {job.status} • Priority: {job.priority}
                  </p>
                </div>
                <ArrowLeft size={16} className="text-gray-400 rotate-180" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

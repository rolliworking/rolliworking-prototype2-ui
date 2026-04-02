import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useJobTemplates } from '../hooks/useJobTemplates';
import { Plus, Search, Wrench, Clock, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const priorityColors = {
  low: 'bg-gray-100 text-gray-800',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

export default function JobTemplatesPage() {
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);

  const isActiveParam = activeFilter === 'all' ? undefined : activeFilter === 'active';

  const { data, isLoading } = useJobTemplates({
    page,
    limit: 50,
    search: search || undefined,
    serviceType: serviceFilter || undefined,
    isActive: isActiveParam,
  });

  const formatCurrency = (amount?: number) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Templates</h1>
            <p className="text-sm text-gray-600 mt-1">
              Reusable templates for common watch repair jobs
            </p>
          </div>
          <Link to="/job-templates/new">
            <Button className="flex items-center space-x-2">
              <Plus size={16} />
              <span>New Template</span>
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type="text"
              placeholder="Search templates by name, description, or instructions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Services</option>
            <option value="repair">Repair</option>
            <option value="restoration">Restoration</option>
            <option value="appraisal">Appraisal</option>
            <option value="consignment">Consignment</option>
          </select>
          <div className="flex space-x-2">
            <Button
              variant={activeFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('all')}
              size="sm"
            >
              All
            </Button>
            <Button
              variant={activeFilter === 'active' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('active')}
              size="sm"
            >
              Active
            </Button>
            <Button
              variant={activeFilter === 'inactive' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('inactive')}
              size="sm"
            >
              Inactive
            </Button>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-20 bg-gray-100 rounded"></div>
            </div>
          ))
        ) : data?.data.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Wrench className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-500 mb-4">No job templates found</p>
            <Link to="/job-templates/new">
              <Button>Create First Template</Button>
            </Link>
          </div>
        ) : (
          data?.data.map((template) => (
            <Link
              key={template.id}
              to={`/job-templates/${template.id}/edit`}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 block"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-1">
                    {template.name}
                  </h3>
                  {template.description && (
                    <p className="text-sm text-gray-600 line-clamp-1">{template.description}</p>
                  )}
                </div>
                <div>
                  {template.isActive ? (
                    <CheckCircle className="text-green-500" size={20} />
                  ) : (
                    <XCircle className="text-gray-400" size={20} />
                  )}
                </div>
              </div>

              {/* Service Type & Priority */}
              <div className="flex items-center space-x-2 mb-4">
                {template.serviceType && (
                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                    {template.serviceType}
                  </span>
                )}
                <span
                  className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                    priorityColors[template.priority]
                  }`}
                >
                  {template.priority}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Clock size={14} className="mr-2 text-gray-400" />
                  <span>{template.estimatedDays || '—'} days</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <DollarSign size={14} className="mr-2 text-gray-400" />
                  <span>{formatCurrency(template.defaultPrice)}</span>
                </div>
              </div>

              {/* Instructions Preview */}
              {template.instructions && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Instructions:</div>
                  <div className="text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">
                    {template.instructions}
                  </div>
                </div>
              )}
            </Link>
          ))
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center space-x-4">
          <Button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            variant="outline"
          >
            Previous
          </Button>
          <span className="text-sm text-gray-700">
            Page {page} of {data.pagination.totalPages}
          </span>
          <Button
            onClick={() => setPage(page + 1)}
            disabled={page === data.pagination.totalPages}
            variant="outline"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

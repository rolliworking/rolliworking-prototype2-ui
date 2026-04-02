import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEmailTemplates } from '../hooks/useEmailTemplates';
import { Plus, Search, Mail, CheckCircle, XCircle, Copy } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function EmailTemplatesPage() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);

  const isActiveParam = activeFilter === 'all' ? undefined : activeFilter === 'active';

  const { data, isLoading } = useEmailTemplates({
    page,
    limit: 50,
    search: search || undefined,
    isActive: isActiveParam,
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
            <p className="text-sm text-gray-600 mt-1">
              Create and manage reusable email templates for customer communications
            </p>
          </div>
          <Link to="/email-templates/new">
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
              placeholder="Search templates by name, subject, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
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
            <Mail className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-500 mb-4">No email templates found</p>
            <Link to="/email-templates/new">
              <Button>Create First Template</Button>
            </Link>
          </div>
        ) : (
          data?.data.map((template) => (
            <Link
              key={template.id}
              to={`/email-templates/${template.id}`}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 block"
            >
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

              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-1">Subject:</div>
                <div className="text-sm text-gray-900 font-medium line-clamp-1">
                  {template.subject}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="text-xs text-gray-500 mb-1">Preview:</div>
                <div 
                  className="text-sm text-gray-700 line-clamp-3"
                  dangerouslySetInnerHTML={{ 
                    __html: template.htmlBody.replace(/<[^>]*>/g, ' ').substring(0, 150) 
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center space-x-3">
                  <Mail size={12} />
                  <span>Email Template</span>
                </div>
                <div>Updated {formatDate(template.updatedAt)}</div>
              </div>
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

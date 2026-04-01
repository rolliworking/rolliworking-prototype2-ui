import React, { useState } from 'react';
import { useParts, useLowStockParts } from '../hooks/useParts';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Package, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function PartsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [itemType, setItemType] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const { data, isLoading } = useParts({ search, itemType, page, perPage });
  const { data: lowStockParts } = useLowStockParts();

  const handleRowClick = (partId: string) => {
    navigate(`/parts/${partId}`);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parts & Inventory</h1>
          <p className="text-sm text-gray-600 mt-1">
            {data?.total || 0} total parts
            {lowStockParts && lowStockParts.length > 0 && (
              <span className="ml-3 text-orange-600 font-medium">
                <AlertTriangle size={14} className="inline mr-1" />
                {lowStockParts.length} low stock
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => navigate('/parts/new')} className="flex items-center space-x-2">
          <Plus size={16} />
          <span>New Part</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <Input
            type="text"
            placeholder="Search by part number or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={itemType}
          onChange={(e) => setItemType(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Item Types</option>
          <option value="part">Parts</option>
          <option value="service">Services</option>
          <option value="labor">Labor</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Low Stock Alert */}
      {lowStockParts && lowStockParts.length > 0 && (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle size={20} className="text-orange-600 mr-2" />
            <h3 className="text-sm font-semibold text-orange-900">
              {lowStockParts.length} part{lowStockParts.length !== 1 ? 's' : ''} below reorder point
            </h3>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {lowStockParts.slice(0, 5).map((part) => (
              <button
                key={part.id}
                onClick={() => navigate(`/parts/${part.id}`)}
                className="text-xs bg-white border border-orange-300 rounded px-2 py-1 hover:bg-orange-100"
              >
                {part.partNumber} ({part.qtyAvailable}/{part.reorderPoint})
              </button>
            ))}
            {lowStockParts.length > 5 && (
              <span className="text-xs text-orange-700 px-2 py-1">
                +{lowStockParts.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Parts Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading parts...</p>
        </div>
      ) : data?.parts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Package size={48} className="mx-auto text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No parts found</h3>
          <p className="text-gray-600 mt-1">Get started by creating a new part</p>
          <Button onClick={() => navigate('/parts/new')} className="mt-4">
            <Plus size={16} className="mr-2" />
            New Part
          </Button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Part Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.parts.map((part) => (
                  <tr
                    key={part.id}
                    onClick={() => handleRowClick(part.id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {part.partNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{part.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                        {part.itemType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {part.defaultSellPrice ? `$${Number(part.defaultSellPrice).toFixed(2)}` : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <span className={part.qtyAvailable && part.reorderPoint && part.qtyAvailable <= part.reorderPoint ? 'text-orange-600 font-medium' : 'text-gray-900'}>
                          {part.qtyAvailable !== undefined ? part.qtyAvailable : 0}
                        </span>
                        {part.itemType === 'part' && (
                          <span className="text-gray-500 text-xs ml-1">on hand</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing page {data.page} of {data.totalPages}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft size={16} />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= data.totalPages}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

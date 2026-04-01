import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePart, useDeletePart, useAdjustInventory } from '../hooks/useParts';
import { ArrowLeft, Edit, Trash2, Package, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function PartDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: part, isLoading } = usePart(id!);
  const deleteMutation = useDeletePart();
  const adjustMutation = useAdjustInventory();

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustment, setAdjustment] = useState('');
  const [reason, setReason] = useState('');
  const [selectedBinId, setSelectedBinId] = useState('');

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to deactivate this part?')) {
      await deleteMutation.mutateAsync(id!);
      navigate('/parts');
    }
  };

  const handleAdjustInventory = async () => {
    if (!selectedBinId || !adjustment || !reason) {
      alert('Please fill in all fields');
      return;
    }

    await adjustMutation.mutateAsync({
      partId: id!,
      binId: selectedBinId,
      adjustment: parseFloat(adjustment),
      reason,
    });

    setShowAdjustModal(false);
    setAdjustment('');
    setReason('');
    setSelectedBinId('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!part) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Part not found</p>
        <Button onClick={() => navigate('/parts')} className="mt-4">
          Back to Parts
        </Button>
      </div>
    );
  }

  const isLowStock = part.reorderPoint && part.qtyAvailable && part.qtyAvailable <= part.reorderPoint;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/parts')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Parts
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {part.partNumber}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {part.description}
            </p>
          </div>
          <div className="flex space-x-3">
            {part.itemType === 'part' && part.stock && part.stock.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowAdjustModal(true)}
              >
                <TrendingUp size={16} className="mr-2" />
                Adjust Stock
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => navigate(`/parts/${id}/edit`)}
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
              Deactivate
            </Button>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {isLowStock && (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start">
          <AlertCircle size={20} className="text-orange-600 mr-3 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-orange-900">Low Stock Alert</h3>
            <p className="text-sm text-orange-700 mt-1">
              Current stock ({part.qtyAvailable}) is below reorder point ({part.reorderPoint}).
              {part.reorderQty && ` Recommended reorder quantity: ${part.reorderQty}`}
            </p>
          </div>
        </div>
      )}

      {/* Part Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Package size={20} className="mr-2" />
            Part Information
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Part Number</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{part.partNumber}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Description</dt>
              <dd className="mt-1 text-sm text-gray-900">{part.description}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Item Type</dt>
              <dd className="mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                  {part.itemType}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Unit of Measure</dt>
              <dd className="mt-1 text-sm text-gray-900 uppercase">{part.uom}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${part.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {part.isActive ? 'Active' : 'Inactive'}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <DollarSign size={20} className="mr-2" />
            Pricing & Reorder
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Default Sell Price</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {part.defaultSellPrice ? `$${Number(part.defaultSellPrice).toFixed(2)}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Average Cost</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {part.averageCost ? `$${Number(part.averageCost).toFixed(2)}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Margin</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {part.defaultSellPrice && part.averageCost
                  ? `${(((Number(part.defaultSellPrice) - Number(part.averageCost)) / Number(part.defaultSellPrice)) * 100).toFixed(1)}%`
                  : '—'}
              </dd>
            </div>
            <div className="border-t border-gray-200 pt-3">
              <dt className="text-sm font-medium text-gray-500">Reorder Point</dt>
              <dd className="mt-1 text-sm text-gray-900">{part.reorderPoint || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Reorder Quantity</dt>
              <dd className="mt-1 text-sm text-gray-900">{part.reorderQty || '—'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Stock Levels */}
      {part.itemType === 'part' && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Stock Levels</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-600 font-medium">On Hand</div>
              <div className="text-2xl font-bold text-blue-900 mt-1">
                {part.totalQtyOnHand || 0}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium">Available</div>
              <div className="text-2xl font-bold text-green-900 mt-1">
                {part.qtyAvailable || 0}
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-sm text-yellow-600 font-medium">Allocated</div>
              <div className="text-2xl font-bold text-yellow-900 mt-1">
                {part.totalQtyAllocated || 0}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-purple-600 font-medium">On Order</div>
              <div className="text-2xl font-bold text-purple-900 mt-1">
                {part.totalQtyOnOrder || 0}
              </div>
            </div>
          </div>

          {/* Stock by Bin */}
          {part.stock && part.stock.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Stock by Location</h3>
              <div className="space-y-2">
                {part.stock.map((stock: any) => (
                  <div key={stock.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {stock.bin?.location?.locationName} - {stock.bin?.binName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {Number(stock.qtyOnHand)} on hand
                      </p>
                      <p className="text-xs text-gray-500">
                        {Number(stock.qtyAllocated)} allocated
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Adjust Inventory Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Adjust Inventory</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bin Location</label>
                <select
                  value={selectedBinId}
                  onChange={(e) => setSelectedBinId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">Select bin...</option>
                  {part.stock?.map((stock: any) => (
                    <option key={stock.bin.id} value={stock.bin.id}>
                      {stock.bin.location.locationName} - {stock.bin.binName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adjustment Quantity (use negative for decrease)
                </label>
                <Input
                  type="number"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                  placeholder="e.g., 10 or -5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="e.g., Received shipment, Damaged items, etc."
                />
              </div>
            </div>
            <div className="mt-6 flex space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowAdjustModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAdjustInventory}
                disabled={adjustMutation.isPending}
                className="flex-1"
              >
                {adjustMutation.isPending ? 'Adjusting...' : 'Adjust'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef } from 'react';
import {
  useInspectionPhotos,
  useUploadInspectionPhoto,
  useDeleteInspectionPhoto,
} from '../hooks/useInspectionPhotos';
import { Button } from '../components/ui/button';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  X,
  Loader2,
  Camera,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

const photoTypeColors = {
  intake: 'bg-blue-100 text-blue-800',
  during_service: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  damage: 'bg-red-100 text-red-800',
  before: 'bg-yellow-100 text-yellow-800',
  after: 'bg-teal-100 text-teal-800',
  reference: 'bg-gray-100 text-gray-800',
};

export default function InspectionPhotosPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const [uploadType, setUploadType] = useState<string>('intake');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: photos, isLoading } = useInspectionPhotos({
    photoType: typeFilter || undefined,
  });
  const uploadMutation = useUploadInspectionPhoto();
  const deleteMutation = useDeleteInspectionPhoto();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('photoType', uploadType);

      try {
        await uploadMutation.mutateAsync(formData);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this photo?')) {
      try {
        await deleteMutation.mutateAsync(id);
        setSelectedPhoto(null);
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inspection Photos</h1>
            <p className="text-sm text-gray-600 mt-1">
              Upload and manage watch inspection photos
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="intake">Intake</option>
              <option value="during_service">During Service</option>
              <option value="completed">Completed</option>
              <option value="damage">Damage</option>
              <option value="before">Before</option>
              <option value="after">After</option>
              <option value="reference">Reference</option>
            </select>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="flex items-center space-x-2"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Upload Photos</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex space-x-2">
          <Button
            variant={typeFilter === '' ? 'default' : 'outline'}
            onClick={() => setTypeFilter('')}
            size="sm"
          >
            All
          </Button>
          {['intake', 'during_service', 'completed', 'damage', 'before', 'after', 'reference'].map(
            (type) => (
              <Button
                key={type}
                variant={typeFilter === type ? 'default' : 'outline'}
                onClick={() => setTypeFilter(type)}
                size="sm"
                className="capitalize"
              >
                {type.replace('_', ' ')}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse"></div>
          ))
        ) : photos && photos.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Camera className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-500 mb-4">No photos uploaded yet</p>
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} className="mr-2" />
              Upload First Photo
            </Button>
          </div>
        ) : (
          photos?.map((photo) => (
            <div
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
            >
              <img
                src={`${API_URL}${photo.filePath}`}
                alt={photo.fileName}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                <ImageIcon className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
              </div>
              <div className="absolute top-2 right-2">
                <span
                  className={`inline-flex px-2 py-1 rounded text-xs font-medium capitalize ${
                    photoTypeColors[photo.photoType]
                  }`}
                >
                  {photo.photoType.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">{selectedPhoto.fileName}</h3>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4">
              <div className="mb-4">
                <img
                  src={`${API_URL}${selectedPhoto.filePath}`}
                  alt={selectedPhoto.fileName}
                  className="w-full h-auto max-h-[60vh] object-contain rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500 mb-1">Photo Type</div>
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                      photoTypeColors[selectedPhoto.photoType]
                    }`}
                  >
                    {selectedPhoto.photoType.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">File Size</div>
                  <div className="text-gray-900">{formatFileSize(selectedPhoto.fileSize)}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Uploaded</div>
                  <div className="text-gray-900">{formatDate(selectedPhoto.createdAt)}</div>
                </div>
                {selectedPhoto.watch && (
                  <div>
                    <div className="text-gray-500 mb-1">Watch</div>
                    <div className="text-gray-900">
                      {selectedPhoto.watch.brand} {selectedPhoto.watch.model}
                    </div>
                  </div>
                )}
                {selectedPhoto.job && (
                  <div>
                    <div className="text-gray-500 mb-1">Job</div>
                    <div className="text-gray-900">{selectedPhoto.job.jobId}</div>
                  </div>
                )}
                {selectedPhoto.customer && (
                  <div>
                    <div className="text-gray-500 mb-1">Customer</div>
                    <div className="text-gray-900">
                      {selectedPhoto.customer.firstName} {selectedPhoto.customer.lastName}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedPhoto(null)}
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDelete(selectedPhoto.id)}
                  disabled={deleteMutation.isPending}
                  className="text-red-600 hover:text-red-700"
                >
                  {deleteMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={16} />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} className="mr-2" />
                      Delete
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

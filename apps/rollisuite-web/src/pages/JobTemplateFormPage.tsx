import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useJobTemplate,
  useCreateJobTemplate,
  useUpdateJobTemplate,
} from '../hooks/useJobTemplates';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

export default function JobTemplateFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: template, isLoading: loadingTemplate } = useJobTemplate(id || '');
  const createMutation = useCreateJobTemplate();
  const updateMutation = useUpdateJobTemplate();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    serviceType: '' as 'repair' | 'restoration' | 'appraisal' | 'consignment' | '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    estimatedDays: '',
    defaultPrice: '',
    intakeNotes: '',
    conditionNotes: '',
    instructions: '',
    isActive: true,
  });

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        description: template.description || '',
        serviceType: template.serviceType || '',
        priority: template.priority || 'normal',
        estimatedDays: template.estimatedDays?.toString() || '',
        defaultPrice: template.defaultPrice?.toString() || '',
        intakeNotes: template.intakeNotes || '',
        conditionNotes: template.conditionNotes || '',
        instructions: template.instructions || '',
        isActive: template.isActive !== undefined ? template.isActive : true,
      });
    }
  }, [template]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: any = {
      name: formData.name,
      description: formData.description || undefined,
      serviceType: formData.serviceType || undefined,
      priority: formData.priority,
      estimatedDays: formData.estimatedDays ? parseInt(formData.estimatedDays, 10) : undefined,
      defaultPrice: formData.defaultPrice ? parseFloat(formData.defaultPrice) : undefined,
      intakeNotes: formData.intakeNotes || undefined,
      conditionNotes: formData.conditionNotes || undefined,
      instructions: formData.instructions || undefined,
      isActive: formData.isActive,
    };

    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, ...data });
      } else {
        await createMutation.mutateAsync(data);
      }
      navigate('/job-templates');
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  if (isEdit && loadingTemplate) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/job-templates')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Templates
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Job Template' : 'Create Job Template'}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {isEdit ? 'Update template details' : 'Create a reusable template for common jobs'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Basic Info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g., Complete Rolex Service"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <Input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Brief description of this service"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Type
              </label>
              <select
                name="serviceType"
                value={formData.serviceType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select type</option>
                <option value="repair">Repair</option>
                <option value="restoration">Restoration</option>
                <option value="appraisal">Appraisal</option>
                <option value="consignment">Consignment</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Priority
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Days
              </label>
              <Input
                type="number"
                name="estimatedDays"
                value={formData.estimatedDays}
                onChange={handleChange}
                placeholder="14"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Price ($)
              </label>
              <Input
                type="number"
                name="defaultPrice"
                value={formData.defaultPrice}
                onChange={handleChange}
                placeholder="450.00"
                step="0.01"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* Notes & Instructions */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Template Content</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Intake Notes Template
              </label>
              <textarea
                name="intakeNotes"
                value={formData.intakeNotes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Standard notes to record during watch intake..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Will be auto-filled when creating a job from this template
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condition Notes Template
              </label>
              <textarea
                name="conditionNotes"
                value={formData.conditionNotes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Condition inspection checklist..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Instructions
              </label>
              <textarea
                name="instructions"
                value={formData.instructions}
                onChange={handleChange}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Step-by-step service instructions:&#10;1. Disassemble movement&#10;2. Clean all parts&#10;3. Replace gaskets&#10;..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Detailed procedures for technicians to follow
              </p>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Template Settings</h2>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
              Active (available for use when creating jobs)
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/job-templates')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="flex items-center space-x-2"
          >
            {(createMutation.isPending || updateMutation.isPending) ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{isEdit ? 'Update Template' : 'Create Template'}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

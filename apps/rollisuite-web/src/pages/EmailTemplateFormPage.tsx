import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useEmailTemplate,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useTemplateVariables,
} from '../hooks/useEmailTemplates';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, Save, Loader2, Eye, Code, HelpCircle } from 'lucide-react';

export default function EmailTemplateFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: template, isLoading: loadingTemplate } = useEmailTemplate(id || '');
  const { data: variables } = useTemplateVariables();
  const createMutation = useCreateEmailTemplate();
  const updateMutation = useUpdateEmailTemplate();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subject: '',
    htmlBody: '',
    isActive: true,
  });

  const [showPreview, setShowPreview] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        description: template.description || '',
        subject: template.subject || '',
        htmlBody: template.htmlBody || '',
        isActive: template.isActive !== undefined ? template.isActive : true,
      });
    }
  }, [template]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, ...formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      navigate('/email-templates');
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('htmlBody') as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.htmlBody;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    setFormData(prev => ({
      ...prev,
      htmlBody: before + variable + after,
    }));

    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  if (isEdit && loadingTemplate) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/email-templates')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Templates
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Email Template' : 'Create Email Template'}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {isEdit ? 'Update template details and content' : 'Create a new reusable email template'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
            {/* Basic Info */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Template Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Estimate Ready Notification"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <Input
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Brief description of when to use this template"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Subject <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Your Estimate is Ready - {{estimateNumber}}"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    You can use template variables like {'{{customerFirstName}}'} in the subject
                  </p>
                </div>
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
                    Active (ready to use)
                  </label>
                </div>
              </div>
            </div>

            {/* Email Body */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Email Content</h2>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center space-x-1"
                  >
                    {showPreview ? <Code size={14} /> : <Eye size={14} />}
                    <span>{showPreview ? 'Edit' : 'Preview'}</span>
                  </Button>
                </div>
              </div>

              {showPreview ? (
                <div 
                  className="border border-gray-300 rounded-lg p-6 bg-white min-h-[400px]"
                  dangerouslySetInnerHTML={{ __html: formData.htmlBody }}
                />
              ) : (
                <div>
                  <textarea
                    id="htmlBody"
                    name="htmlBody"
                    value={formData.htmlBody}
                    onChange={handleChange}
                    rows={16}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="<h1>Hello {{customerFirstName}},</h1>&#10;<p>Your estimate is ready...</p>"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Write HTML for rich formatting. Click variables on the right to insert them.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/email-templates')}
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

        {/* Sidebar - Template Variables */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Template Variables</h3>
              <button
                type="button"
                onClick={() => setShowVariables(!showVariables)}
                className="text-blue-600 hover:text-blue-700"
              >
                <HelpCircle size={18} />
              </button>
            </div>

            {showVariables && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
                <p className="font-medium mb-1">How to use:</p>
                <p className="text-xs">Click any variable below to insert it into your template. Variables will be replaced with actual data when the email is sent.</p>
              </div>
            )}

            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {variables && Object.entries(variables).map(([category, vars]) => (
                <div key={category}>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 capitalize">
                    {category}
                  </h4>
                  <div className="space-y-1">
                    {vars.map((variable) => (
                      <button
                        key={variable.key}
                        type="button"
                        onClick={() => insertVariable(variable.key)}
                        className="w-full text-left px-3 py-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="text-xs font-mono text-blue-600 mb-0.5">
                          {variable.key}
                        </div>
                        <div className="text-xs text-gray-600">{variable.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Tips */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Quick Tips</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Use HTML for formatting (bold, links, etc.)</li>
              <li>• Test with preview before saving</li>
              <li>• Variables are case-sensitive</li>
              <li>• Keep templates concise and clear</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

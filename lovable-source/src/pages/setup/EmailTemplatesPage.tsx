import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, MoreHorizontal, Pencil, Trash2, Copy, Search, Mail, FileText, Eye, Send, Shield, Loader2 as Loader2Icon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { EmailTemplateVariables } from '@/components/estimates/EmailTemplateVariables';

interface MessageTemplate {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const TEMPLATE_CATEGORIES = [
  { value: 'estimate', label: 'Estimate' },
  { value: 'intake', label: 'Intake' },
  { value: 'status_update', label: 'Status Update' },
  { value: 'completion', label: 'Completion' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'general', label: 'General' },
];

export default function EmailTemplatesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { canAccessSetup, isLoading: permissionsLoading } = useRolePermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<MessageTemplate | null>(null);
  const [templateToSend, setTemplateToSend] = useState<MessageTemplate | null>(null);
  
  // Send form state
  const [sendFormData, setSendFormData] = useState({
    toEmail: '',
    subject: '',
    body: '',
  });
  
  // Refs for inserting variables at cursor position
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeField, setActiveField] = useState<'subject' | 'body'>('body');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    category: 'general',
    is_active: true,
  });

  // HOOKS SECTION - All hooks must be declared before any conditional returns

  // Insert variable at cursor position
  const handleInsertVariable = (token: string) => {
    if (activeField === 'subject' && subjectInputRef.current) {
      const input = subjectInputRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const newValue = formData.subject.slice(0, start) + token + formData.subject.slice(end);
      setFormData({ ...formData, subject: newValue });
      // Restore cursor position after React re-render
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    } else if (bodyTextareaRef.current) {
      const textarea = bodyTextareaRef.current;
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const newValue = formData.body.slice(0, start) + token + formData.body.slice(end);
      setFormData({ ...formData, body: newValue });
      // Restore cursor position after React re-render
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    }
  };

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['message-templates', searchQuery, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from('message_templates')
        .select('*')
        .order('name');

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,subject.ilike.%${searchQuery}%`);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MessageTemplate[];
    },
    enabled: canAccessSetup,
  });

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('message_templates').insert({
        name: data.name,
        subject: data.subject || null,
        body: data.body,
        category: data.category,
        is_active: data.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Template created successfully');
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error('Failed to create template: ' + error.message);
    },
  });

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from('message_templates').update({
        name: data.name,
        subject: data.subject || null,
        body: data.body,
        category: data.category,
        is_active: data.is_active,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Template updated successfully');
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error('Failed to update template: ' + error.message);
    },
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('message_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Template deleted successfully');
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    },
    onError: (error) => {
      toast.error('Failed to delete template: ' + error.message);
    },
  });

  // Duplicate template mutation
  const duplicateMutation = useMutation({
    mutationFn: async (template: MessageTemplate) => {
      const { error } = await supabase.from('message_templates').insert({
        name: `${template.name} (Copy)`,
        subject: template.subject,
        body: template.body,
        category: template.category,
        is_active: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Template duplicated successfully');
    },
    onError: (error) => {
      toast.error('Failed to duplicate template: ' + error.message);
    },
  });

  // Send test email mutation
  const sendTestMutation = useMutation({
    mutationFn: async ({ to, subject, body }: { to: string; subject: string; body: string }) => {
      const { error } = await supabase.functions.invoke('send-estimate-email', {
        body: {
          to,
          subject,
          body,
          isTestEmail: true,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Email sent successfully');
      setSendDialogOpen(false);
      setTemplateToSend(null);
    },
    onError: (error) => {
      toast.error('Failed to send email: ' + error.message);
    },
  });

  // Permission check - AFTER all hooks are declared
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2Icon className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!canAccessSetup) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-5 w-5" />
              <p>You don't have permission to access this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleOpenSendDialog = (template: MessageTemplate) => {
    setTemplateToSend(template);
    setSendFormData({
      toEmail: user?.email || '',
      subject: template.subject || `[Preview] ${template.name}`,
      body: template.body,
    });
    setSendDialogOpen(true);
  };

  const handleSendEmail = () => {
    if (!sendFormData.toEmail) {
      toast.error('Please enter a recipient email');
      return;
    }
    sendTestMutation.mutate({
      to: sendFormData.toEmail,
      subject: sendFormData.subject,
      body: sendFormData.body,
    });
  };

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      subject: '',
      body: '',
      category: 'general',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject || '',
      body: template.body,
      category: template.category || 'general',
      is_active: template.is_active,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      subject: '',
      body: '',
      category: 'general',
      is_active: true,
    });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!formData.body.trim()) {
      toast.error('Template body is required');
      return;
    }

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (template: MessageTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (templateToDelete) {
      deleteMutation.mutate(templateToDelete.id);
    }
  };

  const getCategoryLabel = (category: string | null) => {
    return TEMPLATE_CATEGORIES.find(c => c.value === category)?.label || category || 'General';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Email Templates</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create and manage email templates for customer communications
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="w-[120px]">Category</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[150px]">Last Updated</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading templates...
                  </TableCell>
                </TableRow>
              ) : templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Mail className="h-8 w-8 text-muted-foreground/50" />
                      <p>No templates found</p>
                      <Button variant="outline" size="sm" onClick={handleOpenCreate}>
                        Create your first template
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{template.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[200px]">
                      {template.subject || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {getCategoryLabel(template.category)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.is_active ? 'default' : 'outline'}>
                        {template.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(template.updated_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(template)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(template)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenSendDialog(template)}>
                            <Send className="h-4 w-4 mr-2" />
                            Send
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(template)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate 
                ? 'Update the email template details below.' 
                : 'Create a new email template for customer communications.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Estimate Approval Request"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                ref={subjectInputRef}
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                onFocus={() => setActiveField('subject')}
                placeholder="e.g., Your Watch Service Estimate - {{estimate_number}}"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Email Body *</Label>
              <Textarea
                id="body"
                ref={bodyTextareaRef}
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                onFocus={() => setActiveField('body')}
                placeholder="Write your email template here. Use {{variable}} for dynamic content."
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            {/* Variable insertion tokens */}
            <div className="border rounded-lg p-3 bg-muted/30">
              <EmailTemplateVariables onInsert={handleInsertVariable} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Only active templates can be used for sending emails
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button 
              variant="secondary"
              onClick={() => setPreviewDialogOpen(true)}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending 
                ? 'Saving...' 
                : editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>
              Preview how your email will look with sample data
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Subject</Label>
              <div className="p-3 bg-muted rounded-md font-medium">
                {formData.subject
                  .replace(/\{\{first_name\}\}/g, 'John')
                  .replace(/\{\{last_name\}\}/g, 'Smith')
                  .replace(/\{\{full_name\}\}/g, 'John Smith')
                  .replace(/\{\{email\}\}/g, 'john@example.com')
                  .replace(/\{\{phone\}\}/g, '(555) 123-4567')
                  .replace(/\{\{brand\}\}/g, 'Rolex')
                  .replace(/\{\{model\}\}/g, 'Submariner')
                  .replace(/\{\{part_number\}\}/g, '126610LN')
                  .replace(/\{\{serial_number\}\}/g, 'ABC12345')
                  .replace(/\{\{estimate_number\}\}/g, 'EST-2026-0001')
                  .replace(/\{\{total\}\}/g, '$1,250.00')
                  .replace(/\{\{valid_until\}\}/g, 'Feb 11, 2026')
                  .replace(/\{\{job_id\}\}/g, 'JOB-2026-0042')
                  .replace(/\{\{set_number\}\}/g, 'SET-001')
                  .replace(/\{\{status\}\}/g, 'In Progress')
                  .replace(/\{\{due_date\}\}/g, 'Jan 25, 2026')
                  .replace(/\{\{today\}\}/g, new Date().toLocaleDateString())
                  .replace(/\{\{company\}\}/g, 'RolliWorks')
                  || '(No subject)'}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Body</Label>
              <div className="p-4 bg-muted rounded-md whitespace-pre-wrap font-mono text-sm">
                {formData.body
                  .replace(/\{\{first_name\}\}/g, 'John')
                  .replace(/\{\{last_name\}\}/g, 'Smith')
                  .replace(/\{\{full_name\}\}/g, 'John Smith')
                  .replace(/\{\{email\}\}/g, 'john@example.com')
                  .replace(/\{\{phone\}\}/g, '(555) 123-4567')
                  .replace(/\{\{brand\}\}/g, 'Rolex')
                  .replace(/\{\{model\}\}/g, 'Submariner')
                  .replace(/\{\{part_number\}\}/g, '126610LN')
                  .replace(/\{\{serial_number\}\}/g, 'ABC12345')
                  .replace(/\{\{estimate_number\}\}/g, 'EST-2026-0001')
                  .replace(/\{\{total\}\}/g, '$1,250.00')
                  .replace(/\{\{valid_until\}\}/g, 'Feb 11, 2026')
                  .replace(/\{\{job_id\}\}/g, 'JOB-2026-0042')
                  .replace(/\{\{set_number\}\}/g, 'SET-001')
                  .replace(/\{\{status\}\}/g, 'In Progress')
                  .replace(/\{\{due_date\}\}/g, 'Jan 25, 2026')
                  .replace(/\{\{today\}\}/g, new Date().toLocaleDateString())
                  .replace(/\{\{company\}\}/g, 'RolliWorks')
                  || '(No body content)'}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Template: {templateToSend?.name}
            </DialogTitle>
            <DialogDescription>
              Preview and send this template as a test email
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Left side: Email form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="send-to">To</Label>
                  <Input
                    id="send-to"
                    type="email"
                    value={sendFormData.toEmail}
                    onChange={(e) => setSendFormData({ ...sendFormData, toEmail: e.target.value })}
                    placeholder="recipient@example.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="send-subject">Subject</Label>
                  <Input
                    id="send-subject"
                    value={sendFormData.subject}
                    onChange={(e) => setSendFormData({ ...sendFormData, subject: e.target.value })}
                    placeholder="Email subject"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="send-body">Body</Label>
                  <Textarea
                    id="send-body"
                    value={sendFormData.body}
                    onChange={(e) => setSendFormData({ ...sendFormData, body: e.target.value })}
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              
              {/* Right side: Preview */}
              <div className="space-y-4">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Preview</Label>
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 p-3 border-b">
                    <div className="text-xs text-muted-foreground">To: {sendFormData.toEmail || '(no recipient)'}</div>
                    <div className="font-medium mt-1">{sendFormData.subject || '(no subject)'}</div>
                  </div>
                  <div className="p-4 bg-background max-h-[300px] overflow-y-auto">
                    <div className="whitespace-pre-wrap text-sm">
                      {sendFormData.body
                        .replace(/\{\{first_name\}\}/g, 'John')
                        .replace(/\{\{last_name\}\}/g, 'Smith')
                        .replace(/\{\{full_name\}\}/g, 'John Smith')
                        .replace(/\{\{email\}\}/g, 'john@example.com')
                        .replace(/\{\{phone\}\}/g, '(555) 123-4567')
                        .replace(/\{\{brand\}\}/g, 'Rolex')
                        .replace(/\{\{model\}\}/g, 'Submariner')
                        .replace(/\{\{part_number\}\}/g, '126610LN')
                        .replace(/\{\{serial_number\}\}/g, 'ABC12345')
                        .replace(/\{\{estimate_number\}\}/g, 'EST-2026-0001')
                        .replace(/\{\{total\}\}/g, '$1,250.00')
                        .replace(/\{\{valid_until\}\}/g, 'Feb 11, 2026')
                        .replace(/\{\{job_id\}\}/g, 'JOB-2026-0042')
                        .replace(/\{\{set_number\}\}/g, 'SET-001')
                        .replace(/\{\{status\}\}/g, 'In Progress')
                        .replace(/\{\{due_date\}\}/g, 'Jan 25, 2026')
                        .replace(/\{\{today\}\}/g, new Date().toLocaleDateString())
                        .replace(/\{\{company\}\}/g, 'RolliWorks')
                        || '(No body content)'}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: Template variables like {'{{first_name}}'} will be shown as sample values in the preview but sent as-is in the email.
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail}
              disabled={sendTestMutation.isPending || !sendFormData.toEmail}
              className="gap-2"
            >
              {sendTestMutation.isPending ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

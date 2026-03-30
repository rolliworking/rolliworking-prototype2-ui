import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, ExternalLink, CheckCircle, Clock, AlertCircle, Pencil, Trash2, ChevronDown, Circle, PauseCircle, Archive, FilePlus, Ban, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface IntakeLead {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  item_type: string | null;
  watch_reference: string | null;
  watch_serial: string | null;
  notes: string | null;
  status: string;
  received_at: string;
  is_na: boolean | null;
  awaiting_reply: boolean | null;
  customer: { id: string; first_name: string; last_name: string; email: string } | null;
  job: { id: string; job_id: string } | null;
}

export default function IntakeLeadsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'new' | 'done' | 'archived' | 'na'>('new');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingLead, setEditingLead] = useState<IntakeLead | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    item_type: '',
    watch_reference: '',
    watch_serial: '',
    notes: '',
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: leads, isLoading } = useQuery({
    queryKey: ['intake-leads', searchQuery, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('intake_leads')
        .select(`
          *,
          customer:customers(id, first_name, last_name, email),
          job:jobs(id, job_id)
        `)
        .order('received_at', { ascending: false });

      // Filter by status
      if (statusFilter === 'na') {
        query = query.eq('is_na', true);
      } else if (statusFilter === 'new') {
        query = query.in('status', ['new', 'pending', 'on_hold']).or('is_na.is.null,is_na.eq.false');
      } else if (statusFilter === 'done') {
        query = query.in('status', ['done', 'processed']).or('is_na.is.null,is_na.eq.false');
      } else if (statusFilter === 'archived') {
        query = query.eq('status', 'archived').or('is_na.is.null,is_na.eq.false');
      }

      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,watch_reference.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as IntakeLead[];
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!leads) return;
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)));
    }
  };

  const openEditDialog = (lead: IntakeLead) => {
    setEditingLead(lead);
    setEditForm({
      full_name: lead.full_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      item_type: lead.item_type || '',
      watch_reference: lead.watch_reference || '',
      watch_serial: lead.watch_serial || '',
      notes: lead.notes || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingLead) return;
    
    const { error } = await supabase
      .from('intake_leads')
      .update({
        full_name: editForm.full_name || null,
        email: editForm.email || null,
        phone: editForm.phone || null,
        item_type: editForm.item_type || null,
        watch_reference: editForm.watch_reference || null,
        watch_serial: editForm.watch_serial || null,
        notes: editForm.notes || null,
      })
      .eq('id', editingLead.id);

    if (error) {
      toast.error('Failed to update lead');
      return;
    }

    toast.success('Lead updated');
    setEditingLead(null);
    queryClient.invalidateQueries({ queryKey: ['intake-leads'] });
  };

  const handleToggleAwaitingReply = async (id: string, awaitingReply: boolean) => {
    const { error } = await supabase
      .from('intake_leads')
      .update({ awaiting_reply: awaitingReply })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update status');
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['intake-leads'] });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    const { error } = await supabase
      .from('intake_leads')
      .delete()
      .in('id', Array.from(selectedIds));

    if (error) {
      toast.error('Failed to delete leads');
      return;
    }

    toast.success(`Deleted ${selectedIds.size} lead(s)`);
    setSelectedIds(new Set());
    setDeleteConfirmOpen(false);
    queryClient.invalidateQueries({ queryKey: ['intake-leads'] });
  };

  const handleMoveToFolder = async (ids: string[], folder: 'new' | 'on_hold' | 'done' | 'archived' | 'na') => {
    if (folder === 'na') {
      // Moving to N/A folder - set is_na = true
      const { error } = await supabase
        .from('intake_leads')
        .update({ is_na: true })
        .in('id', ids);

      if (error) {
        toast.error('Failed to move leads');
        return;
      }

      toast.success(`Moved ${ids.length} lead(s) to N/A — excluded from response time analytics`, {
        icon: <Archive className="h-4 w-4" />,
      });
    } else {
      // Moving to another folder - update status and clear is_na
      const { error } = await supabase
        .from('intake_leads')
        .update({ status: folder, is_na: false })
        .in('id', ids);

      if (error) {
        toast.error('Failed to move leads');
        return;
      }

      const folderNames: Record<string, string> = {
        new: 'New',
        on_hold: 'On Hold',
        done: 'Done',
        archived: 'Archived',
      };
      toast.success(`Moved ${ids.length} lead(s) to ${folderNames[folder]}`);
    }

    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['intake-leads'] });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
      case 'processed':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" /> Done</Badge>;
      case 'new':
      case 'pending':
        return <Badge variant="secondary"><Circle className="h-3 w-3 mr-1" /> New</Badge>;
      case 'on_hold':
        return <Badge variant="outline" className="border-amber-500 text-amber-600"><PauseCircle className="h-3 w-3 mr-1" /> On Hold</Badge>;
      case 'archived':
        return <Badge variant="outline" className="border-muted-foreground text-muted-foreground"><Archive className="h-3 w-3 mr-1" /> Archived</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif">Intake Leads</h1>
          <p className="text-muted-foreground">Service requests from Wix and other sources</p>
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'new' | 'done' | 'archived' | 'na')} className="w-full">
        <div className="flex items-center justify-between gap-4">
          <TabsList className="h-10">
            <TabsTrigger value="new" className="gap-2">
              <Circle className="h-3.5 w-3.5" />
              New
            </TabsTrigger>
            <TabsTrigger value="done" className="gap-2">
              <CheckCircle className="h-3.5 w-3.5" />
              Done
            </TabsTrigger>
            <TabsTrigger value="archived" className="gap-2">
              <Archive className="h-3.5 w-3.5" />
              Archived
            </TabsTrigger>
            <TabsTrigger value="na" className="gap-2">
              <Ban className="h-3.5 w-3.5" />
              N/A
            </TabsTrigger>
          </TabsList>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or part #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Tabs>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="text-lg">
            {statusFilter === 'new' && 'New Leads'}
            {statusFilter === 'done' && 'Completed Leads'}
            {statusFilter === 'archived' && 'Archived Leads'}
            {statusFilter === 'na' && 'N/A Leads'}
          </CardTitle>
          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Move to <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleMoveToFolder(Array.from(selectedIds), 'new')}>
                    <Circle className="h-4 w-4 mr-2" /> New
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleMoveToFolder(Array.from(selectedIds), 'on_hold')}>
                    <PauseCircle className="h-4 w-4 mr-2" /> On Hold
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleMoveToFolder(Array.from(selectedIds), 'done')}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Done
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleMoveToFolder(Array.from(selectedIds), 'archived')}>
                    <Archive className="h-4 w-4 mr-2" /> Archived
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleMoveToFolder(Array.from(selectedIds), 'na')}>
                    <Ban className="h-4 w-4 mr-2" /> N/A
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedIds.size})
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : leads?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No intake leads found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={leads && selectedIds.size === leads.length && leads.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Service Requested</TableHead>
                  <TableHead>Watch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Linked</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads?.map((lead) => (
                  <>
                    <TableRow key={lead.id} className={`border-b-0 ${selectedIds.has(lead.id) ? 'bg-muted/50' : ''}`}>
                      <TableCell className="pb-1">
                        <Checkbox 
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={() => toggleSelect(lead.id)}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap pb-1">
                        {format(new Date(lead.received_at), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell className="font-medium pb-1">
                        {lead.full_name || '-'}
                      </TableCell>
                      <TableCell className="pb-1">
                        <div className="text-sm">
                          {lead.email && <div>{lead.email}</div>}
                          {lead.phone && <div className="text-muted-foreground">{lead.phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[120px] pb-1">
                        <span className="font-medium text-primary">
                          {lead.item_type || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-[150px] pb-1">
                        <div className="text-sm">
                          {lead.watch_reference && <div>{lead.watch_reference}</div>}
                          {lead.watch_serial && <div className="text-muted-foreground">S/N: {lead.watch_serial}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="pb-1">
                        <div className="flex items-center gap-1">
                          {getStatusBadge(lead.status)}
                          {lead.is_na && (
                            <Badge variant="outline" className="border-muted-foreground text-muted-foreground text-xs">
                              <Ban className="h-3 w-3 mr-1" /> N/A
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="pb-1">
                        <div className="flex items-center gap-2">
                          {lead.customer && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/customers`)}
                            >
                              Customer
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/estimates/new?lead_id=${lead.id}`)}
                          >
                            <FilePlus className="h-3 w-3 mr-1" />
                            Create Estimate
                          </Button>
                          <Badge
                            variant={lead.awaiting_reply ? "default" : "outline"}
                            className={`cursor-pointer select-none transition-colors ${lead.awaiting_reply ? 'hover:bg-primary/90' : 'hover:bg-muted'}`}
                            onClick={() => handleToggleAwaitingReply(lead.id, !lead.awaiting_reply)}
                          >
                            <Mail className="h-3 w-3 mr-1" />
                            Awaiting Reply
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="pb-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(lead)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {/* Notes row - spans full width */}
                    {lead.notes && (
                      <TableRow key={`${lead.id}-notes`} className={selectedIds.has(lead.id) ? 'bg-muted/50' : ''}>
                        <TableCell colSpan={9} className="pt-0 pb-3">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap pl-6">
                            {lead.notes}
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingLead} onOpenChange={() => setEditingLead(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <Input 
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input 
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input 
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Service Requested</label>
                <Input 
                  value={editForm.item_type}
                  onChange={(e) => setEditForm({ ...editForm, item_type: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Part #</label>
                <Input 
                  value={editForm.watch_reference}
                  onChange={(e) => setEditForm({ ...editForm, watch_reference: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Serial Number</label>
                <Input 
                  value={editForm.watch_serial}
                  onChange={(e) => setEditForm({ ...editForm, watch_serial: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Comments</label>
              <Textarea 
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button 
              variant="outline" 
              className="text-muted-foreground"
              onClick={async () => {
                if (!editingLead) return;
                await handleMoveToFolder([editingLead.id], 'archived');
                setEditingLead(null);
              }}
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingLead(null)}>Cancel</Button>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} lead(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected leads will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

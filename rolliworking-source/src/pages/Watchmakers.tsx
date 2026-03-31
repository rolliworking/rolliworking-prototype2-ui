import * as React from "react";
import { Plus, Pencil, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

import { usePageMeta } from "@/hooks/use-page-meta";
import { 
  useWatchmakers, 
  useCreateWatchmaker, 
  useUpdateWatchmaker, 
  useDeleteWatchmaker 
} from "@/hooks/use-watchmakers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

export default function Watchmakers() {
  usePageMeta({
    title: "Watchmakers • Rolliworks",
    description: "Manage watchmaker team members",
    canonicalPath: "/watchmakers",
  });

  const { data: watchmakers, isLoading, error } = useWatchmakers();
  const createWatchmaker = useCreateWatchmaker();
  const updateWatchmaker = useUpdateWatchmaker();
  const deleteWatchmaker = useDeleteWatchmaker();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ name: "", initials: "", weekly_target: 0, weekly_testing_target: 0 });
  const [errors, setErrors] = React.useState<{ name?: string; initials?: string }>({}); 

  const resetForm = () => {
    setForm({ name: "", initials: "", weekly_target: 0, weekly_testing_target: 0 });
    setErrors({});
    setEditId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (watchmaker: { id: string; name: string; initials: string; weekly_target: number; weekly_testing_target: number }) => {
    setEditId(watchmaker.id);
    setForm({ name: watchmaker.name, initials: watchmaker.initials, weekly_target: watchmaker.weekly_target ?? 0, weekly_testing_target: watchmaker.weekly_testing_target ?? 0 });
    setErrors({});
    setDialogOpen(true);
  };

  const validateForm = () => {
    const newErrors: { name?: string; initials?: string } = {};
    
    if (!form.name.trim()) {
      newErrors.name = "Name is required";
    }
    
    if (!form.initials.trim()) {
      newErrors.initials = "Initials are required";
    } else if (form.initials.length > 3) {
      newErrors.initials = "Initials must be 3 characters or less";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      if (editId) {
        await updateWatchmaker.mutateAsync({
          id: editId,
          name: form.name.trim(),
          initials: form.initials.trim(),
          weekly_target: form.weekly_target,
          weekly_testing_target: form.weekly_testing_target,
        });
        toast.success("Watchmaker updated");
      } else {
        await createWatchmaker.mutateAsync({
          name: form.name.trim(),
          initials: form.initials.trim(),
        });
        toast.success("Watchmaker added");
      }
      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      if (err?.message?.includes("unique")) {
        setErrors({ initials: "These initials are already in use" });
      } else {
        toast.error(err?.message || "Failed to save watchmaker");
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteWatchmaker.mutateAsync(deleteId);
      toast.success("Watchmaker removed");
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete watchmaker");
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateWatchmaker.mutateAsync({ id, is_active: !currentActive });
      toast.success(currentActive ? "Watchmaker deactivated" : "Watchmaker activated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    }
  };

  if (isLoading) {
    return (
      <main className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Watchmakers</h1>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="space-y-4">
        <h1 className="text-xl font-semibold">Watchmakers</h1>
        <p className="text-destructive">Failed to load watchmakers</p>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Watchmakers</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Add Watchmaker
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Manage your watchmaker team. Initials (up to 3 characters) are displayed on job cards in the Work Queue.
      </p>

      {watchmakers?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No watchmakers added yet. Click "Add Watchmaker" to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {watchmakers?.map((wm) => (
            <Card key={wm.id} className={!wm.is_active ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      {wm.initials}
                    </div>
                    <div>
                      <p className="font-medium">{wm.name}</p>
                      <Badge variant={wm.is_active ? "default" : "secondary"} className="text-xs mt-1">
                        {wm.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleToggleActive(wm.id, wm.is_active)}
                      title={wm.is_active ? "Deactivate" : "Activate"}
                    >
                      {wm.is_active ? (
                        <UserX className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openEdit(wm)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(wm.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Watchmaker" : "Add Watchmaker"}</DialogTitle>
            <DialogDescription>
              {editId ? "Update the watchmaker's details." : "Add a new watchmaker to your team."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Smith"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="initials">Initials (max 3 characters)</Label>
              <Input
                id="initials"
                value={form.initials}
                onChange={(e) => setForm({ ...form, initials: e.target.value.toUpperCase().slice(0, 3) })}
                placeholder="JS"
                maxLength={3}
                className="uppercase"
              />
              {errors.initials && <p className="text-xs text-destructive">{errors.initials}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekly_target">Weekly Completion Target</Label>
              <Input
                id="weekly_target"
                type="number"
                min={0}
                value={form.weekly_target}
                onChange={(e) => setForm({ ...form, weekly_target: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">Expected completed jobs per week (shown on weekly report)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekly_testing_target">Weekly In-Testing Target</Label>
              <Input
                id="weekly_testing_target"
                type="number"
                min={0}
                value={form.weekly_testing_target}
                onChange={(e) => setForm({ ...form, weekly_testing_target: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">Expected jobs moved to testing per week (shown on weekly report)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createWatchmaker.isPending || updateWatchmaker.isPending}
            >
              {editId ? "Save Changes" : "Add Watchmaker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Watchmaker?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the watchmaker from the system. Jobs currently assigned to them will retain the assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

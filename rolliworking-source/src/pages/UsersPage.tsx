import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Search, Trash2, User, UserCog, Crown, Shield, Settings, Key, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, type ManagedUser, type UserRole } from "@/hooks/use-user-management";
import { useSecurityStatus } from "@/hooks/use-security";
import { PermissionsMatrix } from "@/components/users/PermissionsMatrix";
import { SetPinDialog } from "@/components/security/SetPinDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Validation schemas
const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");
const nameSchema = z.string().min(1, "Required").max(100, "Too long");

type UserFormMode = "create" | "edit" | null;

interface UserForm {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
}

const emptyForm: UserForm = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  role: "staff",
};

const ROLE_CONFIG: Record<UserRole, { label: string; description: string; icon: typeof User; variant: "default" | "secondary" | "outline" }> = {
  owner: { 
    label: "Owner", 
    description: "Full access including user management", 
    icon: Crown,
    variant: "default"
  },
  manager: { 
    label: "Manager", 
    description: "Full access except user management", 
    icon: Shield,
    variant: "outline"
  },
  staff: { 
    label: "Staff", 
    description: "View only access", 
    icon: User,
    variant: "secondary"
  },
};

export default function UsersPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "users";
  // Check if user is owner - redirect if not
  const { data: isOwner, isLoading: isCheckingOwner } = useQuery({
    queryKey: ["user-role", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "owner")
        .maybeSingle();
      return !!data;
    },
    enabled: !!session?.user?.id,
  });

  usePageMeta({
    title: "User Management | Rolliworks",
    description: "Manage user accounts and permissions",
    canonicalPath: "/users",
  });

  // Redirect non-owners to dashboard
  if (!isCheckingOwner && !isOwner) {
    return <Navigate to="/" replace />;
  }

  const [search, setSearch] = useState("");
  const [formMode, setFormMode] = useState<UserFormMode>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string; first_name?: string; last_name?: string }>({});
  const [pinDialogUser, setPinDialogUser] = useState<{ id: string; name: string; hasPin: boolean } | null>(null);

  const { data: users, isLoading, error } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const filteredUsers = users?.filter((u) =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setFormMode("create");
    setEditingUserId(null);
    setForm(emptyForm);
    setErrors({});
  };

  const openEdit = (user: ManagedUser) => {
    const nameParts = (user.full_name || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    
    setFormMode("edit");
    setEditingUserId(user.id);
    setForm({
      email: user.email,
      password: "",
      first_name: firstName,
      last_name: lastName,
      role: user.role,
    });
    setErrors({});
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingUserId(null);
    setForm(emptyForm);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; first_name?: string; last_name?: string } = {};

    const emailResult = emailSchema.safeParse(form.email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    if (formMode === "create" || form.password) {
      const passwordResult = passwordSchema.safeParse(form.password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
    }

    const firstNameResult = nameSchema.safeParse(form.first_name);
    if (!firstNameResult.success) {
      newErrors.first_name = firstNameResult.error.errors[0].message;
    }

    const lastNameResult = nameSchema.safeParse(form.last_name);
    if (!lastNameResult.success) {
      newErrors.last_name = lastNameResult.error.errors[0].message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`.trim();

    try {
      if (formMode === "create") {
        await createUser.mutateAsync({
          email: form.email,
          password: form.password,
          full_name: fullName || undefined,
          role: form.role,
        });
        toast.success("User created successfully");
      } else if (formMode === "edit" && editingUserId) {
        await updateUser.mutateAsync({
          user_id: editingUserId,
          email: form.email,
          password: form.password || undefined,
          full_name: fullName,
          role: form.role,
        });
        toast.success("User updated successfully");
      }
      closeForm();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save user");
    }
  };

  const handleDelete = async () => {
    if (!deleteUserId) return;

    try {
      await deleteUser.mutateAsync(deleteUserId);
      toast.success("User deleted successfully");
      setDeleteUserId(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete user");
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  const isPending = createUser.isPending || updateUser.isPending;

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">User Management</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive">
              {(error as Error)?.message || "Failed to load users. You may not have owner access."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage team members and their access levels</p>
        </div>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={(value) => setSearchParams({ tab: value })}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <User className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <Settings className="h-4 w-4" />
            Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          </div>

          {/* Role Legend */}
          <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
            {(Object.keys(ROLE_CONFIG) as UserRole[]).map((role) => {
              const config = ROLE_CONFIG[role];
              const Icon = config.icon;
              return (
                <div key={role} className="flex items-center gap-2">
                  <Badge variant={config.variant} className="text-xs">
                    <Icon className="mr-1 h-3 w-3" />
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{config.description}</span>
                </div>
              );
            })}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredUsers || filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No users found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredUsers.map((user) => {
                const roleConfig = ROLE_CONFIG[user.role];
                const RoleIcon = roleConfig.icon;
                
                return (
                  <Card key={user.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                            {getInitials(user.full_name, user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {user.full_name || "Unnamed User"}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {user.email}
                          </p>
                          <Badge
                            variant={roleConfig.variant}
                            className="mt-2 text-[10px]"
                          >
                            <RoleIcon className="mr-1 h-3 w-3" />
                            {roleConfig.label}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(user)} className="h-8 w-8">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteUserId(user.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-medium">Session Security</h2>
            <p className="text-sm text-muted-foreground">
              Manage PINs for session re-authentication. When a user's session times out, 
              they can unlock with their PIN instead of signing in again.
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredUsers?.map((user) => {
                const roleConfig = ROLE_CONFIG[user.role];
                const RoleIcon = roleConfig.icon;
                
                return (
                  <Card key={user.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                            {getInitials(user.full_name, user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {user.full_name || "Unnamed User"}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {user.email}
                          </p>
                          <Badge
                            variant={roleConfig.variant}
                            className="mt-2 text-[10px]"
                          >
                            <RoleIcon className="mr-1 h-3 w-3" />
                            {roleConfig.label}
                          </Badge>
                        </div>
                        <SecurityStatusButton userId={user.id} userName={user.full_name || user.email} onSetPin={setPinDialogUser} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="permissions">
          <PermissionsMatrix />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={formMode !== null} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{formMode === "create" ? "Add New User" : "Edit User"}</DialogTitle>
            <DialogDescription>
              {formMode === "create"
                ? "Create a new user account with login credentials"
                : "Update user details and permissions"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  placeholder="John"
                />
                {errors.first_name && (
                  <p className="text-sm text-destructive">{errors.first_name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  placeholder="Doe"
                />
                {errors.last_name && (
                  <p className="text-sm text-destructive">{errors.last_name}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@example.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password {formMode === "edit" && <span className="text-muted-foreground font-normal">(leave blank to keep current)</span>}
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={formMode === "create" ? "Min 12 characters" : "Leave blank to keep current"}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
              {formMode === "create" && (
                <p className="text-xs text-muted-foreground">
                  Must include uppercase, lowercase, number, and special character
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={form.role}
                onValueChange={(value: UserRole) => setForm({ ...form, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_CONFIG) as UserRole[]).map((role) => {
                    const config = ROLE_CONFIG[role];
                    const Icon = config.icon;
                    return (
                      <SelectItem key={role} value={role}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{config.label}</span>
                          <span className="text-muted-foreground text-xs">- {config.description}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {formMode === "create" ? "Create User" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone and will remove all their access to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Set PIN Dialog */}
      {pinDialogUser && (
        <SetPinDialog
          open={!!pinDialogUser}
          onOpenChange={(open) => !open && setPinDialogUser(null)}
          targetUserId={pinDialogUser.id}
          targetUserName={pinDialogUser.name}
          hasExistingPin={pinDialogUser.hasPin}
        />
      )}
    </div>
  );
}

// Helper component for security status button
function SecurityStatusButton({ 
  userId, 
  userName, 
  onSetPin 
}: { 
  userId: string; 
  userName: string; 
  onSetPin: (user: { id: string; name: string; hasPin: boolean }) => void;
}) {
  const { data: status, isLoading } = useSecurityStatus(userId);

  if (isLoading) {
    return (
      <Button size="sm" variant="ghost" disabled className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
      </Button>
    );
  }

  const hasPin = status?.hasPin ?? false;

  return (
    <Button
      size="sm"
      variant={hasPin ? "outline" : "secondary"}
      className="gap-1"
      onClick={() => onSetPin({ id: userId, name: userName, hasPin })}
    >
      <Key className="h-3 w-3" />
      {hasPin ? "Update PIN" : "Set PIN"}
    </Button>
  );
}

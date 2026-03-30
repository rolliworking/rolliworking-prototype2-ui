import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Shield, Users, Crown, UserCog, Mail, Clock, X, Check, XCircle, RotateCcw, Lock, Pencil } from 'lucide-react';
import { AppRole, ROLE_PERMISSIONS, PermissionKey } from '@/types/database';
import { InviteUserDialog } from '@/components/users/InviteUserDialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  created_at: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

interface RolePermissionRow {
  id: string;
  role: string;
  permission_key: string;
  enabled: boolean;
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  office: 'Team',
  staff: 'Team',
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin: <Crown className="h-4 w-4" />,
  manager: <UserCog className="h-4 w-4" />,
  team: <Users className="h-4 w-4" />,
};

// Permission labels for the control panel
const PERMISSION_LABELS: { key: PermissionKey; label: string; description: string }[] = [
  { key: 'canDeleteJobs', label: 'Delete Jobs', description: 'Permanently remove job records' },
  { key: 'canManageUsers', label: 'Manage Users', description: 'Add, edit, and manage team members' },
  { key: 'canManageSettings', label: 'Manage Settings', description: 'Configure company settings' },
  { key: 'canAccessSetup', label: 'Access Setup Pages', description: 'View /setup/* pages and integrations' },
  { key: 'canExportCSV', label: 'Export CSV', description: 'Download data exports' },
  { key: 'canEditTestsAnytime', label: 'Edit Tests Anytime', description: 'Modify timing/pressure tests without time limit' },
  { key: 'canEditTestsWithin24Hours', label: 'Edit Tests (24hr)', description: 'Modify tests within 24 hours of creation' },
  { key: 'canAccessIntake', label: 'Access Intake', description: 'View and manage intake pages' },
  { key: 'canAccessInspections', label: 'Access Inspections', description: 'View /intake/inspections page' },
  { key: 'canAccessReceiveWatch', label: 'Access Receive Watch', description: 'View /intake/receive-watch page' },
  { key: 'canAccessReportAnalytics', label: 'Access Report Analytics', description: 'View /reports/analytics page' },
];

const EDITABLE_ROLES = ['manager', 'team'] as const;

export default function UsersPage() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [isEditingPermissions, setIsEditingPermissions] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role as AppRole]) || []);
      
      return (profiles || []).map(p => ({
        id: p.user_id,
        email: p.email || '',
        full_name: p.full_name,
        role: rolesMap.get(p.user_id) || 'office' as AppRole,
        created_at: p.created_at,
      })) as UserWithRole[];
    },
  });

  const { data: rolePermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*');

      if (error) throw error;
      return data as RolePermissionRow[];
    },
  });

  const { data: pendingInvitations } = useQuery({
    queryKey: ['pending-invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('id, email, role, created_at, expires_at')
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PendingInvitation[];
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('User role updated');
    },
    onError: (error) => {
      console.error('Error updating role:', error);
      toast.error('Failed to update user role');
    },
    onSettled: () => {
      setUpdatingUserId(null);
    },
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ role, permissionKey, enabled }: { role: string; permissionKey: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('role_permissions')
        .upsert(
          { role, permission_key: permissionKey, enabled },
          { onConflict: 'role,permission_key' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
      toast.success('Permission updated');
    },
    onError: (error) => {
      console.error('Error updating permission:', error);
      toast.error('Failed to update permission');
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] });
      toast.success('Invitation cancelled');
    },
    onError: (error) => {
      console.error('Error cancelling invitation:', error);
      toast.error('Failed to cancel invitation');
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke('send-invite', {
        body: { email, role },
      });

      if (error) throw new Error(error.message || 'Failed to resend invitation');
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] });
      toast.success('Invitation resent successfully');
    },
    onError: (error: Error) => {
      console.error('Error resending invitation:', error);
      toast.error(error.message || 'Failed to resend invitation');
    },
  });

  const declineInviteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] });
      toast.success('Invitation declined');
    },
    onError: (error) => {
      console.error('Error declining invitation:', error);
      toast.error('Failed to decline invitation');
    },
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    if (userId === user?.id) {
      toast.error("You cannot change your own role");
      return;
    }

    setUpdatingUserId(userId);
    const dbRole = newRole === 'team' ? 'office' : newRole as AppRole;
    updateRoleMutation.mutate({ userId, role: dbRole });
  };

  const getDisplayRole = (role: AppRole | string): string => {
    if (role === 'office' || role === 'staff') return 'team';
    return role;
  };

  const getRoleBadgeVariant = (role: AppRole | string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'manager':
        return 'default';
      default:
        return 'secondary';
    }
  };

  // Get permission value - use database value if exists, otherwise use default
  const getPermissionValue = (role: string, permissionKey: PermissionKey): boolean => {
    // Admin always has all permissions
    if (role === 'admin') return true;

    const dbPerm = rolePermissions?.find(
      p => p.role === role && p.permission_key === permissionKey
    );

    if (dbPerm !== undefined) {
      return dbPerm.enabled;
    }

    // Fall back to defaults
    const defaultRole = role === 'team' ? 'office' : role as AppRole;
    return ROLE_PERMISSIONS[defaultRole]?.[permissionKey] ?? false;
  };

  const handlePermissionToggle = (role: string, permissionKey: PermissionKey) => {
    if (role === 'admin') return; // Can't edit admin permissions
    
    const currentValue = getPermissionValue(role, permissionKey);
    updatePermissionMutation.mutate({
      role,
      permissionKey,
      enabled: !currentValue,
    });
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-5 w-5" />
              <p>You don't have permission to manage users. Only administrators can access this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users & Permissions</h1>
          <p className="text-muted-foreground">
            Manage user roles and configure permissions
          </p>
        </div>
        <InviteUserDialog />
      </div>

      {/* Permissions Control Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Permissions by Role</CardTitle>
            </div>
            <Button
              variant={isEditingPermissions ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEditingPermissions(!isEditingPermissions)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              {isEditingPermissions ? 'Done Editing' : 'Edit Permissions'}
            </Button>
          </div>
          <CardDescription>
            {isEditingPermissions 
              ? 'Click on Manager or Team permissions to toggle them'
              : 'View role permissions. Click Edit to make changes.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {permissionsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Permission</TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Crown className="h-4 w-4 text-destructive" />
                        <span>Admin</span>
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <UserCog className="h-4 w-4 text-primary" />
                        <span>Manager</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>Team</span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PERMISSION_LABELS.map((perm) => (
                    <TableRow key={perm.key}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{perm.label}</span>
                          <span className="text-xs text-muted-foreground">{perm.description}</span>
                        </div>
                      </TableCell>
                      {/* Admin - always on, not editable */}
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <Check className="h-5 w-5 text-green-600" />
                        </div>
                      </TableCell>
                      {/* Manager - editable when in edit mode */}
                      <TableCell className="text-center">
                        {isEditingPermissions ? (
                          <button
                            onClick={() => handlePermissionToggle('manager', perm.key)}
                            disabled={updatePermissionMutation.isPending}
                            className={cn(
                              "p-2 rounded-md transition-colors hover:bg-accent",
                              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            )}
                            title="Click to toggle"
                          >
                            {getPermissionValue('manager', perm.key) ? (
                              <Check className="h-5 w-5 text-green-600 mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                            )}
                          </button>
                        ) : (
                          <div className="flex justify-center p-2">
                            {getPermissionValue('manager', perm.key) ? (
                              <Check className="h-5 w-5 text-green-600" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground/40" />
                            )}
                          </div>
                        )}
                      </TableCell>
                      {/* Team - editable when in edit mode */}
                      <TableCell className="text-center">
                        {isEditingPermissions ? (
                          <button
                            onClick={() => handlePermissionToggle('team', perm.key)}
                            disabled={updatePermissionMutation.isPending}
                            className={cn(
                              "p-2 rounded-md transition-colors hover:bg-accent",
                              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            )}
                            title="Click to toggle"
                          >
                            {getPermissionValue('team', perm.key) ? (
                              <Check className="h-5 w-5 text-green-600 mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                            )}
                          </button>
                        ) : (
                          <div className="flex justify-center p-2">
                            {getPermissionValue('team', perm.key) ? (
                              <Check className="h-5 w-5 text-green-600" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground/40" />
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations && pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Pending Invitations</CardTitle>
            </div>
            <CardDescription>
              {pendingInvitations.length} pending invitation{pendingInvitations.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(invite.role)}>
                        <span className="flex items-center gap-1">
                          {ROLE_ICONS[getDisplayRole(invite.role)]}
                          {ROLE_LABELS[invite.role as AppRole] || 'Team'}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(invite.created_at), 'MMM d, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(invite.expires_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Resend invitation"
                          onClick={() => resendInviteMutation.mutate({ email: invite.email, role: invite.role })}
                          disabled={resendInviteMutation.isPending}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Decline invitation"
                          className="text-destructive hover:text-destructive"
                          onClick={() => declineInviteMutation.mutate(invite.id)}
                          disabled={declineInviteMutation.isPending}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {users?.length || 0} user{users?.length !== 1 ? 's' : ''} in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-[180px]">Change Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name || 'No name'}
                      {u.id === user?.id && (
                        <Badge variant="outline" className="ml-2">You</Badge>
                      )}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(u.role)}>
                        <span className="flex items-center gap-1">
                          {ROLE_ICONS[getDisplayRole(u.role)]}
                          {ROLE_LABELS[u.role]}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={getDisplayRole(u.role)}
                        onValueChange={(value) => handleRoleChange(u.id, value)}
                        disabled={u.id === user?.id || updatingUserId === u.id}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="team">Team</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {(!users || users.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
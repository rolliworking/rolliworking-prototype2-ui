import * as React from "react";
import { Crown, Shield, User, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  usePermissions,
  useRolePermissions,
  useUpdateRolePermission,
  type Permission,
} from "@/hooks/use-permissions";

const ROLES = [
  { key: "owner" as const, label: "Owner", icon: Crown, color: "text-amber-600" },
  { key: "manager" as const, label: "Manager", icon: Shield, color: "text-blue-600" },
  { key: "staff" as const, label: "Staff", icon: User, color: "text-gray-600" },
];

type PendingChange = {
  role: "owner" | "manager" | "staff";
  permissionKey: string;
  enabled: boolean;
};

export function PermissionsMatrix() {
  const { data: permissions, isLoading: permLoading } = usePermissions();
  const { data: rolePermissions, isLoading: rpLoading } = useRolePermissions();
  const updatePermission = useUpdateRolePermission();
  const [pendingChanges, setPendingChanges] = React.useState<Map<string, PendingChange>>(new Map());
  const [isSaving, setIsSaving] = React.useState(false);

  const isLoading = permLoading || rpLoading;
  const hasChanges = pendingChanges.size > 0;

  // Group permissions by category
  const permissionsByCategory = React.useMemo(() => {
    if (!permissions) return {};
    return permissions.reduce((acc, perm) => {
      if (!acc[perm.category]) acc[perm.category] = [];
      acc[perm.category].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [permissions]);

  // Check if a role has a permission (including pending changes)
  const hasRolePermission = React.useCallback(
    (role: string, permissionKey: string) => {
      const changeKey = `${role}:${permissionKey}`;
      const pendingChange = pendingChanges.get(changeKey);
      if (pendingChange) {
        return pendingChange.enabled;
      }
      return rolePermissions?.some(
        (rp) => rp.role === role && rp.permission_key === permissionKey
      ) ?? false;
    },
    [rolePermissions, pendingChanges]
  );

  // Handle permission toggle (local state only)
  const handleToggle = (
    role: "owner" | "manager" | "staff",
    permissionKey: string,
    currentValue: boolean
  ) => {
    // Prevent removing critical owner permissions
    if (role === "owner" && permissionKey === "users.permissions" && currentValue) {
      toast.error("Cannot remove 'Manage Permissions' from Owner role");
      return;
    }

    const changeKey = `${role}:${permissionKey}`;
    const originalValue = rolePermissions?.some(
      (rp) => rp.role === role && rp.permission_key === permissionKey
    ) ?? false;
    const newValue = !currentValue;

    setPendingChanges((prev) => {
      const next = new Map(prev);
      // If the new value matches the original, remove from pending
      if (newValue === originalValue) {
        next.delete(changeKey);
      } else {
        next.set(changeKey, { role, permissionKey, enabled: newValue });
      }
      return next;
    });
  };

  // Save all pending changes
  const handleSave = async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      const changes = Array.from(pendingChanges.values());
      for (const change of changes) {
        await updatePermission.mutateAsync({
          role: change.role,
          permissionKey: change.permissionKey,
          enabled: change.enabled,
        });
      }
      setPendingChanges(new Map());
      toast.success(`${changes.length} permission${changes.length > 1 ? "s" : ""} updated`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to save permissions");
    } finally {
      setIsSaving(false);
    }
  };

  // Discard pending changes
  const handleDiscard = () => {
    setPendingChanges(new Map());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const categories = Object.keys(permissionsByCategory).sort();

  return (
    <div className="space-y-6">
      {/* Role Legend & Actions */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Role Permissions</CardTitle>
              <CardDescription>
                Configure what each role can access and modify. Click Save to apply changes.
              </CardDescription>
            </div>
            {hasChanges && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDiscard} disabled={isSaving}>
                  Discard
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save {pendingChanges.size} change{pendingChanges.size > 1 ? "s" : ""}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            {ROLES.map((role) => (
              <div key={role.key} className="flex items-center gap-2">
                <role.icon className={`h-4 w-4 ${role.color}`} />
                <span className="text-sm font-medium">{role.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Permissions by Category */}
      {categories.map((category) => (
        <Card key={category} className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline" className="font-normal">
                {category}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Header Row */}
              <div className="grid grid-cols-[1fr,repeat(3,80px)] gap-4 pb-2 border-b">
                <div className="text-sm font-medium text-muted-foreground">Permission</div>
                {ROLES.map((role) => (
                  <div key={role.key} className="text-center">
                    <role.icon className={`h-4 w-4 mx-auto ${role.color}`} />
                  </div>
                ))}
              </div>

              {/* Permission Rows */}
              {permissionsByCategory[category]?.map((permission) => (
                <div
                  key={permission.key}
                  className="grid grid-cols-[1fr,repeat(3,80px)] gap-4 items-center py-2 hover:bg-muted/30 rounded-md px-2 -mx-2"
                >
                  <div>
                    <p className="text-sm font-medium">{permission.name}</p>
                    {permission.description && (
                      <p className="text-xs text-muted-foreground">{permission.description}</p>
                    )}
                  </div>
                  {ROLES.map((role) => {
                    const hasPermission = hasRolePermission(role.key, permission.key);
                    const changeKey = `${role.key}:${permission.key}`;
                    const hasPendingChange = pendingChanges.has(changeKey);

                    return (
                      <div key={role.key} className="flex justify-center">
                        <Checkbox
                          checked={hasPermission}
                          onCheckedChange={() =>
                            handleToggle(role.key, permission.key, hasPermission)
                          }
                          disabled={isSaving}
                          className={hasPendingChange ? "ring-2 ring-primary ring-offset-1" : ""}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

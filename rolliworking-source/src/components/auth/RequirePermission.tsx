import { ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hasPermission, useUserPermissions } from "@/hooks/use-permissions";

type RequirePermissionProps = {
  permission: string;
  children: ReactNode;
};

export function RequirePermission({
  permission,
  children,
}: RequirePermissionProps) {
  const {
    data: userPermissions,
    isLoading,
    isFetching,
    isFetched,
    isError,
  } = useUserPermissions();

  const loading = isLoading || isFetching || !isFetched;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking access…
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Unable to verify access
            </CardTitle>
            <CardDescription>
              Please refresh the page. If this keeps happening, contact an owner.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const allowed = hasPermission(userPermissions, permission);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Access restricted
            </CardTitle>
            <CardDescription>
              You don’t have permission to view this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ask an owner to enable: <span className="font-mono">{permission}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

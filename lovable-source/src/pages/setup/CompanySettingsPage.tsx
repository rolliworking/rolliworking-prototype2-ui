import { useRolePermissions } from '@/hooks/useRolePermissions';
import { LogoUpload } from '@/components/settings/LogoUpload';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Loader2 } from 'lucide-react';

export default function CompanySettingsPage() {
  const { canAccessSetup, isLoading } = useRolePermissions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Company Settings</h1>
        <p className="text-muted-foreground">
          Manage your company branding and preferences
        </p>
      </div>

      <LogoUpload />
    </div>
  );
}

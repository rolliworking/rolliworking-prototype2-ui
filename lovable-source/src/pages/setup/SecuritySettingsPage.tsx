import { MFASettings } from '@/components/auth/MFASettings';

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security Settings</h1>
        <p className="text-muted-foreground">
          Manage your account security and authentication options
        </p>
      </div>

      <MFASettings />
    </div>
  );
}

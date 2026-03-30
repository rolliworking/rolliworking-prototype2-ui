import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Link2,
  Save,
  ExternalLink,
  Shield,
  Loader2 as Loader2Icon,
} from 'lucide-react';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface QBOAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  FullyQualifiedName?: string;
}

interface AccountMapping {
  id: string;
  mapping_key: string;
  mapping_label: string;
  qbo_account_id: string | null;
  qbo_account_name: string | null;
  qbo_account_type: string | null;
}

// Recommended account types for each mapping
const RECOMMENDED_TYPES: Record<string, string[]> = {
  inventory_asset: ['Other Current Asset'],
  cogs: ['Cost of Goods Sold'],
  accounts_receivable: ['Accounts Receivable'],
  accounts_payable: ['Accounts Payable'],
  sales_retail: ['Income'],
  shipping_accrual: ['Other Current Liability'],
  grni_holding: ['Other Current Liability'],
  undeposited_funds: ['Other Current Asset', 'Bank'],
};

// Descriptions for each mapping
const MAPPING_DESCRIPTIONS: Record<string, string> = {
  inventory_asset: 'Tracks the current value of unsold inventory',
  cogs: 'Records the cost of materials for sold items',
  accounts_receivable: 'Money owed to the business by customers',
  accounts_payable: 'Outstanding bills owed to suppliers',
  sales_retail: 'Tracks income from inventory sales',
  shipping_accrual: 'Tracks shipping expenses owed (alternative to A/P)',
  grni_holding: 'Used for "Goods Received Not Invoiced" clearing',
  undeposited_funds: 'Payments waiting for bank deposit',
};

export default function QBOAccountMappingsPage() {
  const queryClient = useQueryClient();
  const { canAccessSetup, isLoading: permissionsLoading } = useRolePermissions();
  const [useSandbox, setUseSandbox] = useState(false);
  const [localMappings, setLocalMappings] = useState<Record<string, { accountId: string; accountName: string; accountType: string }>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Permission check
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

  // Fetch current mappings from database
  const { data: mappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ['qbo-account-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qbo_account_mappings')
        .select('*')
        .order('mapping_key');
      
      if (error) throw error;
      return data as AccountMapping[];
    },
  });

  // Fetch QBO accounts
  const { data: qboData, isLoading: accountsLoading, error: accountsError, refetch: refetchAccounts } = useQuery({
    queryKey: ['qbo-accounts', useSandbox],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('qbo-accounts', {
        body: { use_sandbox: useSandbox },
      });
      
      if (error) throw error;
      if (!data.success) {
        throw new Error(data.message || data.error || 'Failed to fetch accounts');
      }
      return data as { accounts: QBOAccount[]; groupedAccounts: Record<string, QBOAccount[]> };
    },
    enabled: false, // Manual fetch only
    retry: false,
  });

  // Initialize local state from DB
  useEffect(() => {
    if (mappings) {
      const initial: Record<string, { accountId: string; accountName: string; accountType: string }> = {};
      mappings.forEach(m => {
        if (m.qbo_account_id) {
          initial[m.mapping_key] = {
            accountId: m.qbo_account_id,
            accountName: m.qbo_account_name || '',
            accountType: m.qbo_account_type || '',
          };
        }
      });
      setLocalMappings(initial);
    }
  }, [mappings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(localMappings).map(([key, value]) => ({
        mapping_key: key,
        qbo_account_id: value.accountId,
        qbo_account_name: value.accountName,
        qbo_account_type: value.accountType,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('qbo_account_mappings')
          .update({
            qbo_account_id: update.qbo_account_id,
            qbo_account_name: update.qbo_account_name,
            qbo_account_type: update.qbo_account_type,
          })
          .eq('mapping_key', update.mapping_key);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Account mappings saved');
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['qbo-account-mappings'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleAccountSelect = (mappingKey: string, accountId: string) => {
    const account = qboData?.accounts.find(a => a.Id === accountId);
    if (account) {
      setLocalMappings(prev => ({
        ...prev,
        [mappingKey]: {
          accountId: account.Id,
          accountName: account.Name,
          accountType: account.AccountType,
        },
      }));
      setHasChanges(true);
    }
  };

  const handleClearMapping = (mappingKey: string) => {
    setLocalMappings(prev => {
      const updated = { ...prev };
      delete updated[mappingKey];
      return updated;
    });
    setHasChanges(true);
  };

  const getFilteredAccounts = (mappingKey: string) => {
    if (!qboData?.groupedAccounts) return [];
    
    const recommended = RECOMMENDED_TYPES[mappingKey] || [];
    const result: { type: string; accounts: QBOAccount[] }[] = [];
    
    // Add recommended types first
    recommended.forEach(type => {
      if (qboData.groupedAccounts[type]) {
        result.push({ type, accounts: qboData.groupedAccounts[type] });
      }
    });
    
    // Add other types
    Object.entries(qboData.groupedAccounts).forEach(([type, accounts]) => {
      if (!recommended.includes(type)) {
        result.push({ type, accounts });
      }
    });
    
    return result;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">QBO Account Mappings</h1>
          <p className="text-muted-foreground">Link your system accounts to QuickBooks Online accounts</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="sandbox-mode"
              checked={useSandbox}
              onCheckedChange={setUseSandbox}
            />
            <Label htmlFor="sandbox-mode" className="text-sm">
              Sandbox Mode
            </Label>
          </div>
          <Button
            variant="outline"
            onClick={() => refetchAccounts()}
            disabled={accountsLoading}
          >
            {accountsLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {qboData ? 'Refresh Accounts' : 'Fetch QBO Accounts'}
          </Button>
        </div>
      </div>

      {accountsError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {(accountsError as Error).message}
            {(accountsError as Error).message.includes('reconnect') && (
              <span className="block mt-2">
                Please run a{' '}
                <a href="/setup/qbo-customers" className="underline">
                  manual customer sync
                </a>{' '}
                first to establish the connection.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {qboData && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>
            Connected to QuickBooks {useSandbox ? '(Sandbox)' : '(Production)'} - {qboData.accounts.length} accounts available
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Account Mappings
          </CardTitle>
          <CardDescription>
            Map each system account to its corresponding QuickBooks account for export
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mappingsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {mappings?.map((mapping) => (
                <div key={mapping.id} className="grid grid-cols-[200px_1fr_auto] gap-4 items-start p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{mapping.mapping_label}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {MAPPING_DESCRIPTIONS[mapping.mapping_key]}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    {qboData ? (
                      <Select
                        value={localMappings[mapping.mapping_key]?.accountId || ''}
                        onValueChange={(value) => handleAccountSelect(mapping.mapping_key, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select QBO account..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {getFilteredAccounts(mapping.mapping_key).map(({ type, accounts }) => (
                            <SelectGroup key={type}>
                              <SelectLabel className="text-xs uppercase text-muted-foreground bg-muted/50 px-2 py-1">
                                {type}
                              </SelectLabel>
                              {accounts.map((account) => (
                                <SelectItem key={account.Id} value={account.Id}>
                                  {account.Name}
                                  {account.AccountSubType && (
                                    <span className="text-muted-foreground ml-2 text-xs">
                                      ({account.AccountSubType})
                                    </span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="h-10 px-3 border rounded-md bg-muted/50 flex items-center text-muted-foreground text-sm">
                        {localMappings[mapping.mapping_key]?.accountName || 'Fetch QBO accounts to configure'}
                      </div>
                    )}
                    
                    {localMappings[mapping.mapping_key] && (
                      <p className="text-xs text-muted-foreground">
                        Linked to: {localMappings[mapping.mapping_key].accountName} ({localMappings[mapping.mapping_key].accountType})
                      </p>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleClearMapping(mapping.mapping_key)}
                    disabled={!localMappings[mapping.mapping_key]}
                    className="text-muted-foreground"
                  >
                    Clear
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!hasChanges || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Mappings
        </Button>
      </div>
    </div>
  );
}

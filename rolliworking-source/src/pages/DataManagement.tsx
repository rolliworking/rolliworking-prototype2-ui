import * as React from "react";
import { Download, Database, Users, Briefcase, Mail, Watch, ClipboardList, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { usePageMeta } from "@/hooks/use-page-meta";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  arrayToCSV,
  downloadCSV,
  getExportFilename,
  CUSTOMER_COLUMNS,
  JOB_COLUMNS,
  EMAIL_TEMPLATE_COLUMNS,
  WATCH_COLUMNS,
  INSPECTION_COLUMNS,
} from "@/lib/csv-export";

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  table: string;
  columns: { key: string; header: string }[];
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: "customers",
    label: "Customers",
    description: "All client records including name, email, and phone",
    icon: <Users className="h-5 w-5" />,
    table: "customers",
    columns: CUSTOMER_COLUMNS,
  },
  {
    id: "jobs",
    label: "Jobs",
    description: "All job records with status, services, and dates",
    icon: <Briefcase className="h-5 w-5" />,
    table: "jobs",
    columns: JOB_COLUMNS,
  },
  {
    id: "watches",
    label: "Watches",
    description: "All watch records linked to customers",
    icon: <Watch className="h-5 w-5" />,
    table: "watches",
    columns: WATCH_COLUMNS,
  },
  {
    id: "inspections",
    label: "Inspections",
    description: "All inspection records with condition data",
    icon: <ClipboardList className="h-5 w-5" />,
    table: "inspections",
    columns: INSPECTION_COLUMNS,
  },
  {
    id: "email_templates",
    label: "Email Templates",
    description: "All saved email templates",
    icon: <Mail className="h-5 w-5" />,
    table: "email_templates",
    columns: EMAIL_TEMPLATE_COLUMNS,
  },
];

export default function DataManagement() {
  usePageMeta({ title: "Data Management | Rolliworks" });

  const [exporting, setExporting] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<{ success: boolean; synced?: number; message?: string } | null>(null);
  const [recordCount, setRecordCount] = React.useState<number | null>(null);

  // Fetch RolliSuite record count on mount
  React.useEffect(() => {
    const fetchRecordCount = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('rollisuite-sync', {
          method: 'GET',
        });
        if (!error && data?.total_records !== undefined) {
          setRecordCount(data.total_records);
        }
      } catch (err) {
        console.error('Failed to fetch RolliSuite record count:', err);
      }
    };
    fetchRecordCount();
  }, []);

  const handleRolliSuiteSync = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      // Fetch all watches to sync
      const { data: watches, error: fetchError } = await supabase
        .from('watches')
        .select('brand, model, reference_number')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      if (!watches || watches.length === 0) {
        toast.info('No watch data to sync');
        setSyncing(false);
        return;
      }

      // Transform to RolliSuite format and deduplicate by part_number
      const recordsMap = new Map<string, { part_number: string; brand: string; model?: string }>();
      
      watches
        .filter(w => w.reference_number && w.brand)
        .forEach(w => {
          // Extract base reference number (before any dash with serial)
          const partNumber = w.reference_number!.split('-')[0];
          // Only keep the first occurrence of each part number
          if (!recordsMap.has(partNumber)) {
            recordsMap.set(partNumber, {
              part_number: partNumber,
              brand: w.brand,
              model: w.model || undefined,
            });
          }
        });

      const records = Array.from(recordsMap.values());

      if (records.length === 0) {
        toast.info('No watches with reference numbers to sync');
        setSyncing(false);
        return;
      }

      // Call the sync edge function
      const { data, error } = await supabase.functions.invoke('rollisuite-sync', {
        body: { records },
      });

      if (error) throw error;

      setSyncResult(data);
      if (data?.success) {
        toast.success(`Synced ${data.synced || 0} model references to RolliSuite`);
        // Refresh record count
        const { data: countData } = await supabase.functions.invoke('rollisuite-sync', {
          method: 'GET',
        });
        if (countData?.total_records !== undefined) {
          setRecordCount(countData.total_records);
        }
      } else {
        toast.error(data?.error || 'Sync failed');
      }
    } catch (err) {
      console.error('RolliSuite sync error:', err);
      toast.error('Failed to sync with RolliSuite');
      setSyncResult({ success: false, message: 'Connection error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = async (option: ExportOption) => {
    setExporting(option.id);

    try {
      // Fetch all data from the table
      const { data, error } = await supabase
        .from(option.table as "customers" | "jobs" | "watches" | "inspections" | "email_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info(`No ${option.label.toLowerCase()} data to export`);
        setExporting(null);
        return;
      }

      // Convert to CSV
      const csvContent = arrayToCSV(data, option.columns as { key: keyof typeof data[0]; header: string }[]);
      const filename = getExportFilename(option.id);

      // Download
      downloadCSV(csvContent, filename);

      toast.success(`Exported ${data.length} ${option.label.toLowerCase()} records`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error(`Failed to export ${option.label.toLowerCase()}`);
    } finally {
      setExporting(null);
    }
  };

  const handleExportAll = async () => {
    setExporting("all");

    try {
      for (const option of EXPORT_OPTIONS) {
        const { data, error } = await supabase
          .from(option.table as "customers" | "jobs" | "watches" | "inspections" | "email_templates")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error(`Error exporting ${option.table}:`, error);
          continue;
        }

        if (data && data.length > 0) {
          const csvContent = arrayToCSV(data, option.columns as { key: keyof typeof data[0]; header: string }[]);
          const filename = getExportFilename(option.id);
          downloadCSV(csvContent, filename);
        }
      }

      toast.success("All data exported successfully");
    } catch (err) {
      console.error("Export all error:", err);
      toast.error("Failed to export some data");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Management</h1>
        <p className="text-muted-foreground">
          Export your data as CSV files for backup or bulk editing
        </p>
      </div>

      {/* Export All Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Full Backup
          </CardTitle>
          <CardDescription>
            Download all data tables at once for a complete backup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleExportAll}
            disabled={exporting !== null}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting === "all" ? "Exporting..." : "Export All Data"}
          </Button>
        </CardContent>
      </Card>

      {/* RolliSuite Sync Card */}
      <Card className="border-accent/20 bg-accent/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              RolliSuite Model Sync
            </CardTitle>
            {recordCount !== null && (
              <Badge variant="secondary" className="text-xs">
                {recordCount} records in RolliSuite
              </Badge>
            )}
          </div>
          <CardDescription>
            Push watch model references to RolliSuite for auto-decode functionality.
            Syncs automatically on new watch intake, or manually sync all records here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={handleRolliSuiteSync}
            disabled={syncing || exporting !== null}
            variant="secondary"
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? "Syncing..." : "Sync All Model References"}
          </Button>
          
          {syncResult && (
            <div className={`flex items-center gap-2 text-sm ${syncResult.success ? 'text-green-600' : 'text-destructive'}`}>
              {syncResult.success ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Successfully synced {syncResult.synced || 0} records</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <span>{syncResult.message || 'Sync failed'}</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual Export Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {EXPORT_OPTIONS.map((option) => (
          <Card key={option.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {option.icon}
                {option.label}
              </CardTitle>
              <CardDescription className="text-sm">
                {option.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport(option)}
                disabled={exporting !== null}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting === option.id ? "Exporting..." : "Export CSV"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">About CSV Exports</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Format:</strong> Files are exported in CSV (Comma-Separated Values) format, 
            compatible with Excel, Google Sheets, and other spreadsheet applications.
          </p>
          <p>
            <strong>Editing:</strong> You can open these files, make corrections, and save them 
            for future reference or to prepare bulk updates.
          </p>
          <p>
            <strong>IDs:</strong> Each record includes its unique ID, which can be used to match 
            records when preparing data corrections.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

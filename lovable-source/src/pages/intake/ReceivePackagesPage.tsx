import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Package,
  ScanBarcode,
  Trash2,
  Mail,
  CheckCircle2,
  Search,
  History,
  Clock,
  Shield,
  Save,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface ScannedBarcode {
  barcode: string;
  formattedBarcode: string;
  carrier: string;
  scannedAt: Date;
}

interface MatchedClient {
  trackingNumber: string;
  trackingFormatted: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  estimateId: string;
  estimateNumber: string;
  watchBrand?: string;
  watchModel?: string;
  emailSent: boolean;
  carrier: string;
}

interface UnmatchedScan {
  barcode: string;
  formattedBarcode: string;
  carrier: string;
  scannedAt: Date;
}

interface ScanLogEntry {
  id: string;
  tracking_number: string;
  tracking_formatted: string | null;
  carrier: string | null;
  scanned_at: string;
  matched_customer_id: string | null;
  email_sent: boolean;
  customers?: {
    first_name: string;
    last_name: string;
    company_name: string | null;
  } | null;
}

// Helper to normalize tracking numbers for matching
// Extracts FedEx tracking (12-15 digits) from composite barcodes like "1027637542120003313200887920660105"
function normalizeTracking(tracking: string): string {
  const cleaned = tracking.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
  
  // Check if this is a long composite barcode containing a FedEx tracking number
  // FedEx ground/home barcodes often have 12-digit tracking embedded at the end
  if (cleaned.length > 20 && /^\d+$/.test(cleaned)) {
    // Try to extract 12-digit FedEx tracking from the end (common pattern)
    const last12 = cleaned.slice(-12);
    if (/^\d{12}$/.test(last12)) {
      return last12;
    }
  }
  
  return cleaned;
}

// Normalize estimate number for flexible matching
// Supports: EST-20355, E20355, e20355, 20355, etc.
function normalizeEstimateNumber(input: string): string {
  const cleaned = input.replace(/\s+/g, '').toUpperCase();
  // Remove common prefixes: EST-, EST, E
  const numericPart = cleaned
    .replace(/^EST-?/i, '')
    .replace(/^E(?=\d)/i, '');
  return numericPart;
}

// Check if input looks like an estimate number (primarily numeric, possibly with E/EST prefix)
function looksLikeEstimateNumber(input: string): boolean {
  const cleaned = input.replace(/\s+/g, '').toUpperCase();
  // Matches: 20355, E20355, EST20355, EST-20355
  return /^(EST-?|E)?\d{3,}$/i.test(cleaned);
}

// Detect carrier from barcode
function detectCarrier(barcode: string): string {
  const normalized = normalizeTracking(barcode);
  if (normalized.length === 12 && /^\d+$/.test(normalized)) return 'FedEx';
  if (normalized.length === 15 && /^\d+$/.test(normalized)) return 'FedEx';
  if (normalized.length === 22 && /^1Z/.test(normalized)) return 'UPS';
  if (normalized.length === 22 && /^\d+$/.test(normalized)) return 'USPS';
  if (normalized.length === 20 && /^\d+$/.test(normalized)) return 'USPS';
  return 'Unknown';
}

// Format tracking number for display
function formatTrackingDisplay(tracking: string): string {
  const normalized = normalizeTracking(tracking);
  // Format as groups of 4 for FedEx-style
  if (/^\d{12,15}$/.test(normalized)) {
    return normalized.match(/.{1,4}/g)?.join(' ') || normalized;
  }
  return normalized;
}

export default function ReceiveWatchPage() {
  const { user, permissions } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // All state hooks MUST be declared before any early returns
  const [activeTab, setActiveTab] = useState('scan');
  const [scannedBarcodes, setScannedBarcodes] = useState<ScannedBarcode[]>([]);
  const [matchedClients, setMatchedClients] = useState<MatchedClient[]>([]);
  const [unmatchedScans, setUnmatchedScans] = useState<UnmatchedScan[]>([]);
  const [hasSaved, setHasSaved] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyDate, setHistoryDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Fetch all shipping labels for matching
  const { data: shippingLabels = [] } = useQuery({
    queryKey: ['shipping-labels-for-matching'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_labels')
        .select(`
          id,
          tracking_number,
          tracking_number_formatted,
          estimate_id,
          customer_id,
          estimates:estimate_id(
            id,
            estimate_number,
            watch:watches(brand, model)
          ),
          customers:customer_id(
            id,
            first_name,
            last_name,
            company_name,
            email
          )
        `)
        .not('tracking_number', 'is', null);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch estimates for estimate number matching
  const { data: estimates = [] } = useQuery({
    queryKey: ['estimates-for-matching'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimates')
        .select(`
          id,
          estimate_number,
          customer_id,
          watch:watches(brand, model),
          customers:customer_id(
            id,
            first_name,
            last_name,
            company_name,
            email
          )
        `)
        .in('status', ['sent', 'converted', 'draft']);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch scan history for selected date
  const { data: scanHistory = [] } = useQuery({
    queryKey: ['package-scan-history', historyDate],
    queryFn: async () => {
      const startOfDay = `${historyDate}T00:00:00.000Z`;
      const endOfDay = `${historyDate}T23:59:59.999Z`;
      
      const { data, error } = await supabase
        .from('package_scan_logs')
        .select(`
          id,
          tracking_number,
          tracking_formatted,
          carrier,
          scanned_at,
          matched_customer_id,
          email_sent,
          customers:matched_customer_id(first_name, last_name, company_name)
        `)
        .gte('scanned_at', startOfDay)
        .lte('scanned_at', endOfDay)
        .order('scanned_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as ScanLogEntry[];
    },
    enabled: activeTab === 'history',
  });

  // Search scan logs
  const { data: searchResults = [] } = useQuery({
    queryKey: ['package-scan-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      
      const normalized = normalizeTracking(searchQuery);
      
      const { data, error } = await supabase
        .from('package_scan_logs')
        .select(`
          id,
          tracking_number,
          tracking_formatted,
          carrier,
          scanned_at,
          matched_customer_id,
          email_sent,
          customers:matched_customer_id(first_name, last_name, company_name)
        `)
        .or(`tracking_number.ilike.%${normalized}%,tracking_formatted.ilike.%${searchQuery}%`)
        .order('scanned_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return (data || []) as ScanLogEntry[];
    },
    enabled: searchQuery.length >= 3,
  });

  // Save scanned barcodes mutation
  const saveScansMutation = useMutation({
    mutationFn: async () => {
      // Build matched and unmatched lists at save time for final state
      const matched: MatchedClient[] = [];
      const unmatched: UnmatchedScan[] = [];

      scannedBarcodes.forEach(scan => {
        const normalizedScan = scan.formattedBarcode;
        
        // Check if this is an estimate number entry
        if (normalizedScan.startsWith('EST:')) {
          const estNumericPart = normalizedScan.replace('EST:', '');
          const matchingEstimate = estimates.find(est => {
            const storedNumeric = (est.estimate_number || '').replace(/\D/g, '');
            return storedNumeric === estNumericPart;
          });

          if (matchingEstimate && matchingEstimate.customers) {
            const customer = matchingEstimate.customers as any;
            const customerName = customer.company_name || 
              `${customer.first_name} ${customer.last_name}`.trim();

            if (!matched.find(m => m.estimateId === matchingEstimate.id)) {
              matched.push({
                trackingNumber: normalizedScan,
                trackingFormatted: scan.barcode,
                customerId: customer.id,
                customerName,
                customerEmail: customer.email || '',
                estimateId: matchingEstimate.id,
                estimateNumber: matchingEstimate.estimate_number,
                watchBrand: (matchingEstimate.watch as any)?.brand,
                watchModel: (matchingEstimate.watch as any)?.model,
                emailSent: false,
                carrier: scan.carrier,
              });
            }
          } else {
            unmatched.push(scan);
          }
          return;
        }
        
        // Try to match by tracking number in shipping_labels
        const matchingLabel = shippingLabels.find(label => {
          const labelTracking = normalizeTracking(label.tracking_number || '');
          return labelTracking === normalizedScan;
        });

        if (matchingLabel && matchingLabel.customers) {
          const customer = matchingLabel.customers as any;
          const estimate = matchingLabel.estimates as any;
          const customerName = customer.company_name || 
            `${customer.first_name} ${customer.last_name}`.trim();

          if (!matched.find(m => m.trackingNumber === normalizedScan)) {
            matched.push({
              trackingNumber: normalizedScan,
              trackingFormatted: scan.barcode,
              customerId: customer.id,
              customerName,
              customerEmail: customer.email || '',
              estimateId: estimate?.id || matchingLabel.estimate_id,
              estimateNumber: estimate?.estimate_number || '',
              watchBrand: estimate?.watch?.brand,
              watchModel: estimate?.watch?.model,
              emailSent: false,
              carrier: scan.carrier,
            });
          }
        } else {
          unmatched.push(scan);
        }
      });

      // Save to database
      const logs = scannedBarcodes.map(barcode => {
        const match = matched.find(m => m.trackingNumber === barcode.formattedBarcode);
        return {
          tracking_number: barcode.formattedBarcode,
          tracking_formatted: barcode.barcode,
          carrier: barcode.carrier,
          scanned_at: barcode.scannedAt.toISOString(),
          scanned_by: user?.id,
          matched_customer_id: match?.customerId || null,
          matched_estimate_id: match?.estimateId || null,
          email_sent: false,
        };
      });

      const { error } = await supabase
        .from('package_scan_logs')
        .insert(logs);
      
      if (error) throw error;
      
      return { matched, unmatched };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['package-scan-history'] });
      const matchCount = result.matched.length;
      const unmatchCount = result.unmatched.length;
      toast({
        title: 'Scans saved',
        description: `${scannedBarcodes.length} barcodes logged. ${matchCount} matched, ${unmatchCount} not found.`,
      });
      // Set saved state and populate result lists
      setMatchedClients(result.matched);
      setUnmatchedScans(result.unmatched);
      setScannedBarcodes([]);
      setHasSaved(true);
    },
    onError: (error: any) => {
      toast({
        title: 'Error saving scans',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Helper to find estimate ID from a formattedBarcode
  const findEstimateIdForBarcode = useCallback((formattedBarcode: string): string | null => {
    // Check if it's a direct estimate entry
    if (formattedBarcode.startsWith('EST:')) {
      const estNumericPart = formattedBarcode.replace('EST:', '');
      const matchingEstimate = estimates.find(est => {
        const storedNumeric = (est.estimate_number || '').replace(/\D/g, '');
        return storedNumeric === estNumericPart;
      });
      return matchingEstimate?.id || null;
    }
    
    // Check if it's a tracking number that matches a shipping label
    const matchingLabel = shippingLabels.find(label => {
      const labelTracking = normalizeTracking(label.tracking_number || '');
      return labelTracking === formattedBarcode;
    });
    return matchingLabel?.estimate_id || null;
  }, [estimates, shippingLabels]);

  // Handle barcode scan
  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scanInput.trim()) {
      const barcode = scanInput.trim();
      
      // For estimate numbers, use the original input as formattedBarcode
      // For tracking numbers, normalize them
      const isEstimate = looksLikeEstimateNumber(barcode);
      const formattedBarcode = isEstimate 
        ? `EST:${normalizeEstimateNumber(barcode)}` 
        : normalizeTracking(barcode);
      const carrier = isEstimate ? 'Estimate' : detectCarrier(barcode);

      // Check for exact barcode duplicates
      if (scannedBarcodes.find(s => s.formattedBarcode === formattedBarcode)) {
        toast({
          title: 'Duplicate scan',
          description: isEstimate 
            ? 'This estimate number has already been entered.'
            : 'This barcode has already been scanned.',
          variant: 'destructive',
        });
        setScanInput('');
        return;
      }

      // Check if same estimate already received via different method (tracking vs estimate#)
      const newEstimateId = findEstimateIdForBarcode(formattedBarcode);
      if (newEstimateId) {
        const existingBarcode = scannedBarcodes.find(s => {
          const existingEstimateId = findEstimateIdForBarcode(s.formattedBarcode);
          return existingEstimateId === newEstimateId;
        });
        
        if (existingBarcode) {
          const wasViaTracking = !existingBarcode.formattedBarcode.startsWith('EST:');
          toast({
            title: 'Item already received',
            description: wasViaTracking 
              ? `This item was already received via tracking# ${formatTrackingDisplay(existingBarcode.formattedBarcode)}`
              : `This item was already received via estimate# ${existingBarcode.formattedBarcode.replace('EST:', '')}`,
            variant: 'destructive',
          });
          setScanInput('');
          return;
        }
      }

      setScannedBarcodes(prev => [...prev, {
        barcode,
        formattedBarcode,
        carrier,
        scannedAt: new Date(),
      }]);
      setScanInput('');
      scanInputRef.current?.focus();
    }
  };

  // Remove a scanned barcode
  const removeBarcode = (index: number) => {
    setScannedBarcodes(prev => prev.filter((_, i) => i !== index));
  };

  // Clear all scanned barcodes
  const clearAllBarcodes = () => {
    setScannedBarcodes([]);
    setMatchedClients([]);
    setUnmatchedScans([]);
    setHasSaved(false);
  };

  // Handle email sending and return to scan
  const handleSendEmail = (client: MatchedClient) => {
    // Mark as email sent in local state
    setMatchedClients(prev => 
      prev.map(c => c.trackingNumber === client.trackingNumber 
        ? { ...c, emailSent: true } 
        : c
      )
    );

    // Navigate to intake email with estimate pre-loaded
    navigate(`/intake/email?estimate=${client.estimateNumber}`);
  };

  // Mark email as sent from matching (after returning from email page)
  const markEmailSent = async (trackingNumber: string) => {
    const { error } = await supabase
      .from('package_scan_logs')
      .update({ email_sent: true, email_sent_at: new Date().toISOString() })
      .eq('tracking_number', trackingNumber);
    
    if (error) {
      console.error('Error marking email sent:', error);
    }
    
    queryClient.invalidateQueries({ queryKey: ['package-scan-history'] });
  };

  // Focus scan input when tab becomes active
  useEffect(() => {
    if (activeTab === 'scan') {
      setTimeout(() => scanInputRef.current?.focus(), 100);
    }
  }, [activeTab]);

  // Filter history by search
  const filteredHistory = historySearchQuery
    ? scanHistory.filter(log => 
        log.tracking_number.includes(normalizeTracking(historySearchQuery)) ||
        log.tracking_formatted?.includes(historySearchQuery)
      )
    : scanHistory;

  const pendingEmailClients = matchedClients.filter(c => !c.emailSent);

  // Start new batch - clear saved results
  const startNewBatch = () => {
    setScannedBarcodes([]);
    setMatchedClients([]);
    setUnmatchedScans([]);
    setHasSaved(false);
    scanInputRef.current?.focus();
  };

  // Permission check - render denied message if no access
  if (!permissions.canAccessIntake) {
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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-serif font-semibold">Receive Packages</h1>
          <p className="text-sm text-muted-foreground">
            Scan barcodes or enter estimate numbers to match clients
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="scan" className="flex items-center gap-2">
            <ScanBarcode className="h-4 w-4" />
            Bulk Scan
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-6 mt-6">
          {/* Scan Input - Only show when not in saved state */}
          {!hasSaved && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ScanBarcode className="h-4 w-4" />
                  Barcode Scanner
                </CardTitle>
                <CardDescription>
                  Scan barcodes or type estimate numbers (e.g., 20355, E20355, EST-20355). Press Enter after each entry.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    ref={scanInputRef}
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={handleScan}
                    placeholder="Scan barcode or type estimate # (e.g., 20355)..."
                    className="font-mono text-lg"
                    autoFocus
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setScanInput('')}
                    disabled={!scanInput}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {scannedBarcodes.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {scannedBarcodes.length} barcode(s) scanned
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={clearAllBarcodes}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clear All
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => saveScansMutation.mutate()}
                          disabled={saveScansMutation.isPending}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save Record
                        </Button>
                      </div>
                    </div>

                    <ScrollArea className="h-[200px] border rounded-md p-2">
                      <div className="space-y-2">
                        {scannedBarcodes.map((scan, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm">
                                {formatTrackingDisplay(scan.formattedBarcode)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {scan.carrier}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(scan.scannedAt, 'HH:mm:ss')}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeBarcode(idx)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Saved Results - Show after saving */}
          {hasSaved && (
            <>
              {/* Header with New Batch button */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Scan Results</h2>
                <Button onClick={startNewBatch}>
                  <ScanBarcode className="h-4 w-4 mr-2" />
                  Start New Batch
                </Button>
              </div>

              {/* Found / Matched Clients */}
              {matchedClients.length > 0 && (
                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-green-800">
                      <CheckCircle2 className="h-4 w-4" />
                      Found ({matchedClients.length})
                    </CardTitle>
                    <CardDescription>
                      {pendingEmailClients.length > 0 
                        ? `${pendingEmailClients.length} client(s) pending email notification`
                        : 'All clients have been notified'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {matchedClients.map((client, idx) => (
                        <div 
                          key={idx}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            client.emailSent 
                              ? 'bg-muted/50 border-muted' 
                              : 'bg-white border-green-200'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{client.customerName}</span>
                              <Badge variant="outline" className="text-xs">
                                {client.carrier}
                              </Badge>
                              {client.emailSent && (
                                <Badge variant="outline" className="text-xs text-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Email Sent
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <span>Est: {client.estimateNumber}</span>
                              {client.watchBrand && (
                                <span className="ml-2">
                                  • {client.watchBrand} {client.watchModel || ''}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {formatTrackingDisplay(client.trackingNumber)}
                            </div>
                          </div>
                          
                          {!client.emailSent && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendEmail(client)}
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Send Email
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Not Found / Unmatched Scans */}
              {unmatchedScans.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                      <Package className="h-4 w-4" />
                      Not Found ({unmatchedScans.length})
                    </CardTitle>
                    <CardDescription>
                      No shipping label on file - client shipped on their own
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {unmatchedScans.map((scan, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg border bg-white border-amber-200"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm">
                              {formatTrackingDisplay(scan.formattedBarcode)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {scan.carrier}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(scan.scannedAt, 'HH:mm:ss')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Show message if all matched */}
              {matchedClients.length === 0 && unmatchedScans.length === 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">
                      No scans were saved.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Search Scans - Always available */}
          {!hasSaved && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search Scan Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by tracking number..."
                  className="font-mono"
                />
                
                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {searchResults.map(log => (
                      <div 
                        key={log.id}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono">
                            {formatTrackingDisplay(log.tracking_number)}
                          </span>
                          <Badge variant="outline">{log.carrier || 'Unknown'}</Badge>
                          {log.customers && (
                            <span className="text-muted-foreground">
                              {(log.customers as any).company_name || 
                                `${(log.customers as any).first_name} ${(log.customers as any).last_name}`.trim()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {log.email_sent && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                          {format(new Date(log.scanned_at), 'MMM d, yyyy HH:mm')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Scan History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    type="date"
                    value={historyDate}
                    onChange={(e) => setHistoryDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Filter by tracking..."
                    className="font-mono"
                  />
                </div>
              </div>

              <Separator />

              {filteredHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No scans recorded for this date.
                </p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {filteredHistory.map(log => (
                      <div 
                        key={log.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">
                              {formatTrackingDisplay(log.tracking_number)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {log.carrier || 'Unknown'}
                            </Badge>
                            {log.email_sent && (
                              <Badge variant="outline" className="text-xs text-green-600">
                                <Mail className="h-3 w-3 mr-1" />
                                Notified
                              </Badge>
                            )}
                          </div>
                          {log.customers && (
                            <span className="text-sm text-muted-foreground">
                              Matched: {(log.customers as any).company_name || 
                                `${(log.customers as any).first_name} ${(log.customers as any).last_name}`.trim()}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(log.scanned_at), 'HH:mm:ss')}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              <div className="text-xs text-muted-foreground text-right">
                {filteredHistory.length} record(s)
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

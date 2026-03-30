import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, ArrowRight, Percent, ClipboardList, Mail, Package, Clock, AlertTriangle } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subDays, format } from 'date-fns';

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'year' | string;

interface BandFunnelMetrics {
  totalBandOnlyEstimates: number;
  bandEstimatesWithLabels: number;
  bandEstimatesWithInspections: number;
  estimateToLabelRate: number;
  labelToInspectionRate: number;
  overallConversionRate: number;
}

interface AgingMetrics {
  over30Days: number;
  over60Days: number;
  over90Days: number;
}

function getDateRange(filter: DateFilter): { start: Date; end: Date; label: string } {
  const now = new Date();
  
  if (filter === 'today') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return { start: startOfDay, end: endOfDay, label: 'Today' };
  }
  
  if (filter === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
    const endOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
    return { start: startOfDay, end: endOfDay, label: 'Yesterday' };
  }
  
  if (filter === 'week') {
    return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }), label: 'This Week' };
  }
  
  if (filter === 'month') {
    return { start: startOfMonth(now), end: endOfMonth(now), label: 'This Month' };
  }
  
  if (filter === 'year') {
    return { start: startOfYear(now), end: endOfYear(now), label: 'This Year' };
  }
  
  if (filter.match(/^\d{4}-\d{2}$/)) {
    const [year, month] = filter.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return { start: startOfMonth(date), end: endOfMonth(date), label: format(date, 'MMMM yyyy') };
  }
  
  return { start: new Date(2020, 0, 1), end: now, label: 'All Time' };
}

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = subMonths(now, i);
    options.push({ value: format(date, 'yyyy-MM'), label: format(date, 'MMMM yyyy') });
  }
  
  return options;
}

// Helper to check if line items contain band/bracelet category
function hasBandCategory(lineItems: { description: string; part?: { category: string | null } | null }[]): boolean {
  return lineItems.some(item => {
    const partCategory = item.part?.category?.toLowerCase();
    if (partCategory === 'bracelet') return true;
    
    const desc = item.description?.toLowerCase() || '';
    if (desc.includes('bracelet') || desc.includes('band') || desc.includes('jubilee')) return true;
    
    return false;
  });
}

// Helper to check if line items contain watch category
function hasWatchCategory(lineItems: { description: string; part?: { category: string | null } | null }[]): boolean {
  return lineItems.some(item => {
    const partCategory = item.part?.category?.toLowerCase();
    if (partCategory === 'watch' || partCategory === 'watch_case') return true;
    
    const desc = item.description?.toLowerCase() || '';
    if (desc.includes('watch') && !desc.includes('bracelet') && !desc.includes('band')) return true;
    
    return false;
  });
}

// Helper to check if line items contain shipping label
function hasShippingLabel(lineItems: { description: string }[]): boolean {
  return lineItems.some(item => {
    const desc = item.description?.toLowerCase() || '';
    return desc.includes('shipping label') || desc.includes('prepaid label');
  });
}

export default function BandEstimatesFunnelPage() {
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const { start, end, label } = getDateRange(dateFilter);
  const monthOptions = generateMonthOptions();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['band-estimates-funnel', dateFilter],
    queryFn: async (): Promise<BandFunnelMetrics> => {
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      // Fetch all estimates with their line items and parts
      const { data: estimatesWithItems } = await supabase
        .from('estimates')
        .select(`
          id,
          estimate_number,
          estimate_line_items (
            id,
            description,
            part:parts (
              category
            )
          )
        `)
        .gte('created_at', startISO)
        .lte('created_at', endISO);

      // Filter to band-only estimates (has band, but NOT watch)
      const bandOnlyEstimates = (estimatesWithItems || []).filter(est => {
        const lineItems = est.estimate_line_items || [];
        const hasBand = hasBandCategory(lineItems);
        const hasWatch = hasWatchCategory(lineItems);
        return hasBand && !hasWatch;
      });

      const totalBandOnlyEstimates = bandOnlyEstimates.length;
      const bandOnlyEstimateIds = bandOnlyEstimates.map(e => e.id);

      // Count band-only estimates with shipping labels
      const bandEstimatesWithLabels = bandOnlyEstimates.filter(est => {
        const lineItems = est.estimate_line_items || [];
        return hasShippingLabel(lineItems);
      }).length;

      // Fetch inspection requests for band-only estimates
      let bandEstimatesWithInspections = 0;
      if (bandOnlyEstimateIds.length > 0) {
        const { data: inspections } = await supabase
          .from('inspection_requests')
          .select('estimate_id, status')
          .in('estimate_id', bandOnlyEstimateIds)
          .eq('status', 'completed');

        bandEstimatesWithInspections = new Set(inspections?.map(i => i.estimate_id) || []).size;
      }

      // Calculate conversion rates
      const estimateToLabelRate = totalBandOnlyEstimates > 0 
        ? (bandEstimatesWithLabels / totalBandOnlyEstimates) * 100 
        : 0;
      
      const labelToInspectionRate = bandEstimatesWithLabels > 0 
        ? (bandEstimatesWithInspections / bandEstimatesWithLabels) * 100 
        : 0;
      
      const overallConversionRate = totalBandOnlyEstimates > 0 
        ? (bandEstimatesWithInspections / totalBandOnlyEstimates) * 100 
        : 0;

      return {
        totalBandOnlyEstimates,
        bandEstimatesWithLabels,
        bandEstimatesWithInspections,
        estimateToLabelRate,
        labelToInspectionRate,
        overallConversionRate,
      };
    },
  });

  // Fetch aging metrics (not filtered by date - these are stale estimates)
  const { data: agingMetrics, isLoading: isLoadingAging } = useQuery({
    queryKey: ['band-estimates-aging'],
    queryFn: async (): Promise<AgingMetrics> => {
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30).toISOString();
      const sixtyDaysAgo = subDays(now, 60).toISOString();
      const ninetyDaysAgo = subDays(now, 90).toISOString();

      // Fetch all band-only estimates that are still in 'draft' or 'sent' status (not converted)
      const { data: estimatesWithItems } = await supabase
        .from('estimates')
        .select(`
          id,
          created_at,
          status,
          estimate_line_items (
            id,
            description,
            part:parts (
              category
            )
          )
        `)
        .in('status', ['draft', 'sent'])
        .lte('created_at', thirtyDaysAgo);

      // Filter to band-only estimates
      const bandOnlyEstimates = (estimatesWithItems || []).filter(est => {
        const lineItems = est.estimate_line_items || [];
        const hasBand = hasBandCategory(lineItems);
        const hasWatch = hasWatchCategory(lineItems);
        return hasBand && !hasWatch;
      });

      // Count by age buckets
      let over30Days = 0;
      let over60Days = 0;
      let over90Days = 0;

      bandOnlyEstimates.forEach(est => {
        const createdAt = new Date(est.created_at);
        if (createdAt <= new Date(ninetyDaysAgo)) {
          over90Days++;
        } else if (createdAt <= new Date(sixtyDaysAgo)) {
          over60Days++;
        } else {
          over30Days++;
        }
      });

      return { over30Days, over60Days, over90Days };
    },
  });

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const MetricCard = ({
    title,
    value,
    description,
    icon: Icon,
    isPercent = false,
  }: {
    title: string;
    value: number | null | undefined;
    description: string;
    icon: React.ElementType;
    isPercent?: boolean;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold">
            {isPercent ? formatPercent(value ?? 0) : (value ?? 0).toLocaleString()}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );

  const FunnelStep = ({
    label,
    value,
    icon: Icon,
    isLast = false,
  }: {
    label: string;
    value: number;
    icon: React.ElementType;
    isLast?: boolean;
  }) => (
    <div className="flex items-center gap-4">
      <Card className="flex-1">
        <CardContent className="pt-6 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-16" /> : value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
      {!isLast && (
        <ArrowRight className="h-6 w-6 text-muted-foreground flex-shrink-0" />
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Band Estimates Funnel</h1>
          <p className="text-muted-foreground">
            Conversion tracking for band/bracelet-only estimates (excludes watch estimates)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing data for: <span className="font-medium">{label}</span>
      </p>

      {/* Funnel Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Band Estimates Sales Funnel
          </CardTitle>
          <CardDescription>
            Tracking band-only estimates from creation → label request → inspection complete
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <FunnelStep
              label="Band-Only Estimates"
              value={metrics?.totalBandOnlyEstimates ?? 0}
              icon={Mail}
            />
            <FunnelStep
              label="Requested Labels"
              value={metrics?.bandEstimatesWithLabels ?? 0}
              icon={Package}
            />
            <FunnelStep
              label="Inspections Done"
              value={metrics?.bandEstimatesWithInspections ?? 0}
              icon={ClipboardList}
              isLast
            />
          </div>
        </CardContent>
      </Card>

      {/* Conversion Rates */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Estimate → Label Rate"
          value={metrics?.estimateToLabelRate}
          description="% of band estimates that requested a shipping label"
          icon={Percent}
          isPercent
        />
        <MetricCard
          title="Label → Inspection Rate"
          value={metrics?.labelToInspectionRate}
          description="% of label requests that completed inspection"
          icon={Percent}
          isPercent
        />
        <MetricCard
          title="Overall Conversion"
          value={metrics?.overallConversionRate}
          description="% of band estimates that completed inspection"
          icon={TrendingUp}
          isPercent
        />
      </div>

      {/* Aging Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Stale Band Estimates
          </CardTitle>
          <CardDescription>
            Band-only estimates in draft/sent status that haven't converted
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-100">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-700">
                      {isLoadingAging ? <Skeleton className="h-8 w-12" /> : agingMetrics?.over30Days ?? 0}
                    </p>
                    <p className="text-sm text-yellow-600">30-60 days old</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-orange-200 bg-orange-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-700">
                      {isLoadingAging ? <Skeleton className="h-8 w-12" /> : agingMetrics?.over60Days ?? 0}
                    </p>
                    <p className="text-sm text-orange-600">60-90 days old</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-700">
                      {isLoadingAging ? <Skeleton className="h-8 w-12" /> : agingMetrics?.over90Days ?? 0}
                    </p>
                    <p className="text-sm text-red-600">90+ days old</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

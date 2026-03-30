import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { BarChart3, Mail, Package, TrendingUp, Users, DollarSign, Calendar, Percent, Clock, ArrowRight, ClipboardList } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, format, differenceInDays, isWeekend, addDays, setHours, setMinutes, isBefore, isAfter, differenceInMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Business hours configuration (EST timezone)
const BUSINESS_TIMEZONE = 'America/New_York';
const BUSINESS_START_HOUR = 9; // 9:00 AM
const BUSINESS_START_MINUTE = 0;
const BUSINESS_END_HOUR = 17; // 5:30 PM
const BUSINESS_END_MINUTE = 30;
const BUSINESS_HOURS_PER_DAY = 8.5; // 9am to 5:30pm = 8.5 hours

/**
 * Calculate business hours between two dates
 * Only counts hours between 9am-5:30pm EST on weekdays
 */
function calculateBusinessHours(startDate: Date, endDate: Date): number {
  // Convert to EST timezone
  const startEST = toZonedTime(startDate, BUSINESS_TIMEZONE);
  const endEST = toZonedTime(endDate, BUSINESS_TIMEZONE);
  
  let totalMinutes = 0;
  let current = new Date(startEST);
  
  // Iterate through each day
  while (isBefore(current, endEST)) {
    // Skip weekends
    if (!isWeekend(current)) {
      // Get business start and end for this day
      let dayStart = setMinutes(setHours(new Date(current), BUSINESS_START_HOUR), BUSINESS_START_MINUTE);
      let dayEnd = setMinutes(setHours(new Date(current), BUSINESS_END_HOUR), BUSINESS_END_MINUTE);
      
      // For the first day, start from actual received time if it's during business hours
      if (current.getTime() === startEST.getTime()) {
        if (isAfter(startEST, dayEnd)) {
          // Received after business hours, skip to next day
          current = addDays(setMinutes(setHours(current, 0), 0), 1);
          continue;
        }
        if (isAfter(startEST, dayStart)) {
          dayStart = startEST;
        }
      }
      
      // For the last day, end at actual processed time if it's during business hours
      const nextDay = addDays(setMinutes(setHours(new Date(current), 0), 0), 1);
      if (isBefore(endEST, nextDay)) {
        if (isBefore(endEST, dayStart)) {
          // Processed before business hours on last day
          break;
        }
        if (isBefore(endEST, dayEnd)) {
          dayEnd = endEST;
        }
      }
      
      // Calculate minutes for this business day
      if (isBefore(dayStart, dayEnd)) {
        const dayMinutes = differenceInMinutes(dayEnd, dayStart);
        totalMinutes += Math.max(0, dayMinutes);
      }
    }
    
    // Move to next day
    current = addDays(setMinutes(setHours(current, 0), 0), 1);
  }
  
  return totalMinutes / 60; // Convert to hours
}

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'year' | string; // string for specific months like '2025-01'

interface AnalyticsMetrics {
  shippingLabelRequests: number;
  totalLeads: number;
  estimatesSent: number;
  averageEstimateValue: number;
  averageValuePerCustomer: number;
  totalEstimates: number;
  totalCustomersWithEstimates: number;
  totalEstimateValue: number;
  estimatesWithItemsReceived: number;
  percentItemsReceived: number;
  customersRequestingLabels: number;
  percentRequestingLabels: number;
  avgLeadResponseTimeHours: number | null;
  avgLeadsPerDay: number;
  // Repeat clients
  repeatClients: number;
  repeatClientRate: number;
  // Conversion funnel
  leadsWithLabels: number;
  leadToLabelRate: number;
  labelsWithReceived: number;
  labelToReceivedRate: number;
  receivedWithJobs: number;
  receivedToSaleRate: number;
  avgEstimateToLabelHours: number | null;
  // Inspections
  awaitingInspection: number;
}

function getDateRange(filter: DateFilter): { start: Date; end: Date; label: string } {
  const now = new Date();
  
  if (filter === 'today') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return {
      start: startOfDay,
      end: endOfDay,
      label: 'Today',
    };
  }
  
  if (filter === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
    const endOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
    return {
      start: startOfDay,
      end: endOfDay,
      label: 'Yesterday',
    };
  }
  
  if (filter === 'week') {
    return {
      start: startOfWeek(now, { weekStartsOn: 0 }),
      end: endOfWeek(now, { weekStartsOn: 0 }),
      label: 'This Week',
    };
  }
  
  if (filter === 'month') {
    return {
      start: startOfMonth(now),
      end: endOfMonth(now),
      label: 'This Month',
    };
  }
  
  if (filter === 'year') {
    return {
      start: startOfYear(now),
      end: endOfYear(now),
      label: 'This Year',
    };
  }
  
  // Specific month format: '2025-01'
  if (filter.match(/^\d{4}-\d{2}$/)) {
    const [year, month] = filter.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return {
      start: startOfMonth(date),
      end: endOfMonth(date),
      label: format(date, 'MMMM yyyy'),
    };
  }
  
  // Default to all time
  return {
    start: new Date(2020, 0, 1),
    end: now,
    label: 'All Time',
  };
}

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  
  // Generate last 12 months
  for (let i = 0; i < 12; i++) {
    const date = subMonths(now, i);
    options.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy'),
    });
  }
  
  return options;
}

interface PendingInspection {
  id: string;
  created_at: string;
  estimate: {
    id: string;
    estimate_number: string;
  };
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    company_name: string | null;
  };
  watch: {
    brand: string;
    model: string | null;
  } | null;
}

export default function AnalyticsPage() {
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [showInspectionsDialog, setShowInspectionsDialog] = useState(false);
  const { start, end, label } = getDateRange(dateFilter);
  const monthOptions = generateMonthOptions();

  // Fetch pending inspections for the dialog
  const { data: pendingInspections, isLoading: isLoadingInspections } = useQuery({
    queryKey: ['pending-inspections-list'],
    queryFn: async (): Promise<PendingInspection[]> => {
      const { data, error } = await supabase
        .from('inspection_requests')
        .select(`
          id,
          created_at,
          estimate:estimates!inner (
            id,
            estimate_number,
            customer:customers!inner (
              id,
              first_name,
              last_name,
              company_name
            ),
            watch:watches (
              brand,
              model
            )
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        created_at: item.created_at,
        estimate: {
          id: item.estimate.id,
          estimate_number: item.estimate.estimate_number,
        },
        customer: item.estimate.customer,
        watch: item.estimate.watch,
      }));
    },
    enabled: showInspectionsDialog,
  });

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['analytics-metrics', dateFilter],
    queryFn: async (): Promise<AnalyticsMetrics> => {
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      // Fetch shipping label requests (line items with description containing "shipping label")
      const { count: shippingLabelRequests } = await supabase
        .from('estimate_line_items')
        .select('*', { count: 'exact', head: true })
        .or('description.ilike.%shipping label%,description.ilike.%prepaid label%')
        .gte('created_at', startISO)
        .lte('created_at', endISO);

      // Fetch total leads
      const { count: totalLeads } = await supabase
        .from('intake_leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startISO)
        .lte('created_at', endISO);

      // Fetch leads with response times (processed_at is not null, exclude N/A leads)
      const { data: leadsWithResponse } = await supabase
        .from('intake_leads')
        .select('received_at, processed_at')
        .not('processed_at', 'is', null)
        .or('is_na.is.null,is_na.eq.false')
        .gte('created_at', startISO)
        .lte('created_at', endISO);

      // Calculate average response time in business hours
      let avgLeadResponseTimeHours: number | null = null;
      if (leadsWithResponse && leadsWithResponse.length > 0) {
        const responseTimes = leadsWithResponse.map(lead => {
          const received = new Date(lead.received_at);
          const processed = new Date(lead.processed_at!);
          return calculateBusinessHours(received, processed);
        });
        avgLeadResponseTimeHours = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      }

      // Fetch estimates sent (status = 'sent' or sent_at is not null)
      const { count: estimatesSent } = await supabase
        .from('estimates')
        .select('*', { count: 'exact', head: true })
        .not('sent_at', 'is', null)
        .gte('sent_at', startISO)
        .lte('sent_at', endISO);

      // Fetch all estimates for average calculation
      const { data: estimatesData } = await supabase
        .from('estimates')
        .select('id, total_amount, customer_id')
        .not('total_amount', 'is', null)
        .gte('created_at', startISO)
        .lte('created_at', endISO);

      // Fetch client property with estimate_id and job_id to find estimates where items were received
      const { data: clientPropertyData } = await supabase
        .from('client_property')
        .select('id, estimate_id, job_id')
        .not('estimate_id', 'is', null)
        .gte('created_at', startISO)
        .lte('created_at', endISO);

      // Fetch shipping label line items with estimate info to get unique customers
      const { data: labelLineItems } = await supabase
        .from('estimate_line_items')
        .select('estimate_id, created_at')
        .or('description.ilike.%shipping label%,description.ilike.%prepaid label%')
        .gte('created_at', startISO)
        .lte('created_at', endISO);

      // Get unique estimate IDs from label line items (these are label requests)
      const labelEstimateIds = [...new Set(labelLineItems?.map(li => li.estimate_id) || [])];
      
      // Fetch customers from those estimates
      let customersRequestingLabels = 0;
      let avgEstimateToLabelHours: number | null = null;
      
      if (labelEstimateIds.length > 0) {
        const { data: labelEstimates } = await supabase
          .from('estimates')
          .select('id, customer_id, created_at')
          .in('id', labelEstimateIds);
        customersRequestingLabels = new Set(labelEstimates?.map(e => e.customer_id) || []).size;
        
        // Calculate avg time from estimate creation to label request
        if (labelEstimates && labelLineItems) {
          const estimateCreatedMap = new Map(labelEstimates.map(e => [e.id, new Date(e.created_at)]));
          const timeDiffs: number[] = [];
          
          labelLineItems.forEach(li => {
            const estimateCreated = estimateCreatedMap.get(li.estimate_id);
            if (estimateCreated) {
              const labelCreated = new Date(li.created_at);
              const diffHours = (labelCreated.getTime() - estimateCreated.getTime()) / (1000 * 60 * 60);
              if (diffHours >= 0) {
                timeDiffs.push(diffHours);
              }
            }
          });
          
          if (timeDiffs.length > 0) {
            avgEstimateToLabelHours = timeDiffs.reduce((sum, h) => sum + h, 0) / timeDiffs.length;
          }
        }
      }

      // === CONVERSION FUNNEL CALCULATIONS ===
      
      // Fetch leads with their customer_id to trace through the funnel
      const { data: leadsData } = await supabase
        .from('intake_leads')
        .select('id, customer_id')
        .gte('created_at', startISO)
        .lte('created_at', endISO);

      // Get customer IDs from leads
      const leadCustomerIds = new Set(leadsData?.map(l => l.customer_id).filter(Boolean) || []);
      
      // Fetch estimates with shipping labels and their customer_ids
      let labelEstimatesWithCustomers: { id: string; customer_id: string }[] = [];
      if (labelEstimateIds.length > 0) {
        const { data } = await supabase
          .from('estimates')
          .select('id, customer_id')
          .in('id', labelEstimateIds);
        labelEstimatesWithCustomers = data || [];
      }
      
      // Lead → Label: leads whose customer got a shipping label
      const labelCustomerIds = new Set(labelEstimatesWithCustomers.map(e => e.customer_id));
      const leadsWithLabels = leadsData?.filter(l => l.customer_id && labelCustomerIds.has(l.customer_id)).length || 0;
      const leadToLabelRate = (totalLeads || 0) > 0 ? (leadsWithLabels / (totalLeads || 1)) * 100 : 0;
      
      // Label → Received: label estimates that have client_property entries
      const receivedEstimateIds = new Set(clientPropertyData?.map(cp => cp.estimate_id) || []);
      const labelsWithReceived = labelEstimateIds.filter(id => receivedEstimateIds.has(id)).length;
      const labelToReceivedRate = labelEstimateIds.length > 0 ? (labelsWithReceived / labelEstimateIds.length) * 100 : 0;
      
      // Received → Sale: client_property entries that have a job_id
      const receivedWithJobs = clientPropertyData?.filter(cp => cp.job_id).length || 0;
      const totalReceived = clientPropertyData?.length || 0;
      const receivedToSaleRate = totalReceived > 0 ? (receivedWithJobs / totalReceived) * 100 : 0;

      // Calculate average estimate value
      const totalEstimates = estimatesData?.length || 0;
      const totalValue = estimatesData?.reduce((sum, est) => sum + (Number(est.total_amount) || 0), 0) || 0;
      const averageEstimateValue = totalEstimates > 0 ? totalValue / totalEstimates : 0;

      // Calculate estimates with items received
      const estimateIdsWithItems = new Set(clientPropertyData?.map(cp => cp.estimate_id) || []);
      const estimatesWithItemsReceived = estimateIdsWithItems.size;
      const percentItemsReceived = totalEstimates > 0 
        ? (estimatesWithItemsReceived / totalEstimates) * 100 
        : 0;

      // Calculate average value per customer
      const customerTotals: Record<string, { total: number; count: number }> = {};
      estimatesData?.forEach((est) => {
        if (est.customer_id) {
          if (!customerTotals[est.customer_id]) {
            customerTotals[est.customer_id] = { total: 0, count: 0 };
          }
          customerTotals[est.customer_id].total += Number(est.total_amount) || 0;
          customerTotals[est.customer_id].count += 1;
        }
      });

      const customerValues = Object.values(customerTotals).map((c) => c.total);
      const totalCustomersWithEstimates = customerValues.length;
      const averageValuePerCustomer = totalCustomersWithEstimates > 0
        ? customerValues.reduce((sum, val) => sum + val, 0) / totalCustomersWithEstimates
        : 0;

      // Calculate % of clients requesting labels
      const percentRequestingLabels = totalCustomersWithEstimates > 0
        ? (customersRequestingLabels / totalCustomersWithEstimates) * 100
        : 0;

      // Calculate average leads per day
      const daysInPeriod = Math.max(1, differenceInDays(end, start) + 1);
      const avgLeadsPerDay = (totalLeads || 0) / daysInPeriod;

      // Calculate repeat clients (customers with more than one estimate)
      const repeatClients = Object.values(customerTotals).filter(c => c.count > 1).length;
      const repeatClientRate = totalCustomersWithEstimates > 0
        ? (repeatClients / totalCustomersWithEstimates) * 100
        : 0;

      // Fetch pending inspection requests (not filtered by date - this is a current snapshot)
      const { count: awaitingInspection } = await supabase
        .from('inspection_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      return {
        shippingLabelRequests: shippingLabelRequests || 0,
        totalLeads: totalLeads || 0,
        estimatesSent: estimatesSent || 0,
        averageEstimateValue,
        averageValuePerCustomer,
        totalEstimates,
        totalCustomersWithEstimates,
        totalEstimateValue: totalValue,
        estimatesWithItemsReceived,
        percentItemsReceived,
        customersRequestingLabels,
        percentRequestingLabels,
        avgLeadResponseTimeHours,
        avgLeadsPerDay,
        // Repeat clients
        repeatClients,
        repeatClientRate,
        // Conversion funnel
        leadsWithLabels,
        leadToLabelRate,
        labelsWithReceived,
        labelToReceivedRate,
        receivedWithJobs,
        receivedToSaleRate,
        avgEstimateToLabelHours,
        // Inspections
        awaitingInspection: awaitingInspection || 0,
      };
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatDuration = (hours: number | null | undefined) => {
    if (hours === null || hours === undefined) return '—';
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    }
    if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    }
    const days = hours / 24;
    return `${days.toFixed(1)}d`;
  };

  const MetricCard = ({
    title,
    value,
    description,
    icon: Icon,
    isCurrency = false,
    isPercent = false,
    isDuration = false,
  }: {
    title: string;
    value: number | null | undefined;
    description: string;
    icon: React.ElementType;
    isCurrency?: boolean;
    isPercent?: boolean;
    isDuration?: boolean;
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
            {isDuration
              ? formatDuration(value)
              : isCurrency 
                ? formatCurrency(value || 0) 
                : isPercent 
                  ? formatPercent(value || 0)
                  : (value || 0).toLocaleString()}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Analytics</h1>
          <p className="text-muted-foreground">Overview of key business metrics</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
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
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">By Month</div>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing data for: <span className="font-medium text-foreground">{label}</span>
        <span className="ml-2 text-xs">
          ({format(start, 'MMM d, yyyy')} – {format(end, 'MMM d, yyyy')})
        </span>
      </div>

      {/* Activities Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Activities</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            title="Intake Leads"
            value={metrics?.totalLeads}
            description="Leads received from all sources"
            icon={Users}
          />
          <MetricCard
            title="Avg Leads/Day"
            value={metrics?.avgLeadsPerDay ? Number(metrics.avgLeadsPerDay.toFixed(1)) : 0}
            description="Average daily lead volume"
            icon={TrendingUp}
          />
          <MetricCard
            title="Avg Lead Response"
            value={metrics?.avgLeadResponseTimeHours}
            description="Mon-Fri, 9am-5:30pm EST"
            icon={Clock}
            isDuration
          />
          <MetricCard
            title="Shipping Label Requests"
            value={metrics?.shippingLabelRequests}
            description="Prepaid shipping labels requested"
            icon={Package}
          />
          <MetricCard
            title="Estimates Sent"
            value={metrics?.estimatesSent}
            description="Estimates delivered to customers"
            icon={Mail}
          />
          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setShowInspectionsDialog(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Awaiting Inspection</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{metrics?.awaitingInspection || 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Client items pending inspection</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Customers</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            title="Customers with Estimates"
            value={metrics?.totalCustomersWithEstimates}
            description="Unique customers in period"
            icon={Users}
          />
          <MetricCard
            title="Avg Value per Customer"
            value={metrics?.averageValuePerCustomer}
            description="Average total estimate value"
            icon={DollarSign}
            isCurrency
          />
          <MetricCard
            title="% Items Received"
            value={metrics?.percentItemsReceived}
            description={`${metrics?.estimatesWithItemsReceived || 0} of ${metrics?.totalEstimates || 0} estimates`}
            icon={Percent}
            isPercent
          />
          <MetricCard
            title="% Clients Request Label"
            value={metrics?.percentRequestingLabels}
            description={`${metrics?.customersRequestingLabels || 0} of ${metrics?.totalCustomersWithEstimates || 0} customers`}
            icon={Percent}
            isPercent
          />
          <MetricCard
            title="% Repeat Clients"
            value={metrics?.repeatClientRate}
            description={`${metrics?.repeatClients || 0} of ${metrics?.totalCustomersWithEstimates || 0} customers`}
            icon={Percent}
            isPercent
          />
        </div>
      </div>

      {/* Conversion Funnel Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Conversion Funnel</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lead → Label</CardTitle>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-4 w-4" />
                <ArrowRight className="h-3 w-3" />
                <Package className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{formatPercent(metrics?.leadToLabelRate || 0)}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {metrics?.leadsWithLabels || 0} of {metrics?.totalLeads || 0} leads requested labels
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Label → Received</CardTitle>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Package className="h-4 w-4" />
                <ArrowRight className="h-3 w-3" />
                <Mail className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{formatPercent(metrics?.labelToReceivedRate || 0)}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {metrics?.labelsWithReceived || 0} of {metrics?.shippingLabelRequests || 0} labels resulted in received items
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Received → Sale</CardTitle>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <ArrowRight className="h-3 w-3" />
                <DollarSign className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{formatPercent(metrics?.receivedToSaleRate || 0)}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {metrics?.receivedWithJobs || 0} of {metrics?.estimatesWithItemsReceived || 0} received items became jobs
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Estimate → Label</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{formatDuration(metrics?.avgEstimateToLabelHours)}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Time from estimate to label request
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sales Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Sales</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            title="Total Estimates"
            value={metrics?.totalEstimates}
            description="Estimates created in period"
            icon={BarChart3}
          />
          <MetricCard
            title="Average Estimate Value"
            value={metrics?.averageEstimateValue}
            description={`Based on ${metrics?.totalEstimates || 0} estimates`}
            icon={TrendingUp}
            isCurrency
          />
          <MetricCard
            title="Total Estimate Value"
            value={metrics?.totalEstimateValue}
            description="Sum of all estimates"
            icon={DollarSign}
            isCurrency
          />
        </div>
      </div>

      {/* Pending Inspections Dialog */}
      <Dialog open={showInspectionsDialog} onOpenChange={setShowInspectionsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Awaiting Inspection ({metrics?.awaitingInspection || 0})</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto flex-1">
            {isLoadingInspections ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : pendingInspections && pendingInspections.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estimate #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Watch</TableHead>
                    <TableHead>Received</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInspections.map((inspection) => (
                    <TableRow key={inspection.id}>
                      <TableCell className="font-medium">
                        {inspection.estimate.estimate_number}
                      </TableCell>
                      <TableCell>
                        {inspection.customer.company_name || 
                          `${inspection.customer.first_name} ${inspection.customer.last_name}`}
                      </TableCell>
                      <TableCell>
                        {inspection.watch ? (
                          <span>
                            {inspection.watch.brand}
                            {inspection.watch.model && ` ${inspection.watch.model}`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(inspection.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                No pending inspections
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

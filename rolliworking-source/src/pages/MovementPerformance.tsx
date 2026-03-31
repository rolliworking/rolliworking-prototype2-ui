import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useMovementPerformance } from "@/hooks/use-movement-performance";
import { PerformanceChart } from "@/components/reports/PerformanceChart";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Calendar } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, subMonths, startOfMonth } from "date-fns";

// Generate last 12 months for dropdown
function getMonthOptions() {
  const options = [];
  const now = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = subMonths(startOfMonth(now), i);
    options.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy"),
    });
  }
  
  return options;
}

export default function MovementPerformance() {
  usePageMeta({ title: "Movement Performance | RolliWorks" });
  
  const monthOptions = getMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState<string>(monthOptions[0].value);
  
  const { data, isLoading, error } = useMovementPerformance(selectedMonth);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Movement Performance</h1>
            <p className="text-muted-foreground">Weekly job status transitions for movement services</p>
          </div>
        </div>
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[350px] w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Movement Performance</h1>
          <p className="text-muted-foreground">Weekly job status transitions for movement services</p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading data</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Movement Performance</h1>
          <p className="text-muted-foreground">
            Weekly job status transitions for movement services
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6">
        <PerformanceChart
          title="Jobs Started (In Progress)"
          description="Movement jobs that began work each week"
          data={data?.inProgress ?? []}
          average={data?.averages.inProgress ?? 0}
          color="hsl(var(--chart-1))"
        />

        <PerformanceChart
          title="Jobs In Testing"
          description="Movement jobs that entered testing phase each week"
          data={data?.inTesting ?? []}
          average={data?.averages.inTesting ?? 0}
          color="hsl(var(--chart-2))"
        />

        <PerformanceChart
          title="Jobs Finished"
          description="Movement jobs completed each week"
          data={data?.finished ?? []}
          average={data?.averages.finished ?? 0}
          color="hsl(var(--chart-3))"
        />
      </div>
    </div>
  );
}

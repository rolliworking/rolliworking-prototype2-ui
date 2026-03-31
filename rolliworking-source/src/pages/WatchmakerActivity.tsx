import { useState, useMemo } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useWatchmakerActivity } from "@/hooks/use-watchmaker-activity";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Calendar, ArrowRight, Play, TestTube, CheckCircle, Download, Printer } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, startOfWeek, subWeeks, addWeeks } from "date-fns";
import { arrayToCSV, downloadCSV, getExportFilename } from "@/lib/csv-export";
import { Input } from "@/components/ui/input";

// Generate last 12 weeks for dropdown (Monday-based)
function getWeekOptions() {
  const options = [];
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });

  for (let i = 0; i < 12; i++) {
    const weekStart = subWeeks(currentWeekStart, i);
    options.push({
      value: format(weekStart, "yyyy-MM-dd"),
      label: `Week of ${format(weekStart, "MMM d, yyyy")}`,
    });
  }

  return options;
}

// --- Horizontal Bar Component ---
interface HorizontalBarRowProps {
  label: string;
  started: number;
  testing: number;
  finished: number;
  downgraded?: number;
  maxValue: number;
  isProjection?: boolean;
  isSelected?: boolean;
}

function HorizontalBarRow({ label, started, testing, finished, downgraded = 0, maxValue, isProjection, isSelected }: HorizontalBarRowProps) {
  const scale = maxValue > 0 ? 100 / maxValue : 0;
  const netTesting = Math.max(testing - downgraded, 0);

  return (
    <div className={`flex items-center gap-3 py-1.5 ${isProjection ? "opacity-70" : ""} ${isSelected ? "bg-accent/40 -mx-2 px-2 rounded" : ""}`}>
      <div className="w-[72px] text-xs text-muted-foreground text-right shrink-0 font-mono">
        {label}
        {isProjection && <span className="text-[10px] ml-0.5">*</span>}
      </div>
      <div className="flex-1 flex gap-1 items-center min-h-[24px]">
        {started > 0 && (
          <div
            className={`h-5 rounded-sm flex items-center justify-end pr-1.5 text-[10px] font-semibold text-white shrink-0 transition-all ${
              isProjection ? "bg-indigo-500/40 border border-dashed border-indigo-400" : "bg-indigo-500"
            }`}
            style={{ width: `${Math.max(started * scale, 3)}%` }}
          >
            <span>{started}</span>
          </div>
        )}
        {netTesting > 0 && (
          <div
            className={`h-5 rounded-sm flex items-center justify-end pr-1.5 text-[10px] font-semibold text-white shrink-0 transition-all ${
              isProjection ? "bg-cyan-600/40 border border-dashed border-cyan-400" : "bg-cyan-600"
            }`}
            style={{ width: `${Math.max(netTesting * scale, 3)}%` }}
          >
            <span>{netTesting}</span>
          </div>
        )}
        {downgraded > 0 && !isProjection && (
          <div
            className="h-5 rounded-sm flex items-center justify-end pr-1.5 text-[10px] font-semibold text-white shrink-0 transition-all bg-rose-500"
            style={{ width: `${Math.max(downgraded * scale, 3)}%` }}
          >
            <span>{downgraded}</span>
          </div>
        )}
        {finished > 0 && (
          <div
            className={`h-5 rounded-sm flex items-center justify-end pr-1.5 text-[10px] font-semibold text-white shrink-0 transition-all ${
              isProjection ? "bg-emerald-600/40 border border-dashed border-emerald-400" : "bg-emerald-600"
            }`}
            style={{ width: `${Math.max(finished * scale, 3)}%` }}
          >
            <span>{finished}</span>
          </div>
        )}
        {started === 0 && netTesting === 0 && downgraded === 0 && finished === 0 && (
          <span className="text-xs text-muted-foreground/50 italic">No activity</span>
        )}
      </div>
    </div>
  );
}

export default function WatchmakerActivity() {
  usePageMeta({ title: "Pipeline | RolliWorks" });

  const weekOptions = getWeekOptions();
  const [selectedWeek, setSelectedWeek] = useState<string>(weekOptions[0].value);
  const [selectedWatchmaker, setSelectedWatchmaker] = useState<string>("all");
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [activeCustomRange, setActiveCustomRange] = useState<{ start: string; end: string } | null>(null);

  const customRange = useCustomRange ? activeCustomRange : null;

  const handleRunCustomRange = () => {
    if (customStart && customEnd) {
      setActiveCustomRange({ start: customStart, end: customEnd });
    }
  };

  const { data, isLoading, error } = useWatchmakerActivity(
    useCustomRange ? undefined : selectedWeek,
    customRange
  );

  const watchmakerOptions = useMemo(() => {
    if (!data?.watchmakers) return [];
    return data.watchmakers.map(wm => ({ value: wm.watchmaker, label: wm.watchmaker }));
  }, [data?.watchmakers]);

  // Compute chart data (6-week rolling window) based on selection
  const chartData = useMemo(() => {
    if (!data) return [];

    if (selectedWatchmaker === "all") {
      const weekMap = new Map<string, { week: string; weekKey: string; inProgress: number; inTesting: number; finished: number; downgraded: number }>();

      data.weekLabels.forEach((label) => {
        weekMap.set(label, { week: label, weekKey: "", inProgress: 0, inTesting: 0, finished: 0, downgraded: 0 });
      });

      data.watchmakers.forEach(wm => {
        wm.weeks.forEach(week => {
          const existing = weekMap.get(week.weekLabel);
          if (existing) {
            existing.weekKey = week.week;
            existing.inProgress += week.inProgress;
            existing.inTesting += week.inTesting;
            existing.finished += week.finished;
            existing.downgraded += week.downgraded;
          }
        });
      });

      return Array.from(weekMap.values());
    } else {
      const watchmakerData = data.watchmakers.find(wm => wm.watchmaker === selectedWatchmaker);
      if (!watchmakerData) return [];

      return watchmakerData.weeks.map(week => ({
        week: week.weekLabel,
        weekKey: week.week,
        inProgress: week.inProgress,
        inTesting: week.inTesting,
        finished: week.finished,
        downgraded: week.downgraded,
      }));
    }
  }, [data, selectedWatchmaker]);

  // When using custom range, sum all weeks; otherwise show just the selected week
  const selectedWeekData = useMemo(() => {
    if (!chartData.length) return { inProgress: 0, inTesting: 0, finished: 0, downgraded: 0 };
    if (useCustomRange && customRange) {
      return chartData.reduce(
        (acc, row) => ({
          inProgress: acc.inProgress + row.inProgress,
          inTesting: acc.inTesting + row.inTesting,
          finished: acc.finished + row.finished,
          downgraded: acc.downgraded + row.downgraded,
        }),
        { inProgress: 0, inTesting: 0, finished: 0, downgraded: 0 }
      );
    }
    const last = chartData[chartData.length - 1];
    return { inProgress: last.inProgress, inTesting: last.inTesting, finished: last.finished, downgraded: last.downgraded };
  }, [chartData, useCustomRange, customRange]);

  // Pipeline forecast from the selected week's starts
  const forecast = useMemo(() => {
    if (!chartData.length) return { currentStarts: 0, projectedTesting: 0, projectedFinished: 0 };

    const lastWeek = chartData[chartData.length - 1];
    const prevWeek = chartData.length >= 2 ? chartData[chartData.length - 2] : null;

    const avgStarts = prevWeek
      ? Math.round((lastWeek.inProgress + prevWeek.inProgress) / 2)
      : lastWeek.inProgress;

    return {
      currentStarts: lastWeek.inProgress,
      projectedTesting: avgStarts,
      projectedFinished: avgStarts,
    };
  }, [chartData]);

  // Projection rows
  const projectionRows = useMemo(() => {
    if (!chartData.length) return [];
    const selectedDate = new Date(selectedWeek + "T12:00:00");

    return [
      {
        label: format(addWeeks(selectedDate, 1), "MMM d"),
        started: 0,
        testing: forecast.projectedTesting,
        finished: 0,
        isProjection: true,
      },
      {
        label: format(addWeeks(selectedDate, 2), "MMM d"),
        started: 0,
        testing: 0,
        finished: forecast.projectedFinished,
        isProjection: true,
      },
    ];
  }, [chartData, forecast, selectedWeek]);

  const maxValue = useMemo(() => {
    const allValues = [
      ...chartData.map(d => d.inProgress + d.inTesting + d.finished),
      ...projectionRows.map(p => p.started + p.testing + p.finished),
    ];
    return Math.max(...allValues, 1);
  }, [chartData, projectionRows]);

  // Export
  const handleExport = () => {
    if (!data) return;
    const weekLabel = format(new Date(selectedWeek + "T12:00:00"), "MMM_d_yyyy");
    const exportData: Record<string, unknown>[] = [];

    if (selectedWatchmaker === "all") {
      data.watchmakers.forEach(wm => {
        wm.weeks.forEach(week => {
          exportData.push({
            watchmaker: wm.watchmaker, week: week.weekLabel,
            started: week.inProgress, testing: week.inTesting, finished: week.finished, total: week.total,
          });
        });
      });
    } else {
      const wmData = data.watchmakers.find(wm => wm.watchmaker === selectedWatchmaker);
      wmData?.weeks.forEach(week => {
        exportData.push({
          watchmaker: selectedWatchmaker, week: week.weekLabel,
          started: week.inProgress, testing: week.inTesting, finished: week.finished, total: week.total,
        });
      });
    }

    const columns = [
      { key: "watchmaker" as const, header: "Watchmaker" },
      { key: "week" as const, header: "Week" },
      { key: "started" as const, header: "Started" },
      { key: "testing" as const, header: "Testing" },
      { key: "finished" as const, header: "Finished" },
      { key: "total" as const, header: "Total" },
    ];

    const csv = arrayToCSV(exportData, columns);
    downloadCSV(csv, getExportFilename(`watchmaker-pipeline_${weekLabel}`));
  };

  // Print
  const handlePrint = () => {
    const weekLabel = format(new Date(selectedWeek + "T12:00:00"), "MMMM d, yyyy");
    const watchmakerLabel = selectedWatchmaker === "all" ? "All Watchmakers (Department Total)" : selectedWatchmaker;
    const maxVal = maxValue;

    const printContent = `
      <html>
        <head>
          <title>Watchmaker Pipeline - Week of ${weekLabel}</title>
          <style>
            * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; max-width: 1000px; margin: 0 auto; }
            h1 { font-size: 24px; margin-bottom: 5px; }
            h2 { font-size: 16px; color: #666; margin-bottom: 30px; font-weight: normal; }
            .pipeline { display: flex; gap: 15px; margin-bottom: 30px; align-items: center; }
            .pipeline-card { flex: 1; border: 2px solid #e5e5e5; padding: 16px; border-radius: 10px; text-align: center; }
            .pipeline-card.started { border-color: #818cf8; }
            .pipeline-card.testing { border-color: #22d3ee; }
            .pipeline-card.finished { border-color: #34d399; }
            .pipeline-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
            .pipeline-value { font-size: 28px; font-weight: bold; margin: 4px 0; }
            .pipeline-value.started { color: #4f46e5; }
            .pipeline-value.testing { color: #0891b2; }
            .pipeline-value.finished { color: #059669; }
            .pipeline-arrow { font-size: 20px; color: #aaa; }
            .pipeline-sub { font-size: 10px; color: #999; }
            .bar-row { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
            .bar-row.selected { background: #f5f5f5; margin-left: -8px; margin-right: -8px; padding: 4px 8px; border-radius: 6px; }
            .bar-label { width: 60px; text-align: right; font-size: 11px; color: #666; font-family: monospace; }
            .bar-area { flex: 1; display: flex; gap: 3px; }
            .bar { height: 20px; border-radius: 3px; display: flex; align-items: center; justify-content: flex-end; padding-right: 5px; font-size: 10px; font-weight: 600; color: white; }
            .bar.started { background-color: #4f46e5 !important; }
            .bar.testing { background-color: #0891b2 !important; }
            .bar.finished { background-color: #059669 !important; }
            .bar.proj { opacity: 0.4; border: 1.5px dashed; }
            .bar.proj.testing { border-color: #22d3ee; }
            .bar.proj.finished { border-color: #34d399; }
            .divider { border-top: 2px dashed #ddd; margin: 12px 0 6px 70px; }
            .proj-note { font-size: 10px; color: #999; margin-left: 70px; margin-bottom: 8px; }
            .legend { display: flex; gap: 20px; margin-top: 16px; justify-content: center; }
            .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
            .legend-color { width: 14px; height: 14px; border-radius: 3px; }
            .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #999; }
            @media print { body { padding: 15px; } }
          </style>
        </head>
        <body>
          <h1>Watchmaker Pipeline — Weekly Report</h1>
          <h2>${watchmakerLabel} — Week of ${weekLabel}</h2>
          <div class="pipeline">
            <div class="pipeline-card started">
              <div class="pipeline-label">Started This Week</div>
              <div class="pipeline-value started">${forecast.currentStarts}</div>
            </div>
            <div class="pipeline-arrow">→</div>
            <div class="pipeline-card testing">
              <div class="pipeline-label">Projected Testing</div>
              <div class="pipeline-value testing">~${forecast.projectedTesting}</div>
              <div class="pipeline-sub">Next week</div>
            </div>
            <div class="pipeline-arrow">→</div>
            <div class="pipeline-card finished">
              <div class="pipeline-label">Projected Finished</div>
              <div class="pipeline-value finished">~${forecast.projectedFinished}</div>
              <div class="pipeline-sub">In 2-3 weeks</div>
            </div>
          </div>
          <h3 style="font-size:14px;margin-bottom:10px">6-Week Trend</h3>
          ${chartData.map((row, i) => `
            <div class="bar-row ${i === chartData.length - 1 ? 'selected' : ''}">
              <div class="bar-label">${row.week}</div>
              <div class="bar-area">
                ${row.inProgress > 0 ? `<div class="bar started" style="width:${Math.max((row.inProgress / maxVal) * 100, 4)}%">${row.inProgress}</div>` : ''}
                ${row.inTesting > 0 ? `<div class="bar testing" style="width:${Math.max((row.inTesting / maxVal) * 100, 4)}%">${row.inTesting}</div>` : ''}
                ${row.finished > 0 ? `<div class="bar finished" style="width:${Math.max((row.finished / maxVal) * 100, 4)}%">${row.finished}</div>` : ''}
              </div>
            </div>
          `).join('')}
          <div class="divider"></div>
          <div class="proj-note">* Projected based on recent activity</div>
          ${projectionRows.map(row => `
            <div class="bar-row">
              <div class="bar-label">${row.label}*</div>
              <div class="bar-area">
                ${row.testing > 0 ? `<div class="bar proj testing" style="width:${Math.max((row.testing / maxVal) * 100, 4)}%">~${row.testing}</div>` : ''}
                ${row.finished > 0 ? `<div class="bar proj finished" style="width:${Math.max((row.finished / maxVal) * 100, 4)}%">~${row.finished}</div>` : ''}
              </div>
            </div>
          `).join('')}
          <div class="legend">
            <div class="legend-item"><div class="legend-color" style="background:#4f46e5"></div>Started</div>
            <div class="legend-item"><div class="legend-color" style="background:#0891b2"></div>Testing</div>
            <div class="legend-item"><div class="legend-color" style="background:#059669"></div>Finished</div>
            <div class="legend-item"><div class="legend-color" style="background:#ddd;border:1.5px dashed #999"></div>Projected</div>
          </div>
          <div class="footer">Generated on ${format(new Date(), "PPpp")} • RolliWorks</div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground">Weekly pipeline forecast & throughput</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-[100px]" />)}</div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground">Weekly pipeline forecast & throughput</p>
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground">Weekly pipeline forecast & throughput (excludes case work)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedWatchmaker} onValueChange={setSelectedWatchmaker}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select watchmaker" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">All (Department Total)</SelectItem>
              {watchmakerOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {useCustomRange ? (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-[145px] h-9 text-sm"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-[145px] h-9 text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleRunCustomRange}
                  disabled={!customStart || !customEnd}
                >
                  <Play className="h-3.5 w-3.5 mr-1" />Run
                </Button>
              </div>
            ) : (
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger className="w-[210px]">
                  <SelectValue placeholder="Select week" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {weekOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant={useCustomRange ? "default" : "outline"}
              size="sm"
              onClick={() => setUseCustomRange(!useCustomRange)}
            >
              {useCustomRange ? "Presets" : "Custom"}
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />Export
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />Print
          </Button>
        </div>
      </div>

      {/* Pipeline Forecast Cards */}
      <div className="flex items-center gap-3">
        <Card className="flex-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Started This Week</CardTitle>
            <Play className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-500">{forecast.currentStarts}</div>
            <p className="text-xs text-muted-foreground">Jobs began work</p>
          </CardContent>
        </Card>

        <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 hidden sm:block" />

        <Card className="flex-1 border-dashed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projected Testing</CardTitle>
            <TestTube className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyan-600">~{forecast.projectedTesting}</div>
            <p className="text-xs text-muted-foreground">Expected next week</p>
          </CardContent>
        </Card>

        <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 hidden sm:block" />

        <Card className="flex-1 border-dashed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projected Finished</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">~{forecast.projectedFinished}</div>
            <p className="text-xs text-muted-foreground">Expected in 2-3 weeks</p>
          </CardContent>
        </Card>
      </div>

      {/* Selected Week Summary */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-muted/30">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-indigo-500">{selectedWeekData.inProgress}</div>
            <div className="text-[11px] text-muted-foreground">Started</div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-cyan-600">{selectedWeekData.inTesting}</div>
            <div className="text-[11px] text-muted-foreground">Testing</div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-emerald-600">{selectedWeekData.finished}</div>
            <div className="text-[11px] text-muted-foreground">Finished</div>
          </CardContent>
        </Card>
        <Card className={`bg-muted/30 ${selectedWeekData.downgraded > 0 ? "border-rose-200" : ""}`}>
          <CardContent className="p-3 text-center">
            <div className={`text-lg font-bold ${selectedWeekData.downgraded > 0 ? "text-rose-500" : "text-muted-foreground"}`}>{selectedWeekData.downgraded}</div>
            <div className="text-[11px] text-muted-foreground">Downgraded</div>
          </CardContent>
        </Card>
      </div>

      {/* Horizontal Bar Chart - 6 week trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            6-Week Trend {selectedWatchmaker === "all" ? "(Department Total)" : `— ${selectedWatchmaker}`}
          </CardTitle>
          <CardDescription>
            Selected week highlighted • dashed bars are projections based on recent starts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.every(d => d.inProgress === 0 && d.inTesting === 0 && d.finished === 0) ? (
            <p className="text-center text-muted-foreground py-8">No activity recorded for this selection</p>
          ) : (
            <div className="space-y-0">
              {chartData.map((row, i) => (
                <HorizontalBarRow
                  key={i}
                  label={row.week}
                  started={row.inProgress}
                  testing={row.inTesting}
                  finished={row.finished}
                  downgraded={row.downgraded}
                  maxValue={maxValue}
                  isSelected={i === chartData.length - 1}
                />
              ))}

              {projectionRows.length > 0 && (
                <div className="ml-[84px] border-t-2 border-dashed border-muted-foreground/20 my-2" />
              )}

              {projectionRows.map((row, i) => (
                <HorizontalBarRow
                  key={`proj-${i}`}
                  label={row.label}
                  started={row.started}
                  testing={row.testing}
                  finished={row.finished}
                  maxValue={maxValue}
                  isProjection
                />
              ))}
            </div>
          )}

          <div className="flex gap-4 mt-5 text-xs text-muted-foreground justify-center flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-indigo-500"></span>Started
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-cyan-600"></span>Testing
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-600"></span>Finished
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-rose-500"></span>Downgraded
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2 border-dashed border-muted-foreground/40"></span>Projected
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

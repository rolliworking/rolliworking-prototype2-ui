import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  LabelList,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface WeeklyMetric {
  week: string;
  weekLabel: string;
  count: number;
}

interface EnhancedWeeklyMetric extends WeeklyMetric {
  diff: number;
  percentDiff: number;
  isUp: boolean;
  hasPrevious: boolean;
}

interface PerformanceChartProps {
  title: string;
  description: string;
  data: WeeklyMetric[];
  average: number;
  color: string;
}

// Custom label component for bar tops
const CustomBarLabel = (props: any) => {
  const { x, y, width, value, diff, percentDiff, hasPrevious } = props;
  if (value === 0 || !hasPrevious) return null;
  
  const sign = diff >= 0 ? "+" : "";
  const labelText = `${sign}${diff} (${sign}${percentDiff.toFixed(0)}%)`;
  
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      fill="hsl(var(--foreground))"
      textAnchor="middle"
      fontSize={10}
      fontWeight={500}
    >
      {labelText}
    </text>
  );
};

export function PerformanceChart({ title, description, data, average }: PerformanceChartProps) {
  // Enhance data with week-over-week diff calculations
  const enhancedData: EnhancedWeeklyMetric[] = data.map((item, index) => {
    const previousWeek = index > 0 ? data[index - 1] : null;
    const hasPrevious = previousWeek !== null;
    
    const diff = hasPrevious ? item.count - previousWeek.count : 0;
    const percentDiff = hasPrevious && previousWeek.count > 0 
      ? ((item.count - previousWeek.count) / previousWeek.count) * 100 
      : 0;
    
    return {
      ...item,
      diff,
      percentDiff,
      isUp: !hasPrevious || item.count >= previousWeek.count,
      hasPrevious,
    };
  });

  // Get the most recent week for header display
  const currentWeekData = enhancedData.length >= 1 ? enhancedData[enhancedData.length - 1] : null;
  const currentWeekCount = currentWeekData?.count ?? 0;
  const currentDiff = currentWeekData?.percentDiff ?? 0;
  const isPositive = currentDiff > 0;
  const isNeutral = !currentWeekData?.hasPrevious || Math.abs(currentDiff) < 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{currentWeekCount}</div>
            <div className={`flex items-center gap-1 text-sm ${
              isNeutral 
                ? "text-muted-foreground" 
                : isPositive 
                  ? "text-green-600" 
                  : "text-red-600"
            }`}>
              {isNeutral ? (
                <Minus className="h-4 w-4" />
              ) : isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>
                {isNeutral ? "—" : `${isPositive ? "+" : ""}${currentDiff.toFixed(1)}%`}
              </span>
              <span className="text-muted-foreground ml-1">vs last week</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={enhancedData} margin={{ top: 30, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="weekLabel" 
                tick={{ fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                formatter={(value: number, name: string, props: any) => {
                  const item = props.payload as EnhancedWeeklyMetric;
                  if (!item.hasPrevious) {
                    return [`${value} jobs`, "Count"];
                  }
                  const sign = item.diff >= 0 ? "+" : "";
                  return [
                    `${value} jobs (${sign}${item.diff}, ${sign}${item.percentDiff.toFixed(1)}% vs prev week)`,
                    "Count"
                  ];
                }}
              />
              <ReferenceLine 
                y={average} 
                stroke="hsl(var(--muted-foreground))" 
                strokeDasharray="5 5"
                label={{ 
                  value: `90d Avg: ${average.toFixed(1)}`, 
                  position: "right",
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))"
                }}
              />
              <Bar 
                dataKey="count" 
                radius={[4, 4, 0, 0]}
                name="Jobs"
              >
                {enhancedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isUp ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"}
                  />
                ))}
                <LabelList
                  dataKey="count"
                  position="top"
                  content={(props: any) => {
                    const item = enhancedData[props.index];
                    if (!item || item.count === 0) return null;
                    return (
                      <CustomBarLabel 
                        {...props} 
                        diff={item.diff} 
                        percentDiff={item.percentDiff}
                        hasPrevious={item.hasPrevious}
                      />
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

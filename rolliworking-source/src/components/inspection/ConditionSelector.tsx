import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const CONDITIONS = [
  { value: "excellent", label: "Excellent", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20" },
  { value: "very_good", label: "Very Good", color: "bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20" },
  { value: "good", label: "Good", color: "bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20" },
  { value: "fair", label: "Fair", color: "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20" },
  { value: "poor", label: "Poor", color: "bg-orange-500/10 text-orange-600 border-orange-500/30 hover:bg-orange-500/20" },
  { value: "none", label: "NONE", color: "bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20" },
] as const;

interface ConditionSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ConditionSelector({ value, onChange, className }: ConditionSelectorProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {CONDITIONS.map((condition) => (
        <Button
          key={condition.value}
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "transition-all",
            value === condition.value
              ? cn(condition.color, "border-2")
              : "hover:bg-muted"
          )}
          onClick={() => onChange(condition.value)}
        >
          {condition.label}
        </Button>
      ))}
    </div>
  );
}

export { CONDITIONS };

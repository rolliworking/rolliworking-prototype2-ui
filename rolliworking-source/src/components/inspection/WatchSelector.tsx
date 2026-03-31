import * as React from "react";
import { Check, ChevronsUpDown, Plus, Watch, Briefcase } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  useWatchesAndJobsByCustomer, 
  type Watch as WatchType,
  type WatchOrJobRef,
  type JobWatchRef 
} from "@/hooks/use-watches";

interface WatchSelectorProps {
  customerId: string | undefined;
  selectedWatchId: string | null;
  onSelectWatch: (watch: WatchType | null) => void;
  onAddNew: () => void;
  onSkipForBracelet?: () => void;
  showBraceletSkip?: boolean;
  onSelectJobRef?: (jobRef: JobWatchRef) => void;
}

function isJobRef(item: WatchOrJobRef): item is JobWatchRef {
  return "isFromJob" in item && item.isFromJob === true;
}

export function WatchSelector({
  customerId,
  selectedWatchId,
  onSelectWatch,
  onAddNew,
  onSkipForBracelet,
  showBraceletSkip = true,
  onSelectJobRef,
}: WatchSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const { data: items = [], isLoading } = useWatchesAndJobsByCustomer(customerId);

  // Separate watches from job refs
  const watches = items.filter((item): item is WatchType => !isJobRef(item));
  const jobRefs = items.filter(isJobRef);

  const selectedWatch = watches.find((w) => w.id === selectedWatchId);
  const selectedJobRef = jobRefs.find((j) => j.id === selectedWatchId);

  const handleSelectWatch = (watch: WatchType) => {
    onSelectWatch(watch);
    setOpen(false);
  };

  const handleSelectJobRef = (jobRef: JobWatchRef) => {
    if (onSelectJobRef) {
      onSelectJobRef(jobRef);
    }
    setOpen(false);
  };

  const handleAddNew = () => {
    onSelectWatch(null);
    onAddNew();
    setOpen(false);
  };

  const handleSkipForBracelet = () => {
    onSkipForBracelet?.();
    setOpen(false);
  };

  if (!customerId) {
    return null;
  }

  // If customer has no watches AND no job refs, show message and options
  if (!isLoading && items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <Watch className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">No watches on file</p>
            <p className="text-xs text-muted-foreground">
              Add a new watch or continue with bracelet only
            </p>
          </div>
          <div className="flex gap-2">
            {showBraceletSkip && onSkipForBracelet && (
              <Button size="sm" variant="outline" onClick={handleSkipForBracelet}>
                Bracelet Only
              </Button>
            )}
            <Button size="sm" onClick={onAddNew}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Watch
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {selectedWatch ? (
              <span className="flex items-center gap-2">
                <Watch className="h-4 w-4" />
                {selectedWatch.brand} {selectedWatch.model || ""} 
                {selectedWatch.reference_number && (
                  <span className="text-muted-foreground">
                    ({selectedWatch.reference_number})
                  </span>
                )}
              </span>
            ) : selectedJobRef ? (
              <span className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-amber-500" />
                {selectedJobRef.brand} {selectedJobRef.model || ""} 
                {selectedJobRef.reference_number && (
                  <span className="text-muted-foreground">
                    ({selectedJobRef.reference_number})
                  </span>
                )}
                <span className="text-xs text-amber-500">(from job)</span>
              </span>
            ) : (
              <span className="text-muted-foreground">
                Select existing watch or add new…
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search watches…" />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Loading…" : "No watches found."}
              </CommandEmpty>
              {watches.length > 0 && (
                <CommandGroup heading="Watches on File">
                  {watches.map((watch) => (
                    <CommandItem
                      key={watch.id}
                      value={watch.id}
                      onSelect={() => handleSelectWatch(watch)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedWatchId === watch.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {watch.brand} {watch.model || ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {watch.reference_number && `Ref: ${watch.reference_number} • `}
                          Est: {watch.estimate_number}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {jobRefs.length > 0 && (
                <CommandGroup heading="From Existing Jobs">
                  {jobRefs.map((jobRef) => (
                    <CommandItem
                      key={jobRef.id}
                      value={jobRef.id}
                      onSelect={() => handleSelectJobRef(jobRef)}
                    >
                      <Briefcase
                        className={cn(
                          "mr-2 h-4 w-4 text-amber-500",
                          selectedWatchId === jobRef.id ? "opacity-100" : "opacity-50"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {jobRef.brand} {jobRef.model || ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {jobRef.reference_number && `Ref: ${jobRef.reference_number} • `}
                          Est: {jobRef.estimate_number}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <CommandGroup>
                <CommandItem onSelect={handleAddNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add new watch
                </CommandItem>
                {showBraceletSkip && onSkipForBracelet && (
                  <CommandItem onSelect={handleSkipForBracelet}>
                    <Watch className="mr-2 h-4 w-4 text-muted-foreground" />
                    Bracelet Only (skip watch selection)
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

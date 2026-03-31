import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, Package, FileText, Plus, X, ClipboardCheck, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useGlobalSearch, SearchResult, SearchResultType } from "@/hooks/use-global-search";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TYPE_CONFIG: Record<SearchResultType, { label: string; icon: typeof User; color: string }> = {
  estimate: { label: "Estimates", icon: FileText, color: "bg-blue-500/10 text-blue-600" },
  approval: { label: "Approvals", icon: ClipboardCheck, color: "bg-purple-500/10 text-purple-600" },
  part: { label: "Parts", icon: Package, color: "bg-amber-500/10 text-amber-600" },
  customer: { label: "Clients", icon: User, color: "bg-emerald-500/10 text-emerald-600" },
  band_only: { label: "Band Only", icon: Link2, color: "bg-rose-500/10 text-rose-600" },
};

const STATUS_COLORS: Record<string, string> = {
  intake: "bg-slate-500",
  inspection: "bg-purple-500",
  waiting_approval: "bg-yellow-500",
  in_queue: "bg-blue-500",
  in_progress: "bg-cyan-500",
  parts_approval: "bg-orange-500",
  parts_on_order: "bg-amber-500",
  in_testing: "bg-indigo-500",
  finished: "bg-green-500",
};

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { groupedResults, isLoading, isEmpty, hasQuery } = useGlobalSearch(searchTerm);

  // Flatten results for keyboard navigation
  const flatResults: SearchResult[] = [
    ...groupedResults.estimate,
    ...groupedResults.approval,
    ...groupedResults.band_only,
    ...groupedResults.part,
    ...groupedResults.customer,
  ];

  const handleSelect = useCallback(
    (result: SearchResult) => {
      navigate(result.link);
      setSearchTerm("");
      setIsOpen(false);
      setSelectedIndex(-1);
    },
    [navigate]
  );

  const handleAddNewCustomer = useCallback(() => {
    navigate(`/inspections/new?name=${encodeURIComponent(searchTerm)}`);
    setSearchTerm("");
    setIsOpen(false);
    setSelectedIndex(-1);
  }, [navigate, searchTerm]);

  const handleCreateBandOnlyJob = useCallback(
    async (result: SearchResult) => {
      try {
        // Fetch inspection details to populate the job
        const { data: inspection } = await supabase
          .from("inspections")
          .select("id, watches!inner(estimate_number, brand, model, customers(id, name, email))")
          .eq("id", result.id)
          .single();

        if (!inspection) {
          toast.error("Inspection not found");
          return;
        }

        const watch = inspection.watches as any;
        const customer = watch?.customers;

        const { data: newJob, error } = await supabase
          .from("jobs")
          .insert({
            inspection_id: inspection.id,
            estimate_number: watch?.estimate_number || null,
            watch_brand: watch?.brand || null,
            watch_model: watch?.model || null,
            client_name: customer?.name || null,
            client_email: customer?.email || null,
            client_id: customer?.id || null,
            service_type: "bracelet_repair",
            status: "in_queue",
          })
          .select("id")
          .single();

        if (error) throw error;

        toast.success("Band-only job created");
        setSearchTerm("");
        setIsOpen(false);
        setSelectedIndex(-1);
        navigate(`/parts-request?job=${newJob.id}`);
      } catch (err) {
        console.error("Failed to create band-only job:", err);
        toast.error("Failed to create job");
      }
    },
    [navigate]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      const totalItems = flatResults.length + (isEmpty ? 1 : 0); // +1 for "Add new" option

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % totalItems);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < flatResults.length) {
            const selected = flatResults[selectedIndex];
            if (selected.type === "band_only" && !selected.jobStatus) {
              handleCreateBandOnlyJob(selected);
            } else {
              handleSelect(selected);
            }
          } else if (isEmpty || selectedIndex === flatResults.length) {
            handleAddNewCustomer();
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setSelectedIndex(-1);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, flatResults, selectedIndex, isEmpty, handleSelect, handleAddNewCustomer, handleCreateBandOnlyJob]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [flatResults.length]);

  const showDropdown = isOpen && hasQuery;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search clients, estimates, parts..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-8 h-9 bg-muted/50 border-muted focus:bg-background"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-sm hover:bg-muted"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-[400px] overflow-y-auto">
          {isLoading && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Searching...
            </div>
          )}

          {!isLoading && flatResults.length > 0 && (
            <>
              {(["estimate", "approval", "band_only", "part", "customer"] as SearchResultType[]).map((type) => {
                const items = groupedResults[type];
                if (items.length === 0) return null;

                const config = TYPE_CONFIG[type];
                const Icon = config.icon;

                return (
                  <div key={type}>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 sticky top-0">
                      {config.label}
                    </div>
                    {items.map((result) => {
                      const globalIndex = flatResults.indexOf(result);
                      const isSelected = globalIndex === selectedIndex;

                      return (
                        <div
                          key={result.id}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          onClick={() => {
                            if (result.type === "band_only" && !result.jobStatus) {
                              handleCreateBandOnlyJob(result);
                            } else {
                              handleSelect(result);
                            }
                          }}
                          className={cn(
                            "w-full px-3 py-2 flex items-start gap-3 text-left hover:bg-accent transition-colors cursor-pointer",
                            isSelected && "bg-accent"
                          )}
                        >
                          <div className={cn("p-1.5 rounded-md mt-0.5", config.color)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {result.title}
                              </span>
                              {result.type === "band_only" && !result.jobStatus && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 bg-rose-500/10 text-rose-600 shrink-0"
                                >
                                  Create Job
                                </Badge>
                              )}
                              {result.type === "band_only" && result.jobStatus === "has_job" && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 shrink-0"
                                >
                                  Parts Request
                                </Badge>
                              )}
                              {result.jobStatus && result.type !== "band_only" && (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-[10px] px-1.5 py-0 text-white shrink-0",
                                    STATUS_COLORS[result.jobStatus] || "bg-gray-500"
                                  )}
                                >
                                  {formatStatus(result.jobStatus)}
                                </Badge>
                              )}
                            </div>
                            {result.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">
                                {result.subtitle}
                              </p>
                            )}
                            {result.secondaryLinks && result.secondaryLinks.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-1">
                                {result.secondaryLinks.map((sl) => (
                                  <button
                                    key={sl.url}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(sl.url);
                                      setSearchTerm("");
                                      setIsOpen(false);
                                    }}
                                    className="text-[11px] px-2 py-0.5 rounded-md bg-muted hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {sl.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {!isLoading && isEmpty && (
            <button
              type="button"
              onClick={handleAddNewCustomer}
              onMouseEnter={() => setSelectedIndex(0)}
              className={cn(
                "w-full px-3 py-3 flex items-center gap-3 text-left hover:bg-accent transition-colors",
                selectedIndex === 0 && "bg-accent"
              )}
            >
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <Plus className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="font-medium text-sm">
                  Add "{searchTerm}" as new customer
                </span>
                <p className="text-xs text-muted-foreground">
                  No results found. Create a new record.
                </p>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

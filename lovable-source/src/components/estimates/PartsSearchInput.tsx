// Parts search input with reliable mouse selection
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Part {
  id: string;
  part_number: string;
  description: string;
  default_sell_price: number | null;
}

interface PartsSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onPartSelect?: (part: Part) => void;
  onAddPart?: () => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export const PartsSearchInput = React.forwardRef<HTMLInputElement, PartsSearchInputProps>(({
  value,
  onChange,
  onPartSelect,
  onAddPart,
  className,
  placeholder = 'Search parts...',
  autoFocus = false,
}, forwardedRef) => {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);

  const { data: parts, isLoading } = useQuery({
    queryKey: ['parts-search', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];

      const searchLower = debouncedSearch.toLowerCase().trim();

      const { data, error } = await supabase
        .from('parts')
        .select('id, part_number, description, default_sell_price')
        .eq('is_active', true)
        .or(
          `part_number.ilike.${searchLower}%,part_number.ilike.%${searchLower}%,description.ilike.%${searchLower}%`
        )
        .limit(50);

      if (error) throw error;

      const sorted = (data || []).sort((a, b) => {
        const aStartsWith = a.part_number.toLowerCase().startsWith(searchLower);
        const bStartsWith = b.part_number.toLowerCase().startsWith(searchLower);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        return a.part_number.localeCompare(b.part_number);
      });

      return sorted.slice(0, 20);
    },
    enabled: debouncedSearch.length >= 2,
  });

  const showDropdown = isOpen && value.length >= 2;

  const updateDropdownPosition = () => {
    const el = inputRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      top: rect.bottom + 4,
      width: Math.max(400, rect.width),
      zIndex: 9999,
    });
  };

  useLayoutEffect(() => {
    if (!showDropdown) return;
    updateDropdownPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDropdown, value]);

  useEffect(() => {
    if (!showDropdown) {
      setDropdownStyle(null);
      return;
    }

    const onReposition = () => updateDropdownPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);

    // Close dropdown when clicking outside - use mouseup to not interfere with selection
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        inputRef.current && !inputRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mouseup', handleClickOutside);

    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
      document.removeEventListener('mouseup', handleClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDropdown, value]);

  const handleSelectPart = (part: Part) => {
    // Commit selection synchronously so we don't lose it to blur/outside-click timing.
    flushSync(() => {
      onChange(part.part_number);
      setIsOpen(false);
    });

    onPartSelect?.(part);

    // Keep focus in the input for rapid entry.
    queueMicrotask(() => inputRef.current?.focus());
  };

  React.useImperativeHandle(forwardedRef, () => inputRef.current!);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => value.length >= 2 && setIsOpen(true)}
        className={cn("w-full", className)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />

      {showDropdown && dropdownStyle
        ? createPortal(
            <div
              ref={dropdownRef}
              data-parts-search-dropdown
              className="bg-popover border border-border rounded-md shadow-lg max-h-72 overflow-y-auto"
              style={dropdownStyle}
            >
              {isLoading ? (
                <div className="p-3 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div>
                  {/* Add new option at top */}
                  {onAddPart && (
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onAddPart();
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 border-b border-border text-primary font-medium"
                    >
                      <Plus className="h-4 w-4" />
                      Add new part
                    </button>
                  )}
                  
                  {/* Results list - two column layout */}
                  {parts && parts.length > 0 ? (
                    <div>
                      {parts.map((part) => (
                        <button
                          key={part.id}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSelectPart(part);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground grid grid-cols-[180px_1fr] gap-3 border-b border-border/50 last:border-0"
                        >
                          <span className="font-medium text-foreground truncate">{part.part_number}</span>
                          <span className="text-muted-foreground line-clamp-2">{part.description}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      No matching parts found
                    </div>
                  )}
                </div>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
});

PartsSearchInput.displayName = 'PartsSearchInput';

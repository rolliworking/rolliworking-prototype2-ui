import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const WATCH_BRANDS = [
  'Rolex',
  'Tudor',
  'Omega',
  'Patek Philippe',
  'Audemars Piguet',
  'Cartier',
  'Breitling',
  'IWC',
  'Panerai',
  'Tag Heuer',
  'Hublot',
  'Zenith',
  'Jaeger-LeCoultre',
  'Vacheron Constantin',
  'A. Lange & Söhne',
  'Grand Seiko',
  'Longines',
  'Tissot',
  'Hamilton',
  'Oris',
];

interface BrandAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function BrandAutocomplete({ 
  value, 
  onChange, 
  placeholder = 'Brand',
  className 
}: BrandAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value.length >= 1) {
      const filtered = WATCH_BRANDS.filter(brand =>
        brand.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered);
      setIsOpen(filtered.length > 0);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (brand: string) => {
    onChange(brand);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (value.length >= 1 && suggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        className={cn('qbo-input', className)}
        autoComplete="off"
      />
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((brand) => (
            <button
              key={brand}
              type="button"
              onClick={() => handleSelect(brand)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
            >
              {brand}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

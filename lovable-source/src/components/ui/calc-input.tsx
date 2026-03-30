import React, { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { evaluateMathExpression } from '@/hooks/useCalcInput';
import { cn } from '@/lib/utils';

interface CalcInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
}

/**
 * Input component that supports simple math calculations.
 * Type expressions like "15*1.5+35" and press Enter or blur to evaluate.
 */
export function CalcInput({ value, onChange, className, placeholder }: CalcInputProps) {
  const [displayValue, setDisplayValue] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  // Sync display value when external value changes (and not focused)
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(String(value));
    }
  }, [value, isFocused]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDisplayValue(newValue);
    
    // Try to parse as a simple number first for immediate feedback
    const numValue = parseFloat(newValue);
    if (!isNaN(numValue)) {
      onChange(numValue);
    }
  }, [onChange]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    
    // Try to evaluate as math expression
    const result = evaluateMathExpression(displayValue);
    if (result !== null) {
      onChange(result);
      setDisplayValue(String(result));
    } else {
      // Fall back to parsing as number or reset to 0
      const numValue = parseFloat(displayValue);
      if (!isNaN(numValue)) {
        onChange(numValue);
        setDisplayValue(String(numValue));
      } else {
        onChange(0);
        setDisplayValue('0');
      }
    }
  }, [displayValue, onChange]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  }, []);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      className={cn(className)}
      placeholder={placeholder}
    />
  );
}

import { useState, useCallback } from 'react';

/**
 * Safely evaluates a simple math expression (supports +, -, *, /).
 * Returns null if the expression is invalid.
 */
export function evaluateMathExpression(expression: string): number | null {
  // Remove whitespace
  const cleaned = expression.replace(/\s/g, '');
  
  // Only allow numbers, decimal points, and basic operators
  if (!/^[\d.+\-*/()]+$/.test(cleaned)) {
    return null;
  }
  
  // Prevent empty or invalid expressions
  if (!cleaned || /[+\-*/]{2,}/.test(cleaned) || /^[*/]/.test(cleaned) || /[+\-*/]$/.test(cleaned)) {
    return null;
  }
  
  try {
    // Use Function constructor instead of eval for slightly better safety
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${cleaned})`)();
    
    if (typeof result === 'number' && isFinite(result)) {
      return Math.round(result * 100) / 100; // Round to 2 decimal places
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Hook for input fields that support simple math calculations.
 * User can type expressions like "15*1.5+35" and on blur it evaluates to the result.
 */
export function useCalcInput(
  initialValue: number,
  onChange: (value: number) => void
) {
  const [displayValue, setDisplayValue] = useState(String(initialValue));
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDisplayValue(value);
    
    // Try to parse as a simple number first for immediate feedback
    const numValue = parseFloat(value);
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

  // Sync display value when initialValue changes externally (and not focused)
  const syncValue = useCallback((value: number) => {
    if (!isFocused) {
      setDisplayValue(String(value));
    }
  }, [isFocused]);

  return {
    value: displayValue,
    onChange: handleChange,
    onBlur: handleBlur,
    onFocus: handleFocus,
    onKeyDown: handleKeyDown,
    syncValue,
  };
}

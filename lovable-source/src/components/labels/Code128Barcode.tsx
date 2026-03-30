import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export interface Code128BarcodeProps {
  value: string;
  height?: number;
  width?: number;
  margin?: number;
  className?: string;
}

export function Code128Barcode({
  value,
  height = 40,
  width = 1.45,
  margin = 0,
  className,
}: Code128BarcodeProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    if (!value) {
      svgRef.current.innerHTML = '';
      return;
    }

    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        displayValue: false,
        width,
        height,
        margin,
      });
    } catch {
      // If barcode generation fails, clear SVG to avoid stale output.
      svgRef.current.innerHTML = '';
    }
  }, [value, height, width, margin]);

  return <svg ref={svgRef} className={className} />;
}

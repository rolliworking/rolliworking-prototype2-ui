import { useEffect, useCallback, useRef } from "react";

interface UseBarcodeInputOptions {
  onScan: (data: string) => void;
  minLength?: number; // Minimum characters for valid scan
  maxDelay?: number; // Max ms between keystrokes (scanners are fast)
  enabled?: boolean;
}

/**
 * Hook to detect physical barcode scanner input.
 * Barcode scanners emulate rapid keyboard input ending with Enter.
 */
export function useBarcodeScannerInput({
  onScan,
  minLength = 10,
  maxDelay = 350, // DataMatrix on Zebra LP 2824 needs extra time per character
  enabled = true,
}: UseBarcodeInputOptions) {
  const bufferRef = useRef("");
  const lastKeystrokeRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const keystrokeCountRef = useRef(0);

  const resetBuffer = useCallback(() => {
    bufferRef.current = "";
    keystrokeCountRef.current = 0;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeSinceLastKey = now - lastKeystrokeRef.current;

      // If too much time has passed, reset buffer (user typing manually)
      if (timeSinceLastKey > maxDelay && bufferRef.current.length > 0) {
        console.log("[BarcodeScanner] Buffer reset due to timeout. timeSinceLastKey:", timeSinceLastKey, "maxDelay:", maxDelay, "lost buffer:", bufferRef.current.substring(0, 60));
        resetBuffer();
      }

      lastKeystrokeRef.current = now;

      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (e.key === "Enter") {
        console.log("[BarcodeScanner] Enter pressed. Buffer length:", bufferRef.current.length, "keystrokes:", keystrokeCountRef.current, "minLength:", minLength, "buffer:", bufferRef.current.substring(0, 80));
        // Check if we have enough data for a valid scan
        // Also check keystroke rate - scanners fire many keys rapidly
        if (bufferRef.current.length >= minLength && keystrokeCountRef.current >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          
          // Clear any input that might have received partial data
          const activeEl = document.activeElement;
          if (activeEl instanceof HTMLInputElement) {
            // Remove the scanned data from the input
            const scannedData = bufferRef.current;
            if (activeEl.value.includes(scannedData) || scannedData.includes(activeEl.value)) {
              activeEl.value = "";
              // Trigger input event to update React state
              activeEl.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }
          
          onScan(bufferRef.current);
        }
        resetBuffer();
        return;
      }

      // Only accept printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += e.key;
        keystrokeCountRef.current++;

        // Set timeout to reset buffer if no more input
        timeoutRef.current = setTimeout(() => {
          resetBuffer();
        }, maxDelay * 3);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, maxDelay, minLength, onScan, resetBuffer]);

  return { resetBuffer };
}

import * as React from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Camera, X, Loader2, ZoomIn } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const html5QrCodeRef = React.useRef<Html5Qrcode | null>(null);
  const videoTrackRef = React.useRef<MediaStreamTrack | null>(null);
  const mountId = "barcode-reader";
  const [isStarting, setIsStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [maxZoom, setMaxZoom] = React.useState(1);
  const [supportsZoom, setSupportsZoom] = React.useState(false);

  const stopScanner = React.useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (state === 2) { // Html5QrcodeScannerState.SCANNING
          await html5QrCodeRef.current.stop();
        }
      } catch (e) {
        console.debug("Stop scanner error:", e);
      }
      html5QrCodeRef.current = null;
    }
    videoTrackRef.current = null;
    setZoom(1);
    setSupportsZoom(false);
  }, []);

  const startScanner = React.useCallback(async () => {
    setIsStarting(true);
    setError(null);

    try {
      // Clean up any existing instance
      await stopScanner();

      // Wait for DOM element to be ready
      await new Promise((resolve) => setTimeout(resolve, 300));

      const element = document.getElementById(mountId);
      if (!element) {
        throw new Error("Scanner element not found");
      }

      const html5QrCode = new Html5Qrcode(mountId);
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.5,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.PDF_417,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          onScan(decodedText);
          stopScanner();
          onClose();
        },
        () => {
          // Ignore scan errors (no code in frame)
        }
      );

      // Get video track for zoom control
      const videoElement = document.querySelector(`#${mountId} video`) as HTMLVideoElement;
      if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        if (track) {
          videoTrackRef.current = track;
          const capabilities = track.getCapabilities() as any;
          if (capabilities.zoom) {
            setSupportsZoom(true);
            setMaxZoom(capabilities.zoom.max || 5);
            setZoom(capabilities.zoom.min || 1);
          }
        }
      }
    } catch (err: any) {
      console.error("Camera start error:", err);
      const message = err?.message || String(err);
      if (message.includes("NotAllowedError") || message.includes("Permission")) {
        setError("Camera permission denied. Please allow camera access and try again.");
      } else if (message.includes("NotFoundError")) {
        setError("No camera found on this device.");
      } else {
        setError("Unable to start camera. Please try again.");
      }
    } finally {
      setIsStarting(false);
    }
  }, [onScan, onClose, stopScanner]);

  React.useEffect(() => {
    if (open) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [open, startScanner, stopScanner]);

  const handleZoomChange = React.useCallback((value: number[]) => {
    const newZoom = value[0];
    setZoom(newZoom);
    if (videoTrackRef.current) {
      try {
        videoTrackRef.current.applyConstraints({
          advanced: [{ zoom: newZoom } as any]
        });
      } catch (e) {
        console.debug("Zoom error:", e);
      }
    }
  }, []);

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scan Barcode
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div 
            id={mountId} 
            className="w-full min-h-[200px] bg-muted rounded-lg overflow-hidden"
          />
          
          {isStarting && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Starting camera...</span>
            </div>
          )}
          
          {error && (
            <div className="text-center space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="secondary" size="sm" onClick={startScanner}>
                Try Again
              </Button>
            </div>
          )}
          
          {supportsZoom && (
            <div className="flex items-center gap-3">
              <ZoomIn className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[zoom]}
                min={1}
                max={maxZoom}
                step={0.1}
                onValueChange={handleZoomChange}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground w-10 text-right">
                {zoom.toFixed(1)}x
              </span>
            </div>
          )}
          
          {!isStarting && !error && (
            <p className="text-sm text-muted-foreground text-center">
              {supportsZoom ? "Use zoom slider for small barcodes." : "Position the barcode within the scanning area."}
            </p>
          )}
          
          <Button variant="outline" onClick={handleClose} className="w-full">
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

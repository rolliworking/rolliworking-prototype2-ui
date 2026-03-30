import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, CameraOff, SwitchCamera } from 'lucide-react';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  isActive?: boolean;
  className?: string;
}

export function QRScanner({ onScan, isActive = true, className }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scanCallbackRef = useRef(onScan);

  // Keep callback ref updated
  useEffect(() => {
    scanCallbackRef.current = onScan;
  }, [onScan]);

  const startScanner = useCallback(async (cameraId?: string) => {
    if (!containerRef.current) return;

    try {
      setError(null);
      
      // Get available cameras
      const devices = await Html5Qrcode.getCameras();
      if (devices.length === 0) {
        setError('No cameras found');
        return;
      }
      
      setCameras(devices);
      
      // Create scanner instance
      scannerRef.current = new Html5Qrcode('qr-reader');
      
      const selectedCamera = cameraId || devices[currentCameraIndex]?.id || devices[0].id;
      
      await scannerRef.current.start(
        selectedCamera,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Trigger haptic feedback
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          scanCallbackRef.current(decodedText);
        },
        () => {
          // Ignore errors during scanning
        }
      );
      
      setIsScanning(true);
    } catch (err) {
      console.error('Scanner error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start scanner');
    }
  }, [currentCameraIndex]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
        setIsScanning(false);
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  }, [isScanning]);

  const switchCamera = useCallback(async () => {
    if (cameras.length <= 1) return;
    
    await stopScanner();
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    await startScanner(cameras[nextIndex].id);
  }, [cameras, currentCameraIndex, startScanner, stopScanner]);

  useEffect(() => {
    if (isActive && !isScanning) {
      startScanner();
    } else if (!isActive && isScanning) {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isActive]);

  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="relative">
        <div 
          id="qr-reader" 
          ref={containerRef}
          className="w-full aspect-square bg-muted"
        />
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/90">
            <div className="text-center p-4">
              <CameraOff className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-destructive">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => startScanner()}
              >
                Retry
              </Button>
            </div>
          </div>
        )}
        
        {/* Scanner overlay */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[250px] h-[250px] border-2 border-primary rounded-lg">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
              </div>
            </div>
          </div>
        )}
        
        {/* Controls */}
        <div className="absolute bottom-4 right-4 flex gap-2">
          {cameras.length > 1 && (
            <Button 
              size="icon" 
              variant="secondary"
              onClick={switchCamera}
              className="rounded-full"
            >
              <SwitchCamera className="h-4 w-4" />
            </Button>
          )}
          <Button 
            size="icon" 
            variant={isScanning ? 'destructive' : 'default'}
            onClick={isScanning ? stopScanner : () => startScanner()}
            className="rounded-full"
          >
            {isScanning ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}

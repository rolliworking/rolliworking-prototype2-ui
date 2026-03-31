import * as React from "react";
import { Camera, X, Send, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ScantronCameraProps {
  open: boolean;
  onClose: () => void;
  onCapture: (photos: string[]) => void;
  isProcessing: boolean;
}

const MAX_PHOTOS = 5;

export const ScantronCamera: React.FC<ScantronCameraProps> = ({
  open,
  onClose,
  onCapture,
  isProcessing,
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [cameraReady, setCameraReady] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [showingPhotos, setShowingPhotos] = React.useState(false);

  // Start camera when opened
  React.useEffect(() => {
    if (!open) {
      // Cleanup
      stopCamera();
      setPhotos([]);
      setCameraReady(false);
      setCameraError(null);
      setShowingPhotos(false);
      return;
    }

    // Lock scroll
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    startCamera();

    return () => {
      stopCamera();
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [open]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraReady(true);
        };
      }
    } catch (err: unknown) {
      console.error("Camera error:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setCameraError(`Could not access camera: ${msg}`);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = React.useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    if (photos.length >= MAX_PHOTOS) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    setPhotos((prev) => {
      if (prev.length >= MAX_PHOTOS) return prev;
      const next = [...prev, dataUrl];
      toast.success(`Photo ${next.length} captured. ${MAX_PHOTOS - next.length} more allowed.`);
      return next;
    });
  }, [photos.length]);

  const removePhoto = React.useCallback((idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleFileUpload = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = MAX_PHOTOS - photos.length;
    const toProcess = Array.from(files).slice(0, remaining);

    toProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPhotos((prev) => {
          if (prev.length >= MAX_PHOTOS) return prev;
          const next = [...prev, dataUrl];
          toast.success(`Photo ${next.length} added. ${MAX_PHOTOS - next.length} more allowed.`);
          return next;
        });
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same file can be re-selected
    e.target.value = "";
  }, [photos.length]);

  const submitPhotos = React.useCallback(() => {
    if (photos.length === 0) return;
    onCapture(photos);
  }, [photos, onCapture]);

  if (!open) return null;

  const canTakeMore = photos.length < MAX_PHOTOS;
  const canFinish = photos.length >= 1;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Hidden canvas for capturing frames */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top bar */}
      <div className="flex items-center justify-between p-3 bg-black/80 text-white">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/20">
          <X className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium">
          {photos.length === 0 ? "Capture Scantron Sheet" : `${photos.length} / ${MAX_PHOTOS} photos`}
        </span>
        {canFinish ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowingPhotos(!showingPhotos)}
            className="text-white hover:bg-white/20 text-xs"
          >
            {showingPhotos ? "Camera" : "Review"}
          </Button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 relative overflow-hidden">
        {cameraError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 h-full">
            <Camera className="h-16 w-16 text-red-400" />
            <p className="text-red-300 text-sm text-center">{cameraError}</p>
            <Button onClick={startCamera} variant="outline" size="sm" className="text-white border-white/30">
              Retry
            </Button>
          </div>
        ) : showingPhotos ? (
          /* Photo review grid */
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-6 h-full overflow-y-auto">
            <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
              {photos.map((photo, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg border border-white/20 overflow-hidden">
                  <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs text-white text-center py-0.5">
                    {idx + 1}
                  </div>
                  <button
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 bg-red-600 rounded-full p-1"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Live camera viewfinder */
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-white animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Hidden file input for direct upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Bottom controls */}
      <div className="relative flex items-center justify-center p-4 pb-8 bg-black/80">
        {/* Left slot: Upload */}
        <div className="absolute left-4">
          {canTakeMore && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 rounded-full border-2 border-white/60 flex items-center justify-center text-white hover:bg-white/10"
            >
              <Upload className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Center: Camera shutter (always occupies space) */}
        {!showingPhotos && !cameraError && (
          <button
            onClick={capturePhoto}
            disabled={!cameraReady || !canTakeMore}
            className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-30"
          >
            <div className="w-12 h-12 rounded-full bg-white" />
          </button>
        )}

        {/* Right slot: Submit */}
        <div className="absolute right-4">
          {canFinish && (
            <Button
              onClick={submitPhotos}
              disabled={isProcessing}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1.5" />
              )}
              {isProcessing ? "Processing..." : "Finished — Process"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

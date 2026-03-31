import * as React from "react";
import { FolderOpen, ImageIcon, Loader2, Trash2, Play, FileText, ChevronRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useScantronQueue, type QueuedPage } from "@/hooks/use-scantron-queue";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface ScannedFile {
  id: string;
  filename: string;
  dataUrl: string;
}

interface ScannerControlPanelProps {
  open: boolean;
  onClose: () => void;
  pendingUploads: Array<{ id: string; filename: string; storage_path: string; created_at: string }>;
  onProcessUpload: (upload: { id: string; storage_path: string }) => void;
  onDismissUpload: (id: string) => void;
  /** Process a local file directly as a data URL */
  onProcessLocalFile?: (file: ScannedFile) => void;
  /** Process a queued page from the batch queue */
  onProcessQueuedPage?: (page: QueuedPage) => void;
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"];

export function ScannerControlPanel({
  open,
  onClose,
  pendingUploads,
  onProcessUpload,
  onDismissUpload,
  onProcessLocalFile,
  onProcessQueuedPage,
}: ScannerControlPanelProps) {
  const [localFiles, setLocalFiles] = React.useState<ScannedFile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = React.useState<{ current: number; total: number } | null>(null);

  const {
    queue,
    currentIndex,
    currentPage,
    isActive: queueActive,
    doneCount,
    totalCount,
    enqueue,
    clearQueue,
    markCurrentProcessing,
    advanceToNext,
    goToIndex,
    markCurrentSkipped,
  } = useScantronQueue();

  // Convert a PDF file to array of page images
  const pdfToImages = async (file: File): Promise<Omit<QueuedPage, "status">[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const pages: Omit<QueuedPage, "status">[] = [];

    for (let i = 1; i <= numPages; i++) {
      setPdfProgress({ current: i, total: numPages });
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x for better OCR quality
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

      pages.push({
        id: crypto.randomUUID(),
        pageNumber: i,
        totalPages: numPages,
        filename: file.name,
        dataUrl,
      });
    }

    setPdfProgress(null);
    return pages;
  };

  const pickFolder = async () => {
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: "read" });
      setLoading(true);

      const files: ScannedFile[] = [];
      const pdfFiles: File[] = [];

      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind !== "file") continue;
        const ext = name.substring(name.lastIndexOf(".")).toLowerCase();

        if (ext === ".pdf") {
          const file: File = await handle.getFile();
          pdfFiles.push(file);
        } else if (IMAGE_EXTENSIONS.includes(ext)) {
          const file: File = await handle.getFile();
          const dataUrl = await readFileAsDataUrl(file);
          files.push({ id: crypto.randomUUID(), filename: name, dataUrl });
        }
      }

      // Process PDFs into queue
      if (pdfFiles.length > 0) {
        const allPages: Omit<QueuedPage, "status">[] = [];
        for (const pdf of pdfFiles) {
          const pages = await pdfToImages(pdf);
          allPages.push(...pages);
        }
        if (allPages.length > 0) {
          enqueue(allPages);
          toast.success(`Added ${allPages.length} page(s) from ${pdfFiles.length} PDF(s) to queue.`);
        }
      }

      // Handle regular images
      if (files.length > 0) {
        setLocalFiles(files);
        toast.success(`Found ${files.length} image(s) in folder.`);
      } else if (pdfFiles.length === 0) {
        toast.info("No image or PDF files found in the selected folder.");
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      toast.error("Folder picker is not supported in this browser. Try Chrome or Edge.");
    } finally {
      setLoading(false);
    }
  };

  const pickFiles = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.pdf";
    input.multiple = true;
    input.onchange = async () => {
      const selected = input.files;
      if (!selected || selected.length === 0) return;

      setLoading(true);
      const images: ScannedFile[] = [];
      const allPages: Omit<QueuedPage, "status">[] = [];

      for (let i = 0; i < selected.length; i++) {
        const file = selected[i];
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          const pages = await pdfToImages(file);
          allPages.push(...pages);
        } else {
          const dataUrl = await readFileAsDataUrl(file);
          images.push({ id: crypto.randomUUID(), filename: file.name, dataUrl });
        }
      }

      // Add PDFs to queue
      if (allPages.length > 0) {
        enqueue(allPages);
        toast.success(`Added ${allPages.length} page(s) to batch queue.`);
      }

      // Add images to local list
      if (images.length > 0) {
        setLocalFiles((prev) => [...prev, ...images]);
        toast.success(`Added ${images.length} image(s).`);
      }

      setLoading(false);
    };
    input.click();
  };

  const processLocalFile = (file: ScannedFile) => {
    if (!onProcessLocalFile) return;
    setProcessingId(file.id);
    onProcessLocalFile(file);
    setLocalFiles((prev) => prev.filter((f) => f.id !== file.id));
    setProcessingId(null);
  };

  const removeLocalFile = (id: string) => {
    setLocalFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const processCurrentQueueItem = () => {
    if (!currentPage || !onProcessQueuedPage) return;
    markCurrentProcessing();
    onProcessQueuedPage(currentPage);
    onClose(); // Close panel so user can review in the form
  };

  const skipCurrentQueueItem = () => {
    markCurrentSkipped();
    const hasMore = advanceToNext();
    if (!hasMore) {
      toast.info("Batch queue completed.");
    }
  };

  const progressPercent = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Scan Images
          </DialogTitle>
          <DialogDescription>
            Pick a folder or select images/PDFs to process. Multi-page PDFs will be split into a batch queue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Picker Buttons */}
          <div className="flex gap-2">
            <Button onClick={pickFolder} variant="default" className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FolderOpen className="h-4 w-4 mr-1.5" />}
              Pick Folder
            </Button>
            <Button onClick={pickFiles} variant="outline" className="flex-1" disabled={loading}>
              <ImageIcon className="h-4 w-4 mr-1.5" />
              Pick Files
            </Button>
          </div>

          {/* PDF splitting progress */}
          {pdfProgress && (
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">
                Splitting PDF... Page {pdfProgress.current} of {pdfProgress.total}
              </p>
              <Progress value={(pdfProgress.current / pdfProgress.total) * 100} className="h-2" />
            </div>
          )}

          {/* Batch Queue UI */}
          {queueActive && totalCount > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">
                    Batch Queue: Page {currentIndex + 1} of {totalCount}
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearQueue}>
                  Clear Queue
                </Button>
              </div>

              <Progress value={progressPercent} className="h-2" />

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{doneCount} completed</span>
                <span>{totalCount - doneCount - (currentPage?.status === "processing" ? 1 : 0)} remaining</span>
              </div>

              {currentPage && (
                <div className="flex items-center gap-2 rounded-md border bg-background p-2">
                  <img
                    src={currentPage.dataUrl}
                    alt={`Page ${currentPage.pageNumber}`}
                    className="h-16 w-12 rounded object-cover flex-shrink-0 border"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{currentPage.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      Page {currentPage.pageNumber} of {currentPage.totalPages}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={processCurrentQueueItem}
                      disabled={currentPage.status === "processing"}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Process
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground"
                      onClick={skipCurrentQueueItem}
                    >
                      <SkipForward className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Mini thumbnails for queue navigation */}
              {totalCount > 1 && (
                <div className="flex gap-1 overflow-x-auto py-1">
                  {queue.map((page, idx) => (
                    <button
                      key={page.id}
                      onClick={() => goToIndex(idx)}
                      className={`flex-shrink-0 w-8 h-10 rounded border overflow-hidden transition-all ${
                        idx === currentIndex
                          ? "ring-2 ring-primary"
                          : page.status === "done"
                          ? "opacity-50"
                          : page.status === "skipped"
                          ? "opacity-30"
                          : ""
                      }`}
                    >
                      <img src={page.dataUrl} alt={`Page ${page.pageNumber}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Local files list (non-PDF) */}
          {localFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Single images ({localFiles.length})</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {localFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={file.dataUrl} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />
                      <span className="truncate font-mono text-xs">{file.filename}</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={processingId === file.id}
                        onClick={() => processLocalFile(file)}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Process
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => removeLocalFile(file.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legacy pending uploads from the old auto-upload system */}
          {pendingUploads.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Pending remote uploads ({pendingUploads.length})</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {pendingUploads.map((upload) => (
                  <div key={upload.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <span className="truncate font-mono text-xs">{upload.filename}</span>
                    <div className="flex gap-1">
                      <Button variant="default" size="sm" className="h-7 text-xs" onClick={() => onProcessUpload(upload)}>
                        Process
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => onDismissUpload(upload.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {localFiles.length === 0 && pendingUploads.length === 0 && !queueActive && (
            <div className="rounded-md border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
              Pick a folder or files to get started. Multi-page PDFs from your scanner will be split into a batch queue
              for one-by-one review.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

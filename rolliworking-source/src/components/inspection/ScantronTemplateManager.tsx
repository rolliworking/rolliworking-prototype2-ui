import * as React from "react";
import { Upload, FileCheck, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useScantronTemplates, useUploadScantronTemplate, useSetActiveTemplate } from "@/hooks/use-scantron-templates";

interface ScantronTemplateManagerProps {
  open: boolean;
  onClose: () => void;
}

export function ScantronTemplateManager({ open, onClose }: ScantronTemplateManagerProps) {
  const { data: templates, isLoading } = useScantronTemplates();
  const uploadMutation = useUploadScantronTemplate();
  const setActiveMutation = useSetActiveTemplate();

  const [file, setFile] = React.useState<File | null>(null);
  const [version, setVersion] = React.useState("");
  const [label, setLabel] = React.useState("");

  // Auto-suggest next version
  React.useEffect(() => {
    if (open && templates && templates.length > 0) {
      const latest = templates[0].version;
      const match = latest.match(/^v?(\d+)\.(\d+)$/);
      if (match) {
        const minor = parseInt(match[2]) + 1;
        setVersion(`v${match[1]}.${minor}`);
      } else {
        setVersion(`v${templates.length + 1}.0`);
      }
    } else if (open) {
      setVersion("v1.0");
    }
  }, [open, templates]);

  const handleUpload = async () => {
    if (!file || !version.trim()) return;
    await uploadMutation.mutateAsync({ file, version: version.trim(), label: label.trim() || undefined });
    setFile(null);
    setLabel("");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Scantron Templates
          </DialogTitle>
          <DialogDescription>
            Upload blank scantron sheets for AI comparison. The active template is sent alongside filled sheets for better accuracy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload new */}
          <div className="space-y-3 p-3 rounded-lg border border-dashed border-border bg-muted/30">
            <h4 className="text-sm font-medium">Upload New Template</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Version</Label>
                <Input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="v1.0"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Label (optional)</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Added bracelet grid"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="h-8 text-sm flex-1"
              />
              <Button
                size="sm"
                disabled={!file || !version.trim() || uploadMutation.isPending}
                onClick={handleUpload}
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Upload
              </Button>
            </div>
          </div>

          {/* Existing templates */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Existing Templates</h4>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !templates?.length ? (
              <p className="text-sm text-muted-foreground py-2">No templates uploaded yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2 rounded-md border border-border bg-background"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium">{t.version}</span>
                      {t.label && (
                        <span className="text-xs text-muted-foreground">{t.label}</span>
                      )}
                      {t.is_active && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          <Check className="h-2.5 w-2.5 mr-0.5" />
                          Active
                        </Badge>
                      )}
                    </div>
                    {!t.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        disabled={setActiveMutation.isPending}
                        onClick={() => setActiveMutation.mutate(t.id)}
                      >
                        Set Active
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

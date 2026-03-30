import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, CheckCircle2, Loader2, Image } from 'lucide-react';

export function LogoUpload() {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    setUploading(true);
    try {
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('assets')
        .upload('rw-logo.jpg', file, {
          cacheControl: '3600',
          upsert: true, // Replace existing file
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('assets')
        .getPublicUrl('rw-logo.jpg');

      setPreviewUrl(urlData.publicUrl + '?t=' + Date.now());
      setUploaded(true);
      toast.success('Logo uploaded successfully! It will now appear on PDF estimates.');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Failed to upload logo: ' + (error.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const checkExistingLogo = async () => {
    const { data } = supabase.storage
      .from('assets')
      .getPublicUrl('rw-logo.jpg');
    
    // Try to fetch to see if it exists
    try {
      const response = await fetch(data.publicUrl, { method: 'HEAD' });
      if (response.ok) {
        setPreviewUrl(data.publicUrl + '?t=' + Date.now());
        setUploaded(true);
      }
    } catch {
      // Logo doesn't exist yet
    }
  };

  // Check for existing logo on mount
  useState(() => {
    checkExistingLogo();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Company Logo
        </CardTitle>
        <CardDescription>
          Upload your company logo to display on PDF estimates and email templates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {previewUrl && (
          <div className="border rounded-lg p-4 bg-slate-50">
            <p className="text-sm text-slate-600 mb-2">Current Logo:</p>
            <img 
              src={previewUrl} 
              alt="Company logo" 
              className="max-h-16 w-auto"
              onError={() => setPreviewUrl(null)}
            />
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex items-center gap-3">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            variant={uploaded ? "outline" : "default"}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : uploaded ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                Replace Logo
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Logo
              </>
            )}
          </Button>
          
          {uploaded && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Logo is configured
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500">
          Recommended: JPG or PNG, max 2MB. The logo will appear in the header of PDF estimates.
        </p>
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { format } from "date-fns";
import { FileWarning, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/use-page-meta";

interface WaiverData {
  id: string;
  waiver_number: string | null;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  watch_brand: string | null;
  watch_model: string | null;
  serial_number: string | null;
  estimate_number: string | null;
  reference_number: string | null;
  dial_defects: boolean;
  hand_defects: boolean;
  additional_components: string | null;
  additional_info: string | null;
  waiver_date: string | null;
  job_id: string | null;
}

export default function SignWaiver() {
  usePageMeta({ title: "Sign Waiver | Rolliworks" });
  
  const [searchParams] = useSearchParams();
  const { waiverNumber } = useParams();
  // Support both /waiver/LW-00001 and legacy /sign-waiver?id=xxx
  const waiverIdentifier = waiverNumber || searchParams.get("id");

  const [waiver, setWaiver] = useState<WaiverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const fetchWaiver = async () => {
      if (!waiverIdentifier) {
        setError("Invalid waiver link");
        setLoading(false);
        return;
      }

      try {
        // Use edge function to fetch waiver (no auth required)
        // Pass either waiver_number (LW-00001) or UUID
        const { data, error: fetchError } = await supabase.functions.invoke("get-waiver", {
          body: { waiverIdentifier },
        });

        if (fetchError) throw fetchError;
        if (!data?.waiver) {
          setError("Waiver not found");
          setLoading(false);
          return;
        }

        if (data.waiver.status === "completed") {
          setCompleted(true);
        }

        setWaiver(data.waiver as WaiverData);
      } catch (err: any) {
        console.error("Error fetching waiver:", err);
        setError("Failed to load waiver");
      } finally {
        setLoading(false);
      }
    };

    fetchWaiver();
  }, [waiverIdentifier]);

  const getAreasOfConcern = () => {
    if (!waiver) return "";
    const areas = [];
    if (waiver.dial_defects) areas.push("Dial Defects");
    if (waiver.hand_defects) areas.push("Hand Defects");
    if (waiver.additional_components) areas.push(waiver.additional_components);
    return areas.join(", ");
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    if (!authorized) {
      toast.error("Please check the authorization box to proceed");
      return;
    }
    if (!waiver) return;

    setSubmitting(true);

    try {
      // Use edge function to sign waiver (no auth required)
      const { data, error: signError } = await supabase.functions.invoke("sign-waiver", {
        body: { 
          waiverId: waiver.id,
          customerName: customerName.trim(),
        },
      });

      if (signError) throw signError;
      if (data?.error) throw new Error(data.error);

      setCompleted(true);
      toast.success("Waiver signed successfully!");
    } catch (err: any) {
      console.error("Error submitting waiver:", err);
      toast.error(err.message || "Failed to submit waiver");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !waiver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load Waiver</h2>
            <p className="text-muted-foreground">{error || "Waiver not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Waiver Signed</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for signing the liability waiver. A confirmation email has been sent to you.
            </p>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium">Watch Details:</p>
              <p>{waiver.watch_brand} {waiver.watch_model}</p>
              {waiver.serial_number && <p>Serial: {waiver.serial_number}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">ROLLIWORKS</h1>
          <p className="text-muted-foreground mt-1">Watch Repair Specialists</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileWarning className="h-6 w-6 text-amber-500" />
                <CardTitle>REPAIR LIABILITY WAIVER</CardTitle>
              </div>
              {waiver.waiver_number && (
                <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{waiver.waiver_number}</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date */}
            <div className="text-sm">
              <span className="text-muted-foreground">Date: </span>
              <span className="font-medium">
                {waiver.waiver_date 
                  ? format(new Date(waiver.waiver_date), "MMMM d, yyyy")
                  : format(new Date(), "MMMM d, yyyy")}
              </span>
            </div>

            {/* Watch Details */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <h4 className="font-medium">Watch Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Brand/Model: </span>
                  <span className="font-medium">
                    {[waiver.watch_brand, waiver.watch_model].filter(Boolean).join(" ") || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Serial: </span>
                  <span className="font-medium">{waiver.serial_number || "N/A"}</span>
                </div>
                {waiver.estimate_number && (
                  <div>
                    <span className="text-muted-foreground">Estimate #: </span>
                    <span className="font-medium">{waiver.estimate_number}</span>
                  </div>
                )}
                {waiver.reference_number && (
                  <div>
                    <span className="text-muted-foreground">Reference #: </span>
                    <span className="font-medium">{waiver.reference_number}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Areas of Concern */}
            <div className="space-y-2">
              <h4 className="font-medium">Area/Item of Concern</h4>
              <p className="text-sm bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                {getAreasOfConcern() || "Not specified"}
              </p>
            </div>

            {/* Additional Info */}
            {waiver.additional_info && (
              <div className="space-y-2">
                <h4 className="font-medium">Additional Information</h4>
                <p className="text-sm text-muted-foreground">{waiver.additional_info}</p>
              </div>
            )}

            {/* Waiver Terms */}
            <div className="rounded-lg border p-4 space-y-3 bg-amber-50/50 dark:bg-amber-950/20">
              <p className="text-sm">
                I, the undersigned, understand and acknowledge that the above watch has pre-existing 
                condition issues at the time it was presented for service.
              </p>
              <p className="text-sm font-medium">I further understand and agree to the following:</p>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>
                  <strong>Pre-Existing Condition</strong> - The damage has been disclosed and acknowledged 
                  by both the customer and Rolliworks.
                </li>
                <li>
                  <strong>Limitation of Liability</strong> - Rolliworks will take reasonable care during 
                  the repair process, but due to the fragile nature of the above noted part(s) and its existing 
                  damage, the company will not be held responsible for any additional cracking, chipping, 
                  fading, scratching, or other damage that may occur during a responsible and careful service process.
                </li>
                <li>
                  <strong>Customer Acceptance</strong> - I accept full responsibility for the pre-existing 
                  condition of the above noted part(s) and release Rolliworks, its employees, and representatives 
                  from any liability relating to the condition during or after service.
                </li>
              </ol>
            </div>

            {/* Customer Name Input */}
            <div className="space-y-2">
              <Label htmlFor="customer-name" className="text-base font-medium">
                Your Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customer-name"
                placeholder="Enter your full name to sign"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="text-lg py-6"
              />
            </div>

            {/* Authorization Checkbox */}
            <div className="flex items-start space-x-3 rounded-lg border border-amber-300 p-4 bg-amber-50/30 dark:bg-amber-950/20">
              <Checkbox
                id="authorization"
                checked={authorized}
                onCheckedChange={(checked) => setAuthorized(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="authorization" className="font-medium cursor-pointer leading-relaxed">
                I authorize Rolliworks to proceed with the requested repair/service despite the 
                acknowledged risk. <span className="text-destructive">*</span>
              </Label>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || !customerName.trim() || !authorized}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing Waiver...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Sign & Submit Waiver
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              A confirmation will be sent to your email address on file.
            </p>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p className="font-medium">Rolliworks</p>
          <p>14 N.E. 1st Ave Ste 403, Miami FL 33132</p>
          <p>408-800-3244 | M-F 9am to 5pm</p>
        </div>
      </div>
    </div>
  );
}

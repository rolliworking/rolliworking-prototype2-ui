import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Package, Loader2, AlertCircle } from "lucide-react";

export default function RequestShippingLabelPage() {
  const { estimateId } = useParams<{ estimateId: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Customer data pre-filled from estimate
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [insuranceAmount, setInsuranceAmount] = useState("");
  const [estimateNumber, setEstimateNumber] = useState("");

  useEffect(() => {
    async function fetchEstimateData() {
      if (!estimateId) {
        setError("Invalid request link");
        setLoading(false);
        return;
      }

      try {
        // Use edge function to fetch data (bypasses RLS)
        const response = await supabase.functions.invoke("request-shipping-label", {
          body: {
            estimateId,
            action: 'get',
          },
        });

        if (response.error) {
          console.error("Failed to fetch estimate:", response.error);
          setError("Estimate not found. Please contact Rolliworks for assistance.");
          setLoading(false);
          return;
        }

        const data = response.data;

        if (!data?.success || !data?.estimate) {
          setError("Estimate not found. Please contact Rolliworks for assistance.");
          setLoading(false);
          return;
        }


        // Pre-fill the form
        const customer = data.estimate.customer;
        if (customer) {
          setName(`${customer.first_name || ""} ${customer.last_name || ""}`.trim());
          setEmail(customer.email || "");
          setPhone(customer.mobile_phone || customer.phone || "");
        }

        // Format estimate number for display
        const estNum = data.estimate.estimate_number?.replace("EST-", "E") || "";
        setEstimateNumber(estNum);

        setLoading(false);
      } catch (err) {
        console.error("Error fetching estimate:", err);
        setError("Something went wrong. Please try again later.");
        setLoading(false);
      }
    }

    fetchEstimateData();
  }, [estimateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim() || !phone.trim() || !street.trim() || !city.trim() || !state.trim() || !zip.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    setError(null);

    // Build address and notes for the edge function
    const fullAddress = `${street.trim()}, ${city.trim()}, ${state.trim()} ${zip.trim()}`;
    const notesContent = [
      `Address: ${fullAddress}`,
      insuranceAmount.trim() ? `Requested Insurance: ${insuranceAmount.trim()}` : null,
    ].filter(Boolean).join('\n');

    try {
      const response = await supabase.functions.invoke("request-shipping-label", {
        body: {
          estimateId,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          notes: notesContent,
          action: 'submit',
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to submit request");
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error("Failed to submit:", err);
      setError(err.message || "Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#41b6e6]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="text-3xl font-bold">
              <span className="text-slate-700">ROLLI</span>
              <span className="text-[#41b6e6]">W</span>
              <span className="text-slate-700">ORKS</span>
            </div>
          </div>
          {estimateNumber && (
            <p className="text-sm text-muted-foreground">Estimate {estimateNumber}</p>
          )}
        </CardHeader>

        <CardContent>
          {error && !submitted && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {submitted ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <CardTitle className="mb-2">Request Submitted!</CardTitle>
              <CardDescription>
                Thank you! We've received your shipping label request. Our team will email you
                a prepaid shipping label within 1 business day.
              </CardDescription>
            </div>
          ) : error && !name ? (
            <div className="text-center py-6">
              <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <CardTitle className="mb-2">Unable to Load</CardTitle>
              <CardDescription>
                {error} Please contact Rolliworks directly at{" "}
                <a href="mailto:contact@rolliworks.com" className="text-[#41b6e6] underline">
                  contact@rolliworks.com
                </a>
              </CardDescription>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6 p-3 bg-[#41b6e6]/10 rounded-lg">
                <Package className="h-8 w-8 text-[#41b6e6]" />
                <div>
                  <h3 className="font-medium">Request a Shipping Label</h3>
                  <p className="text-sm text-muted-foreground">
                    We'll send you a prepaid label to ship your watch to us
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter your phone number"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="street">Street Address *</Label>
                  <Input
                    id="street"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="123 Main St, Apt 4"
                    required
                  />
                </div>

                <div className="grid grid-cols-6 gap-2">
                  <div className="col-span-3 space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      required
                    />
                  </div>
                  <div className="col-span-1 space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="TX"
                      maxLength={2}
                      required
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="zip">ZIP *</Label>
                    <Input
                      id="zip"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="78701"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="insuranceAmount">Requested Insurance Amount (optional)</Label>
                  <Input
                    id="insuranceAmount"
                    value={insuranceAmount}
                    onChange={(e) => setInsuranceAmount(e.target.value)}
                    placeholder="e.g. $5,000"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-[#41b6e6] hover:bg-[#3aa5d3]"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Request Shipping Label"
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By submitting, you confirm this information is correct for label delivery.
                </p>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

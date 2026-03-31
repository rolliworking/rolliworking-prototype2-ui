import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/use-page-meta";

interface PartItemData {
  id: string;
  name: string;
  qty: number;
  price: number;
  choice: "yes" | "no" | null;
}

export default function ApprovePartsRequest() {
  usePageMeta({ title: "Parts Approval | Rolliworks" });

  const [searchParams] = useSearchParams();
  const approvalId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approval, setApproval] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [partsItems, setPartsItems] = useState<PartItemData[]>([]);
  const [approvedByName, setApprovedByName] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const fetchApproval = async () => {
      if (!approvalId) {
        setError("Invalid approval link");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase.functions.invoke(
          "get-parts-approval",
          { body: { approvalId } }
        );

        if (fetchError) throw fetchError;
        if (!data?.approval) {
          setError("Approval not found");
          setLoading(false);
          return;
        }

        if (data.approval.status !== "pending") {
          setCompleted(true);
          setApproval(data.approval);
          setJob(data.job);
          setLoading(false);
          return;
        }

        setApproval(data.approval);
        setJob(data.job);

        // Build parts items from approval data
        const items = Array.isArray(data.approval.parts_items)
          ? data.approval.parts_items.map((item: any) => ({
              ...item,
              choice: item.choice || null,
            }))
          : [];
        setPartsItems(items);
      } catch (err: any) {
        console.error("Error fetching parts approval:", err);
        setError("Failed to load approval");
      } finally {
        setLoading(false);
      }
    };

    fetchApproval();
  }, [approvalId]);

  const handleItemChoice = (itemId: string, choice: "yes" | "no") => {
    setPartsItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, choice } : item))
    );
  };

  const allItemsAnswered = partsItems.every((item) => item.choice !== null);
  const canSubmit = approvedByName.trim().length >= 2 && allItemsAnswered;

  const partsTotal = partsItems.reduce((sum, p) => sum + p.price * p.qty, 0);

  const handleSubmit = async () => {
    if (!canSubmit || !approval) return;

    setSubmitting(true);
    try {
      const { data, error: submitError } = await supabase.functions.invoke(
        "submit-parts-approval",
        {
          body: {
            approvalId: approval.id,
            approvedByName: approvedByName.trim(),
            partsItems,
            clientNotes: clientNotes.trim() || null,
          },
        }
      );

      if (submitError) throw submitError;
      if (data?.error) throw new Error(data.error);

      setCompleted(true);
      toast.success("Parts approval submitted successfully!");
    } catch (err: any) {
      console.error("Error submitting parts approval:", err);
      toast.error(err.message || "Failed to submit approval");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-stone-400 mx-auto" />
          <p className="mt-3 text-sm text-stone-500 tracking-wide">Loading…</p>
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (error || !approval || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg border border-stone-200 p-8 text-center shadow-sm">
          <AlertCircle className="h-12 w-12 mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-stone-800">Unable to Load</h2>
          <p className="text-stone-500">{error || "Approval not found"}</p>
        </div>
      </div>
    );
  }

  // ─── Completed ───
  if (completed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="bg-[#1a1a2e] px-8 py-6 text-center">
            <h1 className="text-xl font-bold text-[#c9a94e] tracking-[0.2em]">ROLLIWORKS</h1>
          </div>
          <div className="p-8 text-center">
            <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-stone-800">Parts Approval Received</h2>
            <p className="text-stone-500 mb-6">
              Thank you for reviewing the parts request for your timepiece.
            </p>
            <div className="text-sm text-stone-500 space-y-1">
              <p className="font-medium text-stone-700">
                {job.watch_brand} {job.watch_model}
              </p>
              <p>Estimate #{job.estimate_number}</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const customerFirstName = (job.client_name || "").split(" ")[0] || "Valued Customer";

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ─── Branded Header ─── */}
      <header className="bg-[#1a1a2e] text-center py-8">
        <h1 className="text-2xl font-bold text-[#c9a94e] tracking-[0.25em]">ROLLIWORKS</h1>
        <div className="mt-2 flex items-center justify-center gap-8 text-[11px] text-stone-400 tracking-wider uppercase">
          <span>Est. Miami, FL</span>
          <span className="w-px h-3 bg-stone-600" />
          <span>Horological Services</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
        {/* ─── Greeting & Watch Info ─── */}
        <section className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="border-b border-stone-100 px-6 py-5">
            <p className="text-stone-700 leading-relaxed">
              Dear {customerFirstName},
            </p>
            <p className="text-stone-600 mt-2 leading-relaxed text-sm">
              We have identified parts needed for your timepiece. Please review each item below and approve or decline.
            </p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-stone-100">
            <div className="px-6 py-4">
              <p className="text-[10px] text-stone-400 uppercase tracking-widest mb-1">Timepiece</p>
              <p className="text-sm font-semibold text-stone-800">
                {job.watch_brand} {job.watch_model}
              </p>
              {job.serial_number && (
                <p className="text-xs text-stone-500 mt-0.5">Ref. {job.serial_number}</p>
              )}
            </div>
            <div className="px-6 py-4">
              <p className="text-[10px] text-stone-400 uppercase tracking-widest mb-1">Estimate No.</p>
              <p className="text-sm font-semibold text-stone-800">{job.estimate_number}</p>
            </div>
          </div>
        </section>

        {/* ─── Parts Approval Survey ─── */}
        <section className="bg-white rounded-lg border-2 border-[#c9a94e]/40 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#c9a94e]/20 bg-[#c9a94e]/5">
            <div className="flex items-center gap-2.5">
              <Package className="h-4 w-4 text-[#c9a94e]" />
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-stone-700">
                Parts Requiring Approval
              </h2>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Please select <strong>APPROVE</strong> or <strong>DECLINE</strong> for each part below. All items require a response.
            </p>
          </div>
          <div className="divide-y divide-stone-100">
            {partsItems.map((item) => (
              <div key={item.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-stone-800">{item.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">Qty: {item.qty}</p>
                  </div>
                  <span className="text-sm font-semibold text-stone-700 tabular-nums whitespace-nowrap">
                    ${(item.price * item.qty).toFixed(2)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleItemChoice(item.id, "yes")}
                    className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider border transition-all ${
                      item.choice === "yes"
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                        : "border-stone-200 text-stone-500 hover:border-emerald-300 hover:text-emerald-600"
                    }`}
                  >
                    Yes — Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleItemChoice(item.id, "no")}
                    className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider border transition-all ${
                      item.choice === "no"
                        ? "bg-stone-700 border-stone-700 text-white shadow-sm"
                        : "border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-700"
                    }`}
                  >
                    No — Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* Total */}
          <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Total</span>
            <span className="text-sm font-bold text-stone-800 tabular-nums">${partsTotal.toFixed(2)}</span>
          </div>
        </section>

        {/* ─── Client Notes ─── */}
        <section className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4">
            <label className="text-xs font-bold uppercase tracking-[0.1em] text-stone-500 block mb-2">
              Notes or Questions (Optional)
            </label>
            <Textarea
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              placeholder="Any questions or comments about the parts…"
              maxLength={1000}
              className="min-h-[80px] border-stone-200 focus:border-[#c9a94e] focus:ring-[#c9a94e]/20"
            />
            <p className="text-[10px] text-stone-400 mt-1 text-right">{clientNotes.length}/1000</p>
          </div>
        </section>

        {/* ─── Authorization ─── */}
        <section className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-stone-500">
              Authorization
            </h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1.5">
                Full Name <span className="text-red-400">*</span>
              </label>
              <Input
                value={approvedByName}
                onChange={(e) => setApprovedByName(e.target.value)}
                placeholder="Enter your full name"
                className="border-stone-200 focus:border-[#c9a94e] focus:ring-[#c9a94e]/20"
              />
              <p className="text-[10px] text-stone-400 mt-1">
                By entering your name, you authorize the parts listed above.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className={`w-full py-3.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${
                canSubmit && !submitting
                  ? "bg-[#1a1a2e] text-[#c9a94e] hover:bg-[#2a2a4e] shadow-lg"
                  : "bg-stone-200 text-stone-400 cursor-not-allowed"
              }`}
            >
              {submitting ? "Submitting…" : "Submit Parts Approval"}
            </button>

            {!allItemsAnswered && partsItems.length > 0 && (
              <p className="text-xs text-amber-600 text-center">
                Please respond to all {partsItems.length} part{partsItems.length !== 1 ? "s" : ""} before submitting.
              </p>
            )}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="py-8 text-center">
      <p className="text-[10px] text-stone-400 tracking-wider uppercase">
        © {new Date().getFullYear()} Rolliworks · Miami, FL
      </p>
    </footer>
  );
}

import { useRef, useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, ImageDown, Loader2, Pencil, Check } from "lucide-react";
import html2canvas from "html2canvas";

// Mirrors the exact data from InspectionForm.tsx
const CONDITIONS = ["Excellent", "Very Good", "Good", "Fair", "Poor", "NONE"] as const;

const SECTIONS = [
  {
    title: "DIAL",
    showWaiver: true,
    notes: [
      "Some Paint Defects",
      "Lume Shedding",
      "Scuffs on Hour Markers",
      "Chips along edge",
      "Moisture Damage",
      "No Defects to Note",
      "No Major Defects",
      "Aftermarket (not made by Rolex)",
      "Tritium",
      "Luminova",
    ],
  },
  {
    title: "HANDS",
    showWaiver: true,
    notes: [
      "Scuffs",
      "Light Scratches",
      "Lume Shedding",
      "Hands Bent",
      "No Defects to Note",
      "No Major Defects",
      "Aftermarket (not made by Rolex)",
      "Tritium",
      "Luminova",
    ],
  },
  {
    title: "BEZEL",
    notes: [
      "Scuffs",
      "Scuffs on steel ring",
      "Scuffs on gold ring",
      "Scuffs on insert",
      "Soft Flutes",
      "No Defects to Note",
      "No Major Defects",
      "Normal Wear",
      "Aftermarket (not made by Rolex)",
      "Recut Bezel + Welding?",
    ],
  },
  {
    title: "CROWN",
    notes: [
      "Scuffs",
      "No Defects to Note",
      "No Major Defects",
      "Not threading properly",
      "Coronet polished down",
      "Dented/Damaged",
      "Normal Wear",
      "Aftermarket (not made by Rolex)",
      "Catching on one thread. Might try new case tube $55",
    ],
  },
  {
    title: "CASE",
    extraFields: ["Retail Polish: ☐ Yes", "Case Restoration $________"],
    otherLines: 3,
    notes: [
      "Scuffs",
      "Normal Wear",
      "Some Nicks and Gashes",
      "Material Missing from Tips of Lugs (inner edge)",
      "Welding $140/hr",
    ],
  },
  {
    title: "CRYSTAL",
    notes: [
      "Scuffs",
      "Chips (edge)",
      "Micro Chips (edge)",
      "Aftermarket (not made by Rolex)",
      "Polish Up $0 Yes / No?",
    ],
  },
  {
    title: "BRACELET",
    notes: [
      "Scuffs",
      "No Defects to Note",
      "No Major Defects",
      "Some Stretch",
      "Coronet very faded",
      "Normal Wear",
      "Aftermarket (not made by Rolex)",
      "Gold too thin to repair w/o Mold Work",
      "Might be 1mm narrower (material loss)",
    ],
  },
] as const;

const BRACELET_REPAIR_OPTIONS = [
  "Shorter Links — Qty: ____ × $______  |  Y/N?",
  "Steel Side pieces (inner corners) — ____ hrs @ $98/hr  |  Rec ☐  Not Rec ☐",
  "Steel Center pieces (inner corners) — ____ hrs @ $98/hr  |  Rec ☐  Not Rec ☐",
  "Gold Center pieces (inner corners) — Qty: ____ × $______  |  Rec ☐  Not Rec ☐",
  "Invert pieces (foil thin) — Qty: ____ × $______  |  Y/N?",
  "Band Polish (0-10): ☐ Include",
];


export default function InspectionScantron() {
  usePageMeta({ title: "Inspection Scantron | Rolliworks" });
  const sheetRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [version, setVersion] = useState("v1.1");
  const [editingVersion, setEditingVersion] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleExportJpg = async () => {
    if (!sheetRef.current) return;
    setExporting(true);
    try {
      // Set the sheet to exact letter-size proportions for rendering
      const el = sheetRef.current;
      const origWidth = el.style.width;
      const origPadding = el.style.padding;

      // 8.5in at 96 CSS px/in = 816px; html2canvas scale 3x → 2448px ≈ 300 DPI
      el.style.width = "816px";
      el.style.padding = "48px 40px"; // ~0.5in margins

      const canvas = await html2canvas(el, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        width: 816,
        windowWidth: 816,
      });

      // Restore original styles
      el.style.width = origWidth;
      el.style.padding = origPadding;

      // Resize to exact 8.5x11 (2550x3300 @ 300dpi)
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = 2550;
      finalCanvas.height = 3300;
      const ctx = finalCanvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 2550, 3300);
      // Center the rendered content
      const scale = Math.min(2550 / canvas.width, 3300 / canvas.height);
      const w = canvas.width * scale;
      const h = canvas.height * scale;
      ctx.drawImage(canvas, (2550 - w) / 2, (3300 - h) / 2, w, h);

      const link = document.createElement("a");
      link.download = "scantron-sheet-8.5x11.jpg";
      link.href = finalCanvas.toDataURL("image/jpeg", 0.95);
      link.click();
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Screen-only header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inspection Scantron Sheet</h1>
            <p className="text-sm text-muted-foreground">Print and fill in by hand during inspection</p>
          </div>
          <div className="flex items-center gap-1.5 ml-4">
            {editingVersion ? (
              <>
                <Input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="h-8 w-24 text-sm font-mono"
                  placeholder="v1.1"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && setEditingVersion(false)}
                />
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingVersion(false)}>
                  <Check className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" className="h-8 font-mono gap-1.5" onClick={() => setEditingVersion(true)}>
                <Pencil className="h-3 w-3" />
                {version}
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExportJpg} variant="outline" size="sm" disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ImageDown className="h-4 w-4 mr-2" />
            )}
            Export JPG
          </Button>
          <Button onClick={handlePrint} variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Printable sheet */}
      <div ref={sheetRef} className="scantron-sheet bg-white text-black print:m-0 print:p-0">
        {/* Header */}
        <div className="border-b border-black pb-1 mb-2 flex items-end justify-between">
          <p className="text-3xl font-mono font-black text-gray-500 leading-none">{version}</p>
          <p className="text-[9px] text-gray-500">Mark selections with <span className="text-green-600 font-bold">GREEN HIGHLIGHTER</span> or <span className="text-red-600 font-bold">RED INK</span></p>
        </div>

        {/* Sections */}
        <div className="space-y-1">
          {SECTIONS.map((section) => (
            <SectionBlock key={section.title} section={section} />
          ))}
        </div>

        <div className="border-t border-gray-300 my-1" />

        {/* Bracelet Repair Options */}
        <div className="mb-1">
          <h3 className="text-[10px] font-black uppercase tracking-wide mb-1">BRACELET REPAIR OPTIONS</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {BRACELET_REPAIR_OPTIONS.map((opt) => (
              <div key={opt} className="flex items-center gap-1.5 text-[9px]">
                <span className="flex-shrink-0 text-[14px] font-black leading-none">{BRACELET_REPAIR_OPTIONS.indexOf(opt) + 1}</span>
                <span>{opt}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-300 my-1" />

        {/* Additional Notes */}
        <div className="mb-1">
          <h3 className="text-[10px] font-black uppercase tracking-wide mb-1">ADDITIONAL NOTES</h3>
          <div className="border border-gray-300 h-12 rounded-sm p-1">
            <div className="border-b border-gray-200 h-1/2" />
          </div>
        </div>

        <div className="border-t border-black pt-1 mt-1 text-center text-[8px] text-gray-400">
          Rolliworks · 14 N.E. 1st Ave Ste 403, Miami FL 33132 · 408-800-3244
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          /* Hide everything except the scantron sheet */
          body * { visibility: hidden; }
          .scantron-sheet, .scantron-sheet * { visibility: visible; }
          .scantron-sheet {
            position: fixed;
            left: 0; top: 0;
            width: 100%;
            padding: 12mm 10mm;
            font-size: 10px;
          }
          @page {
            size: letter portrait;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}

/* ── Helpers ── */


function InlineBox({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 mr-2 text-[9px]">
      <span className="inline-block w-[8px] h-[8px] border border-black flex-shrink-0" />
      <span>{label}</span>
    </span>
  );
}

function SectionBlock({ section }: { section: typeof SECTIONS[number] }) {
  return (
    <div>
      {/* Section title + conditions on one line */}
      <div className="flex items-center gap-2 mb-0.5">
        <h3 className="text-[10px] font-black uppercase tracking-wide min-w-[60px]">
          {section.title}
        </h3>
        <div className="flex items-center gap-3">
          {CONDITIONS.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 text-[8px]">
            <span className="flex-shrink-0 text-[14px] font-black leading-none">{CONDITIONS.indexOf(c) + 1}</span>
              <span>{c}</span>
            </span>
          ))}
        </div>
        {"showWaiver" in section && section.showWaiver && (
          <span className="inline-flex items-center gap-0.5 ml-1 text-[8px] font-bold">
            <span className="flex-shrink-0 text-[14px] font-black leading-none">{CONDITIONS.length + 1}</span>
            Waiver
          </span>
        )}
      </div>
      {/* Notes grid */}
      <div className="grid grid-cols-4 gap-x-3 gap-y-0 ml-[60px] text-[9px]">
        {section.notes.map((note) => (
          <div key={note} className="flex items-center gap-1 py-[1px]">
            <span className="flex-shrink-0 text-[13px] font-black leading-none">{(section.notes as readonly string[]).indexOf(note) + 1}</span>
            <span className="leading-tight">{note}</span>
          </div>
        ))}
      </div>
      {/* Extra fields (Case section) */}
      {"extraFields" in section && section.extraFields && (
        <div className="ml-[60px] mt-0.5 flex gap-4 text-[9px]">
          {(section.extraFields as readonly string[]).map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
      )}
      {/* Other / custom note lines */}
      {Array.from({ length: ("otherLines" in section && section.otherLines) ? (section.otherLines as number) : 1 }).map((_, i) => (
        <div key={i} className="ml-[60px] mt-1.5 text-[9px] flex items-end gap-1 min-h-[24px]">
          <span>{i === 0 ? "Other: " : "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"}</span>
          <span className="flex-1 border-b border-gray-400" />
          <span className="ml-2">$________</span>
          <InlineBox label="Y/N?" />
        </div>
      ))}
    </div>
  );
}

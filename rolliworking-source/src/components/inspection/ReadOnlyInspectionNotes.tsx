import { ClipboardList } from "lucide-react";

interface ReadOnlyInspectionNotesProps {
  inspection: {
    inspection_type: string;
    job_type: string;
    notes: string | null;
    dial_condition: any;
    hands_condition: any;
    bezel_condition: any;
    crown_condition: any;
    case_condition: any;
    crystal_condition: any;
    bracelet_condition: any;
  };
}

function formatCondition(condition: string): string {
  if (!condition) return "";
  return condition.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function buildSectionNotes(data: any): string[] {
  if (!data) return [];
  const notes: string[] = [];
  if (data.waiverRequired) notes.push("⚠️ Waiver Required");
  if (Array.isArray(data.selectedNotes)) notes.push(...data.selectedNotes);
  if (data.customNote) notes.push(data.customNote);
  if (data.additionalNotes && Array.isArray(data.additionalNotes)) {
    data.additionalNotes.forEach((an: any) => {
      if (an.note) notes.push(an.note);
    });
  }
  return notes.filter(Boolean);
}

function sectionHasContent(data: any): boolean {
  if (!data) return false;
  return !!(data.condition && data.condition !== "") || buildSectionNotes(data).length > 0;
}

function SectionRow({ title, data }: { title: string; data: any }) {
  if (!sectionHasContent(data)) return null;
  const notes = buildSectionNotes(data);
  const condition = data?.condition ? formatCondition(data.condition) : null;
  const price = (data?.price || 0) + (data?.customNotePrice || 0) +
    ((data?.additionalNotes || []) as any[]).reduce((s: number, n: any) => s + (n.price || 0), 0);

  return (
    <div className="py-2 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">
            {title}
            {condition && (
              <span className="ml-1.5 text-[10px] font-normal px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {condition}
              </span>
            )}
          </p>
          {notes.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{notes.join(" · ")}</p>
          )}
        </div>
        {price > 0 && (
          <span className="text-xs font-semibold text-foreground whitespace-nowrap">
            ${price.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

export function ReadOnlyInspectionNotes({ inspection }: ReadOnlyInspectionNotesProps) {
  const isBraceletOnly = inspection.inspection_type === "bracelet_only";

  const sections = isBraceletOnly
    ? [{ title: "Bracelet", data: inspection.bracelet_condition }]
    : [
        { title: "Dial", data: inspection.dial_condition },
        { title: "Hands", data: inspection.hands_condition },
        { title: "Bezel", data: inspection.bezel_condition },
        { title: "Crown", data: inspection.crown_condition },
        { title: "Case", data: inspection.case_condition },
        { title: "Crystal", data: inspection.crystal_condition },
        { title: "Bracelet", data: inspection.bracelet_condition },
      ];

  const hasAnyContent = sections.some((s) => sectionHasContent(s.data)) || !!inspection.notes;

  if (!hasAnyContent) {
    return (
      <div className="text-xs text-muted-foreground text-center py-3">
        No inspection findings recorded.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground pb-1">
        <ClipboardList className="h-3.5 w-3.5" />
        Inspection Findings — {isBraceletOnly ? "Bracelet Only" : "Complete Watch"}
      </div>
      {sections.map((s) => (
        <SectionRow key={s.title} title={s.title} data={s.data} />
      ))}
      {inspection.notes && (
        <div className="mt-2 p-2 bg-muted rounded text-[11px] text-muted-foreground whitespace-pre-wrap">
          {inspection.notes}
        </div>
      )}
    </div>
  );
}

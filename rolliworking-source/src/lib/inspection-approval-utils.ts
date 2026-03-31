export interface ApprovalLike {
  status: string;
  created_at: string;
  approved_at?: string | null;
}

export interface InspectionApprovalLike extends ApprovalLike {
  inspection_id: string;
}

function getApprovalTimestamp(approval: ApprovalLike): number {
  return new Date(approval.approved_at || approval.created_at).getTime();
}

export function getLatestMeaningfulApproval<T extends ApprovalLike>(approvals: T[]): T | null {
  if (!approvals.length) return null;

  const decisiveApprovals = approvals
    .filter((approval) => approval.status !== "pending")
    .sort((a, b) => getApprovalTimestamp(b) - getApprovalTimestamp(a));

  if (decisiveApprovals.length > 0) {
    return decisiveApprovals[0];
  }

  return [...approvals].sort((a, b) => getApprovalTimestamp(b) - getApprovalTimestamp(a))[0] ?? null;
}

export function getLatestMeaningfulApprovalsByInspection<T extends InspectionApprovalLike>(
  approvals: T[]
): Map<string, T> {
  const grouped = new Map<string, T[]>();

  for (const approval of approvals) {
    const existing = grouped.get(approval.inspection_id) ?? [];
    existing.push(approval);
    grouped.set(approval.inspection_id, existing);
  }

  const latestByInspection = new Map<string, T>();

  for (const [inspectionId, inspectionApprovals] of grouped.entries()) {
    const latest = getLatestMeaningfulApproval(inspectionApprovals);
    if (latest) {
      latestByInspection.set(inspectionId, latest);
    }
  }

  return latestByInspection;
}

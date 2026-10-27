import {
  ELIGIBILITY_REASON_LABELS,
  type ProductionEligibilityReason,
} from "@/lib/domain/permissions";
import type { CorpusLoadResult } from "./corpus";

export type CorpusReadinessStatus =
  | "missing"
  | "empty"
  | "invalid"
  | "needs_review"
  | "ready";

export interface CorpusBreakdownItem {
  label: string;
  count: number;
}

export interface CorpusDashboardData {
  status: CorpusReadinessStatus;
  statusLabel: string;
  statusDescription: string;
  corpusFile: string;
  path?: string;
  counts: {
    totalRows: number;
    acceptedRows: number;
    eligible: number;
    needsReview: number;
    rejected: number;
    duplicates: number;
  };
  sourceBreakdown: CorpusBreakdownItem[];
  themeBreakdown: CorpusBreakdownItem[];
  eligibilityReasons: CorpusBreakdownItem[];
  rejectionMessages: CorpusBreakdownItem[];
  limitations: string[];
  notes: string[];
}

function sortedBreakdown(counts: Record<string, number>): CorpusBreakdownItem[] {
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function reasonLabel(code: string): string {
  return (
    ELIGIBILITY_REASON_LABELS[code as ProductionEligibilityReason] ??
    code.replaceAll("_", " ")
  );
}

function readiness(
  status: CorpusReadinessStatus,
): Pick<CorpusDashboardData, "statusLabel" | "statusDescription"> {
  switch (status) {
    case "missing":
      return {
        statusLabel: "Production corpus not found",
        statusDescription:
          "No genuine review file is available. Discovery must return insufficient evidence rather than use synthetic or evaluation data.",
      };
    case "empty":
      return {
        statusLabel: "Corpus is empty",
        statusDescription:
          "The corpus file exists but contains no data rows. No evidence is counted.",
      };
    case "invalid":
      return {
        statusLabel: "No rows passed validation",
        statusDescription:
          "Every submitted row failed validation or the real-corpus policy. Review the import report before exporting.",
      };
    case "needs_review":
      return {
        statusLabel: "Corpus is staged for review",
        statusDescription:
          "Rows were accepted structurally, but none currently meet every production eligibility requirement.",
      };
    case "ready":
      return {
        statusLabel: "Production evidence ready",
        statusDescription:
          "One or more eligible records passed the permission, source, provenance, and SIP-relevance policy.",
      };
  }
}

export function buildCorpusDashboard(
  corpus: CorpusLoadResult,
): CorpusDashboardData {
  const diagnostics = corpus.diagnostics;
  let status: CorpusReadinessStatus;

  if (!diagnostics.available) {
    status = "missing";
  } else if (
    diagnostics.acceptedRows === 0 &&
    (diagnostics.rejectedRows > 0 || diagnostics.duplicateRows > 0)
  ) {
    status = "invalid";
  } else if (diagnostics.totalRows === 0) {
    status = "empty";
  } else if (diagnostics.acceptedRows === 0) {
    status = "invalid";
  } else if (diagnostics.eligibleRecords === 0) {
    status = "needs_review";
  } else {
    status = "ready";
  }

  const sourceBreakdown = sortedBreakdown(diagnostics.sourceCounts);
  const themeBreakdown = sortedBreakdown(diagnostics.themeCounts);
  const eligibilityReasons = sortedBreakdown(
    Object.fromEntries(
      Object.entries(diagnostics.eligibilityReasonCounts).map(
        ([code, count]) => [reasonLabel(code), count],
      ),
    ),
  );
  const rejectionMessages = sortedBreakdown(
    diagnostics.rejectionMessageCounts,
  );

  const limitations: string[] = [];
  if (status === "missing") {
    limitations.push(
      "No production corpus is present at data/real-reviews.csv, so no investor evidence can be shown.",
    );
  }
  if (status === "empty" || status === "invalid" || status === "needs_review") {
    limitations.push(
      "No eligible production records are currently counted as evidence.",
    );
  }
  if (diagnostics.needsReviewRecords > 0) {
    limitations.push(
      `${diagnostics.needsReviewRecords} accepted row(s) are staged only; they do not count until every requirement is resolved.`,
    );
  }
  if (diagnostics.rejectedRows > 0) {
    limitations.push(
      `${diagnostics.rejectedRows} row(s) were rejected and are excluded from all counts.`,
    );
  }
  if (diagnostics.eligibleRecords > 0 && diagnostics.eligibleRecords < 30) {
    limitations.push(
      `The eligible corpus is small (${diagnostics.eligibleRecords} record(s)); findings are directional only.`,
    );
  }
  if (sourceBreakdown.length === 1) {
    limitations.push(
      "Only one source group is represented; selection bias and platform-specific language are likely.",
    );
  }
  limitations.push(
    "SIP themes are keyword-based descriptive signals, not prevalence estimates or causal findings.",
  );
  limitations.push(
    "Synthetic sample data and the FinLit Q&A evaluation dataset are excluded from production evidence and all counts.",
  );

  return {
    status,
    ...readiness(status),
    corpusFile: corpus.path ?? "data/real-reviews.csv",
    path: corpus.path,
    counts: {
      totalRows: diagnostics.totalRows,
      acceptedRows: diagnostics.acceptedRows,
      eligible: diagnostics.eligibleRecords,
      needsReview: diagnostics.needsReviewRecords,
      rejected: diagnostics.rejectedRows,
      duplicates: diagnostics.duplicateRows,
    },
    sourceBreakdown,
    themeBreakdown,
    eligibilityReasons,
    rejectionMessages,
    limitations,
    notes: corpus.notes,
  };
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FeedbackRecord } from "@/lib/domain/feedback";
import { importFeedbackCsv } from "@/lib/domain/csv-import";
import {
  assessProductionEligibility,
  hasPermittedResearchUse,
} from "@/lib/domain/permissions";
import {
  buildReviewStaging,
  toFeedbackRecord,
  type ReviewStagingReport,
} from "@/lib/domain/review-staging";
import { assessSipRelevance } from "@/lib/domain/sip-relevance";

export const PRODUCTION_CORPUS_FILE = "real-reviews.csv";
export const SAMPLE_CORPUS_FILE = "sample-feedback.csv";

export interface CorpusDiagnostics {
  available: boolean;
  totalRows: number;
  acceptedRows: number;
  eligibleRecords: number;
  needsReviewRecords: number;
  rejectedRows: number;
  duplicateRows: number;
  eligibilityReasonCounts: Record<string, number>;
  rejectionMessageCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  themeCounts: Record<string, number>;
}

export type CorpusLoadResult = {
  records: FeedbackRecord[];
  source: "csv_file" | "empty";
  path?: string;
  notes: string[];
  diagnostics: CorpusDiagnostics;
};

export interface CorpusLoadOptions {
  includeSynthetic?: boolean;
  fileName?: string;
  realCorpus?: boolean;
  enforcePermissionPolicy?: boolean;
}

function emptyDiagnostics(): CorpusDiagnostics {
  return {
    available: false,
    totalRows: 0,
    acceptedRows: 0,
    eligibleRecords: 0,
    needsReviewRecords: 0,
    rejectedRows: 0,
    duplicateRows: 0,
    eligibilityReasonCounts: {},
    rejectionMessageCounts: {},
    sourceCounts: {},
    themeCounts: {},
  };
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function summarizeSourceCounts(
  records: FeedbackRecord[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    increment(counts, record.platform?.trim() || record.sourceType);
  }
  return counts;
}

function summarizeThemeCounts(
  records: FeedbackRecord[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    for (const theme of assessSipRelevance(record.text).themes) {
      increment(counts, theme);
    }
  }
  return counts;
}

function diagnosticsFromStaging(
  staging: ReviewStagingReport,
  eligibleRecords: FeedbackRecord[],
  options: { enforcePermissionPolicy: boolean },
): CorpusDiagnostics {
  return {
    available: true,
    totalRows: staging.totalRows,
    acceptedRows: staging.acceptedRows,
    eligibleRecords: eligibleRecords.length,
    needsReviewRecords: options.enforcePermissionPolicy
      ? staging.counts.needsReview
      : 0,
    rejectedRows: staging.counts.rejected,
    duplicateRows: staging.counts.duplicates,
    eligibilityReasonCounts: staging.eligibilityReasonCounts,
    rejectionMessageCounts: staging.rejectionMessageCounts,
    sourceCounts: summarizeSourceCounts(eligibleRecords),
    themeCounts: summarizeThemeCounts(eligibleRecords),
  };
}

export function filterEligibleCorpusRecords(
  records: FeedbackRecord[],
  options: {
    includeSynthetic?: boolean;
    enforcePermissionPolicy?: boolean;
  } = {},
): FeedbackRecord[] {
  const includeSynthetic = options.includeSynthetic ?? false;
  const enforcePermissionPolicy = options.enforcePermissionPolicy ?? true;

  let eligible = includeSynthetic
    ? records
    : records.filter((record) => !record.isSynthetic);

  if (enforcePermissionPolicy) {
    eligible = eligible.filter(
      (record) => assessProductionEligibility(record).eligible,
    );
  }

  return eligible;
}

export async function loadCorpusFromCsv(
  options: CorpusLoadOptions = {},
): Promise<CorpusLoadResult> {
  const fileName = options.fileName ?? PRODUCTION_CORPUS_FILE;
  const includeSynthetic = options.includeSynthetic ?? false;
  const realCorpus =
    options.realCorpus ?? fileName === PRODUCTION_CORPUS_FILE;
  const enforcePermissionPolicy = options.enforcePermissionPolicy ?? true;
  const csvPath = path.join(process.cwd(), "data", fileName);
  const displayPath = `data/${fileName}`;

  try {
    const csvText = await readFile(csvPath, "utf8");
    const result = importFeedbackCsv(csvText, new Set(), { realCorpus });
    const staging = buildReviewStaging(result);
    const records = result.rows.map(toFeedbackRecord);

    const permissionIneligible = records.filter(
      (record) => !record.isSynthetic && !hasPermittedResearchUse(record),
    ).length;

    const eligible = filterEligibleCorpusRecords(records, {
      includeSynthetic,
      enforcePermissionPolicy,
    });

    const diagnostics = diagnosticsFromStaging(staging, eligible, {
      enforcePermissionPolicy,
    });

    const notes: string[] = [];
    notes.push(
      includeSynthetic && !enforcePermissionPolicy
        ? "Loaded from CSV including synthetic records (labeled)."
        : "Loaded from CSV excluding synthetic records.",
    );
    if (realCorpus) {
      notes.push("Real-corpus mode rejects synthetic rows.");
    }
    if (result.errors.length > 0) {
      notes.push(`Rejected ${result.errors.length} invalid row(s) during import.`);
    }
    if (diagnostics.duplicateRows > 0) {
      notes.push(
        `Ignored ${diagnostics.duplicateRows} duplicate row(s) during import.`,
      );
    }
    if (permissionIneligible > 0 && enforcePermissionPolicy) {
      notes.push(
        `Excluded ${permissionIneligible} record(s) without explicit AI-use and retention permission.`,
      );
    }
    if (diagnostics.needsReviewRecords > 0) {
      notes.push(
        `Staged ${diagnostics.needsReviewRecords} accepted row(s) for review; they are not production-eligible.`,
      );
    }
    if (eligible.length === 0) {
      notes.push(
        "No eligible permitted non-synthetic records were found; production retrieval will fail closed.",
      );
    }

    return {
      records: eligible,
      source: "csv_file",
      path: displayPath,
      notes,
      diagnostics,
    };
  } catch {
    return {
      records: [],
      source: "empty",
      notes: [
        `No readable production corpus found at ${displayPath}.`,
        "Production retrieval fails closed; synthetic data is never used as a fallback.",
        "In-memory data does not persist across Vercel requests.",
      ],
      diagnostics: emptyDiagnostics(),
    };
  }
}

/**
 * Explicit sample-data loader for tests/diagnostics. This loader does not
 * enforce the production permission policy and must not be used by the
 * production discovery route.
 */
export async function loadSampleCorpusFromCsv(options?: {
  includeSynthetic?: boolean;
}): Promise<CorpusLoadResult> {
  return loadCorpusFromCsv({
    fileName: SAMPLE_CORPUS_FILE,
    includeSynthetic: options?.includeSynthetic ?? false,
    realCorpus: false,
    enforcePermissionPolicy: false,
  });
}

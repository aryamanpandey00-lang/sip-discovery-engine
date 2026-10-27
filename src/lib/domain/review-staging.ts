
import Papa from "papaparse";
import type { CsvImportResult } from "./csv-import.ts";
import type { FeedbackImportRow, FeedbackRecord } from "./feedback.ts";
import {
  ELIGIBILITY_REASON_LABELS,
  assessProductionEligibility,
  isEligibleForProductionRetrieval,
  type ProductionEligibilityReason,
} from "./permissions.ts";

export type ReviewStage = "eligible" | "needs_review" | "rejected" | "duplicate";

export interface StagedFeedbackRecord {
  rowNumber: number;
  stage: ReviewStage;
  record: FeedbackRecord | null;
  reasonCodes: string[];
  reasons: string[];
  themes: string[];
  sourceLabel: string | null;
}

export interface ReviewStagingReport {
  totalRows: number;
  acceptedRows: number;
  counts: {
    eligible: number;
    needsReview: number;
    rejected: number;
    duplicates: number;
  };
  eligible: StagedFeedbackRecord[];
  needsReview: StagedFeedbackRecord[];
  rejected: StagedFeedbackRecord[];
  duplicates: StagedFeedbackRecord[];
  eligibilityReasonCounts: Record<string, number>;
  rejectionMessageCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  themeCounts: Record<string, number>;
}

export const ELIGIBLE_CSV_HEADERS = [
  "sourceType",
  "sourceReference",
  "capturedAt",
  "text",
  "investorStage",
  "consentStatus",
  "isSynthetic",
  "platform",
  "sourceUrl",
  "sourceRecordId",
  "publishedAt",
  "rating",
  "aiUsePermission",
  "retentionPermission",
] as const;

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function labelForReason(code: string): string {
  return (
    ELIGIBILITY_REASON_LABELS[code as ProductionEligibilityReason] ??
    code.replaceAll("_", " ")
  );
}

export function toFeedbackRecord(row: FeedbackImportRow): FeedbackRecord {
  return {
    id: row.contentHash,
    sourceType: row.sourceType,
    sourceReference: row.sourceReference,
    capturedAt: row.capturedAt,
    text: row.text,
    investorStage: row.investorStage,
    consentStatus: row.consentStatus,
    contentHash: row.contentHash,
    isSynthetic: row.isSynthetic,
    platform: row.platform ?? null,
    sourceUrl: row.sourceUrl ?? null,
    sourceRecordId: row.sourceRecordId ?? null,
    publishedAt: row.publishedAt ?? null,
    rating: row.rating ?? null,
    aiUsePermission: row.aiUsePermission ?? "unknown",
    retentionPermission: row.retentionPermission ?? "unknown",
  };
}

/**
 * Converts a structural CSV import into review staging buckets.
 *
 * Structural acceptance is not production eligibility. Only rows that pass
 * the central permission, source, provenance, and SIP-relevance policy are
 * eligible.
 *
 * Integrity checks fail closed if accepted audit entries and imported rows
 * cannot be matched one-to-one by content hash. This prevents silent row
 * omission, accidental row substitution, and duplicate-hash overwrites.
 */
export function buildReviewStaging(
  result: CsvImportResult,
): ReviewStagingReport {
  const acceptedAuditEntries = result.audit.filter(
    (entry) => entry.outcome === "accepted",
  );

  if (acceptedAuditEntries.length !== result.rows.length) {
    throw new Error(
      "Review staging integrity error: accepted audit count does not match imported rows.",
    );
  }

  const rowsByHash = new Map<string, FeedbackImportRow>();

  for (const row of result.rows) {
    if (!row.contentHash) {
      throw new Error(
        "Review staging integrity error: an imported row has no content hash.",
      );
    }

    if (rowsByHash.has(row.contentHash)) {
      throw new Error(
        "Review staging integrity error: duplicate content hashes exist in imported rows.",
      );
    }

    rowsByHash.set(row.contentHash, row);
  }

  const auditedHashes = new Set<string>();

  for (const entry of acceptedAuditEntries) {
    if (!entry.contentHash) {
      throw new Error(
        "Review staging integrity error: an accepted audit entry has no content hash.",
      );
    }

    if (auditedHashes.has(entry.contentHash)) {
      throw new Error(
        "Review staging integrity error: duplicate content hashes exist in accepted audit entries.",
      );
    }

    auditedHashes.add(entry.contentHash);

    if (!rowsByHash.has(entry.contentHash)) {
      throw new Error(
        "Review staging integrity error: an accepted audit entry has no matching imported row.",
      );
    }
  }

  if (
    auditedHashes.size !== rowsByHash.size ||
    [...rowsByHash.keys()].some((hash) => !auditedHashes.has(hash))
  ) {
    throw new Error(
      "Review staging integrity error: audit entries and imported rows do not match.",
    );
  }

  const errorsByRow = new Map<number, string[]>();
  const globalMessages: string[] = [];

  for (const error of result.errors) {
    if (result.audit.some((entry) => entry.rowNumber === error.rowNumber)) {
      const current = errorsByRow.get(error.rowNumber) ?? [];
      current.push(...error.messages);
      errorsByRow.set(error.rowNumber, current);
    } else {
      globalMessages.push(...error.messages);
    }
  }

  const eligible: StagedFeedbackRecord[] = [];
  const needsReview: StagedFeedbackRecord[] = [];
  const rejected: StagedFeedbackRecord[] = [];
  const duplicates: StagedFeedbackRecord[] = [];

  const eligibilityReasonCounts: Record<string, number> = {};
  const rejectionMessageCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  const themeCounts: Record<string, number> = {};

  for (const entry of result.audit) {
    if (entry.outcome === "accepted") {
      const row = entry.contentHash
        ? rowsByHash.get(entry.contentHash)
        : undefined;

      if (!row) {
        throw new Error(
          "Review staging integrity error: an accepted audit entry has no matching imported row.",
        );
      }

      const record = toFeedbackRecord(row);
      const assessment = assessProductionEligibility(record);
      const themes = assessment.sipRelevance.themes;
      const sourceLabel = record.platform?.trim() || record.sourceType;

      if (assessment.eligible) {
        eligible.push({
          rowNumber: entry.rowNumber,
          stage: "eligible",
          record,
          reasonCodes: [],
          reasons: [],
          themes,
          sourceLabel,
        });

        increment(sourceCounts, sourceLabel);

        for (const theme of themes) {
          increment(themeCounts, theme);
        }
      } else {
        const reasons = assessment.reasons.map(labelForReason);

        needsReview.push({
          rowNumber: entry.rowNumber,
          stage: "needs_review",
          record,
          reasonCodes: assessment.reasons,
          reasons,
          themes,
          sourceLabel,
        });

        for (const reason of assessment.reasons) {
          increment(eligibilityReasonCounts, reason);
        }
      }

      continue;
    }

    if (entry.outcome === "duplicate") {
      duplicates.push({
        rowNumber: entry.rowNumber,
        stage: "duplicate",
        record: null,
        reasonCodes: entry.reasonCodes,
        reasons: ["Duplicate content; the row was not staged twice."],
        themes: [],
        sourceLabel: null,
      });

      continue;
    }

    const messages = errorsByRow.get(entry.rowNumber) ?? [
      ...globalMessages,
      "Row rejected during validation.",
    ];

    rejected.push({
      rowNumber: entry.rowNumber,
      stage: "rejected",
      record: null,
      reasonCodes: entry.reasonCodes,
      reasons: messages,
      themes: [],
      sourceLabel: null,
    });

    for (const message of messages) {
      increment(rejectionMessageCounts, message);
    }
  }

  // File-level parse/header errors have no data row to attach to. Surface them
  // as a rejected file entry so the staging report never looks silently empty.
  if (globalMessages.length > 0 && rejected.length === 0) {
    const rowNumber = result.audit[0]?.rowNumber ?? 1;

    rejected.push({
      rowNumber,
      stage: "rejected",
      record: null,
      reasonCodes: ["file_level_error"],
      reasons: globalMessages,
      themes: [],
      sourceLabel: null,
    });

    for (const message of globalMessages) {
      increment(rejectionMessageCounts, message);
    }
  }

  return {
    totalRows: result.totalRows,
    acceptedRows: result.rows.length,
    counts: {
      eligible: eligible.length,
      needsReview: needsReview.length,
      rejected: rejected.length,
      duplicates: duplicates.length,
    },
    eligible,
    needsReview,
    rejected,
    duplicates,
    eligibilityReasonCounts,
    rejectionMessageCounts,
    sourceCounts,
    themeCounts,
  };
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

/**
 * Builds a CSV containing only records that still pass the production
 * eligibility policy at export time. This is a local download; it does not
 * write to the repository or database.
 */
export function toEligibleCsv(records: FeedbackRecord[]): string {
  const eligible = records.filter(isEligibleForProductionRetrieval);

  if (eligible.length === 0) {
    return `${ELIGIBLE_CSV_HEADERS.join(",")}\n`;
  }

  const rows = eligible.map((record) => ({
    sourceType: record.sourceType,
    sourceReference: csvValue(record.sourceReference),
    capturedAt: record.capturedAt,
    text: record.text,
    investorStage: record.investorStage,
    consentStatus: record.consentStatus,
    isSynthetic: false,
    platform: csvValue(record.platform),
    sourceUrl: csvValue(record.sourceUrl),
    sourceRecordId: csvValue(record.sourceRecordId),
    publishedAt: csvValue(record.publishedAt),
    rating: csvValue(record.rating),
    aiUsePermission: record.aiUsePermission ?? "unknown",
    retentionPermission: record.retentionPermission ?? "unknown",
  }));

  return `${Papa.unparse(rows, {
    columns: [...ELIGIBLE_CSV_HEADERS],
    newline: "\n",
  })}\n`;
}

export function buildCsvTemplate(): string {
  return `${ELIGIBLE_CSV_HEADERS.join(",")}\n`;
}


import Papa from "papaparse";
import { validateFeedbackRow } from "./feedback-validation.ts";
import { createDeduplicationKey } from "./deduplication-key.ts";
import type { FeedbackImportRow } from "./feedback.ts";

export type CsvImportErrorKind = "parse" | "headers" | "row_validation";

export interface CsvImportError {
  rowNumber: number;
  messages: string[];
  kind: CsvImportErrorKind;
}

export type ImportAuditOutcome = "accepted" | "rejected" | "duplicate";

export interface ImportAuditEntry {
  rowNumber: number;
  outcome: ImportAuditOutcome;
  reasonCodes: string[];
  contentHash?: string;
}

export interface CsvImportResult {
  rows: FeedbackImportRow[];
  errors: CsvImportError[];
  duplicateRows: number[];
  totalRows: number;
  audit: ImportAuditEntry[];
}

export interface CsvImportOptions {
  /** Reject synthetic/demo rows (real-corpus mode). */
  realCorpus?: boolean;
}

const requiredHeaders = [
  "sourceType",
  "sourceReference",
  "capturedAt",
  "text",
  "investorStage",
  "consentStatus",
  "isSynthetic",
] as const;

export function importFeedbackCsv(
  csvText: string,
  existingDeduplicationKeys: ReadonlySet<string> = new Set<string>(),
  options: CsvImportOptions = {},
): CsvImportResult {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header: string) => header.trim(),
  });

  const errors: CsvImportError[] = [];
  const rows: FeedbackImportRow[] = [];
  const duplicateRows: number[] = [];
  const audit: ImportAuditEntry[] = [];
  const seen = new Set<string>(existingDeduplicationKeys);

  // Record CSV parser errors separately from header and row-validation errors.
  if (parsed.errors.length > 0) {
    errors.push({
      rowNumber: 1,
      messages: parsed.errors.map((error) => error.message),
      kind: "parse",
    });
  }

  const headers = parsed.meta.fields ?? [];
  const missingHeaders = requiredHeaders.filter(
    (header) => !headers.includes(header),
  );

  // Without the required headers, individual rows cannot be validated reliably.
  if (missingHeaders.length > 0) {
    errors.push({
      rowNumber: 1,
      messages: [
        `Missing required headers: ${missingHeaders.join(", ")}`,
      ],
      kind: "headers",
    });

    parsed.data.forEach((_rawRow, index) => {
      audit.push({
        rowNumber: index + 2,
        outcome: "rejected",
        reasonCodes: ["missing_required_headers"],
      });
    });

    return {
      rows: [],
      errors,
      duplicateRows: [],
      totalRows: parsed.data.length,
      audit,
    };
  }

  parsed.data.forEach((rawRow, index) => {
    const rowNumber = index + 2;

    // Normalize CSV strings into the expected validation input types.
    const normalizedRow = {
      ...rawRow,
      sourceReference:
        rawRow.sourceReference === "" ? null : rawRow.sourceReference,
      isSynthetic:
        rawRow.isSynthetic === "true"
          ? true
          : rawRow.isSynthetic === "false"
            ? false
            : rawRow.isSynthetic,
    };

    const result = validateFeedbackRow(normalizedRow, options);

    if (!result.valid || !result.row) {
      errors.push({
        rowNumber,
        messages: result.errors,
        kind: "row_validation",
      });

      audit.push({
        rowNumber,
        outcome: "rejected",
        reasonCodes: ["validation_failed"],
      });

      return;
    }

    const duplicateKey = createDeduplicationKey(result.row);

    if (seen.has(duplicateKey)) {
      duplicateRows.push(rowNumber);

      audit.push({
        rowNumber,
        outcome: "duplicate",
        reasonCodes: ["duplicate_content"],
        contentHash: result.row.contentHash,
      });

      return;
    }

    seen.add(duplicateKey);
    rows.push(result.row);

    audit.push({
      rowNumber,
      outcome: "accepted",
      reasonCodes: [],
      contentHash: result.row.contentHash,
    });
  });

  return {
    rows,
    errors,
    duplicateRows,
    totalRows: parsed.data.length,
    audit,
  };
}

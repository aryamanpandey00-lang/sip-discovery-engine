import Papa from "papaparse";
import { validateFeedbackRow } from "./feedback-validation";
import { createDeduplicationKey } from "./deduplication-key";
import type { FeedbackImportRow } from "./feedback";

export interface CsvImportError {
  rowNumber: number;
  messages: string[];
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

const requiredHeaders = [
  "sourceType",
  "sourceReference",
  "capturedAt",
  "text",
  "investorStage",
  "consentStatus",
  "isSynthetic",
];

export function importFeedbackCsv(
  csvText: string,
  existingDeduplicationKeys: ReadonlySet<string> = new Set<string>(),
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

  if (parsed.errors.length > 0) {
    errors.push({
      rowNumber: 1,
      messages: parsed.errors.map((error) => error.message),
    });
  }

  const headers = parsed.meta.fields ?? [];
  const missingHeaders = requiredHeaders.filter(
    (header) => !headers.includes(header),
  );

  if (missingHeaders.length > 0) {
    errors.push({
      rowNumber: 1,
      messages: [
        `Missing required headers: ${missingHeaders.join(", ")}`,
      ],
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

    const result = validateFeedbackRow(normalizedRow);

    if (!result.valid || !result.row) {
      errors.push({
        rowNumber,
        messages: result.errors,
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
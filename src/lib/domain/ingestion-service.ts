
import { importFeedbackCsv } from "./csv-import";
import type { CsvImportResult } from "./csv-import";

export interface IngestionOptions {
  existingDeduplicationKeys?: ReadonlySet<string>;
  realCorpus?: boolean;
}

export function ingestFeedbackCsv(
  csvText: string,
  options: IngestionOptions = {},
): CsvImportResult {
  return importFeedbackCsv(
    csvText,
    options.existingDeduplicationKeys ?? new Set<string>(),
    { realCorpus: options.realCorpus },
  );
}

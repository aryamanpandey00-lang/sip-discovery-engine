
import { describe, expect, it } from "vitest";
import { createDeduplicationKey } from "./deduplication-key";
import { ingestFeedbackCsv } from "./ingestion-service";

describe("ingestFeedbackCsv", () => {
  it("imports valid CSV data using the ingestion service", () => {
    const csv = [
      "sourceType,sourceReference,capturedAt,text,investorStage,consentStatus,isSynthetic",
      'synthetic,,2026-10-24T10:00:00.000Z,"Example feedback",continuing_sip,not_required,true',
    ].join("\n");

    const result = ingestFeedbackCsv(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0]?.text).toBe("Example feedback");
  });

  it("passes existing deduplication keys to the CSV importer", () => {
    const csv = [
      "sourceType,sourceReference,capturedAt,text,investorStage,consentStatus,isSynthetic",
      'public_discussion,discussion-123,2026-10-24T10:00:00.000Z,"Previously imported feedback",continuing_sip,not_required,false',
    ].join("\n");

    const existingKey = createDeduplicationKey({
      sourceType: "public_discussion",
      sourceReference: "discussion-123",
      text: "Previously imported feedback",
    });

    const result = ingestFeedbackCsv(csv, {
      existingDeduplicationKeys: new Set([existingKey]),
    });

    expect(result.rows).toHaveLength(0);
    expect(result.duplicateRows).toEqual([2]);
    expect(result.errors).toHaveLength(0);
  });

  it("returns validation errors for invalid CSV rows", () => {
    const csv = [
      "sourceType,sourceReference,capturedAt,text,investorStage,consentStatus,isSynthetic",
      "synthetic,,2026-10-24T10:00:00.000Z,,continuing_sip,not_required,true",
    ].join("\n");

    const result = ingestFeedbackCsv(csv);

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.messages).toContain(
      "text must be a non-empty string.",
    );
  });
});

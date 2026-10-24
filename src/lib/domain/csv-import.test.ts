import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createContentHash } from "./content-hash";
import { createDeduplicationKey } from "./deduplication-key";
import { importFeedbackCsv } from "./csv-import";

describe("importFeedbackCsv", () => {
  it("imports a valid synthetic feedback row with a content hash", () => {
    const csv = [
      "sourceType,sourceReference,capturedAt,text,investorStage,consentStatus,isSynthetic",
      'synthetic,,2026-10-23T10:00:00.000Z,"Example synthetic feedback",continuing_sip,not_required,true',
    ].join("\n");

    const result = importFeedbackCsv(csv);
    const row = result.rows[0];

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(row?.sourceType).toBe("synthetic");
    expect(row?.isSynthetic).toBe(true);
    expect(row?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row?.contentHash).toBe(
      createContentHash({
        sourceType: "synthetic",
        sourceReference: null,
        capturedAt: "2026-10-23T10:00:00.000Z",
        text: "Example synthetic feedback",
      }),
    );

    expect(result.audit).toHaveLength(1);
    expect(result.audit[0]).toMatchObject({
      rowNumber: 2,
      outcome: "accepted",
      reasonCodes: [],
      contentHash: row?.contentHash,
    });
  });

  it("reports missing required headers", () => {
    const csv = "sourceType,text\nsynthetic,Example feedback";

    const result = importFeedbackCsv(csv);

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.messages.join(" ")).toContain(
      "Missing required headers",
    );
    expect(result.audit).toHaveLength(1);
    expect(result.audit[0]).toMatchObject({
      rowNumber: 2,
      outcome: "rejected",
      reasonCodes: ["missing_required_headers"],
    });
  });

  it("rejects rows with empty feedback text", () => {
    const csv = [
      "sourceType,sourceReference,capturedAt,text,investorStage,consentStatus,isSynthetic",
      "synthetic,,2026-10-23T10:00:00.000Z,,continuing_sip,not_required,true",
    ].join("\n");

    const result = importFeedbackCsv(csv);

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.messages).toContain(
      "text must be a non-empty string.",
    );
    expect(result.audit).toHaveLength(1);
    expect(result.audit[0]).toMatchObject({
      rowNumber: 2,
      outcome: "rejected",
      reasonCodes: ["validation_failed"],
    });
  });

  it("identifies duplicate rows within the same CSV", () => {
    const csv = [
      "sourceType,sourceReference,capturedAt,text,investorStage,consentStatus,isSynthetic",
      'synthetic,,2026-10-23T10:00:00.000Z,"Repeated feedback",continuing_sip,not_required,true',
      'synthetic,,2026-10-23T10:00:00.000Z,"Repeated feedback",continuing_sip,not_required,true',
    ].join("\n");

    const result = importFeedbackCsv(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.duplicateRows).toEqual([3]);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);

    expect(result.audit).toHaveLength(2);
    expect(result.audit[0]?.outcome).toBe("accepted");
    expect(result.audit[1]).toMatchObject({
      rowNumber: 3,
      outcome: "duplicate",
      reasonCodes: ["duplicate_content"],
    });
  });

  it("supports quoted feedback containing commas", () => {
    const csv = [
      "sourceType,sourceReference,capturedAt,text,investorStage,consentStatus,isSynthetic",
      'synthetic,,2026-10-23T10:00:00.000Z,"I want clarity, confidence, and better explanations.",considering_first_sip,not_required,true',
    ].join("\n");

    const result = importFeedbackCsv(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.text).toBe(
      "I want clarity, confidence, and better explanations.",
    );
    expect(result.rows[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.errors).toHaveLength(0);
  });

  it("imports all five records from the synthetic sample CSV", () => {
    const csv = readFileSync(
      resolve(process.cwd(), "data", "sample-feedback.csv"),
      "utf8",
    );

    const result = importFeedbackCsv(csv);

    expect(result.totalRows).toBe(5);
    expect(result.rows).toHaveLength(5);
    expect(result.errors).toHaveLength(0);
    expect(result.duplicateRows).toHaveLength(0);
    expect(result.rows.every((row) => row.isSynthetic)).toBe(true);
    expect(
      result.rows.every((row) => /^[a-f0-9]{64}$/.test(row.contentHash)),
    ).toBe(true);
    expect(result.audit).toHaveLength(5);
    expect(result.audit.every((entry) => entry.outcome === "accepted")).toBe(
      true,
    );
  });

  it("treats identical feedback from the same source as a duplicate when timestamps differ", () => {
    const csv = [
      "sourceType,sourceReference,capturedAt,text,investorStage,consentStatus,isSynthetic",
      'public_discussion,discussion-123,2026-10-23T10:00:00.000Z,"I find it difficult to understand my SIP status.",continuing_sip,not_required,false',
      'public_discussion,discussion-123,2026-10-24T10:00:00.000Z,"I find it difficult to understand my SIP status.",continuing_sip,not_required,false',
    ].join("\n");

    const result = importFeedbackCsv(csv);

    expect(result.totalRows).toBe(2);
    expect(result.rows).toHaveLength(1);
    expect(result.duplicateRows).toEqual([3]);
    expect(result.errors).toHaveLength(0);
    expect(result.audit.map((entry) => entry.outcome)).toEqual([
      "accepted",
      "duplicate",
    ]);
  });

  it("skips feedback already present in a previous import", () => {
    const csv = [
      "sourceType,sourceReference,capturedAt,text,investorStage,consentStatus,isSynthetic",
      'public_discussion,discussion-123,2026-10-24T10:00:00.000Z,"I find it difficult to understand my SIP status.",continuing_sip,not_required,false',
    ].join("\n");

    const existingKey = createDeduplicationKey({
      sourceType: "public_discussion",
      sourceReference: "discussion-123",
      text: "I find it difficult to understand my SIP status.",
    });

    const result = importFeedbackCsv(csv, new Set([existingKey]));

    expect(result.totalRows).toBe(1);
    expect(result.rows).toHaveLength(0);
    expect(result.duplicateRows).toEqual([2]);
    expect(result.errors).toHaveLength(0);
    expect(result.audit[0]).toMatchObject({
      rowNumber: 2,
      outcome: "duplicate",
      reasonCodes: ["duplicate_content"],
    });
  });

  it("imports new feedback when its key is not in previous imports", () => {
    const csv = [
      "sourceType,sourceReference,capturedAt,text,investorStage,consentStatus,isSynthetic",
      'public_discussion,discussion-456,2026-10-24T10:00:00.000Z,"I need a clearer explanation of SIP payments.",continuing_sip,not_required,false',
    ].join("\n");

    const existingKey = createDeduplicationKey({
      sourceType: "public_discussion",
      sourceReference: "discussion-123",
      text: "Different existing feedback",
    });

    const result = importFeedbackCsv(csv, new Set([existingKey]));

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.sourceReference).toBe("discussion-456");
    expect(result.duplicateRows).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.audit[0]?.outcome).toBe("accepted");
  });

  it("checks previous imports and duplicates within the current CSV", () => {
    const csv = [
      "sourceType,sourceReference,capturedAt,text,investorStage,consentStatus,isSynthetic",
      'public_discussion,discussion-123,2026-10-24T10:00:00.000Z,"Previously imported feedback",continuing_sip,not_required,false',
      'public_discussion,discussion-789,2026-10-24T11:00:00.000Z,"New feedback",continuing_sip,not_required,false',
      'public_discussion,discussion-789,2026-10-24T12:00:00.000Z,"New feedback",continuing_sip,not_required,false',
    ].join("\n");

    const existingKey = createDeduplicationKey({
      sourceType: "public_discussion",
      sourceReference: "discussion-123",
      text: "Previously imported feedback",
    });

    const result = importFeedbackCsv(csv, new Set([existingKey]));

    expect(result.totalRows).toBe(3);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.text).toBe("New feedback");
    expect(result.duplicateRows).toEqual([2, 4]);
    expect(result.errors).toHaveLength(0);
    expect(result.audit.map((entry) => entry.outcome)).toEqual([
      "duplicate",
      "accepted",
      "duplicate",
    ]);
  });
});

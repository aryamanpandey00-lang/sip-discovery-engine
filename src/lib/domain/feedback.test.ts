
import { describe, expect, it } from "vitest";
import type {
  FeedbackImportRow,
  FeedbackRecord,
} from "./feedback";

describe("Feedback data model", () => {
  it("supports a synthetic feedback import row", () => {
    const row: FeedbackImportRow = {
      sourceType: "synthetic",
      sourceReference: null,
      capturedAt: "2026-10-23T10:00:00.000Z",
      text: "Synthetic test feedback",
      investorStage: "unknown",
      consentStatus: "not_required",
      contentHash: "test-hash",
      isSynthetic: true,
    };

    expect(row.sourceType).toBe("synthetic");
    expect(row.isSynthetic).toBe(true);
    expect(row.contentHash).toBe("test-hash");
  });

  it("supports a complete feedback record", () => {
    const record: FeedbackRecord = {
      id: "feedback-test-001",
      sourceType: "synthetic",
      sourceReference: null,
      capturedAt: "2026-10-23T10:00:00.000Z",
      text: "Synthetic test feedback",
      investorStage: "unknown",
      consentStatus: "not_required",
      contentHash: "test-hash",
      isSynthetic: true,
    };

    expect(record.id).toBe("feedback-test-001");
    expect(record.contentHash).toBe("test-hash");
  });
});

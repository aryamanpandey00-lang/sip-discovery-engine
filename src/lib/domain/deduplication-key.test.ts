
import { describe, expect, it } from "vitest";
import { createDeduplicationKey } from "./deduplication-key";

describe("createDeduplicationKey", () => {
  const sample = {
    sourceType: "public_discussion" as const,
    sourceReference: "discussion-123",
    capturedAt: "2026-10-23T10:00:00.000Z",
    text: "I find it difficult to understand my SIP status.",
    investorStage: "continuing_sip" as const,
    consentStatus: "not_required" as const,
    contentHash: "unused-test-hash",
    isSynthetic: false,
  };

  it("returns the same key when only the timestamp changes", () => {
    const laterCapture = {
      ...sample,
      capturedAt: "2026-10-24T10:00:00.000Z",
    };

    expect(createDeduplicationKey(sample)).toBe(
      createDeduplicationKey(laterCapture),
    );
  });

  it("returns the same key when whitespace differs", () => {
    const differentWhitespace = {
      ...sample,
      text: "  I find it difficult   to understand my SIP status.  ",
    };

    expect(createDeduplicationKey(sample)).toBe(
      createDeduplicationKey(differentWhitespace),
    );
  });

  it("returns a different key when the source reference changes", () => {
    const differentSource = {
      ...sample,
      sourceReference: "discussion-456",
    };

    expect(createDeduplicationKey(sample)).not.toBe(
      createDeduplicationKey(differentSource),
    );
  });

  it("returns a different key when the feedback text changes", () => {
    const differentText = {
      ...sample,
      text: "I understand my SIP status.",
    };

    expect(createDeduplicationKey(sample)).not.toBe(
      createDeduplicationKey(differentText),
    );
  });
});

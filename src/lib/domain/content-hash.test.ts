
import { describe, expect, it } from "vitest";
import { createContentHash } from "./content-hash";

describe("createContentHash", () => {
  const sample = {
    sourceType: "synthetic",
    sourceReference: null,
    capturedAt: "2026-10-23T10:00:00.000Z",
    text: "I find it difficult to understand my SIP status.",
  };

  it("returns a SHA-256 hexadecimal hash", () => {
    const hash = createContentHash(sample);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns the same hash for identical input", () => {
    expect(createContentHash(sample)).toBe(createContentHash(sample));
  });

  it("returns a different hash when the text changes", () => {
    const changed = {
      ...sample,
      text: "I understand my SIP status.",
    };

    expect(createContentHash(changed)).not.toBe(createContentHash(sample));
  });

  it("returns a different hash when the capture timestamp changes", () => {
    const changed = {
      ...sample,
      capturedAt: "2026-10-23T10:05:00.000Z",
    };

    expect(createContentHash(changed)).not.toBe(createContentHash(sample));
  });
});

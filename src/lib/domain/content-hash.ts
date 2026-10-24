
import { createHash } from "node:crypto";

export function createContentHash(input: {
  sourceType: string;
  sourceReference: string | null;
  capturedAt: string;
  text: string;
}): string {
  const canonicalContent = JSON.stringify([
    input.sourceType,
    input.sourceReference,
    input.capturedAt,
    input.text,
  ]);

  return createHash("sha256").update(canonicalContent, "utf8").digest("hex");
}

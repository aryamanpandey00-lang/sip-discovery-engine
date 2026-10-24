
import { createHash } from "node:crypto";
import type { FeedbackImportRow } from "./feedback";

export function createDeduplicationKey(
  input: Pick<
    FeedbackImportRow,
    "sourceType" | "sourceReference" | "text"
  >,
): string {
  const normalizedText = input.text.trim().replace(/\s+/g, " ");

  const canonicalContent = JSON.stringify([
    input.sourceType,
    input.sourceReference,
    normalizedText,
  ]);

  return createHash("sha256")
    .update(canonicalContent, "utf8")
    .digest("hex");
}


import { createContentHash } from "./content-hash.ts";
import type {
  FeedbackImportRow,
  FeedbackSourceType,
  ConsentStatus,
  InvestorStage,
} from "./feedback.ts";

const sourceTypes: FeedbackSourceType[] = [
  "public_discussion",
  "consented_interview",
  "consented_survey",
  "synthetic",
];

const consentStatuses: ConsentStatus[] = [
  "not_required",
  "obtained",
  "pending",
  "withdrawn",
];

const investorStages: InvestorStage[] = [
  "considering_first_sip",
  "started_first_sip",
  "continuing_sip",
  "paused_or_stopped",
  "unknown",
];

const consentedSourceTypes: FeedbackSourceType[] = [
  "consented_interview",
  "consented_survey",
];



function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizePermission(value: unknown): "permitted" | "not_permitted" | "unknown" | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const v = value.trim().toLowerCase();
  if (v === "permitted") return "permitted";
  if (v === "not_permitted" || v === "not permitted") return "not_permitted";
  if (v === "unknown") return "unknown";
  return undefined;
}

function normalizeRating(value: unknown): string | number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const num = Number(trimmed);
    if (!Number.isNaN(num)) {
      return num;
    }
    return trimmed;
  }
  return null;
}

export interface FeedbackValidationOptions {
  /**
   * Real-corpus mode rejects synthetic/demo rows. Use this for data that is
   * intended to enter production retrieval.
   */
  realCorpus?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  row?: FeedbackImportRow;
}

export function validateFeedbackRow(
  input: unknown,
  options: FeedbackValidationOptions = {},
): ValidationResult {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    return { valid: false, errors: ["Row must be an object."] };
  }

  const value = input as Record<string, unknown>;
  const errors: string[] = [];

  const validSourceType =
    typeof value.sourceType === "string" &&
    sourceTypes.includes(value.sourceType as FeedbackSourceType);

  if (!validSourceType) {
    errors.push("Invalid sourceType.");
  }

  const sourceType = validSourceType
    ? (value.sourceType as FeedbackSourceType)
    : null;

  if (
    value.sourceReference !== null &&
    typeof value.sourceReference !== "string"
  ) {
    errors.push("sourceReference must be a string or null.");
  }

  const sourceReference =
    typeof value.sourceReference === "string"
      ? value.sourceReference.trim()
      : null;

  if (
    sourceType !== "synthetic" &&
    (sourceReference === null || sourceReference.length === 0)
  ) {
    errors.push(
      "Non-synthetic source rows must have a non-empty sourceReference.",
    );
  }

  if (
    typeof value.capturedAt !== "string" ||
    Number.isNaN(Date.parse(value.capturedAt))
  ) {
    errors.push("capturedAt must be a valid date.");
  }

  if (typeof value.text !== "string" || value.text.trim().length === 0) {
    errors.push("text must be a non-empty string.");
  }

  if (
    typeof value.investorStage !== "string" ||
    !investorStages.includes(value.investorStage as InvestorStage)
  ) {
    errors.push("Invalid investorStage.");
  }

  const validConsentStatus =
    typeof value.consentStatus === "string" &&
    consentStatuses.includes(value.consentStatus as ConsentStatus);

  if (!validConsentStatus) {
    errors.push("Invalid consentStatus.");
  }

  if (typeof value.isSynthetic !== "boolean") {
    errors.push("isSynthetic must be a boolean.");
  }

  if (sourceType === "synthetic" && value.isSynthetic !== true) {
    errors.push("Synthetic source rows must set isSynthetic to true.");
  }

  if (sourceType !== null && sourceType !== "synthetic" &&
      value.isSynthetic === true) {
    errors.push("Non-synthetic source rows cannot set isSynthetic to true.");
  }

  if (options.realCorpus && sourceType === "synthetic") {
    errors.push("Synthetic records are not allowed in the real corpus.");
  }

  if (
    sourceType !== null &&
    consentedSourceTypes.includes(sourceType) &&
    value.consentStatus !== "obtained"
  ) {
    errors.push("Consented research rows must have obtained consent.");
  }

  if (
    (sourceType === "public_discussion" ||
      sourceType === "synthetic") &&
    value.consentStatus !== "not_required"
  ) {
    errors.push(
      "Public discussion and synthetic rows must have consentStatus set to not_required.",
    );
  }

  const aiUsePermission = normalizePermission(value.aiUsePermission);
  const retentionPermission = normalizePermission(value.retentionPermission);
  if (value.aiUsePermission !== undefined && value.aiUsePermission !== null && value.aiUsePermission !== "" && aiUsePermission === undefined) {
    errors.push("Invalid aiUsePermission.");
  }
  if (value.retentionPermission !== undefined && value.retentionPermission !== null && value.retentionPermission !== "" && retentionPermission === undefined) {
    errors.push("Invalid retentionPermission.");
  }

  if (
    sourceType !== null &&
    sourceType !== "synthetic" &&
    (aiUsePermission === "not_permitted" || retentionPermission === "not_permitted")
  ) {
    errors.push("Records not permitted for retention or AI use must not be included in the real corpus.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const text = (value.text as string).trim();
  const capturedAt = value.capturedAt as string;

  const contentHash = createContentHash({
    sourceType: sourceType as FeedbackSourceType,
    sourceReference,
    capturedAt,
    text,
  });

  const publishedAtRaw = normalizeString(value.publishedAt);
  if (publishedAtRaw && Number.isNaN(Date.parse(publishedAtRaw))) {
    return { valid: false, errors: ["publishedAt must be a valid date."] };
  }

  return {
    valid: true,
    errors: [],
    row: {
      sourceType: sourceType as FeedbackSourceType,
      sourceReference,
      capturedAt,
      text,
      investorStage: value.investorStage as InvestorStage,
      consentStatus: value.consentStatus as ConsentStatus,
      contentHash,
      isSynthetic: value.isSynthetic as boolean,
      platform: normalizeString(value.platform),
      sourceUrl: normalizeString(value.sourceUrl),
      sourceRecordId: normalizeString(value.sourceRecordId),
      publishedAt: publishedAtRaw,
      rating: normalizeRating(value.rating),
      aiUsePermission: aiUsePermission ?? "unknown",
      retentionPermission: retentionPermission ?? "unknown",
    },
  };
}

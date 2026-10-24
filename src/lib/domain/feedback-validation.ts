
import { createContentHash } from "./content-hash";
import type {
  FeedbackImportRow,
  FeedbackSourceType,
  ConsentStatus,
  InvestorStage,
} from "./feedback";

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

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  row?: FeedbackImportRow;
}

export function validateFeedbackRow(input: unknown): ValidationResult {
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
    },
  };
}

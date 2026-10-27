import type { FeedbackRecord } from "./feedback.ts";
import {
  assessSipRelevance,
  type SipRelevanceAssessment,
} from "./sip-relevance.ts";

/**
 * AI use and retention must each be explicitly permitted. Missing or unknown
 * permission is treated as unauthorized.
 */
export function hasPermittedResearchUse(
  record: Pick<FeedbackRecord, "aiUsePermission" | "retentionPermission">,
): boolean {
  return (
    record.aiUsePermission === "permitted" &&
    record.retentionPermission === "permitted"
  );
}

export type ProductionEligibilityReason =
  | "synthetic_record"
  | "ai_use_permission_unknown"
  | "ai_use_not_permitted"
  | "retention_permission_unknown"
  | "retention_not_permitted"
  | "missing_source_reference"
  | "missing_source_platform"
  | "invalid_captured_at"
  | "missing_provenance"
  | "consent_not_obtained"
  | "consent_withdrawn"
  | "sip_relevance_unclear";

export const ELIGIBILITY_REASON_LABELS: Record<
  ProductionEligibilityReason,
  string
> = {
  synthetic_record: "Synthetic records are excluded from production evidence.",
  ai_use_permission_unknown:
    "AI-use permission is missing or unknown; it must be explicitly permitted.",
  ai_use_not_permitted: "AI-use permission is explicitly not permitted.",
  retention_permission_unknown:
    "Retention permission is missing or unknown; it must be explicitly permitted.",
  retention_not_permitted: "Retention permission is explicitly not permitted.",
  missing_source_reference: "A source reference is required.",
  missing_source_platform: "A source platform is required for source metadata.",
  invalid_captured_at: "A valid capturedAt timestamp is required.",
  missing_provenance:
    "A provenance locator is required: sourceUrl, sourceRecordId, or a URL in sourceReference.",
  consent_not_obtained:
    "Consent must be obtained for consented interview or survey records.",
  consent_withdrawn: "Consent has been withdrawn for this record.",
  sip_relevance_unclear:
    "The text does not clearly relate to SIP, mutual funds, or monthly investing.",
};

export interface ProductionEligibilityAssessment {
  eligible: boolean;
  reasons: ProductionEligibilityReason[];
  sipRelevance: SipRelevanceAssessment;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * A usable provenance locator must point back to the source record. A URL in
 * sourceReference can itself serve as the locator; otherwise a sourceUrl or
 * sourceRecordId is required.
 */
export function hasSourceProvenance(record: FeedbackRecord): boolean {
  const sourceReference = record.sourceReference?.trim();
  if (!sourceReference) {
    return false;
  }
  if (isNonEmptyString(record.sourceUrl) || isNonEmptyString(record.sourceRecordId)) {
    return true;
  }
  return isHttpUrl(sourceReference);
}

/**
 * Central production eligibility policy. A record can enter retrieval,
 * dashboard evidence, or an eligible export only when every check passes.
 */
export function assessProductionEligibility(
  record: FeedbackRecord,
): ProductionEligibilityAssessment {
  const reasons: ProductionEligibilityReason[] = [];
  const sipRelevance = assessSipRelevance(record.text);

  if (record.isSynthetic) {
    reasons.push("synthetic_record");
  }

  if (record.aiUsePermission === "not_permitted") {
    reasons.push("ai_use_not_permitted");
  } else if (record.aiUsePermission !== "permitted") {
    reasons.push("ai_use_permission_unknown");
  }

  if (record.retentionPermission === "not_permitted") {
    reasons.push("retention_not_permitted");
  } else if (record.retentionPermission !== "permitted") {
    reasons.push("retention_permission_unknown");
  }

  if (!isNonEmptyString(record.sourceReference)) {
    reasons.push("missing_source_reference");
  }

  if (!isNonEmptyString(record.platform)) {
    reasons.push("missing_source_platform");
  }

  if (!isValidTimestamp(record.capturedAt)) {
    reasons.push("invalid_captured_at");
  }

  if (!hasSourceProvenance(record)) {
    reasons.push("missing_provenance");
  }

  if (record.consentStatus === "withdrawn") {
    reasons.push("consent_withdrawn");
  } else if (
    (record.sourceType === "consented_interview" ||
      record.sourceType === "consented_survey") &&
    record.consentStatus !== "obtained"
  ) {
    reasons.push("consent_not_obtained");
  }

  if (!sipRelevance.relevant) {
    reasons.push("sip_relevance_unclear");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    sipRelevance,
  };
}

/**
 * Production retrieval is restricted to genuine, permissioned, SIP-relevant
 * records with usable provenance. Synthetic records are never eligible.
 */
export function isEligibleForProductionRetrieval(
  record: FeedbackRecord,
): boolean {
  return assessProductionEligibility(record).eligible;
}

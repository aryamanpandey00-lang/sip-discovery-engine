
export type FeedbackSourceType =
  | "public_discussion"
  | "consented_interview"
  | "consented_survey"
  | "synthetic";

export type ConsentStatus =
  | "not_required"
  | "obtained"
  | "pending"
  | "withdrawn";

export type InvestorStage =
  | "considering_first_sip"
  | "started_first_sip"
  | "continuing_sip"
  | "paused_or_stopped"
  | "unknown";

export interface FeedbackRecord {
  id: string;
  sourceType: FeedbackSourceType;
  sourceReference: string | null;
  capturedAt: string;
  text: string;
  investorStage: InvestorStage;
  consentStatus: ConsentStatus;
  contentHash: string;
  isSynthetic: boolean;
}

export interface FeedbackImportRow {
  sourceType: FeedbackSourceType;
  sourceReference: string | null;
  capturedAt: string;
  text: string;
  investorStage: InvestorStage;
  consentStatus: ConsentStatus;
  contentHash: string;
  isSynthetic: boolean;
}

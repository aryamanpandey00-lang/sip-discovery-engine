
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

export type PermissionStatus = "permitted" | "not_permitted" | "unknown";

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
  platform?: string | null;
  sourceUrl?: string | null;
  sourceRecordId?: string | null;
  publishedAt?: string | null;
  rating?: string | number | null;
  aiUsePermission?: PermissionStatus;
  retentionPermission?: PermissionStatus;
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
  platform?: string | null;
  sourceUrl?: string | null;
  sourceRecordId?: string | null;
  publishedAt?: string | null;
  rating?: string | number | null;
  aiUsePermission?: PermissionStatus;
  retentionPermission?: PermissionStatus;
}

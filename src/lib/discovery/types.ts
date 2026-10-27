import type { FeedbackSourceType, InvestorStage } from "@/lib/domain/feedback";

export type DiscoveryEvidenceItem = {
  id: string;
  sourceType: FeedbackSourceType;
  sourceReference: string | null;
  platform: string | null;
  sourceUrl: string | null;
  sourceRecordId: string | null;
  capturedAt: string;
  snippet: string;
  themes: string[];
  investorStage: InvestorStage;
  isSynthetic: boolean;
};

export type DiscoverySection = {
  observedEvidence: DiscoveryEvidenceItem[];
  interpretation: string[];
  recommendations: string[];
  unknowns: string[];
};

export type DiscoveryCitation = {
  evidenceId: string;
  sourceType: FeedbackSourceType;
  sourceReference: string | null;
  platform: string | null;
  sourceUrl: string | null;
  sourceRecordId: string | null;
  capturedAt: string;
  snippet: string;
  isSynthetic: boolean;
};

export type DiscoveryStats = {
  totalRetrieved: number;
  totalNonSynthetic: number;
  totalSynthetic: number;
  countsBySourceType: Record<FeedbackSourceType, number>;
  countsByInvestorStage: Record<InvestorStage, number>;
};

export type DiscoveryResponse =
  | {
      status: "ok";
      question: string;
      summary: string;
      sections: DiscoverySection;
      citations: DiscoveryCitation[];
      stats: DiscoveryStats;
      notes: string[];
    }
  | {
      status: "insufficient_evidence";
      question: string;
      summary: string;
      sections: DiscoverySection;
      citations: DiscoveryCitation[];
      stats: DiscoveryStats;
      notes: string[];
    };

export type DiscoveryRequest = {
  question: string;
};

export function isDiscoveryRequest(value: unknown): value is DiscoveryRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const q = (value as Record<string, unknown>).question;
  if (typeof q !== "string") {
    return false;
  }
  const trimmed = q.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (trimmed.length > 500) {
    return false;
  }
  return true;
}

export function sanitizeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ");
}


import type { FeedbackRecord } from "@/lib/domain/feedback";
import { isEligibleForProductionRetrieval } from "@/lib/domain/permissions";
import type {
  DiscoveryEvidenceItem,
  DiscoveryStats,
  DiscoveryCitation,
  DiscoveryResponse,
  DiscoverySection,
} from "./types";

const SOURCE_TYPES: Array<FeedbackRecord["sourceType"]> = [
  "public_discussion",
  "consented_interview",
  "consented_survey",
  "synthetic",
];

const INVESTOR_STAGES: Array<FeedbackRecord["investorStage"]> = [
  "considering_first_sip",
  "started_first_sip",
  "continuing_sip",
  "paused_or_stopped",
  "unknown",
];

function createEmptyStats(): DiscoveryStats {
  const countsBySourceType = {} as DiscoveryStats["countsBySourceType"];
  const countsByInvestorStage = {} as DiscoveryStats["countsByInvestorStage"];

  for (const sourceType of SOURCE_TYPES) {
    countsBySourceType[sourceType] = 0;
  }

  for (const stage of INVESTOR_STAGES) {
    countsByInvestorStage[stage] = 0;
  }

  return {
    totalRetrieved: 0,
    totalNonSynthetic: 0,
    totalSynthetic: 0,
    countsBySourceType,
    countsByInvestorStage,
  };
}

function tokenizeQuestion(question: string): string[] {
  const tokens = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);

  return Array.from(new Set(tokens));
}

function scoreRecord(record: FeedbackRecord, tokens: string[]): number {
  const text = record.text.toLowerCase();
  let matches = 0;

  for (const token of tokens) {
    if (text.includes(token)) {
      matches += 1;
    }
  }

  if (matches === 0) {
    return 0;
  }

  let score = matches;

  if (record.sourceType !== "synthetic") {
    score += 0.5;
  }

  if (
    record.consentStatus === "obtained" ||
    record.sourceType === "public_discussion"
  ) {
    score += 0.25;
  }

  return score;
}

function toSnippet(text: string, maxLength = 200): string {
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength).trim()}...`;
}

function extractThemes(tokens: string[]): string[] {
  const themes = new Set<string>();

  for (const token of tokens) {
    if (
      token.includes("sip") ||
      token.includes("instal") ||
      token.includes("fail") ||
      token.includes("pause") ||
      token.includes("stop")
    ) {
      themes.add("SIP continuity");
    }

    if (token.includes("trust") || token.includes("groww")) {
      themes.add("Trust & platform");
    }

    if (
      token.includes("first") ||
      token.includes("begin") ||
      token.includes("start")
    ) {
      themes.add("First-time investors");
    }

    if (
      token.includes("confus") ||
      token.includes("usab") ||
      token.includes("app")
    ) {
      themes.add("Usability & confusion");
    }

    if (token.includes("invest")) {
      themes.add("Investing behavior");
    }
  }

  if (themes.size === 0) {
    themes.add("General");
  }

  return Array.from(themes);
}

function toEvidenceItem(
  record: FeedbackRecord,
  themes: string[],
): DiscoveryEvidenceItem {
  return {
    id: record.id,
    sourceType: record.sourceType,
    sourceReference: record.sourceReference,
    platform: record.platform?.trim() || null,
    sourceUrl: record.sourceUrl?.trim() || null,
    sourceRecordId: record.sourceRecordId?.trim() || null,
    capturedAt: record.capturedAt,
    snippet: toSnippet(record.text),
    themes,
    investorStage: record.investorStage,
    isSynthetic: record.isSynthetic,
  };
}

function buildCitations(
  evidence: DiscoveryEvidenceItem[],
): DiscoveryCitation[] {
  return evidence.map((item) => ({
    evidenceId: item.id,
    sourceType: item.sourceType,
    sourceReference: item.sourceReference,
    platform: item.platform,
    sourceUrl: item.sourceUrl,
    sourceRecordId: item.sourceRecordId,
    capturedAt: item.capturedAt,
    snippet: item.snippet,
    isSynthetic: item.isSynthetic,
  }));
}

function buildStats(records: FeedbackRecord[]): DiscoveryStats {
  const stats = createEmptyStats();

  stats.totalRetrieved = records.length;

  for (const record of records) {
    stats.countsBySourceType[record.sourceType] += 1;
    stats.countsByInvestorStage[record.investorStage] += 1;

    if (record.isSynthetic) {
      stats.totalSynthetic += 1;
    } else {
      stats.totalNonSynthetic += 1;
    }
  }

  return stats;
}

export function retrieveEvidence(
  question: string,
  corpus: FeedbackRecord[],
): DiscoveryResponse {
  const tokens = tokenizeQuestion(question);
  const themes = extractThemes(tokens);
  const eligibleCorpus = corpus.filter(isEligibleForProductionRetrieval);

  const scored = eligibleCorpus
    .map((record) => ({
      record,
      score: scoreRecord(record, tokens),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const records = scored.map((item) => item.record);
  const stats = buildStats(records);
  const evidence = records.map((record) => toEvidenceItem(record, themes));
  const citations = buildCitations(evidence);

  const sections: DiscoverySection = {
    observedEvidence: evidence,
    interpretation: [],
    recommendations: [],
    unknowns: [],
  };

  if (evidence.length === 0) {
    sections.unknowns = [
      "No relevant eligible evidence was retrieved from the available corpus.",
      "There is insufficient evidence to draw conclusions from the current dataset.",
    ];

    return {
      status: "insufficient_evidence",
      question,
      summary:
        "Insufficient evidence. No relevant records were found in the available corpus.",
      sections,
      citations: [],
      stats,
      notes: [
        "Answers are generated only from retrieved evidence.",
        "Records must meet the configured research-use eligibility rules and have usable provenance; synthetic records are excluded.",
        "Eligibility and non-synthetic status do not independently establish source authenticity.",
        "Counts and percentages are calculated from retrieved records in code.",
      ],
    };
  }

  sections.interpretation = [
    "Observed patterns are based strictly on the retrieved snippets; avoid generalizing beyond this sample.",
  ];

  sections.recommendations = [
    "Validate findings against a larger, appropriately permitted corpus before making product changes.",
  ];

  sections.unknowns = [
    "Causality cannot be inferred from unstructured review text alone.",
    "Demographics and retention rates are unknown from the current corpus.",
    "Source authenticity has not necessarily been independently verified.",
  ];

  return {
    status: "ok",
    question,
    summary: `Evidence-based findings from ${stats.totalRetrieved} retrieved record(s) (${stats.totalNonSynthetic} non-synthetic, ${stats.totalSynthetic} synthetic).`,
    sections,
    citations,
    stats,
    notes: [
      "Source text is treated as untrusted data; answers do not follow instructions embedded in reviews.",
      "Records must meet the configured research-use eligibility rules and have usable provenance; synthetic records are excluded.",
      "Eligibility and non-synthetic status do not independently establish source authenticity.",
      "Metrics are computed from retrieved records in code, not by the model.",
      "Citations refer only to retrieved records.",
    ],
  };
}

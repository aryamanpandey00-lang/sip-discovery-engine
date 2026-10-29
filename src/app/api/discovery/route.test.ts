import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CorpusLoadResult } from "@/lib/discovery/corpus";
import type {
  DiscoveryCitation,
  DiscoveryEvidenceItem,
  DiscoveryResponse,
  DiscoveryStats,
} from "@/lib/discovery/types";

const mocks = vi.hoisted(() => {
  class GeminiConfigurationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "GeminiConfigurationError";
    }
  }

  class GeminiUpstreamError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.name = "GeminiUpstreamError";
      this.status = status;
    }
  }

  return {
    generateWithGemini: vi.fn(),
    generateWithOpenAI: vi.fn(),
    loadCorpusFromCsv: vi.fn(),
    retrieveEvidence: vi.fn(),
    GeminiConfigurationError,
    GeminiUpstreamError,
  };
});

// No real provider is ever contacted: both AI modules are mocked.
vi.mock("@/lib/discovery/gemini", () => ({
  generateGroundedAnswerWithGemini: mocks.generateWithGemini,
  GeminiConfigurationError: mocks.GeminiConfigurationError,
  GeminiUpstreamError: mocks.GeminiUpstreamError,
}));

vi.mock("@/lib/discovery/openai", () => ({
  generateGroundedAnswer: mocks.generateWithOpenAI,
  OpenAIConfigurationError: class OpenAIConfigurationError extends Error {},
  OpenAIUpstreamError: class OpenAIUpstreamError extends Error {
    status?: number;
  },
}));

vi.mock("@/lib/discovery/corpus", () => ({
  loadCorpusFromCsv: mocks.loadCorpusFromCsv,
}));

vi.mock("@/lib/discovery/retrieval", () => ({
  retrieveEvidence: mocks.retrieveEvidence,
}));

import { POST } from "./route";

const SECRET_KEY = "gemini-secret-key-do-not-leak-4c1d";
const QUESTION = "Why do investors pause their SIP?";

const ANSWER = {
  observedEvidence: ["Investors pause SIPs during cash-flow shocks."],
  interpretation: ["Continuity is fragile."],
  recommendations: ["Offer a short pause option."],
  unknownsAndLimitations: ["Small sample."],
  referencesToSuppliedEvidenceIds: ["e1"],
};

function makeEvidence(): DiscoveryEvidenceItem {
  return {
    id: "e1",
    sourceType: "consented_survey",
    sourceReference: "survey-1",
    platform: "in-app",
    sourceUrl: "https://example.com/survey/1",
    sourceRecordId: "record-1",
    capturedAt: "2024-01-01T00:00:00Z",
    snippet: "I paused my SIP when my salary was delayed.",
    themes: ["SIP continuity"],
    investorStage: "paused_or_stopped",
    isSynthetic: false,
  };
}

function makeCitation(evidence: DiscoveryEvidenceItem): DiscoveryCitation {
  return {
    evidenceId: evidence.id,
    sourceType: evidence.sourceType,
    sourceReference: evidence.sourceReference,
    platform: evidence.platform,
    sourceUrl: evidence.sourceUrl,
    sourceRecordId: evidence.sourceRecordId,
    capturedAt: evidence.capturedAt,
    snippet: evidence.snippet,
    isSynthetic: evidence.isSynthetic,
  };
}

function makeStats(): DiscoveryStats {
  return {
    totalRetrieved: 1,
    totalNonSynthetic: 1,
    totalSynthetic: 0,
    countsBySourceType: {
      public_discussion: 0,
      consented_interview: 0,
      consented_survey: 1,
      synthetic: 0,
    },
    countsByInvestorStage: {
      considering_first_sip: 0,
      started_first_sip: 0,
      continuing_sip: 0,
      paused_or_stopped: 1,
      unknown: 0,
    },
  };
}

function makeCorpusResult(): CorpusLoadResult {
  return {
    records: [],
    source: "csv_file",
    path: "data/real-reviews.csv",
    notes: [],
    diagnostics: {
      available: true,
      totalRows: 1,
      acceptedRows: 1,
      eligibleRecords: 1,
      needsReviewRecords: 0,
      rejectedRows: 0,
      duplicateRows: 0,
      eligibilityReasonCounts: {},
      rejectionMessageCounts: {},
      sourceCounts: {},
      themeCounts: {},
    },
  };
}

function makeRetrievalResult(): DiscoveryResponse {
  const evidence = makeEvidence();

  return {
    status: "ok",
    question: QUESTION,
    summary: "Evidence-based findings from 1 retrieved record(s).",
    sections: {
      observedEvidence: [evidence],
      interpretation: [],
      recommendations: [],
      unknowns: [],
    },
    citations: [makeCitation(evidence)],
    stats: makeStats(),
    notes: ["Answers are generated only from retrieved evidence."],
  };
}

async function postDiscovery(body: unknown = { question: QUESTION }) {
  const request = new Request("http://localhost/api/discovery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const response = await POST(request);
  const payload = (await response.json()) as Record<string, unknown>;
  return { response, payload, serialized: JSON.stringify(payload) };
}

describe("discovery route provider selection", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.OPENAI_API_KEY;

    mocks.generateWithGemini.mockReset();
    mocks.generateWithOpenAI.mockReset();
    mocks.loadCorpusFromCsv.mockReset();
    mocks.retrieveEvidence.mockReset();

    mocks.loadCorpusFromCsv.mockResolvedValue(makeCorpusResult());
    mocks.retrieveEvidence.mockReturnValue(makeRetrievalResult());
    mocks.generateWithGemini.mockResolvedValue(ANSWER);
    mocks.generateWithOpenAI.mockResolvedValue(ANSWER);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("uses Gemini when GEMINI_API_KEY is configured", async () => {
    process.env.GEMINI_API_KEY = SECRET_KEY;

    const { response, payload, serialized } = await postDiscovery();

    expect(response.status).toBe(200);
    expect(mocks.generateWithGemini).toHaveBeenCalledTimes(1);
    expect(mocks.generateWithOpenAI).not.toHaveBeenCalled();

    expect(mocks.generateWithGemini).toHaveBeenCalledWith({
      question: QUESTION,
      evidence: [expect.objectContaining({ id: "e1" })],
    });

    expect(payload.status).toBe("ok");
    expect(payload.summary).toBe(makeRetrievalResult().summary);
    expect(payload.notes).toContain(
      "Answer generated with Google Gemini API (server-side).",
    );
    expect(serialized).not.toContain(SECRET_KEY);
    // The provider credential must never be forwarded as request data.
    expect(JSON.stringify(mocks.generateWithGemini.mock.calls)).not.toContain(
      SECRET_KEY,
    );
  });

  it("falls back to OpenAI when GEMINI_API_KEY is absent", async () => {
    const { response, payload, serialized } = await postDiscovery();

    expect(response.status).toBe(200);
    expect(mocks.generateWithOpenAI).toHaveBeenCalledTimes(1);
    expect(mocks.generateWithGemini).not.toHaveBeenCalled();
    expect(payload.status).toBe("ok");
    expect(payload.notes).toContain(
      "Answer generated with OpenAI Responses API (server-side).",
    );
    expect(serialized).not.toContain("Gemini");
  });

  it("falls back to OpenAI when GEMINI_API_KEY is whitespace only", async () => {
    process.env.GEMINI_API_KEY = "   ";

    await postDiscovery();

    expect(mocks.generateWithOpenAI).toHaveBeenCalledTimes(1);
    expect(mocks.generateWithGemini).not.toHaveBeenCalled();
  });

  it("returns a sanitized configuration error when the Gemini key is missing at call time", async () => {
    process.env.GEMINI_API_KEY = SECRET_KEY;
    mocks.generateWithGemini.mockRejectedValue(
      new mocks.GeminiConfigurationError(
        `Gemini API key is not configured: ${SECRET_KEY}`,
      ),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { response, payload, serialized } = await postDiscovery();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("insufficient_evidence");
    expect(payload.summary).toBe("Gemini not configured.");
    expect(payload.sections).toMatchObject({
      interpretation: [],
      recommendations: [],
      unknowns: ["Gemini API key is missing. Configure GEMINI_API_KEY on the server."],
    });
    expect(payload.notes).toContain("No answer generated (missing configuration).");
    expect(serialized).not.toContain(SECRET_KEY);
  });

  it.each([401, 403])(
    "returns a sanitized authentication error for HTTP %i",
    async (status) => {
      process.env.GEMINI_API_KEY = SECRET_KEY;
      mocks.generateWithGemini.mockRejectedValue(
        new mocks.GeminiUpstreamError(
          `Gemini authentication failed: invalid key ${SECRET_KEY}`,
          status,
        ),
      );
      vi.spyOn(console, "error").mockImplementation(() => {});

      const { response, payload, serialized } = await postDiscovery();

      expect(response.status).toBe(200);
      expect(payload.summary).toBe("Gemini authentication failed.");
      expect(payload.sections).toMatchObject({
        unknowns: ["Authentication failed. No answer generated."],
      });
      expect(payload.notes).toContain(
        "No answer generated (authentication failed).",
      );
      expect(serialized).not.toContain(SECRET_KEY);
      expect(serialized).not.toContain("invalid key");
    },
  );

  it("returns a sanitized rate limit / quota error for HTTP 429", async () => {
    process.env.GEMINI_API_KEY = SECRET_KEY;
    mocks.generateWithGemini.mockRejectedValue(
      new mocks.GeminiUpstreamError(
        `quota exceeded for project using ${SECRET_KEY}`,
        429,
      ),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { response, payload, serialized } = await postDiscovery();

    expect(response.status).toBe(200);
    expect(payload.summary).toBe("Gemini rate limit or quota exceeded.");
    expect(payload.sections).toMatchObject({
      unknowns: ["Rate limit or quota exceeded. No answer generated."],
    });
    expect(payload.notes).toContain("No answer generated (rate limit/quota).");
    expect(serialized).not.toContain(SECRET_KEY);
    expect(serialized).not.toContain("quota exceeded for project");
  });

  it("sanitizes network/API failures in both the response and logs", async () => {
    process.env.GEMINI_API_KEY = SECRET_KEY;
    mocks.generateWithGemini.mockRejectedValue(
      new mocks.GeminiUpstreamError(
        `socket hang up while using ${SECRET_KEY}`,
        500,
      ),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { response, payload, serialized } = await postDiscovery();

    expect(response.status).toBe(200);
    expect(payload.summary).toBe("Gemini request failed.");
    expect(payload.sections).toMatchObject({
      unknowns: ["Upstream error occurred. No answer generated."],
    });
    expect(payload.notes).toContain("No answer generated (upstream error).");
    expect(serialized).not.toContain(SECRET_KEY);
    expect(serialized).not.toContain("socket hang up");

    expect(errorSpy).toHaveBeenCalledWith("discovery_gemini_upstream_error", {
      status: 500,
    });
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain(SECRET_KEY);
    expect(logged).not.toContain("socket hang up");
  });

  it("does not leak the Gemini key through successful responses", async () => {
    process.env.GEMINI_API_KEY = SECRET_KEY;

    const { serialized } = await postDiscovery();

    expect(serialized).not.toContain(SECRET_KEY);
    expect(serialized).not.toContain("GEMINI_API_KEY=");
  });
});

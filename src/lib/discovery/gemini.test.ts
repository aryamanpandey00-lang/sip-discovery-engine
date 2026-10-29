import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateContentMock, constructorSpy } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
  constructorSpy: vi.fn(),
}));

// The Google Gen AI SDK is fully mocked so these tests never reach Google's
// API and never consume real quota.
vi.mock("@google/genai", () => {
  class GoogleGenAI {
    models = {
      generateContent: generateContentMock,
    };
    constructor(options?: unknown) {
      constructorSpy(options);
    }
  }
  return { GoogleGenAI };
});

type StructuredAnswer = {
  observedEvidence: string[];
  interpretation: string[];
  recommendations: string[];
  unknownsAndLimitations: string[];
  referencesToSuppliedEvidenceIds: string[];
};

const VALID_ANSWER: StructuredAnswer = {
  observedEvidence: ["Users mention pausing SIP during income stress."],
  interpretation: ["Continuity appears fragile during cash-flow shocks."],
  recommendations: ["Offer a short pause instead of full cancellation."],
  unknownsAndLimitations: ["The sample is small and self-selected."],
  referencesToSuppliedEvidenceIds: ["e1"],
};

const EVIDENCE = [
  {
    id: "e1",
    sourceType: "consented_survey",
    sourceReference: "survey-1",
    platform: "in-app",
    sourceUrl: "https://example.com/survey/1",
    sourceRecordId: "record-1",
    capturedAt: "2024-01-01T00:00:00Z",
    snippet: "I paused my SIP when my salary was delayed.",
    isSynthetic: false,
  },
];

const SECRET_KEY = "gemini-secret-key-do-not-log-9f3a";

function successfulResponse(answer: unknown = VALID_ANSWER) {
  return { text: JSON.stringify(answer) };
}

async function loadGeminiModule() {
  return import("./gemini");
}

async function captureError(
  promise: Promise<unknown>,
): Promise<Error & { status?: number }> {
  try {
    await promise;
  } catch (error) {
    return error as Error & { status?: number };
  }
  throw new Error("Expected the promise to reject, but it resolved.");
}

describe("gemini provider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    generateContentMock.mockReset();
    constructorSpy.mockReset();
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("successful generation", () => {
    it("returns the structured answer parsed from the Gemini response", async () => {
      process.env.GEMINI_API_KEY = "test-key";
      generateContentMock.mockResolvedValue(successfulResponse());

      const { generateGroundedAnswerWithGemini } = await loadGeminiModule();
      const result = await generateGroundedAnswerWithGemini({
        question: "What is SIP?",
        evidence: EVIDENCE,
      });

      expect(result).toEqual(VALID_ANSWER);
      expect(generateContentMock).toHaveBeenCalledTimes(1);
      expect(constructorSpy).toHaveBeenCalledWith({ apiKey: "test-key" });
    });

    it("sends the grounded prompt, evidence IDs and JSON schema to Gemini", async () => {
      process.env.GEMINI_API_KEY = "test-key";
      generateContentMock.mockResolvedValue(successfulResponse());

      const { generateGroundedAnswerWithGemini } = await loadGeminiModule();
      await generateGroundedAnswerWithGemini({
        question: "Why do investors pause their SIP?",
        evidence: EVIDENCE,
      });

      const request = generateContentMock.mock.calls[0][0] as {
        model: string;
        contents: Array<{ role: string; parts: Array<{ text: string }> }>;
        config: {
          responseMimeType: string;
          responseSchema: {
            type: string;
            required: string[];
            properties: Record<string, unknown>;
          };
        };
      };

      expect(request.model).toBe("gemini-2.5-flash");
      expect(request.config.responseMimeType).toBe("application/json");
      expect(request.config.responseSchema.required).toEqual([
        "observedEvidence",
        "interpretation",
        "recommendations",
        "unknownsAndLimitations",
        "referencesToSuppliedEvidenceIds",
      ]);
      expect(
        Object.keys(request.config.responseSchema.properties).sort(),
      ).toEqual(
        [
          "observedEvidence",
          "interpretation",
          "recommendations",
          "unknownsAndLimitations",
          "referencesToSuppliedEvidenceIds",
        ].sort(),
      );

      const promptText = request.contents[0].parts[0].text;
      expect(promptText).toContain("Why do investors pause their SIP?");
      expect(promptText).toContain("[ID:e1]");
      expect(promptText).toContain(EVIDENCE[0].snippet);
      // Prompt-injection hardening must stay in place.
      expect(promptText).toContain("UNTRUSTED DATA");
    });

    it("honours GEMINI_MODEL when configured", async () => {
      process.env.GEMINI_API_KEY = "test-key";
      process.env.GEMINI_MODEL = "gemini-2.5-pro";
      generateContentMock.mockResolvedValue(successfulResponse());

      const { generateGroundedAnswerWithGemini } = await loadGeminiModule();
      await generateGroundedAnswerWithGemini({
        question: "test",
        evidence: EVIDENCE,
      });

      expect(generateContentMock.mock.calls[0][0]).toMatchObject({
        model: "gemini-2.5-pro",
      });
    });

    it("falls back to candidate parts when response.text is empty", async () => {
      process.env.GEMINI_API_KEY = "test-key";
      generateContentMock.mockResolvedValue({
        text: "",
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(VALID_ANSWER).slice(0, 20) }, { text: JSON.stringify(VALID_ANSWER).slice(20) }],
            },
          },
        ],
      });

      const { generateGroundedAnswerWithGemini } = await loadGeminiModule();
      const result = await generateGroundedAnswerWithGemini({
        question: "test",
        evidence: EVIDENCE,
      });

      expect(result).toEqual(VALID_ANSWER);
    });

    it("drops non-string entries from the structured output", async () => {
      process.env.GEMINI_API_KEY = "test-key";
      generateContentMock.mockResolvedValue(
        successfulResponse({
          ...VALID_ANSWER,
          observedEvidence: ["kept", 42, null, { nope: true }],
          referencesToSuppliedEvidenceIds: ["e1", 7],
        }),
      );

      const { generateGroundedAnswerWithGemini } = await loadGeminiModule();
      const result = await generateGroundedAnswerWithGemini({
        question: "test",
        evidence: EVIDENCE,
      });

      expect(result.observedEvidence).toEqual(["kept"]);
      expect(result.referencesToSuppliedEvidenceIds).toEqual(["e1"]);
    });
  });

  describe("missing configuration", () => {
    it("throws a configuration error when GEMINI_API_KEY is absent", async () => {
      const { generateGroundedAnswerWithGemini, GeminiConfigurationError } =
        await loadGeminiModule();

      const error = await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      expect(error).toBeInstanceOf(GeminiConfigurationError);
      expect(error.name).toBe("GeminiConfigurationError");
      expect(error.message).toContain("GEMINI_API_KEY");
      // No SDK call and no client construction without a key.
      expect(constructorSpy).not.toHaveBeenCalled();
      expect(generateContentMock).not.toHaveBeenCalled();
    });

    it("treats a whitespace-only key as missing", async () => {
      process.env.GEMINI_API_KEY = "   ";
      const { generateGroundedAnswerWithGemini, GeminiConfigurationError } =
        await loadGeminiModule();

      const error = await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      expect(error).toBeInstanceOf(GeminiConfigurationError);
      expect(constructorSpy).not.toHaveBeenCalled();
    });
  });

  describe("authentication failures", () => {
    it.each([401, 403])(
      "maps HTTP %i to a sanitized authentication error",
      async (status) => {
        process.env.GEMINI_API_KEY = SECRET_KEY;
        generateContentMock.mockRejectedValue({
          status,
          message: `invalid key ${SECRET_KEY}`,
        });

        const { generateGroundedAnswerWithGemini, GeminiUpstreamError } =
          await loadGeminiModule();
        const error = await captureError(
          generateGroundedAnswerWithGemini({
            question: "test",
            evidence: EVIDENCE,
          }),
        );

        expect(error).toBeInstanceOf(GeminiUpstreamError);
        expect(error.message).toBe("Gemini authentication failed.");
        expect(error.status).toBe(status);
        expect(error.message).not.toContain(SECRET_KEY);
      },
    );

    it("maps an invalid-API-key message without a status to authentication failure", async () => {
      process.env.GEMINI_API_KEY = SECRET_KEY;
      generateContentMock.mockRejectedValue({
        status: 400,
        message: "API key not valid. Please pass a valid API key.",
      });

      const { generateGroundedAnswerWithGemini, GeminiUpstreamError } =
        await loadGeminiModule();
      const error = await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      expect(error).toBeInstanceOf(GeminiUpstreamError);
      expect(error.message).toBe("Gemini authentication failed.");
    });

    it("reads the status from a nested response object", async () => {
      process.env.GEMINI_API_KEY = "test-key";
      generateContentMock.mockRejectedValue({
        response: { status: 401 },
        message: "unauthorized",
      });

      const { generateGroundedAnswerWithGemini } = await loadGeminiModule();
      const error = await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      expect(error.message).toBe("Gemini authentication failed.");
      expect(error.status).toBe(401);
    });
  });

  describe("rate limits and quota", () => {
    it("maps HTTP 429 to a sanitized rate limit error", async () => {
      process.env.GEMINI_API_KEY = "test-key";
      generateContentMock.mockRejectedValue({
        status: 429,
        message: "Too many requests",
      });

      const { generateGroundedAnswerWithGemini, GeminiUpstreamError } =
        await loadGeminiModule();
      const error = await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      expect(error).toBeInstanceOf(GeminiUpstreamError);
      expect(error.message).toBe("Gemini rate limit or quota exceeded.");
      expect(error.status).toBe(429);
    });

    it("maps exhausted-quota messages without a status to a rate limit error", async () => {
      process.env.GEMINI_API_KEY = "test-key";
      generateContentMock.mockRejectedValue({
        message: "RESOURCE_EXHAUSTED: Quota exceeded for quota metric",
      });

      const { generateGroundedAnswerWithGemini, GeminiUpstreamError } =
        await loadGeminiModule();
      const error = await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      expect(error).toBeInstanceOf(GeminiUpstreamError);
      expect(error.message).toBe("Gemini rate limit or quota exceeded.");
    });
  });

  describe("network and malformed responses", () => {
    it("sanitizes network failures", async () => {
      process.env.GEMINI_API_KEY = "test-key";
      generateContentMock.mockRejectedValue(
        new Error("getaddrinfo ENOTFOUND generativelanguage.googleapis.com"),
      );
      vi.spyOn(console, "error").mockImplementation(() => {});

      const { generateGroundedAnswerWithGemini, GeminiUpstreamError } =
        await loadGeminiModule();
      const error = await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      expect(error).toBeInstanceOf(GeminiUpstreamError);
      expect(error.message).toBe("Gemini request failed.");
      expect(error.message).not.toContain("ENOTFOUND");
      expect(error.status).toBeUndefined();
    });

    it("sanitizes upstream 5xx failures", async () => {
      process.env.GEMINI_API_KEY = "test-key";
      generateContentMock.mockRejectedValue({
        status: 503,
        message: "backend overloaded at node-17",
      });
      vi.spyOn(console, "error").mockImplementation(() => {});

      const { generateGroundedAnswerWithGemini } = await loadGeminiModule();
      const error = await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      expect(error.message).toBe("Gemini request failed.");
      expect(error.status).toBe(503);
      expect(error.message).not.toContain("node-17");
    });

    it("maps aborted requests to a timeout error", async () => {
      process.env.GEMINI_API_KEY = "test-key";
      const abortError = new Error("aborted");
      abortError.name = "AbortError";
      generateContentMock.mockRejectedValue(abortError);

      const { generateGroundedAnswerWithGemini, GeminiUpstreamError } =
        await loadGeminiModule();
      const error = await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      expect(error).toBeInstanceOf(GeminiUpstreamError);
      expect(error.message).toBe("Gemini request timed out.");
    });

    it("rejects an empty model response with a sanitized error", async () => {
      process.env.GEMINI_API_KEY = "test-key";
      generateContentMock.mockResolvedValue({ text: "" });

      const { generateGroundedAnswerWithGemini } = await loadGeminiModule();
      const error = await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      expect(error.message).toBe("Gemini returned no text output.");
    });

    it("rejects malformed JSON without echoing the raw payload", async () => {
      process.env.GEMINI_API_KEY = "test-key";
      generateContentMock.mockResolvedValue({ text: "not-json {secret leak}" });

      const { generateGroundedAnswerWithGemini } = await loadGeminiModule();
      const error = await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      expect(error.message).toBe("Gemini returned malformed JSON.");
      expect(error.message).not.toContain("secret leak");
    });

    it("rejects structured output missing required arrays", async () => {
      process.env.GEMINI_API_KEY = "test-key";
      generateContentMock.mockResolvedValue(
        successfulResponse({ observedEvidence: ["only one key"] }),
      );

      const { generateGroundedAnswerWithGemini } = await loadGeminiModule();
      const error = await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      expect(error.message).toBe("Gemini returned invalid structured output.");
    });
  });

  describe("secret hygiene", () => {
    it("does not expose the API key or raw provider error in thrown errors", async () => {
      process.env.GEMINI_API_KEY = SECRET_KEY;
      generateContentMock.mockRejectedValue(
        new Error(`request failed for key ${SECRET_KEY}`),
      );
      vi.spyOn(console, "error").mockImplementation(() => {});

      const { generateGroundedAnswerWithGemini } = await loadGeminiModule();
      const error = await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      expect(error.message).toBe("Gemini request failed.");
      expect(JSON.stringify(error)).not.toContain(SECRET_KEY);
      expect(String(error.stack ?? "")).not.toContain(SECRET_KEY);
    });

    it("logs only a structured status, never the key or raw error message", async () => {
      process.env.GEMINI_API_KEY = SECRET_KEY;
      generateContentMock.mockRejectedValue({
        status: 500,
        message: `upstream exploded with ${SECRET_KEY}`,
      });
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { generateGroundedAnswerWithGemini } = await loadGeminiModule();
      await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      expect(errorSpy).toHaveBeenCalledWith("gemini_upstream_error", {
        status: 500,
      });

      const logged = JSON.stringify(errorSpy.mock.calls);
      expect(logged).not.toContain(SECRET_KEY);
      expect(logged).not.toContain("upstream exploded");
    });

    it("does not log anything for authentication or quota failures", async () => {
      process.env.GEMINI_API_KEY = SECRET_KEY;
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { generateGroundedAnswerWithGemini } = await loadGeminiModule();

      generateContentMock.mockRejectedValue({ status: 401, message: SECRET_KEY });
      await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      generateContentMock.mockRejectedValue({ status: 429, message: SECRET_KEY });
      await captureError(
        generateGroundedAnswerWithGemini({ question: "test", evidence: EVIDENCE }),
      );

      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});


import { NextResponse } from "next/server";
import { hasValidEvidenceReferences } from "@/lib/discovery/answer-validation";
import { isDiscoveryRequest, sanitizeQuestion } from "@/lib/discovery/types";
import { retrieveEvidence } from "@/lib/discovery/retrieval";
import { loadCorpusFromCsv } from "@/lib/discovery/corpus";
import {
  generateGroundedAnswer,
  OpenAIConfigurationError,
  OpenAIUpstreamError,
} from "@/lib/discovery/openai";
import {
  generateGroundedAnswerWithGemini,
  GeminiConfigurationError,
  GeminiUpstreamError,
} from "@/lib/discovery/gemini";

const EMPTY_STATS = {
  totalRetrieved: 0,
  totalNonSynthetic: 0,
  totalSynthetic: 0,
  countsBySourceType: {
    public_discussion: 0,
    consented_interview: 0,
    consented_survey: 0,
    synthetic: 0,
  },
  countsByInvestorStage: {
    considering_first_sip: 0,
    started_first_sip: 0,
    continuing_sip: 0,
    paused_or_stopped: 0,
    unknown: 0,
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!isDiscoveryRequest(body)) {
      return NextResponse.json(
        {
          status: "insufficient_evidence",
          question: "",
          summary:
            "Invalid request. Provide a non-empty question (max 500 chars).",
          sections: {
            observedEvidence: [],
            interpretation: [],
            recommendations: [],
            unknowns: ["Invalid or missing question."],
          },
          citations: [],
          stats: EMPTY_STATS,
          notes: ["Request validation failed."],
        },
        { status: 400 },
      );
    }

    const question = sanitizeQuestion(body.question);

    // Load only the production corpus. Never fall back to synthetic or
    // evaluation data when production evidence is missing or ineligible.
    const corpusResult = await loadCorpusFromCsv();
    const retrieval = retrieveEvidence(question, corpusResult.records);

    // Do not call OpenAI when verified, relevant evidence is unavailable.
    if (
      retrieval.status === "insufficient_evidence" ||
      retrieval.citations.length === 0
    ) {
      const notes = [
        ...retrieval.notes,
        "No OpenAI call made (insufficient evidence).",
        `Corpus source: ${corpusResult.source}`,
      ];

      if (corpusResult.path) {
        notes.push(`CSV path: ${corpusResult.path}`);
      }

      notes.push(...corpusResult.notes);

      return NextResponse.json(
        {
          ...retrieval,
          notes,
        },
        { status: 200 },
      );
    }

    try {
      const evidenceForModel = retrieval.sections.observedEvidence.map(
        (evidence) => ({
          id: evidence.id,
          sourceType: evidence.sourceType,
          sourceReference: evidence.sourceReference,
          platform: evidence.platform,
          sourceUrl: evidence.sourceUrl,
          sourceRecordId: evidence.sourceRecordId,
          capturedAt: evidence.capturedAt,
          snippet: evidence.snippet,
          isSynthetic: evidence.isSynthetic,
        }),
      );

      let modelAnswer;
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
        modelAnswer = await generateGroundedAnswerWithGemini({
          question,
          evidence: evidenceForModel,
        });
      } else {
        modelAnswer = await generateGroundedAnswer({
          question,
          evidence: evidenceForModel,
        });
      }

      // A model reference is valid only when it belongs to the retrieved
      // citation set. Require a non-empty list with no invalid references.
      const allowedIds = new Set(
        retrieval.citations.map((citation) => citation.evidenceId),
      );

      const referencesAreValid = hasValidEvidenceReferences(
        modelAnswer.referencesToSuppliedEvidenceIds,
        allowedIds,
      );

      if (!referencesAreValid) {
        const notes = [
          ...retrieval.notes,
          "AI interpretation and recommendations withheld: model evidence references were missing or invalid.",
          `Corpus source: ${corpusResult.source}`,
        ];

        if (corpusResult.path) {
          notes.push(`CSV path: ${corpusResult.path}`);
        }

        notes.push(...corpusResult.notes);

        return NextResponse.json(
          {
            status: "insufficient_evidence",
            question,
            summary:
              "Relevant evidence was retrieved, but the AI answer could not be verified against its evidence references.",
            sections: {
              observedEvidence: retrieval.sections.observedEvidence,
              interpretation: [],
              recommendations: [],
              unknowns: [
                "The AI-generated interpretation and recommendations were withheld because the model did not return a non-empty list of valid evidence references.",
                ...(retrieval.sections.unknowns ?? []),
              ],
            },
            citations: retrieval.citations,
            stats: retrieval.stats,
            notes,
          },
          { status: 200 },
        );
      }

      const validRefs = modelAnswer.referencesToSuppliedEvidenceIds;

      const citations = retrieval.citations.filter((citation) =>
        validRefs.includes(citation.evidenceId),
      );

      const sections = {
        observedEvidence: retrieval.sections.observedEvidence.filter(
          (evidence) => validRefs.includes(evidence.id),
        ),
        interpretation: modelAnswer.interpretation,
        recommendations: modelAnswer.recommendations,
        unknowns: [
          ...modelAnswer.unknownsAndLimitations,
          ...(retrieval.sections.unknowns ?? []),
        ],
      };

      const notes = [
        ...retrieval.notes,
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()
          ? "Answer generated with Google Gemini API (server-side)."
          : "Answer generated with OpenAI Responses API (server-side).",
        "Model evidence references validated against retrieved evidence IDs.",
        "Reference validation does not independently prove every claim is supported by its cited evidence.",
        "Counts and percentages computed in code.",
        `Corpus source: ${corpusResult.source}`,
        "No Google Play/forum live access configured.",
      ];

      if (corpusResult.path) {
        notes.push(`CSV path: ${corpusResult.path}`);
      }

      notes.push(...corpusResult.notes);

      return NextResponse.json(
        {
          status: "ok",
          question,
          summary: retrieval.summary,
          sections,
          citations,
          stats: retrieval.stats,
          notes,
        },
        { status: 200 },
      );
    } catch (error) {
      let summary: string;
      let unknown: string;
      let note: string;

      if (error instanceof OpenAIConfigurationError) {
        summary = "OpenAI not configured.";
        unknown =
          "OpenAI API key is missing. Configure OPENAI_API_KEY on the server.";
        note = "No answer generated (missing configuration).";
        if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
          try {
            console.error("discovery_openai_config_error");
          } catch {
            // ignore
          }
        }
      } else if (error instanceof GeminiConfigurationError) {
        summary = "Gemini not configured.";
        unknown =
          "Gemini API key is missing. Configure GEMINI_API_KEY on the server.";
        note = "No answer generated (missing configuration).";
        if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
          try {
            console.error("discovery_gemini_config_error");
          } catch {
            // ignore
          }
        }
      } else if (error instanceof OpenAIUpstreamError || error instanceof GeminiUpstreamError) {
        const status = (error as { status?: number }).status;
        if (status === 401 || status === 403) {
          summary = error instanceof GeminiUpstreamError ? "Gemini authentication failed." : "OpenAI authentication failed.";
          unknown = "Authentication failed. No answer generated.";
          note = "No answer generated (authentication failed).";
        } else if (status === 429) {
          summary = error instanceof GeminiUpstreamError ? "Gemini rate limit or quota exceeded." : "OpenAI rate limit exceeded.";
          unknown = "Rate limit or quota exceeded. No answer generated.";
          note = "No answer generated (rate limit/quota).";
        } else if (status && status >= 400 && status < 500) {
          summary = error instanceof GeminiUpstreamError ? "Gemini request failed." : "OpenAI request failed.";
          unknown = "Invalid request. No answer generated.";
          note = "No answer generated (invalid request).";
        } else {
          summary = error instanceof GeminiUpstreamError ? "Gemini request failed." : "OpenAI request failed.";
          unknown = "Upstream error occurred. No answer generated.";
          note = "No answer generated (upstream error).";
        }
        if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
          try {
            console.error(error instanceof GeminiUpstreamError ? "discovery_gemini_upstream_error" : "discovery_openai_upstream_error", { status });
          } catch {
            // ignore
          }
        }
      } else {
        summary = "An error occurred while generating the answer.";
        unknown = "Internal error. No answer generated.";
        note = "Error occurred; answer not generated.";
        if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
          try {
            console.error("discovery_openai_internal_error");
          } catch {
            // ignore
          }
        }
      }

      return NextResponse.json(
        {
          status: "insufficient_evidence",
          question,
          summary,
          sections: {
            observedEvidence: retrieval.sections.observedEvidence,
            interpretation: [],
            recommendations: [],
            unknowns: [unknown],
          },
          citations: retrieval.citations,
          stats: retrieval.stats,
          notes: [
            ...retrieval.notes,
            note,
            `Corpus source: ${corpusResult.source}`,
            ...corpusResult.notes,
          ],
        },
        { status: 200 },
      );
    }
  } catch {
    return NextResponse.json(
      {
        status: "insufficient_evidence",
        question: "",
        summary: "An error occurred while processing the request.",
        sections: {
          observedEvidence: [],
          interpretation: [],
          recommendations: [],
          unknowns: ["Internal error. No answer generated."],
        },
        citations: [],
        stats: EMPTY_STATS,
        notes: ["Error occurred; no evidence retrieved."],
      },
      { status: 500 },
    );
  }
}
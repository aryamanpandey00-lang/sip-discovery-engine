
import { describe, expect, it } from "vitest";
import { validateFeedbackRow } from "./feedback-validation";

const validSyntheticRow = {
  sourceType: "synthetic",
  sourceReference: null,
  capturedAt: "2026-10-23T10:00:00.000Z",
  text: "I find it difficult to understand my SIP status.",
  investorStage: "continuing_sip",
  consentStatus: "not_required",
  isSynthetic: true,
};

const validPublicDiscussionRow = {
  ...validSyntheticRow,
  sourceType: "public_discussion",
  sourceReference: "discussion-123",
  consentStatus: "not_required",
  isSynthetic: false,
};

const validInterviewRow = {
  ...validSyntheticRow,
  sourceType: "consented_interview",
  sourceReference: "interview-123",
  consentStatus: "obtained",
  isSynthetic: false,
};

const validSurveyRow = {
  ...validSyntheticRow,
  sourceType: "consented_survey",
  sourceReference: "survey-123",
  consentStatus: "obtained",
  isSynthetic: false,
};

describe("validateFeedbackRow", () => {
  it("accepts a valid synthetic row", () => {
    const result = validateFeedbackRow(validSyntheticRow);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.row?.text).toBe(
      "I find it difficult to understand my SIP status.",
    );
  });

  it("rejects a row that is not an object", () => {
    const result = validateFeedbackRow(null);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Row must be an object.");
  });

  it("rejects empty feedback text", () => {
    const result = validateFeedbackRow({
      ...validSyntheticRow,
      text: "   ",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("text must be a non-empty string.");
  });

  it("rejects an invalid source type", () => {
    const result = validateFeedbackRow({
      ...validSyntheticRow,
      sourceType: "unknown_source",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid sourceType.");
  });

  it("rejects interview data without obtained consent", () => {
    const result = validateFeedbackRow({
      ...validInterviewRow,
      consentStatus: "pending",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Consented research rows must have obtained consent.",
    );
  });

  it("rejects synthetic rows incorrectly marked as real", () => {
    const result = validateFeedbackRow({
      ...validSyntheticRow,
      isSynthetic: false,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Synthetic source rows must set isSynthetic to true.",
    );
  });

  it("accepts a public discussion with a source reference", () => {
    const result = validateFeedbackRow(validPublicDiscussionRow);

    expect(result.valid).toBe(true);
    expect(result.row?.sourceReference).toBe("discussion-123");
    expect(result.row?.consentStatus).toBe("not_required");
  });

  it("rejects public discussion without a source reference", () => {
    const result = validateFeedbackRow({
      ...validPublicDiscussionRow,
      sourceReference: null,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Non-synthetic source rows must have a non-empty sourceReference.",
    );
  });

  it("rejects a blank public discussion source reference", () => {
    const result = validateFeedbackRow({
      ...validPublicDiscussionRow,
      sourceReference: "   ",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Non-synthetic source rows must have a non-empty sourceReference.",
    );
  });

  it("rejects public discussion with an incorrect consent status", () => {
    const result = validateFeedbackRow({
      ...validPublicDiscussionRow,
      consentStatus: "pending",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Public discussion and synthetic rows must have consentStatus set to not_required.",
    );
  });

  it("accepts a consented interview with obtained consent", () => {
    const result = validateFeedbackRow(validInterviewRow);

    expect(result.valid).toBe(true);
    expect(result.row?.consentStatus).toBe("obtained");
  });

  it("accepts a consented survey with obtained consent", () => {
    const result = validateFeedbackRow(validSurveyRow);

    expect(result.valid).toBe(true);
    expect(result.row?.sourceType).toBe("consented_survey");
  });

  it("rejects an interview without a source reference", () => {
    const result = validateFeedbackRow({
      ...validInterviewRow,
      sourceReference: null,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Non-synthetic source rows must have a non-empty sourceReference.",
    );
  });

  it("rejects synthetic rows with an incorrect consent status", () => {
    const result = validateFeedbackRow({
      ...validSyntheticRow,
      consentStatus: "obtained",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Public discussion and synthetic rows must have consentStatus set to not_required.",
    );
  });

  it("trims source references and feedback text", () => {
    const result = validateFeedbackRow({
      ...validPublicDiscussionRow,
      sourceReference: "  discussion-123  ",
      text: "  Example feedback  ",
    });

    expect(result.valid).toBe(true);
    expect(result.row?.sourceReference).toBe("discussion-123");
    expect(result.row?.text).toBe("Example feedback");
  });
});

/**
 * Deterministic SIP relevance and theme classification.
 *
 * These rules are intentionally conservative and keyword-based. They are used
 * for eligibility checks and descriptive dashboard counts, not for causal
 * claims or prevalence estimates.
 */

interface Rule {
  label: string;
  pattern: RegExp;
}

const SIP_CONTEXT_RULES: Rule[] = [
  { label: "SIP", pattern: /\bsips?\b/ },
  {
    label: "Systematic investment",
    pattern: /\bsystematic investment\b/,
  },
  { label: "Mutual fund", pattern: /\bmutual funds?\b/ },
  {
    label: "Instalment",
    pattern: /\binstal(?:l)?ments?\b/,
  },
  {
    label: "Auto debit or mandate",
    pattern: /\bauto[-\s]?debit\b|\bautopay\b|\bmandate\b/,
  },
  { label: "NAV or folio", pattern: /\bnav\b|\bfolio\b/ },
  { label: "SIP calculator", pattern: /\bsip calculator\b/ },
];

const THEME_RULES: Array<Rule & { theme: string }> = [
  {
    theme: "Starting & onboarding",
    label: "Starting or first SIP",
    pattern:
      /\b(?:first|start|starts|started|starting|begin|began|beginning|new|onboard|onboarding|kyc|register|signup)\b/,
  },
  {
    theme: "Instalments & payments",
    label: "Instalment or payment",
    pattern:
      /\b(?:instal(?:l)?ments?|auto[-\s]?debit|autopay|mandate|payments?|debit(?:ed)?|fail(?:ed|s|ure)?|bounce(?:d)?|delay(?:ed)?)\b/,
  },
  {
    theme: "App usability & clarity",
    label: "App or clarity",
    pattern:
      /\b(?:app|apps|interface|confus(?:ed|ing|ion)?|difficult|hard|understand|understood|status|clear|clarity|navigate|navigation|track|tracking|screen)\b/,
  },
  {
    theme: "Trust & platform",
    label: "Trust or platform",
    pattern:
      /\b(?:trust|trusted|safe|scam|groww|support|service|security|secure|reliable)\b/,
  },
  {
    theme: "Market volatility",
    label: "Market or volatility",
    pattern:
      /\b(?:market|markets|fall|fallen|drop|dropped|volatil(?:e|ity)|loss|losses|risk|returns?)\b/,
  },
  {
    theme: "Pausing or stopping",
    label: "Pausing or stopping",
    pattern:
      /\b(?:pause|paused|stop|stopped|exit|exited|cancel|cancelled|canceled|withdraw|withdrew|discontinue|discontinued)\b/,
  },
  {
    theme: "Long-term continuation",
    label: "Continuation or long-term",
    pattern:
      /\b(?:continue|continued|continuing|long[-\s]?term|retain|retention|years?|goal|goals)\b/,
  },
  {
    theme: "Mutual fund basics",
    label: "Mutual fund basics",
    pattern: /\b(?:mutual funds?|nav|folio|compounding)\b/,
  },
];

export interface SipRelevanceAssessment {
  relevant: boolean;
  matchedTerms: string[];
  themes: string[];
}

function matchingLabels(text: string, rules: Rule[]): string[] {
  return rules
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => rule.label);
}

export function assessSipRelevance(text: string): SipRelevanceAssessment {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const matchedTerms = matchingLabels(normalized, SIP_CONTEXT_RULES);

  // "Monthly investing" is a reasonable fallback, but only when both ideas are
  // present. A generic mention of "investing" alone is not SIP-specific.
  const monthlyInvesting =
    /\b(monthly|every month|each month)\b/.test(normalized) &&
    /\binvest(?:ing|ed|ment|ments)?\b/.test(normalized);

  const relevant = matchedTerms.length > 0 || monthlyInvesting;

  if (!relevant) {
    return { relevant: false, matchedTerms: [], themes: [] };
  }

  const themes = Array.from(
    new Set(
      THEME_RULES.filter((rule) => rule.pattern.test(normalized)).map(
        (rule) => rule.theme,
      ),
    ),
  );

  return {
    relevant: true,
    matchedTerms:
      matchedTerms.length > 0 ? matchedTerms : ["Monthly investing"],
    themes: themes.length > 0 ? themes : ["Other SIP context"],
  };
}

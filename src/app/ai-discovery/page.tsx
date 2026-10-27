
"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import type { DiscoveryResponse } from "@/lib/discovery/types";

const navigation = [
  { label: "Overview", icon: "◫", href: "/" },
  { label: "Feedback Import", icon: "▤", href: "/feedback-import" },
  { label: "AI Discovery", icon: "✳", href: "/ai-discovery", active: true },
  { label: "Themes", icon: "◇", href: "#", disabled: true },
  { label: "Segments", icon: "⌘", href: "#", disabled: true },
  { label: "Opportunities", icon: "↗", href: "#", disabled: true },
];

const exampleQuestions = [
  "What are the main reasons first-time SIP investors hesitate to start?",
  "Why do SIP instalments fail and how can investors avoid them?",
  "What concerns do investors have about trust when using Groww?",
  "What leads investors to pause or stop their SIPs?",
  "What causes confusion for new mutual fund investors?",
];

export default function AiDiscoveryPage() {
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DiscoveryResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const response = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const data = (await response.json()) as DiscoveryResponse;

      if (!response.ok) {
        setError(
          "The discovery request could not be completed. Please try again.",
        );
        return;
      }

      setResult(data);
    } catch {
      setError("Failed to contact the discovery API.");
    } finally {
      setLoading(false);
    }
  }

  function clearQuestion() {
    setQuestion("");
    setSubmitted(false);
    setLoading(false);
    setError("");
    setResult(null);
  }

  return (
    <main className="min-h-screen bg-[#f7f9f7] text-[#17231b]">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[250px] border-r border-[#e6ebe6] bg-white lg:flex lg:flex-col">
        <div className="flex h-[76px] items-center gap-3 border-b border-[#edf0ed] px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00b368] text-xl font-bold text-white">
            S
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-tight">
              SIP Discovery
            </p>
            <p className="mt-0.5 text-xs text-[#7b887e]">
              Investor insights
            </p>
          </div>
        </div>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.16em] text-[#879188]">
            WORKSPACE
          </p>
          <nav aria-label="Main navigation" className="space-y-1">
            {navigation.map((item) => {
              if (item.disabled) {
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] font-medium text-[#9aa49c] opacity-60"
                    aria-disabled="true"
                  >
                    <span
                      aria-hidden="true"
                      className="w-5 text-center text-lg"
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </div>
                );
              }

              const isActive = item.active;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] font-medium ${
                    isActive
                      ? "bg-[#eaf8ef] text-[#078746]"
                      : "text-[#68756b] hover:bg-[#f6f9f6]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="w-5 text-center text-lg"
                  >
                    {item.icon}
                  </span>
                  {item.label}
                  {item.label === "AI Discovery" && (
                    <span className="ml-auto rounded-md bg-[#e9f7ed] px-1.5 py-1 text-[9px] font-bold text-[#078746]">
                      AI
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-xl border border-[#e6ece6] bg-[#fafcfa] p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#078746]" />
              <p className="text-xs font-semibold">Data policy</p>
            </div>
            <p className="text-xs leading-5 text-[#78847a]">
              Production evidence is loaded from data/real-reviews.csv.
              Synthetic and evaluation data are excluded; missing evidence
              fails closed. Non-synthetic status alone does not establish
              source authenticity.
            </p>
          </div>
          <p className="px-1 pt-4 text-[10px] text-[#9aa49c]">
            SIP Discovery Engine · Local prototype
          </p>
        </div>
      </aside>

      <div className="lg:pl-[250px]">
        <header className="flex min-h-[76px] items-center justify-between border-b border-[#e6ebe6] bg-white px-5 sm:px-8">
          <div>
            <p className="text-xs text-[#7c897e]">
              Workspace / AI Discovery
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight">
              AI Discovery
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-[#e5ebe5] px-3 py-1.5 text-xs text-[#6b786e] sm:inline-flex">
              Evidence-led research
            </span>
            <div
              aria-label="User profile placeholder"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e6f5eb] text-sm font-semibold text-[#078746]"
            >
              R
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1100px] p-5 sm:p-8">
          <section className="mb-8">
            <p className="text-sm font-medium text-[#078746]">
              GROWW SIP AI DISCOVERY ENGINE
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[30px]">
              Ask grounded questions about SIP investors
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#738076]">
              Answers are based only on available research data. Evidence
              should be traceable to source type, platform, provenance
              locator, capture date, and supporting themes. Traceability
              does not by itself verify source authenticity.
            </p>
          </section>

          <section className="rounded-xl border border-[#e5ebe5] bg-white p-6">
            <h3 className="text-base font-semibold">Question</h3>
            <p className="mt-1 text-sm text-[#738076]">
              Ask about starting a first SIP, failed instalments, app
              usability, trust, investment confusion, pausing, or long-term
              continuation.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="discovery-question" className="sr-only">
                  Your question
                </label>
                <textarea
                  id="discovery-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="e.g. What are common reasons people stop their SIPs?"
                  className="w-full rounded-lg border border-[#dce5dc] px-4 py-3 text-sm leading-6 text-[#17231b] shadow-sm focus:border-[#078746] focus:outline-none focus:ring-1 focus:ring-[#078746]"
                  rows={4}
                  required
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="rounded-lg bg-[#078746] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#067a3d] focus:outline-none focus:ring-2 focus:ring-[#078746] focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Retrieving evidence..." : "Submit question"}
                </button>
                <button
                  type="button"
                  onClick={clearQuestion}
                  className="rounded-lg border border-[#dce5dc] px-4 py-2.5 text-sm font-medium text-[#526256] hover:bg-[#f6f9f6]"
                >
                  Clear
                </button>
              </div>
            </form>

            <div className="mt-6">
              <p className="text-xs font-semibold text-[#526256]">
                Example questions
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {exampleQuestions.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setQuestion(example);
                      setSubmitted(false);
                      setError("");
                      setResult(null);
                    }}
                    className="rounded-full border border-[#dce5dc] px-3 py-1.5 text-xs text-[#526256] hover:border-[#078746] hover:text-[#078746]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-xl border border-[#e5ebe5] bg-white p-6">
            <h3 className="text-base font-semibold">Evidence &amp; Answer</h3>
            <p className="mt-1 text-sm text-[#738076]">
              Retrieved evidence displays source type, platform, provenance
              locator, capture date, themes, and supporting snippets when
              available.
            </p>
            <p className="mt-2 text-xs text-[#738076]">
              Corpus: the server loads data from data/real-reviews.csv.
              Missing or ineligible data fails closed; synthetic and
              evaluation data are not used as fallbacks.
            </p>

            <div
              aria-live="polite"
              aria-busy={loading}
              className="mt-5 rounded-lg border border-dashed border-[#dce5dc] bg-[#fafcfa] p-6"
            >
              {!submitted ? (
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#8a978b] shadow-sm">
                    <span aria-hidden="true" className="text-xl">
                      ⌕
                    </span>
                  </div>
                  <h4 className="mt-4 text-sm font-semibold">
                    No question submitted yet
                  </h4>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#7b887e]">
                    Ask a question above to see evidence-backed answers.
                    Results appear only when the available corpus contains
                    eligible evidence for the question.
                  </p>
                </div>
              ) : loading ? (
                <div className="text-center">
                  <p className="text-sm text-[#526256]">
                    Retrieving evidence...
                  </p>
                </div>
              ) : error ? (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-4"
                >
                  <p className="text-sm font-semibold text-red-900">
                    Error
                  </p>
                  <p className="mt-1 text-xs leading-5 text-red-800">
                    {error}
                  </p>
                </div>
              ) : result ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[#e5ebe5] bg-white p-4">
                    <p className="text-sm font-semibold">
                      Status:{" "}
                      {result.status === "ok"
                        ? "Evidence found"
                        : "Insufficient evidence"}
                    </p>
                    <p className="mt-1 text-sm text-[#526256]">
                      {result.summary}
                    </p>
                    <p className="mt-2 text-xs text-[#738076]">
                      Retrieved: {result.stats.totalRetrieved} | Non-synthetic:{" "}
                      {result.stats.totalNonSynthetic} | Synthetic:{" "}
                      {result.stats.totalSynthetic}
                    </p>
                    <p className="mt-1 text-xs text-[#738076]">
                      Non-synthetic means records are not marked as synthetic
                      in the dataset; it does not mean their authenticity has
                      been independently verified.
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#e5ebe5] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#879188]">
                      Observed evidence
                    </p>
                    {result.sections.observedEvidence.length === 0 ? (
                      <p className="mt-2 text-sm text-[#738076]">
                        No evidence snippets retrieved.
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-[#edf0ed]">
                        {result.sections.observedEvidence.map((evidence) => (
                          <li key={evidence.id} className="py-3">
                            <p className="text-sm leading-6">
                              {evidence.snippet}
                            </p>
                            <p className="mt-2 text-xs text-[#738076]">
                              {evidence.sourceType.replaceAll("_", " ")}
                              {evidence.platform
                                ? ` · ${evidence.platform}`
                                : ""}
                              {evidence.sourceReference
                                ? ` · ${evidence.sourceReference}`
                                : ""}
                              {evidence.sourceRecordId
                                ? ` · record ${evidence.sourceRecordId}`
                                : ""}
                              {` · ${evidence.capturedAt}`}
                              {evidence.isSynthetic
                                ? " · Synthetic (labeled)"
                                : " · Not marked synthetic"}
                            </p>
                            <p className="mt-1 text-xs text-[#738076]">
                              Provenance:{" "}
                              {evidence.sourceUrl ??
                                evidence.sourceReference ??
                                "missing"}
                            </p>
                            <p className="mt-1 text-xs text-[#738076]">
                              Themes: {evidence.themes.join(", ")}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-[#e5ebe5] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#879188]">
                        Interpretation
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-[#526256]">
                        {result.sections.interpretation.length === 0 ? (
                          <li>—</li>
                        ) : (
                          result.sections.interpretation.map(
                            (interpretation, index) => (
                              <li key={`${index}-${interpretation}`}>
                                • {interpretation}
                              </li>
                            ),
                          )
                        )}
                      </ul>
                    </div>

                    <div className="rounded-lg border border-[#e5ebe5] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#879188]">
                        Recommendations
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-[#526256]">
                        {result.sections.recommendations.length === 0 ? (
                          <li>—</li>
                        ) : (
                          result.sections.recommendations.map(
                            (recommendation, index) => (
                              <li key={`${index}-${recommendation}`}>
                                • {recommendation}
                              </li>
                            ),
                          )
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#e5ebe5] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#879188]">
                      Unknowns
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-[#526256]">
                      {result.sections.unknowns.length === 0 ? (
                        <li>—</li>
                      ) : (
                        result.sections.unknowns.map((unknown, index) => (
                          <li key={`${index}-${unknown}`}>• {unknown}</li>
                        ))
                      )}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-[#e5ebe5] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#879188]">
                      Citations (retrieved evidence only)
                    </p>
                    {result.citations.length === 0 ? (
                      <p className="mt-2 text-sm text-[#738076]">
                        No citations.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-xs text-[#738076]">
                        {result.citations.map((citation) => (
                          <li key={citation.evidenceId}>
                            {citation.evidenceId} —{" "}
                            {citation.sourceType.replaceAll("_", " ")}
                            {citation.platform
                              ? ` via ${citation.platform}`
                              : ""}
                            {citation.sourceReference
                              ? ` (${citation.sourceReference})`
                              : ""}
                            {citation.sourceRecordId
                              ? ` [record ${citation.sourceRecordId}]`
                              : ""}
                            {` — ${citation.capturedAt}`}
                            {citation.isSynthetic
                              ? " — Synthetic (labeled)"
                              : " — Not marked synthetic"}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-lg border border-[#e5ebe5] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#879188]">
                      Notes
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-[#738076]">
                      {result.notes.length === 0 ? (
                        <li>—</li>
                      ) : (
                        result.notes.map((note, index) => (
                          <li key={`${index}-${note}`}>• {note}</li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

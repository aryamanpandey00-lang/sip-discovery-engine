"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ingestFeedbackCsv } from "@/lib/domain/ingestion-service";
import type { CsvImportResult } from "@/lib/domain/csv-import";
import type { FeedbackRecord } from "@/lib/domain/feedback";
import {
  ELIGIBLE_CSV_HEADERS,
  buildCsvTemplate,
  buildReviewStaging,
  toEligibleCsv,
  type StagedFeedbackRecord,
} from "@/lib/domain/review-staging";

function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function TriggerDownload({
  label,
  filename,
  content,
  disabled,
}: {
  label: string;
  filename: string;
  content: string;
  disabled?: boolean;
}) {
  function handleClick() {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="rounded-full border border-[#cfdcd1] bg-white px-4 py-2.5 text-sm font-semibold text-[#2d3d31] transition hover:border-[#9ab39f] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function RecordProvenance({ item }: { item: StagedFeedbackRecord }) {
  const record = item.record;
  if (!record) {
    return null;
  }

  return (
    <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs leading-5 text-[#708074] sm:grid-cols-2">
      <div>
        <dt className="inline font-semibold text-[#536356]">Source: </dt>
        <dd className="inline">
          {formatLabel(record.sourceType)} · {record.platform ?? "no platform"}
        </dd>
      </div>
      <div>
        <dt className="inline font-semibold text-[#536356]">Captured: </dt>
        <dd className="inline">{record.capturedAt}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="inline font-semibold text-[#536356]">Reference: </dt>
        <dd className="inline break-all">
          {record.sourceUrl ?? record.sourceReference ?? "missing"}
          {record.sourceRecordId ? ` · ${record.sourceRecordId}` : ""}
        </dd>
      </div>
      <div>
        <dt className="inline font-semibold text-[#536356]">AI use: </dt>
        <dd className="inline">{record.aiUsePermission ?? "unknown"}</dd>
      </div>
      <div>
        <dt className="inline font-semibold text-[#536356]">Retention: </dt>
        <dd className="inline">{record.retentionPermission ?? "unknown"}</dd>
      </div>
    </dl>
  );
}

function StagedRecordCard({
  item,
  tone,
}: {
  item: StagedFeedbackRecord;
  tone: "eligible" | "review";
}) {
  return (
    <li
      className={`rounded-xl border p-4 ${
        tone === "eligible"
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-amber-200 bg-amber-50/40"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#657568]">
          Row {item.rowNumber}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            tone === "eligible"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {tone === "eligible" ? "Eligible" : "Needs review"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#2d3d31]">
        {item.record?.text}
      </p>
      <RecordProvenance item={item} />
      {item.themes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.themes.map((theme) => (
            <span
              key={theme}
              className="rounded-full bg-white/80 px-2.5 py-1 text-xs text-[#536356] ring-1 ring-[#dce6dd]"
            >
              {theme}
            </span>
          ))}
        </div>
      )}
      {item.reasons.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-[#8a4b0f]">
          {item.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function FeedbackImportPage() {
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [error, setError] = useState("");
  const [isReading, setIsReading] = useState(false);

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    setResult(null);
    setError("");
    setFileName("");

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a CSV file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("The file must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setFileName(file.name);
    setIsReading(true);

    try {
      const csvText = await file.text();
      // Production staging is always real-corpus mode. Synthetic rows are
      // rejected here rather than being normalized into production feedback.
      const importResult = ingestFeedbackCsv(csvText, { realCorpus: true });
      setResult(importResult);
    } catch {
      setError(
        "We couldn't read this file. Please check the CSV and try again.",
      );
    } finally {
      setIsReading(false);
    }
  }

  const staging = useMemo(
    () => (result ? buildReviewStaging(result) : null),
    [result],
  );

  const eligibleCsv = useMemo(() => {
    if (!staging) return buildCsvTemplate();
    return toEligibleCsv(
      staging.eligible
        .map((item) => item.record)
        .filter((record): record is FeedbackRecord => record !== null),
    );
  }, [staging]);

  return (
    <main className="min-h-screen bg-[#f7f9f7] px-5 py-8 text-[#17231b] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <Link
            href="/"
            className="text-sm font-medium text-[#078746] hover:underline"
          >
            ← Back to overview
          </Link>

          <p className="mt-6 text-xs font-semibold tracking-[0.16em] text-[#078746]">
            PRODUCTION REVIEW STAGING
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Stage a real feedback CSV
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#738076]">
            This workflow validates structure, source metadata, SIP relevance,
            AI-use permission, retention permission, and provenance before a
            record can be exported as eligible. Import runs in real-corpus mode:
            synthetic sample rows and the 50-record evaluation dataset are never
            accepted as production evidence. Nothing is written to a database.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <TriggerDownload
              label="Download empty CSV template"
              filename="real-reviews-template.csv"
              content={buildCsvTemplate()}
            />
            <Link
              href="/"
              className="rounded-full border border-[#cfdcd1] bg-white px-4 py-2.5 text-sm font-semibold text-[#2d3d31] transition hover:border-[#9ab39f]"
            >
              View corpus dashboard
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-[#e5ebe5] bg-white p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-base font-semibold">Choose a CSV file</h2>
              <p className="mt-2 text-sm leading-6 text-[#738076]">
                Maximum file size: 5 MB. Structural import requires the core
                columns; production eligibility additionally checks permissions,
                platform, provenance, and SIP relevance. The staged/export
                schema is:{" "}
                <span className="font-mono text-xs text-[#526256]">
                  {ELIGIBLE_CSV_HEADERS.join(", ")}
                </span>
              </p>
            </div>
            <span className="rounded-xl border border-[#dce6dd] bg-[#fafcfa] px-3 py-2 text-xs font-medium text-[#657568]">
              Local browser validation · no persistence
            </span>
          </div>

          <label
            htmlFor="feedback-csv"
            className="mt-5 block cursor-pointer rounded-xl border border-dashed border-[#cbd8cc] bg-[#fafcfa] p-8 text-center hover:border-[#078746]"
          >
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eaf8ef] text-xl text-[#078746]">
              ↑
            </span>

            <span className="mt-3 block text-sm font-semibold">
              Select a CSV file
            </span>

            <span className="mt-1 block text-xs text-[#7b887e]">
              Choose a file from your computer
            </span>

            <input
              id="feedback-csv"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>

          {fileName && (
            <p className="mt-4 text-sm text-[#526256]" role="status">
              Selected: <strong>{fileName}</strong>
            </p>
          )}

          {isReading && (
            <p className="mt-4 text-sm text-[#526256]" role="status">
              Reading, validating, and staging CSV...
            </p>
          )}

          {error && (
            <p
              className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
        </section>

        {staging && (
          <>
            <section
              aria-label="Staging summary"
              className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5"
            >
              {[
                { label: "Input rows", value: staging.totalRows },
                { label: "Eligible", value: staging.counts.eligible },
                { label: "Needs review", value: staging.counts.needsReview },
                { label: "Rejected", value: staging.counts.rejected },
                { label: "Duplicates", value: staging.counts.duplicates },
              ].map((metric) => (
                <article
                  key={metric.label}
                  className="rounded-xl border border-[#e5ebe5] bg-white p-5"
                >
                  <p className="text-sm text-[#738076]">{metric.label}</p>
                  <p className="mt-3 text-3xl font-semibold">
                    {metric.value.toLocaleString("en-IN")}
                  </p>
                </article>
              ))}
            </section>

            <section className="mt-6 rounded-2xl border border-[#e5ebe5] bg-white p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657568]">
                    Export outcome
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">
                    {staging.counts.eligible > 0
                      ? `${staging.counts.eligible} row(s) are production-eligible.`
                      : "No rows are production-eligible yet."}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#738076]">
                    {staging.counts.eligible > 0
                      ? "The export contains only eligible rows, and the policy is re-checked during export. Save the file as data/real-reviews.csv and restart or redeploy to activate it."
                      : "This empty state is intentional. Fix the blockers below and re-import; the app will not invent or substitute evidence."}
                  </p>
                </div>
                <TriggerDownload
                  label="Download eligible CSV"
                  filename="real-reviews.eligible.csv"
                  content={eligibleCsv}
                  disabled={staging.counts.eligible === 0}
                />
              </div>
            </section>

            {staging.eligible.length > 0 && (
              <section className="mt-6 rounded-2xl border border-[#e5ebe5] bg-white p-6">
                <h2 className="text-base font-semibold">Eligible records</h2>
                <p className="mt-2 text-sm leading-6 text-[#738076]">
                  These records pass every gate and are the only records that can
                  enter production retrieval.
                </p>
                <ul className="mt-4 space-y-3">
                  {staging.eligible.map((item) => (
                    <StagedRecordCard
                      key={`${item.rowNumber}-${item.record?.contentHash ?? ""}`}
                      item={item}
                      tone="eligible"
                    />
                  ))}
                </ul>
              </section>
            )}

            {staging.needsReview.length > 0 && (
              <section className="mt-6 rounded-2xl border border-[#e5ebe5] bg-white p-6">
                <h2 className="text-base font-semibold">Needs review</h2>
                <p className="mt-2 text-sm leading-6 text-[#738076]">
                  These rows were structurally accepted but are not eligible.
                  Resolve every listed blocker before exporting.
                </p>
                <ul className="mt-4 space-y-3">
                  {staging.needsReview.map((item) => (
                    <StagedRecordCard
                      key={`${item.rowNumber}-${item.record?.contentHash ?? ""}`}
                      item={item}
                      tone="review"
                    />
                  ))}
                </ul>
              </section>
            )}

            {staging.rejected.length > 0 && (
              <section className="mt-6 rounded-2xl border border-[#e5ebe5] bg-white p-6">
                <h2 className="text-base font-semibold">Rejected rows</h2>
                <p className="mt-2 text-sm leading-6 text-[#738076]">
                  Rejected rows are excluded from evidence and export.
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#e5ebe5] text-xs text-[#738076]">
                        <th className="px-3 py-3 font-medium">Row</th>
                        <th className="px-3 py-3 font-medium">Reason codes</th>
                        <th className="px-3 py-3 font-medium">Validation messages</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staging.rejected.map((item) => (
                        <tr
                          key={item.rowNumber}
                          className="border-b border-[#edf0ed] last:border-0"
                        >
                          <td className="px-3 py-3">{item.rowNumber}</td>
                          <td className="px-3 py-3 text-xs">
                            {item.reasonCodes.join(", ") || "—"}
                          </td>
                          <td className="px-3 py-3 text-xs text-[#8a4b0f]">
                            {item.reasons.join(" ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {staging.duplicates.length > 0 && (
              <section className="mt-6 rounded-2xl border border-[#e5ebe5] bg-white p-6">
                <h2 className="text-base font-semibold">Duplicates</h2>
                <p className="mt-2 text-sm leading-6 text-[#738076]">
                  Duplicate content is counted once and these rows are ignored.
                </p>
                <p className="mt-3 text-sm text-[#526256]">
                  Rows:{" "}
                  {staging.duplicates
                    .map((item) => item.rowNumber)
                    .join(", ")}
                </p>
              </section>
            )}

            <section className="mt-6 rounded-2xl border border-[#e5ebe5] bg-white p-6">
              <h2 className="text-base font-semibold">Activation is manual</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#738076]">
                The app does not write files, run migrations, or persist this
                upload. After exporting eligible rows, place the file at{" "}
                <span className="font-mono text-xs text-[#526256]">
                  data/real-reviews.csv
                </span>{" "}
                and restart or redeploy. The dashboard and discovery API will
                re-read that file and fail closed if it contains no eligible
                records.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

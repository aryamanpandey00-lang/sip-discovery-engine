
"use client";

import { useState } from "react";
import Link from "next/link";
import { ingestFeedbackCsv } from "@/lib/domain/ingestion-service";
import type { CsvImportResult } from "@/lib/domain/csv-import";

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
      const importResult = ingestFeedbackCsv(csvText);
      setResult(importResult);
    } catch {
      setError(
        "We couldn't read this file. Please check the CSV and try again.",
      );
    } finally {
      setIsReading(false);
    }
  }

  const acceptedCount = result?.rows.length ?? 0;
  const rejectedCount =
    result?.audit.filter((entry) => entry.outcome === "rejected").length ?? 0;
  const duplicateCount = result?.duplicateRows.length ?? 0;

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
            RESEARCH DATA FOUNDATION
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Import feedback
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#738076]">
            Preview permitted public feedback, consented research, or synthetic
            records. Validation and duplicate checks run locally in this
            browser session. No records are saved to a database.
          </p>
        </header>

        <section className="rounded-xl border border-[#e5ebe5] bg-white p-6">
          <h2 className="text-base font-semibold">Choose a CSV file</h2>

          <p className="mt-2 text-sm leading-6 text-[#738076]">
            Maximum file size: 5 MB. The CSV must contain the required
            feedback columns.
          </p>

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
              Reading and validating CSV...
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

        {result && (
          <>
            <section
              aria-label="Import summary"
              className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {[
                { label: "Input records", value: result.totalRows },
                { label: "Accepted", value: acceptedCount },
                { label: "Rejected", value: rejectedCount },
                { label: "Duplicates", value: duplicateCount },
              ].map((metric) => (
                <article
                  key={metric.label}
                  className="rounded-xl border border-[#e5ebe5] bg-white p-5"
                >
                  <p className="text-sm text-[#738076]">{metric.label}</p>
                  <p className="mt-3 text-3xl font-semibold">
                    {metric.value}
                  </p>
                </article>
              ))}
            </section>

            <section className="mt-6 rounded-xl border border-[#e5ebe5] bg-white p-6">
              <h2 className="text-base font-semibold">Row audit preview</h2>

              <p className="mt-2 text-sm text-[#738076]">
                Audit outcomes are temporary and available only in this
                preview. Nothing has been persisted.
              </p>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#e5ebe5] text-xs text-[#738076]">
                      <th className="px-3 py-3 font-medium">Row</th>
                      <th className="px-3 py-3 font-medium">Outcome</th>
                      <th className="px-3 py-3 font-medium">Reason codes</th>
                      <th className="px-3 py-3 font-medium">Content hash</th>
                    </tr>
                  </thead>

                  <tbody>
                    {result.audit.map((entry) => (
                      <tr
                        key={entry.rowNumber}
                        className="border-b border-[#edf0ed] last:border-0"
                      >
                        <td className="px-3 py-3">{entry.rowNumber}</td>
                        <td className="px-3 py-3 capitalize">
                          {entry.outcome}
                        </td>
                        <td className="px-3 py-3">
                          {entry.reasonCodes.join(", ") || "—"}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          {entry.contentHash
                            ? `${entry.contentHash.slice(0, 12)}…`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-6 rounded-xl border border-[#e5ebe5] bg-white p-6">
              <h2 className="text-base font-semibold">
                Accepted record preview
              </h2>

              <p className="mt-2 text-sm text-[#738076]">
                Review the normalized text and source type before any future
                persistence step.
              </p>

              {result.rows.length === 0 ? (
                <p className="mt-4 text-sm text-[#738076]">
                  No records were accepted.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-[#edf0ed]">
                  {result.rows.map((row) => (
                    <li key={row.contentHash} className="py-4">
                      <p className="text-sm leading-6">{row.text}</p>
                      <p className="mt-2 text-xs text-[#738076]">
                        {row.sourceType.replaceAll("_", " ")} ·{" "}
                        {row.investorStage.replaceAll("_", " ")} ·{" "}
                        {row.capturedAt}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

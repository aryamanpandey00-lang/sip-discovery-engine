import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { loadCorpusFromCsv } from "@/lib/discovery/corpus";
import {
  buildCorpusDashboard,
  type CorpusBreakdownItem,
  type CorpusDashboardData,
  type CorpusReadinessStatus,
} from "@/lib/discovery/corpus-dashboard";

const navigation = [
  { label: "Overview", icon: "◫", href: "/", active: true },
  { label: "Feedback Import", icon: "▤", href: "/feedback-import", active: false },
  { label: "AI Discovery", icon: "✳", href: "/ai-discovery", active: false },
  { label: "Themes", icon: "◇", href: "#", active: false, disabled: true },
  { label: "Segments", icon: "⌘", href: "#", active: false, disabled: true },
  { label: "Opportunities", icon: "↗", href: "#", active: false, disabled: true },
];

const statusStyles: Record<
  CorpusReadinessStatus,
  { dot: string; badge: string; panel: string }
> = {
  missing: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    panel: "border-amber-200 bg-amber-50/60",
  },
  empty: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    panel: "border-amber-200 bg-amber-50/60",
  },
  invalid: {
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-800 ring-rose-200",
    panel: "border-rose-200 bg-rose-50/60",
  },
  needs_review: {
    dot: "bg-sky-500",
    badge: "bg-sky-50 text-sky-800 ring-sky-200",
    panel: "border-sky-200 bg-sky-50/60",
  },
  ready: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    panel: "border-emerald-200 bg-emerald-50/60",
  },
};

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-[#dce6dd] bg-white p-5 shadow-[0_1px_2px_rgba(23,35,27,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657568]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#17231b]">
        {value.toLocaleString("en-IN")}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#6d7d70]">{note}</p>
    </div>
  );
}

function BreakdownList({
  items,
  emptyLabel,
}: {
  items: CorpusBreakdownItem[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#dce6dd] bg-[#fbfcfb] px-4 py-5 text-sm text-[#6d7d70]">
        {emptyLabel}
      </p>
    );
  }

  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <ul className="space-y-4">
      {items.slice(0, 8).map((item) => (
        <li key={item.label}>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-medium text-[#2d3d31]">{item.label}</span>
            <span className="text-[#657568]">{item.count}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf2ee]">
            <div
              className="h-full rounded-full bg-[#2f7d4a]"
              style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function PolicyRow({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex gap-3 border-b border-[#edf2ee] py-3 last:border-b-0">
      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
        ✓
      </span>
      <div>
        <p className="text-sm font-semibold text-[#2d3d31]">{label}</p>
        <p className="mt-0.5 text-sm leading-6 text-[#6d7d70]">{detail}</p>
      </div>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-36 animate-pulse rounded-3xl border border-[#dce6dd] bg-white" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-2xl border border-[#dce6dd] bg-white"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-3xl border border-[#dce6dd] bg-white" />
    </div>
  );
}

function ReadinessPanel({ dashboard }: { dashboard: CorpusDashboardData }) {
  const styles = statusStyles[dashboard.status];
  const hasEvidence = dashboard.counts.eligible > 0;

  return (
    <div className="space-y-6">
      <section className={`rounded-3xl border p-6 sm:p-8 ${styles.panel}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${styles.badge}`}
              >
                <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
                {dashboard.statusLabel}
              </span>
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-[#657568]">
                {dashboard.corpusFile}
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-[#17231b]">
              {hasEvidence
                ? "Production evidence is available for discovery."
                : "No production evidence is available yet."}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[#536356]">
              {dashboard.statusDescription}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/feedback-import"
              className="rounded-full bg-[#1f6a3d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#185831]"
            >
              Review a CSV
            </Link>
            <Link
              href="/ai-discovery"
              className="rounded-full border border-[#cfdcd1] bg-white/80 px-4 py-2.5 text-sm font-semibold text-[#2d3d31] transition hover:border-[#9ab39f]"
            >
              Open discovery
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Eligible records"
          value={dashboard.counts.eligible}
          note="Genuine, SIP-relevant records that pass every production check."
        />
        <MetricCard
          label="Staged for review"
          value={dashboard.counts.needsReview}
          note="Accepted structurally, but ineligible until missing requirements are fixed."
        />
        <MetricCard
          label="Rejected rows"
          value={dashboard.counts.rejected}
          note="Invalid, synthetic, or disallowed rows excluded from all counts."
        />
        <MetricCard
          label="Duplicates"
          value={dashboard.counts.duplicates}
          note="Repeated content ignored during import."
        />
      </section>

      {!hasEvidence ? (
        <section className="rounded-3xl border border-[#dce6dd] bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#657568]">
                Empty state
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#17231b]">
                There are no genuine, eligible investor reviews to show.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-[#6d7d70]">
                The dashboard does not fill this gap with sample feedback, synthetic
                records, or the evaluation dataset. Import a real CSV and resolve the
                blockers below before discovery can cite evidence.
              </p>
            </div>
            <span className="rounded-xl border border-dashed border-[#cfdcd1] px-3 py-2 text-xs font-medium text-[#657568]">
              Fail-closed by design
            </span>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-[#2d3d31]">
                Open eligibility blockers
              </h3>
              <div className="mt-3">
                <BreakdownList
                  items={dashboard.eligibilityReasons}
                  emptyLabel="No staged rows are waiting on eligibility fixes."
                />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#2d3d31]">
                Recent rejection reasons
              </h3>
              <div className="mt-3">
                <BreakdownList
                  items={dashboard.rejectionMessages}
                  emptyLabel="No rejected rows in the current corpus file."
                />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-[#dce6dd] bg-white p-6 sm:p-8">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#657568]">
                  Source breakdown
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#17231b]">
                  Eligible evidence by source
                </h2>
              </div>
              <span className="text-sm text-[#657568]">
                {dashboard.counts.eligible} record(s)
              </span>
            </div>
            <div className="mt-6">
              <BreakdownList
                items={dashboard.sourceBreakdown}
                emptyLabel="No source metadata is available."
              />
            </div>
          </div>

          <div className="rounded-3xl border border-[#dce6dd] bg-white p-6 sm:p-8">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#657568]">
                  SIP themes
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#17231b]">
                  Keyword themes in eligible text
                </h2>
              </div>
              <span className="text-sm text-[#657568]">
                {dashboard.themeBreakdown.length} theme(s)
              </span>
            </div>
            <div className="mt-6">
              <BreakdownList
                items={dashboard.themeBreakdown}
                emptyLabel="No eligible SIP themes are available."
              />
            </div>
            <p className="mt-5 text-xs leading-5 text-[#7b8a7d]">
              Theme counts are descriptive keyword matches across eligible records. They
              are not prevalence estimates, model findings, or causal evidence.
            </p>
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-[#dce6dd] bg-white p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#657568]">
            Eligibility policy
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#17231b]">
            What a record must pass before it counts
          </h2>
          <div className="mt-4">
            <PolicyRow
              label="CSV structure and source metadata"
              detail="Required columns, valid source type, source reference, platform, and capturedAt timestamp."
            />
            <PolicyRow
              label="SIP relevance"
              detail="Text must clearly mention SIP, mutual funds, instalments, or monthly investing. Generic feedback stays staged."
            />
            <PolicyRow
              label="AI-use and retention permission"
              detail="Both permissions must be explicitly permitted. Unknown or not-permitted values are ineligible."
            />
            <PolicyRow
              label="Usable provenance"
              detail="A sourceUrl, sourceRecordId, or URL in sourceReference must point back to the original record."
            />
            <PolicyRow
              label="Genuine data only"
              detail="Synthetic sample rows and the FinLit Q&A evaluation dataset never enter production retrieval or dashboard counts."
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-[#dce6dd] bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#657568]">
              Evidence limitations
            </p>
            <ul className="mt-4 space-y-3">
              {dashboard.limitations.map((limitation) => (
                <li
                  key={limitation}
                  className="flex gap-3 text-sm leading-6 text-[#536356]"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8aa38f]" />
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-[#dce6dd] bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#657568]">
              Corpus notes
            </p>
            <ul className="mt-4 space-y-3">
              {dashboard.notes.map((note) => (
                <li
                  key={note}
                  className="flex gap-3 text-sm leading-6 text-[#536356]"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b5c7b8]" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#dce6dd] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#657568]">
              Next step
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#17231b]">
              {hasEvidence
                ? "Ask a research question against eligible evidence."
                : "Stage a real CSV, resolve blockers, and export eligible rows."}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#6d7d70]">
              {hasEvidence
                ? "Discovery retrieves only the eligible records counted here and cites each source."
                : "The import page reports eligible, staged, rejected, and duplicate rows without writing to the database."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={hasEvidence ? "/ai-discovery" : "/feedback-import"}
              className="rounded-full bg-[#1f6a3d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#185831]"
            >
              {hasEvidence ? "Run AI Discovery" : "Open Review Staging"}
            </Link>
            <Link
              href="/feedback-import"
              className="rounded-full border border-[#cfdcd1] px-4 py-2.5 text-sm font-semibold text-[#2d3d31] transition hover:border-[#9ab39f]"
            >
              Import workflow
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

async function CorpusDashboard() {
  await connection();
  const corpus = await loadCorpusFromCsv();
  const dashboard = buildCorpusDashboard(corpus);
  return <ReadinessPanel dashboard={dashboard} />;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f9f7] text-[#17231b]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-[#dfe8e1] bg-[#f2f6f2] px-5 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1f6a3d] text-lg font-bold text-white">
            G
          </div>
          <div>
            <p className="text-sm font-semibold leading-5 text-[#17231b]">Groww Research</p>
            <p className="text-xs text-[#708074]">SIP Discovery Engine</p>
          </div>
        </div>

        <nav className="mt-10 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-disabled={item.disabled}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                item.active
                  ? "bg-white text-[#1f6a3d] shadow-sm"
                  : item.disabled
                    ? "cursor-default text-[#a1afa4]"
                    : "text-[#536356] hover:bg-white/70 hover:text-[#1f6a3d]"
              }`}
            >
              <span className="w-4 text-center text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 rounded-2xl border border-[#dce6dd] bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#708074]">
            Research status
          </p>
          <p className="mt-2 text-sm leading-6 text-[#536356]">
            Readiness reflects data/real-reviews.csv only. Synthetic and evaluation
            data are excluded.
          </p>
        </div>

        <div className="mt-auto rounded-2xl bg-[#e6efe7] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#55705b]">
            Development environment
          </p>
          <p className="mt-2 text-xs leading-5 text-[#6d7d70]">
            Local corpus files and in-browser staging. No database writes.
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-[#dfe8e1] bg-[#f7f9f7]/90 px-5 py-4 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#708074]">
                Groww SIP Research
              </p>
              <h1 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#17231b]">
                Research overview
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-[#dce6dd] bg-white px-3 py-1.5 text-xs font-medium text-[#657568] sm:inline-flex">
                Evidence-gated
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1f6a3d] text-sm font-semibold text-white">
                AR
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">
          <section className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-[#1f6a3d]">
                Corpus readiness dashboard
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#17231b] sm:text-4xl">
                Evidence you can defend, or an honest empty state.
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#6d7d70]">
                Every count below comes from the production corpus file. The app does not
                invent reviews, permissions, themes, or findings when evidence is missing.
              </p>
            </div>
            <div className="rounded-2xl border border-[#dce6dd] bg-white px-4 py-3 text-sm text-[#536356] shadow-sm">
              <p className="font-semibold text-[#2d3d31]">Corpus gate</p>
              <p className="mt-1 text-xs leading-5 text-[#708074]">
                Permissions + source + provenance + SIP relevance
              </p>
            </div>
          </section>

          <Suspense fallback={<DashboardLoading />}>
            <CorpusDashboard />
          </Suspense>

          <footer className="mt-10 flex flex-col gap-2 border-t border-[#dfe8e1] pt-5 text-xs leading-5 text-[#7b8a7d] sm:flex-row sm:items-center sm:justify-between">
            <p>Groww SIP Discovery Engine · research prototype</p>
            <p>No synthetic fallback · no database writes · citations required</p>
          </footer>
        </div>
      </div>
    </main>
  );
}

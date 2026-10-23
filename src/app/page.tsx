
const navigation = [
  { label: "Overview", icon: "◫", active: true },
  { label: "Feedback Explorer", icon: "▤", active: false },
  { label: "AI Discovery", icon: "✳", active: false },
  { label: "Themes", icon: "◇", active: false },
  { label: "Segments", icon: "⌘", active: false },
  { label: "Opportunities", icon: "↗", active: false },
];

const metrics = [
  {
    label: "Feedback records",
    value: "—",
    note: "Awaiting data ingestion",
  },
  {
    label: "Analyzed records",
    value: "—",
    note: "Awaiting analysis",
  },
  {
    label: "Validated themes",
    value: "—",
    note: "Awaiting evidence review",
  },
  {
    label: "Ranked opportunities",
    value: "—",
    note: "Awaiting validation",
  },
];

export default function Home() {
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
            {navigation.map((item) => (
              <div
                key={item.label}
                aria-current={item.active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] font-medium ${
                  item.active
                    ? "bg-[#eaf8ef] text-[#078746]"
                    : "text-[#68756b]"
                }`}
              >
                <span aria-hidden="true" className="w-5 text-center text-lg">
                  {item.icon}
                </span>
                {item.label}
                {item.label === "AI Discovery" && (
                  <span className="ml-auto rounded-md bg-[#e9f7ed] px-1.5 py-1 text-[9px] font-bold text-[#078746]">
                    AI
                  </span>
                )}
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-xl border border-[#e6ece6] bg-[#fafcfa] p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#d99a2b]" />
              <p className="text-xs font-semibold">Research status</p>
            </div>
            <p className="text-xs leading-5 text-[#78847a]">
              No feedback dataset connected yet. Your research workspace is
              being set up.
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
            <p className="text-xs text-[#7c897e]">Workspace / Overview</p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight">
              Research overview
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-[#e5ebe5] px-3 py-1.5 text-xs text-[#6b786e] sm:inline-flex">
              Development environment
            </span>
            <div
              aria-label="User profile placeholder"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e6f5eb] text-sm font-semibold text-[#078746]"
            >
              R
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] p-5 sm:p-8">
          <section className="mb-8">
            <p className="text-sm font-medium text-[#078746]">
              INVESTOR RESEARCH WORKSPACE
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[30px]">
              Understand the investor journey.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#738076]">
              Discover the friction points that may prevent first-time mutual
              fund investors from sustaining their SIPs. Every insight will be
              tied to traceable evidence.
            </p>
          </section>

          <section
            aria-label="Research metrics"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {metrics.map((metric) => (
              <article
                key={metric.label}
                className="rounded-xl border border-[#e5ebe5] bg-white p-5"
              >
                <p className="text-[13px] font-medium text-[#758177]">
                  {metric.label}
                </p>
                <p className="mt-4 text-3xl font-semibold tracking-tight text-[#25352a]">
                  {metric.value}
                </p>
                <p className="mt-2 text-xs text-[#8a958c]">{metric.note}</p>
              </article>
            ))}
          </section>

          <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
            <article className="rounded-xl border border-[#e5ebe5] bg-white p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">
                    Discovery pipeline
                  </h3>
                  <p className="mt-1 text-sm text-[#7b887e]">
                    From raw feedback to evidence-backed opportunities
                  </p>
                </div>
                <span className="rounded-full bg-[#f0f3f0] px-2.5 py-1 text-[10px] font-semibold text-[#67736a]">
                  NOT STARTED
                </span>
              </div>

              <div className="mt-7 space-y-5">
                {[
                  {
                    number: "01",
                    title: "Collect feedback",
                    description:
                      "Import permitted public feedback or consented research.",
                  },
                  {
                    number: "02",
                    title: "Analyze investor experiences",
                    description:
                      "Extract problems, expectations, behaviour and context.",
                  },
                  {
                    number: "03",
                    title: "Validate themes",
                    description:
                      "Review supporting excerpts, counts and uncertainty.",
                  },
                  {
                    number: "04",
                    title: "Rank opportunities",
                    description:
                      "Compare potential retention impact, evidence quality and feasibility.",
                  },
                ].map((step) => (
                  <div key={step.number} className="flex gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e5ebe5] bg-[#fafcfa] text-xs font-semibold text-[#657267]">
                      {step.number}
                    </div>
                    <div className="pt-0.5">
                      <h4 className="text-sm font-semibold">{step.title}</h4>
                      <p className="mt-1 text-xs leading-5 text-[#7c887e]">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-xl border border-[#e5ebe5] bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf8ef] text-lg text-[#078746]">
                  ✳
                </div>
                <div>
                  <h3 className="text-base font-semibold">AI Discovery</h3>
                  <p className="mt-1 text-xs text-[#7b887e]">
                    Evidence-led research
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-dashed border-[#dce5dc] bg-[#fafcfa] p-5">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#8a978b] shadow-sm">
                  <span className="text-xl">⌕</span>
                </div>
                <h4 className="mt-4 text-center text-sm font-semibold">
                  Your first discovery starts here
                </h4>
                <p className="mx-auto mt-2 max-w-xs text-center text-xs leading-5 text-[#7b887e]">
                  Once feedback is ingested, the engine can extract themes,
                  connect evidence and prepare candidate insights for review.
                </p>
                <p className="mt-4 text-center text-[10px] font-medium text-[#8b968d]">
                  DATASET REQUIRED · NOT YET CONNECTED
                </p>
              </div>

              <div className="mt-5 border-t border-[#edf0ed] pt-4">
                <p className="text-xs font-semibold">Research principles</p>
                <ul className="mt-3 space-y-2.5 text-xs text-[#758177]">
                  <li className="flex gap-2">
                    <span className="text-[#078746]">✓</span>
                    Trace every insight to its source
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#078746]">✓</span>
                    Calculate prevalence from actual records
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#078746]">✓</span>
                    Separate evidence from hypotheses
                  </li>
                </ul>
              </div>
            </article>
          </section>

          <footer className="mt-8 border-t border-[#e5ebe5] py-5 text-xs leading-5 text-[#8a958c]">
            Research prototype · No investor data has been loaded. Displayed
            metrics and discovery results will remain empty until real data is
            ingested and analyzed.
          </footer>
        </div>
      </div>
    </main>
  );
}

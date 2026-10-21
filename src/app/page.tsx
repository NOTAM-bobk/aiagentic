import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Blocks,
  Box,
  Cloud,
  Code2,
  Compass,
  Database,
  Download,
  Globe2,
  Layers,
  Search,
  Terminal,
  Zap,
} from "lucide-react";
import { Wordmark, KilnMark } from "@/components/brand";
import { HeroComposer } from "@/components/landing/hero-composer";
import { SessionCard } from "@/components/landing/session-card";

const STACK = [
  { label: "Plans", value: "Groq" },
  { label: "Builds", value: "Gemini" },
  { label: "Free build", value: "Puter" },
  { label: "Runs", value: "Daytona" },
  { label: "Searches", value: "Tavily" },
  { label: "Connects", value: "Composio" },
];

const STEPS = [
  {
    n: "01",
    title: "It thinks before it types",
    body: "Groq drafts a plan in under a second: concept, art direction, sections, files. You see the thinking, and you can redirect it before a single line is written.",
    meta: "gpt-oss-120b · <1s",
  },
  {
    n: "02",
    title: "It builds real files",
    body: "Gemini handles the long, careful builds. Puter's browser models cover free, keyless sessions. Either way you get complete HTML, CSS, and JS — no framework tax, no placeholder copy.",
    meta: "gemini-3.8-flash · claude-sonnet",
  },
  {
    n: "03",
    title: "It runs what it wrote",
    body: "Files land in a Daytona sandbox, a server starts, and the preview is signed and live. Ask for a change and the agent edits the running site, not a mockup.",
    meta: "daytona · port 3000",
  },
];

const CAPABILITIES = [
  {
    icon: Compass,
    title: "Plan and think out loud",
    body: "Every session opens with a design brief: palette, type system, section order, and the files it intends to write. Approve it or push back.",
    tag: "Groq",
  },
  {
    icon: Code2,
    title: "Two builders, one contract",
    body: "Gemini for depth, Puter for zero-key sessions. The same file protocol means a Build works identically on either model.",
    tag: "Gemini · Puter",
  },
  {
    icon: Search,
    title: "Search the live web",
    body: "Tavily pulls current prices, dates, and facts into the brief, so the copy isn't stuck in a training cutoff.",
    tag: "Tavily",
  },
  {
    icon: Box,
    title: "A real computer",
    body: "Daytona gives each project its own sandbox. Write files, run commands, tail logs, serve the result on a signed URL.",
    tag: "Daytona",
  },
  {
    icon: Blocks,
    title: "Connect your stack",
    body: "Composio links GitHub, Supabase, Cloudflare, Vercel, Notion, Slack, and more — with real scoped auth, not pasted tokens.",
    tag: "Composio",
  },
  {
    icon: Download,
    title: "Leave with the code",
    body: "Download a self-contained HTML file, copy any file, or push the project to GitHub once it's connected. No lock-in, no export queue.",
    tag: "Plain files",
  },
];

const MODELS = [
  { role: "Planner", model: "openai/gpt-oss-120b", provider: "Groq", note: "Fast, cheap reasoning and tool-free planning" },
  { role: "Builder", model: "gemini-3.8-flash", provider: "Google AI Studio", note: "Long-horizon code generation, strong design instincts" },
  { role: "Builder", model: "claude-sonnet-4-5", provider: "Puter.js", note: "No API key; runs in the browser on the user's account" },
  { role: "Fallback builder", model: "openai/gpt-oss-120b", provider: "Groq", note: "Quick edits when Google is rate-limited" },
  { role: "Search", model: "tavily/search", provider: "Tavily", note: "Live results with an answer summary" },
  { role: "Computer", model: "sandbox", provider: "Daytona", note: "Isolated Linux VM, signed preview URLs" },
  { role: "Connectors", model: "composio v3.1", provider: "Composio", note: "Managed OAuth for 100+ toolkits" },
];

const FAQ = [
  {
    q: "Do I need API keys to try it?",
    a: "Not for Browser mode: Puter's models run client-side and files stay in your browser, with no server keys and no sandbox bill. Puter asks you to sign in once on first use. Add Groq, Google AI Studio, and Daytona keys when you want the full cloud agent.",
  },
  {
    q: "Where does the finished site live?",
    a: "In a Daytona sandbox while you work, on a signed preview URL. When you're happy, download the bundle or push it to GitHub and deploy anywhere. Kiln itself is hosted on Vercel.",
  },
  {
    q: "Why so many models?",
    a: "Planning and writing are different jobs. A small, fast reasoning model is ideal for the brief; a larger code model writes better files. Splitting them keeps the agent fast and the bill small.",
  },
  {
    q: "What can the agent actually do with my connections?",
    a: "Composio exposes scoped toolkit actions — create a repo, read a Supabase table, purge a Cloudflare cache. You approve each connection through the provider, and Kiln never sees your password.",
  },
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-paper">
      <section className="relative overflow-hidden bg-night text-cream">
        <div className="absolute inset-0 hairline opacity-40" aria-hidden="true" />
        <div className="absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-ember/10 blur-[120px]" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-paper/[0.04] to-transparent" aria-hidden="true" />

        <div className="relative mx-auto w-full max-w-6xl px-6">
          <header className="flex items-center justify-between border-b border-white/8 py-5">
            <Link href="/" aria-label="Kiln home">
              <Wordmark className="text-cream" />
            </Link>
            <nav className="hidden items-center gap-7 text-[13px] text-white/55 md:flex">
              <a href="#how" className="transition-colors hover:text-cream">How it works</a>
              <a href="#stack" className="transition-colors hover:text-cream">Stack</a>
              <a href="#faq" className="transition-colors hover:text-cream">FAQ</a>
            </nav>
            <Link
              href="/build"
              className="group inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-[12.5px] text-cream/85 transition-colors hover:border-white/35 hover:bg-white/5"
            >
              Open workspace
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </header>

          <div className="grid items-center gap-14 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:py-24">
            <div className="animate-fade-up">
              <p className="label-xs flex items-center gap-2 text-white/40">
                <span className="h-1 w-1 rounded-full bg-ember-bright" />
                Agentic website studio
              </p>
              <h1 className="mt-5 text-[2.85rem] leading-[0.98] tracking-[-0.035em] sm:text-[3.6rem] lg:text-[4.1rem]">
                Describe the site.
                <br />
                <span className="font-display italic text-cream/95">Kiln fires it.</span>
              </h1>
              <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-white/55 sm:text-base">
                An agent that plans, searches, writes real code, and runs your website in a live
                sandbox. You watch the work happen — then take the files anywhere.
              </p>

              <div className="mt-8 max-w-xl">
                <HeroComposer />
              </div>
            </div>

            <div className="animate-fade-up [animation-delay:120ms]">
              <SessionCard />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/8 py-5">
            <p className="label-xs text-white/40">The stack under the hood</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {STACK.map((item) => (
                <div key={item.label} className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
                    {item.label}
                  </span>
                  <span className="text-[12px] text-cream/60">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="relative border-b border-line">
        <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="label-xs text-ink-faint">01 — How it works</p>
              <h2 className="mt-4 text-[2rem] leading-[1.05] tracking-[-0.03em] sm:text-[2.5rem]">
                A studio, compressed
                <br />
                into a conversation.
              </h2>
              <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed text-ink-soft">
                No canvas to learn, no components to drag. The agent holds the plan, the files, and
                the running site in one thread — and shows its work as it goes.
              </p>
              <Link
                href="/build"
                className="group mt-7 inline-flex items-center gap-2 border-b border-ink pb-1 text-[13.5px] font-medium transition-colors hover:border-ember hover:text-ember"
              >
                Start a session
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <div className="divide-y divide-line border-y border-line">
              {STEPS.map((step) => (
                <div key={step.n} className="grid gap-4 py-7 sm:grid-cols-[48px_1fr_auto] sm:gap-6">
                  <span className="font-mono text-[11px] text-ink-faint">{step.n}</span>
                  <div>
                    <h3 className="text-[16px] font-medium tracking-[-0.01em]">{step.title}</h3>
                    <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-soft">{step.body}</p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint sm:pt-1">
                    {step.meta}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-paper-2/40">
        <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="label-xs text-ink-faint">02 — Capabilities</p>
              <h2 className="mt-4 max-w-xl text-[2rem] leading-[1.05] tracking-[-0.03em] sm:text-[2.5rem]">
                Everything the work needs,
                <br className="hidden sm:block" /> already wired up.
              </h2>
            </div>
            <p className="max-w-xs text-[13px] leading-relaxed text-ink-soft">
              Small, sharp tools. Each one does a single job and reports back into the same thread.
            </p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <div
                key={capability.title}
                className="group relative bg-paper p-6 transition-colors hover:bg-paper-2/70"
              >
                <capability.icon className="h-4 w-4 text-ember" strokeWidth={1.6} />
                <h3 className="mt-5 text-[15px] font-medium tracking-[-0.01em]">{capability.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{capability.body}</p>
                <p className="mt-6 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  {capability.tag}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="stack" className="border-b border-line">
        <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="label-xs text-ink-faint">03 — The stack</p>
              <h2 className="mt-4 text-[2rem] leading-[1.05] tracking-[-0.03em] sm:text-[2.5rem]">
                Free where it can be.
                <br />
                Cheap where it matters.
              </h2>
              <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-ink-soft">
                Every provider below has a free tier or a browser-side path. You bring keys only for
                the parts you want running in the cloud.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                {[
                  { icon: Cloud, label: "Vercel hosting" },
                  { icon: Database, label: "No database required" },
                  { icon: Layers, label: "Static output" },
                ].map((item) => (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-ink-soft"
                  >
                    <item.icon className="h-3 w-3 text-ink-faint" />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-line bg-paper">
              <div className="grid grid-cols-[90px_1fr] gap-4 border-b border-line bg-paper-2/60 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint sm:grid-cols-[90px_1.1fr_0.9fr_1.4fr]">
                <span>Role</span>
                <span>Model / service</span>
                <span className="hidden sm:block">Provider</span>
                <span className="hidden sm:block">Notes</span>
              </div>
              <ul className="divide-y divide-line">
                {MODELS.map((row) => (
                  <li
                    key={`${row.role}-${row.model}`}
                    className="grid grid-cols-[90px_1fr] items-baseline gap-4 px-4 py-3 text-[12.5px] transition-colors hover:bg-paper-2/50 sm:grid-cols-[90px_1.1fr_0.9fr_1.4fr]"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                      {row.role}
                    </span>
                    <span className="font-mono text-[11.5px] text-ink">{row.model}</span>
                    <span className="hidden text-[12px] text-ink-soft sm:block">{row.provider}</span>
                    <span className="hidden text-[12px] leading-snug text-ink-soft sm:block">{row.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-night text-cream">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-7">
            <div className="flex items-center justify-between">
              <p className="label-xs text-white/50">Browser mode</p>
              <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[9px] text-white/50">
                $0
              </span>
            </div>
            <h3 className="mt-5 font-display text-[1.9rem] leading-tight">No keys. No setup.</h3>
            <ul className="mt-5 space-y-2.5 text-[13px] text-white/55">
              {["Puter models for building (sign in once)", "Files stored in your browser", "Instant preview, download as HTML", "Great for trying ideas and learning"].map(
                (item) => (
                  <li key={item} className="flex gap-2.5">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-white/30" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>

          <div className="rounded-lg border border-ember/30 bg-ember/[0.06] p-7">
            <div className="flex items-center justify-between">
              <p className="label-xs text-ember-bright/80">Cloud mode</p>
              <span className="rounded-full border border-ember/30 px-2 py-0.5 font-mono text-[9px] text-ember-bright/80">
                free tier
              </span>
            </div>
            <h3 className="mt-5 font-display text-[1.9rem] leading-tight">A real computer, on call.</h3>
            <ul className="mt-5 space-y-2.5 text-[13px] text-white/60">
              {["Groq planning, Gemini builds", "Daytona sandbox with live preview", "Tavily search and Composio connectors", "Runs on Vercel — add keys in one place"].map(
                (item) => (
                  <li key={item} className="flex gap-2.5">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ember/60" />
                    {item}
                  </li>
                ),
              )}
            </ul>
            <Link
              href="/build"
              className="group mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-cream"
            >
              Open the workspace
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      <section id="faq" className="border-b border-line">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 sm:py-24 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="label-xs text-ink-faint">04 — Questions</p>
            <h2 className="mt-4 text-[2rem] leading-[1.05] tracking-[-0.03em]">Before you fire it up.</h2>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[14.5px] font-medium">
                  {item.q}
                  <span className="text-ink-faint transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-ink-soft">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-paper">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="relative overflow-hidden rounded-xl border border-line bg-paper-2/50 p-10 sm:p-14">
            <div className="absolute inset-0 dot-grid opacity-50" aria-hidden="true" />
            <div className="relative flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-end">
              <div>
                <KilnMark className="h-7 w-7 text-ember" />
                <h2 className="mt-5 max-w-lg text-[2.1rem] leading-[1.03] tracking-[-0.03em] sm:text-[2.8rem]">
                  Your next site
                  <br />
                  starts as a sentence.
                </h2>
                <p className="mt-4 max-w-md text-[14px] leading-relaxed text-ink-soft">
                  Open the workspace, describe what you want, and watch it get built — planning,
                  searching, writing, and running in one thread.
                </p>
              </div>
              <Link
                href="/build"
                className="group inline-flex items-center gap-2.5 rounded-md bg-ink px-5 py-3 text-[13.5px] font-medium text-cream transition-colors hover:bg-ink/90"
              >
                Start building
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Wordmark className="text-ink" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Built for the web
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-[12px] text-ink-soft">
            <a href="https://vercel.com" className="inline-flex items-center gap-1.5 hover:text-ink">
              <Globe2 className="h-3.5 w-3.5" /> Hosted on Vercel
            </a>
            <a href="https://daytona.io" className="inline-flex items-center gap-1.5 hover:text-ink">
              <Terminal className="h-3.5 w-3.5" /> Daytona
            </a>
            <a href="https://composio.dev" className="inline-flex items-center gap-1.5 hover:text-ink">
              <Blocks className="h-3.5 w-3.5" /> Composio
            </a>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-ember" /> Groq
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}

import { ArrowUpRight, Check, Globe, Search, Terminal, Wand2 } from "lucide-react";

const STEPS = [
  { icon: Wand2, label: "Plan committed", detail: "Editorial portfolio · 3 files", state: "done" },
  { icon: Search, label: "Searched the web", detail: "2 sources · current workshop dates", state: "done" },
  { icon: Terminal, label: "Wrote styles.css", detail: "1,284 lines · no build step", state: "done" },
  { icon: Globe, label: "Sandbox running", detail: "daytona · port 3000", state: "live" },
];

export function SessionCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[28px] bg-ember/[0.06] blur-2xl" />
      <div className="overflow-hidden rounded-xl border border-white/12 bg-night-2/90 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/8 text-[10px] font-medium text-cream/70">
              TF
            </span>
            <div className="leading-tight">
              <p className="text-[12px] text-cream/90">Tierra y Fuego</p>
              <p className="font-mono text-[10px] text-white/50">kiln / oaxaca-ceramics</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-300/90">
            <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse-dot" />
            live
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[0.85fr_1.15fr]">
          <div className="border-b border-white/8 p-3.5 sm:border-b-0 sm:border-r">
            <p className="label-xs mb-3 text-white/40">Session</p>
            <ol className="space-y-2.5">
              {STEPS.map((step) => (
                <li key={step.label} className="flex gap-2.5">
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      step.state === "live"
                        ? "border-ember/60 bg-ember/20 text-ember-bright"
                        : "border-white/15 bg-white/5 text-white/50"
                    }`}
                  >
                    {step.state === "live" ? (
                      <ArrowUpRight className="h-2.5 w-2.5" />
                    ) : (
                      <Check className="h-2.5 w-2.5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] leading-tight text-cream/80">{step.label}</p>
                    <p className="truncate font-mono text-[9.5px] text-white/45">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-4 rounded-md border border-white/8 bg-black/30 p-2.5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">Builder</p>
              <p className="mt-1 text-[11px] text-cream/70">gemini-3.8-flash</p>
              <p className="font-mono text-[9px] text-white/45">planner · gpt-oss-120b</p>
            </div>
          </div>

          <div className="p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <p className="label-xs text-white/40">Preview</p>
              <span className="font-mono text-[9px] text-white/40">3000 · signed</span>
            </div>

            <div className="overflow-hidden rounded-md bg-[#f4ece0] shadow-inner">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="font-display text-[13px] text-[#3d2a1c]">Tierra y Fuego</span>
                <div className="flex gap-2 font-mono text-[7px] uppercase tracking-widest text-[#6b5747]">
                  <span>Work</span>
                  <span>Studio</span>
                  <span>Visits</span>
                </div>
              </div>
              <div className="px-3 pb-3">
                <div className="relative h-24 overflow-hidden rounded-sm bg-[#c8a98c]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#e8d3b8,transparent_55%)]" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="mx-auto h-10 w-7 rounded-t-full bg-[#8f5c3b] shadow-[0_6px_12px_rgba(0,0,0,0.25)]" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#3d2a1c]/40 to-transparent" />
                </div>
                <p className="mt-2 font-display text-[15px] leading-tight text-[#2f2116]">
                  Clay from the hills, fired slowly.
                </p>
                <p className="mt-1 text-[7px] leading-relaxed text-[#6b5747]">
                  Small-batch vessels and tableware. Open studio the first Saturday of each month.
                </p>
                <div className="mt-2 flex gap-1.5">
                  <div className="h-8 flex-1 rounded-sm bg-[#a97c56]" />
                  <div className="h-8 flex-1 rounded-sm bg-[#7d6248]" />
                  <div className="h-8 flex-1 rounded-sm bg-[#cbb191]" />
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] text-white/45">
              <span>index.html · styles.css · script.js</span>
              <span>12.4 kb</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

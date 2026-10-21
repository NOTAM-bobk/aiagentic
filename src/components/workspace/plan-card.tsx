"use client";

import { useState } from "react";
import { ChevronDown, Compass } from "lucide-react";
import type { Plan } from "@/lib/protocol";
import { cn } from "@/lib/utils";

export function PlanCard({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-md border border-line bg-paper-2/50">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-paper-2"
      >
        <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ember" strokeWidth={1.7} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-medium">{plan.title}</span>
            <span className="rounded border border-line bg-paper px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-ink-faint">
              plan
            </span>
          </span>
          <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-soft">{plan.concept}</span>
        </span>
        <ChevronDown
          className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t border-line px-3.5 py-3">
          {plan.artDirection && (
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              {plan.artDirection.palette && <Detail label="Palette" value={plan.artDirection.palette} />}
              {plan.artDirection.typography && <Detail label="Type" value={plan.artDirection.typography} />}
              {plan.artDirection.layout && <Detail label="Layout" value={plan.artDirection.layout} />}
              {plan.artDirection.motion && <Detail label="Motion" value={plan.artDirection.motion} />}
            </dl>
          )}

          {plan.buildSteps && plan.buildSteps.length > 0 && (
            <div className="mt-4">
              <p className="label-xs text-ink-faint">Steps</p>
              <ol className="mt-2 space-y-1.5">
                {plan.buildSteps.map((step, index) => (
                  <li key={`${step.title}-${index}`} className="flex gap-2.5 text-[12.5px]">
                    <span className="mt-px font-mono text-[10px] text-ink-faint">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <span className="font-medium text-ink">{step.title}</span>
                      <span className="text-ink-soft"> — {step.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {plan.files && plan.files.length > 0 && (
            <div className="mt-4">
              <p className="label-xs text-ink-faint">Files</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {plan.files.map((file) => (
                  <span
                    key={file.path}
                    title={file.purpose}
                    className="rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-[10px] text-ink-soft"
                  >
                    {file.path}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{value}</dd>
    </div>
  );
}

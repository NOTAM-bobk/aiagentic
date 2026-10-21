"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Plan } from "@/lib/protocol";
import { cn } from "@/lib/utils";

export function PlanCard({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-line bg-paper-2/30 font-mono">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-paper-2/60"
      >
        <span className="mt-px text-[10px] text-ember">◆</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] text-ink">{plan.title}</span>
          <span className="mt-1.5 block text-[12.5px] leading-relaxed text-ink-soft">
            {plan.concept}
          </span>
        </span>
        <ChevronRight
          className={cn(
            "mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform",
            open && "rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="border-t border-line px-4 py-3.5">
          {plan.artDirection && (
            <dl className="grid grid-cols-[68px_1fr] gap-x-3 gap-y-1.5 text-[12px]">
              {plan.artDirection.palette && <Detail label="palette" value={plan.artDirection.palette} />}
              {plan.artDirection.typography && <Detail label="type" value={plan.artDirection.typography} />}
              {plan.artDirection.layout && <Detail label="layout" value={plan.artDirection.layout} />}
              {plan.artDirection.motion && <Detail label="motion" value={plan.artDirection.motion} />}
            </dl>
          )}

          {plan.stack && (
            <p className="mt-3 text-[12px] text-ink-faint">
              <span className="text-ink">stack</span> · {plan.stack}
            </p>
          )}

          {plan.buildSteps && plan.buildSteps.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">steps</p>
              <ol className="mt-1.5 space-y-1">
                {plan.buildSteps.map((step, index) => (
                  <li key={`${step.title}-${index}`} className="flex gap-2 text-[12px] leading-relaxed">
                    <span className="text-ink-faint">{String(index + 1).padStart(2, "0")}</span>
                    <span className="text-ink-soft">
                      <span className="text-ink">{step.title}</span> — {step.detail}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {plan.files && plan.files.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">files</p>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                {plan.files.map((file) => (
                  <span key={file.path} title={file.purpose} className="text-[12px] text-ink-soft">
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
    <>
      <dt className="text-ink-faint">{label}</dt>
      <dd className="leading-relaxed text-ink-soft">{value}</dd>
    </>
  );
}

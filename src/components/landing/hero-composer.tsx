"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CornerDownLeft, Sparkles } from "lucide-react";
import { STARTER_PROMPTS } from "@/lib/protocol";
import { cn } from "@/lib/utils";

const CHIPS = ["Portfolio", "Coffee roaster", "Cabin rental", "Open-source docs"];

const CHIP_PROMPTS: Record<string, string> = {
  Portfolio: STARTER_PROMPTS[0],
  "Coffee roaster": STARTER_PROMPTS[1],
  "Cabin rental": STARTER_PROMPTS[2],
  "Open-source docs": STARTER_PROMPTS[3],
};

export function HeroComposer() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function go(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    startTransition(() => {
      router.push(`/build?prompt=${encodeURIComponent(trimmed)}`);
    });
  }

  return (
    <div className="w-full">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          go(value);
        }}
        className="group relative rounded-xl border border-white/15 bg-white/[0.04] p-2 transition-colors focus-within:border-white/30 hover:border-white/25"
      >
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.06] to-transparent opacity-0 transition-opacity group-focus-within:opacity-100" />
        <label htmlFor="hero-prompt" className="sr-only">
          Describe the website you want to build
        </label>
        <textarea
          id="hero-prompt"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              go(value);
            }
          }}
          rows={3}
          placeholder="A quiet portfolio for a ceramicist in Oaxaca. Warm paper tones, a gallery of glazes, and the next workshop dates."
          className="w-full resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed text-cream placeholder:text-white/50 focus:outline-none sm:text-base"
        />
        <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-1">
          <div className="flex items-center gap-2 text-[11px] text-white/40">
            <CornerDownLeft className="h-3 w-3" />
            <span className="hidden sm:inline">Enter to start</span>
            <span className="sm:hidden">Tap to start</span>
          </div>
          <button
            type="submit"
            disabled={!value.trim() || pending}
            className={cn(
              "inline-flex items-center gap-2 rounded-md bg-cream px-3.5 py-2 text-[13px] font-medium text-night transition-all",
              "hover:bg-white disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {pending ? "Opening…" : "Start building"}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="label-xs text-white/45">Try</span>
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => {
              setValue(CHIP_PROMPTS[chip]);
              go(CHIP_PROMPTS[chip]);
            }}
            className="rounded-full border border-white/12 px-3 py-1 text-xs text-white/60 transition-colors hover:border-white/30 hover:text-cream"
          >
            {chip}
          </button>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-white/50">
        No Kiln account. Browser mode runs keyless with Puter (a one-time Puter sign-in); cloud mode
        adds a live Daytona sandbox, web search, and connectors.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Check, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  DEFAULT_MODEL_SETTINGS,
  isDefaultSettings,
  type ModelSettings,
} from "@/lib/model-settings";
import { cn } from "@/lib/utils";
import { Sheet } from "./sheets";

export function ModelSettingsSheet({
  open,
  onClose,
  settings,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  settings: ModelSettings;
  onSave: (next: ModelSettings) => void;
}) {
  const [draft, setDraft] = useState<ModelSettings>(settings);
  const [saved, setSaved] = useState(false);

  // The sheet stays mounted, so reload the saved values each time it opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload the saved settings on open
    if (open) setDraft(settings);
  }, [open, settings]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  function save() {
    onSave(draft);
    setDraft((value) => ({ ...value }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="model settings"
      subtitle="how the agent thinks, writes, and checks its work"
    >
      <div className="flex items-center justify-between gap-3 border border-line bg-paper-2/40 px-3 py-2.5 font-mono">
        <p className="flex items-center gap-2 text-[12px] text-ink-soft">
          <SlidersHorizontal className="h-3.5 w-3.5 text-ember" />
          {isDefaultSettings(draft) ? "defaults" : "customised"}
        </p>
        <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">this browser</span>
      </div>

      <div className="mt-5 space-y-5 font-mono">
        <Slider
          id="temperature"
          label="temperature"
          value={draft.temperature}
          display={draft.temperature.toFixed(2)}
          min={0}
          max={1.2}
          step={0.05}
          hint="lower is safer and more literal, higher is looser and more surprising."
          onChange={(temperature) => setDraft((value) => ({ ...value, temperature }))}
        />
        <Slider
          id="max-tokens"
          label="max output tokens"
          value={draft.maxOutputTokens}
          display={draft.maxOutputTokens.toLocaleString()}
          min={1024}
          max={16384}
          step={512}
          hint="ceiling for one response. Larger files need more room."
          onChange={(maxOutputTokens) => setDraft((value) => ({ ...value, maxOutputTokens }))}
        />
        <Slider
          id="max-rounds"
          label="rounds per turn"
          value={draft.maxRounds}
          display={String(draft.maxRounds)}
          min={1}
          max={6}
          step={1}
          hint="how many passes the agent gets, including the refinement after review. 1 turns the loop off."
          onChange={(maxRounds) => setDraft((value) => ({ ...value, maxRounds }))}
        />

        <div className="border-t border-line pt-4">
          <p className="label-xs text-ink-faint">behaviour</p>
          <div className="mt-2 space-y-1.5">
            <Toggle
              label="self review"
              detail="verify the live preview and ask a different model what to improve."
              active={draft.selfReview}
              onChange={(selfReview) => setDraft((value) => ({ ...value, selfReview }))}
            />
            <Toggle
              label="web research"
              detail="search for current craft on this kind of site before refining. needs tavily."
              active={draft.webResearch}
              onChange={(webResearch) => setDraft((value) => ({ ...value, webResearch }))}
            />
            <Toggle
              label="image generation"
              detail="let the agent draw photographs with the image model."
              active={draft.images}
              onChange={(images) => setDraft((value) => ({ ...value, images }))}
            />
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="system-prompt" className="label-xs text-ink-faint">
              system prompt
            </label>
            <div className="flex items-center gap-0.5 rounded border border-line p-0.5">
              {(["append", "replace"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={draft.promptMode === mode}
                  onClick={() => setDraft((value) => ({ ...value, promptMode: mode }))}
                  className={cn(
                    "min-h-6 rounded px-1.5 text-[10.5px] uppercase tracking-[0.08em] transition-colors",
                    draft.promptMode === mode
                      ? "bg-ember/15 text-ember"
                      : "text-ink-faint hover:text-ink",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <textarea
            id="system-prompt"
            value={draft.systemPrompt}
            onChange={(event) =>
              setDraft((value) => ({ ...value, systemPrompt: event.target.value.slice(0, 6000) }))
            }
            rows={6}
            spellCheck={false}
            placeholder={
              draft.promptMode === "append"
                ? "extra instructions, e.g. always use our brand colours and keep headings short."
                : "the whole system prompt. the built-in protocol will not be sent."
            }
            className="mt-2 w-full resize-y border border-line bg-paper px-2.5 py-2 text-[12px] leading-relaxed text-ink transition-colors placeholder:text-ink-faint/70 focus:border-ember/60 focus:outline-none"
          />
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
            {draft.promptMode === "append"
              ? "added to the built-in prompt for every build and plan turn."
              : "replaces the built-in prompt. it describes the file protocol, so replacing it usually breaks edits — append unless you know the protocol."}
          </p>
          <p className="mt-1 text-right text-[10.5px] tabular-nums text-ink-faint">
            {draft.systemPrompt.length}/6000
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 font-mono">
        <button
          type="button"
          onClick={save}
          disabled={!dirty && !saved}
          className="inline-flex min-h-9 items-center gap-1.5 border border-ember/50 bg-ember/10 px-3 text-[11px] uppercase tracking-wider text-ember transition-colors hover:border-ember disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-ink-faint"
        >
          {saved ? <Check className="h-3 w-3" /> : null}
          {saved ? "saved" : "save settings"}
        </button>
        <button
          type="button"
          onClick={() => setDraft({ ...DEFAULT_MODEL_SETTINGS })}
          className="inline-flex min-h-9 items-center gap-1.5 px-2 text-[10.5px] uppercase tracking-wider text-ink-faint transition-colors hover:text-ink"
        >
          <RotateCcw className="h-3 w-3" /> defaults
        </button>
        <span className="text-[10.5px] text-ink-faint">applies from the next message</span>
      </div>
    </Sheet>
  );
}

function Slider({
  id,
  label,
  value,
  display,
  min,
  max,
  step,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  hint: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label-xs text-ink-faint">
          {label}
        </label>
        <span className="text-[12px] tabular-nums text-ink">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-8 w-full cursor-pointer accent-[var(--ember)]"
      />
      <p className="text-[10.5px] leading-relaxed text-ink-faint">{hint}</p>
    </div>
  );
}

function Toggle({
  label,
  detail,
  active,
  onChange,
}: {
  label: string;
  detail: string;
  active: boolean;
  onChange: (active: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={() => onChange(!active)}
      className={cn(
        "flex w-full items-start gap-2.5 border px-2.5 py-2 text-left transition-colors",
        active
          ? "border-ember/30 bg-ember-soft/40"
          : "border-line bg-transparent hover:border-line-strong",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-sm border text-[9px]",
          active ? "border-ember/60 text-ember" : "border-line-strong text-transparent",
        )}
      >
        ✓
      </span>
      <span className="min-w-0">
        <span className={cn("block text-[12px]", active ? "text-ink" : "text-ink-soft")}>{label}</span>
        <span className="mt-0.5 block text-[10.5px] leading-relaxed text-ink-faint">{detail}</span>
      </span>
    </button>
  );
}

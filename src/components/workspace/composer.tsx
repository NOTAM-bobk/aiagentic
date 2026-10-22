"use client";

import { useEffect, useRef, useState } from "react";
import { Cloud, Frame, Sparkles, Square } from "lucide-react";
import type { Capabilities } from "@/lib/models";
import type { WorkspaceMode } from "@/lib/protocol";
import { PUTER_MODELS } from "@/lib/puter-models";
import { BUILDER_OPTIONS, resolveBuilder } from "@/lib/builders";
import { cn } from "@/lib/utils";

export function Composer({
  builder,
  puterModel,
  mode,
  capabilities,
  busy,
  onSend,
  onStop,
  onBuilder,
  onPuterModel,
  onMode,
}: {
  builder: string;
  puterModel: string;
  mode: WorkspaceMode;
  capabilities: Capabilities | null;
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onBuilder: (builder: string) => void;
  onPuterModel: (model: string) => void;
  onMode: (mode: WorkspaceMode) => void;
}) {
  const [value, setValue] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const node = textarea.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
  }, [value]);

  useEffect(() => {
    if (busy) return;
    textarea.current?.focus();
  }, [busy]);

  function submit() {
    const text = value.trim();
    if (!text || busy) return;
    setValue("");
    onSend(text);
  }

  const current = resolveBuilder(builder);
  const options = BUILDER_OPTIONS.map((option) => ({
    id: option.id,
    label: option.label,
    ready:
      option.provider === "puter"
        ? true
        : option.provider === "gemini"
          ? Boolean(capabilities?.google)
          : Boolean(capabilities?.groq),
  }));

  return (
    <div className="border-t border-line bg-paper px-3 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 sm:px-8">
      <div className="mx-auto max-w-[47rem]">
        <div className="rounded-lg border border-line bg-paper-2/30 transition-colors focus-within:border-ember/40">
          <div className="flex items-start gap-2 px-2.5 pt-2">
            <span aria-hidden="true" className="select-none pt-0.5 text-[13px] leading-[1.5] text-ember">
              ❯
            </span>
            <label htmlFor="composer" className="sr-only">
              Message the agent
            </label>
            <textarea
              id="composer"
              ref={textarea}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              rows={1}
              spellCheck={false}
              enterKeyHint="send"
              placeholder="ask anything, or describe what to build…"
              className="max-h-[132px] min-h-[24px] w-full resize-none bg-transparent pb-2 font-mono text-[15px] leading-[1.5] text-ink placeholder:text-ink-faint focus:outline-none sm:text-[13px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 border-t border-line/60 px-1.5 py-1.5 font-mono text-[11px]">
            <label className="flex items-center gap-1.5 text-ink-faint">
              <span className="sr-only">Builder model</span>
              <select
                aria-label="Builder model"
                value={current.id}
                onChange={(event) => onBuilder(event.target.value)}
                className="min-h-7 max-w-[138px] cursor-pointer truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-ink-soft transition-colors hover:bg-paper/60 hover:text-ink focus:outline-none sm:max-w-[178px]"
              >
                {options.map((option) => (
                  <option key={option.id} value={option.id} className="bg-paper-2 text-ink">
                    {option.label}
                    {option.ready ? "" : " (key)"}
                  </option>
                ))}
              </select>
            </label>

            {current.provider === "puter" && (
              <label className="flex items-center gap-1.5 text-ink-faint">
                <span className="sr-only">Puter model</span>
                <select
                  aria-label="Puter model"
                  value={puterModel}
                  onChange={(event) => onPuterModel(event.target.value)}
                  className="min-h-7 max-w-[138px] cursor-pointer truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-ink-soft transition-colors hover:bg-paper/60 hover:text-ink focus:outline-none sm:max-w-[158px]"
                >
                  {PUTER_MODELS.map((model) => (
                    <option key={model.id || "default"} value={model.id} className="bg-paper-2 text-ink">
                      {model.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onMode("auto")}
                aria-label="Auto runtime"
                title={
                  capabilities?.daytona
                    ? "Free browser runtime first, cloud only when it is needed"
                    : "Free browser runtime; add DAYTONA_API_KEY for cloud fallback"
                }
                className={cn(
                  "inline-flex min-h-7 items-center gap-1 rounded border px-1.5 py-0.5 transition-colors",
                  mode === "auto"
                    ? "border-ember/40 bg-ember/10 text-ember"
                    : "border-line text-ink-faint hover:border-line-strong hover:text-ink",
                )}
              >
                <Sparkles className="h-3 w-3" />
                <span className="hidden sm:inline">auto</span>
              </button>
              <button
                type="button"
                onClick={() => onMode("cloud")}
                aria-label="Cloud runtime"
                title={capabilities?.daytona ? "Always run files in a Daytona sandbox" : "Needs DAYTONA_API_KEY"}
                className={cn(
                  "inline-flex min-h-7 items-center gap-1 rounded border px-1.5 py-0.5 transition-colors",
                  mode === "cloud"
                    ? "border-ember/40 bg-ember/10 text-ember"
                    : "border-line text-ink-faint hover:border-line-strong hover:text-ink",
                )}
              >
                <Cloud className="h-3 w-3" />
                <span className="hidden sm:inline">cloud</span>
              </button>
              <button
                type="button"
                onClick={() => onMode("local")}
                aria-label="Browser runtime"
                title="Runs in this browser with WebContainers"
                className={cn(
                  "inline-flex min-h-7 items-center gap-1 rounded border px-1.5 py-0.5 transition-colors",
                  mode === "local"
                    ? "border-ember/40 bg-ember/10 text-ember"
                    : "border-line text-ink-faint hover:border-line-strong hover:text-ink",
                )}
              >
                <Frame className="h-3 w-3" />
                <span className="hidden sm:inline">browser</span>
              </button>
            </div>

            <div className="ml-auto flex items-center">
              {busy ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="inline-flex min-h-7 items-center gap-1.5 rounded border border-alert/50 bg-alert-soft px-2.5 text-[11px] text-alert transition-colors hover:border-alert"
                >
                  <Square className="h-2 w-2 fill-current" /> stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!value.trim()}
                  className="inline-flex min-h-7 items-center gap-1.5 rounded border border-ember/50 bg-ember/10 px-2.5 text-[11px] text-ember transition-colors hover:border-ember hover:bg-ember/15 disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-ink-faint"
                >
                  send <span className="text-[9px] opacity-70">⏎</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

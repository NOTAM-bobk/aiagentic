"use client";

import { useEffect, useRef, useState } from "react";
import { Cloud, Frame, Square } from "lucide-react";
import type { Capabilities } from "@/lib/models";
import type { WorkspaceMode } from "@/lib/protocol";
import { PUTER_MODELS } from "@/lib/puter-models";
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
    node.style.height = `${Math.min(node.scrollHeight, 176)}px`;
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

  const options = [
    { id: "gemini", label: "gemini", ready: Boolean(capabilities?.google) },
    { id: "groq", label: "groq", ready: Boolean(capabilities?.groq) },
    { id: "puter", label: "puter · free", ready: true },
  ];

  return (
    <div className="border-t border-line bg-paper-2/30 px-4 pb-4 pt-3 sm:px-8 sm:pb-6">
      <div className="mx-auto max-w-[46rem]">
        <div className="border border-line bg-paper transition-colors focus-within:border-ember/50">
          <div className="flex items-start gap-2.5 px-3 pt-3">
            <span aria-hidden="true" className="select-none pt-px text-[13px] leading-relaxed text-ember">
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
              placeholder={mode === "cloud" ? "ask anything, or describe a site…" : "ask anything…"}
              className="max-h-[176px] min-h-[28px] w-full resize-none bg-transparent pb-2.5 font-mono text-[13px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-3 py-2 font-mono text-[11px]">
            <label className="flex items-center gap-1.5 text-ink-faint">
              <span className="sr-only">Builder model</span>
              <select
                aria-label="Builder model"
                value={builder}
                onChange={(event) => onBuilder(event.target.value)}
                className="max-w-[150px] cursor-pointer truncate border-0 bg-transparent py-0 pl-0 pr-4 text-ink-soft focus:outline-none"
              >
                {options.map((option) => (
                  <option key={option.id} value={option.id} className="bg-paper-2 text-ink">
                    {option.label}
                    {option.ready ? "" : " (key)"}
                  </option>
                ))}
              </select>
            </label>

            {builder === "puter" && (
              <label className="flex items-center gap-1.5 text-ink-faint">
                <span className="sr-only">Puter model</span>
                <select
                  aria-label="Puter model"
                  value={puterModel}
                  onChange={(event) => onPuterModel(event.target.value)}
                  className="max-w-[150px] cursor-pointer truncate border-0 bg-transparent py-0 pl-0 pr-4 text-ink-soft focus:outline-none"
                >
                  {PUTER_MODELS.map((model) => (
                    <option
                      key={model.id || "default"}
                      value={model.id}
                      className="bg-paper-2 text-ink"
                    >
                      {model.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onMode("cloud")}
                className={cn(
                  "inline-flex items-center gap-1 transition-colors",
                  mode === "cloud" ? "text-ember" : "text-ink-faint hover:text-ink-soft",
                )}
                title={
                  capabilities?.daytona
                    ? "Run files in a Daytona sandbox"
                    : "Needs DAYTONA_API_KEY"
                }
              >
                <Cloud className="h-3 w-3" />
                {mode === "cloud" ? "[cloud]" : "cloud"}
              </button>
              <button
                type="button"
                onClick={() => onMode("local")}
                className={cn(
                  "inline-flex items-center gap-1 transition-colors",
                  mode === "local" ? "text-ember" : "text-ink-faint hover:text-ink-soft",
                )}
                title="Files stay in this browser"
              >
                <Frame className="h-3 w-3" />
                {mode === "local" ? "[browser]" : "browser"}
              </button>
            </div>

            <div className="ml-auto flex items-center">
              {busy ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="inline-flex items-center gap-1.5 border border-alert/40 px-2.5 py-1 text-alert transition-colors hover:border-alert hover:bg-alert-soft"
                >
                  <Square className="h-2 w-2 fill-current" /> stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!value.trim()}
                  className="inline-flex items-center gap-1.5 border border-ember/40 px-2.5 py-1 text-ember transition-colors hover:border-ember hover:bg-ember-soft disabled:cursor-not-allowed disabled:border-line disabled:text-ink-faint"
                >
                  send <span className="text-[9px]">⏎</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

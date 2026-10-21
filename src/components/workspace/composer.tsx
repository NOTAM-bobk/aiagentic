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
    node.style.height = `${Math.min(node.scrollHeight, 168)}px`;
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
    { id: "gemini", label: "gemini-3.8-flash", ready: Boolean(capabilities?.google) },
    { id: "groq", label: "gpt-oss-120b", ready: Boolean(capabilities?.groq) },
    { id: "puter", label: "puter (free)", ready: true },
  ];

  return (
    <div className="border-t border-line bg-paper-2/30 px-3 pb-2.5 pt-2 sm:px-5">
      <div className="mx-auto max-w-2xl">
        <div className="border border-line bg-paper transition-colors focus-within:border-ember/50">
          <div className="flex items-start gap-2 px-2.5 pt-2.5">
            <span aria-hidden="true" className="select-none pt-px text-[12px] leading-relaxed text-ember">
              ❯
            </span>
            <label htmlFor="composer" className="sr-only">
              Describe a change or a new site
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
              placeholder={
                mode === "cloud"
                  ? "ask for a change, or describe a new site…"
                  : "describe the site — it builds and previews in your browser…"
              }
              className="max-h-[168px] min-h-[26px] w-full resize-none bg-transparent pb-2 font-mono text-[12.5px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line px-2.5 py-1.5 font-mono text-[10.5px]">
            <label className="flex items-center gap-1 text-ink-faint">
              builder
              <select
                aria-label="Builder model"
                value={builder}
                onChange={(event) => onBuilder(event.target.value)}
                className="max-w-[150px] cursor-pointer truncate border-0 bg-transparent py-0 pl-0 pr-3 text-ink-soft focus:outline-none"
              >
                {options.map((option) => (
                  <option key={option.id} value={option.id} className="bg-paper-2 text-ink">
                    {option.label}
                    {option.ready ? "" : " (key needed)"}
                  </option>
                ))}
              </select>
            </label>

            {builder === "puter" && (
              <label className="flex items-center gap-1 text-ink-faint">
                model
                <select
                  aria-label="Puter model"
                  value={puterModel}
                  onChange={(event) => onPuterModel(event.target.value)}
                  className="max-w-[150px] cursor-pointer truncate border-0 bg-transparent py-0 pl-0 pr-3 text-ink-soft focus:outline-none"
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

            <div className="flex items-center gap-2">
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
                    : "Needs DAYTONA_API_KEY — add it in setup"
                }
              >
                <Cloud className="h-2.5 w-2.5" />
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
                <Frame className="h-2.5 w-2.5" />
                {mode === "local" ? "[browser]" : "browser"}
              </button>
            </div>

            <span className="ml-auto hidden text-[9.5px] text-ink-faint sm:inline">
              shift+enter · newline
            </span>

            {busy ? (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex items-center gap-1.5 border border-alert/40 px-2 py-[3px] text-alert transition-colors hover:border-alert hover:bg-alert-soft"
              >
                <Square className="h-2 w-2 fill-current" /> stop
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!value.trim()}
                className="inline-flex items-center gap-1.5 border border-ember/40 px-2 py-[3px] text-ember transition-colors hover:border-ember hover:bg-ember-soft disabled:cursor-not-allowed disabled:border-line disabled:text-ink-faint"
              >
                run <span className="text-[9px]">⏎</span>
              </button>
            )}
          </div>
        </div>

        <p className="mt-1.5 hidden text-[9px] uppercase tracking-[0.1em] text-ink-faint sm:block">
          {mode === "cloud" ? "files run in a daytona sandbox" : "files stay in your browser"} ·
          enter to send
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Cloud, Frame, Square } from "lucide-react";
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
    { id: "gemini", label: "Gemini 3.8 Flash", hint: "Google AI Studio", ready: Boolean(capabilities?.google) },
    { id: "groq", label: "GPT-OSS 120B", hint: "Groq", ready: Boolean(capabilities?.groq) },
    { id: "puter", label: "Puter (free)", hint: "in-browser models", ready: true },
  ];

  return (
    <div className="border-t border-line bg-paper/95 px-3 pb-3 pt-2.5 backdrop-blur sm:px-5">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-line bg-paper shadow-[0_1px_0_rgba(20,18,14,0.03)] transition-colors focus-within:border-line-strong">
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
            placeholder={
              mode === "cloud"
                ? "Ask for a change — or describe a new site…"
                : "Describe the site. It builds and previews in your browser…"
            }
            className="max-h-[168px] w-full resize-none bg-transparent px-3.5 pb-2 pt-3 text-[13.5px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
          />

          <div className="flex flex-wrap items-center gap-2 px-2.5 pb-2.5 pt-1">
            <div className="relative">
              <select
                aria-label="Builder model"
                value={builder}
                onChange={(event) => onBuilder(event.target.value)}
                className="appearance-none rounded border border-line bg-paper-2/60 py-1 pl-2 pr-6 font-mono text-[10px] uppercase tracking-wider text-ink-soft transition-colors hover:border-line-strong focus:outline-none"
              >
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                    {option.ready ? "" : " — key needed"}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-ink-faint">
                ▾
              </span>
            </div>

            {builder === "puter" && (
              <div className="relative">
                <label htmlFor="puter-model" className="sr-only">
                  Puter model
                </label>
                <select
                  id="puter-model"
                  value={puterModel}
                  onChange={(event) => onPuterModel(event.target.value)}
                  className="appearance-none rounded border border-line bg-paper-2/60 py-1 pl-2 pr-6 font-mono text-[10px] uppercase tracking-wider text-ink-soft transition-colors hover:border-line-strong focus:outline-none"
                >
                  {PUTER_MODELS.map((model) => (
                    <option key={model.id || "default"} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-ink-faint">
                  ▾
                </span>
              </div>
            )}

            <div className="flex items-center rounded border border-line p-0.5">
              <button
                type="button"
                onClick={() => onMode("cloud")}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-1.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                  mode === "cloud" ? "bg-ink text-cream" : "text-ink-faint hover:text-ink",
                )}
                title={
                  capabilities?.daytona
                    ? "Run files in a Daytona sandbox"
                    : "Needs DAYTONA_API_KEY — add it in Setup"
                }
              >
                <Cloud className="h-2.5 w-2.5" /> Cloud
              </button>
              <button
                type="button"
                onClick={() => onMode("local")}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-1.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                  mode === "local" ? "bg-ink text-cream" : "text-ink-faint hover:text-ink",
                )}
                title="Files stay in this browser"
              >
                <Frame className="h-2.5 w-2.5" /> Browser
              </button>
            </div>

            <span className="ml-auto hidden font-mono text-[9.5px] text-ink-faint sm:block">
              enter to send
            </span>

            {busy ? (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex h-7 items-center gap-1.5 rounded bg-ink px-2.5 text-[11px] font-medium text-cream transition-colors hover:bg-ink/90"
              >
                <Square className="h-2.5 w-2.5 fill-current" /> Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!value.trim()}
                aria-label="Send"
                className="inline-flex h-7 items-center gap-1.5 rounded bg-ink px-2.5 text-[11px] font-medium text-cream transition-all hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Send <ArrowUp className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <p className="mt-2 hidden text-center font-mono text-[9px] uppercase tracking-wider text-ink-faint sm:block">
          {mode === "cloud" ? "files run in a Daytona sandbox" : "files stay in your browser"} · shift+enter for a new line
        </p>
      </div>
    </div>
  );
}

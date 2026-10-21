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
    node.style.height = `${Math.min(node.scrollHeight, 184)}px`;
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
    <div className="border-t border-line bg-paper-2/40 px-4 pb-4 pt-3 sm:px-8 sm:pb-6">
      <div className="mx-auto max-w-[47rem]">
        <div className="border border-line bg-paper transition-colors focus-within:border-ember/50">
          <div className="flex items-start gap-3 px-3.5 pt-3">
            <span aria-hidden="true" className="select-none pt-px text-[15px] leading-relaxed text-ember">
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
              placeholder={mode === "cloud" ? "ask anything, or describe what to build…" : "ask anything…"}
              className="max-h-[184px] min-h-[30px] w-full resize-none bg-transparent pb-3 font-mono text-[14px] leading-[1.7] text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-3 py-2 font-mono text-[12px]">
            <label className="flex items-center gap-1.5 text-ink-faint">
              <span className="sr-only">Builder model</span>
              <select
                aria-label="Builder model"
                value={builder}
                onChange={(event) => onBuilder(event.target.value)}
                className="max-w-[160px] cursor-pointer truncate border border-line bg-paper px-1.5 py-1.5 text-ink-soft transition-colors hover:border-line-strong hover:text-ink focus:outline-none"
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
                  className="max-w-[160px] cursor-pointer truncate border border-line bg-paper px-1.5 py-1.5 text-ink-soft transition-colors hover:border-line-strong hover:text-ink focus:outline-none"
                >
                  {PUTER_MODELS.map((model) => (
                    <option key={model.id || "default"} value={model.id} className="bg-paper-2 text-ink">
                      {model.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onMode("cloud")}
                title={capabilities?.daytona ? "Run files in a Daytona sandbox" : "Needs DAYTONA_API_KEY"}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 border px-2 py-1.5 transition-colors",
                  mode === "cloud"
                    ? "border-ember/40 bg-ember/10 text-ember"
                    : "border-line text-ink-faint hover:border-line-strong hover:text-ink",
                )}
              >
                <Cloud className="h-3.5 w-3.5" />
                cloud
              </button>
              <button
                type="button"
                onClick={() => onMode("local")}
                title="Files stay in this browser"
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 border px-2 py-1.5 transition-colors",
                  mode === "local"
                    ? "border-ember/40 bg-ember/10 text-ember"
                    : "border-line text-ink-faint hover:border-line-strong hover:text-ink",
                )}
              >
                <Frame className="h-3.5 w-3.5" />
                browser
              </button>
            </div>

            <div className="ml-auto flex items-center">
              {busy ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="inline-flex min-h-9 items-center gap-2 border border-alert/50 bg-alert-soft px-3.5 text-[12px] text-alert transition-colors hover:border-alert"
                >
                  <Square className="h-2.5 w-2.5 fill-current" /> stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!value.trim()}
                  className="inline-flex min-h-9 items-center gap-2 border border-ember/50 bg-ember/10 px-3.5 text-[12px] text-ember transition-colors hover:border-ember hover:bg-ember/15 disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-ink-faint"
                >
                  send <span className="text-[10px] opacity-70">⏎</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

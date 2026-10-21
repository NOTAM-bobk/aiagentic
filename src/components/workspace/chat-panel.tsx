"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight, Plug, Sparkles } from "lucide-react";
import type { Capabilities } from "@/lib/models";
import { STARTER_PROMPTS, type Project, type WorkspaceMode } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { MessageItem } from "./message-item";

const STATUS = [
  { key: "groq", label: "Groq planner" },
  { key: "google", label: "Gemini builder" },
  { key: "tavily", label: "Web search" },
  { key: "daytona", label: "Sandbox" },
  { key: "composio", label: "Connectors" },
] as const;

export function ChatPanel({
  project,
  capabilities,
  busy,
  phase,
  onSend,
  onStop,
  onBuilder,
  onPuterModel,
  onMode,
  onOpenSetup,
  onOpenIntegrations,
}: {
  project: Project | null;
  capabilities: Capabilities | null;
  busy: boolean;
  phase: string;
  onSend: (text: string) => void;
  onStop: () => void;
  onBuilder: (builder: string) => void;
  onPuterModel: (model: string) => void;
  onMode: (mode: WorkspaceMode) => void;
  onOpenSetup: () => void;
  onOpenIntegrations: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = project?.messages ?? [];
  const streamingRaw = project?.messages.at(-1)?.raw;

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages.length, phase, streamingRaw]);

  return (
    <section className="flex h-full min-h-0 flex-col border-line bg-paper">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {messages.length === 0 ? (
            <EmptyChat
              project={project}
              capabilities={capabilities}
              onSend={onSend}
              onOpenSetup={onOpenSetup}
              onOpenIntegrations={onOpenIntegrations}
            />
          ) : (
            messages.map((message) => <MessageItem key={message.id} message={message} phase={phase} />)
          )}
        </div>
      </div>

      <Composer
        builder={project?.builder ?? "puter"}
        puterModel={project?.puterModel ?? ""}
        mode={project?.mode ?? "local"}
        capabilities={capabilities}
        busy={busy}
        onSend={onSend}
        onStop={onStop}
        onBuilder={onBuilder}
        onPuterModel={onPuterModel}
        onMode={onMode}
      />
    </section>
  );
}

function EmptyChat({
  project,
  capabilities,
  onSend,
  onOpenSetup,
  onOpenIntegrations,
}: {
  project: Project | null;
  capabilities: Capabilities | null;
  onSend: (text: string) => void;
  onOpenSetup: () => void;
  onOpenIntegrations: () => void;
}) {
  return (
    <div className="animate-fade-up">
      <p className="label-xs flex items-center gap-2 text-ink-faint">
        <Sparkles className="h-3 w-3 text-ember" />
        {project?.title && project.title !== "Untitled site" ? project.title : "New session"}
      </p>
      <h1 className="mt-3 text-[1.9rem] leading-[1.06] tracking-[-0.03em] sm:text-[2.2rem]">
        What are we
        <span className="font-display italic text-ember"> building?</span>
      </h1>
      <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-ink-soft">
        Describe the site in plain words. Kiln drafts a plan, then writes real files and serves them
        live. You can change anything by asking.
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSend(prompt)}
            className="group flex items-start gap-2 rounded-md border border-line bg-paper px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-paper-2/50"
          >
            <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 text-ink-faint transition-colors group-hover:text-ember" />
            <span className="text-[12.5px] leading-relaxed text-ink-soft group-hover:text-ink">
              {prompt}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-8 rounded-md border border-line bg-paper-2/40 p-3.5">
        <div className="flex items-center justify-between">
          <p className="label-xs text-ink-faint">Session setup</p>
          <button
            type="button"
            onClick={onOpenSetup}
            className="font-mono text-[9.5px] uppercase tracking-wider text-ember hover:underline"
          >
            Configure
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
          {STATUS.map((item) => {
            const ready = capabilities?.[item.key] ?? false;
            return (
              <span key={item.key} className="inline-flex items-center gap-1.5 text-[11px]">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    ready ? "bg-moss" : "bg-line-strong",
                  )}
                />
                <span className={ready ? "text-ink-soft" : "text-ink-faint"}>{item.label}</span>
              </span>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onOpenIntegrations}
          className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-ink-soft transition-colors hover:text-ember"
        >
          <Plug className="h-3 w-3" /> Connect GitHub, Supabase, Cloudflare…
        </button>
      </div>
    </div>
  );
}

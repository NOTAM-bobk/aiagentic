"use client";

import { useEffect, useRef } from "react";
import { Plug } from "lucide-react";
import type { Capabilities } from "@/lib/models";
import type { Project, WorkspaceMode } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { MessageItem } from "./message-item";

const STATUS = [
  { key: "groq", label: "groq · planner" },
  { key: "google", label: "gemini · builder" },
  { key: "tavily", label: "tavily · search" },
  { key: "daytona", label: "daytona · sandbox" },
  { key: "composio", label: "composio · connectors" },
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
    <section className="flex h-full min-h-0 flex-col bg-paper">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {messages.length === 0 ? (
            <EmptyChat
              project={project}
              capabilities={capabilities}
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
  onOpenSetup,
  onOpenIntegrations,
}: {
  project: Project | null;
  capabilities: Capabilities | null;
  onOpenSetup: () => void;
  onOpenIntegrations: () => void;
}) {
  return (
    <div className="animate-fade-up font-mono">
      <p className="text-[10.5px] text-ink-faint">
        kiln v0.1 · agent ready
        {project?.title && project.title !== "untitled" ? ` · ${project.title}` : ""}
      </p>
      <h1 className="mt-4 text-[1.45rem] leading-tight tracking-tight text-ink sm:text-[1.6rem]">
        describe a site<span className="text-ember">_</span>
      </h1>
      <p className="mt-3 max-w-md text-[12px] leading-relaxed text-ink-soft">
        the agent plans it, writes real files, and runs the result live. ask for changes in the same
        thread — it edits the running site.
      </p>

      <div className="mt-7 border border-line">
        <div className="flex items-center justify-between border-b border-line bg-paper-2/40 px-2.5 py-1.5">
          <span className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">session</span>
          <button
            type="button"
            onClick={onOpenSetup}
            className="text-[10px] text-ember hover:underline"
          >
            configure
          </button>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 px-2.5 py-2.5">
          {STATUS.map((item) => {
            const ready = capabilities?.[item.key] ?? false;
            return (
              <span key={item.key} className="inline-flex items-center gap-1.5 text-[11px]">
                <span className={cn(ready ? "text-ember" : "text-ink-faint")}>
                  {ready ? "✓" : "—"}
                </span>
                <span className={ready ? "text-ink-soft" : "text-ink-faint"}>{item.label}</span>
              </span>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onOpenIntegrations}
          className="flex w-full items-center gap-1.5 border-t border-line px-2.5 py-1.5 text-left text-[11px] text-ink-soft transition-colors hover:bg-paper-2/50 hover:text-ember"
        >
          <Plug className="h-3 w-3" />
          <span className="text-ink-faint">&gt;</span> connect github, supabase, cloudflare…
        </button>
      </div>
    </div>
  );
}

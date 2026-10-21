"use client";

import { useEffect, useRef } from "react";
import type { Capabilities } from "@/lib/models";
import type { Project, WorkspaceMode } from "@/lib/protocol";
import { Composer } from "./composer";
import { MessageItem } from "./message-item";

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
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-7 sm:px-8 sm:py-10">
        <div className="mx-auto flex max-w-[46rem] flex-col gap-8">
          {messages.length === 0 ? (
            <EmptyChat />
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

function EmptyChat() {
  return (
    <div className="animate-fade-up py-10 font-mono sm:py-16">
      <p className="text-[11px] text-ember">kiln</p>
      <h1 className="mt-5 text-[1.6rem] leading-tight tracking-tight text-ink sm:text-[1.9rem]">
        what are we making?
      </h1>
      <p className="mt-4 max-w-md text-[13px] leading-relaxed text-ink-soft">
        Ask anything, or describe a site. It answers first, then builds when it knows enough.
      </p>
    </div>
  );
}

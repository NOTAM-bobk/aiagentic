"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { Capabilities } from "@/lib/models";
import type { ChatMode, Project, WorkspaceMode } from "@/lib/protocol";
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
  onChatMode,
  onToolkitConnected,
  onGitPush,
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
  onChatMode: (mode: ChatMode) => void;
  onToolkitConnected: (projectId: string, messageId: string, name: string) => void;
  onGitPush: (
    projectId: string,
    messageId: string,
    toolId: string,
    target: { repo: string; branch: string; message: string },
  ) => Promise<void>;
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
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto flex max-w-[47rem] flex-col gap-9">
          {messages.length === 0 ? (
            <EmptyChat />
          ) : (
            messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                phase={phase}
                onAnswer={onSend}
                onConnected={(name) =>
                  project && onToolkitConnected(project.id, message.id, name)
                }
                onGit={(toolId, target) =>
                  project
                    ? onGitPush(project.id, message.id, toolId, target)
                    : Promise.resolve()
                }
              />
            ))
          )}
        </div>
      </div>

      {busy && (
        <div className="border-t border-line bg-paper-2/50 px-4 py-2.5 sm:px-8">
          <div className="mx-auto flex max-w-[47rem] items-center gap-2.5 font-mono text-[12px] text-ink-soft">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-ember" />
            <span>{phase || "Working"}</span>
          </div>
        </div>
      )}

      <Composer
        builder={project?.builder ?? "puter"}
        puterModel={project?.puterModel ?? ""}
        mode={project?.mode ?? "local"}
        chatMode={project?.chatMode ?? "build"}
        capabilities={capabilities}
        busy={busy}
        onSend={onSend}
        onStop={onStop}
        onBuilder={onBuilder}
        onPuterModel={onPuterModel}
        onMode={onMode}
        onChatMode={onChatMode}
      />
    </section>
  );
}

function EmptyChat() {
  return (
    <div className="animate-fade-up py-10 font-mono sm:py-16">
      <p className="text-[12px] text-ember">kiln</p>
      <h1 className="mt-6 text-[1.85rem] leading-tight tracking-tight text-ink sm:text-[2.15rem]">
        what are we making?
      </h1>
      <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-ink-soft">
        Ask anything, or describe what you want built. <span className="text-ink">plan</span> thinks
        it through with you and writes nothing; <span className="text-ink">build</span> writes real
        files and runs them. Switch modes in the prompt bar.
      </p>
    </div>
  );
}

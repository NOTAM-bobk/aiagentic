"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronRight, Loader2 } from "lucide-react";
import type { ChatMessage, ToolEvent } from "@/lib/protocol";
import { streamPreview } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { getUserId } from "@/hooks/use-workspace";
import { PlanCard } from "./plan-card";

const VERBS: Record<ToolEvent["kind"], string> = {
  plan: "plan",
  search: "search",
  write: "write",
  shell: "exec",
  connect: "connect",
  delete: "rm",
  sandbox: "sandbox",
};

function StatusGlyph({ status }: { status: ToolEvent["status"] }) {
  if (status === "running") {
    return (
      <span className="inline-flex w-3 shrink-0 justify-center">
        <Loader2 className="h-2.5 w-2.5 animate-spin text-ember" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "w-3 shrink-0 text-center",
        status === "ok" && "text-ember",
        status === "error" && "text-alert",
        status === "pending" && "text-warn",
      )}
    >
      {status === "ok" ? "✓" : status === "error" ? "✗" : "?"}
    </span>
  );
}

function ToolRow({ tool }: { tool: ToolEvent }) {
  const [open, setOpen] = useState(false);
  const url = typeof tool.meta?.url === "string" ? tool.meta.url : null;
  const action = typeof tool.meta?.action === "string" ? tool.meta.action : null;

  return (
    <div className="font-mono">
      <div className="flex items-baseline gap-2 py-1 text-[11.5px] leading-relaxed">
        <StatusGlyph status={tool.status} />
        <span className="shrink-0 text-ink-faint">{VERBS[tool.kind] ?? tool.kind}</span>
        {tool.output || url ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            disabled={!tool.output && !url}
            className="group flex min-w-0 flex-1 items-baseline gap-2 text-left"
          >
            <span className="min-w-0 truncate text-ink-soft group-hover:text-ink">{tool.label}</span>
            {tool.output && (
              <ChevronRight
                className={cn(
                  "h-2.5 w-2.5 shrink-0 text-ink-faint transition-transform",
                  open && "rotate-90",
                )}
              />
            )}
          </button>
        ) : (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-ink-soft">{tool.label}</span>
          </span>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-[10px] text-ember hover:underline"
          >
            open ↗
          </a>
        )}
      </div>

      {open && tool.output && (
        <pre className="ml-5 max-h-56 overflow-auto border-l border-line py-1 pl-2.5 text-[10.5px] leading-relaxed whitespace-pre-wrap break-words text-ink-faint">
          {tool.output}
        </pre>
      )}

      {action && <ActionApproval action={action} args={String(tool.meta?.args ?? "{}")} />}
    </div>
  );
}

function ActionApproval({ action, args }: { action: string; args: string }) {
  const [state, setState] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setState("running");
    setResult(null);
    try {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(args || "{}") as Record<string, unknown>;
      } catch {
        throw new Error("The model produced invalid JSON arguments.");
      }
      const response = await fetch("/api/integrations/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, args: parsed, userId: getUserId() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Action failed.");
      setState("ok");
      setResult(JSON.stringify(data.data ?? data, null, 2));
    } catch (error) {
      setState("error");
      setResult(error instanceof Error ? error.message : "Action failed.");
    }
  }

  return (
    <div className="ml-5 border-l border-line py-1 pl-2.5">
      <div className="flex flex-wrap items-baseline gap-2 font-mono text-[10.5px]">
        <span className="text-ink-faint">needs approval</span>
        <button
          type="button"
          onClick={run}
          disabled={state === "running" || state === "ok"}
          className="inline-flex items-center gap-1 border border-ember/40 px-1.5 py-px text-ember transition-colors hover:border-ember hover:bg-ember-soft disabled:border-line disabled:text-ink-faint"
        >
          {state === "running" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
          {state === "ok" ? "ran ✓" : state === "running" ? "running" : "approve"}
        </button>
      </div>
      {result && (
        <pre
          className={cn(
            "mt-1.5 max-h-44 overflow-auto border-l py-1 pl-2.5 font-mono text-[10px] leading-relaxed whitespace-pre-wrap break-words",
            state === "error" ? "border-alert/50 text-alert" : "border-line text-ink-faint",
          )}
        >
          {result}
        </pre>
      )}
    </div>
  );
}

export function MessageItem({ message, phase }: { message: ChatMessage; phase: string }) {
  if (message.role === "user") {
    return (
      <div className="flex gap-2.5 font-mono">
        <span aria-hidden="true" className="select-none text-[13px] leading-relaxed text-ember">
          ❯
        </span>
        <p className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
          {message.content}
        </p>
      </div>
    );
  }

  const tools = message.tools ?? [];
  const preview = message.raw ? streamPreview(message.raw) : "";
  const streaming = Boolean(message.pending);

  return (
    <div className="flex flex-col gap-3 font-mono">
      {message.plan && <PlanCard plan={message.plan} />}

      {tools.length > 0 && (
        <div className="border-l border-line pl-3">
          {tools.map((tool) => (
            <ToolRow key={tool.id} tool={tool} />
          ))}
        </div>
      )}

      {streaming && (
        <div>
          <p className="flex items-center gap-2 text-[11px] text-ink-faint">
            <span className="text-ember animate-pulse-dot">▌</span>
            {phase || "working"}
          </p>
          {preview && (
            <p className="caret mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">
              {preview}
            </p>
          )}
        </div>
      )}

      {message.content && !streaming && (
        <div className="markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      )}

      {message.error && (
        <div className="border-l border-alert/60 pl-3 font-mono">
          <p className="text-[11px] text-alert">✗ {message.error}</p>
        </div>
      )}
    </div>
  );
}

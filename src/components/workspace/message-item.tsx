"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  Compass,
  FileCode2,
  Loader2,
  Plug,
  Search,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import type { ChatMessage, ToolEvent } from "@/lib/protocol";
import { streamPreview } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { getUserId } from "@/hooks/use-workspace";
import { PlanCard } from "./plan-card";

const ICONS = {
  plan: Compass,
  search: Search,
  write: FileCode2,
  shell: Terminal,
  connect: Plug,
  delete: Trash2,
  sandbox: Box,
} as const;

function ToolRow({ tool }: { tool: ToolEvent }) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[tool.kind] ?? Box;
  const url = typeof tool.meta?.url === "string" ? tool.meta.url : null;
  const action = typeof tool.meta?.action === "string" ? tool.meta.action : null;

  return (
    <div className="rounded-md border border-line bg-paper">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        disabled={!tool.output && !url}
        className={cn(
          "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left",
          (tool.output || url) && "hover:bg-paper-2/60",
        )}
      >
        <Icon className="h-3 w-3 shrink-0 text-ink-faint" strokeWidth={1.7} />
        <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{tool.label}</span>
        {tool.detail && (
          <span className="hidden max-w-[45%] truncate font-mono text-[9.5px] text-ink-faint sm:block">
            {tool.detail}
          </span>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink transition-colors hover:border-ember hover:text-ember"
          >
            Open <ArrowUpRight className="h-2.5 w-2.5" />
          </a>
        )}
        {tool.status === "pending" && (
          <span className="shrink-0 rounded border border-ember/30 px-1 font-mono text-[9px] uppercase tracking-wider text-ember">
            approve
          </span>
        )}
        {tool.status === "running" && (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-ember" strokeWidth={2} />
        )}
        {tool.status === "ok" && <Check className="h-3 w-3 shrink-0 text-moss" strokeWidth={2.2} />}
        {tool.status === "error" && <X className="h-3 w-3 shrink-0 text-ember" strokeWidth={2.2} />}
        {tool.output && (
          <ChevronRight
            className={cn("h-3 w-3 shrink-0 text-ink-faint transition-transform", open && "rotate-90")}
          />
        )}
      </button>

      {open && tool.output && (
        <pre className="max-h-56 overflow-auto border-t border-line bg-paper-2/40 px-2.5 py-2 font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap break-words text-ink-soft">
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
    <div className="border-t border-line bg-paper-2/30 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] text-ink-faint">
          This runs a real connector action. Nothing happens until you approve.
        </p>
        <button
          type="button"
          onClick={run}
          disabled={state === "running" || state === "ok"}
          className="inline-flex shrink-0 items-center gap-1 rounded bg-ink px-2 py-1 text-[10.5px] text-cream disabled:opacity-50"
        >
          {state === "running" ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
          ) : state === "ok" ? (
            <Check className="h-2.5 w-2.5" />
          ) : null}
          {state === "ok" ? "Ran" : state === "running" ? "Running" : "Approve & run"}
        </button>
      </div>
      {result && (
        <pre
          className={cn(
            "mt-2 max-h-44 overflow-auto rounded border px-2 py-1.5 font-mono text-[10px] leading-relaxed whitespace-pre-wrap break-words",
            state === "error"
              ? "border-ember/30 bg-ember-soft/40 text-ember"
              : "border-line bg-paper text-ink-soft",
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
      <div className="flex flex-col items-end gap-1.5">
        <span className="label-xs text-ink-faint">You</span>
        <div className="max-w-[92%] rounded-lg rounded-tr-sm border border-line bg-paper-2/70 px-3.5 py-2.5">
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{message.content}</p>
        </div>
      </div>
    );
  }

  const tools = message.tools ?? [];
  const preview = message.raw ? streamPreview(message.raw) : "";
  const streaming = Boolean(message.pending);

  return (
    <div className="flex flex-col gap-2.5">
      <span className="label-xs flex items-center gap-1.5 text-ink-faint">
        Kiln
        {streaming && <span className="h-1 w-1 rounded-full bg-ember animate-pulse-dot" />}
      </span>

      {message.plan && <PlanCard plan={message.plan} />}

      {tools.length > 0 && (
        <div className="space-y-1.5">
          {tools.map((tool) => (
            <ToolRow key={tool.id} tool={tool} />
          ))}
        </div>
      )}

      {streaming && (
        <div className="rounded-md border border-line/70 bg-paper px-3.5 py-2.5">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            <span className="h-1.5 w-1.5 rounded-full bg-ember animate-pulse-dot" />
            {phase || "Working"}
          </p>
          {preview && (
            <p className="caret mt-1.5 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-soft">
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
        <div className="rounded-md border border-ember/30 bg-ember-soft/50 px-3.5 py-2.5">
          <p className="text-[12px] font-medium text-ember">That step didn&apos;t finish</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{message.error}</p>
          <p className="mt-2 font-mono text-[10px] text-ink-faint">
            Try again, switch the builder, or check Setup for missing keys.
          </p>
        </div>
      )}
    </div>
  );
}

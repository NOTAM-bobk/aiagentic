"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronRight, GitBranch, Loader2, LogIn } from "lucide-react";
import type { ChatMessage, Question, ToolEvent } from "@/lib/protocol";
import { currentActivity, streamPreview, streamThink } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { getUserId } from "@/hooks/use-workspace";
import { PlanCard } from "./plan-card";

const VERBS: Record<ToolEvent["kind"], string> = {
  plan: "plan",
  search: "search",
  write: "write",
  edit: "edit",
  shell: "exec",
  test: "test",
  run: "run",
  connect: "connect",
  git: "git",
  delete: "rm",
  sandbox: "sandbox",
};

function StatusGlyph({ status }: { status: ToolEvent["status"] }) {
  if (status === "running") {
    return (
      <span className="inline-flex w-3.5 shrink-0 justify-center">
        <Loader2 className="h-3 w-3 animate-spin text-ember" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "w-3.5 shrink-0 text-center text-[11px]",
        status === "ok" && "text-ember",
        status === "error" && "text-alert",
        status === "pending" && "text-warn",
      )}
    >
      {status === "ok" ? "✓" : status === "error" ? "✗" : "?"}
    </span>
  );
}

function ToolRow({
  tool,
  onConnected,
  onGit,
}: {
  tool: ToolEvent;
  onConnected?: (name: string) => void;
  onGit?: (toolId: string, target: GitTarget) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const url = typeof tool.meta?.url === "string" ? tool.meta.url : null;
  const action = typeof tool.meta?.action === "string" ? tool.meta.action : null;
  const connect = tool.meta?.connect === true && tool.kind === "connect";
  const git = tool.meta?.git === true && tool.kind === "git";
  const connectName = tool.label.replace(/^Connect /, "");

  return (
    <div className="animate-fade-up font-mono">
      <div className="flex items-center gap-2.5 py-1.5 text-[12px] leading-relaxed">
        <StatusGlyph status={tool.status} />
        <span className="shrink-0 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
          {VERBS[tool.kind] ?? tool.kind}
        </span>
        {!connect && (tool.output || url) ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="group flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="min-w-0 flex-1 truncate text-ink-soft group-hover:text-ink">
              {tool.label}
              {tool.detail && <span className="ml-2 text-ink-faint">{tool.detail}</span>}
            </span>
            <ChevronRight
              className={cn("h-3 w-3 shrink-0 text-ink-faint transition-transform", open && "rotate-90")}
            />
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate text-ink-soft">
            {tool.label}
            {tool.detail && <span className="ml-2 text-ink-faint">{tool.detail}</span>}
          </span>
        )}
        {!connect && url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-[11.5px] text-ember hover:underline"
          >
            open ↗
          </a>
        )}
      </div>

      {connect && tool.status === "pending" && url && (
        <div className="ml-6 border-l border-line py-1.5 pl-3">
          <ConnectButton
            toolkit={String(tool.meta?.toolkit ?? "")}
            name={connectName}
            url={url}
            onConnected={() => onConnected?.(connectName)}
          />
          {tool.output && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">{tool.output}</p>
          )}
        </div>
      )}

      {open && tool.output && (
        <pre className="ml-6 mb-1.5 max-h-64 overflow-auto border-l border-line py-1 pl-3 text-[11.5px] leading-relaxed whitespace-pre-wrap break-words text-ink-soft">
          {tool.output}
        </pre>
      )}

      {git && (
        <GitPush
          tool={tool}
          onGit={onGit}
        />
      )}

      {action && <ActionApproval action={action} args={String(tool.meta?.args ?? "{}")} />}
    </div>
  );
}

function GitPush({
  tool,
  onGit,
}: {
  tool: ToolEvent;
  onGit?: (toolId: string, target: GitTarget) => Promise<void>;
}) {
  const [running, setRunning] = useState(false);
  const repo = String(tool.meta?.repo ?? "");
  const branch = String(tool.meta?.branch ?? "main");
  const message = String(tool.meta?.message ?? "Update from Kiln");

  if (tool.status !== "pending") return null;

  return (
    <div className="ml-6 border-l border-line py-1 pl-3">
      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-ink-faint">
        <span>needs approval</span>
        <button
          type="button"
          onClick={async () => {
            setRunning(true);
            try {
              await onGit?.(tool.id, { repo, branch, message });
            } finally {
              setRunning(false);
            }
          }}
          disabled={running}
          className="inline-flex min-h-8 items-center gap-1.5 border border-ember/40 bg-ember/10 px-2.5 text-ember transition-colors hover:border-ember disabled:opacity-60"
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitBranch className="h-3 w-3" />}
          push to GitHub
        </button>
        <span className="text-ink-faint">{repo}</span>
      </div>
    </div>
  );
}

type GitTarget = { repo: string; branch: string; message: string };

function ThinkingBlock({ text, live }: { text: string; live: boolean }) {
  const [open, setOpen] = useState(true);

  if (!text) return null;

  return (
    <div className="font-mono">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-faint transition-colors hover:text-ink-soft"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        {live ? "thinking" : "reasoning"}
        {live && <span className="animate-pulse-dot text-ember">▌</span>}
      </button>
      {open && (
        <div className="mt-1.5 border-l-2 border-line pl-3">
          <p
            className={cn(
              "whitespace-pre-wrap text-[12.5px] leading-[1.75] text-ink-soft/90",
              live && "caret",
            )}
          >
            {text}
          </p>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  onAnswer,
  hideText,
}: {
  question: Question;
  onAnswer?: (text: string) => void;
  hideText: boolean;
}) {
  const [sent, setSent] = useState<string | null>(null);

  return (
    <div className="border border-ember/30 bg-ember-soft/50 px-4 py-3.5">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ember">
        your turn
      </p>
      {!hideText && (
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink">{question.text}</p>
      )}
      {question.options.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {question.options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={Boolean(sent)}
              onClick={() => {
                setSent(option);
                onAnswer?.(option);
              }}
              className={cn(
                "border px-3 py-2 font-mono text-[12.5px] leading-none transition-colors",
                sent === option
                  ? "border-ember bg-ember/15 text-ember"
                  : "border-line-strong bg-paper text-ink hover:border-ember hover:text-ember",
                sent && sent !== option && "opacity-50",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      )}
      {question.options.length > 0 && (
        <p className="mt-2.5 font-mono text-[11px] text-ink-faint">pick one, or answer in your own words</p>
      )}
    </div>
  );
}

function ConnectButton({
  toolkit,
  name,
  url,
  onConnected,
}: {
  toolkit: string;
  name: string;
  url: string;
  onConnected?: () => void;
}) {
  const [state, setState] = useState<"idle" | "waiting" | "connected" | "timeout">("idle");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  async function isConnected(): Promise<boolean> {
    try {
      const response = await fetch(`/api/integrations?userId=${encodeURIComponent(getUserId())}`, {
        cache: "no-store",
      });
      if (!response.ok) return false;
      const data = (await response.json()) as { toolkits?: { slug: string; connected: boolean }[] };
      return Boolean(data.toolkits?.find((item) => item.slug === toolkit)?.connected);
    } catch {
      return false;
    }
  }

  function poll() {
    const deadline = Date.now() + 180_000;
    const tick = async () => {
      if (await isConnected()) {
        setState("connected");
        onConnected?.();
        return;
      }
      if (Date.now() > deadline) {
        setState("timeout");
        return;
      }
      timer.current = window.setTimeout(tick, 3000);
    };
    timer.current = window.setTimeout(tick, 2500);
  }

  function start() {
    window.open(url, "_blank", "noopener,noreferrer");
    setState("waiting");
    poll();
  }

  if (state === "connected") {
    return (
      <span className="inline-flex min-h-8 items-center gap-1.5 border border-ember/40 bg-ember/10 px-2.5 text-[11.5px] text-ember">
        ✓ {name} connected
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={start}
        disabled={state === "waiting"}
        className="inline-flex min-h-8 items-center gap-1.5 border border-ember/50 bg-ember/10 px-3 text-[11.5px] text-ember transition-colors hover:border-ember disabled:opacity-70"
      >
        {state === "waiting" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <LogIn className="h-3 w-3" />
        )}
        {state === "waiting" ? `waiting for ${name}…` : `Log in to ${name}`}
      </button>
      {state === "waiting" && (
        <span className="text-[11px] text-ink-faint">finish in the tab that opened</span>
      )}
      {state === "timeout" && (
        <span className="text-[11px] text-ink-faint">
          not confirmed yet —{" "}
          <button type="button" onClick={start} className="text-ember underline">
            try again
          </button>
        </span>
      )}
    </span>
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
    <div className="ml-6 border-l border-line py-1 pl-3">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[11.5px]">
        <span className="text-ink-faint">needs approval</span>
        <button
          type="button"
          onClick={run}
          disabled={state === "running" || state === "ok"}
          className="inline-flex min-h-8 items-center gap-1.5 border border-ember/40 px-2.5 text-ember transition-colors hover:border-ember hover:bg-ember-soft disabled:border-line disabled:text-ink-faint"
        >
          {state === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {state === "ok" ? "ran ✓" : state === "running" ? "running" : "approve"}
        </button>
      </div>
      {result && (
        <pre
          className={cn(
            "mt-2 max-h-48 overflow-auto border-l py-1 pl-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words",
            state === "error" ? "border-alert/50 text-alert" : "border-line text-ink-soft",
          )}
        >
          {result}
        </pre>
      )}
    </div>
  );
}

export function MessageItem({
  message,
  phase,
  onAnswer,
  onConnected,
  onGit,
}: {
  message: ChatMessage;
  phase: string;
  onAnswer?: (text: string) => void;
  onConnected?: (name: string) => void;
  onGit?: (toolId: string, target: GitTarget) => Promise<void>;
}) {
  const streaming = Boolean(message.pending);
  const rawThink = message.raw ? streamThink(message.raw) : "";
  const thinking = streaming ? rawThink || message.thinking || "" : message.thinking || "";
  const activity = message.raw ? currentActivity(message.raw) : "";

  if (message.role === "user") {
    return (
      <div className="flex gap-3 font-mono">
        <span aria-hidden="true" className="select-none pt-px text-[14px] leading-relaxed text-ember">
          ❯
        </span>
        <p className="min-w-0 flex-1 whitespace-pre-wrap text-[14px] leading-[1.7] text-ink">
          {message.content}
        </p>
      </div>
    );
  }

  const tools = message.tools ?? [];
  const preview = message.raw ? streamPreview(message.raw) : "";

  return (
    <div className="flex flex-col gap-3.5">
      {thinking && <ThinkingBlock text={thinking} live={streaming} />}

      {message.plan && <PlanCard plan={message.plan} />}

      {tools.length > 0 && (
        <div className="border-l border-line pl-3.5">
          {tools.map((tool) => (
            <ToolRow key={tool.id} tool={tool} onConnected={onConnected} onGit={onGit} />
          ))}
        </div>
      )}

      {streaming && (
        <div className="flex items-start gap-2.5 font-mono text-[12px] leading-relaxed">
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-ember" />
          <div className="min-w-0">
            <p className="text-ink-soft">
              {phase || "Working"}
              {activity && <span className="text-ink-faint"> · {activity}</span>}
            </p>
            {preview && (
              <p className="caret mt-1.5 whitespace-pre-wrap text-[14px] leading-[1.7] text-ink-soft">
                {preview}
              </p>
            )}
          </div>
        </div>
      )}

      {message.content && !streaming && (
        <div className="markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      )}

      {message.question && !streaming && (
        <QuestionCard
          question={message.question}
          onAnswer={onAnswer}
          hideText={message.content.trim() === message.question.text.trim()}
        />
      )}

      {message.error && (
        <div className="border-l-2 border-alert/60 pl-3">
          <p className="font-mono text-[12px] leading-relaxed text-alert">✗ {message.error}</p>
        </div>
      )}
    </div>
  );
}

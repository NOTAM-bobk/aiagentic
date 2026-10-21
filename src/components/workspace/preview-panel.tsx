"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Loader2,
  Monitor,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import type { Project } from "@/lib/protocol";
import { bundleHtml, cn } from "@/lib/utils";

export type PanelTab = "preview" | "files" | "activity";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "preview", label: "preview" },
  { id: "files", label: "files" },
  { id: "activity", label: "logs" },
];

export function PreviewPanel({
  project,
  tab,
  onTab,
  onRefresh,
  refreshing,
  onRefreshFiles,
  syncFiles,
  onExport,
}: {
  project: Project | null;
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onRefreshFiles: () => void;
  syncFiles: boolean;
  onExport: () => void;
}) {
  const counts = project?.files.length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-paper-2/30 px-3 py-2 font-mono">
        <div className="flex items-center gap-3">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTab(item.id)}
              className={cn(
                "text-[10.5px] transition-colors",
                tab === item.id ? "text-ember" : "text-ink-faint hover:text-ink-soft",
              )}
            >
              {tab === item.id ? `[ ${item.label}${item.id === "files" && counts > 0 ? ` ${counts}` : ""} ]` : item.label + (item.id === "files" && counts > 0 ? ` ${counts}` : "")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {tab === "files" && project?.mode === "cloud" && (
            <button
              type="button"
              onClick={onRefreshFiles}
              aria-label="Sync files from sandbox"
              className="p-1 text-ink-faint transition-colors hover:text-ink"
            >
              <RefreshCw className={cn("h-3 w-3", syncFiles && "animate-spin")} />
            </button>
          )}
          <button
            type="button"
            onClick={onExport}
            disabled={!project || counts === 0}
            className="inline-flex items-center gap-1 border border-line px-1.5 py-0.5 text-[10px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-2.5 w-2.5" /> export
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "preview" && (
          <PreviewTab project={project} onRefresh={onRefresh} refreshing={refreshing} />
        )}
        {tab === "files" && <FilesTab project={project} />}
        {tab === "activity" && <ActivityTab project={project} />}
      </div>
    </div>
  );
}

function PreviewTab({
  project,
  onRefresh,
  refreshing,
}: {
  project: Project | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [nonce, setNonce] = useState(0);

  const html = useMemo(() => {
    if (!project || project.mode !== "local") return "";
    return bundleHtml(project.files);
  }, [project]);

  const cloudUrl = project?.mode === "cloud" ? project.previewUrl ?? null : null;
  const hasFiles = (project?.files.length ?? 0) > 0;

  if (!project || !hasFiles) {
    return <EmptyPanel title="no site yet" lines={["it renders here after the first build."]} />;
  }

  if (project.mode === "cloud" && !cloudUrl) {
    return (
      <EmptyPanel
        title="not running"
        lines={["start the server to get a signed url."]}
        action={
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 border border-ember/40 px-2 py-1 font-mono text-[10.5px] text-ember transition-colors hover:border-ember hover:bg-ember-soft disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
            start preview
          </button>
        }
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-2.5 py-1 font-mono text-[10px]">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
          <span className="min-w-0 truncate text-ink-faint">
            {cloudUrl ? cloudUrl.replace(/^https?:\/\//, "").split("?")[0] : "localhost · index.html"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Desktop width"
            onClick={() => setDevice("desktop")}
            className={cn("p-1", device === "desktop" ? "text-ink" : "text-ink-faint hover:text-ink-soft")}
          >
            <Monitor className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Phone width"
            onClick={() => setDevice("phone")}
            className={cn("p-1", device === "phone" ? "text-ink" : "text-ink-faint hover:text-ink-soft")}
          >
            <Smartphone className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Reload preview"
            onClick={() => {
              setNonce((value) => value + 1);
              if (project.mode === "cloud") onRefresh();
            }}
            className="p-1 text-ink-faint transition-colors hover:text-ink"
          >
            <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
          </button>
          {cloudUrl && (
            <a
              href={cloudUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1 text-ink-faint transition-colors hover:text-ember"
              aria-label="Open preview in a new tab"
            >
              ↗
            </a>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-night p-2.5">
        <div
          className={cn(
            "mx-auto h-full overflow-hidden border border-line bg-white transition-[max-width]",
            device === "phone" ? "max-w-[390px]" : "max-w-none",
          )}
        >
          <iframe
            key={`${cloudUrl ?? "local"}-${nonce}`}
            title="Website preview"
            src={cloudUrl ?? undefined}
            srcDoc={cloudUrl ? undefined : html}
            className="h-full min-h-[320px] w-full"
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
          />
        </div>
      </div>
    </div>
  );
}

function FilesTab({ project }: { project: Project | null }) {
  const files = project?.files ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const current = files.find((file) => file.path === selected) ?? files[0] ?? null;

  if (files.length === 0) {
    return <EmptyPanel title="no files" lines={["they appear here after a build."]} />;
  }

  async function copy() {
    if (!current) return;
    await navigator.clipboard.writeText(current.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-full min-h-0 flex-col font-mono sm:flex-row">
      <div className="max-h-32 shrink-0 overflow-auto border-b border-line sm:max-h-none sm:w-44 sm:border-b-0 sm:border-r">
        <ul className="py-1.5">
          {files.map((file) => {
            const isCurrent = current?.path === file.path;
            return (
              <li key={file.path}>
                <button
                  type="button"
                  onClick={() => setSelected(file.path)}
                  className={cn(
                    "flex w-full items-center gap-1.5 border-l-2 px-2 py-1 text-left text-[10.5px] transition-colors",
                    isCurrent
                      ? "border-l-ember bg-paper-2/70 text-ink"
                      : "border-l-transparent text-ink-faint hover:bg-paper-2/40 hover:text-ink-soft",
                  )}
                >
                  <span className={isCurrent ? "text-ember" : "text-ink-faint"}>▸</span>
                  <span className="truncate">{file.path}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-line px-2.5 py-1 font-mono text-[10px]">
          <span className="truncate text-ink-soft">{current?.path}</span>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Copied" : "Copy file"}
            className="inline-flex items-center text-ink-faint transition-colors hover:text-ember"
          >
            {copied ? <Check className="h-3 w-3 text-ember" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-paper px-3 py-2">
          <pre className="font-mono text-[10.5px] leading-[1.75] text-ink-soft">
            {(current?.content ?? "").split("\n").map((line, index) => (
              <div key={index} className="flex">
                <span className="w-8 shrink-0 select-none pr-3 text-right text-ink-faint/50">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                  {line || "\u00a0"}
                </span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}

function ActivityTab({ project }: { project: Project | null }) {
  const tools = (project?.messages ?? []).flatMap((message) =>
    (message.tools ?? []).map((tool) => ({ ...tool, at: message.createdAt })),
  );

  return (
    <div className="flex h-full min-h-0 flex-col font-mono">
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2.5">
        {tools.length === 0 ? (
          <p className="py-10 text-center text-[11px] text-ink-faint">no activity</p>
        ) : (
          <ul className="space-y-1">
            {tools.map((tool) => (
              <li key={tool.id} className="flex items-start gap-2 text-[10.5px] leading-relaxed">
                <span className="shrink-0 text-ink-faint">
                  {new Date(tool.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span
                  className={cn(
                    "w-3 shrink-0",
                    tool.status === "ok" && "text-ember",
                    tool.status === "error" && "text-alert",
                    tool.status === "running" && "text-ember animate-pulse-dot",
                    tool.status === "pending" && "text-warn",
                  )}
                >
                  {tool.status === "ok" ? "✓" : tool.status === "error" ? "✗" : "·"}
                </span>
                <span className="min-w-0 flex-1 text-ink-soft">
                  <span className="text-ink">{tool.label}</span>
                  {tool.detail ? ` — ${tool.detail}` : ""}
                  {tool.output && (
                    <span className="mt-0.5 block truncate text-ink-faint">{tool.output}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyPanel({
  title,
  lines,
  action,
}: {
  title: string;
  lines: string[];
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-16 font-mono text-center">
      <p className="text-[11.5px] text-ink-faint">
        <span className="text-ember">&gt;</span> {title}
      </p>
      <div className="mt-2.5 space-y-1">
        {lines.map((line) => (
          <p key={line} className="text-[11px] leading-relaxed text-ink-faint/80">
            {line}
          </p>
        ))}
      </div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

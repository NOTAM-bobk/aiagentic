"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  Loader2,
  Monitor,
  RefreshCw,
  Smartphone,
  Terminal,
} from "lucide-react";
import type { Project } from "@/lib/protocol";
import { bundleHtml, cn } from "@/lib/utils";

export type PanelTab = "preview" | "files" | "activity";

const TABS: { id: PanelTab; label: string; icon: typeof Monitor }[] = [
  { id: "preview", label: "Preview", icon: Monitor },
  { id: "files", label: "Files", icon: FileCode2 },
  { id: "activity", label: "Activity", icon: Terminal },
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
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 sm:px-4">
        <div className="flex items-center gap-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTab(item.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] transition-colors",
                tab === item.id
                  ? "bg-paper-2 text-ink"
                  : "text-ink-faint hover:bg-paper-2/60 hover:text-ink",
              )}
            >
              <item.icon className="h-3 w-3" strokeWidth={1.7} />
              {item.label}
              {item.id === "files" && counts > 0 && (
                <span className="font-mono text-[9px] text-ink-faint">{counts}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {tab === "files" && project?.mode === "cloud" && (
            <button
              type="button"
              onClick={onRefreshFiles}
              aria-label="Sync files from sandbox"
              className="rounded border border-line p-1 text-ink-faint transition-colors hover:text-ink"
            >
              <RefreshCw className={cn("h-3 w-3", syncFiles && "animate-spin")} />
            </button>
          )}
          <button
            type="button"
            onClick={onExport}
            disabled={!project || counts === 0}
            className="inline-flex items-center gap-1.5 rounded border border-line px-2 py-1 text-[11px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3 w-3" /> Export
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
    return (
      <EmptyPanel
        icon={Monitor}
        title="Nothing to preview yet"
        body="Describe a site in the chat. Kiln writes the files, starts a sandbox, and the running page appears here."
      />
    );
  }

  if (project.mode === "cloud" && !cloudUrl) {
    return (
      <EmptyPanel
        icon={Loader2}
        title="Files are ready, server isn't"
        body="Start the preview server to get a signed URL for this sandbox."
        action={
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded bg-ink px-3 py-1.5 text-[12px] text-cream transition-colors hover:bg-ink/90 disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Start preview
          </button>
        }
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line bg-paper-2/40 px-3 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded border border-line bg-paper px-2 py-1">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
          <span className="min-w-0 truncate font-mono text-[10px] text-ink-soft">
            {cloudUrl ? cloudUrl.replace(/^https?:\/\//, "").split("?")[0] : "browser preview · index.html"}
          </span>
        </div>

        <div className="flex items-center rounded border border-line p-0.5">
          <button
            type="button"
            aria-label="Desktop width"
            onClick={() => setDevice("desktop")}
            className={cn("rounded p-1", device === "desktop" ? "bg-paper-2 text-ink" : "text-ink-faint")}
          >
            <Monitor className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Phone width"
            onClick={() => setDevice("phone")}
            className={cn("rounded p-1", device === "phone" ? "bg-paper-2 text-ink" : "text-ink-faint")}
          >
            <Smartphone className="h-3 w-3" />
          </button>
        </div>

        <button
          type="button"
          aria-label="Reload preview"
          onClick={() => {
            setNonce((value) => value + 1);
            if (project.mode === "cloud") onRefresh();
          }}
          className="rounded border border-line p-1 text-ink-faint transition-colors hover:text-ink"
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
        </button>

        {cloudUrl && (
          <a
            href={cloudUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open preview in a new tab"
            className="rounded border border-line p-1 text-ink-faint transition-colors hover:text-ink"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-paper-3/60 p-3">
        <div
          className={cn(
            "mx-auto h-full overflow-hidden rounded-md border border-line bg-white shadow-sm transition-[max-width]",
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
    return (
      <EmptyPanel
        icon={FileCode2}
        title="No files yet"
        body="Every build writes complete files into the workspace. They'll show up here, ready to copy or export."
      />
    );
  }

  async function copy() {
    if (!current) return;
    await navigator.clipboard.writeText(current.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-full min-h-0 flex-col sm:flex-row">
      <div className="max-h-32 shrink-0 overflow-auto border-b border-line sm:max-h-none sm:w-48 sm:border-b-0 sm:border-r">
        <ul className="p-1.5">
          {files.map((file) => (
            <li key={file.path}>
              <button
                type="button"
                onClick={() => setSelected(file.path)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-[11px] transition-colors",
                  current?.path === file.path
                    ? "bg-paper-2 text-ink"
                    : "text-ink-soft hover:bg-paper-2/60 hover:text-ink",
                )}
              >
                <FileCode2 className="h-3 w-3 shrink-0 text-ink-faint" />
                <span className="truncate">{file.path}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
          <span className="truncate font-mono text-[10.5px] text-ink-soft">{current?.path}</span>
          <div className="flex items-center gap-1">
            <span className="hidden font-mono text-[9px] text-ink-faint sm:block">
              {formatBytes(current?.content.length ?? 0)}
            </span>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-soft transition-colors hover:text-ink"
            >
              {copied ? <Check className="h-2.5 w-2.5 text-moss" /> : <Copy className="h-2.5 w-2.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto bg-paper-2/30 px-3 py-2.5 font-mono text-[11px] leading-[1.7] text-ink whitespace-pre-wrap break-words">
          {current?.content}
        </pre>
      </div>
    </div>
  );
}

function ActivityTab({ project }: { project: Project | null }) {
  const tools = (project?.messages ?? []).flatMap((message) =>
    (message.tools ?? []).map((tool) => ({ ...tool, at: message.createdAt })),
  );

  const summary = [
    { label: "Mode", value: project?.mode === "cloud" ? "Daytona sandbox" : "Browser workspace" },
    { label: "Sandbox", value: project?.sandboxId ?? "—" },
    { label: "Files", value: String(project?.files.length ?? 0) },
    { label: "Steps", value: String(tools.length) },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <dl className="grid shrink-0 grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="bg-paper px-3 py-2">
            <dt className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">{item.label}</dt>
            <dd className="mt-0.5 truncate font-mono text-[10.5px] text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        {tools.length === 0 ? (
          <p className="py-10 text-center text-[12.5px] text-ink-faint">
            Tool calls, searches, and commands will be logged here.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {tools.map((tool) => (
              <li key={tool.id} className="flex items-start gap-2.5 font-mono text-[10.5px] leading-relaxed">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                <span className="w-24 shrink-0 text-ink-faint">
                  {new Date(tool.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="min-w-0 flex-1 text-ink-soft">
                  <span className="text-ink">{tool.label}</span>
                  {tool.detail ? ` — ${tool.detail}` : ""}
                  {tool.output && (
                    <span className="mt-0.5 block line-clamp-2 text-ink-faint">{tool.output}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "shrink-0 uppercase tracking-wider",
                    tool.status === "ok" && "text-moss",
                    tool.status === "error" && "text-ember",
                    tool.status === "running" && "text-ink-faint",
                  )}
                >
                  {tool.status}
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
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof Monitor;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper-2/60">
        <Icon className="h-4 w-4 text-ink-faint" strokeWidth={1.7} />
      </div>
      <p className="mt-4 text-[13.5px] font-medium">{title}</p>
      <p className="mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-ink-soft">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function formatBytes(length: number): string {
  if (length < 1024) return `${length} B`;
  return `${(length / 1024).toFixed(1)} kb`;
}

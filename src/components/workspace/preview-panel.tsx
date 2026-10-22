"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Loader2,
  Monitor,
  Plus,
  Rocket,
  RefreshCw,
  Smartphone,
  Trash2,
} from "lucide-react";
import type { Project } from "@/lib/protocol";
import type { Skill } from "@/lib/skills";
import { bundleHtml, cn, uid } from "@/lib/utils";

export type PanelTab = "preview" | "files" | "activity" | "skills";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "preview", label: "preview" },
  { id: "files", label: "files" },
  { id: "activity", label: "logs" },
  { id: "skills", label: "skills" },
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
  skills,
  onSaveSkills,
  onDeploy,
}: {
  project: Project | null;
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onRefreshFiles: () => void;
  syncFiles: boolean;
  onExport: () => void;
  skills: Skill[];
  onSaveSkills: (skills: Skill[]) => void;
  onDeploy: () => void;
}) {
  const counts = project?.files.length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-night/60 px-2.5 py-1.5 font-mono">
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-xl bg-paper-2/60 p-0.5">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTab(item.id)}
              className={cn(
                "min-h-8 shrink-0 rounded-lg px-2.5 text-[11.5px] transition-colors",
                tab === item.id
                  ? "bg-paper-3 text-ink"
                  : "text-ink-faint hover:text-ink-soft",
              )}
            >
              {item.label}
              {item.id === "files" && counts > 0 ? ` ${counts}` : ""}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {tab === "files" && project?.engine === "cloud" && project.sandboxId && (
            <button
              type="button"
              onClick={onRefreshFiles}
              aria-label="Sync files from sandbox"
              className="p-1.5 text-ink-faint transition-colors hover:text-ink"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncFiles && "animate-spin")} />
            </button>
          )}
          <button
            type="button"
            onClick={onDeploy}
            disabled={!project || counts === 0}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-ember/40 bg-ember/10 px-2.5 text-[11.5px] text-ember transition-colors hover:border-ember disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Rocket className="h-3 w-3" />
            <span className="hidden sm:inline">deploy</span>
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={!project || counts === 0 || project.files.some((file) => file.path === "package.json")}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[11.5px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3 w-3" /> export
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "preview" && (
          <PreviewTab project={project} onRefresh={onRefresh} refreshing={refreshing} />
        )}
        {tab === "files" && <FilesTab project={project} />}
        {tab === "activity" && <ActivityTab project={project} />}
        {tab === "skills" && <SkillsTab skills={skills} onSave={onSaveSkills} />}
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

  const cloud = project?.engine === "cloud" || project?.mode === "cloud";
  const cloudUrl = project?.previewUrl ?? null;

  const html = useMemo(() => {
    if (!project || cloudUrl) return "";
    return bundleHtml(project.files);
  }, [project, cloudUrl]);

  const hasFiles = (project?.files.length ?? 0) > 0;

  if (!project || !hasFiles) {
    return <SkeletonPanel title="no site yet" lines={["it renders here after the first build."]} />;
  }

  const hasPackage = project.files.some((file) => file.path === "package.json");
  const needsServer =
    Boolean(project.runCommand) ||
    project.files.some((file) =>
      ["requirements.txt", "Cargo.toml", "go.mod", "Gemfile"].includes(file.path),
    );

  if (!cloudUrl && !cloud && needsServer && !hasPackage) {
    return (
      <SkeletonPanel
        title="needs a server runtime"
        lines={[
          "python, go, rust and custom servers can't run in the browser runtime.",
          "add a daytona key and switch to cloud to start it.",
        ]}
      />
    );
  }

  if (!cloudUrl && !cloud && hasPackage) {
    return (
      <SkeletonPanel
        title="needs a runtime"
        lines={[
          "this project installs and builds to run.",
          "start it to boot the free browser runtime, or switch to cloud.",
        ]}
        action={
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex min-h-9 items-center gap-2 border border-ember/40 bg-ember/10 px-3 font-mono text-[12px] text-ember transition-colors hover:border-ember disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            start runtime
          </button>
        }
      />
    );
  }

  if (cloud && !cloudUrl) {
    return (
      <SkeletonPanel
        title="not running"
        lines={["the machine is parked to save usage.", "starting wakes it with your files intact."]}
        action={
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex min-h-9 items-center gap-2 border border-ember/40 bg-ember/10 px-3 font-mono text-[12px] text-ember transition-colors hover:border-ember disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            start preview
          </button>
        }
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-2.5 py-1.5 font-mono text-[11px]">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
          <span className="min-w-0 truncate text-ink-faint">
            {cloudUrl ? cloudUrl.replace(/^https?:\/\//, "").split("?")[0] : "localhost · index.html"}
          </span>
          {project.runtime && (
            <span className="hidden shrink-0 border border-line px-1.5 py-0.5 text-[10.5px] text-ink-faint sm:inline">
              {project.runtime}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Desktop width"
            onClick={() => setDevice("desktop")}
            className={cn("p-1.5", device === "desktop" ? "text-ink" : "text-ink-faint hover:text-ink-soft")}
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Phone width"
            onClick={() => setDevice("phone")}
            className={cn("p-1.5", device === "phone" ? "text-ink" : "text-ink-faint hover:text-ink-soft")}
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Reload preview"
            onClick={() => {
              setNonce((value) => value + 1);
              if (cloud) onRefresh();
            }}
            className="p-1.5 text-ink-faint transition-colors hover:text-ink"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
          {cloudUrl && (
            <a
              href={cloudUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-[12px] text-ink-faint transition-colors hover:text-ember"
              aria-label="Open preview in a new tab"
            >
              ↗
            </a>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-night p-2.5">
        <div
          key={`frame-${cloudUrl ?? "local"}-${nonce}`}
          className={cn(
            "mx-auto h-full animate-fade-up overflow-hidden border border-line bg-white transition-[max-width] duration-300",
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
      <div className="max-h-36 shrink-0 overflow-auto border-b border-line sm:max-h-none sm:w-48 sm:border-b-0 sm:border-r">
        <ul className="py-1.5">
          {files.map((file) => {
            const isCurrent = current?.path === file.path;
            return (
              <li key={file.path}>
                <button
                  type="button"
                  onClick={() => setSelected(file.path)}
                  className={cn(
                    "flex w-full items-center gap-1.5 border-l-2 px-2.5 py-1.5 text-left text-[12px] transition-colors",
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
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5 font-mono text-[11.5px]">
          <span className="truncate text-ink-soft">{current?.path}</span>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Copied" : "Copy file"}
            className="inline-flex items-center p-1 text-ink-faint transition-colors hover:text-ember"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-ember" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-paper px-3 py-2.5">
          <pre className="font-mono text-[11.5px] leading-[1.7] text-ink-soft">
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

function SkillsTab({ skills, onSave }: { skills: Skill[]; onSave: (skills: Skill[]) => void }) {
  const [drafts, setDrafts] = useState<Skill[]>(skills);
  const [saved, setSaved] = useState(false);

  const update = (id: string, patch: Partial<Skill>) =>
    setDrafts((prev) => prev.map((skill) => (skill.id === id ? { ...skill, ...patch } : skill)));

  return (
    <div className="flex h-full min-h-0 flex-col font-mono">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <p className="text-[11px] leading-relaxed text-ink-faint">
          instructions the agent reads with every build
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setDrafts((prev) => [...prev, { id: uid("skill"), name: "", body: "" }])}
            className="inline-flex min-h-8 items-center gap-1 border border-line px-2 text-[11px] text-ink-faint transition-colors hover:border-line-strong hover:text-ink"
          >
            <Plus className="h-3 w-3" /> new
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(drafts);
              setSaved(true);
              window.setTimeout(() => setSaved(false), 1600);
            }}
            className="inline-flex min-h-8 items-center gap-1 border border-ember/40 bg-ember/10 px-2 text-[11px] text-ember transition-colors hover:border-ember"
          >
            {saved ? <Check className="h-3 w-3" /> : null}
            {saved ? "saved" : "save"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        {drafts.length === 0 ? (
          <p className="py-10 text-center text-[12px] leading-relaxed text-ink-faint">
            no skills yet — add your house style, stack rules, or test commands.
          </p>
        ) : (
          <ul className="space-y-3">
            {drafts.map((skill) => (
              <li key={skill.id} className="border border-line bg-paper-2/30 p-2.5">
                <div className="flex items-center gap-2">
                  <input
                    value={skill.name}
                    onChange={(event) => update(skill.id, { name: event.target.value })}
                    placeholder="skill name (e.g. brand voice)"
                    className="min-h-8 min-w-0 flex-1 border-b border-line bg-transparent px-1 text-[12px] text-ink placeholder:text-ink-faint/70 focus:border-ember/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label={`Delete ${skill.name || "skill"}`}
                    onClick={() => setDrafts((prev) => prev.filter((item) => item.id !== skill.id))}
                    className="p-1.5 text-ink-faint transition-colors hover:text-alert"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <textarea
                  value={skill.body}
                  onChange={(event) => update(skill.id, { body: event.target.value })}
                  placeholder="Paste instructions: tone, stack, conventions, commands to run, things to avoid…"
                  rows={5}
                  className="mt-2 w-full resize-y border border-line bg-paper px-2 py-1.5 text-[11.5px] leading-relaxed text-ink-soft placeholder:text-ink-faint/70 focus:border-ember/60 focus:outline-none"
                />
              </li>
            ))}
          </ul>
        )}
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
          <p className="py-10 text-center text-[12.5px] text-ink-faint">no activity yet</p>
        ) : (
          <ul className="space-y-1">
            {tools.map((tool) => (
              <li key={tool.id} className="flex items-start gap-2 py-0.5 text-[11.5px] leading-relaxed">
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

function PreviewSkeleton() {
  return (
    <div
      aria-hidden
      className="mx-auto flex h-full min-h-[380px] flex-col overflow-hidden border border-line bg-paper-2/30"
    >
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <span className="skeleton-dot h-1.5 w-1.5 rounded-full" />
        <span className="skeleton-dot h-1.5 w-1.5 rounded-full" style={{ animationDelay: "120ms" }} />
        <span className="skeleton-dot h-1.5 w-1.5 rounded-full" style={{ animationDelay: "240ms" }} />
        <span className="skeleton-bar ml-2 h-2.5 w-24" />
        <span className="skeleton-bar ml-auto h-2.5 w-12" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <span className="skeleton-bar h-2.5 w-16" />
        <span className="skeleton-bar h-6 w-3/5" />
        <span className="skeleton-bar h-2.5 w-11/12" />
        <span className="skeleton-bar h-2.5 w-4/5" />
        <div className="mt-1 flex gap-2">
          <span className="skeleton-bar h-7 w-20" />
          <span className="skeleton-bar h-7 w-14" />
        </div>
        <div className="mt-3 grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="skeleton-block min-h-16 border border-line/80"
              style={{ animationDelay: `${index * 160}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SkeletonPanel({
  title,
  lines,
  action,
}: {
  title: string;
  lines: string[];
  action?: React.ReactNode;
}) {
  return (
    <div className="relative h-full overflow-hidden bg-night p-2.5">
      <PreviewSkeleton />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper/70 px-8 py-10 text-center font-mono animate-fade-up">
        <p className="text-[13px] text-ink-soft">
          <span className="text-ember">&gt;</span> {title}
        </p>
        <div className="space-y-1.5">
          {lines.map((line) => (
            <p key={line} className="max-w-xs text-[12.5px] leading-relaxed text-ink-faint">
              {line}
            </p>
          ))}
        </div>
        {action && <div className="mt-2">{action}</div>}
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
      <p className="text-[13px] text-ink-soft">
        <span className="text-ember">&gt;</span> {title}
      </p>
      <div className="mt-3 space-y-1.5">
        {lines.map((line) => (
          <p key={line} className="max-w-xs text-[12.5px] leading-relaxed text-ink-faint">
            {line}
          </p>
        ))}
      </div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

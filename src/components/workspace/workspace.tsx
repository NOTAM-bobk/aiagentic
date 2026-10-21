"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Cloud,
  Download,
  Frame,
  Loader2,
  Menu,
  MessageSquare,
  Monitor,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { KilnMark } from "@/components/brand";
import { useWorkspace } from "@/hooks/use-workspace";
import { bundleHtml, cn, timeAgo } from "@/lib/utils";
import { ChatPanel } from "./chat-panel";
import { PreviewPanel, type PanelTab } from "./preview-panel";
import { IntegrationsSheet, SetupSheet } from "./sheets";

export function Workspace({ initialPrompt }: { initialPrompt?: string }) {
  const workspace = useWorkspace({ initialPrompt });
  const [tab, setTab] = useState<PanelTab>("preview");
  const [mobileView, setMobileView] = useState<"chat" | "site">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncFiles, setSyncFiles] = useState(false);

  const { active, capabilities, hydrated, projects } = workspace;

  const exportSite = useCallback(() => {
    if (!active || active.files.length === 0) return;
    const html = bundleHtml(active.files);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${active.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kiln-site"}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [active]);

  const openSetup = useCallback(() => {
    setSetupOpen(true);
    setIntegrationsOpen(false);
  }, []);

  const openIntegrations = useCallback(() => {
    setIntegrationsOpen(true);
    setSetupOpen(false);
  }, []);

  const status =
    active?.mode === "cloud"
      ? active.sandboxId
        ? "sandbox live"
        : "cloud"
      : "browser";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper text-ink">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3 sm:px-4">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open projects"
          className="rounded border border-line p-1.5 text-ink-soft lg:hidden"
        >
          <Menu className="h-3.5 w-3.5" />
        </button>

        <Link href="/" aria-label="Kiln home" className="flex items-center gap-2">
          <KilnMark className="h-4 w-4 text-ink" />
          <span className="hidden text-[13.5px] font-medium tracking-tight sm:block">Kiln</span>
        </Link>

        <span className="mx-1 h-4 w-px bg-line" />

        <label htmlFor="project-title" className="sr-only">
          Project name
        </label>
        <input
          id="project-title"
          value={active?.title ?? "Untitled site"}
          onChange={(event) => active && workspace.renameProject(active.id, event.target.value)}
          className="min-w-0 max-w-[38vw] flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-[13px] font-medium tracking-[-0.01em] transition-colors hover:border-line focus:border-line focus:outline-none sm:max-w-[260px]"
        />

        <span
          className={cn(
            "hidden items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider sm:inline-flex",
            active?.mode === "cloud"
              ? "border-moss/30 bg-moss/5 text-moss"
              : "border-line text-ink-faint",
          )}
        >
          {active?.mode === "cloud" ? <Cloud className="h-2.5 w-2.5" /> : <Frame className="h-2.5 w-2.5" />}
          {status}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={exportSite}
            disabled={!active || active.files.length === 0}
            className="hidden items-center gap-1.5 rounded border border-line px-2 py-1.5 text-[11.5px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex"
          >
            <Download className="h-3 w-3" /> Export
          </button>
          <button
            type="button"
            onClick={openIntegrations}
            className="hidden items-center gap-1.5 rounded border border-line px-2 py-1.5 text-[11.5px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink sm:inline-flex"
          >
            Connectors
          </button>
          <button
            type="button"
            onClick={openSetup}
            aria-label="Setup"
            className="rounded border border-line p-1.5 text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              workspace.newProject();
              setMobileView("chat");
            }}
            className="inline-flex items-center gap-1 rounded bg-ink px-2.5 py-1.5 text-[11.5px] font-medium text-cream transition-colors hover:bg-ink/90"
          >
            <Plus className="h-3 w-3" />
            <span className="hidden sm:inline">New site</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[224px] shrink-0 flex-col border-r border-line bg-paper-2/25 lg:flex">
          <ProjectList
            projects={projects}
            activeId={active?.id ?? null}
            onSelect={workspace.selectProject}
            onDelete={workspace.deleteProject}
            onNew={() => workspace.newProject()}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className={cn("min-h-0 flex-1 lg:block", mobileView === "chat" ? "block" : "hidden")}>
            <ChatPanel
              project={active}
              capabilities={capabilities}
              busy={workspace.busy}
              phase={workspace.phase}
              onSend={(text) => void workspace.send(text)}
              onStop={workspace.stop}
              onBuilder={workspace.setBuilder}
              onPuterModel={workspace.setPuterModel}
              onMode={workspace.setMode}
              onOpenSetup={openSetup}
              onOpenIntegrations={openIntegrations}
            />
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 border-line lg:block lg:border-l",
              mobileView === "site" ? "block" : "hidden",
            )}
          >
            <PreviewPanel
              project={active}
              tab={tab}
              onTab={setTab}
              refreshing={refreshing}
              onRefresh={async () => {
                if (!active) return;
                setRefreshing(true);
                await workspace.refreshPreview(active);
                setRefreshing(false);
              }}
              onRefreshFiles={async () => {
                setSyncFiles(true);
                await workspace.refreshFiles();
                setSyncFiles(false);
              }}
              syncFiles={syncFiles}
              onExport={exportSite}
            />
          </div>
        </div>
      </div>

      <nav className="flex shrink-0 border-t border-line bg-paper lg:hidden" aria-label="Workspace views">
        <button
          type="button"
          onClick={() => setMobileView("chat")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11.5px]",
            mobileView === "chat" ? "text-ink" : "text-ink-faint",
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" /> Chat
        </button>
        <button
          type="button"
          onClick={() => setMobileView("site")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 border-l border-line py-2.5 text-[11.5px]",
            mobileView === "site" ? "text-ink" : "text-ink-faint",
          )}
        >
          <Monitor className="h-3.5 w-3.5" /> Site
          {active && active.files.length > 0 && (
            <span className="h-1 w-1 rounded-full bg-ember" />
          )}
        </button>
      </nav>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close projects"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 bg-ink/25"
          />
          <div className="relative flex h-full w-[272px] flex-col border-r border-line bg-paper">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-[13px] font-medium">Projects</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close"
                className="rounded border border-line p-1 text-ink-faint"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <ProjectList
              projects={projects}
              activeId={active?.id ?? null}
              onSelect={(id) => {
                workspace.selectProject(id);
                setSidebarOpen(false);
                setMobileView("chat");
              }}
              onDelete={workspace.deleteProject}
              onNew={() => {
                workspace.newProject();
                setSidebarOpen(false);
                setMobileView("chat");
              }}
            />
          </div>
        </div>
      )}

      <IntegrationsSheet
        open={integrationsOpen}
        onClose={() => setIntegrationsOpen(false)}
        onOpenSetup={openSetup}
        composioReady={Boolean(capabilities?.composio)}
      />
      <SetupSheet
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        capabilities={capabilities}
        onRecheck={() => void workspace.refreshCapabilities()}
      />

      {!hydrated && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-paper">
          <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />
        </div>
      )}

      {workspace.toast && (
        <div className="fixed bottom-20 left-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 rounded-md border border-ember/30 bg-paper px-3.5 py-2.5 shadow-lg lg:bottom-6">
          <div className="flex items-start gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
            <p className="flex-1 text-[12px] leading-relaxed text-ink-soft">{workspace.toast}</p>
            <button
              type="button"
              onClick={() => workspace.setToast(null)}
              aria-label="Dismiss"
              className="text-ink-faint hover:text-ink"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectList({
  projects,
  activeId,
  onSelect,
  onDelete,
  onNew,
}: {
  projects: ReturnType<typeof useWorkspace>["projects"];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-2">
        <p className="label-xs px-2 pb-2 pt-1 text-ink-faint">Sites</p>
        {projects.length === 0 ? (
          <p className="px-2 py-3 text-[12px] leading-relaxed text-ink-faint">
            No sites yet. Describe one to start.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {projects.map((project) => (
              <li key={project.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(project.id)}
                  className={cn(
                    "w-full rounded px-2 py-2 text-left transition-colors",
                    project.id === activeId ? "bg-paper-2" : "hover:bg-paper-2/60",
                  )}
                >
                  <span className="block truncate pr-6 text-[12.5px] text-ink">{project.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[9.5px] text-ink-faint">
                    {project.files.length} files
                    <span className="h-0.5 w-0.5 rounded-full bg-ink-faint" />
                    {timeAgo(project.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete “${project.title}”? This only removes it from this browser.`)) {
                      onDelete(project.id);
                    }
                  }}
                  aria-label={`Delete ${project.title}`}
                  className="absolute right-1.5 top-2 rounded p-1 text-ink-faint opacity-0 transition-opacity hover:text-ember focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-line p-2">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded border border-dashed border-line px-2 py-1.5 text-[12px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
        >
          <Plus className="h-3 w-3" /> New site
        </button>
        <p className="mt-3 px-1 font-mono text-[9px] uppercase leading-relaxed tracking-wider text-ink-faint">
          Saved in this browser
          <br />
          <Link href="/" className="normal-case tracking-normal hover:text-ink">
            Back to kiln →
          </Link>
        </p>
      </div>
    </>
  );
}

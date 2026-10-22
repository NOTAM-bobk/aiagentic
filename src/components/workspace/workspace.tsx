"use client";

import { useCallback, useState } from "react";
import {
  Loader2,
  Menu,
  MessageSquare,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plug,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { KilnMark } from "@/components/brand";
import { useWorkspace } from "@/hooks/use-workspace";
import { bundleHtml, cn } from "@/lib/utils";
import { ChatPanel } from "./chat-panel";
import { PuterAccount } from "./puter-account";
import { PreviewPanel, type PanelTab } from "./preview-panel";
import { IntegrationsSheet, SetupSheet } from "./sheets";

export function Workspace({ initialPrompt }: { initialPrompt?: string }) {
  const workspace = useWorkspace({ initialPrompt });
  const [tab, setTab] = useState<PanelTab>("preview");
  const [mobileView, setMobileView] = useState<"chat" | "site">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [panelVisible, setPanelVisible] = useState(true);
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

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper font-mono text-ink">
      <header className="flex h-13 shrink-0 items-center gap-2 border-b border-line bg-paper-2/40 px-3 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open projects"
          className="grid h-9 w-9 place-items-center border border-line text-ink-faint transition-colors hover:border-line-strong hover:text-ink lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5">
          <KilnMark className="h-4 w-4 text-ember" />
          <span className="text-[13px] tracking-tight text-ink">kiln</span>
        </div>

        <button
          type="button"
          onClick={() => setSidebarVisible((value) => !value)}
          aria-pressed={sidebarVisible}
          aria-label={sidebarVisible ? "Hide projects" : "Show projects"}
          title={sidebarVisible ? "Hide projects" : "Show projects"}
          className="hidden h-9 w-9 place-items-center border border-line text-ink-faint transition-colors hover:border-line-strong hover:text-ink lg:grid"
        >
          {sidebarVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>

        <label htmlFor="project-title" className="sr-only">
          Project name
        </label>
        <input
          id="project-title"
          value={active?.title ?? "untitled"}
          onChange={(event) => active && workspace.renameProject(active.id, event.target.value)}
          spellCheck={false}
          className="min-w-0 max-w-[30vw] flex-1 border-b border-transparent bg-transparent px-1 py-0.5 text-[13px] text-ink transition-colors hover:border-line focus:border-line-strong focus:outline-none sm:max-w-[240px]"
        />

        <div className="ml-auto flex items-center gap-2">
          <PuterAccount onNotify={workspace.setToast} />
          <button
            type="button"
            onClick={() => setPanelVisible((value) => !value)}
            aria-pressed={panelVisible}
            aria-label={panelVisible ? "Hide preview" : "Show preview"}
            title={panelVisible ? "Hide preview" : "Show preview"}
            className="hidden h-9 w-9 place-items-center border border-line text-ink-faint transition-colors hover:border-line-strong hover:text-ink lg:grid"
          >
            {panelVisible ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={openIntegrations}
            aria-label="Connectors"
            title="Connectors"
            className="hidden h-9 w-9 place-items-center border border-line text-ink-faint transition-colors hover:border-line-strong hover:text-ink md:grid"
          >
            <Plug className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={openSetup}
            aria-label="Setup"
            title="Setup"
            className="grid h-9 w-9 place-items-center border border-line text-ink-faint transition-colors hover:border-line-strong hover:text-ink"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              workspace.newProject();
              setMobileView("chat");
            }}
            className="inline-flex min-h-9 items-center gap-1.5 border border-ember/40 bg-ember/10 px-3 text-[12px] text-ember transition-colors hover:border-ember hover:bg-ember/15"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">new</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {sidebarVisible && (
          <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-night/50 lg:flex">
            <ProjectList
              projects={projects}
              activeId={active?.id ?? null}
              onSelect={workspace.selectProject}
              onDelete={workspace.deleteProject}
              onNew={() => workspace.newProject()}
            />
          </aside>
        )}

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col lg:grid",
            panelVisible
              ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
              : "lg:grid-cols-1",
          )}
        >
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
              onToolkitConnected={workspace.noteConnection}
              onGitPush={workspace.pushToGitHub}
            />
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 border-line lg:block lg:border-l",
              mobileView === "site" ? "block" : "hidden",
              !panelVisible && "lg:hidden",
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

      <nav className="flex shrink-0 border-t border-line bg-paper-2/40 font-mono text-[11.5px] lg:hidden" aria-label="Workspace views">
        <button
          type="button"
          onClick={() => setMobileView("chat")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-3 transition-colors",
            mobileView === "chat" ? "text-ember" : "text-ink-faint",
          )}
        >
          <MessageSquare className="h-3 w-3" /> chat
        </button>
        <button
          type="button"
          onClick={() => setMobileView("site")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 border-l border-line py-3 transition-colors",
            mobileView === "site" ? "text-ember" : "text-ink-faint",
          )}
        >
          <Monitor className="h-3 w-3" /> site
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
            className="absolute inset-0 bg-night/80 backdrop-blur-[1px]"
          />
          <div className="relative flex h-full w-[272px] flex-col border-r border-line bg-paper">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="label-xs text-ink-faint">sites</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center border border-line text-ink-faint"
              >
                <X className="h-4 w-4" />
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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-paper font-mono text-[11px] text-ink-faint">
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> loading workspace…
        </div>
      )}

      {workspace.toast && (
        <div className="fixed bottom-16 left-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 border border-line border-l-2 border-l-alert bg-paper-2 px-3 py-2.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.8)] lg:bottom-6">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-[12px] text-alert">!</span>
            <p className="flex-1 font-mono text-[12.5px] leading-relaxed text-ink-soft">
              {workspace.toast}
            </p>
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
      <div className="flex-1 overflow-y-auto py-3">
        <p className="px-4 pb-3 text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">sites</p>
        {projects.length === 0 ? (
          <p className="px-4 text-[12.5px] text-ink-faint">nothing yet</p>
        ) : (
          <ul>
            {projects.map((project) => {
              const current = project.id === activeId;
              return (
                <li key={project.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(project.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 border-l-2 py-3 pl-3 pr-9 text-left transition-colors",
                      current
                        ? "border-l-ember bg-paper-2/80"
                        : "border-l-transparent hover:border-l-line-strong hover:bg-paper-2/40",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[10px]",
                        current ? "text-ember" : "text-ink-faint",
                      )}
                    >
                      {current ? "▸" : "·"}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-[13px]",
                        current ? "text-ink" : "text-ink-soft",
                      )}
                    >
                      {project.title}
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-faint opacity-0 transition-opacity hover:text-alert focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex min-h-9 w-full items-center justify-center gap-1.5 border border-dashed border-line px-2 text-[12px] text-ink-soft transition-colors hover:border-ember/50 hover:text-ember"
        >
          <Plus className="h-3.5 w-3.5" /> new site
        </button>
      </div>
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GitBranch,
  Loader2,
  Menu,
  MessageSquare,
  Monitor,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plug,
  Plus,
  Rocket,
  Settings2,
  SlidersHorizontal,
  Sun,
  Moon,
  Trash2,
  X,
} from "lucide-react";
import { KilnMark } from "@/components/brand";
import { useWorkspace } from "@/hooks/use-workspace";
import { bundleHtml, cn, inlineImages } from "@/lib/utils";
import { ChatPanel } from "./chat-panel";
import { PuterAccount } from "./puter-account";
import { PreviewPanel, type PanelTab } from "./preview-panel";
import { GitSheet, IntegrationsSheet, SetupSheet } from "./sheets";
import { DeploySheet } from "./deploy-sheet";
import { ModelSettingsSheet } from "./model-settings-sheet";

export function Workspace({ initialPrompt }: { initialPrompt?: string }) {
  const workspace = useWorkspace({ initialPrompt });
  const [tab, setTab] = useState<PanelTab>("preview");
  const [mobileView, setMobileView] = useState<"chat" | "site">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [panelVisible, setPanelVisible] = useState(true);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [gitOpen, setGitOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [redeploying, setRedeploying] = useState(false);
  const [syncFiles, setSyncFiles] = useState(false);
  const [panelWidth, setPanelWidth] = useState(52);
  const splitRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(52);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem("kiln.panelWidth"));
    if (Number.isFinite(stored) && stored >= 28 && stored <= 72) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore saved split after hydration
      setPanelWidth(stored);
      widthRef.current = stored;
    }
  }, []);

  useEffect(() => {
    widthRef.current = panelWidth;
    try {
      window.localStorage.setItem("kiln.panelWidth", String(Math.round(panelWidth)));
    } catch {
      // Storage disabled: the split still applies for this session.
    }
  }, [panelWidth]);

  const startResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const container = splitRef.current;
    if (!container) return;
    event.preventDefault();
    const rect = container.getBoundingClientRect();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const move = (moveEvent: PointerEvent) => {
      const percent = startWidth - ((moveEvent.clientX - startX) / rect.width) * 100;
      setPanelWidth(Math.min(72, Math.max(28, percent)));
    };
    const up = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  const { active, capabilities, hydrated, projects } = workspace;

  const exportSite = useCallback(() => {
    if (!active || active.files.length === 0) return;
    const html = inlineImages(bundleHtml(active.files), active.images ?? []);
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
    setGitOpen(false);
    setModelSettingsOpen(false);
  }, []);

  const openGit = useCallback(() => {
    setGitOpen(true);
    setIntegrationsOpen(false);
    setSetupOpen(false);
    setModelSettingsOpen(false);
  }, []);

  const openIntegrations = useCallback(() => {
    setIntegrationsOpen(true);
    setSetupOpen(false);
    setModelSettingsOpen(false);
  }, []);

  const openModelSettings = useCallback(() => {
    setModelSettingsOpen(true);
    setSetupOpen(false);
    setIntegrationsOpen(false);
    setGitOpen(false);
  }, []);

  const toggleTheme = useCallback(() => {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      window.localStorage.setItem("kiln.theme", next);
    } catch {
      // Storage disabled: the theme still applies for this page.
    }
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper font-mono text-ink">
      <header className="flex h-13 shrink-0 items-center gap-2 border-b border-line bg-night/80 px-3 backdrop-blur sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open projects"
          className="grid h-9 w-9 place-items-center rounded-xl border border-line text-ink-faint transition-colors hover:border-line-strong hover:text-ink lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* The mark only earns the space on tablets and wider. */}
        <div className="hidden items-center gap-1.5 rounded-xl border border-line bg-paper-2/60 px-2.5 py-1.5 sm:flex">
          <KilnMark className="h-4 w-4 text-ember" />
          <span className="text-[13px] tracking-tight text-ink">kiln</span>
          <span className="text-[10px] text-ink-faint">⌄</span>
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
          className="w-0 min-w-0 flex-1 border-b border-transparent bg-transparent px-1 py-0.5 text-[13px] text-ink transition-colors hover:border-line focus:border-line-strong focus:outline-none sm:max-w-[240px]"
        />

        <div className="ml-auto flex items-center gap-2">
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

          <div className="relative">
            <button
              type="button"
              onClick={() => setActionsOpen((value) => !value)}
              aria-label="Tools and settings"
              aria-expanded={actionsOpen}
              className="grid h-9 w-9 place-items-center rounded-xl border border-line text-ink-faint transition-colors hover:border-line-strong hover:text-ink"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {actionsOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setActionsOpen(false)}
                  className="fixed inset-0 z-40 cursor-default bg-transparent"
                />
                <div className="absolute right-0 top-11 z-50 w-56 border border-line bg-paper p-1 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]">
                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false);
                      openGit();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[12px] text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
                  >
                    <GitBranch className="h-3.5 w-3.5" /> GitHub repositories
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false);
                      openIntegrations();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[12px] text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
                  >
                    <Plug className="h-3.5 w-3.5" /> connectors
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false);
                      openModelSettings();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[12px] text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" /> model settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false);
                      openSetup();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[12px] text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
                  >
                    <Settings2 className="h-3.5 w-3.5" /> setup
                  </button>
                  <div className="mt-1 border-t border-line pt-1">
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[12px] text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
                    >
                      <Sun className="theme-sun h-3.5 w-3.5" />
                      <Moon className="theme-moon h-3.5 w-3.5" />
                      light / dark
                    </button>
                    <PuterAccount onNotify={workspace.setToast} className="w-full justify-center px-2 py-1.5" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Phones get publish as the one filled action; new projects live in the drawer. */}
          <button
            type="button"
            onClick={() => setDeployOpen(true)}
            aria-label="Deploy site"
            title={active?.deploy ? `Redeploy ${active.deploy.host}` : "Deploy site"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent bg-ember text-paper transition-colors hover:bg-ember-bright sm:hidden"
          >
            <Rocket className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              workspace.newProject();
              setMobileView("chat");
            }}
            aria-label="New project"
            title="New project"
            className="hidden h-9 items-center justify-center gap-1.5 rounded-xl border border-transparent bg-ember px-0 text-[12px] font-semibold text-paper transition-colors hover:bg-ember-bright sm:inline-flex sm:w-auto sm:px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>new</span>
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

        <div ref={splitRef} className="flex min-w-0 flex-1 flex-col lg:flex-row">
          <div className={cn("min-h-0 min-w-0 flex-1 lg:block", mobileView === "chat" ? "block" : "hidden")}>
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
              onChatMode={workspace.setChatMode}
              onToolkitConnected={workspace.noteConnection}
              onGitPush={workspace.pushToGitHub}
            />
          </div>

          {panelVisible && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize preview"
              aria-valuenow={Math.round(panelWidth)}
              aria-valuemin={28}
              aria-valuemax={72}
              tabIndex={0}
              onPointerDown={startResize}
              onDoubleClick={() => setPanelWidth(52)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                setPanelWidth((value) =>
                  Math.min(72, Math.max(28, value + (event.key === "ArrowLeft" ? 2 : -2))),
                );
              }}
              className="group hidden w-1.5 shrink-0 cursor-col-resize touch-none bg-line transition-colors hover:bg-ember/60 focus-visible:bg-ember/60 lg:grid lg:place-items-center"
            >
              <span className="h-8 w-px bg-line-strong transition-colors group-hover:bg-paper/70" />
            </div>
          )}

          <div
            style={{ "--panel-width": `${panelWidth}%` } as React.CSSProperties}
            className={cn(
              "min-h-0 w-full border-line lg:w-[var(--panel-width)] lg:flex-none lg:border-l",
              mobileView === "site" ? "block" : "hidden",
              // The mobile view switch does not exist on desktop, so the panel
              // follows its own toggle there instead of staying hidden.
              panelVisible ? "lg:block" : "lg:hidden",
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
              skills={workspace.skills}
              onSaveSkills={workspace.saveSkills}
              onDeploy={() => setDeployOpen(true)}
              redeploying={redeploying}
              onRedeploy={async () => {
                if (!active) return;
                setRedeploying(true);
                await workspace.redeploy(active.id);
                setRedeploying(false);
              }}
            />
          </div>
        </div>
      </div>

      <nav
        className="mx-3 mb-[max(0.5rem,env(safe-area-inset-bottom))] flex shrink-0 gap-1 rounded-2xl border border-line bg-paper-2/70 p-1 font-mono text-[11.5px] lg:hidden"
        aria-label="Workspace views"
      >
        <button
          type="button"
          onClick={() => setMobileView("chat")}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-colors",
            mobileView === "chat" ? "bg-paper-3 text-ink" : "text-ink-faint",
          )}
        >
          <MessageSquare className="h-4 w-4" />
          chat
        </button>
        <button
          type="button"
          onClick={() => setMobileView("site")}
          className={cn(
            "relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-colors",
            mobileView === "site" ? "bg-paper-3 text-ink" : "text-ink-faint",
          )}
        >
          <Monitor className="h-4 w-4" />
          preview
          {active && active.files.length > 0 && (
            <span className="absolute right-1/3 top-2 h-1 w-1 rounded-full bg-ember" />
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
                className="grid h-9 w-9 place-items-center rounded-xl border border-line text-ink-faint"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ProjectList
              projects={projects}
              activeId={active?.id ?? null}
              showLabel={false}
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
      <GitSheet
        open={gitOpen}
        onClose={() => setGitOpen(false)}
        project={active}
        onOpenSetup={openSetup}
        onImport={workspace.importRepo}
        onToast={workspace.setToast}
      />
      <DeploySheet
        open={deployOpen}
        onClose={() => setDeployOpen(false)}
        project={active}
        deployed={active?.deploy ?? null}
        onDeployed={(deploy) => {
          if (active) workspace.recordDeploy(active.id, deploy);
        }}
        onOpenSetup={openSetup}
        onToast={workspace.setToast}
      />
      <ModelSettingsSheet
        open={modelSettingsOpen}
        onClose={() => setModelSettingsOpen(false)}
        settings={workspace.modelSettings}
        onSave={workspace.saveModelSettings}
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
  showLabel = true,
}: {
  projects: ReturnType<typeof useWorkspace>["projects"];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  /** The mobile drawer already has a "sites" heading of its own. */
  showLabel?: boolean;
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto py-3">
        {showLabel && (
          <p className="px-4 pb-3 text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">sites</p>
        )}
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

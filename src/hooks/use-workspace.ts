"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUILDER_PROMPT, TITLE_PROMPT, buildEditContext } from "@/lib/prompts";
import {
  applyEdit,
  needsCloud,
  parseArtifacts,
  streamPreview,
  type ChatMessage,
  type Plan,
  type Project,
  type ProjectFile,
  type ToolEvent,
  type WorkspaceMode,
} from "@/lib/protocol";
import { loadPuter, puterChat } from "@/lib/puter";
import { bootBrowserRunner, type BrowserRunnerApi } from "@/lib/webcontainer";
import { slugTitle, truncate, uid } from "@/lib/utils";
import type { Capabilities } from "@/lib/models";
import { PUTER_MODELS } from "@/lib/puter-models";
import { readKeys } from "@/lib/keys-client";
import { readSkills, sanitizeSkills, writeSkills, type Skill } from "@/lib/skills";
import { loadSessionTools } from "@/lib/composio-session-client";
import { resolveBuilder } from "@/lib/builders";

const STORAGE_KEY = "kiln.workspace.v1";
const MAX_ROUNDS = 4;

type Stored = { projects: Project[]; activeId: string | null };

function createProject(overrides: Partial<Project> = {}): Project {
  const now = Date.now();
  return {
    id: uid("prj"),
    title: "Untitled site",
    createdAt: now,
    updatedAt: now,
    messages: [],
    files: [],
    sandboxId: null,
    mode: "auto",
    builder: "puter",
    previewUrl: null,
    ...overrides,
  };
}

function newMessage(role: ChatMessage["role"], content = "", extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: uid("msg"),
    role,
    content,
    createdAt: Date.now(),
    ...extra,
  };
}

function withoutRaw(projects: Project[]): Project[] {
  return projects.map((project) => ({
    ...project,
    // Signed preview URLs die with the parked sandbox; mint a fresh one on demand.
    previewUrl: null,
    runtime: null,
    messages: project.messages.map((message) => ({
      ...message,
      raw: undefined,
      pending: false,
      tools: message.tools?.map((tool) => ({
        ...tool,
        status: tool.status === "running" ? "error" : tool.status,
        output:
          tool.status === "running"
            ? "Interrupted when the page was closed."
            : tool.output
              ? truncate(tool.output, 1200)
              : undefined,
      })),
    })),
  }));
}

function needsCloudRun(files: ProjectFile[], artifacts: ReturnType<typeof parseArtifacts>): boolean {
  const commands = artifacts.some((artifact) => artifact.kind === "shell" || artifact.kind === "run");
  return needsCloud(files) || commands;
}

const TOOLKIT_NAMES: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  supabase: "Supabase",
  cloudflare: "Cloudflare",
  vercel: "Vercel",
  notion: "Notion",
  slack: "Slack",
  linear: "Linear",
  stripe: "Stripe",
};

function connectorName(slug: string): string {
  return (
    TOOLKIT_NAMES[slug] ??
    slug
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function tail(value: string, max = 2000): string {
  return value.length <= max ? value : `…\n${value.slice(-max)}`;
}

function diffSnippet(find: string, replace: string): string {
  const cut = (value: string) => value.split("\n").slice(0, 10).join("\n");
  return `- ${cut(find)}\n+ ${cut(replace)}`;
}

function cleanTitle(value: string): string | null {
  const line = value
    .replace(/[`*#]/g, "")
    .split("\n")
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return null;
  const title = line
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/[.!?:;]+$/, "")
    .trim()
    .slice(0, 64);
  if (!title || title.split(/\s+/).length > 8) return null;
  return title;
}

async function errorFromResponse(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export function useWorkspace(options: { initialPrompt?: string } = {}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [capsLoaded, setCapsLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);

  const projectsRef = useRef<Project[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initialHandled = useRef(false);

  useEffect(() => {
    projectsRef.current = projects;
    activeIdRef.current = activeId;
  }, [projects, activeId]);

  const active = useMemo(
    () => projects.find((project) => project.id === activeId) ?? null,
    [projects, activeId],
  );

  const patchProject = useCallback((id: string, patch: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((project) => (project.id === id ? { ...project, ...patch, updatedAt: Date.now() } : project)),
    );
  }, []);

  const appendNote = useCallback((projectId: string, messageId: string, note: string) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? {
              ...project,
              messages: project.messages.map((message) =>
                message.id === messageId && !message.content.includes(note)
                  ? {
                      ...message,
                      content: [message.content.trim(), note].filter(Boolean).join("\n\n"),
                    }
                  : message,
              ),
            }
          : project,
      ),
    );
  }, []);

  const patchTool = useCallback(
    (projectId: string, messageId: string, toolId: string, patch: Partial<ToolEvent>) => {
      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectId
            ? {
                ...project,
                messages: project.messages.map((message) =>
                  message.id === messageId
                    ? {
                        ...message,
                        tools: (message.tools ?? []).map((tool) =>
                          tool.id === toolId ? { ...tool, ...patch } : tool,
                        ),
                      }
                    : message,
                ),
              }
            : project,
        ),
      );
    },
    [],
  );

  const noteConnection = useCallback(
    (projectId: string, messageId: string, name: string) => {
      appendNote(projectId, messageId, `${name} is connected.`);
    },
    [appendNote],
  );

  /** Approved push: commit the project's files to the user's GitHub repo. */
  const pushToGitHub = useCallback(
    async (
      projectId: string,
      messageId: string,
      toolId: string,
      target: { repo: string; branch: string; message: string },
    ) => {
      const project = projectsRef.current.find((item) => item.id === projectId);
      if (!project) return;

      patchTool(projectId, messageId, toolId, {
        status: "running",
        label: `Pushing to ${target.repo}`,
        detail: `${target.branch} · working`,
      });

      try {
        const response = await fetch("/api/git", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...target, files: project.files }),
        });
        const data = (await response.json()) as {
          error?: string;
          repo?: string;
          url?: string;
          commitUrl?: string;
          branch?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Push failed.");

        patchTool(projectId, messageId, toolId, {
          status: "ok",
          label: `Pushed to ${data.repo}`,
          detail: data.branch,
          output: [data.url, data.commitUrl].filter(Boolean).join("\n"),
          meta: { url: data.url },
        });
        appendNote(projectId, messageId, `Pushed to GitHub: ${data.url}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Push failed.";
        patchTool(projectId, messageId, toolId, {
          status: "error",
          label: `Push to ${target.repo} failed`,
          output: message,
        });
        setToast(message);
      }
    },
    [appendNote, patchTool],
  );

  const saveSkills = useCallback((next: Skill[]) => {
    const clean = sanitizeSkills(next);
    setSkills(clean);
    writeSkills(clean);
    setToast(clean.length ? `Saved ${clean.length} skill${clean.length === 1 ? "" : "s"}` : "Skills cleared");
  }, []);

  /** Adopt a cloned repository as the current project's files. */
  const importRepo = useCallback(
    (repo: string, branch: string, files: { path: string; content: string }[]) => {
      const id = activeIdRef.current;
      if (!id || files.length === 0) return;
      const note: ChatMessage = {
        id: uid("msg"),
        role: "assistant",
        content: `Imported ${repo} at ${branch} — ${files.length} files. Ask me to change anything, run tests, or push it back.`,
        createdAt: Date.now(),
      };
      setProjects((prev) =>
        prev.map((project) =>
          project.id === id
            ? {
                ...project,
                title: repo.split("/").pop() || project.title,
                files: files.map((file) => ({ path: file.path, content: file.content })),
                sandboxId: null,
                previewUrl: null,
                engine: null,
                runtime: null,
                messages: [...project.messages, note],
                updatedAt: Date.now(),
              }
            : project,
        ),
      );
      setToast(`Imported ${repo}`);
    },
    [],
  );

  const patchMessage = useCallback((projectId: string, messageId: string, patch: Partial<ChatMessage>) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? {
              ...project,
              updatedAt: Date.now(),
              messages: project.messages.map((message) =>
                message.id === messageId ? { ...message, ...patch } : message,
              ),
            }
          : project,
      ),
    );
  }, []);

  /* ---------------------------------------------------------------- persist */

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Stored;
        if (Array.isArray(parsed.projects)) {
          const restored = parsed.projects.map((project) => ({
            ...project,
            messages: project.messages ?? [],
            builder: resolveBuilder(project.builder).id,
          }));
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
          setProjects(restored);
          setSkills(readSkills());
          // A stale active id would leave the preview pane with no project at all.
          const validId = restored.some((project) => project.id === parsed.activeId)
            ? parsed.activeId
            : (restored[0]?.id ?? null);
          setActiveId(validId);
        }
      }
    } catch {
      // Corrupt storage: start clean rather than blocking the workspace.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ projects: withoutRaw(projects), activeId } satisfies Stored),
        );
      } catch {
        // Quota errors are non-fatal; the session still works in memory.
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [projects, activeId, hydrated]);

  /* ----------------------------------------------------------- capabilities */

  const applyCapabilities = useCallback((next: Capabilities) => {
    setCapabilities(next);
    setCapsLoaded(true);
    const builder = next.google ? "gemini" : next.groq ? "groq" : "puter";
    const mode: WorkspaceMode = next.daytona ? "auto" : "local";
    setProjects((prev) =>
      prev.map((project) =>
        project.messages.length === 0
          ? { ...project, builder: resolveBuilder(project.builder).provider === "puter" ? builder : project.builder, mode }
          : project,
      ),
    );
  }, []);

  const refreshCapabilities = useCallback(async () => {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const data = (await response.json()) as { capabilities: Capabilities };
      applyCapabilities(data.capabilities);
    } catch {
      setCapabilities(null);
      setCapsLoaded(true);
    }
  }, [applyCapabilities]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ capabilities: Capabilities }>)
      .then((data) => {
        if (!cancelled) applyCapabilities(data.capabilities);
      })
      .catch(() => {
        if (cancelled) return;
        setCapabilities(null);
        setCapsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [applyCapabilities]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* ------------------------------------------------------------- operations */

  const newProject = useCallback(() => {
    const project = createProject({
      mode: capabilities?.daytona ? "auto" : "local",
      builder: capabilities?.google ? "gemini" : capabilities?.groq ? "groq" : "puter",
    });
    setProjects((prev) => [project, ...prev]);
    setActiveId(project.id);
    return project;
  }, [capabilities]);

  const selectProject = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const parkSandbox = useCallback((id: string | null | undefined) => {
    if (!id || typeof window === "undefined") return;
    void fetch("/api/sandbox", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "stop", sandboxId: id }),
      keepalive: true,
    }).catch(() => undefined);
  }, []);

  // Closing the tab parks every running machine instead of leaving it billing.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const parkAll = () => {
      for (const project of projectsRef.current) {
        if (!project.sandboxId) continue;
        navigator.sendBeacon(
          "/api/sandbox",
          JSON.stringify({ action: "stop", sandboxId: project.sandboxId, keys: readKeys() }),
        );
      }
    };
    window.addEventListener("pagehide", parkAll);
    return () => window.removeEventListener("pagehide", parkAll);
  }, []);

  const deleteProject = useCallback(
    (id: string) => {
      const doomed = projectsRef.current.find((project) => project.id === id);
      if (doomed?.sandboxId) parkSandbox(doomed.sandboxId);
      setProjects((prev) => {
        const next = prev.filter((project) => project.id !== id);
        if (activeIdRef.current === id) setActiveId(next[0]?.id ?? null);
        return next;
      });
    },
    [parkSandbox],
  );

  const renameProject = useCallback(
    (id: string, title: string) => patchProject(id, { title: title.trim() || "Untitled site" }),
    [patchProject],
  );

  const setBuilder = useCallback(
    (builder: string) => {
      const id = activeIdRef.current;
      if (id) patchProject(id, { builder });
    },
    [patchProject],
  );

  const setMode = useCallback(
    (mode: WorkspaceMode) => {
      const id = activeIdRef.current;
      if (id) patchProject(id, { mode });
    },
    [patchProject],
  );

  const setPuterModel = useCallback(
    (puterModel: string) => {
      const id = activeIdRef.current;
      if (id) patchProject(id, { puterModel });
    },
    [patchProject],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setPhase("");
  }, []);

  const refreshPreview = useCallback(
    async (projectOverride?: Project) => {
      const project = projectOverride ?? projectsRef.current.find((item) => item.id === activeIdRef.current);
      if (!project) return null;
      try {
        const browserRuntime =
          project.engine === "webcontainer" ||
          (project.mode !== "cloud" && needsCloud(project.files, project.runCommand));

        if (browserRuntime) {
          const instance = await bootBrowserRunner();
          await instance.mount(project.files);
          if (project.files.some((file) => file.path === "package.json")) {
            const install = await instance.install();
            if (install.exitCode !== 0) throw new Error(tail(install.output) || "Install failed.");
          }
          const { url } = await instance.dev();
          patchProject(project.id, { previewUrl: url, runtime: "webcontainer", engine: "webcontainer" });
          return url;
        }

        if (project.mode === "local") return null;

        let sandboxId = project.sandboxId ?? null;

        // A parked machine wakes on demand; a deleted one is rebuilt from the files here.
        if (!sandboxId) {
          const created = await fetch("/api/sandbox", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "create" }),
          });
          if (!created.ok) throw new Error(await errorFromResponse(created));
          const data = (await created.json()) as { sandboxId: string };
          sandboxId = data.sandboxId;
          patchProject(project.id, { sandboxId });
          if (project.files.length > 0) {
            await fetch("/api/sandbox", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "write", sandboxId, files: project.files }),
            });
          }
        }

        if (project.files.some((file) => file.path === "package.json")) {
          await fetch("/api/sandbox", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "install", sandboxId }),
          });
        }

        const response = await fetch("/api/sandbox", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "preview",
            sandboxId,
            runCommand: project.runCommand ?? undefined,
          }),
        });
        if (!response.ok) throw new Error(await errorFromResponse(response));
        const data = (await response.json()) as { previewUrl: string; runtime?: string };
        patchProject(project.id, { previewUrl: data.previewUrl, runtime: data.runtime ?? project.runtime ?? null });
        return data.previewUrl;
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Could not start the preview.");
        return null;
      }
    },
    [patchProject],
  );

  const refreshFiles = useCallback(async () => {
    const project = projectsRef.current.find((item) => item.id === activeIdRef.current);
    if (!project || project.engine !== "cloud" || !project.sandboxId) return;
    try {
      const response = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "read", sandboxId: project.sandboxId }),
      });
      if (!response.ok) throw new Error(await errorFromResponse(response));
      const data = (await response.json()) as { files: ProjectFile[] };
      patchProject(project.id, { files: data.files });
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not read sandbox files.");
    }
  }, [patchProject]);

  /* --------------------------------------------------------------- the loop */

  /** Names the conversation with the model, once, on the first turn. */
  const nameChat = useCallback(
    async (projectId: string, prompt: string, reply: string, allowed: boolean, builder: string) => {
      if (!allowed) return;
      try {
        let title: string | null = null;
        const response = await fetch("/api/title", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ request: prompt, reply: reply.slice(0, 800) }),
        });
        if (response.ok) {
          const data = (await response.json()) as { title?: string | null };
          title = data.title?.trim() || null;
        }

        // No server-side model: ask Puter in the browser, which is already signed in.
        if (!title && resolveBuilder(builder).provider === "puter") {
          await loadPuter();
          const raw = await puterChat({
            messages: [
              { role: "system", content: TITLE_PROMPT },
              { role: "user", content: `Message: ${truncate(prompt, 800)}` },
            ],
            onDelta: () => undefined,
          });
          title = cleanTitle(raw);
        }

        if (!title) return;
        const current = projectsRef.current.find((project) => project.id === projectId);
        if (!current) return;
        // Never overwrite a name the user typed, or a plan's chosen title.
        if (current.title !== "Untitled site" && current.title !== slugTitle(prompt)) return;
        patchProject(projectId, { title });
      } catch {
        // Naming is a nicety; the slug fallback already covers it.
      }
    },
    [patchProject],
  );

  const runAgent = useCallback(
    async (project: Project, prompt: string) => {
      const projectId = project.id;
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);

      const assistant = newMessage("assistant", "", { pending: true, tools: [] });
      setProjects((prev) =>
        prev.map((item) =>
          item.id === projectId
            ? { ...item, updatedAt: Date.now(), messages: [...item.messages, assistant] }
            : item,
        ),
      );

      const pushTool = (event: Omit<ToolEvent, "id" | "status"> & { status?: ToolEvent["status"] }) => {
        const tool: ToolEvent = { id: uid("tool"), status: "running", ...event };
        setProjects((prev) =>
          prev.map((item) =>
            item.id === projectId
              ? {
                  ...item,
                  messages: item.messages.map((message) =>
                    message.id === assistant.id
                      ? { ...message, tools: [...(message.tools ?? []), tool] }
                      : message,
                  ),
                }
              : item,
          ),
        );
        return tool.id;
      };

      const resolveTool = (toolId: string, patch: Partial<ToolEvent>) => {
        setProjects((prev) =>
          prev.map((item) =>
            item.id === projectId
              ? {
                  ...item,
                  messages: item.messages.map((message) =>
                    message.id === assistant.id
                      ? {
                          ...message,
                          tools: (message.tools ?? []).map((tool) =>
                            tool.id === toolId ? { ...tool, ...patch } : tool,
                          ),
                        }
                      : message,
                  ),
                }
              : item,
          ),
        );
      };

      let files: ProjectFile[] = project.files;
      let sandboxId = project.sandboxId ?? null;
      const preference: WorkspaceMode = project.mode;
      let engine: "cloud" | "webcontainer" | null = project.engine ?? null;
      let runner: BrowserRunnerApi | null = null;
      let previewUrl = project.previewUrl ?? null;
      let runCommand = project.runCommand ?? null;
      const builder = project.builder;
      const puterModel = project.puterModel ?? PUTER_MODELS[0].id;
      let title = project.title;
      const observations: string[] = [];
      const prior = project.messages.filter((message) => !message.pending && message.content);
      if (prior.at(-1)?.role === "user" && prior.at(-1)?.content === prompt) prior.pop();
      const history = prior
        .slice(-6)
        .map((message) => ({ role: message.role, content: message.content }));

      const mergeFiles = (incoming: ProjectFile[]) => {
        const map = new Map(files.map((file) => [file.path, file]));
        for (const file of incoming) map.set(file.path, file);
        files = [...map.values()];
        patchProject(projectId, { files });
      };

      const ensureSandbox = async (): Promise<string | null> => {
        if (engine !== "cloud") return null;
        if (sandboxId) return sandboxId;
        const toolId = pushTool({ kind: "sandbox", label: "Starting Daytona sandbox", detail: "isolated linux vm" });
        setPhase("Warming up a sandbox");
        try {
          const response = await fetch("/api/sandbox", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "create" }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(await errorFromResponse(response));
          const data = (await response.json()) as { sandboxId: string };
          sandboxId = data.sandboxId;
          patchProject(projectId, { sandboxId: data.sandboxId });
          resolveTool(toolId, { status: "ok", output: data.sandboxId });
          return sandboxId;
        } catch (error) {
          resolveTool(toolId, {
            status: "error",
            output: error instanceof Error ? error.message : "Sandbox failed",
          });
          return null;
        }
      };

      const ensureRunner = async (): Promise<BrowserRunnerApi> => {
        if (runner) return runner;
        const toolId = pushTool({
          kind: "sandbox",
          label: "Starting the browser runtime",
          detail: "webcontainer",
        });
        setPhase("Starting the browser runtime");
        try {
          runner = await bootBrowserRunner();
          resolveTool(toolId, { status: "ok", label: "Browser runtime ready" });
          return runner;
        } catch (error) {
          resolveTool(toolId, {
            status: "error",
            output: error instanceof Error ? error.message : "The browser runtime failed.",
          });
          throw error;
        }
      };

      /** Installs dependencies and bundles the app when the project asks for it. */
      const prepareRuntime = async (): Promise<boolean> => {
        const pkg = files.find((file) => file.path === "package.json");

        if (engine === "webcontainer") {
          if (!pkg) return true;
          let scripts: string[] = [];
          try {
            scripts = Object.keys(
              (JSON.parse(pkg.content) as { scripts?: Record<string, string> }).scripts ?? {},
            );
          } catch {
            // The install step reports a malformed manifest.
          }

          setPhase("Installing dependencies");
          const installTool = pushTool({
            kind: "shell",
            label: "Installing dependencies",
            detail: "npm install · browser runtime",
          });
          try {
            const instance = await ensureRunner();
            const result = await instance.install();
            if (result.exitCode !== 0) {
              throw new Error(tail(result.output) || "npm install failed");
            }
            resolveTool(installTool, {
              status: "ok",
              label: "Dependencies installed",
              detail: "browser runtime",
              output: tail(result.output) || undefined,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Install failed";
            resolveTool(installTool, { status: "error", output: message });
            observations.push(`Dependency install failed in the browser runtime.\n${message}`);
            return false;
          }

          if (!scripts.includes("build")) return true;

          setPhase("Bundling the app");
          const buildTool = pushTool({
            kind: "shell",
            label: "Bundling the app",
            detail: "npm run build · browser runtime",
          });
          try {
            const instance = await ensureRunner();
            const result = await instance.build();
            if (result.exitCode !== 0) {
              throw new Error(tail(result.output, 3000) || "Build failed");
            }
            resolveTool(buildTool, {
              status: "ok",
              label: "Bundle built",
              output: tail(result.output) || undefined,
            });
            return true;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Build failed";
            resolveTool(buildTool, { status: "error", output: message });
            observations.push(`The build failed in the browser runtime.\n${message}`);
            return false;
          }
        }

        if (engine !== "cloud" || !sandboxId) return true;
        if (!pkg) return true;

        let scripts: string[] = [];
        try {
          scripts = Object.keys(
            (JSON.parse(pkg.content) as { scripts?: Record<string, string> }).scripts ?? {},
          );
        } catch {
          // A malformed package.json will be reported by the install step itself.
        }

        setPhase("Installing dependencies");
        const installTool = pushTool({
          kind: "shell",
          label: "Installing dependencies",
          detail: "npm install",
        });
        try {
          const response = await fetch("/api/sandbox", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "install", sandboxId }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(await errorFromResponse(response));
          const data = (await response.json()) as {
            installed: boolean;
            command: string | null;
            scripts: string[];
            output: string;
          };
          if (data.scripts?.length) scripts = data.scripts;
          resolveTool(installTool, {
            status: "ok",
            label: data.installed ? "Dependencies installed" : "Dependencies ready",
            detail: data.command ?? undefined,
            output: data.output || undefined,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Install failed";
          resolveTool(installTool, { status: "error", output: message });
          observations.push(`Dependency install failed. Fix the package.json or the cause below.\n${message}`);
          return false;
        }

        if (!scripts.includes("build")) return true;

        setPhase("Bundling the app");
        const buildTool = pushTool({ kind: "shell", label: "Bundling the app", detail: "npm run build" });
        try {
          const response = await fetch("/api/sandbox", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "build", sandboxId }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(await errorFromResponse(response));
          const data = (await response.json()) as {
            built: boolean;
            command: string | null;
            output: string;
            root: string | null;
          };
          resolveTool(buildTool, {
            status: "ok",
            label: data.built ? "Bundle built" : "Nothing to build",
            detail: data.command ?? undefined,
            output: data.output ? truncate(data.output, 2500) : undefined,
          });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Build failed";
          resolveTool(buildTool, { status: "error", output: message });
          observations.push(`The build failed. Fix the cause below before the preview can run.\n${message}`);
          return false;
        }
      };

      const startPreviewNow = async (): Promise<string | null> => {
        if (engine === "webcontainer") {
          setPhase("Starting the preview");
          const toolId = pushTool({
            kind: "run",
            label: "Starting the dev server",
            detail: "browser runtime",
          });
          try {
            const instance = await ensureRunner();
            const { url } = await instance.dev();
            previewUrl = url;
            patchProject(projectId, {
              previewUrl: url,
              runtime: "webcontainer",
              engine: "webcontainer",
            });
            resolveTool(toolId, {
              status: "ok",
              label: "Preview live · webcontainer",
              output: url,
            });
            return url;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Preview failed";
            resolveTool(toolId, { status: "error", output: message });
            observations.push(`The browser preview could not start. ${message}`);
            setToast(message);
            return null;
          }
        }

        if (engine !== "cloud" || !sandboxId) return null;
        setPhase("Starting the preview");
        const toolId = pushTool({
          kind: "run",
          label: runCommand ? `Starting ${runCommand}` : "Starting the preview",
          detail: runCommand ?? undefined,
        });
        try {
          const response = await fetch("/api/sandbox", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "preview", sandboxId, runCommand: runCommand ?? undefined }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(await errorFromResponse(response));
          const data = (await response.json()) as { previewUrl: string; runtime?: string; output?: string };
          previewUrl = data.previewUrl;
          patchProject(projectId, { previewUrl: data.previewUrl, runtime: data.runtime ?? null });
          resolveTool(toolId, {
            status: "ok",
            label: data.runtime ? `Preview live · ${data.runtime}` : "Preview live",
            output: data.output || undefined,
          });
          return data.previewUrl;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Preview failed";
          resolveTool(toolId, { status: "error", output: message });
          if (!controller.signal.aborted) {
            observations.push(`The preview could not start. ${message}`);
            setToast(message);
          }
          return null;
        }
      };

      try {
        /* 1 — decide: talk, or build? -------------------------------- */
        setPhase("Thinking");
        let plan: Plan | null = null;
        let reply: string | null = null;
        let replyOptions: string[] = [];
        try {
          const response = await fetch("/api/plan", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ request: prompt, history, files: files.map((file) => file.path) }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(await errorFromResponse(response));
          const data = (await response.json()) as {
            action?: "build" | "chat" | "auto";
            plan?: Plan | null;
            reply?: string;
            options?: string[];
          };

          if (data.action === "chat" && data.reply?.trim()) {
            reply = data.reply.trim();
            replyOptions = Array.isArray(data.options) ? data.options.filter(Boolean).slice(0, 4) : [];
          } else if (data.action === "build" && data.plan) {
            plan = data.plan;
            patchMessage(projectId, assistant.id, { plan });
            if (title === "Untitled site" || title === slugTitle(prompt)) {
              title = plan.title;
              patchProject(projectId, { title });
            }
          }
        } catch (error) {
          if (controller.signal.aborted) throw error;
          // No planner available: the builder reads the message itself.
        }

        if (reply) {
          patchMessage(projectId, assistant.id, {
            content: reply,
            pending: false,
            raw: undefined,
            question: replyOptions.length ? { text: reply, options: replyOptions } : null,
          });
          patchProject(projectId, { title });
          void nameChat(projectId, prompt, reply, project.messages.length <= 1, builder);
          return;
        }

        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");

        /* 2 — build rounds ---------------------------------------------- */
        const session = capabilities?.composio ? await loadSessionTools(getUserId()) : null;
        const actionTools = session?.tools ?? [];
        let raw = "";
        let summaryText = "";
        for (let round = 1; round <= MAX_ROUNDS; round += 1) {
          setPhase(round > 1 ? "Refining" : plan ? "Building" : "Thinking");
          raw = "";
          patchMessage(projectId, assistant.id, { pending: true, raw: "", error: undefined });
          const writeTool = pushTool({
            kind: "write",
            label: round > 1 ? `Revision ${round}` : plan ? "Building" : "Thinking",
            detail: resolveBuilder(builder).label,
          });

          let flushAt = 0;
          const onDelta = (delta: string) => {
            raw += delta;
            const now = Date.now();
            if (now - flushAt > 90) {
              flushAt = now;
              patchMessage(projectId, assistant.id, { raw });
            }
          };

          try {
            if (resolveBuilder(builder).provider === "puter") {
              await loadPuter();
              const context = buildEditContext({
                plan,
                files,
                observations: observations.slice(-8),
                round,
                maxRounds: MAX_ROUNDS,
                skills,
                actionTools,
              });
              await puterChat({
                model: puterModel,
                messages: [
                  { role: "system", content: BUILDER_PROMPT },
                  ...history.slice(-4).map((message) => ({
                    role: message.role,
                    content: truncate(message.content, 900),
                  })),
                  { role: "user", content: `${context}\n\n# Request\n${prompt}` },
                ],
                onDelta,
                signal: controller.signal,
              });
            } else {
              const response = await fetch("/api/generate", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  builder,
                  request: prompt,
                  plan,
                  files,
                  observations: observations.slice(-8),
                  round,
                  history,
                  skills,
                  actionTools,
                }),
                signal: controller.signal,
              });
              if (!response.ok) throw new Error(await errorFromResponse(response));
              if (!response.body) throw new Error("The model returned an empty stream.");
              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                onDelta(decoder.decode(value, { stream: true }));
                if (controller.signal.aborted) break;
              }
            }
          } catch (error) {
            if (controller.signal.aborted) throw error;
            const message = error instanceof Error ? error.message : "Generation failed";
            resolveTool(writeTool, {
              status: "error",
              output:
                resolveBuilder(builder).provider === "puter"
                  ? `${message} Puter may need a one-time sign-in — retry and approve the popup.`
                  : message,
            });
            throw new Error(message);
          }

          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
          patchMessage(projectId, assistant.id, { raw });

          const artifacts = parseArtifacts(raw);
          const fileArtifacts = artifacts.filter((artifact) => artifact.kind === "file");
          const editArtifacts = artifacts.filter((artifact) => artifact.kind === "edit");
          const doneArtifact = artifacts.find((artifact) => artifact.kind === "done");

          const thoughts = artifacts
            .filter((artifact) => artifact.kind === "think")
            .map((artifact) => (artifact.kind === "think" ? artifact.text : ""))
            .filter(Boolean);
          if (thoughts.length > 0) {
            patchMessage(projectId, assistant.id, { thinking: thoughts.join("\n\n").slice(0, 6000) });
          }

          for (const artifact of artifacts) {
            if (artifact.kind === "title" && !plan) {
              title = artifact.title;
              patchProject(projectId, { title });
            }
            if (artifact.kind === "run") {
              runCommand = artifact.command;
            }
          }

          const askArtifact = artifacts.find((artifact) => artifact.kind === "ask");

          // A question back is a valid turn: no files, no edits, one clear ask.
          if (askArtifact && askArtifact.kind === "ask" && fileArtifacts.length === 0 && editArtifacts.length === 0) {
            const said = streamPreview(raw);
            resolveTool(writeTool, { status: "ok", label: "Asked a question" });
            summaryText = said || askArtifact.question;
            patchMessage(projectId, assistant.id, {
              content: said === askArtifact.question ? "" : said,
              question: { text: askArtifact.question, options: askArtifact.options },
              pending: false,
              raw: undefined,
            });
            break;
          }

          // A reply in words is a valid turn: an answer, or feedback.
          if (fileArtifacts.length === 0 && editArtifacts.length === 0) {
            const said = streamPreview(raw) || (doneArtifact?.kind === "done" ? doneArtifact.summary : "");
            if (!said) {
              resolveTool(writeTool, { status: "error", output: "empty response" });
              throw new Error("The model sent back nothing. Try again, or switch builders.");
            }
            resolveTool(writeTool, { status: "ok", label: "Replied" });
            summaryText = said;
            patchMessage(projectId, assistant.id, { content: said, pending: false, raw: undefined });
            break;
          }

          /* 3 — apply artifacts ---------------------------------------- */
          // Edits change only the quoted span of a file that already exists.
          const edited = new Map<string, string>();
          for (const artifact of editArtifacts) {
            if (artifact.kind !== "edit") continue;
            const toolId = pushTool({ kind: "edit", label: artifact.path, detail: "edit" });

            if (fileArtifacts.some((file) => file.kind === "file" && file.path === artifact.path)) {
              resolveTool(toolId, {
                status: "ok",
                label: `${artifact.path} · rewritten in full`,
                output: "A <file> block for this path takes precedence.",
              });
              continue;
            }

            const base =
              edited.get(artifact.path) ?? files.find((file) => file.path === artifact.path)?.content;
            if (base === undefined) {
              resolveTool(toolId, {
                status: "error",
                output: `${artifact.path} is not in the workspace. Create it with <file>.`,
              });
              observations.push(
                `Edit skipped: ${artifact.path} does not exist yet. Create it with <file> if it is needed.`,
              );
              continue;
            }

            const next = applyEdit(base, artifact.find, artifact.replace);
            if (next === null) {
              resolveTool(toolId, {
                status: "error",
                output: "The <find> text was not found in the file.",
              });
              observations.push(
                `Edit failed in ${artifact.path}: the <find> text was not found. Copy the exact current lines, or write the file with <file>.`,
              );
              continue;
            }

            edited.set(artifact.path, next);
            resolveTool(toolId, {
              status: "ok",
              label: `${artifact.path} · edited`,
              output: diffSnippet(artifact.find, artifact.replace),
            });
          }

          const incoming: ProjectFile[] = [
            ...fileArtifacts.map((artifact) =>
              artifact.kind === "file"
                ? { path: artifact.path, content: artifact.content }
                : { path: "", content: "" },
            ),
            ...[...edited].map(([path, content]) => ({ path, content })),
          ];
          const wrote = `Wrote ${incoming.length} file${incoming.length === 1 ? "" : "s"}`;

          const merged = [
            ...files.filter((file) => !incoming.some((next) => next.path === file.path)),
            ...incoming,
          ];

          // Auto: a static page stays in the browser, a JS project uses the free
          // WebContainer, and anything else falls back to the cloud when it can.
          const webContainerFriendly =
            !artifacts.some((artifact) => artifact.kind === "run") &&
            !runCommand &&
            !merged.some((file) =>
              ["requirements.txt", "Cargo.toml", "go.mod", "Gemfile"].includes(file.path),
            );

          if (!needsCloudRun(merged, artifacts)) {
            engine = null;
          } else if (preference === "cloud" || (!webContainerFriendly && capabilities?.daytona)) {
            engine = "cloud";
          } else {
            engine = "webcontainer";
          }

          if (incoming.length === 0) {
            resolveTool(writeTool, { status: "error", output: "No changes were produced." });
            if (round < MAX_ROUNDS) continue;
            break;
          }

          if (engine === "webcontainer") {
            try {
              const instance = await ensureRunner();
              await instance.mount(merged);
              mergeFiles(incoming);
              resolveTool(writeTool, {
                status: "ok",
                label: `Wrote ${merged.length} file${merged.length === 1 ? "" : "s"}`,
                detail: "browser runtime",
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : "The browser runtime failed";
              observations.push(`The browser runtime was unavailable (${message}).`);
              if (preference === "auto" && capabilities?.daytona) {
                engine = "cloud";
                observations.push("Continuing on a cloud machine for this turn.");
              } else {
                // Keep the code: save it in the browser workspace even when it cannot run here.
                engine = null;
                observations.push(
                  "The free browser runtime was unavailable, so the code was saved but not started.",
                );
              }
            }
          }

          if (engine === "cloud") {
            const hadSandbox = Boolean(sandboxId);
            const id = await ensureSandbox();
            if (id) {
              // A fresh or previously browser-only turn leaves the machine behind:
              // hand it the whole project, not just this round's files.
              const payload =
                hadSandbox && preference !== "auto"
                  ? incoming
                  : [...new Map([...files, ...incoming].map((file) => [file.path, file])).values()];
              try {
                const response = await fetch("/api/sandbox", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ action: "write", sandboxId: id, files: payload }),
                  signal: controller.signal,
                });
                if (!response.ok) throw new Error(await errorFromResponse(response));
                mergeFiles(incoming);
                resolveTool(writeTool, {
                  status: "ok",
                  label: `Wrote ${payload.length} file${payload.length === 1 ? "" : "s"}`,
                  output: hadSandbox ? "saved to /site" : "copied the project to a new machine",
                });
              } catch (error) {
                resolveTool(writeTool, {
                  status: "error",
                  output: error instanceof Error ? error.message : "Write failed",
                });
                throw error;
              }
            } else {
              engine = null;
              mergeFiles(incoming);
              resolveTool(writeTool, { status: "ok", label: wrote });
              observations.push("Daytona was unavailable, so files were saved in the browser workspace instead.");
            }
          } else if (engine === null) {
            mergeFiles(incoming);
            resolveTool(writeTool, { status: "ok", label: wrote });
          }

          /* 4 — other tools -------------------------------------------- */
          for (const artifact of artifacts) {
            if (artifact.kind === "delete") {
              const toolId = pushTool({ kind: "delete", label: `Removing ${artifact.path}` });
              if (engine === "cloud" && sandboxId) {
                await fetch("/api/sandbox", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ action: "delete", sandboxId, path: artifact.path }),
                  signal: controller.signal,
                }).catch(() => undefined);
              } else if (engine === "webcontainer") {
                await ensureRunner()
                  .then((instance) => instance.exec(`rm -f -- '${artifact.path.replace(/'/g, "")}'`))
                  .catch(() => undefined);
              }
              files = files.filter((file) => file.path !== artifact.path);
              patchProject(projectId, { files });
              resolveTool(toolId, { status: "ok" });
            }

            if (artifact.kind === "search") {
              const toolId = pushTool({ kind: "search", label: `Searching "${artifact.query}"`, detail: "tavily" });
              try {
                const response = await fetch("/api/search", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ query: artifact.query }),
                  signal: controller.signal,
                });
                if (!response.ok) throw new Error(await errorFromResponse(response));
                const data = (await response.json()) as { summary: string };
                observations.push(data.summary);
                resolveTool(toolId, { status: "ok", output: truncate(data.summary, 900) });
              } catch (error) {
                const message = error instanceof Error ? error.message : "Search failed";
                observations.push(`Search unavailable: ${message}`);
                resolveTool(toolId, { status: "error", output: message });
              }
            }

            if (artifact.kind === "shell") {
              const toolId = pushTool({
                kind: "shell",
                label: artifact.command,
                detail:
                  engine === "cloud"
                    ? "daytona"
                    : engine === "webcontainer"
                      ? "browser runtime"
                      : "no runtime",
              });
              if (engine === "cloud" && sandboxId) {
                try {
                  const response = await fetch("/api/sandbox", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ action: "exec", sandboxId, command: artifact.command, timeout: 45 }),
                    signal: controller.signal,
                  });
                  if (!response.ok) throw new Error(await errorFromResponse(response));
                  const data = (await response.json()) as { exitCode: number; output: string };
                  observations.push(`$ ${artifact.command}\n${data.output}`);
                  resolveTool(toolId, { status: data.exitCode === 0 ? "ok" : "error", output: data.output });
                } catch (error) {
                  resolveTool(toolId, {
                    status: "error",
                    output: error instanceof Error ? error.message : "Command failed",
                  });
                }
              } else if (engine === "webcontainer") {
                try {
                  const instance = await ensureRunner();
                  const data = await instance.exec(artifact.command);
                  observations.push(`$ ${artifact.command}\n${data.output}`);
                  resolveTool(toolId, {
                    status: data.exitCode === 0 ? "ok" : "error",
                    output: data.output,
                  });
                } catch (error) {
                  resolveTool(toolId, {
                    status: "error",
                    output: error instanceof Error ? error.message : "Command failed",
                  });
                }
              } else {
                resolveTool(toolId, {
                  status: "error",
                  output: "Commands need a runtime. Ask for a runnable project or switch the prompt bar to cloud.",
                });
              }
            }

            if (artifact.kind === "test") {
              const toolId = pushTool({
                kind: "test",
                label: artifact.command,
                detail:
                  engine === "cloud"
                    ? "daytona"
                    : engine === "webcontainer"
                      ? "browser runtime"
                      : "no runtime",
              });
              try {
                let result: { exitCode: number; output: string } | null = null;
                if (engine === "cloud" && sandboxId) {
                  const response = await fetch("/api/sandbox", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ action: "exec", sandboxId, command: artifact.command, timeout: 120 }),
                    signal: controller.signal,
                  });
                  if (!response.ok) throw new Error(await errorFromResponse(response));
                  result = (await response.json()) as { exitCode: number; output: string };
                } else if (engine === "webcontainer") {
                  const instance = await ensureRunner();
                  result = await instance.exec(artifact.command);
                }
                if (!result) {
                  resolveTool(toolId, {
                    status: "error",
                    output: "Tests need a runtime. Run the preview once, or switch the prompt bar to cloud.",
                  });
                } else {
                  observations.push(`$ ${artifact.command}\n${result.output}`);
                  resolveTool(toolId, {
                    status: result.exitCode === 0 ? "ok" : "error",
                    output: truncate(result.output, 2400),
                  });
                }
              } catch (error) {
                resolveTool(toolId, {
                  status: "error",
                  output: error instanceof Error ? error.message : "Tests failed to run",
                });
              }
            }

            if (artifact.kind === "git") {
              pushTool({
                kind: "git",
                label: `Push to ${artifact.repo}`,
                detail: `${artifact.branch} · needs your approval`,
                status: "pending",
                meta: {
                  git: true,
                  repo: artifact.repo,
                  branch: artifact.branch,
                  message: artifact.message,
                },
              });
              observations.push(
                `A git push to ${artifact.repo} (${artifact.branch}) is waiting for the user's approval.`,
              );
            }

            if (artifact.kind === "action") {
              pushTool({
                kind: "connect",
                label: `Action · ${artifact.tool}`,
                detail: "needs your approval",
                status: "pending",
                meta: { action: artifact.tool, args: artifact.args },
              });
            }

            if (artifact.kind === "connect") {
              const name = connectorName(artifact.toolkit);
              const toolId = pushTool({
                kind: "connect",
                label: `Connect ${name}`,
                detail: "needs your login",
                status: "pending",
              });
              try {
                const directory = (await fetch(
                  `/api/integrations?userId=${encodeURIComponent(getUserId())}`,
                  { cache: "no-store", signal: controller.signal },
                )
                  .then((response) => (response.ok ? response.json() : null))
                  .catch(() => null)) as { toolkits?: { slug: string; connected: boolean }[] } | null;

                const alreadyConnected = Boolean(
                  directory?.toolkits?.find((item) => item.slug === artifact.toolkit)?.connected,
                );

                if (alreadyConnected) {
                  resolveTool(toolId, {
                    status: "ok",
                    label: `${name} is already connected`,
                    detail: "connected",
                  });
                  appendNote(projectId, assistant.id, `${name} is already connected.`);
                  observations.push(`${name} is already connected; no login is needed.`);
                } else {
                  const response = await fetch("/api/integrations/connect", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      toolkit: artifact.toolkit,
                      userId: getUserId(),
                      callbackUrl: window.location.href,
                    }),
                    signal: controller.signal,
                  });
                  if (!response.ok) throw new Error(await errorFromResponse(response));
                  const data = (await response.json()) as { redirectUrl: string };
                  resolveTool(toolId, {
                    status: "pending",
                    label: `Connect ${name}`,
                    detail: "needs your login",
                    output: artifact.note || undefined,
                    meta: { url: data.redirectUrl, toolkit: artifact.toolkit, connect: true },
                  });
                  observations.push(
                    `${name} is not connected yet. The user has a login button in this message; once it succeeds, continue with their request.`,
                  );
                }
              } catch (error) {
                resolveTool(toolId, {
                  status: "error",
                  output: error instanceof Error ? error.message : "Could not create connection link",
                });
              }
            }
          }

          const hasFollowUp = artifacts.some(
            (artifact) => artifact.kind === "search" || artifact.kind === "shell" || artifact.kind === "connect",
          );

          const runtimeReady = await prepareRuntime();
          if (!runtimeReady) {
            patchMessage(projectId, assistant.id, {
              content: "The project did not install or bundle cleanly. Sending the error back to the agent…",
            });
            if (round < MAX_ROUNDS) continue;
            break;
          }

          if (engine) {
            await startPreviewNow();
          }

          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");

          summaryText = doneArtifact?.kind === "done" ? doneArtifact.summary : "";
          if (!hasFollowUp || summaryText) {
            if (!summaryText) {
              summaryText = engine
                ? `Built ${files.length} file${
                    files.length === 1 ? "" : "s"
                  }. The preview is live on the right — ask for any change and I'll edit it.`
                : `Built ${files.length} file${
                    files.length === 1 ? "" : "s"
                  }. This tab could not start a runtime for it, so the code is saved but not running.`;
            }
            patchMessage(projectId, assistant.id, { content: summaryText });
            break;
          }

          patchMessage(projectId, assistant.id, { content: "" });
        }

        patchMessage(projectId, assistant.id, {
          pending: false,
          raw: undefined,
          content: summaryText || "Done. The site is in your workspace.",
        });
        patchProject(projectId, { previewUrl, sandboxId, engine, mode: preference, builder, title, runCommand });
        void nameChat(projectId, prompt, summaryText, project.messages.length <= 1, builder);

        // Nothing to look at: park the machine now rather than keep it warm.
        if (preference === "auto" && engine === "cloud" && !previewUrl && sandboxId) {
          parkSandbox(sandboxId);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          patchMessage(projectId, assistant.id, { pending: false, content: "Stopped." });
        } else {
          const message = error instanceof Error ? error.message : "Something went wrong";
          patchMessage(projectId, assistant.id, { pending: false, error: message, content: "" });
          setToast(message);
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
        setPhase("");
      }
    },
    [appendNote, capabilities, nameChat, parkSandbox, patchMessage, patchProject, skills],
  );

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || busy) return;

      let project = projectsRef.current.find((item) => item.id === activeIdRef.current);
      if (!project) {
        project = createProject({
          mode: capabilities?.daytona ? "auto" : "local",
          builder: capabilities?.google ? "gemini" : capabilities?.groq ? "groq" : "puter",
        });
        setProjects((prev) => [project as Project, ...prev]);
        setActiveId(project.id);
      }

      const userMessage = newMessage("user", prompt);
      const withUser: Project = {
        ...project,
        updatedAt: Date.now(),
        messages: [...project.messages, userMessage],
      };
      setProjects((prev) => prev.map((item) => (item.id === project.id ? withUser : item)));
      await runAgent(withUser, prompt);
    },
    [busy, capabilities, runAgent],
  );

  /* ------------------------------------------------------------ first run */

  useEffect(() => {
    if (!hydrated || !capsLoaded || initialHandled.current) return;
    initialHandled.current = true;
    const prompt = options.initialPrompt?.trim();
    if (!prompt) return;
    const project = createProject({
      mode: capabilities?.daytona ? "auto" : "local",
      builder: capabilities?.google ? "gemini" : capabilities?.groq ? "groq" : "puter",
      title: slugTitle(prompt),
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bootstrap the prompt handed over in the URL
    setProjects((prev) => [project, ...prev]);
    setActiveId(project.id);
    const userMessage = newMessage("user", prompt);
    const withUser: Project = { ...project, messages: [userMessage] };
    setProjects((prev) => prev.map((item) => (item.id === project.id ? withUser : item)));
    // Drop the handoff query so a refresh does not start a duplicate build.
    window.history.replaceState({}, "", "/");
    void runAgent(withUser, prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, capsLoaded]);

  return {
    hydrated,
    projects,
    active,
    capabilities,
    busy,
    phase,
    toast,
    setToast,
    send,
    stop,
    newProject,
    selectProject,
    deleteProject,
    renameProject,
    setBuilder,
    setMode,
    setPuterModel,
    noteConnection,
    pushToGitHub,
    importRepo,
    skills,
    saveSkills,
    refreshPreview,
    refreshFiles,
    refreshCapabilities,
  };
}

export function getUserId(): string {
  if (typeof window === "undefined") return "anonymous";
  const key = "kiln.user";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = `user_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(key, id);
  return id;
}

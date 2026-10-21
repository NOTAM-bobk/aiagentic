"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUILDER_PROMPT, TITLE_PROMPT, buildEditContext } from "@/lib/prompts";
import {
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
import { slugTitle, truncate, uid } from "@/lib/utils";
import type { Capabilities } from "@/lib/models";
import { PUTER_MODELS } from "@/lib/puter-models";

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
    mode: "local",
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
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
          setProjects(parsed.projects.map((project) => ({ ...project, messages: project.messages ?? [] })));
          setActiveId(parsed.activeId ?? parsed.projects[0]?.id ?? null);
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
    const mode: WorkspaceMode = next.daytona ? "cloud" : "local";
    setProjects((prev) =>
      prev.map((project) =>
        project.messages.length === 0
          ? { ...project, builder: project.builder === "puter" ? builder : project.builder, mode }
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
      mode: capabilities?.daytona ? "cloud" : "local",
      builder: capabilities?.google ? "gemini" : capabilities?.groq ? "groq" : "puter",
    });
    setProjects((prev) => [project, ...prev]);
    setActiveId(project.id);
    return project;
  }, [capabilities]);

  const selectProject = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => {
      const next = prev.filter((project) => project.id !== id);
      if (activeIdRef.current === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }, []);

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
      if (!project || project.mode !== "cloud" || !project.sandboxId) return null;
      try {
        const response = await fetch("/api/sandbox", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "preview",
            sandboxId: project.sandboxId,
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
    if (!project || project.mode !== "cloud" || !project.sandboxId) return;
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
        if (!title && builder === "puter") {
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
      let mode: WorkspaceMode = project.mode;
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
        if (mode === "local") return null;
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

      /** Installs dependencies and bundles the app when the project asks for it. */
      const prepareRuntime = async (): Promise<boolean> => {
        if (mode !== "cloud" || !sandboxId) return true;
        const pkg = files.find((file) => file.path === "package.json");
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
        if (mode !== "cloud" || !sandboxId) return null;
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
        let raw = "";
        let summaryText = "";
        for (let round = 1; round <= MAX_ROUNDS; round += 1) {
          setPhase(round > 1 ? "Refining" : plan ? "Building" : "Thinking");
          raw = "";
          patchMessage(projectId, assistant.id, { pending: true, raw: "", error: undefined });
          const writeTool = pushTool({
            kind: "write",
            label: round > 1 ? `Revision ${round}` : plan ? "Building" : "Thinking",
            detail: builder === "puter" ? "puter" : builder,
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
            if (builder === "puter") {
              await loadPuter();
              const context = buildEditContext({
                plan,
                files,
                observations: observations.slice(-8),
                round,
                maxRounds: MAX_ROUNDS,
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
                builder === "puter"
                  ? `${message} Puter may need a one-time sign-in — retry and approve the popup.`
                  : message,
            });
            throw new Error(message);
          }

          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
          patchMessage(projectId, assistant.id, { raw });

          const artifacts = parseArtifacts(raw);
          const fileArtifacts = artifacts.filter((artifact) => artifact.kind === "file");
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

          // A question back is a valid turn: no files, one clear ask.
          if (askArtifact && askArtifact.kind === "ask" && fileArtifacts.length === 0) {
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
          if (fileArtifacts.length === 0) {
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
          const incoming: ProjectFile[] = fileArtifacts.map((artifact) =>
            artifact.kind === "file" ? { path: artifact.path, content: artifact.content } : { path: "", content: "" },
          );
          const wrote = `Wrote ${incoming.length} file${incoming.length === 1 ? "" : "s"}`;

          if (mode === "cloud") {
            const id = await ensureSandbox();
            if (id) {
              try {
                const response = await fetch("/api/sandbox", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ action: "write", sandboxId: id, files: incoming }),
                  signal: controller.signal,
                });
                if (!response.ok) throw new Error(await errorFromResponse(response));
                mergeFiles(incoming);
                resolveTool(writeTool, { status: "ok", label: wrote, output: "saved to /site" });
              } catch (error) {
                resolveTool(writeTool, {
                  status: "error",
                  output: error instanceof Error ? error.message : "Write failed",
                });
                throw error;
              }
            } else {
              mode = "local";
              patchProject(projectId, { mode });
              mergeFiles(incoming);
              resolveTool(writeTool, { status: "ok", label: wrote });
              observations.push("Daytona was unavailable, so files were saved in the browser workspace instead.");
            }
          } else {
            mergeFiles(incoming);
            resolveTool(writeTool, { status: "ok", label: wrote });
          }

          /* 4 — other tools -------------------------------------------- */
          for (const artifact of artifacts) {
            if (artifact.kind === "delete") {
              const toolId = pushTool({ kind: "delete", label: `Removing ${artifact.path}` });
              if (mode === "cloud" && sandboxId) {
                await fetch("/api/sandbox", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ action: "delete", sandboxId, path: artifact.path }),
                  signal: controller.signal,
                }).catch(() => undefined);
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
              const toolId = pushTool({ kind: "shell", label: artifact.command, detail: mode === "cloud" ? "daytona" : "not available in browser mode" });
              if (mode === "cloud" && sandboxId) {
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
              } else {
                resolveTool(toolId, { status: "error", output: "Shell commands need cloud mode." });
              }
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
              const toolId = pushTool({
                kind: "connect",
                label: `Connect ${artifact.toolkit}`,
                detail: artifact.note || "composio",
              });
              try {
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
                observations.push(`${artifact.toolkit} connection link ready: ${data.redirectUrl}`);
                resolveTool(toolId, { status: "ok", output: data.redirectUrl, meta: { url: data.redirectUrl } });
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

          if (mode === "cloud" && sandboxId) {
            await startPreviewNow();
          }

          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");

          summaryText = doneArtifact?.kind === "done" ? doneArtifact.summary : "";
          if (!hasFollowUp || summaryText) {
            if (!summaryText) {
              summaryText = `Built ${files.length} file${
                files.length === 1 ? "" : "s"
              }. The preview is live on the right — ask for any change and I'll edit the running site.`;
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
        patchProject(projectId, { previewUrl, sandboxId, mode, builder, title, runCommand });
        void nameChat(projectId, prompt, summaryText, project.messages.length <= 1, builder);
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
    [nameChat, patchMessage, patchProject],
  );

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || busy) return;

      let project = projectsRef.current.find((item) => item.id === activeIdRef.current);
      if (!project) {
        project = createProject({
          mode: capabilities?.daytona ? "cloud" : "local",
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
      mode: capabilities?.daytona ? "cloud" : "local",
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

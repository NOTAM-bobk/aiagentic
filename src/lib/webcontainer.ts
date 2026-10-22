"use client";

/**
 * Browser runtime bridge.
 *
 * StackBlitz WebContainers need a cross-origin isolated document, which the
 * workspace page is not. `/runner` is served with COOP/COEP and embedded here
 * with `allow="cross-origin-isolated"`, so the free runtime stays isolated from
 * the app (and from Puter).
 */

export type RuntimeFile = { path: string; content: string };
/** Binary project files (generated images) travel as base64. */
export type RuntimeAsset = { path: string; base64: string };
export type CommandResult = { exitCode: number; output: string };

type RunnerMessage =
  | { type: "ready" }
  | { type: "boot-error"; message?: string }
  | { type: "server-ready"; url: string }
  | { type: "output"; text: string }
  | { type: "response"; id: string; ok: boolean; data?: unknown; error?: string };

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: number;
};

class BrowserRunner {
  private frame: HTMLIFrameElement | null = null;
  private bootPromise: Promise<void> | null = null;
  private pending = new Map<string, Pending>();
  private listeners = new Set<(chunk: string) => void>();
  private counter = 0;
  private url: string | null = null;

  ensure(): Promise<void> {
    if (typeof window === "undefined") {
      return Promise.reject(new Error("The browser runtime needs a browser."));
    }
    if (this.bootPromise) return this.bootPromise;

    this.bootPromise = new Promise<void>((resolve, reject) => {
      const frame = document.createElement("iframe");
      frame.src = "/runner";
      frame.title = "Browser runtime";
      frame.setAttribute("allow", "cross-origin-isolated");
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      frame.style.cssText =
        "position:fixed;left:-9999px;top:0;width:2px;height:2px;border:0;opacity:0;pointer-events:none;";
      this.frame = frame;

      const cleanup = () => {
        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
      };

      const onMessage = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow) return;
        const data = event.data as RunnerMessage | null;
        if (!data || typeof data !== "object" || typeof data.type !== "string") return;
        if (data.type === "ready") {
          cleanup();
          resolve();
          return;
        }
        if (data.type === "boot-error") {
          cleanup();
          reject(new Error(data.message || "The browser runtime could not start."));
          return;
        }
        this.receive(data);
      };

      const timer = window.setTimeout(() => {
        cleanup();
        this.failAll("The browser runtime took too long to start.");
        reject(new Error("The browser runtime took too long to start."));
      }, 60_000);

      window.addEventListener("message", onMessage);
      document.body.appendChild(frame);
    }).catch((error) => {
      this.frame?.remove();
      this.frame = null;
      this.bootPromise = null;
      throw error;
    });

    return this.bootPromise;
  }

  private receive(message: RunnerMessage) {
    if (message.type === "response") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      window.clearTimeout(pending.timer);
      if (message.ok) pending.resolve(message.data);
      else pending.reject(new Error(message.error || "The browser runtime failed."));
      return;
    }
    if (message.type === "server-ready") {
      this.url = message.url;
      return;
    }
    if (message.type === "output") {
      for (const listener of this.listeners) listener(message.text);
    }
  }

  private failAll(reason: string) {
    for (const [id, pending] of this.pending) {
      window.clearTimeout(pending.timer);
      pending.reject(new Error(reason));
      this.pending.delete(id);
    }
  }

  private async request<T>(
    method: string,
    params: Record<string, unknown> = {},
    timeout = 180_000,
  ): Promise<T> {
    await this.ensure();
    if (!this.frame?.contentWindow) throw new Error("The browser runtime is not mounted.");

    const id = `req_${++this.counter}`;
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`The browser runtime did not answer ${method}.`));
      }, timeout);
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      this.frame?.contentWindow?.postMessage({ type: "request", id, method, params }, "*");
    });
  }

  onOutput(listener: (chunk: string) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  mount(files: RuntimeFile[], assets: RuntimeAsset[] = []) {
    return this.request<{ mounted: number }>("mount", { files, assets });
  }

  install() {
    return this.request<CommandResult>("install");
  }

  build() {
    return this.request<CommandResult>("build");
  }

  dev() {
    return this.request<{ url: string }>("dev");
  }

  exec(command: string) {
    return this.request<CommandResult>("exec", { command });
  }

  get serverUrl(): string | null {
    return this.url;
  }

  dispose() {
    this.failAll("The browser runtime was stopped.");
    this.frame?.remove();
    this.frame = null;
    this.bootPromise = null;
    this.listeners.clear();
    this.pending.clear();
    this.url = null;
  }
}

let runner: BrowserRunner | null = null;

export function getBrowserRunner(): BrowserRunner {
  if (!runner) runner = new BrowserRunner();
  return runner;
}

export type BrowserRunnerApi = ReturnType<typeof getBrowserRunner>;

/** Boots (or returns) the isolated WebContainer iframe. */
export async function bootBrowserRunner(): Promise<BrowserRunnerApi> {
  const instance = getBrowserRunner();
  await instance.ensure();
  return instance;
}

"use client";

import { useEffect, useState } from "react";
import type { FileSystemTree, WebContainer, WebContainerProcess } from "@webcontainer/api";

type RuntimeFile = { path: string; content: string };

type Request = {
  type: "request";
  id: string;
  method: "mount" | "install" | "build" | "dev" | "exec";
  params?: { files?: RuntimeFile[]; command?: string };
};

function toTree(files: RuntimeFile[]): FileSystemTree {
  const root: Record<string, unknown> = {};
  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        node[part] = { file: { contents: file.content } };
        return;
      }
      const existing = node[part] as { directory?: Record<string, unknown> } | undefined;
      if (!existing?.directory) node[part] = { directory: {} };
      node = (node[part] as { directory: Record<string, unknown> }).directory;
    });
  }
  return root as unknown as FileSystemTree;
}

export default function RunnerPage() {
  const [status, setStatus] = useState("starting the browser runtime…");

  useEffect(() => {
    let instance: WebContainer | null = null;
    let devProcess: WebContainerProcess | null = null;
    let disposed = false;
    let serverUrl: string | null = null;
    const waiters: { resolve: (url: string) => void; reject: (error: Error) => void }[] = [];

    const post = (message: unknown) => window.parent.postMessage(message, "*");

    const settle = (error?: Error) => {
      const pending = waiters.splice(0);
      for (const waiter of pending) {
        if (error) waiter.reject(error);
      }
    };

    function waitForServer(timeout = 60_000): Promise<string> {
      if (serverUrl) return Promise.resolve(serverUrl);
      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          reject(new Error("The dev server did not announce a URL."));
        }, timeout);
        waiters.push({
          resolve: (url) => {
            window.clearTimeout(timer);
            resolve(url);
          },
          reject: (error) => {
            window.clearTimeout(timer);
            reject(error);
          },
        });
      });
    }

    async function boot() {
      try {
        const { WebContainer, configureAPIKey } = await import("@webcontainer/api");
        // A StackBlitz API key raises the runtime limits. It is applied in the
        // browser by design, and the key stays optional for local previews.
        try {
          const config = (await fetch("/api/runner-key", { cache: "no-store" }).then((response) =>
            response.json(),
          )) as { key?: string } | null;
          if (config?.key) configureAPIKey(config.key);
        } catch {
          // No key: boot with the free default limits.
        }
        instance = await WebContainer.boot();
        if (disposed) {
          instance.teardown();
          return;
        }
        instance.on("server-ready", (_port, url) => {
          serverUrl = url;
          post({ type: "server-ready", url });
          for (const waiter of waiters.splice(0)) waiter.resolve(url);
        });
        post({ type: "ready" });
        setStatus("browser runtime ready");
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        post({ type: "boot-error", message });
        setStatus(`browser runtime unavailable: ${message}`);
      }
    }

    async function run(command: string, args: string[]): Promise<{ exitCode: number; output: string }> {
      if (!instance) throw new Error("The browser runtime is still starting.");
      const process = await instance.spawn(command, args);
      let output = "";
      process.output
        .pipeTo(
          new WritableStream({
            write(chunk) {
              output += chunk;
              post({ type: "output", text: chunk });
            },
          }),
        )
        .catch(() => undefined);
      const exitCode = await process.exit;
      return { exitCode, output };
    }

    async function handle(event: MessageEvent) {
      if (event.source !== window.parent) return;
      const data = event.data as Request | null;
      if (!data || data.type !== "request" || !data.id) return;

      try {
        let result: unknown;

        if (data.method === "mount") {
          if (!instance) throw new Error("The browser runtime is still starting.");
          const files = data.params?.files ?? [];
          await instance.mount(toTree(files));
          result = { mounted: files.length };
        } else if (data.method === "install") {
          result = await run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"]);
        } else if (data.method === "build") {
          result = await run("npm", ["run", "build"]);
        } else if (data.method === "dev") {
          if (!instance) throw new Error("The browser runtime is still starting.");
          devProcess?.kill();
          serverUrl = null;
          devProcess = await instance.spawn("npm", [
            "run",
            "dev",
            "--",
            "--host",
            "0.0.0.0",
            "--port",
            "3000",
          ]);
          devProcess.output
            .pipeTo(
              new WritableStream({
                write(chunk) {
                  post({ type: "output", text: chunk });
                },
              }),
            )
            .catch(() => undefined);
          result = { url: await waitForServer() };
        } else if (data.method === "exec") {
          result = await run("jsh", ["-c", String(data.params?.command ?? "")]);
        } else {
          throw new Error("Unknown runtime method.");
        }

        post({ type: "response", id: data.id, ok: true, data: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The browser runtime failed.";
        settle(new Error(message));
        post({ type: "response", id: data.id, ok: false, error: message });
      }
    }

    window.addEventListener("message", handle);
    void boot();

    return () => {
      disposed = true;
      window.removeEventListener("message", handle);
      devProcess?.kill();
      instance?.teardown();
    };
  }, []);

  return <div className="p-6 font-mono text-[12px] text-ink-faint">{status}</div>;
}

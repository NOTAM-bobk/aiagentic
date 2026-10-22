import { createHash } from "node:crypto";
import { Daytona, type Sandbox } from "@daytona/sdk";
import { ApiError } from "./http";
import { apiKey } from "./keys-server";
import { truncate } from "./utils";

const PREVIEW_PORT = 3000;
const PROJECT_DIR = "site";

const SERVER_SCRIPT = `import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.argv[2] ?? 3000);
const root = process.argv[3] ?? "site";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".jsx": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const target = normalize(join(root, pathname));
    if (!target.startsWith(root)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    let file = target;
    try {
      const info = await stat(file);
      if (info.isDirectory()) file = join(file, "index.html");
    } catch {
      // Client-side routes have no file: fall back to the app shell.
      file = extname(pathname) ? "" : join(root, "index.html");
    }
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": types[extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}).listen(port, "0.0.0.0", () => console.log("kiln preview on " + port));
`;

const PROBE = `node -e "const t=Date.now();(async()=>{while(Date.now()-t<25000){try{const r=await fetch('http://127.0.0.1:${PREVIEW_PORT}/');if(r.status<500){console.log('HTTP '+r.status);return}}catch{}await new Promise(r=>setTimeout(r,400))}console.log('DOWN')})()"`;

const KILL = `pkill -f 'kiln-serve.mjs' >/dev/null 2>&1; pkill -f 'http.server ${PREVIEW_PORT}' >/dev/null 2>&1; sleep 0.2; true`;

// Prefer the lockfile's package manager, fall back to npm, which every image has.
const INSTALL_COMMAND =
  "if command -v bun >/dev/null 2>&1 && { [ -f bun.lock ] || [ -f bun.lockb ]; }; then bun install; else npm install --no-audit --no-fund --loglevel=error; fi";

const BUILD_COMMAND =
  "if command -v bun >/dev/null 2>&1 && { [ -f bun.lock ] || [ -f bun.lockb ]; }; then bun run build; else npm run build; fi";

const ENV = { CI: "1", NO_COLOR: "1" };

type CommandResult = { exitCode: number; output: string };

function tail(value: string, max = 2000): string {
  return value.length <= max ? value : `…\n${value.slice(-max)}`;
}

export function hasDaytona() {
  return Boolean(apiKey("daytona"));
}

function client() {
  return new Daytona({
    apiKey: apiKey("daytona"),
    apiUrl: process.env.DAYTONA_API_URL || undefined,
    target: process.env.DAYTONA_TARGET || undefined,
  });
}

function requireDaytona() {
  if (!hasDaytona()) {
    throw new ApiError(
      "Cloud sandboxes need a Daytona key. Add DAYTONA_API_KEY in Setup (or the server env), or switch the workspace to Browser mode.",
      503,
      "daytona_missing",
    );
  }
  return client();
}

export async function createSandbox(): Promise<{ sandboxId: string; previewUrl: string | null }> {
  const daytona = requireDaytona();
  try {
    const sandbox = await daytona.create({
      language: "typescript",
      labels: { app: "kiln" },
      public: false,
      // Park the machine quickly once nobody is building; a stopped sandbox
      // wakes up on the next request with its files intact.
      autoStopInterval: 10,
      autoDeleteInterval: 1440,
    });
    await sandbox.fs.uploadFile(Buffer.from(SERVER_SCRIPT, "utf8"), "kiln-serve.mjs");
    return { sandboxId: sandbox.id, previewUrl: null };
  } catch (error) {
    throw new ApiError(
      `Could not create the Daytona sandbox: ${error instanceof Error ? error.message : "unknown error"}`,
      502,
      "daytona_create_failed",
    );
  }
}

async function getSandbox(sandboxId: string | undefined): Promise<Sandbox> {
  if (!sandboxId) throw new ApiError("No sandbox is attached to this project yet.", 400, "sandbox_missing");
  const daytona = requireDaytona();
  try {
    const sandbox = await daytona.get(sandboxId);
    if (sandbox.state && sandbox.state !== "started") {
      await daytona.start(sandbox);
    }
    return sandbox;
  } catch (error) {
    throw new ApiError(
      `Sandbox ${sandboxId} is not reachable. Create a new one to continue. (${
        error instanceof Error ? error.message : "unknown error"
      })`,
      404,
      "sandbox_not_found",
    );
  }
}

async function command(
  sandbox: Sandbox,
  value: string,
  options: { cwd?: string; timeout?: number } = {},
): Promise<CommandResult> {
  const result = await sandbox.process.executeCommand(
    value,
    options.cwd ?? PROJECT_DIR,
    ENV,
    options.timeout ?? 90,
  );
  return { exitCode: result.exitCode, output: truncate(result.result ?? "", 6000) };
}

async function exists(sandbox: Sandbox, path: string): Promise<boolean> {
  const result = await command(sandbox, `test -e '${path}' && echo yes || echo no`, {
    cwd: ".",
    timeout: 15,
  });
  return result.output.trim().endsWith("yes");
}

async function readPackage(
  sandbox: Sandbox,
): Promise<{ scripts: string[]; name: string; deps: string[] } | null> {
  if (!(await exists(sandbox, `${PROJECT_DIR}/package.json`))) return null;
  try {
    const raw = await sandbox.fs.downloadFile(`${PROJECT_DIR}/package.json`);
    const parsed = JSON.parse(raw.toString("utf8")) as {
      name?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = [
      ...Object.keys(parsed.dependencies ?? {}),
      ...Object.keys(parsed.devDependencies ?? {}),
    ];
    return { scripts: Object.keys(parsed.scripts ?? {}), name: parsed.name ?? "app", deps };
  } catch {
    return { scripts: [], name: "app", deps: [] };
  }
}

/** Park a sandbox. Files survive; the next request starts it again. */
export async function stopSandbox(sandboxId: string): Promise<void> {
  if (!hasDaytona() || !sandboxId) return;
  try {
    const daytona = client();
    const sandbox = await daytona.get(sandboxId);
    if (sandbox.state === "started") await daytona.stop(sandbox);
  } catch {
    // Already stopped, deleted, or unreachable: nothing to save.
  }
}

export async function writeFiles(
  sandboxId: string,
  files: { path: string; content: string }[],
): Promise<void> {
  if (files.length === 0) return;
  const sandbox = await getSandbox(sandboxId);
  const dirs = new Set<string>([PROJECT_DIR]);
  for (const file of files) {
    const parts = file.path.split("/");
    parts.pop();
    if (parts.length) dirs.add([PROJECT_DIR, ...parts].join("/"));
  }
  await sandbox.process.executeCommand(`mkdir -p ${[...dirs].map((dir) => `'${dir}'`).join(" ")}`);
  await Promise.all(
    files.map((file) =>
      sandbox.fs.uploadFile(Buffer.from(file.content, "utf8"), `${PROJECT_DIR}/${file.path}`),
    ),
  );
}

export async function deleteFile(sandboxId: string, path: string): Promise<void> {
  const sandbox = await getSandbox(sandboxId);
  await sandbox.process.executeCommand(`rm -f -- '${PROJECT_DIR}/${path.replace(/'/g, "")}'`);
}

export async function readFiles(sandboxId: string): Promise<{ path: string; content: string }[]> {
  const sandbox = await getSandbox(sandboxId);
  const listing = await sandbox.process.executeCommand(
    `find ${PROJECT_DIR} -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*' -not -name '.kiln-deps' -size -400k | head -120`,
  );
  const paths = listing.result
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(`${PROJECT_DIR}/`))
    .map((line) => line.slice(PROJECT_DIR.length + 1));

  const files = await Promise.all(
    paths.map(async (path) => {
      try {
        const buffer = await sandbox.fs.downloadFile(`${PROJECT_DIR}/${path}`);
        return { path, content: buffer.toString("utf8") };
      } catch {
        return null;
      }
    }),
  );

  return files.filter((file): file is { path: string; content: string } => file !== null);
}

export async function exec(
  sandboxId: string,
  value: string,
  timeout = 90,
): Promise<{ exitCode: number; output: string }> {
  const sandbox = await getSandbox(sandboxId);
  return command(sandbox, value, { timeout: Math.min(Math.max(timeout, 5), 120) });
}

export type InstallReport = {
  hasPackage: boolean;
  installed: boolean;
  command: string | null;
  scripts: string[];
  output: string;
};

/** Install dependencies for a package.json project. Fast no-op for anything else. */
export async function installProject(sandboxId: string): Promise<InstallReport> {
  const sandbox = await getSandbox(sandboxId);
  const pkg = await readPackage(sandbox);
  if (!pkg) {
    return { hasPackage: false, installed: false, command: null, scripts: [], output: "" };
  }

  // Re-install only when the manifest changed since the last install.
  const manifest = await sandbox.fs.downloadFile(`${PROJECT_DIR}/package.json`).catch(() => null);
  const hash = createHash("sha256")
    .update(manifest?.toString("utf8") ?? pkg.name)
    .digest("hex")
    .slice(0, 16);
  const marker = await command(sandbox, `cat .kiln-deps 2>/dev/null || true`, { cwd: ".", timeout: 15 });
  const hasModules = await exists(sandbox, `${PROJECT_DIR}/node_modules`);
  if (hasModules && marker.output.trim() === hash) {
    return {
      hasPackage: true,
      installed: false,
      command: null,
      scripts: pkg.scripts,
      output: "Dependencies already installed.",
    };
  }

  const result = await command(sandbox, INSTALL_COMMAND, { timeout: 50 });
  if (result.exitCode !== 0) {
    throw new ApiError(
      `Dependency install failed.\n${tail(result.output)}`,
      502,
      "install_failed",
    );
  }

  await command(sandbox, `echo ${hash} > .kiln-deps`, { cwd: ".", timeout: 15 });

  return {
    hasPackage: true,
    installed: true,
    command: "npm install",
    scripts: pkg.scripts,
    output: tail(result.output, 1500) || "Dependencies installed.",
  };
}

export type BuildReport = {
  hasPackage: boolean;
  built: boolean;
  command: string | null;
  output: string;
  root: string | null;
};

async function firstDir(sandbox: Sandbox, candidates: string[]): Promise<string | null> {
  for (const dir of candidates) {
    if (await exists(sandbox, `${PROJECT_DIR}/${dir}`)) return dir;
  }
  return null;
}

/** Run the project's build script, if it has one. */
export async function buildProject(sandboxId: string): Promise<BuildReport> {
  const sandbox = await getSandbox(sandboxId);
  const pkg = await readPackage(sandbox);
  if (!pkg || !pkg.scripts.includes("build")) {
    return { hasPackage: Boolean(pkg), built: false, command: null, output: "", root: null };
  }

  const result = await command(sandbox, BUILD_COMMAND, { timeout: 50 });
  if (result.exitCode !== 0) {
    throw new ApiError(`Build failed.\n${tail(result.output, 3000)}`, 502, "build_failed");
  }

  const root = await firstDir(sandbox, ["dist", "build", "out"]);
  return {
    hasPackage: true,
    built: true,
    command: "npm run build",
    output: tail(result.output, 2500) || "Build finished.",
    root,
  };
}

export type PreviewReport = {
  previewUrl: string;
  runtime: string;
  command: string | null;
  output: string;
};

export type PreviewPlan = { root: string; command: string | null; runtime: string };

/** Pure decision table: what does this project need to show a preview? */
export function planPreview(input: {
  builtDir: string | null;
  scripts: string[];
  deps?: string[];
  runCommand?: string | null;
}): PreviewPlan {
  const custom = input.runCommand?.trim().replace(/\s+/g, " ");
  if (custom) return { root: PROJECT_DIR, command: custom, runtime: "custom server" };
  if (input.builtDir) {
    return {
      root: `${PROJECT_DIR}/${input.builtDir}`,
      command: null,
      runtime: `built app · ${input.builtDir}/`,
    };
  }
  if (input.scripts.includes("start")) {
    return { root: PROJECT_DIR, command: `PORT=${PREVIEW_PORT} npm start`, runtime: "app server" };
  }
  if (input.scripts.includes("dev")) {
    // Next.js uses -H/-p, and rejects Vite-style flags.
    const next = (input.deps ?? []).includes("next");
    return {
      root: PROJECT_DIR,
      command: next
        ? `PORT=${PREVIEW_PORT} npm run dev -- -H 0.0.0.0 -p ${PREVIEW_PORT}`
        : `PORT=${PREVIEW_PORT} npm run dev -- --host 0.0.0.0 --port ${PREVIEW_PORT}`,
      runtime: "dev server",
    };
  }
  return { root: PROJECT_DIR, command: null, runtime: "static files" };
}

/**
 * Start whatever this project needs and return a signed URL.
 * Static files are served directly, built apps from their output directory,
 * dev-server and custom-runner projects on the preview port.
 */
export async function startPreview(
  sandboxId: string,
  options: { runCommand?: string } = {},
): Promise<PreviewReport> {
  const sandbox = await getSandbox(sandboxId);
  await sandbox.fs.uploadFile(Buffer.from(SERVER_SCRIPT, "utf8"), "kiln-serve.mjs");
  await command(sandbox, KILL, { cwd: ".", timeout: 20 });

  const pkg = await readPackage(sandbox);
  const plan = planPreview({
    builtDir: pkg ? await firstDir(sandbox, ["dist", "build", "out"]) : null,
    scripts: pkg?.scripts ?? [],
    deps: pkg?.deps ?? [],
    runCommand: options.runCommand?.slice(0, 500) ?? null,
  });
  const { root, runtime } = plan;
  const serveCommand = plan.command ?? "";

  if (serveCommand) {
    await command(
      sandbox,
      `PORT=${PREVIEW_PORT} nohup sh -c '${serveCommand.replace(/'/g, "'\\''")}' > /tmp/kiln-preview.log 2>&1 & echo started`,
      { cwd: PROJECT_DIR, timeout: 20 },
    );
  } else {
    if (!(await exists(sandbox, `${root}/index.html`))) {
      throw new ApiError(
        "There is no index.html to serve yet. Ask the agent for a page, or have it start a server with <run>.",
        400,
        "preview_no_entry",
      );
    }
    await command(
      sandbox,
      `nohup node kiln-serve.mjs ${PREVIEW_PORT} ${root} > /tmp/kiln-preview.log 2>&1 & echo started`,
      { cwd: ".", timeout: 20 },
    );
  }

  let health = await command(sandbox, PROBE, { cwd: ".", timeout: 45 });

  // Some images may not ship Node; fall back to Python's static server.
  if (!health.output.includes("HTTP") && !serveCommand) {
    await command(
      sandbox,
      `nohup python3 -m http.server ${PREVIEW_PORT} --bind 0.0.0.0 --directory ${root} > /tmp/kiln-preview.log 2>&1 & echo fallback`,
      { cwd: ".", timeout: 20 },
    );
    health = await command(sandbox, PROBE, { cwd: ".", timeout: 45 });
  }

  const log = await command(sandbox, `tail -n 40 /tmp/kiln-preview.log`, { cwd: ".", timeout: 15 });
  const output = log.output.trim();

  if (!health.output.includes("HTTP")) {
    throw new ApiError(
      `The preview did not start${serveCommand ? ` (${serveCommand})` : ""}. ${output || "No output from the sandbox."}`,
      502,
      "preview_failed",
    );
  }

  const signed = await sandbox.getSignedPreviewUrl(PREVIEW_PORT, 60 * 60 * 6);
  return { previewUrl: signed.url, runtime, command: serveCommand || null, output };
}

import { Daytona, type Sandbox } from "@daytona/sdk";
import { ApiError } from "./http";
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
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
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
      file = join(root, "index.html");
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

export function hasDaytona() {
  return Boolean(process.env.DAYTONA_API_KEY);
}

function client() {
  return new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL || undefined,
    target: process.env.DAYTONA_TARGET || undefined,
  });
}

function requireDaytona() {
  if (!hasDaytona()) {
    throw new ApiError(
      "Cloud sandboxes need DAYTONA_API_KEY. Add it in Vercel, or switch the workspace to Browser mode.",
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
      autoStopInterval: 60,
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
    `find ${PROJECT_DIR} -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -size -400k | head -80`,
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
  command: string,
): Promise<{ exitCode: number; output: string }> {
  const sandbox = await getSandbox(sandboxId);
  const result = await sandbox.process.executeCommand(
    command,
    PROJECT_DIR,
    { CI: "1", NO_COLOR: "1" },
    90,
  );
  return { exitCode: result.exitCode, output: truncate(result.result ?? "", 6000) };
}

const READY_CHECK = `node -e "fetch('http://127.0.0.1:${PREVIEW_PORT}/').then(r=>console.log('HTTP',r.status)).catch(()=>console.log('DOWN'))"`;

export async function startPreview(
  sandboxId: string,
): Promise<{ previewUrl: string; output: string }> {
  const sandbox = await getSandbox(sandboxId);
  await sandbox.fs.uploadFile(Buffer.from(SERVER_SCRIPT, "utf8"), "kiln-serve.mjs");

  await sandbox.process.executeCommand(
    `pkill -f 'kiln-serve.mjs' >/dev/null 2>&1; pkill -f 'http.server ${PREVIEW_PORT}' >/dev/null 2>&1; sleep 0.3; nohup node kiln-serve.mjs ${PREVIEW_PORT} ${PROJECT_DIR} > /tmp/kiln-preview.log 2>&1 & echo started`,
  );

  await new Promise((resolve) => setTimeout(resolve, 1500));

  let health = await sandbox.process.executeCommand(READY_CHECK);

  // Some images may not ship Node; fall back to Python's static server.
  if (!health.result.includes("HTTP 200")) {
    await sandbox.process.executeCommand(
      `nohup python3 -m http.server ${PREVIEW_PORT} --bind 0.0.0.0 --directory ${PROJECT_DIR} > /tmp/kiln-preview.log 2>&1 & echo fallback`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1200));
    health = await sandbox.process.executeCommand(READY_CHECK);
  }

  const log = await sandbox.process.executeCommand(`tail -n 40 /tmp/kiln-preview.log`);

  if (!health.result.includes("HTTP 200")) {
    throw new ApiError(
      `The preview server did not start. ${log.result?.trim() || "No output from the sandbox."}`,
      502,
      "preview_failed",
    );
  }

  const signed = await sandbox.getSignedPreviewUrl(PREVIEW_PORT, 60 * 60 * 6);
  return { previewUrl: signed.url, output: log.result?.trim() ?? "" };
}

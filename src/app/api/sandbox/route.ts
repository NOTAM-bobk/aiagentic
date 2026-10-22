import { NextResponse } from "next/server";
import { fail, handleError } from "@/lib/http";
import {
  buildProject,
  createSandbox,
  deleteFile,
  exec,
  hasDaytona,
  installProject,
  readFiles,
  startPreview,
  stopSandbox,
  writeFiles,
} from "@/lib/daytona";
import { sanitizePath } from "@/lib/protocol";
import { mergeApiKeys, withApiKeys } from "@/lib/keys-server";

export const maxDuration = 60;

type Body = {
  action?:
    | "create"
    | "write"
    | "read"
    | "exec"
    | "delete"
    | "preview"
    | "status"
    | "install"
    | "build"
    | "stop";
  sandboxId?: string;
  files?: { path: string; content: string }[];
  images?: { path: string; base64: string }[];
  path?: string;
  command?: string;
  runCommand?: string;
  timeout?: number;
  /** Included by sendBeacon callers, which cannot set request headers. */
  keys?: Record<string, string>;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  return withApiKeys(mergeApiKeys(request, body.keys), () => run(body));
}

async function run(body: Body) {
  try {
    const action = body.action;

    if (!hasDaytona()) {
      return fail(
        "Daytona is not configured. Add a Daytona key in Setup (or DAYTONA_API_KEY in the server env), or use Browser mode.",
        503,
        "daytona_missing",
      );
    }

    if (action === "create") {
      const created = await createSandbox();
      return NextResponse.json(created);
    }

    const sandboxId = body.sandboxId;
    if (!sandboxId) return fail("Missing sandboxId.", 400, "sandbox_missing");

    switch (action) {
      case "write": {
        const files = (body.files ?? [])
          .map((file) => ({ path: sanitizePath(file.path), content: String(file.content ?? "") }))
          .filter((file) => file.path && file.content.length <= 400_000)
          .slice(0, 60);
        const images = (body.images ?? [])
          .map((image) => ({
            path: sanitizePath(image.path),
            base64: String(image.base64 ?? "").replace(/[^A-Za-z0-9+/=]/g, ""),
          }))
          .filter((image) => image.path && image.base64.length > 0 && image.base64.length <= 2_600_000)
          .slice(0, 6);
        if (files.length === 0 && images.length === 0) return fail("No valid files to write.", 400);
        await writeFiles(sandboxId, files, images);
        return NextResponse.json({ written: [...files, ...images].map((file) => file.path) });
      }
      case "read": {
        const files = await readFiles(sandboxId);
        return NextResponse.json({ files });
      }
      case "exec": {
        const command = (body.command ?? "").trim();
        if (!command) return fail("Missing command.", 400);
        if (command.length > 4000) return fail("Command is too long.", 400);
        const result = await exec(sandboxId, command, body.timeout ?? 90);
        return NextResponse.json(result);
      }
      case "install": {
        const report = await installProject(sandboxId);
        return NextResponse.json(report);
      }
      case "build": {
        const report = await buildProject(sandboxId);
        return NextResponse.json(report);
      }
      case "delete": {
        const path = sanitizePath(body.path ?? "");
        if (!path) return fail("Invalid path.", 400);
        await deleteFile(sandboxId, path);
        return NextResponse.json({ deleted: path });
      }
      case "preview": {
        const runCommand = (body.runCommand ?? "").trim().slice(0, 500) || undefined;
        const report = await startPreview(sandboxId, { runCommand });
        return NextResponse.json(report);
      }
      case "stop": {
        await stopSandbox(sandboxId);
        return NextResponse.json({ stopped: sandboxId });
      }
      case "status": {
        const files = await readFiles(sandboxId);
        return NextResponse.json({ sandboxId, files });
      }
      default:
        return fail("Unknown sandbox action.", 400);
    }
  } catch (error) {
    return handleError(error);
  }
}

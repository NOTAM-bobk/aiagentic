import { NextResponse } from "next/server";
import { fail, handleError } from "@/lib/http";
import { createSandbox, deleteFile, exec, hasDaytona, readFiles, startPreview, writeFiles } from "@/lib/daytona";
import { sanitizePath } from "@/lib/protocol";

export const maxDuration = 60;

type Body = {
  action?: "create" | "write" | "read" | "exec" | "delete" | "preview" | "status";
  sandboxId?: string;
  files?: { path: string; content: string }[];
  path?: string;
  command?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const action = body.action;

    if (!hasDaytona()) {
      return fail(
        "Daytona is not configured. Add DAYTONA_API_KEY in Vercel, or use Browser mode.",
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
          .slice(0, 40);
        if (files.length === 0) return fail("No valid files to write.", 400);
        await writeFiles(sandboxId, files);
        return NextResponse.json({ written: files.map((file) => file.path) });
      }
      case "read": {
        const files = await readFiles(sandboxId);
        return NextResponse.json({ files });
      }
      case "exec": {
        const command = (body.command ?? "").trim();
        if (!command) return fail("Missing command.", 400);
        if (command.length > 2000) return fail("Command is too long.", 400);
        const result = await exec(sandboxId, command);
        return NextResponse.json(result);
      }
      case "delete": {
        const path = sanitizePath(body.path ?? "");
        if (!path) return fail("Invalid path.", 400);
        await deleteFile(sandboxId, path);
        return NextResponse.json({ deleted: path });
      }
      case "preview": {
        const { previewUrl, output } = await startPreview(sandboxId);
        return NextResponse.json({ previewUrl, output });
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

import { NextResponse } from "next/server";
import { fail, handleError } from "@/lib/http";
import { apiKey, requestApiKeys, withApiKeys } from "@/lib/keys-server";

export const maxDuration = 60;

/**
 * Image generation through Gemini's native image model (Nano Banana).
 *
 * The Interactions endpoint is current; older keys and projects still answer
 * the classic generateContent endpoint with responseModalities. Both return
 * base64 in a different wrapper, so the response is scanned for any image
 * payload rather than parsed against one shape.
 */

const MODEL = process.env.GOOGLE_IMAGE_MODEL?.trim() || "gemini-nano-banana-2.1";
const LEGACY_MODEL = process.env.GOOGLE_IMAGE_LEGACY_MODEL?.trim() || "gemini-2.5-flash-image";
const API = "https://generativelanguage.googleapis.com/v1beta";

type Body = { prompt?: string; aspect?: string; path?: string };
type Image = { mime: string; data: string };

function scan(node: unknown, depth = 0): Image | null {
  if (!node || depth > 9) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = scan(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== "object") return null;

  const record = node as Record<string, unknown>;
  const mime = record.mime_type ?? record.mimeType ?? record.mime;
  const data = record.data;
  if (typeof mime === "string" && mime.startsWith("image/") && typeof data === "string" && data.length > 200) {
    return { mime, data };
  }
  const inline = record.inline_data ?? record.inlineData;
  if (inline && typeof inline === "object") {
    const found = scan(inline, depth + 1);
    if (found) return found;
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const found = scan(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function aspectHint(aspect: string | undefined): string {
  const value = (aspect ?? "").toLowerCase().trim();
  const hints: Record<string, string> = {
    wide: "Frame it wide, 16:9, with room for text on one side.",
    landscape: "Frame it as a landscape photograph.",
    square: "Frame it square, 1:1.",
    portrait: "Frame it vertical, 4:5.",
    tall: "Frame it tall and narrow, 9:16.",
  };
  return hints[value] ?? "";
}

async function generate(url: string, key: string, body: unknown): Promise<{ image: Image | null; error?: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const data = (await response.json()) as { error?: { message?: string } };
      if (data.error?.message) detail = data.error.message.slice(0, 300);
    } catch {
      // Non-JSON error body: the status is all we have.
    }
    return { image: null, error: detail };
  }
  try {
    return { image: scan(await response.json()) };
  } catch {
    return { image: null, error: "The image response was not JSON." };
  }
}

export async function POST(request: Request) {
  return withApiKeys(requestApiKeys(request), () => run(request));
}

async function run(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const prompt = (body.prompt ?? "").trim().slice(0, 2000);
    if (!prompt) return fail("Describe the image first.", 400, "image_prompt_missing");

    const key = apiKey("google") ?? process.env.GOOGLE_API_KEY;
    if (!key) {
      return fail(
        "Images need a Google AI Studio key. Add one in Setup (or GOOGLE_GENERATIVE_AI_API_KEY in the server env).",
        503,
        "google_missing",
      );
    }

    const text = [prompt, aspectHint(body.aspect)].filter(Boolean).join("\n\n");
    const errors: string[] = [];

    const current = await generate(`${API}/interactions`, key, {
      model: MODEL,
      input: [{ type: "text", text }],
    });
    if (current.image) {
      return NextResponse.json({
        dataUrl: `data:${current.image.mime};base64,${current.image.data}`,
        mime: current.image.mime,
        model: MODEL,
      });
    }
    if (current.error) errors.push(`${MODEL}: ${current.error}`);

    const legacy = await generate(
      `${API}/models/${encodeURIComponent(LEGACY_MODEL)}:generateContent`,
      key,
      {
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      },
    );
    if (legacy.image) {
      return NextResponse.json({
        dataUrl: `data:${legacy.image.mime};base64,${legacy.image.data}`,
        mime: legacy.image.mime,
        model: LEGACY_MODEL,
      });
    }
    if (legacy.error) errors.push(`${LEGACY_MODEL}: ${legacy.error}`);

    return fail(
      `The image model returned no picture. ${errors.join(" · ").slice(0, 400) || "Try a more concrete description."}`,
      502,
      "image_failed",
    );
  } catch (error) {
    return handleError(error);
  }
}

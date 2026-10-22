import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { PLANNER_MODEL } from "@/lib/models";
import { apiKey, requestApiKeys, withApiKeys } from "@/lib/keys-server";
import { PLANNER_PROMPT } from "@/lib/prompts";
import type { Plan } from "@/lib/protocol";
import { truncate } from "@/lib/utils";

export const maxDuration = 60;

type Body = {
  request?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  files?: string[];
};

type Decision =
  | { action: "chat"; reply: string; options?: string[] }
  | { action: "build"; plan: Plan }
  | { action: "auto" };

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readDecision(text: string): Decision {
  const data = extractJson(text);
  if (!data) return { action: "auto" };

  if (data.action === "chat" && typeof data.reply === "string" && data.reply.trim()) {
    const options = Array.isArray(data.options)
      ? data.options
          .filter((option): option is string => typeof option === "string")
          .map((option) => option.trim().slice(0, 120))
          .filter(Boolean)
          .slice(0, 4)
      : undefined;
    return { action: "chat", reply: data.reply.trim(), ...(options && options.length > 1 ? { options } : {}) };
  }

  const plan = data.plan as Plan | null | undefined;
  if (data.action === "build" && plan && typeof plan.title === "string" && typeof plan.concept === "string") {
    return { action: "build", plan };
  }

  // The plan blob may arrive without a wrapper on a retry; accept a bare plan.
  if (!data.action && typeof data.title === "string" && typeof data.concept === "string") {
    return { action: "build", plan: data as unknown as Plan };
  }

  return { action: "auto" };
}

export async function POST(request: Request) {
  return withApiKeys(requestApiKeys(request), () => run(request));
}

async function run(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const prompt = (body.request ?? "").trim();
  if (!prompt) return NextResponse.json({ error: "Say something first." }, { status: 400 });

  // No planner key: hand the turn to the builder, which decides for itself.
  const key = apiKey("groq");
  if (!key) {
    return NextResponse.json({ action: "auto", source: "fallback" });
  }

  const history = (body.history ?? [])
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${truncate(message.content, 900)}`)
    .join("\n\n");

  const files = body.files ?? [];

  try {
    const { text } = await generateText({
      model: createGroq({ apiKey: key })(PLANNER_MODEL),
      system: PLANNER_PROMPT,
      prompt: [
        history ? `Conversation so far:\n${history}` : "This is the first message.",
        files.length ? `The workspace already contains: ${files.join(", ")}` : "The workspace is empty.",
        `Latest message:\n${prompt}`,
      ].join("\n\n"),
      temperature: 0.5,
      maxOutputTokens: 1600,
      maxRetries: 1,
    });

    return NextResponse.json({ ...readDecision(text), source: "groq" });
  } catch (error) {
    console.error("[kiln] plan failed", error);
    return NextResponse.json({ action: "auto", source: "fallback" });
  }
}

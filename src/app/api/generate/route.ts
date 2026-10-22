import { NextResponse } from "next/server";
import { streamText, type ModelMessage } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { BUILDER_MODEL, GROQ_BUILDER_MODEL } from "@/lib/models";
import { apiKey, requestApiKeys, withApiKeys } from "@/lib/keys-server";
import { BUILDER_PROMPT, buildEditContext } from "@/lib/prompts";
import type { Plan, ProjectFile } from "@/lib/protocol";
import { truncate } from "@/lib/utils";

export const maxDuration = 60;

type Body = {
  builder?: string;
  request?: string;
  plan?: Plan | null;
  files?: ProjectFile[];
  observations?: string[];
  round?: number;
  history?: { role: "user" | "assistant"; content: string }[];
};

const MAX_FILE_CHARS = 14_000;
const MAX_TOTAL_CHARS = 48_000;

function digest(raw: string): string {
  const say = /<say>([\s\S]*?)<\/say>/i.exec(raw)?.[1]?.trim();
  const done = /<done>([\s\S]*?)<\/done>/i.exec(raw)?.[1]?.trim();
  if (say || done) return [say, done].filter(Boolean).join("\n").slice(0, 700);
  return raw.replace(/<file\b[\s\S]*?<\/file>/gi, "[file written]").slice(0, 700);
}

function compactFiles(files: ProjectFile[] = []): ProjectFile[] {
  let budget = MAX_TOTAL_CHARS;
  const output: ProjectFile[] = [];
  for (const file of files) {
    if (budget <= 0) break;
    const content = file.content.slice(0, Math.min(MAX_FILE_CHARS, budget));
    output.push({ path: file.path, content });
    budget -= content.length;
  }
  return output;
}

export async function POST(request: Request) {
  return withApiKeys(requestApiKeys(request), () => run(request));
}

async function run(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const prompt = (body.request ?? "").trim();
  const builder = body.builder ?? "gemini";

  if (!prompt) return NextResponse.json({ error: "Missing request." }, { status: 400 });
  if (builder === "puter") {
    return NextResponse.json(
      { error: "Puter builds run in the browser. The client should not call this endpoint." },
      { status: 400 },
    );
  }

  const history: ModelMessage[] = (body.history ?? []).slice(-6).map((message) => ({
    role: message.role,
    content: truncate(digest(message.content), 700),
  }));

  const context = buildEditContext({
    plan: body.plan ?? null,
    files: compactFiles(body.files),
    observations: (body.observations ?? []).slice(-10).map((item) => item.slice(0, 3000)),
    round: Math.max(1, Math.min(body.round ?? 1, 6)),
    maxRounds: 6,
  });

  const messages: ModelMessage[] = [
    ...history,
    { role: "user", content: `${context}\n\n# Request\n${prompt}` },
  ];

  let model;
  if (builder === "groq") {
    const key = apiKey("groq");
    if (!key) {
      return NextResponse.json(
        {
          error:
            "Groq is not configured. Add a Groq key in Setup (or GROQ_API_KEY in the server env), or switch the builder to Puter (free).",
          code: "groq_missing",
        },
        { status: 503 },
      );
    }
    model = createGroq({ apiKey: key })(GROQ_BUILDER_MODEL);
  } else {
    const googleKey = apiKey("google") ?? process.env.GOOGLE_API_KEY;
    if (!googleKey) {
      return NextResponse.json(
        {
          error:
            "Google AI Studio is not configured. Add a Google key in Setup (or GOOGLE_GENERATIVE_AI_API_KEY in the server env), or switch the builder to Puter (free).",
          code: "google_missing",
        },
        { status: 503 },
      );
    }
    model = createGoogleGenerativeAI({ apiKey: googleKey })(BUILDER_MODEL);
  }

  const result = streamText({
    model,
    system: BUILDER_PROMPT,
    messages,
    temperature: 0.8,
    maxOutputTokens: 8192,
    maxRetries: 1,
    onError: ({ error }) => console.error("[kiln] generate failed", error),
  });

  return result.toTextStreamResponse({
    headers: {
      "cache-control": "no-store",
      "x-kiln-model": builder === "groq" ? GROQ_BUILDER_MODEL : BUILDER_MODEL,
    },
  });
}

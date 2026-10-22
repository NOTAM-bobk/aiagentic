import { NextResponse } from "next/server";
import { streamText, type ModelMessage } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { DEFAULT_GEMINI_MODEL, DEFAULT_GROQ_MODEL, resolveBuilder } from "@/lib/builders";
import { apiKey, requestApiKeys, withApiKeys } from "@/lib/keys-server";
import { BUILDER_PROMPT, PLAN_MODE_PROMPT, buildEditContext } from "@/lib/prompts";
import type { Plan, ProjectFile } from "@/lib/protocol";
import { truncate } from "@/lib/utils";
import { sanitizeSkills } from "@/lib/skills";

export const maxDuration = 60;

type Body = {
  builder?: string;
  request?: string;
  plan?: Plan | null;
  files?: ProjectFile[];
  observations?: string[];
  round?: number;
  history?: { role: "user" | "assistant"; content: string }[];
  skills?: { name: string; body: string }[];
  actionTools?: { slug: string; description: string; params?: string[] }[];
  /** Plan mode: reason with the user, change nothing. */
  planMode?: boolean;
  recentDirections?: string[];
  images?: { path: string; alt?: string }[];
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
  const builder = resolveBuilder(body.builder);

  if (!prompt) return NextResponse.json({ error: "Missing request." }, { status: 400 });
  if (builder.provider === "puter") {
    return NextResponse.json(
      { error: "Puter builds run in the browser. The client should not call this endpoint." },
      { status: 400 },
    );
  }

  const planMode = Boolean(body.planMode);
  const history: ModelMessage[] = (body.history ?? []).slice(-6).map((message) => ({
    role: message.role,
    content: truncate(digest(message.content), 700),
  }));

  // Plan mode reasons about the project without re-reading every byte of it.
  const planContext = [
    (body.files ?? []).length > 0
      ? `The project currently contains: ${(body.files ?? [])
          .map((file) => file.path)
          .slice(0, 40)
          .join(", ")}`
      : "The workspace is empty.",
    body.plan ? `The last plan: ${body.plan.title} — ${body.plan.concept}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const context = planMode
    ? planContext
    : buildEditContext({
        plan: body.plan ?? null,
        files: compactFiles(body.files),
        observations: (body.observations ?? []).slice(-10).map((item) => item.slice(0, 3000)),
        round: Math.max(1, Math.min(body.round ?? 1, 6)),
        maxRounds: 6,
        skills: sanitizeSkills(body.skills),
        images: Array.isArray(body.images)
          ? body.images
              .filter((image) => image && typeof image.path === "string")
              .slice(0, 8)
              .map((image) => ({ path: image.path.slice(0, 200), alt: String(image.alt ?? "").slice(0, 200) }))
          : [],
        recentDirections: Array.isArray(body.recentDirections)
          ? body.recentDirections
              .filter((line): line is string => typeof line === "string")
              .slice(0, 5)
              .map((line) => line.slice(0, 220))
          : [],
        actionTools: Array.isArray(body.actionTools)
          ? body.actionTools
              .filter((tool) => tool && typeof tool.slug === "string")
              .slice(0, 120)
              .map((tool) => ({
                slug: tool.slug.slice(0, 120),
                description: String(tool.description ?? "").slice(0, 180),
                params: Array.isArray(tool.params) ? tool.params.slice(0, 14).map(String) : [],
              }))
          : [],
      });

  const messages: ModelMessage[] = [
    ...history,
    {
      role: "user",
      content: planMode ? `${context}\n\n# Message\n${prompt}` : `${context}\n\n# Request\n${prompt}`,
    },
  ];

  let model;
  let modelName = builder.model;
  if (builder.provider === "groq") {
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
    modelName =
      builder.model === DEFAULT_GROQ_MODEL && process.env.GROQ_BUILDER_MODEL
        ? process.env.GROQ_BUILDER_MODEL
        : builder.model;
    model = createGroq({ apiKey: key })(modelName);
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
    modelName =
      builder.model === DEFAULT_GEMINI_MODEL && process.env.GOOGLE_BUILDER_MODEL
        ? process.env.GOOGLE_BUILDER_MODEL
        : builder.model;
    model = createGoogleGenerativeAI({ apiKey: googleKey })(modelName);
  }

  const result = streamText({
    model,
    system: planMode ? PLAN_MODE_PROMPT : BUILDER_PROMPT,
    messages,
    temperature: planMode ? 0.75 : 0.8,
    maxOutputTokens: planMode ? 1600 : 8192,
    maxRetries: 1,
    onError: ({ error }) => console.error("[kiln] generate failed", error),
  });

  return result.toTextStreamResponse({
    headers: {
      "cache-control": "no-store",
      "x-kiln-model": modelName,
    },
  });
}

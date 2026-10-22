import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { BUILDER_MODEL, GROQ_BUILDER_MODEL } from "@/lib/models";
import { apiKey, requestApiKeys, withApiKeys } from "@/lib/keys-server";
import { TITLE_PROMPT } from "@/lib/prompts";
import { truncate } from "@/lib/utils";

export const maxDuration = 30;

type Body = { request?: string; reply?: string };

function clean(value: string): string | null {
  const line = value
    .replace(/```[a-z]*|```/gi, "")
    .split("\n")
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return null;
  const title = line
    .replace(/^#+\s*/, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/[.!?:;]+$/, "")
    .trim()
    .slice(0, 64);
  if (!title || title.split(/\s+/).length > 8) return null;
  return title;
}

export async function POST(request: Request) {
  return withApiKeys(requestApiKeys(request), () => run(request));
}

async function run(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const prompt = (body.request ?? "").trim();
  if (!prompt) return NextResponse.json({ title: null });

  const groqKey = apiKey("groq");
  const googleKey = apiKey("google") ?? process.env.GOOGLE_API_KEY;
  const model = groqKey
    ? createGroq({ apiKey: groqKey })(GROQ_BUILDER_MODEL)
    : googleKey
      ? createGoogleGenerativeAI({ apiKey: googleKey })(BUILDER_MODEL)
      : null;

  if (!model) return NextResponse.json({ title: null, reason: "no_model" });

  try {
    const { text } = await generateText({
      model,
      system: TITLE_PROMPT,
      prompt: [
        `First message:\n${truncate(prompt, 1200)}`,
        body.reply ? `Assistant reply:\n${truncate(body.reply, 800)}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      temperature: 0.3,
      maxOutputTokens: 32,
      maxRetries: 1,
    });

    return NextResponse.json({ title: clean(text) });
  } catch (error) {
    console.error("[kiln] title failed", error);
    return NextResponse.json({ title: null });
  }
}

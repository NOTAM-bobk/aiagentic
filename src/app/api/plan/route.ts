import { NextResponse } from "next/server";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { PLANNER_MODEL } from "@/lib/models";
import { PLANNER_PROMPT } from "@/lib/prompts";
import type { Plan } from "@/lib/protocol";
import { slugTitle, truncate } from "@/lib/utils";

export const maxDuration = 60;

type Body = {
  request?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  files?: string[];
};

function extractJson(text: string): Plan | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Plan;
    if (!parsed || typeof parsed.title !== "string" || typeof parsed.concept !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function fallbackPlan(request: string): Plan {
  return {
    title: slugTitle(request),
    concept:
      "A focused single-page site built directly from the request, with a calm editorial layout and real copy.",
    artDirection: {
      palette: "ink #14120f, paper #faf8f4, accent #b8441f",
      typography: "System sans for UI, one expressive display weight for headlines",
      layout: "Centered measure, generous section rhythm, one full-bleed moment",
      motion: "Subtle hover transitions and a single entrance fade",
    },
    sections: ["Hero with the core promise", "Details or offering", "Proof or gallery", "Closing call to action"],
    files: [
      { path: "index.html", purpose: "Page structure and copy" },
      { path: "styles.css", purpose: "Design system, layout, responsive rules" },
      { path: "script.js", purpose: "Small interaction and current year" },
    ],
    buildSteps: [
      { title: "Compose the page", detail: "Semantic sections with a deliberate narrative order." },
      { title: "Set the visual system", detail: "Type scale, palette, spacing, and one signature detail." },
      { title: "Add the interaction", detail: "A single useful behavior, keyboard accessible." },
    ],
    needsSearch: false,
    searchQueries: [],
    risks: ["Planned without Groq — add GROQ_API_KEY for sharper plans."],
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const prompt = (body.request ?? "").trim();
  if (!prompt) return NextResponse.json({ error: "Describe the site you want." }, { status: 400 });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ plan: fallbackPlan(prompt), source: "fallback" });
  }

  const history = (body.history ?? [])
    .slice(-4)
    .map((message) => `${message.role.toUpperCase()}: ${truncate(message.content, 900)}`)
    .join("\n\n");

  try {
    const { text } = await generateText({
      model: groq(PLANNER_MODEL),
      system: PLANNER_PROMPT,
      prompt: [
        history ? `Recent conversation:\n${history}` : "",
        body.files?.length ? `Files that already exist: ${body.files.join(", ")}` : "",
        `Request:\n${prompt}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      temperature: 0.6,
      maxOutputTokens: 1600,
      maxRetries: 1,
    });

    const plan = extractJson(text);
    if (!plan) {
      return NextResponse.json({ plan: fallbackPlan(prompt), source: "fallback" });
    }

    return NextResponse.json({ plan, source: "groq" });
  } catch (error) {
    console.error("[kiln] plan failed", error);
    return NextResponse.json({
      plan: fallbackPlan(prompt),
      source: "fallback",
      warning: error instanceof Error ? error.message : "Planning failed",
    });
  }
}

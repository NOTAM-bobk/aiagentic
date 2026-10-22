import { ApiError } from "./http";
import { apiKey } from "./keys-server";

export type SearchHit = { title: string; url: string; content: string };

export type SearchResult = { query: string; answer?: string; hits: SearchHit[] };

export async function tavilySearch(query: string, maxResults = 5): Promise<SearchResult> {
  const key = apiKey("tavily");
  if (!key) {
    throw new ApiError(
      "Web search needs a Tavily key. Add TAVILY_API_KEY in Setup (or the server env), or ask the model to work from its own knowledge.",
      503,
      "tavily_missing",
    );
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      topic: "general",
      max_results: maxResults,
      include_answer: true,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(
      `Tavily search failed (${response.status}). ${body.slice(0, 240)}`,
      502,
      "tavily_failed",
    );
  }

  const data = (await response.json()) as {
    answer?: string;
    results?: { title?: string; url?: string; content?: string }[];
  };

  return {
    query,
    answer: data.answer,
    hits: (data.results ?? []).slice(0, maxResults).map((hit) => ({
      title: hit.title ?? "Untitled",
      url: hit.url ?? "",
      content: (hit.content ?? "").slice(0, 1200),
    })),
  };
}

export function formatSearchForModel(result: SearchResult): string {
  if (result.hits.length === 0) return `Search "${result.query}" returned no results.`;
  const lines = result.hits.map(
    (hit, index) => `${index + 1}. ${hit.title} — ${hit.url}\n${hit.content}`,
  );
  return [`Search results for "${result.query}"`, result.answer ? `Summary: ${result.answer}` : "", ...lines]
    .filter(Boolean)
    .join("\n\n");
}

# Kiln

An agentic website studio. You describe a site in plain words; an agent plans it, searches the
web when it needs facts, writes real HTML/CSS/JS, and serves the result in a sandbox you can watch.

Hosted on Vercel. Built with Next.js 16, React 19, Tailwind CSS 4, and the Vercel AI SDK.

## What to do (setup checklist)

1. **Get the keys.** All have free tiers:
   - Groq (planning) — [console.groq.com/keys](https://console.groq.com/keys)
   - Google AI Studio (building) — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - Tavily (web search, 1,000 free/month) — [app.tavily.com](https://app.tavily.com)
   - Daytona (sandbox + preview URL) — [app.daytona.io/dashboard/keys](https://app.daytona.io/dashboard/keys)
   - Composio (GitHub, Supabase, Cloudflare, Vercel) — [app.composio.dev/developers](https://app.composio.dev/developers)
2. **Run it locally.** `bun install`, copy the variable names below into `.env.local`, `bun run dev`,
   open <http://localhost:3000>.
3. **Push to GitHub**, import at [vercel.com/new](https://vercel.com/new), add the same variables in
   **Settings → Environment Variables** for Production, Preview, and Development, then deploy.
4. **Create Composio auth configs** for each toolkit you want, then use **Connectors → Connect** in
   the workspace. Without this, connectors have nothing to OAuth against.
5. **Sign in to Puter once** in the browser if you want the free, key-less builder.

Only `GROQ_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY` are needed for cloud builds. Without them the
app still runs, but builds happen in Browser mode with Puter.

## How it works

```
prompt
  └─ plan        Groq · openai/gpt-oss-120b        → concept, art direction, files, steps
  └─ build       Gemini 3.8 Flash (or Puter)       → <file>, <search>, <shell>, <connect>
  └─ execute     Tavily · Daytona · Composio       → results fed into the next round
  └─ preview     Daytona signed URL / srcDoc       → the running site
```

Two execution modes:

- **Cloud** — files live in a Daytona sandbox, commands actually run, preview is a signed URL.
- **Browser** — files live in `localStorage`, the page is previewed with inlined CSS/JS. No keys,
  no sandbox. Puter's browser models can plan and build here, so the app is usable with zero setup.

The builder speaks a small XML protocol instead of native tool calling, so Gemini, Groq, and
Puter models behave identically. `src/lib/protocol.ts` parses it; `src/lib/prompts.ts` defines the
planner and builder system prompts.

## Local development

```bash
bun install
# optional: create .env.local with the keys from the table below
# the app still runs without keys in Browser mode
bun run dev
```

Open `http://localhost:3000`, then `/build`.

## Environment variables on Vercel

Add these in **Project → Settings → Environment Variables**, for Production, Preview, and
Development, then redeploy.

| Variable | Required | Get it from | Used for |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | Cloud mode | [console.groq.com/keys](https://console.groq.com/keys) | Planning / thinking (`openai/gpt-oss-120b`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Cloud mode | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Builder (`gemini-3.8-flash`) |
| `TAVILY_API_KEY` | Optional | [app.tavily.com](https://app.tavily.com) | Live web search during builds |
| `DAYTONA_API_KEY` | Optional | [app.daytona.io](https://app.daytona.io/dashboard/keys) | Sandboxes, commands, signed previews |
| `COMPOSIO_API_KEY` | Optional | [app.composio.dev](https://app.composio.dev/developers) | GitHub / Supabase / Cloudflare / Vercel connectors |

Optional overrides: `GROQ_PLANNER_MODEL`, `GOOGLE_BUILDER_MODEL`, `GROQ_BUILDER_MODEL`,
`DAYTONA_API_URL`, `DAYTONA_TARGET`.

You do **not** need a database, auth provider, or object storage. Projects are stored per browser.

## Deploying

1. Push this repository to GitHub and import it at [vercel.com/new](https://vercel.com/new).
2. Framework preset: Next.js. Build command `next build`, output `.next`.
3. Add the env vars above, then deploy.

Vercel functions run the API routes. `maxDuration = 60` is set on streaming routes; on Vercel Pro
you can raise it to 300 if you want longer single-shot builds.

## Notes and limits

- Puter.js requires a one-time sign-in on first use. Models and pricing are controlled by Puter's
  user-pays model; the builder is selected in the composer.
- Composio connections need an auth config per toolkit. Create it in the Composio dashboard first,
  then use **Connectors → Connect**. The OAuth callback returns to the workspace.
- Preview URLs from Daytona are signed and expire after six hours; press reload to mint a fresh one.
- Projects persist in `localStorage`. Clearing site data removes them.

## Project layout

```
src/app/            landing page, /build workspace, API routes
src/components/     landing sections, workspace panels, sheets
src/hooks/          useWorkspace: agent loop, artifacts, persistence
src/lib/            prompts, protocol parser, models, Daytona, Tavily, Composio
```

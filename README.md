# Kiln

A terminal for building software. You describe what you want; an agent thinks it through, answers
or asks a question back, then writes real files and serves the result in a sandbox you can watch.
Static pages, React + Vite apps, and scripts in other languages all work: the agent writes the
project, installs its dependencies, bundles it, and runs it. There is no marketing page — the
workspace is the whole app at `/`.

Hosted on Vercel. Built with Next.js 16, React 19, Tailwind CSS 4, and the Vercel AI SDK.

## What to do (setup checklist)

1. **Get the keys.** All have free tiers:
   - Groq (planning) — [console.groq.com/keys](https://console.groq.com/keys)
   - Google AI Studio (building) — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - Tavily (web search, 1,000 free/month) — [app.tavily.com](https://app.tavily.com)
   - Daytona (sandbox + preview URL) — [app.daytona.io/dashboard/keys](https://app.daytona.io/dashboard/keys)
   - Composio (GitHub, Supabase, Cloudflare, Vercel) — [app.composio.dev/developers](https://app.composio.dev/developers)
2. **Run it locally.** `bun install`, copy the variable names below into `.env.local`, `bun run dev`,
   open <http://localhost:3000> — that is the builder.
3. **Push to GitHub**, import at [vercel.com/new](https://vercel.com/new), add the same variables in
   **Settings → Environment Variables** for Production, Preview, and Development, then deploy.
4. **Create Composio auth configs** for each toolkit you want, then use **Connectors → Connect** in
   the workspace. Without this, connectors have nothing to OAuth against.
5. **Sign in to Puter** with the `puter sign in` button in the workspace header if you want the
   free, key-less builder. It shows your `@username` once you are signed in; click it again to sign out.

Only `GROQ_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY` are needed for cloud builds. Without them the
app still runs, but builds happen in Browser mode with Puter.

## How it works

```
prompt
  └─ decide      Groq · openai/gpt-oss-120b        → answer, ask with options, or plan a build
  └─ plan        only when building               → concept, stack, art direction, files
  └─ build       Gemini 3.8 Flash (or Puter)       → <think>, <say>, <edit>, <file>, <shell>, <run>, <ask>
  └─ install     WebContainer · npm               → free browser runtime, no machine billed
  └─ bundle      WebContainer · npm run build     → dist/ served, or a dev server started
  └─ execute     Tavily · WebContainer · Composio  → results fed into the next round
  └─ git         isomorphic-git · Octokit        → clone a repo into files, or push on approval
  └─ preview     WebContainer URL / Daytona / srcDoc → the running app
  └─ name        Groq / Gemini                     → a short title for the conversation
```

Every message is read before anything is built. The agent answers questions, gives feedback, and
asks one or two short questions when a brief is too thin — with clickable options when the answer
is a choice. It shows its reasoning, every command it runs, and the step it is on while it works.
It only writes files when the request is actually a build, and the first turn names the
conversation. Without `GROQ_API_KEY` there is no separate decision step, and the builder model
makes the same call itself.

Execution modes, chosen per turn:

- **Auto** (default) — static work stays in the browser, runnable projects use StackBlitz
  WebContainers (free, in this tab), and Daytona is only the fallback when the browser runtime is
  unavailable. That is what keeps cloud usage down.
- **Cloud** — files live in a Daytona sandbox, commands actually run, preview is a signed URL.
- **Browser** — files live in `localStorage`; static pages are previewed with inlined CSS/JS and
  app projects boot the browser runtime. No keys, no sandbox.

StackBlitz WebContainers need a cross-origin isolated document, so they run in `/runner`, an
iframe served with COOP/COEP and embedded with `allow="cross-origin-isolated"`. The workspace page
itself stays unisolated, which keeps Puter and preview iframes working. If a tab cannot be
isolated, the files are still saved and the workspace falls back to Daytona in Auto mode.

A StackBlitz key ([webcontainers.io/api](https://webcontainers.io/api)) raises the runtime limits.
Set `WEBCONTAINER_API_KEY` (or `STACKBLITZ_API_KEY`) on the server or paste it into **Setup**;
`/api/runner-key` hands it to the isolated runner at boot, where the WebContainer API requires
`configureAPIKey` to run in the browser. Treat that key as client-visible by design.

A sandbox parks itself when the tab closes or a turn ends with nothing to preview, and Daytona's
auto-stop catches the rest after ten idle minutes. Files survive; the next preview wakes it and
re-mints the signed URL.

The builder speaks a small XML protocol instead of native tool calling, so Gemini, Groq, and
Puter models behave identically: ` thinking` for visible reasoning, `<ask>` for a question with
options, `<edit>` for a find/replace change to an existing file, `<file>` for a complete file,
`<shell>` for one-off commands, `<run>` for a long-running server, `<git>` for an approved GitHub
push, and `<done>` for the closing summary. `src/lib/protocol.ts` parses it and applies edits (exact match, then a whitespace-tolerant
line match); `src/lib/prompts.ts` defines the planner, builder, and title prompts.

Follow-ups edit instead of rewriting: the model quotes the current lines it wants to change, so a
one-line tweak costs a few tokens instead of a whole file. Full `<file>` blocks are reserved for
new files or genuine rewrites.

Project types are detected, not declared. A `package.json` gets its dependencies installed and
its build script run before the preview starts; built output (`dist/`, `build/`, `out/`) is served
statically, otherwise `dev` or `start` scripts are launched on port 3000. A `<run>` command covers
everything else — Python, Go, or any server that binds `0.0.0.0:3000`.

## Local development

```bash
bun install
# optional: create .env.local with the keys from the table below
# the app still runs without keys in Browser mode
bun run dev
```

Open `http://localhost:3000`. The workspace loads at `/`; the old `/build` path redirects there.

The header has a light-mode toggle; the choice is saved in `localStorage` and applied by an inline
script before first paint. Light mode swaps the token values in `src/app/globals.css`, so every
Tailwind utility follows without per-component overrides.

Composio work uses a **session** scoped to the `github` toolkit. When `COMPOSIO_API_KEY` is set, the
first build creates or resumes a session for the workspace's stable user id, and the session's tool
slugs and argument names are added to the builder context so the agent calls them with `<action>`.
Actions run through the session, so identity and connections come from the same place. The skill
docs live in `.agents/skills/composio`.

Keys can also be entered per browser in **Setup** (`key` icon in the chat header) instead of the
server env. Saved keys live in `localStorage` and are sent as an `x-kiln-keys` header on same-origin
API calls; each route resolves them per request and falls back to the server env when absent. Every
third-party service the app talks to has a row there — Groq, Google AI Studio, Tavily, Daytona,
StackBlitz WebContainers, Composio, GitHub, and Vercel — so a deployment without env vars is fully
usable with your own keys.

There is no starter-prompt gallery: type what you want into the `❯` prompt line and press Enter.
The builder selector lists four Gemini models (3.8 Flash, 2.5 Flash, 2.5 Pro, 2.5 Flash Lite),
GPT-OSS 120B on Groq, and Puter. Puter adds its own free model picker (default, GPT-5 Nano,
Gemini 2.5 Flash, DeepSeek Chat). Cloud/browser mode sits beside them. Drag the divider beside the
preview to resize it (double-click resets, arrow keys work when focused).

**Deploy** in the preview header opens a sheet where you pick a free subdomain under
`base31.org` and check it against Vercel's project domains, then deploy the project. Vercel builds
the project from source, so Next/Astro/SvelteKit/Vue projects work without a local build; static
sites deploy as files. The deploy creates a project named `base31-<label>` and attaches the
domain — `base31.org` must live on the same Vercel account/team as the token.

A project keeps exactly one URL. Once it is published, the address is locked: the sheet shows it
with a **redeploy latest changes** button instead of a name field, and the preview header swaps
**deploy** for **redeploy** next to the live link. Redeploys create a new Vercel deployment under
the same project, so the domain never changes; only a first publish can claim a new subdomain.

## Environment variables on Vercel

Add these in **Project → Settings → Environment Variables**, for Production, Preview, and
Development, then redeploy.

| Variable | Required | Get it from | Used for |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | Cloud mode | [console.groq.com/keys](https://console.groq.com/keys) | Planning / thinking (`openai/gpt-oss-120b`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Cloud mode | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Builder (`gemini-3.8-flash`) |
| `TAVILY_API_KEY` | Optional | [app.tavily.com](https://app.tavily.com) | Live web search during builds |
| `DAYTONA_API_KEY` | Optional | [app.daytona.io](https://app.daytona.io/dashboard/keys) | Sandboxes, commands, signed previews |
| `WEBCONTAINER_API_KEY` | Optional | [webcontainers.io/api](https://webcontainers.io/api) | Raises browser-runtime limits (`STACKBLITZ_API_KEY` also works) |
| `COMPOSIO_API_KEY` | Optional | [app.composio.dev](https://app.composio.dev/developers) | GitHub / Supabase / Cloudflare / Vercel connectors |
| `GITHUB_TOKEN` | Optional | [github.com/settings/tokens](https://github.com/settings/tokens) | Octokit pushes: create repo, branch, commit, push |
| `VERCEL_TOKEN` | Optional | [vercel.com/account/tokens](https://vercel.com/account/tokens) | Deploy to `<name>.base31.org` (add `base31.org` to the same Vercel team) |
| `VERCEL_TEAM_ID` | Optional | Vercel team settings | Team that owns `base31.org` |
| `BASE31_DOMAIN` | Optional | default `base31.org` | Override the deploy apex domain |
| `NEXT_PUBLIC_SITE_URL` | Optional | your domain | Canonical and Open Graph URLs (Vercel's hostname is used if unset) |

Optional overrides: `GROQ_PLANNER_MODEL`, `GOOGLE_BUILDER_MODEL`, `GROQ_BUILDER_MODEL`,
`DAYTONA_API_URL`, `DAYTONA_TARGET`.

You do **not** need a database, auth provider, or object storage. Projects are stored per browser.

## Deploying to Vercel

1. Push this repository to GitHub and import it at [vercel.com/new](https://vercel.com/new).
2. Framework preset **Next.js** is detected. Keep build command `next build` and output `.next`;
   `bun.lock` is committed, so Vercel installs with Bun.
3. Add the variables above for **Production, Preview, and Development**, then deploy.
4. Open `/api/health` on the deployment. It lists the capabilities it sees, so a missing key shows up
   as `false` instead of a mysterious failure later.
5. Sign in to Puter from the header button if you use the key-less builder.

Notes:

- API routes run on the Node.js runtime. `maxDuration = 60` is set on the model and sandbox routes
  (the Vercel Hobby ceiling); raise it to 300 on Pro for longer single-shot builds.
- No database, auth provider, or storage bucket is needed. Projects live in the visitor's browser.
- Daytona preview URLs are signed and expire after six hours; the workspace mints a fresh one on reload.
- The build is self-contained: no `vercel.json`, custom output directory, or extra build step.

## Notes and limits

- GitHub pushes need `GITHUB_TOKEN` with `repo` scope. The agent emits a `<git action="push">`
  block, the chat shows a **push to GitHub** button, and the push happens only after you click it.
  There is no git binary inside WebContainers, so commits are created with the GitHub REST API
  (blobs → tree → commit → ref) rather than locally.
- The branch icon in the header opens **Git**: it lists your repositories, clones one with
  isomorphic-git into an in-memory volume on the server, and adopts the readable files as the
  project. Public repos clone without a token; listing and private clones require one. The same
  sheet can push the current project to a repo name and branch.
- The **skills** tab beside the preview holds instructions that ship with every build request.
  Nine defaults start a new browser: design variance, real content, framework playbook, verify
  before done, mobile layouts, accessible controls, restrained motion, self-contained assets, and
  real states. Edit, delete, or add your own — for example house style, stack rules, or a review
  checklist. `<test cmd="npm test">` runs the project's checks in the active runtime and feeds the
  output back to the agent.

- Puter.js loads on the client and the header button signs you in once. Models and pricing are
  controlled by Puter's user-pays model; the builder is selected in the composer.
- Composio connections need an auth config per toolkit. Create it in the Composio dashboard first,
  then use **Connectors → Connect**. The OAuth callback returns to the workspace. Connector tiles
  use the real brand mark from Composio's logo service, with a monogram fallback.
- Preview URLs from Daytona are signed and expire after six hours; press reload to mint a fresh one.
- Browser mode can write React and server projects but cannot install, bundle, or run them; switch
the prompt bar to cloud for those.
- Projects persist in `localStorage`. Clearing site data removes them.

## Project layout

```
src/app/            / workspace, /build redirect, API routes
src/components/     workspace panels, sheets, Puter account button
src/hooks/          useWorkspace: agent loop, artifacts, persistence
src/lib/            prompts, protocol parser, models, Puter, Daytona, Tavily, Composio
```

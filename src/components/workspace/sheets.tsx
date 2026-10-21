"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  KeyRound,
  Loader2,
  Plug,
  RefreshCw,
  X,
} from "lucide-react";
import type { Capabilities } from "@/lib/models";
import { cn } from "@/lib/utils";
import { getUserId } from "@/hooks/use-workspace";

function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
      />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-line bg-paper shadow-2xl animate-fade-up">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-medium tracking-[-0.01em]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded border border-line p-1 text-ink-faint transition-colors hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

type Toolkit = {
  slug: string;
  name: string;
  blurb?: string;
  connected: boolean;
  status?: string;
};

export function IntegrationsSheet({
  open,
  onClose,
  onOpenSetup,
  composioReady,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSetup: () => void;
  composioReady: boolean;
}) {
  const [toolkits, setToolkits] = useState<Toolkit[]>([]);
  const [fetched, setFetched] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [action, setAction] = useState("GITHUB_LIST_REPOSITORIES_FOR_A_USER");
  const [args, setArgs] = useState('{\n  "username": "octocat"\n}');
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!open || !composioReady) return;
    let cancelled = false;
    fetch(`/api/integrations?userId=${encodeURIComponent(getUserId())}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load connectors.");
        if (cancelled) return;
        setToolkits(data.toolkits ?? []);
        setError(null);
        setFetched(true);
      })
      .catch((cause: Error) => {
        if (cancelled) return;
        setError(cause.message);
        setFetched(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, composioReady, refreshKey]);

  const loading = open && !fetched && !error;

  async function connect(slug: string) {
    setConnecting(slug);
    setError(null);
    try {
      const response = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toolkit: slug, userId: getUserId(), callbackUrl: window.location.href }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create the connection link.");
      window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connection failed.");
    } finally {
      setConnecting(null);
    }
  }

  async function execute() {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(args || "{}") as Record<string, unknown>;
      } catch {
        throw new Error("Arguments must be valid JSON.");
      }
      const response = await fetch("/api/integrations/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, args: parsed, userId: getUserId() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Action failed.");
      setResult(JSON.stringify(data, null, 2));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Connectors"
      subtitle="Composio handles OAuth. Kiln only receives scoped access, never passwords."
    >
      {!composioReady ? (
        <div className="rounded-md border border-line bg-paper-2/50 p-4">
          <KeyRound className="h-4 w-4 text-ember" />
          <p className="mt-2 text-[13px] font-medium">Composio isn&apos;t configured</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
            Add <code className="font-mono text-[11px]">COMPOSIO_API_KEY</code> to link GitHub,
            Supabase, Cloudflare, Vercel and more.
          </p>
          <button
            type="button"
            onClick={onOpenSetup}
            className="mt-3 inline-flex items-center gap-1.5 rounded bg-ink px-3 py-1.5 text-[12px] text-cream"
          >
            Open setup <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <>
          {error && (
            <p className="mb-3 rounded border border-ember/30 bg-ember-soft/50 px-3 py-2 text-[12px] text-ember">
              {error}
            </p>
          )}

          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setFetched(false);
                setRefreshKey((value) => value + 1);
              }}
              className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wider text-ink-faint hover:text-ink"
            >
              <RefreshCw className={cn("h-2.5 w-2.5", loading && "animate-spin")} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-[12.5px] text-ink-soft">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading toolkits…
            </div>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {toolkits.map((toolkit) => (
                <li key={toolkit.slug} className="flex items-center gap-3 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-line bg-paper-2/60 font-mono text-[11px] uppercase text-ink-soft">
                    {toolkit.name.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[13px] font-medium">
                      {toolkit.name}
                      {toolkit.connected && <Check className="h-3 w-3 text-moss" />}
                    </p>
                    <p className="truncate text-[11.5px] text-ink-soft">
                      {toolkit.connected ? "Connected" : toolkit.blurb ?? toolkit.slug}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => connect(toolkit.slug)}
                    disabled={connecting === toolkit.slug}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors",
                      toolkit.connected
                        ? "border-line text-ink-soft hover:border-line-strong"
                        : "border-ink bg-ink text-cream hover:bg-ink/90",
                    )}
                  >
                    {connecting === toolkit.slug ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <Plug className="h-2.5 w-2.5" />
                    )}
                    {toolkit.connected ? "Reconnect" : "Connect"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
            Connecting opens Composio in a new tab. Finish there, then reload this list. If a toolkit
            is missing, create an auth config for it in the Composio dashboard first.
          </p>

          <div className="mt-6 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced((value) => !value)}
              className="flex w-full items-center justify-between text-[12.5px] font-medium"
            >
              Run a connector action
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-180")} />
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-2.5">
                <div>
                  <label htmlFor="action" className="label-xs text-ink-faint">
                    Action slug
                  </label>
                  <input
                    id="action"
                    value={action}
                    onChange={(event) => setAction(event.target.value)}
                    className="mt-1 w-full rounded border border-line bg-paper px-2.5 py-1.5 font-mono text-[11px] focus:border-line-strong focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="args" className="label-xs text-ink-faint">
                    Arguments (JSON)
                  </label>
                  <textarea
                    id="args"
                    value={args}
                    onChange={(event) => setArgs(event.target.value)}
                    rows={4}
                    className="mt-1 w-full resize-y rounded border border-line bg-paper px-2.5 py-1.5 font-mono text-[11px] leading-relaxed focus:border-line-strong focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={execute}
                  disabled={running}
                  className="inline-flex items-center gap-1.5 rounded bg-ink px-3 py-1.5 text-[12px] text-cream disabled:opacity-60"
                >
                  {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plug className="h-3 w-3" />}
                  Execute
                </button>
                {result && (
                  <pre className="max-h-64 overflow-auto rounded border border-line bg-paper-2/40 p-2.5 font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap">
                    {result}
                  </pre>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}

const ENV_VARS: { key: string; label: string; purpose: string; href: string; capability?: keyof Capabilities }[] = [
  {
    key: "GROQ_API_KEY",
    label: "Groq",
    purpose: "Planning and thinking. Fast, cheap, free tier.",
    href: "https://console.groq.com/keys",
    capability: "groq",
  },
  {
    key: "GOOGLE_GENERATIVE_AI_API_KEY",
    label: "Google AI Studio",
    purpose: "The builder model: Gemini 3.8 Flash.",
    href: "https://aistudio.google.com/apikey",
    capability: "google",
  },
  {
    key: "TAVILY_API_KEY",
    label: "Tavily",
    purpose: "Live web search inside builds.",
    href: "https://app.tavily.com/home",
    capability: "tavily",
  },
  {
    key: "DAYTONA_API_KEY",
    label: "Daytona",
    purpose: "Cloud sandboxes, commands, signed previews.",
    href: "https://app.daytona.io/dashboard/keys",
    capability: "daytona",
  },
  {
    key: "COMPOSIO_API_KEY",
    label: "Composio",
    purpose: "GitHub, Supabase, Cloudflare, Vercel connectors.",
    href: "https://app.composio.dev/developers",
    capability: "composio",
  },
];

export function SetupSheet({
  open,
  onClose,
  capabilities,
  onRecheck,
}: {
  open: boolean;
  onClose: () => void;
  capabilities: Capabilities | null;
  onRecheck: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const missing = ENV_VARS.filter((item) => item.capability && !capabilities?.[item.capability]).length;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Setup"
      subtitle="Keys live in Vercel environment variables and are read server-side only."
    >
      <div className="rounded-md border border-line bg-paper-2/50 px-3.5 py-3">
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          {missing === 0
            ? "Everything is configured. Cloud builds, search, and connectors are available."
            : `${missing} key${missing === 1 ? "" : "s"} missing. Browser mode still works — puter builds need no keys.`}
        </p>
        <button
          type="button"
          onClick={() => {
            setChecking(true);
            onRecheck();
            window.setTimeout(() => setChecking(false), 900);
          }}
          className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ember hover:underline"
        >
          <RefreshCw className={cn("h-3 w-3", checking && "animate-spin")} /> Recheck
        </button>
      </div>

      <ul className="mt-5 space-y-3">
        {ENV_VARS.map((item) => {
          const ready = item.capability ? Boolean(capabilities?.[item.capability]) : false;
          return (
            <li key={item.key} className="rounded-md border border-line px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] font-medium">
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", ready ? "bg-moss" : "bg-line-strong")}
                    />
                    {item.label}
                  </p>
                  <p className="mt-0.5 font-mono text-[10.5px] text-ink-faint">{item.key}</p>
                </div>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-[11px] text-ink-soft hover:text-ember"
                >
                  Get key <ArrowUpRight className="h-2.5 w-2.5" />
                </a>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{item.purpose}</p>
            </li>
          );
        })}
      </ul>

      <div className="mt-6">
        <p className="label-xs text-ink-faint">Optional overrides</p>
        <dl className="mt-2 space-y-1.5 font-mono text-[10.5px] text-ink-soft">
          {[
            ["GROQ_PLANNER_MODEL", "openai/gpt-oss-120b"],
            ["GOOGLE_BUILDER_MODEL", "gemini-3.8-flash"],
            ["GROQ_BUILDER_MODEL", "openai/gpt-oss-120b"],
            ["DAYTONA_API_URL", "defaults to Daytona cloud"],
            ["DAYTONA_TARGET", "defaults to your region"],
          ].map(([key, value]) => (
            <div key={key} className="flex flex-wrap justify-between gap-2 border-b border-line/70 pb-1">
              <dt className="text-ink">{key}</dt>
              <dd className="text-ink-faint">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <p className="label-xs text-ink-faint">On Vercel</p>
        <ol className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-ink-soft">
          <li>1. Project → Settings → Environment Variables.</li>
          <li>2. Add each key for Production, Preview, and Development.</li>
          <li>3. Redeploy so the new values are picked up.</li>
          <li className="text-ink-faint">
            Local development: put the same keys in <span className="font-mono">.env.local</span>.
          </li>
        </ol>
      </div>
    </Sheet>
  );
}

/**
 * Forward an incoming request to the upstream LLM provider, swapping in the
 * owner's API key. Pass through the body verbatim so any
 * OpenAI/Anthropic-compatible client works without changes.
 *
 * Streaming (SSE): we set up the upstream as a stream and pipe the body
 * through. We do NOT inspect the stream; the client sees raw upstream output.
 */
import type { Env } from "./types";

const DEFAULT_OPENAI_BASE = "https://api.openai.com";
const DEFAULT_ANTHROPIC_BASE = "https://api.anthropic.com";

export async function forwardOpenAI(req: Request, env: Env): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    return jsonError(503, "openai_not_configured", "Owner has not configured OPENAI_API_KEY");
  }
  const base = (env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE).replace(/\/$/, "");
  const url = new URL(req.url);
  // If the configured base already ends in /v1, drop the leading /v1 from the
  // request pathname so we don't double up. Lets users paste either
  // `https://api.openai.com` or `https://api.openai.com/v1` without surprise.
  const path = base.endsWith("/v1") && url.pathname.startsWith("/v1/")
    ? url.pathname.slice(3)
    : url.pathname;
  const upstream = `${base}${path}${url.search}`;

  const headers = new Headers(req.headers);
  headers.set("Authorization", `Bearer ${env.OPENAI_API_KEY}`);
  // Strip CF / HAP-specific bookkeeping
  for (const h of ["x-hap-client-id", "x-real-ip", "cf-connecting-ip", "cf-ipcountry", "cf-ray"]) {
    headers.delete(h);
  }
  headers.delete("host");

  return fetch(upstream, {
    method: req.method,
    headers,
    body: req.body,
    // @ts-expect-error — Cloudflare Workers extension for streaming
    duplex: "half",
  });
}

export async function forwardAnthropic(req: Request, env: Env): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonError(503, "anthropic_not_configured", "Owner has not configured ANTHROPIC_API_KEY");
  }
  const base = (env.ANTHROPIC_BASE_URL || DEFAULT_ANTHROPIC_BASE).replace(/\/$/, "");
  const url = new URL(req.url);
  const path = base.endsWith("/v1") && url.pathname.startsWith("/v1/")
    ? url.pathname.slice(3)
    : url.pathname;
  const upstream = `${base}${path}${url.search}`;

  const headers = new Headers(req.headers);
  headers.delete("authorization");
  headers.set("x-api-key", env.ANTHROPIC_API_KEY);
  if (!headers.get("anthropic-version")) headers.set("anthropic-version", "2023-06-01");
  for (const h of ["x-hap-client-id", "x-real-ip", "cf-connecting-ip", "cf-ipcountry", "cf-ray"]) {
    headers.delete(h);
  }
  headers.delete("host");

  return fetch(upstream, {
    method: req.method,
    headers,
    body: req.body,
    // @ts-expect-error — Cloudflare Workers extension for streaming
    duplex: "half",
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

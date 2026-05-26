/**
 * HAP free-key LLM proxy. Cloudflare Workers app.
 *
 * Public endpoints (anonymous, rate-limited):
 *   POST /v1/chat/completions     OpenAI-compatible chat
 *   POST /v1/messages             Anthropic-compatible messages
 *   GET  /v1/models               List allowed upstream models
 *   GET  /quota                   Read remaining quota for X-HAP-Client-Id
 *   GET  /health                  Liveness
 *
 * Admin endpoints (require X-Admin-Token header == PROXY_ADMIN_TOKEN secret):
 *   POST /admin/reset             Body: { clientId?, ip? } → zero a bucket
 *
 * Client identification:
 *   Required header: X-HAP-Client-Id (any opaque string, client-generated UUID).
 *   We fall back to IP-only quotas if the header is missing, but a stable
 *   client ID gives users predictable per-day budgets.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { checkQuota, consumeQuota } from "./quota";
import { forwardAnthropic, forwardOpenAI } from "./providers";
import type { Bindings, QuotaResult } from "./types";

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["content-type", "authorization", "x-hap-client-id", "anthropic-version", "x-admin-token"],
  exposeHeaders: ["x-hap-quota-day-remaining", "x-hap-quota-minute-remaining", "x-hap-quota-reset-sec"],
  maxAge: 86400,
}));

app.get("/health", (c) => c.json({ ok: true, role: "hap-proxy", version: "0.1.0" }));

app.get("/quota", async (c) => {
  const clientId = c.req.header("x-hap-client-id") || "anon";
  const ip = clientIp(c.req.raw);
  const q = await checkQuota(c.env, clientId, ip);
  return c.json(q);
});

app.get("/v1/models", (c) => {
  return c.json({
    data: [
      { id: c.env.DEFAULT_OPENAI_MODEL, owned_by: "openai", provider: "openai" },
      { id: c.env.DEFAULT_ANTHROPIC_MODEL, owned_by: "anthropic", provider: "anthropic" },
    ],
  });
});

app.post("/v1/chat/completions", async (c) => {
  const guard = await guardQuota(c);
  if (guard.refusal) return guard.refusal;
  const resp = await forwardOpenAI(c.req.raw, c.env);
  return decorateQuotaHeaders(resp, guard.quota);
});

app.post("/v1/messages", async (c) => {
  const guard = await guardQuota(c);
  if (guard.refusal) return guard.refusal;
  const resp = await forwardAnthropic(c.req.raw, c.env);
  return decorateQuotaHeaders(resp, guard.quota);
});

// ---- admin -------------------------------------------------------------

app.post("/admin/reset", async (c) => {
  const token = c.req.header("x-admin-token");
  if (!c.env.PROXY_ADMIN_TOKEN || token !== c.env.PROXY_ADMIN_TOKEN) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const body = await c.req.json<{ clientId?: string; ip?: string }>().catch(() => ({}));
  const dateK = new Date().toISOString().slice(0, 10);
  const minK = new Date().toISOString().slice(0, 16);
  const ops: Promise<void>[] = [];
  if (body.clientId) {
    ops.push(c.env.QUOTA_KV.delete(`c:${body.clientId}:d:${dateK}`));
    ops.push(c.env.QUOTA_KV.delete(`c:${body.clientId}:m:${minK}`));
  }
  if (body.ip) {
    ops.push(c.env.QUOTA_KV.delete(`ip:${body.ip}:d:${dateK}`));
  }
  await Promise.all(ops);
  return c.json({ ok: true, reset: { clientId: body.clientId, ip: body.ip } });
});

// ---- helpers -----------------------------------------------------------

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

async function guardQuota(c: {
  req: { raw: Request; header: (h: string) => string | undefined };
  env: Bindings;
  json: (b: unknown, s?: number) => Response;
}): Promise<{ refusal: Response | null; quota: QuotaResult }> {
  const clientId = c.req.header("x-hap-client-id") || c.req.header("X-HAP-Client-Id") || "anon";
  const ip = clientIp(c.req.raw);
  const q = await consumeQuota(c.env, clientId, ip);
  if (!q.allowed) {
    const body = {
      error: {
        code: "rate_limited",
        reason: q.reason,
        message:
          q.reason === "day_exceeded"
            ? `Daily limit hit. Bring your own key, or wait ${Math.ceil(q.resetInSec / 3600)}h.`
            : q.reason === "minute_exceeded"
            ? "Burst limit hit. Slow down for 60s."
            : "IP-level limit hit. Try a different network, or BYO key.",
        quota: q,
      },
    };
    const r = new Response(JSON.stringify(body), {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(q.resetInSec),
        "x-hap-quota-day-remaining": String(q.remainingDay),
        "x-hap-quota-minute-remaining": String(q.remainingMinute),
        "x-hap-quota-reset-sec": String(q.resetInSec),
      },
    });
    return { refusal: r, quota: q };
  }
  return { refusal: null, quota: q };
}

function decorateQuotaHeaders(resp: Response, q: QuotaResult): Response {
  // Headers on streamed responses must be cloned via new Response, but
  // body is a ReadableStream — pass it through.
  const headers = new Headers(resp.headers);
  headers.set("x-hap-quota-day-remaining", String(q.remainingDay));
  headers.set("x-hap-quota-minute-remaining", String(q.remainingMinute));
  headers.set("x-hap-quota-reset-sec", String(q.resetInSec));
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}

export default app;

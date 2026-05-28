// Thin server-side proxy to a running serve-inbox (HAP_INBOX_URL). Keeps the web
// app stateless and free of @hap/* raw-TS deps — it just relays + the dashboard
// renders. Returns an empty state with a hint when the env var is unset.
export const runtime = "nodejs";

export async function GET() {
  const base = process.env.HAP_INBOX_URL;
  if (!base) {
    return Response.json({ records: [], hint: "set HAP_INBOX_URL to your serve-inbox endpoint (e.g. http://localhost:4910)" });
  }
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/inbox`, { cache: "no-store" });
    return Response.json(await r.json(), { status: r.status });
  } catch (e) {
    return Response.json({ records: [], error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

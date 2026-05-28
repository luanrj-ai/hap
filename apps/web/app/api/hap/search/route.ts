// Proxy candidate search to a running serve-index (HAP_INDEX_URL). The recruiter
// identity is attached server-side (HAP_RECRUITER_ID) so the index can enforce
// its rate limits / blocklist.
export const runtime = "nodejs";

export async function GET(req: Request) {
  const base = process.env.HAP_INDEX_URL;
  if (!base) {
    return Response.json({ ok: false, hits: [], hint: "set HAP_INDEX_URL to your serve-index endpoint" });
  }
  const url = new URL(req.url);
  const qs = new URLSearchParams();
  const q = url.searchParams.get("q");
  const openTo = url.searchParams.get("open_to");
  if (q) qs.set("q", q);
  if (openTo) qs.set("open_to", openTo);
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/search?${qs}`, {
      headers: { "x-hap-recruiter": process.env.HAP_RECRUITER_ID ?? "dashboard" },
      cache: "no-store",
    });
    return Response.json(await r.json(), { status: r.status });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

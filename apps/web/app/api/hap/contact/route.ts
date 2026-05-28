// Proxy a contact request to serve-index. The index gates this by recruiter
// identity + the candidate's own rate_limit, so contact is never bulk-exposed.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const base = process.env.HAP_INDEX_URL;
  if (!base) {
    return Response.json({ ok: false, error: "HAP_INDEX_URL unset" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { candidate?: string };
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/contact`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hap-recruiter": process.env.HAP_RECRUITER_ID ?? "dashboard" },
      body: JSON.stringify(body),
    });
    return Response.json(await r.json(), { status: r.status });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

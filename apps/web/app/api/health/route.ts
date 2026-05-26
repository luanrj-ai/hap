export const runtime = "nodejs";

export async function GET() {
  return Response.json({ ok: true, service: "resumetruth-api", ts: Date.now() });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

import type { FeedbackRequest } from "@resumetruth/shared";
import { prisma } from "../../../lib/db";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function POST(req: Request) {
  let body: FeedbackRequest;
  try {
    body = (await req.json()) as FeedbackRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.scoreId || typeof body.scoreId !== "string") {
    return Response.json({ error: "scoreId is required" }, { status: 400 });
  }
  if (body.thumbs !== "up" && body.thumbs !== "down") {
    return Response.json(
      { error: "thumbs must be 'up' or 'down'" },
      { status: 400 },
    );
  }

  const score = await prisma.score.findUnique({ where: { id: body.scoreId } });
  if (!score) {
    return Response.json({ error: "Unknown scoreId" }, { status: 404 });
  }

  const fb = await prisma.feedback.create({
    data: {
      scoreId: body.scoreId,
      signalId: body.signalId ?? null,
      thumbs: body.thumbs,
      reason: body.reason?.slice(0, 500) ?? null,
    },
  });

  return Response.json({ ok: true, id: fb.id });
}

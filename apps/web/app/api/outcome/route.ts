/**
 * POST /api/outcome
 * Body: { scoreId, outcome: "interviewed" | "hired" | "declined" | "rejected", notes? }
 *
 * Records the hiring outcome for a previously-scored candidate. This is the
 * gold-standard ground truth that the calibration script reads to adjust
 * thresholds.
 */
import { prisma } from "../../../lib/db";

export const runtime = "nodejs";

const VALID_OUTCOMES = ["interviewed", "hired", "declined", "rejected"] as const;
type Outcome = (typeof VALID_OUTCOMES)[number];

interface Body {
  scoreId: string;
  outcome: Outcome | null; // null = clear the outcome
  notes?: string;
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.scoreId) return Response.json({ error: "scoreId required" }, { status: 400 });
  if (body.outcome !== null && !VALID_OUTCOMES.includes(body.outcome)) {
    return Response.json(
      { error: `outcome must be one of ${VALID_OUTCOMES.join("/")} or null` },
      { status: 400 },
    );
  }

  const score = await prisma.score.findUnique({ where: { id: body.scoreId } });
  if (!score) return Response.json({ error: "scoreId not found" }, { status: 404 });

  await prisma.score.update({
    where: { id: body.scoreId },
    data: {
      hiringOutcome: body.outcome,
      outcomeNotes: body.notes?.slice(0, 500) ?? null,
      outcomeRecordedAt: body.outcome ? new Date() : null,
    },
  });

  return Response.json({ ok: true, scoreId: body.scoreId, outcome: body.outcome });
}

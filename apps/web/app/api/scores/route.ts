import { prisma } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);

  const scores = await prisma.score.findMany({
    take: limit,
    orderBy: { scoredAt: "desc" },
    include: {
      _count: { select: { feedback: true } },
    },
  });

  return Response.json({
    scores: scores.map((s) => ({
      id: s.id,
      candidateName: s.candidateName,
      authenticity: s.authenticity,
      verifiability: s.verifiability,
      interview: s.interview,
      summary: s.summary,
      scoredAt: s.scoredAt,
      feedbackCount: s._count.feedback,
      hasEnhancement: Boolean(s.enhancementJson),
    })),
  });
}

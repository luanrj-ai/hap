/**
 * GET /api/candidates?skills=Go,Kafka&minScore=60&jdContains=payments&limit=20
 *
 * Skill-filtered candidate search across the Score table. All filters AND together.
 *   - skills: comma-separated, match on extractedSkills.skills (case-insensitive)
 *   - minScore: minimum interview score
 *   - jdContains: filter to jobs whose description contains this string
 *   - hasOutcome=true / false
 *   - limit: default 20, max 100
 */
import { prisma } from "../../../lib/db";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const skillsParam = url.searchParams.get("skills");
  const wantedSkills = skillsParam
    ? skillsParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];
  const minScore = Number(url.searchParams.get("minScore") ?? "0");
  const jdContains = url.searchParams.get("jdContains")?.toLowerCase() ?? null;
  const hasOutcome = url.searchParams.get("hasOutcome");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);

  const where = {
    interview: { gte: minScore },
    ...(jdContains ? { jobDescription: { contains: jdContains } } : {}),
    ...(hasOutcome === "true" ? { hiringOutcome: { not: null } } : {}),
    ...(hasOutcome === "false" ? { hiringOutcome: null } : {}),
  };

  const candidates = await prisma.score.findMany({
    where,
    orderBy: { interview: "desc" },
    take: limit * 3, // over-fetch to allow skill filter
    select: {
      id: true,
      candidateName: true,
      authenticity: true,
      verifiability: true,
      interview: true,
      summary: true,
      scoredAt: true,
      skillsJson: true,
      jobDescription: true,
      hiringOutcome: true,
    },
  });

  // Filter by skills in-memory (SQLite has no JSON ops we can rely on)
  const filtered = candidates.filter((c) => {
    if (wantedSkills.length === 0) return true;
    if (!c.skillsJson) return false;
    try {
      const parsed = JSON.parse(c.skillsJson) as { skills: string[] };
      const skillSet = new Set(parsed.skills.map((s) => s.toLowerCase()));
      return wantedSkills.every((s) => skillSet.has(s));
    } catch {
      return false;
    }
  });

  const result = filtered.slice(0, limit).map((c) => ({
    id: c.id,
    candidateName: c.candidateName,
    authenticity: c.authenticity,
    verifiability: c.verifiability,
    interview: c.interview,
    summary: c.summary,
    scoredAt: c.scoredAt,
    skills: c.skillsJson ? (JSON.parse(c.skillsJson) as { skills: string[] }).skills : [],
    hiringOutcome: c.hiringOutcome,
    jdSnippet: (c.jobDescription || "").split("\n")[0]?.slice(0, 80) ?? "",
  }));

  return Response.json({
    query: { skills: wantedSkills, minScore, jdContains, hasOutcome },
    totalAfterFilter: filtered.length,
    candidates: result,
  });
}

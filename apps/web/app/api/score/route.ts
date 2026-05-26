import { scoreResumeWithEnhancement } from "@resumetruth/scoring";
import type { ScoreRequest } from "@resumetruth/shared";
import { prisma } from "../../../lib/db";
import { sha256 } from "../../../lib/hash";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function POST(req: Request) {
  let body: ScoreRequest;
  try {
    body = (await req.json()) as ScoreRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.resumeText || typeof body.resumeText !== "string") {
    return Response.json({ error: "resumeText is required" }, { status: 400 });
  }

  if (body.resumeText.length > 50_000) {
    return Response.json({ error: "resumeText too long (max 50k chars)" }, { status: 413 });
  }

  if (body.resumeText.trim().length < 50) {
    return Response.json({ error: "resumeText too short (min 50 chars)" }, { status: 400 });
  }

  try {
    const result = await scoreResumeWithEnhancement(body);
    const candidateHash = sha256(body.resumeText);

    const saved = await prisma.score.create({
      data: {
        candidateName: body.candidateName || null,
        candidateHash,
        authenticity: result.authenticity,
        verifiability: result.verifiability,
        interview: result.interview,
        summary: result.summary,
        linkedinUrl: body.linkedinUrl || null,
        jobDescription: body.jobDescription || null,
        enhancementJson: result.enhancement
          ? JSON.stringify(result.enhancement)
          : null,
        verificationJson: result.verification
          ? JSON.stringify(result.verification)
          : null,
        skillsJson: result.extractedSkills ? JSON.stringify(result.extractedSkills) : null,
        panelJson: result.expertPanel ? JSON.stringify(result.expertPanel) : null,
        signals: {
          create: result.signals.map((s) => ({
            signalId: s.id,
            label: s.label,
            dimension: s.dimension,
            weight: s.weight,
            value: s.score,
            impact: s.impact,
            explanation: s.explanation,
          })),
        },
      },
    });

    return Response.json({ ...result, scoreId: saved.id });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[score] failed:", detail);
    return Response.json({ error: "Scoring failed", details: detail }, { status: 500 });
  }
}

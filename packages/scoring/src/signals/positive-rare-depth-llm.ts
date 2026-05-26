import type { SignalResult } from "@resumetruth/shared";
import { activeProvider, callLLMJson } from "../llm-client";

/**
 * LLM-powered technical depth signal. Replaces the regex version which only
 * matched 7 hardcoded categories — AI resumes routinely use synonyms or
 * paraphrases that bypass keyword lists.
 *
 * The LLM is asked to semantically judge how technically deep the resume is,
 * looking for hard-to-fabricate evidence: specific algorithms named, specific
 * performance numbers tied to systems, real conference talks with titles,
 * verifiable open-source contributions, etc.
 */

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["depthScore", "evidence", "verdict"],
  properties: {
    depthScore: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description:
        "0=zero depth (generic buzzwords only); 50=some technical specifics; 80+=multiple hard-to-fabricate evidence points; 95+=deep technical maturity",
    },
    verdict: {
      type: "string",
      enum: ["surface", "moderate", "deep"],
    },
    evidence: {
      type: "array",
      items: { type: "string" },
      maxItems: 4,
      description: "Up to 4 short pieces of evidence (Chinese) for the depth score. Concrete observations only.",
    },
  },
};

const SYSTEM = `You evaluate technical depth in engineering resumes — does this candidate show evidence of deep work, or is it surface-level claims?

Score depthScore 0–100:
- 0–30: surface only (buzzwords, no specifics, generic project descriptions)
- 31–60: moderate depth (some specific tools, basic metrics, named projects)
- 61–85: clear depth (specific algorithms named, concrete performance numbers tied to systems, real OSS work, conference talks with titles)
- 86–100: exceptional depth (multiple verifiable artifacts, internal RFCs, novel approaches, mentorship/talks at major venues)

What COUNTS as deep evidence (hard for AI to fabricate convincingly):
- Named algorithms / protocols: "Raft consensus", "CRDT", "operational transforms", "two-phase commit", "Lamport timestamps", "consistent hashing"
- Specific numbers tied to real systems: "cut p99 from 340ms to 110ms across 18M daily requests", "$14B annual flow"
- Real OSS with quantified impact: "maintainer of ratelimit-go (1.2k stars)"
- Specific conference talks with titles: "GopherCon 2024 — Designing Idempotent Payment APIs"
- Specific RFC references, PR numbers, commit SHAs
- Internal RFC titles or design doc references

What does NOT count (anyone can claim):
- "Designed scalable systems"
- "Improved performance"
- "Led cross-functional initiatives"
- "Strong understanding of distributed systems"

CRITICAL FAIRNESS RULES:
- Non-native English speakers writing concisely ≠ surface. Look for SPECIFICS, not register.
- Junior candidates CAN have moderate depth (50–65) if they did real work; don't conflate seniority with depth.
- Formal academic style ≠ surface; some industries write formally.

Output JSON only. Evidence array in Chinese.`;

interface LLMResult {
  depthScore: number;
  verdict: "surface" | "moderate" | "deep";
  evidence: string[];
}

export async function positiveRareDepthLlmSignal(resumeText: string): Promise<SignalResult> {
  if (!activeProvider()) {
    return {
      id: "positive-rare-depth",
      label: "技术深度（罕见 AI 伪造）",
      dimension: "interview",
      weight: 15,
      score: 50,
      impact: "neutral",
      explanation: "未配置 LLM key，跳过语义级技术深度评估。",
    };
  }

  const parsed = await callLLMJson<LLMResult>({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Evaluate technical depth in this resume:\n\n${resumeText.slice(0, 20_000)}` },
    ],
    schema: SCHEMA,
    schemaName: "technical_depth",
    maxTokens: 500,
  });

  if (!parsed) {
    return {
      id: "positive-rare-depth",
      label: "技术深度（罕见 AI 伪造）",
      dimension: "interview",
      weight: 15,
      score: 50,
      impact: "neutral",
      explanation: "LLM 调用失败，回退到中性分。",
    };
  }

  const score = Math.max(0, Math.min(100, Math.round(parsed.depthScore)));
  const verdictZh = parsed.verdict === "deep" ? "技术深度高" : parsed.verdict === "moderate" ? "中等深度" : "缺乏深度";
  const ev = parsed.evidence.slice(0, 3).join("；");

  return {
    id: "positive-rare-depth",
    label: "技术深度（LLM 语义评估）",
    dimension: "interview",
    weight: 15,
    score,
    impact: score >= 70 ? "positive" : score < 40 ? "negative" : "neutral",
    explanation: `${verdictZh}。${ev}。`,
  };
}

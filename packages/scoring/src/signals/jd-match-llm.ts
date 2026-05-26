import type { SignalResult } from "@resumetruth/shared";
import { activeProvider, callLLMJson } from "../llm-client";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "matchedAreas", "missingAreas", "reasoning"],
  properties: {
    score: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description:
        "Semantic match score 0-100. 0=completely unrelated, 50=partial overlap, 80+=strong fit, 95+=ideal candidate.",
    },
    matchedAreas: {
      type: "array",
      items: { type: "string" },
      maxItems: 5,
      description:
        "Up to 5 specific areas where the resume aligns with the JD (e.g., 'distributed systems experience at scale', '5+ years Go').",
    },
    missingAreas: {
      type: "array",
      items: { type: "string" },
      maxItems: 5,
      description:
        "Up to 5 specific JD requirements not clearly evidenced in the resume.",
    },
    reasoning: {
      type: "string",
      description: "One short sentence (中文) explaining the score.",
    },
  },
};

const SYSTEM = `You are a senior technical recruiter scoring how well a resume matches a job description.

Score semantically, not by keyword overlap:
- "payments" and "fintech" and "Stripe" are essentially the same domain → match
- "5 years Go" and "Go developer with proven experience" → match
- "React frontend" vs "backend distributed systems JD" → low match
- Junior candidate for senior role → score down even if skills overlap

Calibration bands:
- 0-30   = different role entirely (frontend vs backend, designer vs engineer, junior vs senior)
- 31-50  = right role but very different domain (backend at gaming company applying to payments)
- 51-65  = right role, right seniority, BUT key domain or hard requirement missing
- 66-79  = strong fit on most requirements, one or two gaps
- 80-89  = strong fit, all critical requirements evidenced
- 90-100 = exceptional fit, ideal candidate

DOMAIN-MISMATCH RULE (very important):
If the JD specifies a domain (payments, fintech, ML, gaming, healthcare, etc.) and the
candidate's experience is in a DIFFERENT domain — even if their general skills overlap
heavily — score 50–65, NOT 70+. Senior generalist skills ≠ domain expertise.

HARD-REQUIREMENT RULE:
If the JD lists a hard requirement ("5+ years X", "must have Y") and the resume does
not clearly show it, cap the score at 65 even if everything else looks great.

Output JSON only. Reasoning in Chinese (一句话即可).`;

interface LLMResult {
  score: number;
  matchedAreas: string[];
  missingAreas: string[];
  reasoning: string;
}

export async function jdMatchLLMSignal(
  resumeText: string,
  jobDescription?: string,
): Promise<SignalResult> {
  if (!jobDescription || jobDescription.trim().length < 20) {
    return {
      id: "jd-match",
      label: "岗位匹配度（LLM）",
      dimension: "interview",
      weight: 30,
      score: 50,
      impact: "neutral",
      explanation: "未提供 Job Description，跳过岗位匹配度评估。",
    };
  }

  if (!activeProvider()) {
    return {
      id: "jd-match",
      label: "岗位匹配度（LLM）",
      dimension: "interview",
      weight: 30,
      score: 50,
      impact: "neutral",
      explanation: "未配置 LLM key，回退到中性分。设置 OPENAI_API_KEY 或 ANTHROPIC_API_KEY 启用语义匹配。",
    };
  }

  const userMsg = [
    "# Job Description",
    jobDescription.slice(0, 5_000),
    "",
    "# Candidate Resume",
    resumeText.slice(0, 20_000),
  ].join("\n");

  const parsed = await callLLMJson<LLMResult>({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userMsg },
    ],
    schema: SCHEMA,
    schemaName: "jd_match",
    maxTokens: 600,
  });

  if (!parsed) {
    return {
      id: "jd-match",
      label: "岗位匹配度（LLM）",
      dimension: "interview",
      weight: 30,
      score: 50,
      impact: "neutral",
      explanation: "LLM 调用失败，回退到中性分（参见日志）。",
    };
  }

  const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
  const explanation =
    parsed.reasoning +
    (parsed.matchedAreas.length > 0
      ? ` 匹配点：${parsed.matchedAreas.slice(0, 3).join("、")}。`
      : "") +
    (parsed.missingAreas.length > 0
      ? ` 缺口：${parsed.missingAreas.slice(0, 2).join("、")}。`
      : "");

  return {
    id: "jd-match",
    label: "岗位匹配度（LLM）",
    dimension: "interview",
    weight: 30,
    score,
    impact: score >= 65 ? "positive" : score < 35 ? "negative" : "neutral",
    explanation,
  };
}

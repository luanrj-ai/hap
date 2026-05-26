import type { SignalResult } from "@resumetruth/shared";
import { activeProvider, callLLMJson } from "../llm-client";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["humanScore", "verdict", "evidence", "confidence"],
  properties: {
    humanScore: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description:
        "0=clearly AI-generated, 100=clearly human-written. 50=genuinely ambiguous.",
    },
    verdict: {
      type: "string",
      enum: ["human", "ai", "uncertain"],
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
    evidence: {
      type: "array",
      items: { type: "string" },
      maxItems: 4,
      description: "Up to 4 short pieces of evidence (Chinese), e.g. 'no specific numbers anywhere'.",
    },
  },
};

const SYSTEM = `You evaluate whether a resume was AI-generated.

Output a humanScore 0–100:
- 100 = clearly human (specific numbers, real company names like Stripe/Notion/PayPal, varied bullet structure, real metrics like "p99 110ms", "$14B annual flow", "1.2k stars")
- 50  = genuinely ambiguous
- 0   = clearly AI-generated (buzzword salad, zero specifics, generic company names like "TechCorp"/"Digital Finance Solutions", identical bullet structures, no metrics)

CRITICAL FAIRNESS RULES — these will be audited:
1. **Non-native English ≠ AI.** A resume with imperfect grammar but real specifics (real companies, real numbers, real GitHub URLs) is HUMAN. Score 80+.
2. **Formal corporate style ≠ AI.** Government, banking, big-tech employees often write formally. Look for specifics, not register.
3. **The smoking gun for AI**: ALL of:
   (a) heavy buzzword density (transformative, revolutionary, pioneering, results-driven, leverage, spearhead, synergize, world-class, cutting-edge),
   (b) ZERO specific numbers/metrics across the whole resume,
   (c) generic company names ("TechCorp", "FintechCo", "Digital Finance Solutions"),
   (d) bullets all the same length and abstraction level.
   Without ALL of (a)-(d), do NOT score below 40.

The evidence array (Chinese) must explain your verdict in 2–4 brief points.

Output JSON only.`;

interface LLMResult {
  humanScore: number;
  verdict: "human" | "ai" | "uncertain";
  confidence: "low" | "medium" | "high";
  evidence: string[];
}

export async function aiTextLlmSignal(resumeText: string): Promise<SignalResult> {
  if (!activeProvider()) {
    return {
      id: "ai-text",
      label: "AI 文本特征（LLM）",
      dimension: "authenticity",
      weight: 20,
      score: 50,
      impact: "neutral",
      explanation: "未配置 LLM key，无法运行语义级 AI 检测。",
    };
  }

  const parsed = await callLLMJson<LLMResult>({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Evaluate this resume:\n\n${resumeText.slice(0, 20_000)}` },
    ],
    schema: SCHEMA,
    schemaName: "ai_text_detection",
    maxTokens: 400,
  });

  if (!parsed) {
    return {
      id: "ai-text",
      label: "AI 文本特征（LLM）",
      dimension: "authenticity",
      weight: 20,
      score: 50,
      impact: "neutral",
      explanation: "LLM 调用失败，回退到中性分（参见日志）。",
    };
  }

  const score = Math.max(0, Math.min(100, Math.round(parsed.humanScore)));
  const verdictZh = parsed.verdict === "ai" ? "判定为 AI 生成" : parsed.verdict === "human" ? "判定为真人撰写" : "无法判定";
  const confZh = parsed.confidence === "high" ? "高置信" : parsed.confidence === "medium" ? "中置信" : "低置信";
  const ev = parsed.evidence.slice(0, 3).join("；");

  return {
    id: "ai-text",
    label: "AI 文本特征（LLM）",
    dimension: "authenticity",
    weight: 20,
    score,
    impact: score >= 70 ? "positive" : score < 40 ? "negative" : "neutral",
    explanation: `${verdictZh}（${confZh}）。${ev}。`,
  };
}

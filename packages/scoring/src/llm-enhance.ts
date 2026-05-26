import { z } from "zod";
import type {
  LLMEnhancement,
  ScoreRequest,
  ScoreResult,
} from "@resumetruth/shared";
import { activeModel, activeProvider, callLLMJson } from "./llm-client";

const EnhancementSchema = z.object({
  enhancedSummary: z.string(),
  riskAssessment: z.string(),
  interviewQuestions: z.array(z.string()).length(3),
});

const ENHANCEMENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["enhancedSummary", "riskAssessment", "interviewQuestions"],
  properties: {
    enhancedSummary: {
      type: "string",
      description: "2–3 句中文综合评价",
    },
    riskAssessment: {
      type: "string",
      description: "1–2 句中文风险提示",
    },
    interviewQuestions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
      description: "3 个基于简历内容设计的中文深度面试问题",
    },
  },
};

const SYSTEM_PROMPT = `你是 ResumeTruth 的资深招聘顾问 AI，专门帮助 HR 在 AI 简历泛滥的时代识别值得面试的候选人。

你会收到：
1. 一份候选人简历的纯文本
2. 一份规则引擎产出的三维分数（真实度 / 可验证度 / 推荐面试度）
3. 每项分数对应的信号解释
4. 可选：岗位描述

你的任务：基于上述输入，输出三件事——
1. enhancedSummary：综合评价，明确为什么值得 / 不值得面试（比规则版更有洞察）
2. riskAssessment：HR 面试前应核实的风险点
3. interviewQuestions：3 个具体的、能直接验证简历声明的深度面试问题（不要空泛"你的优势"类问题）

写作风格：
- 全部中文
- 直接、具体、可执行
- 不要重复规则引擎已经给出的解释
- 面试问题要针对简历中具体的项目 / 数字 / 技术栈
- 永远不要建议直接拒绝候选人——只指出风险，决策权在 HR

输出严格按 JSON schema。`;

export function isEnhancementAvailable(): boolean {
  return activeProvider() !== null;
}

function buildUserMessage(req: ScoreRequest, result: ScoreResult): string {
  const lines: string[] = [];
  lines.push(`# 候选人简历`);
  if (req.candidateName) lines.push(`姓名：${req.candidateName}`);
  lines.push("");
  lines.push("```");
  lines.push(req.resumeText.slice(0, 20_000));
  lines.push("```");
  lines.push("");

  if (req.jobDescription && req.jobDescription.trim().length > 20) {
    lines.push(`# 岗位描述`);
    lines.push(req.jobDescription.slice(0, 5_000));
    lines.push("");
  }

  lines.push(`# 规则引擎三维分数`);
  lines.push(`- 真实度：${result.authenticity}`);
  lines.push(`- 可验证度：${result.verifiability}`);
  lines.push(`- 推荐面试度：${result.interview}`);
  lines.push(`- 规则版小结：${result.summary}`);
  lines.push("");
  lines.push(`# 信号详情`);
  for (const s of result.signals) {
    lines.push(`- [${s.label} · ${s.score}/100] ${s.explanation}`);
  }

  return lines.join("\n");
}

export async function enhanceWithLLM(
  req: ScoreRequest,
  result: ScoreResult,
): Promise<LLMEnhancement | null> {
  if (!isEnhancementAvailable()) return null;

  const parsed = await callLLMJson<unknown>({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(req, result) },
    ],
    schema: ENHANCEMENT_JSON_SCHEMA,
    schemaName: "candidate_enhancement",
    maxTokens: 1500,
  });

  if (!parsed) return null;

  const safe = EnhancementSchema.safeParse(parsed);
  if (!safe.success) {
    console.warn("[llm-enhance] schema mismatch:", safe.error.message);
    return null;
  }

  return {
    enhancedSummary: safe.data.enhancedSummary,
    riskAssessment: safe.data.riskAssessment,
    interviewQuestions: safe.data.interviewQuestions,
    model: activeModel(),
    generatedAt: new Date().toISOString(),
  };
}

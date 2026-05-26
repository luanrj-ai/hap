import type { ExpertPanelVerdict, ScoreResult, SignalResult } from "@resumetruth/shared";
import { activeModel, activeProvider, callLLMJson } from "./llm-client";

/**
 * Expert-panel triple-agent verdict for borderline cases.
 *
 * Triggered only when at least one signal is in an ambiguous band:
 *   - ai-text in [40, 65]            (not clearly AI / not clearly real)
 *   - jd-match in [50, 75]           (not clearly fit / not clearly miss)
 *   - signal disagreement: positive-rare-depth ≥ 70 but ai-text < 60 (deep but suspicious)
 *
 * Three LLM calls (Devil's Advocate, Champion run in parallel; Judge waits):
 *   1. Devil — argue against the candidate
 *   2. Champion — argue for the candidate
 *   3. Judge — sees both arguments + the resume, makes final call with confidence
 *
 * The Judge can OVERRIDE ai-text and/or jd-match scores when confidence=high.
 * On low confidence, no override (panel adds context only).
 */

const ARGS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["arguments"],
  properties: {
    arguments: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5,
      description: "Up to 5 concise arguments. Each argument is one short sentence in Chinese.",
    },
  },
};

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["judgeVerdict", "confidence", "aiTextOverride", "jdMatchOverride", "rationale"],
  properties: {
    judgeVerdict: {
      type: "string",
      enum: [
        "candidate is real and fits",
        "candidate is real but poor fit",
        "candidate is AI or unreliable",
        "uncertain",
      ],
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    aiTextOverride: {
      type: ["integer", "null"],
      description: "If judge wants to override ai-text score (0-100, where 100=clearly human). Null = no override.",
    },
    jdMatchOverride: {
      type: ["integer", "null"],
      description: "If judge wants to override jd-match score (0-100). Null = no override.",
    },
    rationale: {
      type: "string",
      description: "1-2 sentences in Chinese explaining the verdict.",
    },
  },
};

const DEVIL_SYSTEM = `你是招聘专家组的"反方辩手"。你的任务：找出这份简历有问题或不合适的最强证据。

举例视角：
- 是否含 AI 模板腔（'results-driven', 'spearheaded', 'pioneering' 等）
- 项目描述是否含具体数字、技术细节、可验证证据
- 时间线是否合理（intern → VP 18 个月这种）
- 与 JD 的硬性要求差距
- 是否存在自相矛盾或夸大

输出 1-5 条最强反方证据。每条一句话，中文。如果实在没什么可挑的，输出"无明显问题"也可以——不要硬找。`;

const CHAMPION_SYSTEM = `你是招聘专家组的"正方辩手"。你的任务：找出这份简历值得面试的最强证据。

举例视角：
- 真实可验证的项目细节（数字、规模、外部链接、OSS 仓库、演讲）
- 与 JD 核心要求的精准匹配
- 罕见技术深度信号（命名算法、RFC、内部 RFC、性能数据）
- 实际影响（金额规模、用户规模、团队规模）
- 跨领域罕见组合

输出 1-5 条最强正方证据。每条一句话，中文。`;

const JUDGE_SYSTEM = `你是招聘专家组的"主判官"，比反方辩手和正方辩手更高一级。你看完两边的论据和原始简历，做最终判定。

你的输出包含：
1. judgeVerdict：选一个——
   - "candidate is real and fits"：真人+匹配岗位
   - "candidate is real but poor fit"：真人但不匹配岗位
   - "candidate is AI or unreliable"：AI 写的 / 信息不可信
   - "uncertain"：证据不足判定

2. confidence：你对自己判断的置信度（low/medium/high）
   - high：证据强压倒一边
   - medium：能判但不绝对
   - low：两边都有道理或证据不足——这种情况**不要 override 原分数**

3. aiTextOverride / jdMatchOverride（仅 confidence=high 时使用）：
   - 如果你认为 ai-text 分数明显错了，给出修正分数（0-100，100=完全真人）
   - 如果你认为 jd-match 分数明显错了，给出修正分数
   - 不需要 override 时填 null

4. rationale：1-2 句解释，中文`;

interface ArgsResult { arguments: string[] }
interface JudgeResult {
  judgeVerdict: ExpertPanelVerdict["judgeVerdict"];
  confidence: "low" | "medium" | "high";
  aiTextOverride: number | null;
  jdMatchOverride: number | null;
  rationale: string;
}

function buildBaseContext(resumeText: string, jobDescription: string | undefined, signals: SignalResult[]): string {
  const lines: string[] = [];
  if (jobDescription) {
    lines.push("# Job Description");
    lines.push(jobDescription.slice(0, 3000));
    lines.push("");
  }
  lines.push("# Candidate Resume");
  lines.push("```");
  lines.push(resumeText.slice(0, 15_000));
  lines.push("```");
  lines.push("");
  lines.push("# Current signal scores");
  for (const s of signals) {
    lines.push(`- ${s.label} (${s.dimension}): ${s.score}/100 — ${s.explanation}`);
  }
  return lines.join("\n");
}

export function shouldTriggerPanel(signals: SignalResult[]): { trigger: boolean; reason: string } {
  const aiText = signals.find((s) => s.id === "ai-text")?.score ?? 100;
  const jdMatch = signals.find((s) => s.id === "jd-match")?.score ?? 50;
  const depth = signals.find((s) => s.id === "positive-rare-depth")?.score ?? 50;
  if (aiText >= 40 && aiText <= 65) return { trigger: true, reason: `ai-text 在模糊区间 (${aiText})` };
  if (jdMatch >= 50 && jdMatch <= 75) return { trigger: true, reason: `jd-match 在模糊区间 (${jdMatch})` };
  if (depth >= 70 && aiText < 60) return { trigger: true, reason: `深度高 (${depth}) 但 ai-text 偏低 (${aiText})` };
  return { trigger: false, reason: "" };
}

export async function runExpertPanel(
  resumeText: string,
  jobDescription: string | undefined,
  signals: SignalResult[],
  triggerReason: string,
): Promise<ExpertPanelVerdict | null> {
  if (!activeProvider()) return null;

  const context = buildBaseContext(resumeText, jobDescription, signals);

  // 1. Devil + Champion in parallel
  const [devilRes, champRes] = await Promise.all([
    callLLMJson<ArgsResult>({
      messages: [
        { role: "system", content: DEVIL_SYSTEM },
        { role: "user", content: context },
      ],
      schema: ARGS_SCHEMA,
      schemaName: "devil_arguments",
      maxTokens: 500,
    }),
    callLLMJson<ArgsResult>({
      messages: [
        { role: "system", content: CHAMPION_SYSTEM },
        { role: "user", content: context },
      ],
      schema: ARGS_SCHEMA,
      schemaName: "champion_arguments",
      maxTokens: 500,
    }),
  ]);

  if (!devilRes || !champRes) return null;

  // 2. Judge with both sides
  const judgeUserMsg = [
    context,
    "",
    "# 反方辩手论据",
    ...devilRes.arguments.map((a, i) => `${i + 1}. ${a}`),
    "",
    "# 正方辩手论据",
    ...champRes.arguments.map((a, i) => `${i + 1}. ${a}`),
    "",
    "请综合两侧论据 + 简历内容，输出最终判定。",
  ].join("\n");

  const judgeRes = await callLLMJson<JudgeResult>({
    messages: [
      { role: "system", content: JUDGE_SYSTEM },
      { role: "user", content: judgeUserMsg },
    ],
    schema: JUDGE_SCHEMA,
    schemaName: "judge_verdict",
    maxTokens: 500,
  });

  if (!judgeRes) return null;

  return {
    triggered: true,
    reason: triggerReason,
    devilArgs: devilRes.arguments,
    championArgs: champRes.arguments,
    judgeVerdict: judgeRes.judgeVerdict,
    confidence: judgeRes.confidence,
    aiTextOverride: judgeRes.confidence === "high" ? judgeRes.aiTextOverride ?? undefined : undefined,
    jdMatchOverride: judgeRes.confidence === "high" ? judgeRes.jdMatchOverride ?? undefined : undefined,
    rationale: judgeRes.rationale,
    generatedAt: new Date().toISOString(),
    model: activeModel(),
  };
}

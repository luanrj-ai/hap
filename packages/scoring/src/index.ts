import type {
  ExpertPanelVerdict,
  ScoreDimension,
  ScoreRequest,
  ScoreResult,
  SignalResult,
} from "@resumetruth/shared";
import { aiTextSignal } from "./signals/ai-text";
import { aiTextLlmSignal } from "./signals/ai-text-llm";
import { templateSignal } from "./signals/template";
import { timelineSignal } from "./signals/timeline";
import { externalEvidenceSignal, externalEvidenceVerified } from "./signals/external-evidence";
import { positiveGithubSignal } from "./signals/positive-github";
import { positiveRareDepthSignal } from "./signals/positive-rare-depth";
import { positiveRareDepthLlmSignal } from "./signals/positive-rare-depth-llm";
import { jdMatchSignal } from "./signals/jd-match";
import { jdMatchLLMSignal } from "./signals/jd-match-llm";
import { enhanceWithLLM, isEnhancementAvailable } from "./llm-enhance";
import { activeProvider } from "./llm-client";
import { getWeight, getTuningConfig } from "./config";
import { extractSkills } from "./skills-extract";
import { runExpertPanel, shouldTriggerPanel } from "./expert-panel";

export { isEnhancementAvailable, enhanceWithLLM, getTuningConfig };

/**
 * Async path. LLM signals (ai-text, jd-match) auto-enable when an LLM key is
 * available unless explicitly disabled via `useLlmAiText: false` /
 * `useLlmJdMatch: false`. LLM calls run in parallel.
 */
let _warnedNoLLM = false;
function maybeWarnNoLLM(): void {
  if (_warnedNoLLM) return;
  _warnedNoLLM = true;
  console.warn(
    "\n[ResumeTruth] ⚠ No LLM key configured (OPENAI_API_KEY or ANTHROPIC_API_KEY).\n" +
    "  Production scoring is significantly degraded without LLM signals:\n" +
    "  - ai-text rule F1 ≈ 0.18 vs LLM F1 ≈ 0.86\n" +
    "  - jd-match bag-of-words ≈ 67% accuracy vs LLM ≈ 73% on real resumes\n" +
    "  Set up a key in apps/web/.env before running in production.\n",
  );
}

export async function scoreResumeAsync(req: ScoreRequest): Promise<ScoreResult> {
  const { resumeText, candidateName, jobDescription, githubUrl, personalSiteUrl, linkedinUrl, verify } = req;
  const hasLlm = activeProvider() !== null;
  if (!hasLlm) maybeWarnNoLLM();

  // LLM signals: ON by default when key available. Override via req.useLlmXxx=false
  // (used only by the eval baseline). Rules are the EVAL BASELINE, not a silent
  // production fallback — without LLM the product is significantly degraded.
  const useLlmAi = req.useLlmAiText ?? hasLlm;
  const useLlmJd = req.useLlmJdMatch ?? hasLlm;
  const useLlmDepth = req.useLlmRareDepth ?? hasLlm;

  const evidenceCtx = { resumeText, githubUrl, personalSiteUrl, linkedinUrl };
  const [llmAi, llmJd, llmDepth, verified, posGithub, skills] = await Promise.all([
    useLlmAi ? aiTextLlmSignal(resumeText) : Promise.resolve(null),
    useLlmJd ? jdMatchLLMSignal(resumeText, jobDescription) : Promise.resolve(null),
    useLlmDepth ? positiveRareDepthLlmSignal(resumeText) : Promise.resolve(null),
    verify ? externalEvidenceVerified(evidenceCtx) : Promise.resolve(null),
    verify ? positiveGithubSignal(resumeText) : Promise.resolve(null),
    hasLlm ? extractSkills(resumeText) : Promise.resolve(null),
  ]);

  let signals: SignalResult[] = [
    llmAi ?? aiTextSignal(resumeText),
    templateSignal(resumeText),
    timelineSignal(resumeText),
    verified ? verified.signal : externalEvidenceSignal(evidenceCtx),
    ...(posGithub ? [posGithub] : []),
    llmJd ?? jdMatchSignal(resumeText, jobDescription),
    llmDepth ?? positiveRareDepthSignal(resumeText),
  ].map((s) => ({ ...s, weight: getWeight(s.id) }));

  // ====== Expert panel for borderline cases ======
  let expertPanel: ExpertPanelVerdict | null = null;
  if (hasLlm) {
    const decision = shouldTriggerPanel(signals);
    if (decision.trigger) {
      expertPanel = await runExpertPanel(resumeText, jobDescription, signals, decision.reason);
      if (expertPanel && expertPanel.confidence === "high") {
        // High-confidence judge can override ai-text or jd-match
        signals = signals.map((s) => {
          if (s.id === "ai-text" && expertPanel!.aiTextOverride !== undefined && expertPanel!.aiTextOverride !== null) {
            return { ...s, score: expertPanel!.aiTextOverride, explanation: `[Panel] ${expertPanel!.rationale}` };
          }
          if (s.id === "jd-match" && expertPanel!.jdMatchOverride !== undefined && expertPanel!.jdMatchOverride !== null) {
            return { ...s, score: expertPanel!.jdMatchOverride, explanation: `[Panel] ${expertPanel!.rationale}` };
          }
          return s;
        });
      }
    }
  }

  const result = aggregate(signals, candidateName);
  if (verified) result.verification = verified.detail;
  if (skills) result.extractedSkills = skills;
  if (expertPanel) result.expertPanel = expertPanel;
  return result;
}

export async function scoreResumeWithEnhancement(
  req: ScoreRequest,
): Promise<ScoreResult> {
  const base = await scoreResumeAsync(req);
  if (!req.enhance || !isEnhancementAvailable()) return base;
  const enhancement = await enhanceWithLLM(req, base);
  return enhancement ? { ...base, enhancement } : base;
}

export function scoreResume(req: ScoreRequest): ScoreResult {
  const { resumeText, candidateName, jobDescription, githubUrl, personalSiteUrl, linkedinUrl } = req;

  const signals: SignalResult[] = [
    aiTextSignal(resumeText),
    templateSignal(resumeText),
    timelineSignal(resumeText),
    externalEvidenceSignal({ resumeText, githubUrl, personalSiteUrl, linkedinUrl }),
    jdMatchSignal(resumeText, jobDescription),
  ].map((s) => ({ ...s, weight: getWeight(s.id) }));

  return aggregate(signals, candidateName);
}

function aggregate(signals: SignalResult[], candidateName?: string): ScoreResult {
  const dims: ScoreDimension[] = ["authenticity", "verifiability", "interview"];
  const dimScores: Record<ScoreDimension, number> = {
    authenticity: 0,
    verifiability: 0,
    interview: 0,
  };

  for (const dim of dims) {
    const dimSignals = signals.filter((s) => s.dimension === dim);
    if (dimSignals.length === 0) {
      dimScores[dim] = 50;
      continue;
    }
    const totalWeight = dimSignals.reduce((sum, s) => sum + s.weight, 0);
    const weighted = dimSignals.reduce((sum, s) => sum + s.score * s.weight, 0);
    dimScores[dim] = Math.round(weighted / totalWeight);
  }

  const summary = buildSummary(dimScores, signals);

  return {
    authenticity: dimScores.authenticity,
    verifiability: dimScores.verifiability,
    interview: dimScores.interview,
    signals,
    summary,
    candidateName,
    scoredAt: new Date().toISOString(),
  };
}

function buildSummary(
  dims: Record<ScoreDimension, number>,
  signals: SignalResult[],
): string {
  const lowestSignal = [...signals].sort((a, b) => a.score - b.score)[0];
  const highestSignal = [...signals].sort((a, b) => b.score - a.score)[0];

  const verdict =
    dims.authenticity < 50
      ? "⚠️ 真实度偏低，建议进一步核验后再面试"
      : dims.interview >= 65 && dims.verifiability >= 55
      ? "✅ 推荐优先面试"
      : dims.interview >= 50
      ? "🔍 可纳入候选池，二轮再判断"
      : "🟡 匹配度有限，仅在岗位人选稀缺时考虑";

  return `${verdict}。最强信号：${highestSignal.label}（${highestSignal.score}）；最弱信号：${lowestSignal.label}（${lowestSignal.score}）。`;
}

export * from "./score-application";
export * from "./verifiers/evidence";

export * from "@resumetruth/shared";

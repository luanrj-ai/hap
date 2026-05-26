import type { SignalResult } from "@resumetruth/shared";

const AI_TEMPLATE_PHRASES = [
  "passionate about leveraging",
  "results-driven professional",
  "spearheaded",
  "synergize",
  "leverage cutting-edge",
  "deliver impactful",
  "drive meaningful results",
  "results-oriented",
  "track record of success",
  "in today's fast-paced",
  "ever-evolving landscape",
  "robust solutions",
  "innovative solutions",
  "cross-functional collaboration",
  "demonstrated ability to",
  "proven track record",
  "extensive experience in",
  "actionable insights",
  "best-in-class",
  "stakeholder engagement",
];

const AI_VERB_STACKS = [
  "spearheaded",
  "leveraged",
  "orchestrated",
  "pioneered",
  "championed",
  "architected",
  "transformed",
  "revolutionized",
];

export function aiTextSignal(resumeText: string): SignalResult {
  const lower = resumeText.toLowerCase();
  const phraseHits = AI_TEMPLATE_PHRASES.filter((p) => lower.includes(p));
  const verbHits = AI_VERB_STACKS.filter((v) => {
    const matches = lower.match(new RegExp(`\\b${v}\\b`, "g"));
    return matches && matches.length >= 2;
  });

  const phraseScore = Math.min(phraseHits.length, 8) / 8;
  const verbScore = Math.min(verbHits.length, 4) / 4;
  const aiProbability = phraseScore * 0.6 + verbScore * 0.4;

  const score = Math.round((1 - aiProbability) * 100);

  let explanation: string;
  if (phraseHits.length === 0 && verbHits.length === 0) {
    explanation = "未检测到典型 AI 简历模板用语，写作风格更接近人类。";
  } else {
    const examples = [...phraseHits.slice(0, 3), ...verbHits.slice(0, 2)];
    explanation = `检测到 ${phraseHits.length} 处 AI 模板措辞${
      verbHits.length ? `、${verbHits.length} 处堆叠强动词` : ""
    }（例：${examples.join("、")}）。`;
  }

  return {
    id: "ai-text",
    label: "AI 文本特征",
    dimension: "authenticity",
    weight: 20,
    score,
    impact: aiProbability > 0.4 ? "negative" : "positive",
    explanation,
  };
}

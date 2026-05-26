import type { SignalResult } from "@resumetruth/shared";

export function templateSignal(resumeText: string): SignalResult {
  const lines = resumeText.split("\n").filter((l) => l.trim().length > 0);
  const bullets = lines.filter((l) => /^\s*[•·▪\-*]/.test(l));

  let score = 100;
  const reasons: string[] = [];

  if (bullets.length > 5) {
    const lengths = bullets.map((b) => b.length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((sum, len) => sum + (len - avg) ** 2, 0) / lengths.length;
    const stddev = Math.sqrt(variance);
    const coefVar = stddev / avg;

    if (coefVar < 0.18) {
      score -= 35;
      reasons.push(`要点长度高度一致（变异系数 ${(coefVar * 100).toFixed(0)}%），疑似模板`);
    } else if (coefVar < 0.28) {
      score -= 15;
      reasons.push("要点长度较为整齐");
    }
  }

  const hasMetric = /\d+%|\$\d|\d+x|\d+ ?(人|users|customers|million|million|k\b)/i.test(
    resumeText,
  );
  if (!hasMetric && resumeText.length > 400) {
    score -= 20;
    reasons.push("整篇缺少具体数字（百分比、金额、规模），罕见于真实工作总结");
  }

  const pronouns = (resumeText.match(/\b(I|my|me)\b/g) || []).length;
  const sentences = (resumeText.match(/[.!?。！？]/g) || []).length || 1;
  if (pronouns / sentences > 0.6) {
    score -= 10;
    reasons.push("人称代词密度异常（AI 简历常见特征）");
  }

  score = Math.max(0, Math.min(100, score));

  return {
    id: "template-uniformity",
    label: "模板化程度",
    dimension: "authenticity",
    weight: 10,
    score,
    impact: score >= 70 ? "positive" : "negative",
    explanation:
      reasons.length === 0
        ? "结构和细节呈现自然，未发现明显模板化特征。"
        : reasons.join("；") + "。",
  };
}

import type { SignalResult } from "@resumetruth/shared";

const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","of","to","in","on","for","with",
  "at","by","from","is","are","was","were","be","been","being","have","has",
  "had","do","does","did","will","would","should","can","could","may","might",
  "i","you","we","they","he","she","it","this","that","these","those","as",
  "我","你","他","她","它","我们","你们","他们","和","与","或","的","了","在",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9一-龥+\.#\-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !STOPWORDS.has(t)),
  );
}

export function jdMatchSignal(resumeText: string, jobDescription?: string): SignalResult {
  if (!jobDescription || jobDescription.trim().length < 20) {
    return {
      id: "jd-match",
      label: "岗位匹配度",
      dimension: "interview",
      weight: 30,
      score: 50,
      impact: "neutral",
      explanation: "未提供 Job Description，跳过岗位匹配度评估。",
    };
  }

  const jdTokens = tokenize(jobDescription);
  const resumeTokens = tokenize(resumeText);

  let overlap = 0;
  const matchedExamples: string[] = [];
  for (const token of jdTokens) {
    if (resumeTokens.has(token)) {
      overlap++;
      if (matchedExamples.length < 6 && token.length >= 3) {
        matchedExamples.push(token);
      }
    }
  }

  const recall = jdTokens.size > 0 ? overlap / jdTokens.size : 0;
  const score = Math.round(Math.min(1, recall * 1.5) * 100);

  return {
    id: "jd-match",
    label: "岗位匹配度",
    dimension: "interview",
    weight: 30,
    score,
    impact: score >= 65 ? "positive" : score < 35 ? "negative" : "neutral",
    explanation:
      score >= 65
        ? `与岗位描述强匹配（${overlap}/${jdTokens.size} 关键词命中，例：${matchedExamples.join("、")}）。`
        : score >= 35
        ? `与岗位描述部分匹配（${overlap}/${jdTokens.size} 关键词），可考虑面试细聊。`
        : `与岗位描述匹配度低（仅 ${overlap}/${jdTokens.size} 关键词命中）。`,
  };
}

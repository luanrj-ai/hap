import type { SignalResult } from "@resumetruth/shared";

interface JobSpan {
  start: number;
  end: number;
  raw: string;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDate(token: string): number | null {
  const trimmed = token.trim().toLowerCase();
  if (/^(present|now|current|至今|现在)$/.test(trimmed)) {
    return Date.now();
  }
  const yearOnly = trimmed.match(/^(19|20)\d{2}$/);
  if (yearOnly) return new Date(Number(trimmed), 0, 1).getTime();

  const monYear = trimmed.match(/^([a-z]{3})\.?\s+(19|20)\d{2}$/);
  if (monYear) {
    const m = MONTHS[monYear[1]];
    if (m !== undefined) return new Date(Number(trimmed.slice(-4)), m, 1).getTime();
  }
  return null;
}

function extractSpans(text: string): JobSpan[] {
  const spans: JobSpan[] = [];
  const lines = text.split("\n");
  const rangeRegex = /([A-Za-z]{3,9}\.?\s+\d{4}|\d{4})\s*[-–—~]\s*(present|now|current|至今|[A-Za-z]{3,9}\.?\s+\d{4}|\d{4})/i;

  for (const line of lines) {
    const m = line.match(rangeRegex);
    if (m) {
      const start = parseDate(m[1]);
      const end = parseDate(m[2]);
      if (start && end && end > start) {
        spans.push({ start, end, raw: m[0] });
      }
    }
  }
  return spans;
}

export function timelineSignal(resumeText: string): SignalResult {
  const spans = extractSpans(resumeText);

  if (spans.length === 0) {
    return {
      id: "timeline",
      label: "时间线合理性",
      dimension: "authenticity",
      weight: 10,
      score: 60,
      impact: "neutral",
      explanation: "未能从简历中提取出明确的任职时间段，无法评估时间线一致性。",
    };
  }

  let overlapMonths = 0;
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const s = Math.max(spans[i].start, spans[j].start);
      const e = Math.min(spans[i].end, spans[j].end);
      if (e > s) {
        overlapMonths += (e - s) / (1000 * 60 * 60 * 24 * 30);
      }
    }
  }

  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let gapMonths = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].start - sorted[i - 1].end;
    if (gap > 0) gapMonths += gap / (1000 * 60 * 60 * 24 * 30);
  }

  let score = 100;
  const reasons: string[] = [];

  if (overlapMonths > 6) {
    score -= 35;
    reasons.push(`存在 ${overlapMonths.toFixed(0)} 个月的多职位重叠（可能是真实兼职，也可能是伪造）`);
  } else if (overlapMonths > 2) {
    score -= 10;
    reasons.push(`存在 ${overlapMonths.toFixed(0)} 个月的轻微任职重叠`);
  } else {
    reasons.push(`识别到 ${spans.length} 段任职经历，时间线无重叠`);
  }

  if (gapMonths > 24) {
    score -= 5;
    reasons.push(`累计 ${gapMonths.toFixed(0)} 个月空窗（中性信号，可能有合理解释）`);
  }

  score = Math.max(0, Math.min(100, score));

  return {
    id: "timeline",
    label: "时间线合理性",
    dimension: "authenticity",
    weight: 10,
    score,
    impact: score >= 75 ? "positive" : score < 50 ? "negative" : "neutral",
    explanation: reasons.join("；") + "。",
  };
}

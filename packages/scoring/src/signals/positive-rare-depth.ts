import type { SignalResult } from "@resumetruth/shared";

/**
 * Positive signal: hard-to-fake technical depth markers.
 *
 * Looks for concrete, verifiable, domain-specific things that AI-generated
 * resumes rarely include accurately:
 *   - Named algorithms / protocols (Raft, Paxos, CRDT, Operational Transforms…)
 *   - RFC numbers
 *   - Conference talks (GopherCon, KubeCon, QCon, ICML, etc.) with titles
 *   - Open-source maintenance with star counts (e.g., "1.2k stars")
 *   - Specific PRs / commits
 *   - Specific performance numbers (p99, RPS, $-amounts)
 */

const ALGORITHM_MARKERS = [
  "raft", "paxos", "zookeeper", "etcd",
  "crdt", "operational transform", "lamport", "vector clock",
  "lsm tree", "b-tree", "bloom filter", "merkle",
  "idempotency", "idempotent", "two-phase commit", "saga",
  "exactly-once", "at-least-once", "kafka exactly-once",
  "consistent hashing", "circuit breaker", "back-pressure",
  "operational transforms",
];

const RFC_REGEX = /\bRFC\s?\d{3,5}\b/gi;
const CONFERENCE_REGEX =
  /\b(?:GopherCon|KubeCon|QCon|ICML|NeurIPS|StrangeLoop|RailsConf|ReactConf|JSConf|CppCon|RustConf|RustNation|PyCon|EuroPython|DjangoCon|GoLondonUM|DockerCon|SREcon|Velocity|Mesoscale|RICON|EuroSys|SOSP|OSDI|NSDI|HotOS|RustFest|ScaleConf|InfoQ DevSummit|BlackHat|DEFCON)\b/i;
const STARS_REGEX = /\b(\d{1,3}(?:,\d{3})*|\d+\.?\d*\s?k)\s+stars?\b/gi;
const PR_OR_COMMIT_REGEX = /\b(?:PR\s?#\d+|pull\/\d+|commit\s+[0-9a-f]{7,40}\b)/gi;
const PERF_NUMBER_REGEX =
  /\b(?:p\d{2,3}|p99|p95|p50)\s*(?:from)?\s*\d+(?:\.\d+)?\s?(?:ms|us|μs|ns|s|RPS|QPS|TPS|req\/s|requests?\/sec)/gi;
const DOLLAR_AMOUNT_REGEX = /\$\s?\d+(?:\.\d+)?\s?[MmBbKk]?(?:\s|\b)/g;

interface Marker { name: string; count: number }

export function positiveRareDepthSignal(resumeText: string): SignalResult {
  const lower = resumeText.toLowerCase();
  const markers: Marker[] = [];

  const algos = ALGORITHM_MARKERS.filter((a) => lower.includes(a));
  if (algos.length) markers.push({ name: `命名算法 / 协议（${algos.slice(0, 3).join("、")}）`, count: algos.length });

  const rfcs = resumeText.match(RFC_REGEX) ?? [];
  if (rfcs.length) markers.push({ name: `RFC 引用（${rfcs.slice(0, 2).join("、")}）`, count: rfcs.length });

  const confMatch = resumeText.match(CONFERENCE_REGEX);
  if (confMatch) markers.push({ name: `${confMatch[0]} 演讲`, count: 1 });

  const stars = resumeText.match(STARS_REGEX) ?? [];
  if (stars.length) markers.push({ name: `开源项目 stars（${stars[0]}）`, count: stars.length });

  const prs = resumeText.match(PR_OR_COMMIT_REGEX) ?? [];
  if (prs.length) markers.push({ name: `具体 PR / commit 引用`, count: prs.length });

  const perfs = resumeText.match(PERF_NUMBER_REGEX) ?? [];
  if (perfs.length) markers.push({ name: `量化性能数字（${perfs[0]}）`, count: perfs.length });

  const dollars = resumeText.match(DOLLAR_AMOUNT_REGEX) ?? [];
  if (dollars.length >= 2) markers.push({ name: `多处金额规模（${dollars[0].trim()}）`, count: dollars.length });

  const markerTypes = markers.length; // how many DIFFERENT types of depth markers
  const totalHits = markers.reduce((sum, m) => sum + m.count, 0);

  let score: number;
  if (markerTypes >= 4) score = 90;
  else if (markerTypes === 3) score = 75;
  else if (markerTypes === 2) score = 60;
  else if (markerTypes === 1) score = 50;
  else score = 35;

  const explanation =
    markerTypes === 0
      ? "未发现技术深度标记（命名算法、RFC、演讲、开源 stars 等）。"
      : `${markerTypes} 类深度标记 / ${totalHits} 处具体证据：${markers.map((m) => m.name).join("；")}。`;

  return {
    id: "positive-rare-depth",
    label: "技术深度（罕见 AI 伪造）",
    dimension: "interview",
    weight: 15,
    score,
    impact: score >= 70 ? "positive" : score < 50 ? "negative" : "neutral",
    explanation,
  };
}

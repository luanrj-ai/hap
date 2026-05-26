/**
 * Multi-JD eval runner.
 *
 * For each (fixture × JD) pair, runs two scoring passes:
 *   - Baseline: pure rule engine
 *   - LLM-enhanced: rule engine + LLM ai-text + LLM jd-match
 *
 * Outputs:
 *   - Per-JD jd-match bucket accuracy (BoW vs LLM)
 *   - Per-tier ai-text F1 (naive / coached / adversarial)
 *   - eval-results.json  (machine-readable)
 *   - eval-report.html   (publishable)
 *
 *   cd apps/web && npx tsx eval/run.ts
 *   cd apps/web && npx tsx eval/run.ts --concurrency=5  # tune parallelism
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  scoreResume,
  scoreResumeAsync,
} from "@resumetruth/scoring";
import { activeProvider, activeModel } from "@resumetruth/scoring/llm-client";
import {
  ALL_JOBS,
  JOBS,
  REAL_FIXTURES,
  type EvalResume,
  type FitBand,
  type JobKey,
} from "./fixtures";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AI_DIR = resolve(__dirname, "data/ai");

const CONCURRENCY = Number(
  process.argv.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? "4",
);

type AiTier = "naive" | "coached" | "adversarial";
type AiRole = "payments-backend" | "frontend" | "data-ml";
interface ManifestEntry {
  filename: string;
  tier: AiTier;
  role: AiRole;
}
interface Manifest {
  generatedAt: string;
  provider: string;
  model: string;
  entries: ManifestEntry[];
}

const ROLE_TO_JOB: Record<AiRole, JobKey> = {
  "payments-backend": "paymentsBackend",
  frontend: "seniorFrontend",
  "data-ml": "dataEngineer",
};

/** AI fixtures get HIGH on the JD they claim, LOW elsewhere — this tests
 *  whether jd-match LLM still rates them based on content (it should give
 *  high scores for the claimed role); ai-text LLM is what flags them as AI. */
function aiFitFor(role: AiRole): Record<JobKey, FitBand> {
  const claimed = ROLE_TO_JOB[role];
  const fit: Record<JobKey, FitBand> = {
    paymentsBackend: "LOW",
    seniorFrontend: "LOW",
    dataEngineer: "LOW",
  };
  fit[claimed] = "HIGH";
  // Cross-domain transferability (backend payments ↔ data ML)
  if (role === "payments-backend") fit.dataEngineer = "MED";
  if (role === "data-ml") fit.paymentsBackend = "MED";
  return fit;
}

function loadAiFixtures(): EvalResume[] {
  const manifestPath = resolve(AI_DIR, "manifest.json");
  const manifest: Manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return manifest.entries.map((e) => ({
    id: e.filename.replace(/\.txt$/, ""),
    source: "ai" as const,
    aiTier: e.tier,
    expectedFit: aiFitFor(e.role),
    expectedIsAi: true,
    resumeText: readFileSync(resolve(AI_DIR, e.filename), "utf8"),
  }));
}

function bucketize(score: number): FitBand {
  if (score >= 71) return "HIGH";
  if (score >= 40) return "MED";
  return "LOW";
}

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T, idx: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const total = items.length;
  async function run(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
      done++;
      if (done % 5 === 0 || done === total) {
        process.stdout.write(`\r  progress: ${done}/${total}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => run()));
  process.stdout.write("\n");
  return results;
}

interface Cell {
  fxId: string;
  source: "real" | "ai";
  aiTier?: AiTier;
  jobKey: JobKey;
  expectedFit: FitBand;
  baseJdScore: number;
  llmJdScore: number;
  ruleAiText: number;
  llmAiText: number;
  baseInterview: number;
  llmInterview: number;
  baseAuth: number;
  llmAuth: number;
}

interface BucketStats {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

function f1(tp: number, fp: number, fn: number): number {
  const p = tp + fp === 0 ? 0 : tp / (tp + fp);
  const r = tp + fn === 0 ? 0 : tp / (tp + fn);
  return p + r === 0 ? 0 : (2 * p * r) / (p + r);
}

function pct(n: number, d: number): string {
  return d === 0 ? "  —" : `${((n / d) * 100).toFixed(0)}%`;
}

function pad(s: string | number, w: number, right = false): string {
  const str = String(s);
  if (str.length >= w) return str.slice(0, w);
  return right ? str.padStart(w) : str.padEnd(w);
}

async function main(): Promise<void> {
  if (!activeProvider()) {
    console.error("Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env first.");
    process.exit(1);
  }

  const aiFixtures = loadAiFixtures();
  const fixtures = [...REAL_FIXTURES, ...aiFixtures];

  console.log(`\n📊 ResumeTruth Eval — multi-JD`);
  console.log(`   provider:    ${activeProvider()} / ${activeModel()}`);
  console.log(`   real fixt:   ${REAL_FIXTURES.length}`);
  console.log(`   AI fixt:     ${aiFixtures.length} (${["naive", "coached", "adversarial"].map((t) => `${t}:${aiFixtures.filter((f) => f.aiTier === t).length}`).join(", ")})`);
  console.log(`   JDs:         ${ALL_JOBS.map((j) => j.label).join(" · ")}`);
  console.log(`   concurrency: ${CONCURRENCY}`);
  console.log(`   total LLM calls: ${fixtures.length * ALL_JOBS.length * 2} (2 signals × ${ALL_JOBS.length} JDs × ${fixtures.length} fixtures)\n`);

  const t0 = Date.now();
  type Task = { fx: EvalResume; jobKey: JobKey };
  const tasks: Task[] = [];
  for (const fx of fixtures) {
    for (const job of ALL_JOBS) {
      tasks.push({ fx, jobKey: job.key as JobKey });
    }
  }

  const cells: Cell[] = await runWithConcurrency(
    tasks,
    async (task) => {
      const job = JOBS[task.jobKey];
      const req = {
        resumeText: task.fx.resumeText,
        candidateName: task.fx.id,
        jobDescription: job.description,
      };
      const [baseline, enhanced] = await Promise.all([
        Promise.resolve(scoreResume(req)),
        scoreResumeAsync({ ...req, useLlmAiText: true, useLlmJdMatch: true }),
      ]);
      return {
        fxId: task.fx.id,
        source: task.fx.source,
        aiTier: task.fx.aiTier,
        jobKey: task.jobKey,
        expectedFit: task.fx.expectedFit[task.jobKey],
        baseJdScore: baseline.signals.find((s) => s.id === "jd-match")!.score,
        llmJdScore: enhanced.signals.find((s) => s.id === "jd-match")!.score,
        ruleAiText: baseline.signals.find((s) => s.id === "ai-text")!.score,
        llmAiText: enhanced.signals.find((s) => s.id === "ai-text")!.score,
        baseInterview: baseline.interview,
        llmInterview: enhanced.interview,
        baseAuth: baseline.authenticity,
        llmAuth: enhanced.authenticity,
      } as Cell;
    },
    CONCURRENCY,
  );
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  // ===== Per-JD jd-match bucket accuracy =====
  console.log(`\n${"─".repeat(72)}`);
  console.log(`📈 JD-match bucket accuracy (real fixtures only, n=${REAL_FIXTURES.length} × ${ALL_JOBS.length} JD = ${REAL_FIXTURES.length * ALL_JOBS.length} pairs)`);
  console.log(`${"─".repeat(72)}`);
  for (const job of ALL_JOBS) {
    const cellsForJob = cells.filter((c) => c.jobKey === job.key && c.source === "real");
    const bowOk = cellsForJob.filter((c) => bucketize(c.baseJdScore) === c.expectedFit).length;
    const llmOk = cellsForJob.filter((c) => bucketize(c.llmJdScore) === c.expectedFit).length;
    const total = cellsForJob.length;
    console.log(
      `  ${pad(job.label, 32)}  BoW ${pad(bowOk + "/" + total, 6)} ${pad(pct(bowOk, total), 4)}   LLM ${pad(llmOk + "/" + total, 6)} ${pad(pct(llmOk, total), 4)}   Δ ${pct(llmOk - bowOk, total)}`,
    );
  }
  const realCells = cells.filter((c) => c.source === "real");
  const totalBow = realCells.filter((c) => bucketize(c.baseJdScore) === c.expectedFit).length;
  const totalLlm = realCells.filter((c) => bucketize(c.llmJdScore) === c.expectedFit).length;
  console.log(
    `  ${pad("TOTAL", 32)}  BoW ${pad(totalBow + "/" + realCells.length, 6)} ${pad(pct(totalBow, realCells.length), 4)}   LLM ${pad(totalLlm + "/" + realCells.length, 6)} ${pad(pct(totalLlm, realCells.length), 4)}   Δ ${pct(totalLlm - totalBow, realCells.length)}`,
  );

  // ===== AI-text F1 per tier =====
  console.log(`\n${"─".repeat(72)}`);
  console.log(`🤖 AI-text detection (threshold: score < 60 ⇒ flagged as AI)`);
  console.log(`${"─".repeat(72)}`);
  // Dedupe — ai-text doesn't depend on JD, take first cell per fixture
  const seen = new Set<string>();
  const fxCells = cells.filter((c) => {
    if (seen.has(c.fxId)) return false;
    seen.add(c.fxId);
    return true;
  });
  const aiCells = fxCells.filter((c) => c.source === "ai");
  const realCellsAi = fxCells.filter((c) => c.source === "real");
  function statsFor(getScore: (c: Cell) => number, aiSubset: Cell[]): BucketStats {
    const tn = realCellsAi.filter((c) => getScore(c) >= 60).length;
    const fp = realCellsAi.length - tn;
    const tp = aiSubset.filter((c) => getScore(c) < 60).length;
    const fn = aiSubset.length - tp;
    return {
      tp, fp, tn, fn,
      precision: tp + fp === 0 ? 0 : tp / (tp + fp),
      recall: tp + fn === 0 ? 0 : tp / (tp + fn),
      f1: f1(tp, fp, fn),
    };
  }
  console.log(
    `  ${pad("Tier (n)", 26)}  ${pad("rule-prec", 10)}  ${pad("rule-rec", 10)}  ${pad("rule-F1", 8)}  ${pad("LLM-prec", 10)}  ${pad("LLM-rec", 10)}  ${pad("LLM-F1", 8)}`,
  );
  for (const tier of ["naive", "coached", "adversarial"] as AiTier[]) {
    const sub = aiCells.filter((c) => c.aiTier === tier);
    if (sub.length === 0) continue;
    const r = statsFor((c) => c.ruleAiText, sub);
    const l = statsFor((c) => c.llmAiText, sub);
    console.log(
      `  ${pad(`${tier} (n=${sub.length})`, 26)}  ${pad(r.precision.toFixed(2), 10)}  ${pad(r.recall.toFixed(2), 10)}  ${pad(r.f1.toFixed(2), 8)}  ${pad(l.precision.toFixed(2), 10)}  ${pad(l.recall.toFixed(2), 10)}  ${pad(l.f1.toFixed(2), 8)}`,
    );
  }
  const rAll = statsFor((c) => c.ruleAiText, aiCells);
  const lAll = statsFor((c) => c.llmAiText, aiCells);
  console.log(
    `  ${pad(`ALL (n=${aiCells.length})`, 26)}  ${pad(rAll.precision.toFixed(2), 10)}  ${pad(rAll.recall.toFixed(2), 10)}  ${pad(rAll.f1.toFixed(2), 8)}  ${pad(lAll.precision.toFixed(2), 10)}  ${pad(lAll.recall.toFixed(2), 10)}  ${pad(lAll.f1.toFixed(2), 8)}`,
  );

  // ===== Write machine-readable JSON =====
  const jsonPath = resolve(__dirname, "eval-results.json");
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        provider: activeProvider(),
        model: activeModel(),
        elapsedSec: Number(elapsed),
        realFixtures: REAL_FIXTURES.length,
        aiFixtures: aiCells.length,
        jobs: ALL_JOBS.map((j) => ({ key: j.key, label: j.label })),
        cells,
      },
      null,
      2,
    ),
  );
  console.log(`\n✓ Wrote ${jsonPath}`);
  console.log(`  ${cells.length} cells, ${elapsed}s total\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

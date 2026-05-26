/**
 * Quick comparison: rule-based positive-rare-depth vs LLM-based.
 * Runs both signals on the 60 real PDF fixtures, prints distribution + outliers.
 *
 *   cd apps/web && npx tsx eval/compare-depth.ts
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PDF_DIR = resolve(__dirname, "data/real-pdf-sampled");

import { positiveRareDepthSignal } from "../../../packages/scoring/src/signals/positive-rare-depth";
import { positiveRareDepthLlmSignal } from "../../../packages/scoring/src/signals/positive-rare-depth-llm";

async function main(): Promise<void> {

  const manifest = JSON.parse(readFileSync(resolve(PDF_DIR, "manifest.json"), "utf8")) as {
    entries: Array<{ fileId: string; bucket: string }>;
  };

  console.log(`\nComparing rule vs LLM on ${manifest.entries.length} real PDF fixtures...\n`);
  const t0 = Date.now();

  // Parallelize the LLM calls (concurrency 5 to avoid rate limit)
  const concurrency = 5;
  const results: Array<{ fileId: string; bucket: string; ruleScore: number; llmScore: number; ruleExpl: string; llmExpl: string }> = [];
  let cursor = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (cursor < manifest.entries.length) {
      const e = manifest.entries[cursor++];
      const text = readFileSync(resolve(PDF_DIR, `${e.fileId}.txt`), "utf8");
      const ruleSignal = positiveRareDepthSignal(text);
      const llmSignal = await positiveRareDepthLlmSignal(text);
      results.push({
        fileId: e.fileId,
        bucket: e.bucket,
        ruleScore: ruleSignal.score,
        llmScore: llmSignal.score,
        ruleExpl: ruleSignal.explanation,
        llmExpl: llmSignal.explanation,
      });
      done++;
      process.stdout.write(`\r  progress: ${done}/${manifest.entries.length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n  done in ${elapsed}s\n`);

  // Aggregate
  results.sort((a, b) => a.fileId.localeCompare(b.fileId));
  const ruleAvg = results.reduce((s, r) => s + r.ruleScore, 0) / results.length;
  const llmAvg = results.reduce((s, r) => s + r.llmScore, 0) / results.length;

  // Distribution: how many at each level
  function dist(getScore: (r: typeof results[0]) => number): string {
    const buckets = { "0-29": 0, "30-49": 0, "50-69": 0, "70-89": 0, "90-100": 0 };
    for (const r of results) {
      const s = getScore(r);
      if (s < 30) buckets["0-29"]++;
      else if (s < 50) buckets["30-49"]++;
      else if (s < 70) buckets["50-69"]++;
      else if (s < 90) buckets["70-89"]++;
      else buckets["90-100"]++;
    }
    return Object.entries(buckets).map(([k, v]) => `${k}:${v}`).join("  ");
  }

  console.log(`─── Aggregate ───`);
  console.log(`  rule avg score: ${ruleAvg.toFixed(1)}`);
  console.log(`  LLM avg score:  ${llmAvg.toFixed(1)}`);
  console.log(`  rule distribution: ${dist((r) => r.ruleScore)}`);
  console.log(`  LLM  distribution: ${dist((r) => r.llmScore)}`);

  // Per-bucket means
  console.log(`\n─── Per bucket (skill auto-bucket) ───`);
  for (const b of ["backend", "frontend", "data-ml"]) {
    const sub = results.filter((r) => r.bucket === b);
    if (sub.length === 0) continue;
    const ra = sub.reduce((s, r) => s + r.ruleScore, 0) / sub.length;
    const la = sub.reduce((s, r) => s + r.llmScore, 0) / sub.length;
    console.log(`  ${b.padEnd(10)} n=${sub.length}  rule=${ra.toFixed(1)}  LLM=${la.toFixed(1)}  Δ=${(la - ra).toFixed(1)}`);
  }

  // Biggest disagreements
  console.log(`\n─── Biggest disagreements (LLM > rule by 30+) ───`);
  const upgrades = results
    .filter((r) => r.llmScore - r.ruleScore >= 30)
    .sort((a, b) => (b.llmScore - b.ruleScore) - (a.llmScore - a.ruleScore))
    .slice(0, 8);
  for (const r of upgrades) {
    console.log(`  ${r.fileId.padEnd(14)} rule=${r.ruleScore}  LLM=${r.llmScore}  | ${r.llmExpl.slice(0, 120)}`);
  }
  console.log(`\n─── Biggest disagreements (rule > LLM by 30+) ───`);
  const downgrades = results
    .filter((r) => r.ruleScore - r.llmScore >= 30)
    .sort((a, b) => (b.ruleScore - b.llmScore) - (a.ruleScore - a.llmScore))
    .slice(0, 8);
  if (downgrades.length === 0) console.log(`  (none — LLM never scores 30+ lower than rule)`);
  for (const r of downgrades) {
    console.log(`  ${r.fileId.padEnd(14)} rule=${r.ruleScore}  LLM=${r.llmScore}  | ${r.llmExpl.slice(0, 120)}`);
  }

  // Save JSON
  const outPath = resolve(__dirname, "compare-depth-results.json");
  writeFileSync(outPath, JSON.stringify({ results, ruleAvg, llmAvg, elapsedSec: Number(elapsed) }, null, 2));
  console.log(`\n✓ Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

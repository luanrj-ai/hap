/**
 * Reads hiring outcomes from the Score table, computes hire-rate per
 * interview-score bucket, and suggests new HIGH/MED/LOW thresholds.
 *
 * The DEFAULT thresholds in code are HIGH=71, MED=40. Once we have enough
 * outcome data, we can shift these so that "HIGH" means "actually likely to
 * get hired" rather than an arbitrary cutoff.
 *
 *   cd apps/web && npx tsx scripts/calibrate-thresholds.ts
 *   cd apps/web && npx tsx scripts/calibrate-thresholds.ts --apply   # write new defaults
 *
 * Calibration logic:
 *   - For each 10-point bucket of interview score, compute "hire_rate" =
 *     hired / (hired + declined + rejected) [interviewed is neutral, excluded]
 *   - Find the bucket where hire_rate first crosses 50%  → new HIGH threshold
 *   - Find the bucket where hire_rate first crosses 20%  → new MED threshold
 *   - Require ≥ 5 samples per bucket before trusting it
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "../../../packages/scoring/config/tuning.json");

const apply = process.argv.includes("--apply");
const MIN_BUCKET_SAMPLES = 5;
const HIGH_HIRE_RATE = 0.5;
const MED_HIRE_RATE = 0.2;

interface TuningConfig {
  version: string;
  weights: Record<string, number>;
  verdictThresholds?: { high?: number; med?: number };
  lastTunedAt: string | null;
  feedbackSampleSize: number;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const rows = await prisma.score.findMany({
    where: { hiringOutcome: { not: null } },
    select: { interview: true, hiringOutcome: true },
  });

  if (rows.length === 0) {
    console.log("No hiring outcomes recorded yet. Use the digest to record outcomes first.");
    await prisma.$disconnect();
    return;
  }

  console.log(`\nReading ${rows.length} outcomes...`);
  const counts = { hired: 0, declined: 0, rejected: 0, interviewed: 0 };
  for (const r of rows) counts[r.hiringOutcome as keyof typeof counts]++;
  console.log(`  hired=${counts.hired} declined=${counts.declined} rejected=${counts.rejected} interviewed=${counts.interviewed}`);

  // Bucket by interview score (deciles: 0-9, 10-19, ..., 90-100)
  const buckets: Array<{ lo: number; hi: number; hired: number; nonHired: number; rate: number | null }> = [];
  for (let lo = 0; lo < 100; lo += 10) {
    const hi = lo + 9;
    const sub = rows.filter((r) => r.interview >= lo && r.interview <= hi);
    const decisive = sub.filter((r) => r.hiringOutcome !== "interviewed");
    const hired = decisive.filter((r) => r.hiringOutcome === "hired").length;
    const total = decisive.length;
    buckets.push({
      lo, hi, hired,
      nonHired: total - hired,
      rate: total >= MIN_BUCKET_SAMPLES ? hired / total : null,
    });
  }

  console.log("\nInterview-score → hire-rate:");
  console.log("Bucket      | hired/total | rate");
  for (const b of buckets) {
    const total = b.hired + b.nonHired;
    const rate = b.rate === null ? "  n/a  " : `${(b.rate * 100).toFixed(0)}%`;
    console.log(`${String(b.lo).padStart(3)}-${String(b.hi).padEnd(3)} | ${String(b.hired).padStart(3)}/${String(total).padEnd(3)}    | ${rate}`);
  }

  // Find new thresholds: first bucket from the top whose rate ≥ 50% → HIGH
  let newHigh = 71;
  let newMed = 40;
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (buckets[i].rate !== null && buckets[i].rate! >= HIGH_HIRE_RATE) {
      newHigh = buckets[i].lo;
      break;
    }
  }
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (buckets[i].rate !== null && buckets[i].rate! >= MED_HIRE_RATE) {
      newMed = buckets[i].lo;
      break;
    }
  }
  console.log(`\nProposed thresholds: HIGH=${newHigh}  MED=${newMed}`);
  console.log(`(default: HIGH=71  MED=40)`);

  if (!apply) {
    console.log(`\nDry-run. Re-run with --apply to write to ${CONFIG_PATH}`);
    await prisma.$disconnect();
    return;
  }

  if (rows.length < 20) {
    console.log(`\n⚠ Only ${rows.length} outcomes — refusing to apply (min 20 to avoid noise).`);
    console.log(`   Re-run after collecting more outcomes.`);
    await prisma.$disconnect();
    return;
  }

  const text = readFileSync(CONFIG_PATH, "utf8");
  const config = JSON.parse(text) as TuningConfig;
  config.verdictThresholds = { high: newHigh, med: newMed };
  config.lastTunedAt = new Date().toISOString();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
  console.log(`\n✓ Wrote new thresholds to ${CONFIG_PATH}`);
  console.log(`💡 Restart dev:web for changes to take effect.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

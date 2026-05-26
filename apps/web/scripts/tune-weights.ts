/**
 * Weekly weight-tuning script.
 *
 * Reads Feedback rows from the last N days, computes a per-signal disagreement
 * rate (downs / total), and adjusts each signal's weight toward agreement.
 *
 * Algorithm:
 *   disagreement = downs / (ups + downs)
 *   baseline = 0.30  (some disagreement is healthy)
 *   delta    = (baseline - disagreement) * sensitivity
 *   delta    = clamp(delta, ±MAX_DELTA_PER_RUN)
 *   new_w    = clamp(old_w * (1 + delta), MIN_WEIGHT, MAX_WEIGHT)
 *
 * Signals with fewer than `--min-samples` feedback events are left alone.
 *
 * Usage:
 *   npm run tune:weights                       # apply
 *   npm run tune:weights -- --preview          # preview only
 *   npm run tune:weights -- --days=14          # different window
 *   npm run tune:weights -- --min-samples=5    # different sample floor
 *   npm run tune:weights -- --all          # show unchanged signals too
 */
import { PrismaClient } from "@prisma/client";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(
  __dirname,
  "../../../packages/scoring/config/tuning.json",
);

const BASELINE_DISAGREEMENT = 0.3;
const SENSITIVITY = 0.5;
const MIN_WEIGHT = 5;
const MAX_WEIGHT = 40;
const MAX_DELTA_PER_RUN = 0.2;

interface TuningConfig {
  version: string;
  weights: Record<string, number>;
  lastTunedAt: string | null;
  feedbackSampleSize: number;
}

interface Args {
  preview: boolean;
  days: number;
  minSamples: number;
  verbose: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const valOf = (key: string, def: number): number => {
    const raw = argv.find((a) => a.startsWith(`--${key}=`));
    if (!raw) return def;
    const n = Number(raw.split("=")[1]);
    return Number.isFinite(n) && n > 0 ? n : def;
  };
  return {
    preview: argv.includes("--preview"),
    verbose: argv.includes("--all"),
    days: valOf("days", 7),
    minSamples: valOf("min-samples", 10),
  };
}

async function loadConfig(): Promise<TuningConfig> {
  const text = await readFile(CONFIG_PATH, "utf8");
  return JSON.parse(text) as TuningConfig;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function fmt(n: number, w = 4): string {
  return String(n).padStart(w);
}

async function main(): Promise<void> {
  const args = parseArgs();
  const prisma = new PrismaClient();

  console.log(
    `\n🎛  ResumeTruth weight tuner` +
      `\n   window: last ${args.days} day(s)` +
      `\n   min samples per signal: ${args.minSamples}` +
      `\n   mode: ${args.preview ? "DRY-RUN (no writes)" : "APPLY"}\n`,
  );

  const config = await loadConfig();
  const since = new Date(Date.now() - args.days * 86_400_000);

  const fb = await prisma.feedback.findMany({
    where: {
      createdAt: { gte: since },
      signalId: { not: null },
    },
    select: { signalId: true, thumbs: true },
  });

  // Aggregate per signal
  const stats: Record<string, { ups: number; downs: number }> = {};
  for (const f of fb) {
    const sid = f.signalId as string;
    if (!stats[sid]) stats[sid] = { ups: 0, downs: 0 };
    if (f.thumbs === "up") stats[sid].ups++;
    else if (f.thumbs === "down") stats[sid].downs++;
  }

  // Union of known signals and signals seen in feedback
  const knownSignals = new Set([
    ...Object.keys(config.weights),
    ...Object.keys(stats),
  ]);

  const changes: Array<{
    signal: string;
    before: number;
    after: number;
    ups: number;
    downs: number;
    disagreement: number | null;
    reason: string;
  }> = [];

  const newWeights = { ...config.weights };

  for (const signalId of knownSignals) {
    const s = stats[signalId] ?? { ups: 0, downs: 0 };
    const total = s.ups + s.downs;
    const before = config.weights[signalId] ?? 10;

    if (total < args.minSamples) {
      changes.push({
        signal: signalId,
        before,
        after: before,
        ups: s.ups,
        downs: s.downs,
        disagreement: total > 0 ? s.downs / total : null,
        reason: `insufficient samples (${total}/${args.minSamples})`,
      });
      continue;
    }

    const disagreement = s.downs / total;
    let delta = (BASELINE_DISAGREEMENT - disagreement) * SENSITIVITY;
    delta = clamp(delta, -MAX_DELTA_PER_RUN, MAX_DELTA_PER_RUN);
    const after = clamp(Math.round(before * (1 + delta)), MIN_WEIGHT, MAX_WEIGHT);
    newWeights[signalId] = after;

    changes.push({
      signal: signalId,
      before,
      after,
      ups: s.ups,
      downs: s.downs,
      disagreement,
      reason:
        after === before
          ? "delta below rounding threshold"
          : `disagreement ${(disagreement * 100).toFixed(0)}% → ${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(0)}%`,
    });
  }

  const changedCount = changes.filter((c) => c.before !== c.after).length;

  // Print table
  const head =
    "Signal".padEnd(22) +
    " | " + "Before".padStart(6) +
    " | " + "After".padStart(6) +
    " | " + "👍/👎".padStart(8) +
    " | " + "Disagr".padStart(7) +
    " | Reason";
  console.log(head);
  console.log("-".repeat(head.length + 30));
  for (const c of changes) {
    if (!args.verbose && c.before === c.after && c.ups + c.downs === 0) continue;
    const arrow = c.after > c.before ? " ↑" : c.after < c.before ? " ↓" : "  ";
    const disagr =
      c.disagreement == null ? "  —  " : `${(c.disagreement * 100).toFixed(0)}%`.padStart(5);
    console.log(
      c.signal.padEnd(22) +
        " | " + fmt(c.before, 6) +
        " | " + (fmt(c.after, 4) + arrow).padStart(6) +
        " | " + `${c.ups}/${c.downs}`.padStart(8) +
        " | " + disagr.padStart(7) +
        " | " + c.reason,
    );
  }

  console.log(
    `\nSummary: ${fb.length} feedback events, ${changedCount} weight(s) changed.`,
  );

  if (args.preview) {
    console.log("[dry-run] No file or DB writes.");
    await prisma.$disconnect();
    return;
  }

  if (changedCount === 0 && fb.length === 0) {
    console.log("No feedback yet — skipping write & DB log to avoid noise.");
    await prisma.$disconnect();
    return;
  }

  const newConfig: TuningConfig = {
    version: `auto-${new Date().toISOString().slice(0, 10)}`,
    weights: newWeights,
    lastTunedAt: new Date().toISOString(),
    feedbackSampleSize: fb.length,
  };

  await writeFile(CONFIG_PATH, JSON.stringify(newConfig, null, 2) + "\n");
  await prisma.tuningRun.create({
    data: {
      windowDays: args.days,
      minSamples: args.minSamples,
      feedbackCount: fb.length,
      weightsBefore: JSON.stringify(config.weights),
      weightsAfter: JSON.stringify(newWeights),
      signalStats: JSON.stringify(stats),
      changedCount,
      notes: `auto-tune via npm run tune:weights`,
      dryRun: false,
    },
  });

  console.log(`\n✅ Wrote ${CONFIG_PATH}`);
  console.log(`📝 Logged TuningRun to DB`);
  console.log(
    `💡 Restart the web app (or rebuild) for new weights to take effect.\n`,
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[tune-weights] failed:", err);
  process.exit(1);
});

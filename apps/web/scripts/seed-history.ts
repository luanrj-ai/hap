/**
 * Score all eval fixtures via the local API to seed the Score table
 * with realistic data for the weekly digest.
 *
 *   npm run dev:web  (in another terminal)
 *   cd apps/web && npx tsx scripts/seed-history.ts
 *   cd apps/web && npx tsx scripts/seed-history.ts --clear     # wipe seeded rows first
 *   cd apps/web && npx tsx scripts/seed-history.ts --jds=1     # only 1 JD (faster)
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { REAL_FIXTURES, JOBS, ALL_JOBS, type JobKey } from "../eval/fixtures";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AI_DIR = resolve(__dirname, "../eval/data/ai");
const API_BASE = process.env.API_BASE || "http://localhost:3000";
const SEED_MARKER = "[seeded-history]";

interface Fixture {
  id: string;
  source: "real" | "ai";
  resumeText: string;
}

function loadAi(): Fixture[] {
  try {
    const manifest = JSON.parse(readFileSync(resolve(AI_DIR, "manifest.json"), "utf8")) as {
      entries: Array<{ filename: string; tier: string; role: string }>;
    };
    return manifest.entries.map((e) => ({
      id: e.filename.replace(/\.txt$/, ""),
      source: "ai" as const,
      resumeText: readFileSync(resolve(AI_DIR, e.filename), "utf8"),
    }));
  } catch {
    return [];
  }
}

async function scoreOne(
  fx: Fixture,
  jobKey: JobKey,
): Promise<{ ok: boolean; status: number; scoreId?: string }> {
  const job = JOBS[jobKey];
  try {
    const res = await fetch(`${API_BASE}/api/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateName: `${SEED_MARKER} ${fx.id}`,
        jobDescription: job.description,
        resumeText: fx.resumeText,
      }),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = (await res.json()) as { scoreId?: string };
    return { ok: true, status: res.status, scoreId: data.scoreId };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  let cursor = 0;
  async function run(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => run()));
}

async function main(): Promise<void> {
  const clear = process.argv.includes("--clear");
  const jdsArg = process.argv.find((a) => a.startsWith("--jds="));
  const jdsLimit = jdsArg ? Number(jdsArg.split("=")[1]) : ALL_JOBS.length;

  if (clear) {
    const prisma = new PrismaClient();
    const seeded = await prisma.score.findMany({
      where: { candidateName: { contains: SEED_MARKER } },
      select: { id: true },
    });
    const ids = seeded.map((s) => s.id);
    if (ids.length > 0) {
      await prisma.feedback.deleteMany({ where: { scoreId: { in: ids } } });
      await prisma.signal.deleteMany({ where: { scoreId: { in: ids } } });
      const del = await prisma.score.deleteMany({ where: { id: { in: ids } } });
      console.log(`Cleared ${del.count} seeded scores.`);
    }
    await prisma.$disconnect();
  }

  // Health check
  try {
    const r = await fetch(`${API_BASE}/api/health`);
    if (!r.ok) throw new Error(`health ${r.status}`);
  } catch {
    console.error(`Cannot reach ${API_BASE}/api/health. Run 'npm run dev:web' first.`);
    process.exit(1);
  }

  const fixtures: Fixture[] = [
    ...REAL_FIXTURES.map((f) => ({ id: f.id, source: "real" as const, resumeText: f.resumeText })),
    ...loadAi(),
  ];
  const jobs = ALL_JOBS.slice(0, jdsLimit);

  type Task = { fx: Fixture; jobKey: JobKey };
  const tasks: Task[] = [];
  for (const fx of fixtures) {
    for (const job of jobs) tasks.push({ fx, jobKey: job.key as JobKey });
  }

  console.log(`Scoring ${fixtures.length} fixtures × ${jobs.length} JDs = ${tasks.length} requests via ${API_BASE}`);
  console.log(`Note: this uses the API as-is (LLM signals on if .env has a key, verify=false).\n`);

  const t0 = Date.now();
  let ok = 0, fail = 0;
  await runWithConcurrency(tasks, async (task) => {
    const r = await scoreOne(task.fx, task.jobKey);
    if (r.ok) ok++; else fail++;
    process.stdout.write(`\r  progress: ${ok + fail}/${tasks.length} (ok=${ok} fail=${fail})`);
  }, 4);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n\nDone: ${ok} succeeded, ${fail} failed in ${elapsed}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Seed synthetic feedback so you can demo the tuning loop end-to-end.
 *
 *   npm run tune:seed                 # add ~80 events with a deliberate mix
 *   npm run tune:seed -- --clear      # wipe synthetic events first
 *
 * Scenarios baked in:
 *   - ai-text:             low disagreement  (HR mostly agrees with AI flagging)
 *   - template-uniformity: high disagreement (HR thinks too aggressive)
 *   - timeline:            low disagreement
 *   - external-evidence:   high disagreement (HR thinks unfair to those w/o GitHub)
 *   - jd-match:            medium agreement
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// signalId -> [ups, downs]
const PLAN: Record<string, [number, number]> = {
  "ai-text": [16, 4],
  "template-uniformity": [3, 17],
  "timeline": [12, 3],
  "external-evidence": [4, 14],
  "jd-match": [8, 7],
};

const SEED_MARKER = "[seed]";

async function ensureScore(): Promise<string> {
  const existing = await prisma.score.findFirst({
    where: { summary: { contains: SEED_MARKER } },
  });
  if (existing) return existing.id;

  const score = await prisma.score.create({
    data: {
      candidateName: "[seed] synthetic candidate",
      candidateHash: "seed_" + Date.now().toString(36),
      authenticity: 70,
      verifiability: 50,
      interview: 60,
      summary: `${SEED_MARKER} test score for tuner demo`,
      signals: {
        create: Object.keys(PLAN).map((id) => ({
          signalId: id,
          label: id,
          dimension: "authenticity",
          weight: 10,
          value: 60,
          impact: "neutral",
          explanation: "seed",
        })),
      },
    },
  });
  return score.id;
}

async function main(): Promise<void> {
  const clear = process.argv.includes("--clear");

  if (clear) {
    const seedScores = await prisma.score.findMany({
      where: { summary: { contains: SEED_MARKER } },
      select: { id: true },
    });
    const ids = seedScores.map((s) => s.id);
    const del = await prisma.feedback.deleteMany({ where: { scoreId: { in: ids } } });
    const delScores = await prisma.score.deleteMany({ where: { id: { in: ids } } });
    console.log(`Cleared ${del.count} feedback + ${delScores.count} seed score(s).`);
  }

  const scoreId = await ensureScore();
  console.log(`Seed score id: ${scoreId}`);

  let total = 0;
  for (const [signalId, [ups, downs]] of Object.entries(PLAN)) {
    const rows: Array<{
      scoreId: string;
      signalId: string;
      thumbs: string;
      reason: string;
    }> = [];
    for (let i = 0; i < ups; i++) {
      rows.push({ scoreId, signalId, thumbs: "up", reason: SEED_MARKER });
    }
    for (let i = 0; i < downs; i++) {
      rows.push({ scoreId, signalId, thumbs: "down", reason: SEED_MARKER });
    }
    const r = await prisma.feedback.createMany({ data: rows });
    console.log(`  ${signalId.padEnd(22)}  +${r.count}  (${ups}👍 / ${downs}👎)`);
    total += r.count;
  }

  console.log(`\nSeeded ${total} feedback events. Now run: npm run tune:weights -- --dry-run`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});

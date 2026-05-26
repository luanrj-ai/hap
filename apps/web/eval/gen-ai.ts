/**
 * Generate AI-style resumes via the configured LLM, tagged by difficulty tier
 * and claimed role. Writes:
 *   - apps/web/eval/data/ai/<tier>-<role>-<idx>.txt
 *   - apps/web/eval/data/ai/manifest.json  (metadata index)
 *
 * Tiers (difficulty of detection — lower = easier for detector):
 *   - naive:        pure buzzword salad, zero specifics, fake company names
 *   - coached:      one or two real numbers, real company names, still templated
 *   - adversarial:  AI explicitly trying to evade detection
 *
 * Roles (claimed by the AI):
 *   - payments-backend  → maps to JOBS.paymentsBackend HIGH-claim
 *   - frontend          → JOBS.seniorFrontend HIGH-claim
 *   - data-ml           → JOBS.dataEngineer HIGH-claim
 *
 *   cd apps/web && npx tsx eval/gen-ai.ts
 *   cd apps/web && npx tsx eval/gen-ai.ts --force         # regenerate all
 *   cd apps/web && npx tsx eval/gen-ai.ts --tier=naive    # only one tier
 */
import { callLLMJson, activeProvider, activeModel } from "@resumetruth/scoring/llm-client";
import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "data/ai");

type Tier = "naive" | "coached" | "adversarial";
type Role = "payments-backend" | "frontend" | "data-ml";

interface Spec {
  tier: Tier;
  role: Role;
  idx: number;
}

const ROLES: Role[] = ["payments-backend", "frontend", "data-ml"];
const TIERS: Tier[] = ["naive", "coached", "adversarial"];

const SPECS: Spec[] = [];
for (const tier of TIERS) {
  for (const role of ROLES) {
    for (let idx = 1; idx <= 3; idx++) SPECS.push({ tier, role, idx });
  }
}
// gives 27 specs; add 3 more for round 30
SPECS.push(
  { tier: "naive", role: "payments-backend", idx: 4 },
  { tier: "coached", role: "frontend", idx: 4 },
  { tier: "adversarial", role: "data-ml", idx: 4 },
);

const TIER_PROMPTS: Record<Tier, string> = {
  naive: `Write a resume that is OBVIOUSLY AI-generated. Use:
- Heavy buzzwords (transformative, revolutionary, pioneering, results-driven, leveraging, spearheaded, synergize, world-class, cutting-edge)
- Generic company names ("TechCorp", "FintechCo", "Digital Finance Solutions")
- NO specific numbers, NO real metrics
- All bullets nearly identical length
- Generic platitudes throughout`,
  coached: `Write a resume that LOOKS more polished but is still AI-generated. Include:
- 1-2 real company names (Stripe, Square, Notion, etc.) — but don't be specific about role/dates
- 1-2 vague numbers ("improved performance by 30%", "scaled to millions of users") — but no concrete project details
- Still heavy on buzzwords like "results-driven", "leveraging", "passionate about"
- All bullets still ~same length, no specific projects
- Generic education section`,
  adversarial: `Write a resume that EXPLICITLY tries to evade AI-resume detectors. Apply:
- Use REAL company names (Stripe, Notion, Anthropic, OpenAI, etc.)
- Include SPECIFIC NUMBERS (latency in ms, RPS counts, dollar amounts, star counts)
- VARY bullet length and structure
- Mention SPECIFIC technical terms (e.g., "Raft consensus", "operational transforms", "DML stmt rewriting", "Lua-scripted Redis")
- Include a (fake) GitHub URL and a (fake) personal site
- AVOID the cliché buzzwords entirely — write like a real developer would
- BUT: the work described should still be subtly inconsistent (e.g., timeline impossible, claimed feature doesn't really exist at the company)`,
};

const ROLE_PROMPTS: Record<Role, string> = {
  "payments-backend":
    "The candidate claims to be a senior backend engineer with payments/fintech experience.",
  frontend:
    "The candidate claims to be a senior frontend engineer (React/TypeScript) on consumer products.",
  "data-ml":
    "The candidate claims to be a senior data/ML engineer working on recommendation systems or feature pipelines.",
};

const RESUME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["resumeText"],
  properties: {
    resumeText: {
      type: "string",
      description:
        "Full resume text in English. Include Name, Title, Summary, Experience (2-3 jobs), Education. Around 200-400 words.",
    },
  },
};

interface ManifestEntry {
  filename: string;
  tier: Tier;
  role: Role;
}

interface Manifest {
  generatedAt: string;
  provider: string;
  model: string;
  entries: ManifestEntry[];
}

function fileFor(spec: Spec): string {
  return `${spec.tier}-${spec.role}-${String(spec.idx).padStart(2, "0")}.txt`;
}

async function generateOne(spec: Spec): Promise<string | null> {
  const result = await callLLMJson<{ resumeText: string }>({
    messages: [
      {
        role: "system",
        content:
          "You generate sample resumes for testing an AI-resume-detection system. Output English plain text only, no markdown wrappers.",
      },
      {
        role: "user",
        content: `${ROLE_PROMPTS[spec.role]}\n\n${TIER_PROMPTS[spec.tier]}\n\nReturn JSON {"resumeText": "..."}. ~250-400 words.`,
      },
    ],
    schema: RESUME_SCHEMA,
    schemaName: "ai_resume",
    maxTokens: 1500,
  });
  return result?.resumeText ?? null;
}

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => run()));
  return results;
}

async function main(): Promise<void> {
  if (!activeProvider()) {
    console.error("No LLM key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env");
    process.exit(1);
  }
  const force = process.argv.includes("--force");
  const tierFilter = process.argv.find((a) => a.startsWith("--tier="))?.split("=")[1] as Tier | undefined;

  mkdirSync(OUT_DIR, { recursive: true });

  // If --force without tier filter, clean out old .txt files
  if (force && !tierFilter) {
    for (const f of readdirSync(OUT_DIR)) {
      if (f.endsWith(".txt") || f === "manifest.json") {
        try { unlinkSync(resolve(OUT_DIR, f)); } catch {}
      }
    }
    console.log(`Cleared old fixtures from ${OUT_DIR}\n`);
  }

  const todo = SPECS.filter((s) => (tierFilter ? s.tier === tierFilter : true)).filter((s) => {
    const path = resolve(OUT_DIR, fileFor(s));
    return force || !existsSync(path);
  });

  console.log(`Provider: ${activeProvider()} / model: ${activeModel()}`);
  console.log(`Output:   ${OUT_DIR}`);
  console.log(`To generate: ${todo.length} of ${SPECS.length} specs\n`);

  let done = 0;
  await runWithConcurrency(
    todo,
    async (spec) => {
      const text = await generateOne(spec);
      done++;
      const filename = fileFor(spec);
      if (!text || text.length < 200) {
        console.log(`  [${done}/${todo.length}] ${filename} — SKIPPED (gen failed)`);
        return;
      }
      writeFileSync(resolve(OUT_DIR, filename), text);
      console.log(`  [${done}/${todo.length}] ${filename}  (${text.length} chars)`);
    },
    3,
  );

  // Rebuild manifest from all .txt files in OUT_DIR
  const allFiles = readdirSync(OUT_DIR).filter((f) => f.endsWith(".txt"));
  const entries: ManifestEntry[] = [];
  for (const filename of allFiles) {
    // Skip legacy files that don't match tier-role-NN.txt
    const m = filename.match(/^(naive|coached|adversarial)-(payments-backend|frontend|data-ml)-\d+\.txt$/);
    if (!m) continue;
    entries.push({ filename, tier: m[1] as Tier, role: m[2] as Role });
  }
  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    provider: activeProvider()!,
    model: activeModel(),
    entries,
  };
  writeFileSync(resolve(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\n✓ Manifest written: ${entries.length} AI fixtures`);
  console.log(`Next: npx tsx eval/run.ts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

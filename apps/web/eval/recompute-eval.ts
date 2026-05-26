/**
 * Recompute eval metrics using a stricter, evidence-based ground truth.
 *
 * Original ground truth (sample-real-pdf.ts) auto-bucketed every resume into
 * backend/frontend/data-ml then labeled the matching JD as HIGH. This was too
 * generous — a Linux sysadmin with "Java" keyword got labeled HIGH for "Senior
 * Backend Payments" JD even though they have zero payments experience.
 *
 * New rule: HIGH requires explicit JD-keyword evidence in the resume.
 *   - paymentsBackend HIGH: mentions payment/fintech/billing/banking/transaction terms
 *   - seniorFrontend HIGH: explicit senior + React/Vue/Angular + (5+ years OR senior role)
 *   - dataEngineer HIGH: explicit ML/data-pipeline/recsys evidence
 *
 *   cd apps/web && npx tsx eval/recompute-eval.ts
 *   cd apps/web && npx tsx eval/recompute-eval.ts --input=eval/eval-results-real-pdf.json --out=eval/eval-results-real-pdf-v2.json
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLED_DIR = resolve(__dirname, "data/real-pdf-sampled");

type FitBand = "HIGH" | "MED" | "LOW";
type JobKey = "paymentsBackend" | "seniorFrontend" | "dataEngineer";

interface Cell {
  fxId: string;
  source: "real" | "ai";
  aiTier?: string;
  jobKey: string;
  expectedFit: FitBand;
  baseJdScore: number;
  llmJdScore: number;
  ruleAiText: number;
  llmAiText: number;
}

interface Results {
  cells: Cell[];
  [k: string]: unknown;
}

const PAYMENTS_HIGH = /\b(payment|fintech|billing|banking|stripe|paypal|square|adyen|braintree|transaction processing|merchant|settlement|reconciliation|fraud detection|chargebac|currency|fx\b|forex|wallet)\b/i;
const PAYMENTS_BE = /\b(senior backend|staff engineer|backend engineer|distributed|microservic|kafka|kubernetes|go(lang)?\b|rust\b|spring\b|node\.?js|grpc|api gateway)\b/i;

const FE_FRAMEWORK = /\b(react|vue|svelte|angular|next\.?js|nuxt)\b/i;
const FE_SENIOR = /\b(senior|lead|principal|staff|7\+|6\+|5\+|10\+|8\+ years|frontend lead|ui lead)\b/i;
const FE_GENERIC = /\b(front\s?end|javascript|typescript|html|css)\b/i;

const ML_HIGH = /\b(machine learning|deep learning|tensorflow|pytorch|scikit-learn|sklearn|recommendation|ranking|feature store|model serving|mlops|data pipeline|spark|flink|kafka streams|feature engineering|nlp engineer|ml engineer)\b/i;
const DATA_GENERIC = /\b(data science|data engineer|data analyst|sql|python|pandas|numpy|etl|big data)\b/i;

const NEGATIVE_BACKEND = /\b(media buyer|advertising|sales|marketing manager|consultant|hr\b|recruiter|teacher|nurse|accountant)\b/i;

/** Junior / entry-level signals — cap candidate fit at MED regardless of skills. */
const JUNIOR_SIGNAL = /\b(intern\b|trainee|fresher|junior\b|entry[\s-]level|new grad|recent graduate|assistant (software|developer|engineer|data)|graduate trainee)\b/i;

function deriveExpectedFit(text: string): Record<JobKey, FitBand> {
  const hayHaystack = text.slice(0, 5000);
  const isJunior = JUNIOR_SIGNAL.test(hayHaystack);

  // ---- payments backend ----
  let pay: FitBand;
  if (PAYMENTS_HIGH.test(hayHaystack) && PAYMENTS_BE.test(hayHaystack) && !isJunior) pay = "HIGH";
  else if (PAYMENTS_BE.test(hayHaystack) && !NEGATIVE_BACKEND.test(hayHaystack)) pay = "MED";
  else pay = "LOW";

  // ---- senior frontend ----
  let fe: FitBand;
  if (FE_FRAMEWORK.test(hayHaystack) && FE_SENIOR.test(hayHaystack) && !isJunior) fe = "HIGH";
  else if (FE_FRAMEWORK.test(hayHaystack) || (FE_GENERIC.test(hayHaystack) && FE_SENIOR.test(hayHaystack))) fe = "MED";
  else fe = "LOW";

  // ---- data / ML ----
  let dml: FitBand;
  if (ML_HIGH.test(hayHaystack) && !isJunior) dml = "HIGH";
  else if (ML_HIGH.test(hayHaystack) || DATA_GENERIC.test(hayHaystack)) dml = "MED";
  else dml = "LOW";

  return { paymentsBackend: pay, seniorFrontend: fe, dataEngineer: dml };
}

function bucketize(s: number): FitBand {
  if (s >= 71) return "HIGH";
  if (s >= 40) return "MED";
  return "LOW";
}

function pct(p: number): string { return `${p.toFixed(0)}%`; }

function main(): void {
  const inputArg = process.argv.find((a) => a.startsWith("--input="))?.split("=")[1];
  const outArg = process.argv.find((a) => a.startsWith("--out="))?.split("=")[1];
  const inputPath = resolve(__dirname, inputArg ? inputArg.replace(/^eval\//, "") : "eval-results-real-pdf.json");
  const outPath = resolve(__dirname, outArg ? outArg.replace(/^eval\//, "") : "eval-results-real-pdf-v2.json");

  if (!existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(inputPath, "utf8")) as Results;

  let updated = 0;
  let labelChanges: Record<string, number> = {};
  const newCells = data.cells.map((c) => {
    if (c.source !== "real" || !c.fxId.startsWith("real-pdf-")) return c;
    const id = c.fxId.replace("real-pdf-", "");
    const txtPath = resolve(SAMPLED_DIR, `${id}.txt`);
    if (!existsSync(txtPath)) return c;
    const text = readFileSync(txtPath, "utf8");
    const fit = deriveExpectedFit(text);
    const newFit = fit[c.jobKey as JobKey];
    if (newFit && newFit !== c.expectedFit) {
      const key = `${c.expectedFit}→${newFit}`;
      labelChanges[key] = (labelChanges[key] ?? 0) + 1;
      updated++;
      return { ...c, expectedFit: newFit };
    }
    return c;
  });

  // Aggregate before/after stats
  function jdStats(cells: Cell[]) {
    const real = cells.filter((c) => c.source === "real");
    const jds = ["paymentsBackend", "seniorFrontend", "dataEngineer"];
    return jds.map((j) => {
      const sub = real.filter((c) => c.jobKey === j);
      const bow = sub.filter((c) => bucketize(c.baseJdScore) === c.expectedFit).length;
      const llm = sub.filter((c) => bucketize(c.llmJdScore) === c.expectedFit).length;
      return { jd: j, total: sub.length, bow, llm };
    });
  }
  const before = jdStats(data.cells);
  const after = jdStats(newCells);

  console.log(`\n=== Ground truth relabel ===`);
  console.log(`Cells updated: ${updated}/${data.cells.filter((c) => c.source === "real").length}`);
  console.log(`\nLabel transitions:`);
  for (const [k, v] of Object.entries(labelChanges).sort(([, a], [, b]) => b - a)) {
    console.log(`  ${k}: ${v}`);
  }

  console.log(`\n=== JD-match accuracy: before vs after ===`);
  console.log(`${"JD".padEnd(20)} ${"BoW (before)".padEnd(14)} ${"BoW (after)".padEnd(14)} ${"LLM (before)".padEnd(14)} ${"LLM (after)".padEnd(14)}`);
  for (let i = 0; i < before.length; i++) {
    const b = before[i], a = after[i];
    console.log(
      `${b.jd.padEnd(20)} ` +
      `${`${b.bow}/${b.total} ${pct((b.bow / b.total) * 100)}`.padEnd(14)} ` +
      `${`${a.bow}/${a.total} ${pct((a.bow / a.total) * 100)}`.padEnd(14)} ` +
      `${`${b.llm}/${b.total} ${pct((b.llm / b.total) * 100)}`.padEnd(14)} ` +
      `${`${a.llm}/${a.total} ${pct((a.llm / a.total) * 100)}`.padEnd(14)}`,
    );
  }
  const bTot = before.reduce((s, x) => ({ total: s.total + x.total, bow: s.bow + x.bow, llm: s.llm + x.llm }), { total: 0, bow: 0, llm: 0 });
  const aTot = after.reduce((s, x) => ({ total: s.total + x.total, bow: s.bow + x.bow, llm: s.llm + x.llm }), { total: 0, bow: 0, llm: 0 });
  console.log(
    `${"TOTAL".padEnd(20)} ` +
    `${`${bTot.bow}/${bTot.total} ${pct((bTot.bow / bTot.total) * 100)}`.padEnd(14)} ` +
    `${`${aTot.bow}/${aTot.total} ${pct((aTot.bow / aTot.total) * 100)}`.padEnd(14)} ` +
    `${`${bTot.llm}/${bTot.total} ${pct((bTot.llm / bTot.total) * 100)}`.padEnd(14)} ` +
    `${`${aTot.llm}/${aTot.total} ${pct((aTot.llm / aTot.total) * 100)}`.padEnd(14)}`,
  );

  const newData = { ...data, cells: newCells, relabeled: { at: new Date().toISOString(), updated, labelChanges } };
  writeFileSync(outPath, JSON.stringify(newData, null, 2));
  console.log(`\n✓ Wrote ${outPath}`);
}

main();

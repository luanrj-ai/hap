/**
 * Sample real PDF resumes from the HuggingFace Mehyaar/Annotated_NER_PDF_Resumes
 * dataset (5,029 CVs, MIT licensed). Classifies each by NER skill annotations,
 * keeps strong-signal samples, writes ~60 text files + manifest.
 *
 *   cd apps/web && npx tsx eval/sample-real-pdf.ts
 *   cd apps/web && npx tsx eval/sample-real-pdf.ts --target-per-bucket=30
 *
 * Source files live at: eval/data/real-pdf/ResumesJsonAnnotated/cv (N)_annotated.json
 * Output goes to:       eval/data/real-pdf-sampled/<id>.txt + manifest.json
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = resolve(__dirname, "data/real-pdf/ResumesJsonAnnotated");
const OUT_DIR = resolve(__dirname, "data/real-pdf-sampled");

const TARGET_PER_BUCKET = Number(
  process.argv.find((a) => a.startsWith("--target-per-bucket="))?.split("=")[1] ?? "20",
);

type Bucket = "backend" | "frontend" | "data-ml" | "other";

const SKILL_BUCKETS: Record<Exclude<Bucket, "other">, RegExp[]> = {
  backend: [
    /\b(java|spring|kotlin)\b/i,
    /\b(go(lang)?|rust|c\+\+|c#|\.net|node\.?js|nodejs)\b/i,
    /\b(microservices|distributed|kubernetes|docker|kafka|rabbitmq)\b/i,
    /\b(postgres|mysql|mongodb|redis|cassandra|elasticsearch)\b/i,
    /\b(payments|fintech|banking|trading|finance)\b/i,
    /\bbackend\b|\bback\s?end\b|\bback-end\b/i,
    /\bdevops\b|\bsre\b|\binfrastructure\b/i,
    /\b(api|rest|grpc|graphql)\s/i,
  ],
  frontend: [
    /\b(react|angular|vue|svelte|next\.?js|nuxt)\b/i,
    /\b(typescript|javascript|ecmascript)\b/i,
    /\b(html|css|sass|scss|tailwind|bootstrap)\b/i,
    /\b(webpack|vite|rollup|babel)\b/i,
    /\bfront\s?end\b|\bfront-end\b|\bui\b|\bux\b/i,
    /\bweb\s?developer\b/i,
    /\b(figma|sketch|design\s?system)\b/i,
  ],
  "data-ml": [
    /\b(machine\s?learning|deep\s?learning|neural\s?network)\b/i,
    /\b(tensorflow|pytorch|keras|sklearn|scikit-learn|jax)\b/i,
    /\b(data\s?science|data\s?scientist|data\s?analyst|data\s?engineer)\b/i,
    /\b(spark|hadoop|hive|flink|databricks|snowflake)\b/i,
    /\b(pandas|numpy|nlp|computer\s?vision|recommender)\b/i,
    /\b(ml\s?engineer|ml\s?ops|mlops|ranking|model)\b/i,
    /\bstatistics?\b|\banalytics?\b/i,
  ],
};

interface RawCV {
  text: string;
  annotations?: Array<[number, number, string]>;
}

interface ScoredCV {
  fileId: string;          // e.g. "cv (123)" → safe slug
  text: string;
  skills: string[];        // unique skill strings from annotations
  scores: Record<Bucket, number>;
  bucket: Bucket;          // assigned bucket (highest score)
  margin: number;          // difference between top and second bucket
}

function slugFromFilename(fn: string): string {
  // "cv (123)_annotated.json" → "cv-123"
  const m = fn.match(/cv\s*\((\d+)\)_annotated\.json/i);
  return m ? `cv-${m[1]}` : fn.replace(/[^A-Za-z0-9-]/g, "-");
}

function classify(text: string, skills: string[]): { scores: Record<Bucket, number>; bucket: Bucket; margin: number } {
  const haystack = `${text}\n${skills.join(" ")}`.toLowerCase();
  const scores: Record<Bucket, number> = { backend: 0, frontend: 0, "data-ml": 0, other: 0 };
  for (const [bucket, patterns] of Object.entries(SKILL_BUCKETS)) {
    for (const p of patterns) {
      const matches = haystack.match(new RegExp(p.source, "gi"));
      if (matches) scores[bucket as Bucket] += Math.min(matches.length, 5);
    }
  }
  // Sort
  const sorted = (["backend", "frontend", "data-ml"] as const)
    .map((b) => ({ bucket: b, score: scores[b] }))
    .sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const second = sorted[1];
  const margin = top.score - second.score;
  // Require clear leader to avoid mixed/unclear samples
  if (top.score < 5 || margin < 3) {
    return { scores, bucket: "other", margin };
  }
  return { scores, bucket: top.bucket, margin };
}

function extractSkills(cv: RawCV): string[] {
  if (!cv.annotations) return [];
  const out = new Set<string>();
  for (const [start, end] of cv.annotations) {
    const span = cv.text.slice(start, end).trim();
    if (span && span.length >= 2 && span.length <= 40) out.add(span);
  }
  return [...out];
}

interface ManifestEntry {
  fileId: string;
  bucket: Bucket;
  expectedFitHigh: "paymentsBackend" | "seniorFrontend" | "dataEngineer";
  textLength: number;
  topSkills: string[];
  margin: number;
}

function main(): void {
  if (!existsSync(SOURCE_DIR)) {
    console.error(`Source dir not found: ${SOURCE_DIR}`);
    console.error(`Run: cd apps/web/eval/data/real-pdf && unzip ResumesJsonAnnotated.zip`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const f of readdirSync(OUT_DIR)) {
    if (f.endsWith(".txt") || f === "manifest.json") {
      try { unlinkSync(resolve(OUT_DIR, f)); } catch {}
    }
  }

  const files = readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".json"));
  console.log(`Scanning ${files.length} CV files...`);

  const scored: ScoredCV[] = [];
  let parseErrors = 0;
  for (const f of files) {
    try {
      const raw = JSON.parse(readFileSync(resolve(SOURCE_DIR, f), "utf8")) as RawCV;
      if (!raw.text || raw.text.length < 400) continue;
      const skills = extractSkills(raw);
      if (skills.length < 3) continue;
      const { scores, bucket, margin } = classify(raw.text, skills);
      if (bucket === "other") continue;
      scored.push({
        fileId: slugFromFilename(f),
        text: raw.text,
        skills,
        scores,
        bucket,
        margin,
      });
    } catch {
      parseErrors++;
    }
  }
  console.log(`  ${scored.length} CVs with clear bucket signal (skipped ${parseErrors} parse errors)`);

  // Bucket counts
  const byBucket: Record<Bucket, ScoredCV[]> = { backend: [], frontend: [], "data-ml": [], other: [] };
  for (const s of scored) byBucket[s.bucket].push(s);
  console.log(`  backend: ${byBucket.backend.length}, frontend: ${byBucket.frontend.length}, data-ml: ${byBucket["data-ml"].length}`);

  // Sample top-N by margin (most clearly-bucketed samples) per bucket
  function sortByMargin(arr: ScoredCV[]): ScoredCV[] {
    return [...arr].sort((a, b) => b.margin - a.margin);
  }
  const sampled: ScoredCV[] = [
    ...sortByMargin(byBucket.backend).slice(0, TARGET_PER_BUCKET),
    ...sortByMargin(byBucket.frontend).slice(0, TARGET_PER_BUCKET),
    ...sortByMargin(byBucket["data-ml"]).slice(0, TARGET_PER_BUCKET),
  ];

  const entries: ManifestEntry[] = [];
  for (const s of sampled) {
    const outPath = resolve(OUT_DIR, `${s.fileId}.txt`);
    writeFileSync(outPath, s.text);
    // Note: this expectedFitHigh is the SKILL BUCKET. The actual HIGH/MED/LOW
    // label is later re-derived from resume content via eval/recompute-eval.ts
    // (evidence-based: payments keywords for backend HIGH, senior+framework for
    // FE HIGH, ML pipeline for data HIGH, junior signal demotes to MED).
    const expectedFitHigh =
      s.bucket === "backend" ? "paymentsBackend" :
      s.bucket === "frontend" ? "seniorFrontend" : "dataEngineer";
    entries.push({
      fileId: s.fileId,
      bucket: s.bucket,
      expectedFitHigh,
      textLength: s.text.length,
      topSkills: s.skills.slice(0, 8),
      margin: s.margin,
    });
  }

  const manifest = {
    source: "HuggingFace Mehyaar/Annotated_NER_PDF_Resumes (MIT)",
    sampledAt: new Date().toISOString(),
    totalScanned: files.length,
    keptForBucketing: scored.length,
    sampledCount: entries.length,
    targetPerBucket: TARGET_PER_BUCKET,
    entries,
  };
  writeFileSync(resolve(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\n✓ Sampled ${entries.length} real PDF-derived resumes → ${OUT_DIR}`);
  console.log(`  backend: ${entries.filter((e) => e.bucket === "backend").length}`);
  console.log(`  frontend: ${entries.filter((e) => e.bucket === "frontend").length}`);
  console.log(`  data-ml: ${entries.filter((e) => e.bucket === "data-ml").length}`);
}

main();

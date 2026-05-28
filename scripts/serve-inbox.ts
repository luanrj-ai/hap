/**
 * Run the employer side locally: publish one posting + a dumb inbox that
 * auto-scores arriving applications on dereferenced evidence.
 *
 *   tsx scripts/serve-inbox.ts        # serves on :4910 until Ctrl-C
 *
 * Then a candidate applies against it:
 *   tsx scripts/apply.ts --posting http://localhost:4910/posting.json --handle <gh>
 *   tsx scripts/apply.ts --send
 *
 * Reads LLM env from apps/web/.env. Set GITHUB_TOKEN to avoid the 60/h unauth
 * GitHub rate limit when verifying evidence.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { buildInbox, postingFromJD, type JobDescription } from "@hap/hr-runtime";

loadEnv({ path: resolve(process.cwd(), "apps/web/.env") });

const PORT = Number(process.env.PORT ?? 4910);

const JD: JobDescription = {
  title: "Senior Product Engineer",
  summary: "Own a product surface end to end: design, build, ship, measure. Bias to shipping.",
  must_have: [
    "Shipped a product/feature end to end",
    "Strong in a modern web or systems stack",
    "Comfortable going 0 to 1",
  ],
  nice_to_have: ["Open-source footprint", "Agent / LLM product work"],
  domain: "product-eng",
};

const posting = postingFromJD({
  jd: JD,
  posting_id: "local-product-eng-001",
  submitEndpoint: `http://localhost:${PORT}/api/apply`,
  company: "YourCo",
  human_contact: "jobs@yourco.example",
});

const { app, records } = buildInbox({ posting, autoScore: true });
serve({ fetch: app.fetch, port: PORT });

console.log(`\n=== HAP employer inbox (auto-scoring) ===`);
console.log(`posting   : http://localhost:${PORT}/posting.json  —  ${posting.jd.title}`);
console.log(`inbox     : http://localhost:${PORT}/api/apply`);
console.log(`results   : http://localhost:${PORT}/inbox`);
console.log(`llm       : ${process.env.OPENAI_API_KEY ? "openai" : process.env.ANTHROPIC_API_KEY ? "anthropic" : "none (template)"}`);
console.log(`gh verify : ${process.env.GITHUB_TOKEN ? "GITHUB_TOKEN set" : "unauthenticated (60/h limit)"}\n`);
console.log(`apply with:\n  tsx scripts/apply.ts --posting http://localhost:${PORT}/posting.json --handle <github>\n  tsx scripts/apply.ts --send\n`);

// Print a one-line summary for each application exactly once, when its
// background scoring finishes.
const reported = new Set<string>();
setInterval(() => {
  for (const r of records) {
    const id = r.application.application_id;
    if (reported.has(id)) continue;
    if (r.report) {
      console.log(`  ← ${r.application.candidate.name}: ${r.report.verdict} (overall ${r.report.overall})`);
      reported.add(id);
    } else if (r.scoreError) {
      console.log(`  ← ${r.application.candidate.name}: score error — ${r.scoreError}`);
      reported.add(id);
    }
  }
}, 1000).unref?.();

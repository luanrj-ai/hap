/**
 * Run the central discovery index (P3) locally.
 *
 *   tsx scripts/serve-index.ts        # serves on :4920 until Ctrl-C
 *
 * Candidate opt-in publish:
 *   tsx scripts/profile.ts --handle <gh> --with-claude --publish http://localhost:4920
 * Recruiter search:
 *   tsx scripts/search.ts --index http://localhost:4920 --q "rust" --as acme.com
 *
 * Set GITHUB_TOKEN to avoid the 60/h unauth rate limit when verifying profiles.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { DiscoveryIndex, buildDiscoveryApp } from "@hap/hr-runtime";

loadEnv({ path: resolve(process.cwd(), "apps/web/.env") });

const PORT = Number(process.env.PORT ?? 4920);
const index = new DiscoveryIndex();
serve({ fetch: buildDiscoveryApp(index).fetch, port: PORT });

console.log(`\n=== HAP discovery index (Web/Google model · opt-in · central anti-abuse) ===`);
console.log(`publish : POST http://localhost:${PORT}/publish      (candidate opt-in)`);
console.log(`search  : GET  http://localhost:${PORT}/search?q=…   (header X-HAP-Recruiter)`);
console.log(`contact : POST http://localhost:${PORT}/contact      (gated by candidate's rate_limit)`);
console.log(`gh verify : ${process.env.GITHUB_TOKEN ? "GITHUB_TOKEN set" : "unauthenticated (60/h limit)"}\n`);

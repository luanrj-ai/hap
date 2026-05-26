/**
 * Run a candidate-agent server. Reads profile from a JSON file or uses
 * the bundled example.
 *
 *   npm run dev                       # uses EXAMPLE_PROFILE on port 4001
 *   PROFILE=./me.json npm run dev     # load profile from disk
 *   PORT=4010 npm run dev             # custom port
 */
import { serve } from "@hono/node-server";
import { readFileSync } from "node:fs";
import { buildApp } from "./server";
import { EXAMPLE_PROFILE, type CandidateProfile } from "./profile";

const PORT = Number(process.env.PORT ?? 4001);
const PROFILE_PATH = process.env.PROFILE;
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://localhost:${PORT}`;

function loadProfile(): CandidateProfile {
  if (!PROFILE_PATH) {
    console.log("[candidate-runtime] no PROFILE env set, using bundled example");
    return EXAMPLE_PROFILE;
  }
  const text = readFileSync(PROFILE_PATH, "utf8");
  return JSON.parse(text) as CandidateProfile;
}

const profile = loadProfile();
const app = buildApp({ profile, publicUrl: PUBLIC_URL });

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`\n  HAP candidate-agent for ${profile.name}`);
  console.log(`  Listening on http://localhost:${info.port}`);
  console.log(`  AgentCard:  ${PUBLIC_URL}/.well-known/agent.json`);
  console.log(`  Inbox:      POST ${PUBLIC_URL}/agent/messages\n`);
});

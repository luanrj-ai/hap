/**
 * Run an HR-agent server.
 *
 *   npm run dev                       # uses EXAMPLE_JD on port 4002
 *   JD=./payments-jd.json npm run dev # custom JD
 *   PORT=4020 npm run dev
 */
import { serve } from "@hono/node-server";
import { readFileSync } from "node:fs";
import { buildApp } from "./server";
import { EXAMPLE_HR, EXAMPLE_JD, type JobDescription } from "./jd";

const PORT = Number(process.env.PORT ?? 4002);
const JD_PATH = process.env.JD;
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://localhost:${PORT}`;
const COMPANY = process.env.COMPANY ?? EXAMPLE_HR.company;
const HUMAN_CONTACT = process.env.HUMAN_CONTACT ?? EXAMPLE_HR.human_contact;

function loadJd(): JobDescription {
  if (!JD_PATH) {
    console.log("[hr-runtime] no JD env set, using bundled EXAMPLE_JD");
    return EXAMPLE_JD;
  }
  return JSON.parse(readFileSync(JD_PATH, "utf8")) as JobDescription;
}

const jd = loadJd();
const hr = { agent_url: PUBLIC_URL, company: COMPANY, human_contact: HUMAN_CONTACT };
const app = buildApp({ jd, hr, publicUrl: PUBLIC_URL });

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`\n  HAP HR-agent for: ${jd.title}`);
  console.log(`  Company:    ${hr.company ?? "(none)"}`);
  console.log(`  Listening:  http://localhost:${info.port}`);
  console.log(`  AgentCard:  ${PUBLIC_URL}/.well-known/agent.json`);
  console.log(`  Interview:  POST ${PUBLIC_URL}/interview  body={"candidateAgentUrl":"http://..."}`);
  console.log(`              \n`);
});

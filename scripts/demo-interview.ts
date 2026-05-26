/**
 * Spin up an in-process candidate-agent and HR-agent, run one HAP interview,
 * print the transcript. Self-contained — no external ports needed.
 *
 *   npx tsx scripts/demo-interview.ts
 *
 * Reads LLM env from apps/web/.env if present. Falls back to no-LLM mode.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { buildApp as buildCandidateApp, EXAMPLE_PROFILE } from "@hap/candidate-runtime";
import { buildApp as buildHrApp, EXAMPLE_JD, EXAMPLE_HR, runInterview } from "@hap/hr-runtime";

loadEnv({ path: resolve(process.cwd(), "apps/web/.env") });

const CAND_PORT = 4901;
const HR_PORT = 4902;

async function startServer(app: any, port: number): Promise<{ close: () => Promise<void> }> {
  return new Promise((res) => {
    const server = serve({ fetch: app.fetch, port }, () => {
      res({
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

async function main() {
  console.log("\n=== HAP demo interview ===\n");
  console.log(`candidate-agent : ${EXAMPLE_PROFILE.name} (port ${CAND_PORT})`);
  console.log(`hr-agent        : ${EXAMPLE_JD.title} (port ${HR_PORT})`);
  console.log(`llm provider    : ${process.env.OPENAI_API_KEY ? "openai" : process.env.ANTHROPIC_API_KEY ? "anthropic" : "none (template fallback)"}\n`);

  const candidate = buildCandidateApp({
    profile: EXAMPLE_PROFILE,
    publicUrl: `http://localhost:${CAND_PORT}`,
  });
  const hr = buildHrApp({
    jd: EXAMPLE_JD,
    hr: { ...EXAMPLE_HR, agent_url: `http://localhost:${HR_PORT}` },
    publicUrl: `http://localhost:${HR_PORT}`,
  });

  const candSrv = await startServer(candidate, CAND_PORT);
  const hrSrv = await startServer(hr, HR_PORT);

  try {
    const t0 = Date.now();
    const result = await runInterview({
      candidateAgentUrl: `http://localhost:${CAND_PORT}`,
      jd: EXAMPLE_JD,
      hr: { ...EXAMPLE_HR, agent_url: `http://localhost:${HR_PORT}` },
      numQuestions: 2,
      onMessage: (dir, msg) => {
        const arrow = dir === "out" ? "HR →" : "← cand";
        const kind = msg.kind.padEnd(20);
        let snippet = "";
        if (msg.kind === "hap.ask") snippet = msg.ask.prompt;
        else if (msg.kind === "hap.answer") snippet = `${msg.answer.confidence} · ${msg.answer.text}`;
        else if (msg.kind === "hap.session.close") snippet = `${msg.outcome} → ${msg.next_step}`;
        else if (msg.kind === "hap.session.decline") snippet = `${msg.reason} — ${msg.note ?? ""}`;
        console.log(`${arrow} ${kind} ${snippet.slice(0, 200)}`);
      },
    });
    console.log(`\nelapsed: ${Date.now() - t0}ms`);
    console.log(`status:  ${result.status}`);
    if (result.verdict) console.log(`verdict: ${result.verdict.outcome} — ${result.verdict.summary}`);
  } finally {
    await Promise.all([candSrv.close(), hrSrv.close()]);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

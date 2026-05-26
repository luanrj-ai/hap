/**
 * HTTP server for an HR-agent.
 *
 * Endpoints:
 *   GET  /.well-known/agent.json    A2A AgentCard
 *   POST /interview                  Body: { candidateAgentUrl } → runs full interview, returns transcript+verdict
 *   GET  /health                     liveness
 */
import { Hono } from "hono";
import { buildAgentCard } from "@hap/a2a-adapter";
import type { HapAgentCardInput } from "@hap/a2a-adapter";
import { runInterview } from "./interview";
import type { HrIdentity, JobDescription } from "./jd";

export interface HrServerConfig {
  jd: JobDescription;
  hr: HrIdentity;
  publicUrl: string;
}

export function buildApp(cfg: HrServerConfig): Hono {
  const app = new Hono();

  const cardInput: HapAgentCardInput = {
    name: cfg.hr.company ? `${cfg.hr.company} HR Agent` : "HR Agent",
    description: `Hiring for: ${cfg.jd.title}`,
    url: cfg.publicUrl,
    role: "hr",
    supportedEvidenceTypes: [
      "github_user", "github_repo", "talk", "blog_post",
      "paper", "package", "personal_site", "linkedin",
    ],
    humanContact: cfg.hr.human_contact,
  };
  const agentCard = buildAgentCard(cardInput);

  app.get("/health", (c) => c.json({ ok: true, role: "hr", jd_title: cfg.jd.title }));
  app.get("/.well-known/agent.json", (c) => c.json(agentCard));

  app.post("/interview", async (c) => {
    const body = (await c.req.json().catch(() => null)) as
      | { candidateAgentUrl?: string; numQuestions?: number }
      | null;
    if (!body?.candidateAgentUrl) {
      return c.json({ error: "candidateAgentUrl required" }, 400);
    }

    const transcript: Array<{ direction: "out" | "in"; msg: unknown }> = [];
    const result = await runInterview({
      candidateAgentUrl: body.candidateAgentUrl,
      jd: cfg.jd,
      hr: { ...cfg.hr, agent_url: cfg.publicUrl },
      numQuestions: body.numQuestions ?? 3,
      onMessage: (direction, msg) => {
        transcript.push({ direction, msg });
      },
    });

    return c.json({
      result: {
        sessionId: result.sessionId,
        candidateAgentUrl: result.candidateAgentUrl,
        status: result.status,
        elapsedMs: result.elapsedMs,
        verdict: result.verdict,
        errorReason: result.errorReason,
        declineReason: result.declineReason,
      },
      transcript,
    });
  });

  return app;
}

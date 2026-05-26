/**
 * HTTP server for a candidate-agent. Hono-based; runs on Node, Bun, or Edge.
 *
 * Endpoints:
 *   GET  /.well-known/agent.json     A2A AgentCard
 *   POST /agent/messages             HAP message inbox
 *   GET  /health                     liveness
 */
import { Hono } from "hono";
import { buildAgentCard, parseHapMessage } from "@hap/a2a-adapter";
import type { HapAgentCardInput } from "@hap/a2a-adapter";
import { handleAsk, handleSessionClose, handleSessionOpen } from "./handlers";
import type { CandidateProfile } from "./profile";

export interface ServerConfig {
  profile: CandidateProfile;
  /** Public URL where this agent is reachable. Used in AgentCard. */
  publicUrl: string;
}

export function buildApp(cfg: ServerConfig): Hono {
  const app = new Hono();

  const cardInput: HapAgentCardInput = {
    name: cfg.profile.name,
    description: cfg.profile.tagline ?? `${cfg.profile.name}'s HAP candidate agent`,
    url: cfg.publicUrl,
    role: "candidate",
    supportedEvidenceTypes: [
      "github_user", "github_repo", "github_commit", "github_pr",
      "talk", "blog_post", "paper", "package", "linkedin",
      "personal_site", "oss_maintainer",
    ],
    humanContact: cfg.profile.human_contact,
  };
  const agentCard = buildAgentCard(cardInput);

  app.get("/health", (c) => c.json({ ok: true, role: "candidate", name: cfg.profile.name }));

  app.get("/.well-known/agent.json", (c) => c.json(agentCard));

  app.post("/agent/messages", async (c) => {
    const body = await c.req.json().catch(() => null);
    const msg = parseHapMessage(body);
    if (!msg) {
      return c.json({ error: "invalid HAP message" }, 400);
    }

    switch (msg.kind) {
      case "hap.session.open": {
        const reply = handleSessionOpen(msg, cfg.profile);
        return c.json(reply);
      }
      case "hap.ask": {
        const reply = await handleAsk(msg, cfg.profile);
        return c.json(reply);
      }
      case "hap.session.close": {
        handleSessionClose(msg);
        return c.json({ ok: true });
      }
      default:
        return c.json({ error: `candidate-agent does not accept ${msg.kind}` }, 400);
    }
  });

  return app;
}

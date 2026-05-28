/**
 * The employer-side inbox for the candidate-initiated (L0) flow.
 *   GET  /posting.json      serve the static posting (so a candidate-agent can read it)
 *   POST <submit path>      accept a hap.application, store it, return a hap.receipt
 *   GET  /inbox             let the employer read what landed (+ score reports)
 *
 * It ACKs immediately, then — if `autoScore` is on — runs the neutral scorer in
 * the BACKGROUND (verification + scoring is slow; the candidate shouldn't block
 * on it). The employer reads the stored ScoreReport when it's ready. Await
 * `inbox.idle()` to wait for in-flight scoring (used in the demo/tests).
 */
import { Hono } from "hono";
import { parseAsyncHapMessage, type Application, type Posting, type Receipt } from "@hap/a2a-adapter";
import { scoreApplication, type ScoreReport } from "@resumetruth/scoring/score-application";

export interface InboxRecord {
  application: Application;
  receivedAt: string;
  /** Filled asynchronously once the neutral scorer finishes. */
  report?: ScoreReport;
  scoreError?: string;
}

export interface InboxConfig {
  posting: Posting;
  /** Override clock, for tests. */
  now?: () => Date;
  /** Run the neutral scorer in the background on receipt. Default false. */
  autoScore?: boolean;
  /** Override scorer (tests / custom registries). */
  scorer?: (app: Application, posting: Posting) => Promise<ScoreReport>;
}

export interface Inbox {
  app: Hono;
  /** Stored applications + their score reports. */
  records: InboxRecord[];
  /** Resolves when all in-flight background scoring has settled. */
  idle: () => Promise<void>;
}

export function buildInbox(cfg: InboxConfig): Inbox {
  const app = new Hono();
  const records: InboxRecord[] = [];
  const pending = new Set<Promise<void>>();
  const submitPath = new URL(cfg.posting.submit.endpoint).pathname || "/apply";
  const scorer = cfg.scorer ?? scoreApplication;

  app.get("/health", (c) => c.json({ ok: true, role: "inbox", posting_id: cfg.posting.posting_id }));

  app.get("/posting.json", (c) => c.json(cfg.posting));

  app.post(submitPath, async (c) => {
    const body = await c.req.json().catch(() => null);
    const msg = parseAsyncHapMessage(body);
    if (!msg || msg.kind !== "hap.application") {
      return c.json({ error: "expected a hap.application packet" }, 400);
    }
    if (msg.posting_ref.posting_id !== cfg.posting.posting_id) {
      return c.json({ error: `application is for posting ${msg.posting_ref.posting_id}, not ${cfg.posting.posting_id}` }, 409);
    }
    const duplicate = records.some((r) => r.application.application_id === msg.application_id);
    if (!duplicate) {
      const record: InboxRecord = { application: msg, receivedAt: (cfg.now?.() ?? new Date()).toISOString() };
      records.push(record);
      if (cfg.autoScore) {
        const p = scorer(msg, cfg.posting)
          .then((report) => { record.report = report; })
          .catch((err) => { record.scoreError = err instanceof Error ? err.message : String(err); })
          .finally(() => { pending.delete(p); });
        pending.add(p);
      }
    }

    const receipt: Receipt = {
      kind: "hap.receipt",
      hap_version: msg.hap_version,
      application_id: msg.application_id,
      received_at: (cfg.now?.() ?? new Date()).toISOString(),
      status: duplicate ? "duplicate" : "received",
      // Auto-scoring employers can act on the agent's report without a human.
      next: cfg.autoScore ? "agent_followup_possible" : "human_will_contact",
    };
    return c.json(receipt);
  });

  app.get("/inbox", (c) => c.json({ count: records.length, records }));

  return {
    app,
    records,
    idle: async () => {
      await Promise.allSettled([...pending]);
    },
  };
}

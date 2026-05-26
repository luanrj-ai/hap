/**
 * HAP v0.1 message schemas. Zod for runtime validation, JSON Schema for spec.
 *
 * All messages travel as A2A Message bodies. The `kind` field discriminates
 * which HAP message type this is. The full A2A envelope (sessionId,
 * messageId, parts, etc.) wraps these payloads.
 */
import { z } from "zod";

export const HAP_VERSION = "0.1.0" as const;

// ---- Evidence ----------------------------------------------------------

export const EvidenceTypeZ = z.enum([
  "github_user",
  "github_repo",
  "github_commit",
  "github_pr",
  "talk",
  "blog_post",
  "paper",
  "package",
  "linkedin",
  "personal_site",
  "oss_maintainer",
  "email_domain",
]);
export type EvidenceType = z.infer<typeof EvidenceTypeZ>;

export const EvidenceZ = z.object({
  type: EvidenceTypeZ,
  url: z.string().url(),
  note: z.string().max(200).optional(),
  venue: z.string().max(80).optional(),
  title: z.string().max(200).optional(),
});
export type Evidence = z.infer<typeof EvidenceZ>;

// ---- Session.Open ------------------------------------------------------

export const SessionOpenZ = z.object({
  kind: z.literal("hap.session.open"),
  session_id: z.string().min(8).max(64),
  jd: z.object({
    title: z.string().min(2).max(120),
    summary: z.string().max(500),
    must_have: z.array(z.string().max(120)).max(15),
    nice_to_have: z.array(z.string().max(120)).max(15).optional(),
    domain: z.string().max(40).optional(),
    external_url: z.string().url().optional(),
  }),
  from: z.object({
    agent_url: z.string().url(),
    company: z.string().max(120).optional(),
    human_contact: z.string().max(120).optional(),
  }),
});
export type SessionOpen = z.infer<typeof SessionOpenZ>;

// ---- Session.Accept / Decline ------------------------------------------

export const SessionAcceptZ = z.object({
  kind: z.literal("hap.session.accept"),
  session_id: z.string(),
});
export type SessionAccept = z.infer<typeof SessionAcceptZ>;

export const SessionDeclineZ = z.object({
  kind: z.literal("hap.session.decline"),
  session_id: z.string(),
  reason: z.enum([
    "not_seeking",
    "domain_mismatch",
    "rate_limited",
    "policy_block",
    "other",
  ]),
  note: z.string().max(200).optional(),
});
export type SessionDecline = z.infer<typeof SessionDeclineZ>;

// ---- Ask / Answer ------------------------------------------------------

export const AskZ = z.object({
  kind: z.literal("hap.ask"),
  session_id: z.string(),
  question_id: z.string().max(40),
  ask: z.object({
    type: z.enum(["open", "scored", "yes_no", "evidence_request"]),
    prompt: z.string().max(2000),
    evidence_preference: z.array(EvidenceTypeZ).max(6).optional(),
  }),
});
export type Ask = z.infer<typeof AskZ>;

export const AnswerZ = z.object({
  kind: z.literal("hap.answer"),
  session_id: z.string(),
  question_id: z.string(),
  answer: z.object({
    text: z.string().max(4000),
    evidence: z.array(EvidenceZ).max(8),
    confidence: z.enum(["low", "medium", "high"]),
    decline_reason: z
      .enum(["private", "not_applicable", "no_evidence", "out_of_scope"])
      .nullable()
      .optional(),
  }),
});
export type Answer = z.infer<typeof AnswerZ>;

// ---- Session.Close -----------------------------------------------------

export const SessionCloseZ = z.object({
  kind: z.literal("hap.session.close"),
  session_id: z.string(),
  outcome: z.enum(["fit", "no_fit", "unclear", "candidate_declined"]),
  summary: z.string().max(500),
  next_step: z.enum([
    "human_follow_up",
    "schedule_human_interview",
    "archive",
  ]),
});
export type SessionClose = z.infer<typeof SessionCloseZ>;

// ---- Discriminated union ----------------------------------------------

export const HapMessageZ = z.discriminatedUnion("kind", [
  SessionOpenZ,
  SessionAcceptZ,
  SessionDeclineZ,
  AskZ,
  AnswerZ,
  SessionCloseZ,
]);
export type HapMessage = z.infer<typeof HapMessageZ>;

/** Verify a raw object is a valid HAP message. */
export function parseHapMessage(raw: unknown): HapMessage | null {
  const r = HapMessageZ.safeParse(raw);
  return r.success ? r.data : null;
}

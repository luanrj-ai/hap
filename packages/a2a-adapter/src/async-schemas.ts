/**
 * HAP v0.2 (DRAFT) — async, store-and-forward, symmetric-initiation schemas.
 *
 * Why this exists
 * ---------------
 * v0.1 (./schemas.ts) is synchronous and HR-driven: the HR-agent POSTs into a
 * live candidate-agent HTTP server and blocks for each reply. That forces the
 * candidate to host an always-on, publicly-reachable server — the single
 * biggest cold-start tax, and it contradicts the spec's own "federated like
 * SMTP" claim.
 *
 * v0.2 decouples two axes that v0.1 welded together:
 *   - WHO EVALUATES / WHO PROVES  (unchanged: HR asks, candidate answers)
 *   - WHO INITIATES               (either side — "双向皆可运行")
 *
 * The two real flows, both on the messages below:
 *   1. candidate-initiated  ("apply")   — HR publishes a Posting; candidate's
 *      agent answers the rubric with evidence and POSTs an Application to the
 *      Posting's inbox. HR needs only a dumb inbox + a static posting.
 *   2. hr-initiated         ("source")  — candidate publishes a ProfileCard;
 *      HR's agent reaches out. (sketched here, fleshed out once a real
 *      recruiter shows up — see ProfileCardZ.)
 *
 * Transport is async store-and-forward: the initiator is outbound-active, the
 * other side only needs an inbox or a published static artifact and need NOT
 * be online. The live synchronous interview from v0.1 (Ask/Answer/SessionClose)
 * becomes the OPTIONAL L1 upgrade once both parties run an agent — those types
 * are reused as-is, threaded by `application_id`.
 *
 * This file reuses v0.1 inner shapes via `.shape` so the two versions can't
 * drift. Nothing imports it yet; wiring into index.ts is a follow-up after the
 * schema is approved.
 */
import { z } from "zod";
import { AskZ, AnswerZ, EvidenceZ, SessionOpenZ } from "./schemas";

export const HAP_DRAFT_VERSION = "0.2.0-draft" as const;

const IdZ = z.string().min(8).max(64);

// ---- Published rubric ask ---------------------------------------------
// A question published statically inside a Posting. Same inner `ask` body as
// v0.1's AskZ, minus the session_id (no session exists at publish time), plus
// hints the candidate-agent uses to prioritise and to decline honestly.

export const PublishedAskZ = z.object({
  question_id: AskZ.shape.question_id, // reuse v0.1 constraint
  ask: AskZ.shape.ask, // reuse v0.1 ask body (type/prompt/evidence_preference)
  required: z.boolean().default(true), // maps must_have (true) vs nice_to_have (false)
  weight: z.number().min(0).max(1).optional(), // relative importance, for scoring
});
export type PublishedAsk = z.infer<typeof PublishedAskZ>;

// ---- hap.posting ------------------------------------------------------
// Static, public, published by the HR side. The candidate-agent fetches this
// (URL or Markdown+JSON file) and answers it. HR runs NO agent to publish one.

export const PostingZ = z.object({
  kind: z.literal("hap.posting"),
  hap_version: z.string().default(HAP_DRAFT_VERSION),
  posting_id: IdZ,
  jd: SessionOpenZ.shape.jd, // reuse v0.1 JD shape verbatim
  rubric: z.array(PublishedAskZ).min(1).max(15),
  /** Where an Application packet is delivered. The "dumb inbox". */
  submit: z.object({
    endpoint: z.string().url(), // https POST target, or a mailto: for email transport
    transport: z.enum(["https", "mailto"]).default("https"),
    public_key: z.string().max(2000).optional(), // optional, for signed/encrypted packets later
  }),
  from: z.object({
    company: z.string().max(120).optional(),
    human_contact: z.string().max(120).optional(),
    agent_url: z.string().url().optional(), // OPTIONAL now — HR may have no agent
  }),
  /** Which initiation flows this posting accepts. */
  flows: z
    .array(z.enum(["candidate_initiated", "hr_initiated"]))
    .default(["candidate_initiated"]),
  expires_at: z.string().datetime().optional(),
});
export type Posting = z.infer<typeof PostingZ>;

// ---- Application response ---------------------------------------------
// One answered rubric item. Identical inner body to v0.1's AnswerZ.answer.

export const ApplicationResponseZ = z.object({
  question_id: z.string().max(40),
  answer: AnswerZ.shape.answer, // reuse v0.1 answer body (text/evidence/confidence/decline_reason)
});
export type ApplicationResponse = z.infer<typeof ApplicationResponseZ>;

// ---- hap.application --------------------------------------------------
// Candidate → HR inbox, one async outbound packet. This is the reversed,
// bundled equivalent of v0.1's (session.open + N answers). `application_id`
// doubles as the thread id for any L1 follow-up.

export const ApplicationZ = z.object({
  kind: z.literal("hap.application"),
  hap_version: z.string().default(HAP_DRAFT_VERSION),
  application_id: IdZ, // candidate-generated (ULID)
  posting_ref: z.object({
    posting_id: IdZ,
    posting_url: z.string().url().optional(),
  }),
  candidate: z.object({
    name: z.string().min(2).max(120),
    /** Private contact — the payoff of "不必公开求职": only this employer sees it. */
    human_contact: z.string().max(200),
    agent_url: z.string().url().optional(), // present only if candidate runs an L1 agent
    /** Standing identity anchor: github_user / personal_site / etc. */
    profile_evidence: z.array(EvidenceZ).max(6).optional(),
    /**
     * Optional proof that the candidate CONTROLS the identity anchor (not just
     * cites it). v0: a public GitHub gist owned by the anchor account carrying
     * a `HAP-PROOF` marker. Lifts the anchor from "asserted" to "proven" — you
     * can no longer claim someone else's GitHub account as your identity.
     */
    proof_of_control: z
      .object({ method: z.literal("github_gist"), url: z.string().url() })
      .optional(),
  }),
  responses: z.array(ApplicationResponseZ).max(15),
  /** Evidence the candidate volunteered beyond the rubric. */
  extra_evidence: z.array(EvidenceZ).max(8).optional(),
  self_assessment: z
    .object({
      fit: z.enum(["strong", "plausible", "stretch"]),
      note: z.string().max(500).optional(), // short cover note
    })
    .optional(),
  disclosure: z.object({
    /** When HR may read `human_contact`. Progressive-disclosure knob. */
    contact_release: z
      .enum(["on_submit", "on_employer_interest"])
      .default("on_submit"),
    /** May HR forward/share this packet beyond the hiring team. */
    public: z.boolean().default(false),
  }),
});
export type Application = z.infer<typeof ApplicationZ>;

// ---- hap.receipt ------------------------------------------------------
// HR inbox → candidate, async ACK. The inbox can be dumb: store + return this.

export const ReceiptZ = z.object({
  kind: z.literal("hap.receipt"),
  hap_version: z.string().default(HAP_DRAFT_VERSION),
  application_id: IdZ, // echoes the Application
  received_at: z.string().datetime(),
  status: z.enum(["received", "rejected", "duplicate"]),
  /** What happens next, so the candidate-agent knows whether to wait. */
  next: z
    .enum(["human_will_contact", "agent_followup_possible", "none"])
    .default("none"),
  note: z.string().max(200).optional(),
});
export type Receipt = z.infer<typeof ReceiptZ>;

// ---- hap.profile (HR-initiated entry point, SKETCH) -------------------
// Mirror of Posting for the "source/headhunt" flow: a candidate publishes this
// static card so an HR-agent can find and reach out. Kept minimal on purpose —
// candidate-initiated ships first; this proves the schema doesn't foreclose
// "双向皆可运行". Flesh out (standing answers? rate limits?) when a real
// recruiter-initiated case appears.

export const ProfileCardZ = z.object({
  kind: z.literal("hap.profile"),
  hap_version: z.string().default(HAP_DRAFT_VERSION),
  candidate: z.object({
    name: z.string().min(2).max(120),
    headline: z.string().max(200).optional(),
    profile_evidence: z.array(EvidenceZ).max(12),
    /** Where an HR-agent delivers a session.open / asks. The candidate's inbox. */
    inbox: z.object({
      endpoint: z.string().url(),
      transport: z.enum(["https", "mailto"]).default("https"),
    }),
    /** Coarse routing so HR doesn't spam off-target asks. */
    open_to: z.array(z.string().max(40)).max(15).optional(),
    rate_limit: z
      .object({ per_day: z.number().int().positive().optional() })
      .optional(),
  }),
});
export type ProfileCard = z.infer<typeof ProfileCardZ>;

// ---- Async message union + parser -------------------------------------

export const AsyncHapMessageZ = z.discriminatedUnion("kind", [
  PostingZ,
  ApplicationZ,
  ReceiptZ,
  ProfileCardZ,
]);
export type AsyncHapMessage = z.infer<typeof AsyncHapMessageZ>;

/** Verify a raw object is a valid v0.2 async HAP message. */
export function parseAsyncHapMessage(raw: unknown): AsyncHapMessage | null {
  const r = AsyncHapMessageZ.safeParse(raw);
  return r.success ? r.data : null;
}

// NOTE — L1 (optional live follow-up) reuses v0.1 verbatim:
//   HR → candidate.agent_url : hap.ask        (schemas.ts AskZ)
//   candidate → HR           : hap.answer     (schemas.ts AnswerZ)
//   HR → candidate           : hap.session.close (schemas.ts SessionCloseZ)
// thread these by passing application_id as the v0.1 `session_id`.
// (v0.1's HAP_VERSION stays available via "./schemas" through the package root.)

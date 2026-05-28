/**
 * Candidate-initiated apply (HAP v0.2 draft, "reversed" flow).
 *
 * This is the orchestration that used to live in hr-runtime's runInterview —
 * but driven by the candidate. The candidate-agent:
 *   1. reads a static Posting (JD + published rubric)
 *   2. answers each rubric item with cited evidence (reuses v0.1 handleAsk)
 *   3. bundles them into one hap.application
 *   4. POSTs it outbound to the posting's submit endpoint (a dumb inbox)
 *   5. reads the hap.receipt
 *
 * No server to host on the candidate side: this runs once and exits. The
 * employer only needs an inbox + a published posting.
 */
import {
  type Ask,
  type Application,
  type ApplicationResponse,
  type Evidence,
  type Posting,
  type Receipt,
  ApplicationZ,
  HAP_DRAFT_VERSION,
  parseAsyncHapMessage,
} from "@hap/a2a-adapter";
import { handleAsk } from "./handlers";
import type { CandidateProfile } from "./profile";

/** Evidence types that anchor identity (vs. answer-specific evidence). */
const IDENTITY_TYPES = new Set<Evidence["type"]>([
  "github_user",
  "personal_site",
  "linkedin",
  "oss_maintainer",
]);

function genApplicationId(): string {
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Honest self-assessment from how the rubric actually got answered. */
function deriveFit(responses: ApplicationResponse[]): "strong" | "plausible" | "stretch" {
  const declined = responses.filter((r) => r.answer.decline_reason).length;
  const high = responses.filter((r) => !r.answer.decline_reason && r.answer.confidence === "high").length;
  if (declined > responses.length / 2) return "stretch";
  if (declined === 0 && high >= Math.ceil(responses.length / 2)) return "strong";
  return "plausible";
}

export interface BuildOptions {
  profile: CandidateProfile;
  posting: Posting;
  /** Streaming hook, called once per answered rubric item. */
  onAnswer?: (questionId: string, resp: ApplicationResponse) => void;
}

/**
 * Steps 1–3: answer the rubric with evidence and assemble (but DON'T send) the
 * hap.application. This is what the candidate reviews before anything leaves
 * the machine — the privacy-control surface of the "preview & confirm" step.
 */
export async function buildApplication(opts: BuildOptions): Promise<Application> {
  const { profile, posting } = opts;
  const application_id = genApplicationId();

  const responses: ApplicationResponse[] = [];
  for (const pa of posting.rubric) {
    const ask: Ask = {
      kind: "hap.ask",
      session_id: application_id, // application_id doubles as the thread id
      question_id: pa.question_id,
      ask: pa.ask,
    };
    const answer = await handleAsk(ask, profile);
    const resp: ApplicationResponse = { question_id: pa.question_id, answer: answer.answer };
    responses.push(resp);
    opts.onAnswer?.(pa.question_id, resp);
  }

  const profileEvidence = profile.evidenceSources.filter((e) => IDENTITY_TYPES.has(e.type)).slice(0, 6);

  // parse through the schema so defaults apply and it's validated
  return ApplicationZ.parse({
    kind: "hap.application",
    hap_version: HAP_DRAFT_VERSION,
    application_id,
    posting_ref: { posting_id: posting.posting_id, posting_url: posting.submit.endpoint },
    candidate: {
      name: profile.name,
      human_contact: profile.human_contact ?? "",
      profile_evidence: profileEvidence.length ? profileEvidence : undefined,
      proof_of_control: profile.proof_of_control,
    },
    responses,
    self_assessment: { fit: deriveFit(responses) },
    disclosure: { contact_release: "on_submit", public: false },
  });
}

export interface SubmitResult {
  receipt: Receipt | null;
  error?: string;
}

/** Step 4–5: POST the (already-reviewed) application to the posting's inbox. */
export async function submitApplication(
  application: Application,
  posting: Posting,
  fetchImpl?: typeof fetch,
): Promise<SubmitResult> {
  const doFetch = fetchImpl ?? fetch;
  try {
    const res = await doFetch(posting.submit.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(application),
    });
    const raw = (await res.json().catch(() => null)) as unknown;
    const msg = parseAsyncHapMessage(raw);
    const receipt = msg && msg.kind === "hap.receipt" ? msg : null;
    return { receipt, error: receipt ? undefined : `inbox returned ${res.status} with no valid receipt` };
  } catch (err) {
    return { receipt: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface ApplyOptions extends BuildOptions {
  /** Injectable transport — defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface ApplyResult {
  application: Application;
  receipt: Receipt | null;
  error?: string;
}

/** Build + submit in one shot (no review step). */
export async function applyToPosting(opts: ApplyOptions): Promise<ApplyResult> {
  const application = await buildApplication(opts);
  const { receipt, error } = await submitApplication(application, opts.posting, opts.fetchImpl);
  return { application, receipt, error };
}

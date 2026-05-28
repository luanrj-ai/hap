/**
 * Apply across multiple target postings, ranked by candidate-side match.
 *
 * Two modes (the agreed product behaviour):
 *   - "list"  : rank the targets and return them — the agent RECOMMENDS, the
 *               candidate then applies to the ones they pick.
 *   - "auto"  : the candidate opted into full automation — apply to everything
 *               at/above `threshold`, highest match first, up to `cap`, skipping
 *               postings already applied to. Threshold + cap + the dedupe ledger
 *               are the guardrails that keep auto-apply from becoming spam.
 *
 * Reuses buildApplication / submitApplication (so each application still carries
 * verified evidence and is scored on the employer side).
 */
import { PostingZ, type Posting, type Receipt } from "@hap/a2a-adapter";
import type { CandidateProfile } from "./profile";
import { buildApplication, submitApplication } from "./apply";
import { estimateMatch } from "./match";

export interface TargetResult {
  url: string;
  posting_id?: string;
  title?: string;
  match: number;
  applied: boolean;
  skipped?: string;
  receipt?: Receipt | null;
  error?: string;
}

export interface ApplyTargetsOptions {
  profile: CandidateProfile;
  postingUrls: string[];
  mode: "list" | "auto";
  /** auto: apply when match >= threshold (default 0.5). */
  threshold?: number;
  /** auto: max applications this run (default 5). */
  cap?: number;
  /** posting_ids already applied to (cooldown / dedupe). */
  alreadyApplied?: Set<string>;
  fetchImpl?: typeof fetch;
}

export async function applyToTargets(opts: ApplyTargetsOptions): Promise<TargetResult[]> {
  const f = opts.fetchImpl ?? fetch;
  const threshold = opts.threshold ?? 0.5;
  const cap = opts.cap ?? 5;
  const already = opts.alreadyApplied ?? new Set<string>();

  // 1. fetch each posting + estimate match
  const fetched: Array<{ result: TargetResult; posting?: Posting }> = [];
  for (const url of opts.postingUrls) {
    try {
      const posting = PostingZ.parse(await f(url).then((r) => r.json()));
      fetched.push({
        result: { url, posting_id: posting.posting_id, title: posting.jd.title, match: estimateMatch(opts.profile, posting).score, applied: false },
        posting,
      });
    } catch (err) {
      fetched.push({ result: { url, match: 0, applied: false, error: err instanceof Error ? err.message : String(err) } });
    }
  }

  // 2. rank by match desc
  fetched.sort((a, b) => b.result.match - a.result.match);

  // 3. list mode: just the ranking
  if (opts.mode === "list") return fetched.map((x) => x.result);

  // 4. auto mode: apply with guardrails
  let applied = 0;
  for (const { result, posting } of fetched) {
    if (result.error || !posting) continue;
    if (result.posting_id && already.has(result.posting_id)) { result.skipped = "already applied"; continue; }
    if (result.match < threshold) { result.skipped = `below threshold (${result.match} < ${threshold})`; continue; }
    if (applied >= cap) { result.skipped = "rate cap reached"; continue; }

    const application = await buildApplication({ profile: opts.profile, posting });
    const { receipt, error } = await submitApplication(application, posting, f);
    result.applied = !!receipt;
    result.receipt = receipt;
    if (error) result.error = error;
    if (receipt) applied++;
  }
  return fetched.map((x) => x.result);
}

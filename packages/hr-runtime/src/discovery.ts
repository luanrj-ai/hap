/**
 * Discovery index — the single-player → multiplayer bridge (P3).
 *
 * Web/Google model (NOT P2P): candidates own their verifiable hap.profile and
 * opt in by publishing it; this central index verifies the cited evidence,
 * ranks on what's VERIFIED (self-reported cc_footprint never counts), and lets
 * recruiters search. Anti-abuse is enforced HERE, centrally — which is exactly
 * why a central index beats P2P for this:
 *   - search requires a recruiter identity; rate-limited per recruiter; blocklist
 *   - contact is NOT in search results — a recruiter must request it, and that
 *     is gated by the candidate's own rate_limit (progressive disclosure)
 *   - publishing is the candidate's opt-in; they can unpublish
 */
import { Hono } from "hono";
import { ProfileCardZ, type Evidence, type ProfileCard } from "@hap/a2a-adapter";
import {
  verifyEvidence,
  verifyProofOfControl,
  type IdentityAnchor,
  type ProofOfControl,
  type ProofResult,
  type VerificationResult,
} from "@resumetruth/scoring/score-application";

export interface VerifiedProfile {
  identityProven: boolean;
  verifiedEvidence: number;
  totalEvidence: number;
  /** Ranking signal — verified evidence + identity bonus. cc_footprint excluded. */
  rankSignal: number;
  note: string;
}

export interface VerifyProfileOptions {
  verify?: (ev: Evidence, anchor: IdentityAnchor) => Promise<VerificationResult>;
  verifyProof?: (poc: ProofOfControl, anchor: IdentityAnchor) => Promise<ProofResult>;
}

function loginOf(profile: ProfileCard): string | undefined {
  const gh = profile.candidate.profile_evidence.find((e) => e.type === "github_user");
  return gh?.url.match(/github\.com\/([^/]+)/i)?.[1];
}

export async function verifyProfile(profile: ProfileCard, opts: VerifyProfileOptions = {}): Promise<VerifiedProfile> {
  const verify = opts.verify ?? verifyEvidence;
  const anchor: IdentityAnchor = { githubLogin: loginOf(profile), name: profile.candidate.name };

  let verified = 0;
  for (const e of profile.candidate.profile_evidence) {
    const r = await verify(e, anchor);
    if (r.level === "verified") verified++;
  }

  let identityProven = false;
  if (profile.candidate.proof_of_control) {
    const pr = await (opts.verifyProof ?? verifyProofOfControl)(profile.candidate.proof_of_control, anchor);
    identityProven = pr.proven;
  }

  const total = profile.candidate.profile_evidence.length;
  return {
    identityProven,
    verifiedEvidence: verified,
    totalEvidence: total,
    rankSignal: verified + (identityProven ? 2 : 0),
    note: `${verified}/${total} verified${identityProven ? ", identity proven" : ""}`,
  };
}

export interface RecruiterCtx {
  /** Recruiter identity, e.g. a company domain. v1: presence = identified. */
  id: string;
}

export interface SearchHit {
  key: string;
  name: string;
  headline?: string;
  specializations?: string[];
  open_to?: string[];
  verified: VerifiedProfile;
  /** Public evidence only — contact is never in search results. */
  evidence: Evidence[];
}

interface IndexEntry {
  key: string;
  profile: ProfileCard;
  verified: VerifiedProfile;
  verifiedAt: string;
}

export interface DiscoveryOptions {
  verifyOpts?: VerifyProfileOptions;
  now?: () => number;
  /** Max searches per recruiter per minute. */
  searchPerMin?: number;
}

export class DiscoveryIndex {
  private entries = new Map<string, IndexEntry>();
  private searchHits = new Map<string, number[]>();
  private contactHits = new Map<string, number[]>();
  private blocked = new Set<string>();

  constructor(private opts: DiscoveryOptions = {}) {}
  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  /** Candidate opt-in: verify the profile's evidence and store it. */
  async publish(raw: unknown): Promise<{ ok: boolean; key?: string; verified?: VerifiedProfile; error?: string }> {
    const parsed = ProfileCardZ.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "invalid hap.profile" };
    const profile = parsed.data;
    const key = loginOf(profile)?.toLowerCase();
    if (!key) return { ok: false, error: "profile needs a github_user anchor to be indexed" };
    const verified = await verifyProfile(profile, this.opts.verifyOpts);
    this.entries.set(key, { key, profile, verified, verifiedAt: new Date(this.now()).toISOString() });
    return { ok: true, key, verified };
  }

  unpublish(key: string): void {
    this.entries.delete(key.toLowerCase());
  }

  block(recruiterId: string): void {
    this.blocked.add(recruiterId);
  }

  size(): number {
    return this.entries.size;
  }

  search(query: { q?: string; openTo?: string }, recruiter: RecruiterCtx | null): { ok: boolean; hits?: SearchHit[]; error?: string } {
    if (!recruiter?.id) return { ok: false, error: "recruiter identity required to search" };
    if (this.blocked.has(recruiter.id)) return { ok: false, error: "recruiter blocked" };

    const perMin = this.opts.searchPerMin ?? 60;
    const recent = (this.searchHits.get(recruiter.id) ?? []).filter((t) => t > this.now() - 60_000);
    if (recent.length >= perMin) return { ok: false, error: "search rate limit exceeded" };
    recent.push(this.now());
    this.searchHits.set(recruiter.id, recent);

    const terms = (query.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const openTo = query.openTo?.toLowerCase();
    const hits: SearchHit[] = [];
    for (const e of this.entries.values()) {
      const c = e.profile.candidate;
      const corpus = [c.name, c.headline ?? "", ...(c.specializations ?? []), ...c.profile_evidence.map((x) => `${x.note ?? ""} ${x.url}`)]
        .join(" ")
        .toLowerCase();
      if (terms.length && !terms.every((t) => corpus.includes(t))) continue;
      if (openTo && !(c.open_to ?? []).some((o) => o.toLowerCase().includes(openTo))) continue;
      hits.push({
        key: e.key,
        name: c.name,
        headline: c.headline,
        specializations: c.specializations,
        open_to: c.open_to,
        verified: e.verified,
        evidence: c.profile_evidence,
      });
    }
    hits.sort((a, b) => b.verified.rankSignal - a.verified.rankSignal);
    return { ok: true, hits };
  }

  /** Contact is gated: recruiter identified + not blocked + candidate's own daily cap. */
  requestContact(candidateKey: string, recruiter: RecruiterCtx | null): { ok: boolean; contact?: string; error?: string } {
    if (!recruiter?.id) return { ok: false, error: "recruiter identity required" };
    if (this.blocked.has(recruiter.id)) return { ok: false, error: "recruiter blocked" };
    const e = this.entries.get(candidateKey.toLowerCase());
    if (!e) return { ok: false, error: "candidate not found" };

    const perDay = e.profile.candidate.rate_limit?.per_day ?? 10;
    const log = (this.contactHits.get(e.key) ?? []).filter((t) => t > this.now() - 86_400_000);
    if (log.length >= perDay) return { ok: false, error: "candidate's daily contact limit reached" };
    log.push(this.now());
    this.contactHits.set(e.key, log);

    const contact = e.profile.candidate.inbox?.endpoint;
    if (!contact) return { ok: false, error: "candidate exposed no contact channel" };
    return { ok: true, contact };
  }
}

/** HTTP wrapper. Recruiter identity travels in the `X-HAP-Recruiter` header. */
export function buildDiscoveryApp(index: DiscoveryIndex): Hono {
  const app = new Hono();
  const recruiter = (c: { req: { header: (k: string) => string | undefined } }): RecruiterCtx | null => {
    const id = c.req.header("x-hap-recruiter");
    return id ? { id } : null;
  };

  app.get("/health", (c) => c.json({ ok: true, role: "discovery-index", indexed: index.size() }));

  app.post("/publish", async (c) => {
    const body = await c.req.json().catch(() => null);
    const r = await index.publish(body);
    return c.json(r, r.ok ? 200 : 400);
  });

  app.get("/search", (c) => {
    const r = index.search({ q: c.req.query("q"), openTo: c.req.query("open_to") }, recruiter(c));
    return c.json(r, r.ok ? 200 : r.error?.includes("identity") ? 401 : 429);
  });

  app.post("/contact", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { candidate?: string };
    if (!body.candidate) return c.json({ ok: false, error: "body.candidate (key) required" }, 400);
    const r = index.requestContact(body.candidate, recruiter(c));
    return c.json(r, r.ok ? 200 : 403);
  });

  return app;
}

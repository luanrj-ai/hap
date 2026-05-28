/**
 * Offline tests for P3 (discovery index).
 *
 *   npx tsx scripts/test-discovery.ts
 *
 * Verification is mocked (evidence.title encodes its level; proof always proven)
 * so the index logic is asserted with no network: verified-signal ranking,
 * search requires a recruiter + is rate-limited, contact is gated by the
 * candidate's own rate_limit, and a blocked recruiter is refused.
 */
import { DiscoveryIndex, type VerifyProfileOptions } from "@hap/hr-runtime";
import type { Evidence } from "@hap/a2a-adapter";

const verifyOpts: VerifyProfileOptions = {
  verify: async (ev: Evidence) => ({ level: (ev.title as "verified" | "exists_unlinked" | "unverifiable" | "fabricated") ?? "exists_unlinked", facts: "", note: "mock" }),
  verifyProof: async () => ({ proven: true, note: "mock proof" }),
};

// evidence whose `title` encodes the mock verification level
const ev = (type: Evidence["type"], login: string, level: string, repo?: string): Evidence => ({
  type,
  url: repo ? `https://github.com/${login}/${repo}` : `https://github.com/${login}`,
  title: level,
});

function profile(login: string, name: string, opts: { evidence: Evidence[]; proof?: boolean; openTo?: string[]; perDay?: number; specializations?: string[] }) {
  return {
    kind: "hap.profile",
    candidate: {
      name,
      specializations: opts.specializations,
      profile_evidence: opts.evidence,
      ...(opts.proof ? { proof_of_control: { method: "github_gist", url: `https://gist.github.com/${login}/0123456789abcdef0123456789abcdef` } } : {}),
      inbox: { endpoint: `mailto:${login}@example.com`, transport: "mailto" },
      open_to: opts.openTo,
      rate_limit: opts.perDay ? { per_day: opts.perDay } : undefined,
    },
  };
}

const alice = profile("alice", "Alice", { evidence: [ev("github_user", "alice", "verified"), ev("github_repo", "alice", "verified", "rust-sim")], proof: true, openTo: ["backend"], specializations: ["rust"], perDay: 1 });
const bob = profile("bob", "Bob", { evidence: [ev("github_user", "bob", "verified")], openTo: ["backend"], specializations: ["rust"] });
const carol = profile("carol", "Carol", { evidence: [ev("github_user", "carol", "exists_unlinked")], specializations: ["python"] });

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}  ${d}`); } };

async function main() {
  const idx = new DiscoveryIndex({ verifyOpts });
  const pa = await idx.publish(alice);
  await idx.publish(bob);
  await idx.publish(carol);
  check("publish: alice verified 2 + identity proven", pa.ok === true && pa.verified?.verifiedEvidence === 2 && pa.verified?.identityProven === true, JSON.stringify(pa.verified));
  check("index size 3", idx.size() === 3, `got ${idx.size()}`);

  const r = idx.search({}, { id: "acme.com" });
  check("search ranked: alice(4) > bob(1) > carol(0)", r.ok === true && r.hits![0].key === "alice" && r.hits![1].key === "bob" && r.hits![2].key === "carol", JSON.stringify(r.hits?.map((h) => [h.key, h.verified.rankSignal])));
  check("search hits carry NO contact field", r.ok === true && r.hits!.every((h) => !("contact" in h) && !("inbox" in h)));

  const rq = idx.search({ q: "rust" }, { id: "acme.com" });
  check("search q=rust → alice & bob only", rq.ok === true && rq.hits!.length === 2 && rq.hits!.every((h) => h.key !== "carol"), JSON.stringify(rq.hits?.map((h) => h.key)));

  check("search without recruiter → refused", idx.search({}, null).ok === false);

  // rate limit
  const rl = new DiscoveryIndex({ verifyOpts, searchPerMin: 2 });
  await rl.publish(bob);
  rl.search({}, { id: "x.com" });
  rl.search({}, { id: "x.com" });
  check("search rate limit kicks in", rl.search({}, { id: "x.com" }).ok === false);

  // contact gating: alice per_day = 1
  check("contact #1 ok (returns mailto)", idx.requestContact("alice", { id: "acme.com" }).contact === "mailto:alice@example.com");
  check("contact #2 hits candidate daily cap", idx.requestContact("alice", { id: "acme.com" }).ok === false);
  check("contact without recruiter → refused", idx.requestContact("bob", null).ok === false);

  // reputation: blocked recruiter
  idx.block("spammer.com");
  check("blocked recruiter can't search", idx.search({}, { id: "spammer.com" }).ok === false);
  check("blocked recruiter can't contact", idx.requestContact("bob", { id: "spammer.com" }).ok === false);

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

/**
 * Offline regression test for the neutral scorer.
 *
 *   npx tsx scripts/test-scorer.ts
 *
 * Injects a mock verifier (so no network / GitHub rate limits) and asserts the
 * scoring math, gating, and flags. Each evidence carries its intended outcome:
 *   title = verification level, note = the "facts" string fed to relevance.
 */
import { PostingZ, ApplicationZ, type Evidence } from "@hap/a2a-adapter";
import { scoreApplication, type VerificationResult } from "@resumetruth/scoring";

const mockVerify = async (ev: Evidence): Promise<VerificationResult> => {
  const level = ev.title as VerificationResult["level"];
  const facts = level === "unverifiable" || level === "fabricated" ? "" : ev.note ?? "";
  return { level, facts, note: "mock" };
};
const opts = { noLLM: true as const, verify: mockVerify };

function posting() {
  return PostingZ.parse({
    kind: "hap.posting", posting_id: "test-posting-1",
    jd: { title: "Test Role", summary: "test", must_have: ["a", "b"], nice_to_have: ["c"] },
    rubric: [
      { question_id: "m1", ask: { type: "open", prompt: "Show evidence for: distributed systems consensus protocols. Cite." }, required: true },
      { question_id: "m2", ask: { type: "open", prompt: "Show evidence for: rust async runtime internals. Cite." }, required: true },
      { question_id: "n1", ask: { type: "open", prompt: "Show evidence for: open source community leadership. Cite." }, required: false },
    ],
    submit: { endpoint: "https://e.com/apply" }, from: { company: "x" },
  });
}

function ev(level: string, facts: string): Evidence {
  return { type: "github_repo", url: `https://x/${level}/${Math.random()}`, title: level, note: facts };
}

function app(
  responses: Array<{ qid: string; evidence: Evidence[]; decline?: string }>,
  selfFit?: "strong" | "plausible" | "stretch",
  pocUrl?: string,
) {
  return ApplicationZ.parse({
    kind: "hap.application", application_id: "app_test_00001",
    posting_ref: { posting_id: "test-posting-1" },
    candidate: {
      name: "Tester", human_contact: "t@e.com",
      profile_evidence: [{ type: "github_user", url: "https://github.com/torvalds" }],
      ...(pocUrl ? { proof_of_control: { method: "github_gist", url: pocUrl } } : {}),
    },
    responses: responses.map((r) => ({
      question_id: r.qid,
      answer: { text: "x", evidence: r.evidence, confidence: "high", decline_reason: (r.decline as never) ?? null },
    })),
    ...(selfFit ? { self_assessment: { fit: selfFit } } : {}),
    disclosure: {},
  });
}

const GIST = "https://gist.github.com/torvalds/0123456789abcdef0123456789abcdef";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}  ${detail}`); }
}

async function main() {
  const P = posting();

  // A — fit: both required verified+strong (1.0), nice unlinked+partial (0.3)
  const a = await scoreApplication(app([
    { qid: "m1", evidence: [ev("verified", "distributed systems consensus protocols")] },
    { qid: "m2", evidence: [ev("verified", "rust async runtime internals")] },
    { qid: "n1", evidence: [ev("exists_unlinked", "community")] },
  ]), P, opts);
  check("A verdict=fit", a.verdict === "fit", `got ${a.verdict}`);
  check("A overall≈0.79", Math.abs(a.overall - 0.79) < 0.02, `got ${a.overall}`);
  check("A m1 score=1.0", a.items[0].score === 1.0, `got ${a.items[0].score}`);
  check("A n1 score=0.3", a.items[2].score === 0.3, `got ${a.items[2].score}`);

  // B — required gate: m2 only partial (0.3 < 0.5) → no_fit
  const b = await scoreApplication(app([
    { qid: "m1", evidence: [ev("verified", "distributed systems consensus protocols")] },
    { qid: "m2", evidence: [ev("exists_unlinked", "rust")] },
  ]), P, opts);
  check("B verdict=no_fit (required gate)", b.verdict === "no_fit", `got ${b.verdict}`);
  check("B requiredAllPass=false", b.requiredAllPass === false);

  // C — fabrication gate: m1 has a strong AND a fabricated cite → no_fit + flag
  const c = await scoreApplication(app([
    { qid: "m1", evidence: [ev("verified", "distributed systems consensus protocols"), ev("fabricated", "")] },
    { qid: "m2", evidence: [ev("verified", "rust async runtime internals")] },
  ]), P, opts);
  check("C verdict=no_fit despite strong evidence", c.verdict === "no_fit", `got ${c.verdict}`);
  check("C has fabrication flag", c.flags.some((f) => f.startsWith("fabrication")), JSON.stringify(c.flags));

  // D — unverifiable = 0.1, and unverified-dominant flag
  const d = await scoreApplication(app([
    { qid: "m1", evidence: [ev("unverifiable", "")] },
    { qid: "m2", evidence: [ev("unverifiable", "")] },
  ]), P, opts);
  check("D m1 score=0.1 (unverifiable benefit)", d.items[0].score === 0.1, `got ${d.items[0].score}`);
  check("D verdict=no_fit", d.verdict === "no_fit");
  check("D unverified-dominant flag", d.flags.some((f) => f.includes("unverifiable")), JSON.stringify(d.flags));

  // E — overclaim: self "strong" but everything declined → no_fit + overclaim flag
  const e = await scoreApplication(app([
    { qid: "m1", evidence: [], decline: "no_evidence" },
    { qid: "m2", evidence: [], decline: "no_evidence" },
  ], "strong"), P, opts);
  check("E verdict=no_fit", e.verdict === "no_fit");
  check("E overclaim flag", e.flags.some((f) => f.startsWith("overclaim")), JSON.stringify(e.flags));

  // F — proof_of_control verified → identity.proven=true + flag
  const f = await scoreApplication(
    app([{ qid: "m1", evidence: [ev("verified", "distributed systems consensus protocols")] }, { qid: "m2", evidence: [ev("verified", "rust async runtime internals")] }], undefined, GIST),
    P,
    { ...opts, verifyProof: async () => ({ proven: true, note: "mock gist proof" }) },
  );
  check("F identity.proven=true", f.identity.proven === true, `got ${f.identity.proven}`);
  check("F identity-proven flag", f.flags.some((x) => x.includes("identity proven")), JSON.stringify(f.flags));

  // G — proof_of_control claimed but fails → proven=false + failure flag
  const g = await scoreApplication(
    app([{ qid: "m1", evidence: [ev("verified", "distributed systems consensus protocols")] }, { qid: "m2", evidence: [ev("verified", "rust async runtime internals")] }], undefined, GIST),
    P,
    { ...opts, verifyProof: async () => ({ proven: false, note: "owner mismatch" }) },
  );
  check("G identity.proven=false", g.identity.proven === false, `got ${g.identity.proven}`);
  check("G proof-failed flag", g.flags.some((x) => x.startsWith("proof_of_control failed")), JSON.stringify(g.flags));

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });

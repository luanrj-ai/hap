/**
 * Offline tests for P2 (candidate-side match + multi-target apply).
 *
 *   npx tsx scripts/test-match.ts
 *
 * estimateMatch is deterministic. applyToTargets is driven by a mock fetch
 * (GET returns postings, POST returns a receipt) so the whole rank → gate →
 * apply path is asserted with no network: ranking, threshold, cap, dedupe.
 */
import { estimateMatch, applyToTargets, type CandidateProfile } from "@hap/candidate-runtime";
import { PostingZ } from "@hap/a2a-adapter";

const profile: CandidateProfile = {
  name: "Tester",
  tagline: "rust payments engineer",
  evidenceSources: [{ type: "github_user", url: "https://github.com/t", note: "rust payments" }],
  specializations: ["rust", "payments"],
};

function postingInput(id: string, title: string, reqs: Array<[string, boolean]>) {
  return {
    kind: "hap.posting",
    posting_id: id,
    jd: {
      title,
      summary: "s",
      must_have: reqs.filter((r) => r[1]).map((r) => r[0]),
      nice_to_have: reqs.filter((r) => !r[1]).map((r) => r[0]),
    },
    rubric: reqs.map(([req, required], i) => ({
      question_id: `${required ? "m" : "n"}${i}`,
      ask: { type: "open", prompt: `Show evidence for: ${req}. Cite.` },
      required,
    })),
    submit: { endpoint: "https://inbox.test/apply" },
    from: { company: "T" },
  };
}

const A = postingInput("posting-a1", "Rust Payments", [["rust async runtime", true], ["payments domain", true]]);
const B = postingInput("posting-b1", "Rust + Marketing", [["rust systems", true], ["marketing campaigns", false]]);
const C = postingInput("posting-c1", "Marketing", [["marketing", true], ["sales pipeline", false]]);
const URLS = { a: "https://t/a", b: "https://t/b", c: "https://t/c" } as const;
const postings = new Map<string, unknown>([[URLS.a, A], [URLS.b, B], [URLS.c, C]]);

const mockFetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (init?.method === "POST") {
    return { ok: true, status: 200, json: async () => ({ kind: "hap.receipt", application_id: "a_test0001", received_at: new Date().toISOString(), status: "received" }) } as unknown as Response;
  }
  const p = postings.get(String(url));
  return (p ? { ok: true, status: 200, json: async () => p } : { ok: false, status: 404, json: async () => null }) as unknown as Response;
}) as typeof fetch;

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}  ${detail}`); }
};

async function main() {
  // estimateMatch
  const mA = estimateMatch(profile, PostingZ.parse(A));
  const mB = estimateMatch(profile, PostingZ.parse(B));
  const mC = estimateMatch(profile, PostingZ.parse(C));
  check("match A = 1.0 (both hit)", mA.score === 1, `got ${mA.score}`);
  check("match B ≈ 0.67 (req hit, nice miss)", Math.abs(mB.score - 0.67) < 0.02, `got ${mB.score}`);
  check("match C = 0 (no hits)", mC.score === 0, `got ${mC.score}`);

  // auto: threshold 0.5, big cap → A & B applied, C skipped, ranked desc
  const auto = await applyToTargets({ profile, postingUrls: [URLS.c, URLS.a, URLS.b], mode: "auto", threshold: 0.5, cap: 5, fetchImpl: mockFetch });
  check("auto ranked desc (A first)", auto[0].posting_id === "posting-a1", `got ${auto[0].posting_id}`);
  check("auto applied A & B", auto.find((r) => r.posting_id === "posting-a1")!.applied && auto.find((r) => r.posting_id === "posting-b1")!.applied);
  check("auto skipped C below threshold", /below threshold/.test(auto.find((r) => r.posting_id === "posting-c1")!.skipped ?? ""), JSON.stringify(auto.find((r) => r.posting_id === "posting-c1")));

  // cap = 1 → only A applied, B hits the cap
  const capped = await applyToTargets({ profile, postingUrls: [URLS.a, URLS.b], mode: "auto", threshold: 0.5, cap: 1, fetchImpl: mockFetch });
  check("cap: only 1 applied", capped.filter((r) => r.applied).length === 1, JSON.stringify(capped.map((r) => [r.posting_id, r.applied])));
  check("cap: B skipped rate cap", /rate cap/.test(capped.find((r) => r.posting_id === "posting-b1")!.skipped ?? ""));

  // already-applied A → skipped, B applied
  const dedupe = await applyToTargets({ profile, postingUrls: [URLS.a, URLS.b], mode: "auto", threshold: 0.5, cap: 5, alreadyApplied: new Set(["posting-a1"]), fetchImpl: mockFetch });
  check("dedupe: A skipped already-applied", /already applied/.test(dedupe.find((r) => r.posting_id === "posting-a1")!.skipped ?? ""));
  check("dedupe: B still applied", dedupe.find((r) => r.posting_id === "posting-b1")!.applied);

  // list mode: ranks, applies nothing
  const list = await applyToTargets({ profile, postingUrls: [URLS.a, URLS.b, URLS.c], mode: "list", fetchImpl: mockFetch });
  check("list: nothing applied", list.every((r) => !r.applied));
  check("list: ranked desc", list[0].posting_id === "posting-a1");

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

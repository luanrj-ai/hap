/**
 * Offline test for the candidate sourcing loop (discover + profile pitch).
 *
 *   npx tsx scripts/test-sourcing.ts
 *
 * A mock fetch serves one company's careers page (with a jobs@ email) and 404s
 * the rest, so discoverTargets is deterministic: reachable companies surface,
 * unreachable/hallucinated ones are dropped. renderProfilePitch is asserted to
 * cite real evidence.
 */
import { discoverTargets, renderProfilePitch, type CandidateProfile } from "@hap/candidate-runtime";

const profile: CandidateProfile = {
  name: "Alex",
  tagline: "rust / infra",
  evidenceSources: [{ type: "github_user", url: "https://github.com/alex" }],
  specializations: ["rust"],
  human_contact: "alex@example.com",
};

// Only renlab.ai has a reachable careers page (with a role-based email).
const mockFetch = (async (url: string | URL | Request) => {
  const u = String(url);
  if (/renlab\.ai/i.test(u)) {
    return { ok: true, status: 200, text: async () => `<html>… apply: <a href="mailto:jobs@renlab.ai">jobs@renlab.ai</a> …</html>` } as unknown as Response;
  }
  return { ok: false, status: 404, text: async () => "" } as unknown as Response;
}) as typeof fetch;

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}  ${d}`); } };

async function main() {
  const targets = await discoverTargets({
    profile,
    hints: ["renlab.ai", "ghosttown.example"],
    useLLM: false,
    fetchImpl: mockFetch,
  });

  const renlab = targets.find((t) => t.company.toLowerCase() === "renlab");
  const ghost = targets.find((t) => t.company.toLowerCase() === "ghosttown");
  check("renlab reachable with jobs@ email", renlab?.reachable === true && renlab?.email === "jobs@renlab.ai", JSON.stringify(renlab));
  check("ghosttown unreachable (no channel)", ghost?.reachable === false, JSON.stringify(ghost));
  check("reachable sorted first", targets[0]?.reachable === true, JSON.stringify(targets.map((t) => [t.company, t.reachable])));

  const pitch = renderProfilePitch(profile, { company: "renlab" });
  check("pitch subject names candidate", pitch.subject.includes("Alex"));
  check("pitch cites real evidence url", pitch.markdown.includes("https://github.com/alex"));
  check("pitch addresses the company", pitch.markdown.includes("Hi renlab"));

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

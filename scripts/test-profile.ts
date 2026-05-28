/**
 * Offline test for the living-profile pipeline (P1).
 *
 *   npx tsx scripts/test-profile.ts
 *
 * readClaudeFootprint is tested against a fixture transcript tree (deterministic,
 * offline, and proving it reads metadata only). buildLivingProfile is asserted
 * to produce a schema-valid hap.profile with the Claude footprint marked
 * self-reported. (The GitHub gather may be rate-limited; the profile still
 * builds — we assert structure, not live data.)
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { readClaudeFootprint, buildLivingProfile } from "@hap/candidate-runtime";

const FIX = resolve(process.cwd(), "_cc_fixture", "projects");

function setupFixture() {
  rmSync(resolve(process.cwd(), "_cc_fixture"), { recursive: true, force: true });
  mkdirSync(resolve(FIX, "C--Users-x-Desktop-resumetruth"), { recursive: true });
  writeFileSync(resolve(FIX, "C--Users-x-Desktop-resumetruth", "s1.jsonl"), "");
  writeFileSync(resolve(FIX, "C--Users-x-Desktop-resumetruth", "s2.jsonl"), "");
  mkdirSync(resolve(FIX, "C--Users-x-code-alpha"), { recursive: true });
  writeFileSync(resolve(FIX, "C--Users-x-code-alpha", "s1.jsonl"), "");
  mkdirSync(resolve(FIX, "empty-project"), { recursive: true }); // no jsonl → skipped
}

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}  ${detail}`); }
}

async function main() {
  setupFixture();
  try {
    const fp = readClaudeFootprint(FIX);
    check("footprint: 2 projects (empty skipped)", fp.projects.length === 2, `got ${fp.projects.length}`);
    check("footprint: total 3 sessions", fp.totalSessions === 3, `got ${fp.totalSessions}`);
    check("footprint: sorted, top = resumetruth", fp.projects[0]?.project === "resumetruth", `got ${fp.projects[0]?.project}`);
    check("footprint: resumetruth has 2 sessions", fp.projects[0]?.sessions === 2, `got ${fp.projects[0]?.sessions}`);

    const { profile } = await buildLivingProfile({
      handle: "torvalds",
      contact: "t@example.com",
      includeClaude: true,
      claudeBaseDir: FIX,
      openTo: ["systems", "kernel"],
    });
    check("profile: kind hap.profile", profile.kind === "hap.profile");
    check("profile: has generated_at", typeof profile.generated_at === "string");
    check("profile: cc_footprint length 2", profile.candidate.cc_footprint?.length === 2, `got ${profile.candidate.cc_footprint?.length}`);
    check("profile: every cc item self_reported", (profile.candidate.cc_footprint ?? []).every((p) => p.self_reported === true));
    check("profile: has a github_user evidence", profile.candidate.profile_evidence.some((e) => e.type === "github_user"));
    check("profile: inbox is mailto contact", profile.candidate.inbox?.endpoint === "mailto:t@example.com", `got ${profile.candidate.inbox?.endpoint}`);
  } finally {
    rmSync(resolve(process.cwd(), "_cc_fixture"), { recursive: true, force: true });
  }

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

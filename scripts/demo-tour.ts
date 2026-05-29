/**
 * End-to-end product tour (for demos). Deterministic + offline:
 * verification is INJECTED (never depends on GitHub rate limits) and relevance
 * uses keyword matching (no LLM key needed) — same output every run.
 *
 *   npm run demo:tour          # narrated walkthrough
 *   npm run demo:tour -- --md  # also write DEMO.md (for slides/docs)
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ApplicationZ, ProfileCardZ, type Application } from "@hap/a2a-adapter";
import { postingFromJD, DiscoveryIndex, type JobDescription } from "@hap/hr-runtime";
import { renderApplicationEmail, type CandidateProfile } from "@hap/candidate-runtime";
import { scoreApplication, type VerificationResult } from "@resumetruth/scoring/score-application";

const out: string[] = [];
const p = (s = "") => { console.log(s); out.push(s); };
const hr = (n: string, title: string, cmd: string) =>
  p(`\n${"━".repeat(72)}\nSTEP ${n} · ${title}\n           real command:  ${cmd}\n${"━".repeat(72)}`);

// Demo verification: a `__FABRICATED__` note → fabricated; github artifacts →
// verified (author == anchor); everything else → real-but-unlinked. Facts carry
// the rubric keywords so relevance lands deterministically.
const verify = async (ev: { type: string; url: string; note?: string }): Promise<VerificationResult> => {
  if (ev.note === "__FABRICATED__") return { level: "fabricated", facts: "", note: "sha not found (404)" };
  return ev.type.startsWith("github")
    ? { level: "verified", facts: ev.note ?? ev.url, note: "author/owner == anchor" }
    : { level: "exists_unlinked", facts: ev.note ?? ev.url, note: "reachable; candidate name appears" };
};
const verifyProof = async (): Promise<{ proven: boolean; note: string }> => ({ proven: true, note: "gist owned by @alex-chen carries HAP-PROOF" });

const jd: JobDescription = {
  title: "AI Builder · multi-agent / SWM",
  summary: "Build multi-agent simulations of real orgs; distill into a social world model. Research-heavy but must ship.",
  must_have: ["multi-agent simulations end to end", "ships production code, not just prototypes"],
  nice_to_have: ["world models / SWM background", "agent / LLM product work"],
  domain: "ai-research",
};
const posting = postingFromJD({ jd, posting_id: "renlab-ai-builder-001", submitEndpoint: "https://api.renlab.ai/apply", company: "renlab", human_contact: "jobs@renlab.ai" });

async function main() {
  const md = process.argv.includes("--md");
  p(`\n${"═".repeat(72)}\n  HAP — end-to-end tour  ·  an honest candidate, a faker, and a recruiter\n${"═".repeat(72)}`);

  const candidate: CandidateProfile = {
    name: "Alex Chen",
    tagline: "builds multi-agent systems · ships",
    evidenceSources: [
      { type: "github_user", url: "https://github.com/alex-chen", note: "180 repos · 2.1k followers" },
      { type: "github_repo", url: "https://github.com/alex-chen/abm-sim", note: "200-agent multi-agent simulation, built end to end · 1.2k★" },
      { type: "github_commit", url: "https://github.com/alex-chen/abm-sim/commit/9f4ac21", note: "ships production code; ~40 releases, runs live" },
      { type: "github_repo", url: "https://github.com/alex-chen/eval-harness", note: "LLM agent product: an evaluation harness" },
    ],
    specializations: ["multi-agent", "simulation", "rust"],
    human_contact: "alex@example.com",
    proof_of_control: { method: "github_gist", url: "https://gist.github.com/alex-chen/0123456789abcdef0123456789abcdef" },
  };

  // STEP 1 — living profile
  hr("1", "Candidate builds a living profile (from PUBLIC GitHub)", "npm run profile -- --handle alex-chen --with-claude");
  const profileCard = ProfileCardZ.parse({
    kind: "hap.profile",
    generated_at: new Date().toISOString(),
    candidate: {
      name: candidate.name, headline: candidate.tagline, specializations: candidate.specializations,
      profile_evidence: candidate.evidenceSources,
      cc_footprint: [{ project: "abm-sim", sessions: 31, last_active: "2026-05-26", repo_url: "https://github.com/alex-chen/abm-sim", self_reported: true }],
      proof_of_control: candidate.proof_of_control,
      inbox: { endpoint: `mailto:${candidate.human_contact}`, transport: "mailto" },
      open_to: ["ai", "simulation"], rate_limit: { per_day: 1 },
    },
  });
  p(`  ${profileCard.candidate.name} — ${profileCard.candidate.headline}`);
  p(`  public evidence : ${profileCard.candidate.profile_evidence.length} sources · ${profileCard.candidate.specializations?.join(", ")}`);
  p(`  cc footprint    : ${profileCard.candidate.cc_footprint?.map((x) => `${x.project}(${x.sessions})`).join(", ")}  (self-reported, never scored)`);
  p(`  identity        : proof-of-control gist attached`);

  // STEP 2 — employer posts a role
  hr("2", "Employer publishes a role (just a file — no account)", "npm run serve:inbox");
  p(`  ${posting.from.company} · ${posting.jd.title}`);
  for (const r of posting.rubric) p(`    [${r.required ? "REQ " : "nice"}] ${r.question_id}: ${r.ask.prompt.replace(/^Show evidence for:\s*/, "").replace(/\. Cite.*/, "")}`);

  // STEP 3 — candidate applies
  hr("3", "Candidate-agent applies with cited evidence (review before send)", "npm run apply -- --posting <url> --handle alex-chen");
  const application: Application = ApplicationZ.parse({
    kind: "hap.application", application_id: "a_01HXY7K4M2P9",
    posting_ref: { posting_id: posting.posting_id, posting_url: posting.submit.endpoint },
    candidate: { name: candidate.name, human_contact: candidate.human_contact, profile_evidence: [candidate.evidenceSources[0]], proof_of_control: candidate.proof_of_control },
    responses: [
      { question_id: "m1", answer: { text: "Built abm-sim, a 200-agent market simulation, end to end.", evidence: [candidate.evidenceSources[1]], confidence: "high", decline_reason: null } },
      { question_id: "m2", answer: { text: "It ships — production code, ~40 releases, runs live.", evidence: [candidate.evidenceSources[2]], confidence: "high", decline_reason: null } },
      { question_id: "n1", answer: { text: "No public evidence of formal world-models / SWM work.", evidence: [], confidence: "low", decline_reason: "no_evidence" } },
      { question_id: "n2", answer: { text: "Built an LLM agent eval harness.", evidence: [candidate.evidenceSources[3]], confidence: "medium", decline_reason: null } },
    ],
    self_assessment: { fit: "plausible" }, disclosure: { contact_release: "on_submit", public: false },
  });
  for (const r of application.responses) {
    const tag = r.answer.decline_reason ? `decline:${r.answer.decline_reason}` : `${r.answer.confidence}, ${r.answer.evidence.length} cite(s)`;
    p(`    ${r.question_id} [${tag}]  ${r.answer.text}`);
  }
  p(`\n  — the email it would send to a human employer —`);
  p(renderApplicationEmail(application, posting).markdown.split("\n").map((l) => `  │ ${l}`).join("\n"));

  // STEP 4 — neutral scorer
  hr("4", "Neutral scorer dereferences & scores (employer side, automatic)", "(runs in the inbox; npm run test:scorer for the rules)");
  const report = await scoreApplication(application, posting, { noLLM: true, verify, verifyProof });
  p(`  VERDICT : ${report.verdict.toUpperCase()}   overall ${report.overall}   identity ${report.identity.proven ? "PROVEN" : "asserted"}   (calibrated: ${report.calibrated})`);
  for (const it of report.items) p(`    ${it.required ? "REQ " : "nice"} ${it.question_id}  score ${it.score.toFixed(2)}  [${it.bestLevel === "declined" ? `declined(${it.declineReason})` : it.bestLevel}]  ${it.requirement}`);
  for (const f of report.flags) p(`    🚩 ${f}`);
  p(`  ↳ scored on links it opened and checked — not the agent's prose. The honest "no_evidence" on n1 cost nothing.`);

  // STEP 5 — discovery
  hr("5", "Discovery: candidate opts in, a recruiter searches", "npm run serve:index · profile --publish · npm run search");
  const index = new DiscoveryIndex({ verifyOpts: { verify, verifyProof } });
  const pub = await index.publish(profileCard);
  p(`  published @${pub.key} → ${pub.verified?.note}`);
  const found = index.search({ q: "multi-agent" }, { id: "acme.com" });
  for (const h of found.hits ?? []) p(`  recruiter @acme.com searches "multi-agent" → ${h.name} @${h.key} · ${h.verified.note} (rank ${h.verified.rankSignal}) · no contact shown`);
  const key = found.hits![0].key;
  p(`  requests contact → ${index.requestContact(key, { id: "acme.com" }).contact}`);
  p(`  requests again (your daily cap=1) → ✋ ${index.requestContact(key, { id: "acme.com" }).error}`);

  // STEP 6 — and when someone fakes it
  hr("6", "…and when someone fakes it", "(same scorer — fabrication is a hard gate)");
  const faker: Application = ApplicationZ.parse({
    kind: "hap.application", application_id: "a_faker_0001",
    posting_ref: { posting_id: posting.posting_id },
    candidate: { name: "Sam Faker", human_contact: "sam@example.com", profile_evidence: [{ type: "github_user", url: "https://github.com/sam-faker" }] },
    responses: [
      { question_id: "m1", answer: { text: "I built a huge multi-agent simulation — here's the commit.", evidence: [{ type: "github_commit", url: "https://github.com/torvalds/linux/commit/0000000000000000", note: "__FABRICATED__" }], confidence: "high", decline_reason: null } },
      { question_id: "m2", answer: { text: "Ships constantly.", evidence: [{ type: "github_repo", url: "https://github.com/sam-faker/app", note: "a real but unrelated todo app" }], confidence: "high", decline_reason: null } },
    ],
    self_assessment: { fit: "strong" }, disclosure: { contact_release: "on_submit", public: false },
  });
  const fr = await scoreApplication(faker, posting, { noLLM: true, verify, verifyProof });
  p(`  Sam Faker — self-assessed "strong"`);
  p(`  VERDICT : ${fr.verdict.toUpperCase()}   overall ${fr.overall}   identity ${fr.identity.proven ? "PROVEN" : "asserted"}`);
  for (const f of fr.flags) p(`    🚩 ${f}`);
  p(`  ↳ one fabricated link → rejected outright, no matter how confident the prose.`);

  p(`\n${"═".repeat(72)}\n  done · honest candidate FITs · faker is caught · recruiter finds verified people\n${"═".repeat(72)}\n`);

  if (md) {
    const file = resolve(process.cwd(), "DEMO.md");
    writeFileSync(file, `# HAP — end-to-end demo\n\nGenerated by \`npm run demo:tour -- --md\` (deterministic; verification injected, no network/keys).\n\n\`\`\`text\n${out.join("\n").trim()}\n\`\`\`\n`);
    p(`wrote ${file}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

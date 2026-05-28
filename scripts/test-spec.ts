/**
 * P5 checks: the AgentCard declares v0.2, and the generated JSON Schema
 * artifacts are well-formed and match the canonical message kinds.
 *
 *   npx tsx scripts/test-spec.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildAgentCard } from "@hap/a2a-adapter";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}  ${d}`); } };

function main() {
  const card = buildAgentCard({
    name: "Alex",
    description: "candidate agent",
    url: "https://alex.dev",
    role: "candidate",
    supportedEvidenceTypes: ["github_user", "github_repo"],
    profileUrl: "https://alex.dev/.well-known/hap-profile.json",
  });
  check("card declares hap.v0.2 skill", card.skills.includes("hap.v0.2.0-draft"), JSON.stringify(card.skills));
  check("card keeps v0.1 skill (L1 back-compat)", card.skills.includes("hap.v0.1.0"));
  check("card role skill present", card.skills.includes("hap.candidate"));
  check("card supports both versions", card.hap.supported_versions.includes("0.1.0") && card.hap.supported_versions.includes("0.2.0-draft"));
  check("card exposes profile_url", card.hap.profile_url === "https://alex.dev/.well-known/hap-profile.json");

  for (const name of ["posting", "application", "receipt", "profile"]) {
    const p = resolve(process.cwd(), "spec", "schemas", `${name}.schema.json`);
    let json: { definitions?: Record<string, { properties?: { kind?: { const?: string } } }> } | null = null;
    try { json = JSON.parse(readFileSync(p, "utf8")); } catch { /* missing */ }
    const def = json?.definitions?.[`hap.${name}`];
    check(`schema ${name}.schema.json valid + kind=hap.${name}`, def?.properties?.kind?.const === `hap.${name}`, `got ${def?.properties?.kind?.const}`);
  }

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();

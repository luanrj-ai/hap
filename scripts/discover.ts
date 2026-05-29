/**
 * `discover` — find target companies and their official application channel,
 * then RECOMMEND them (you pick; nothing is sent automatically).
 *
 *   tsx scripts/discover.ts --handle <gh> [--companies "renlab.ai,acme"] [--llm]
 *                           [--note "AI infra roles"] [--pitch]
 *
 * Only companies with a real official channel (read off their own careers page)
 * are surfaced — that filters out hallucinated/dead targets and keeps it to
 * official channels (no mass blast). --pitch renders a ready-to-send cover email
 * from your verified evidence for each reachable target.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { gatherProfile, discoverTargets, renderProfilePitch } from "@hap/candidate-runtime";

loadEnv({ path: resolve(process.cwd(), "apps/web/.env") });

const argv = process.argv.slice(2);
const flag = (n: string): string | undefined => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (n: string) => argv.includes(`--${n}`);

async function main() {
  const handle = flag("handle");
  if (!handle) {
    console.error('usage: discover --handle <github> [--companies "a,b"] [--llm] [--note "…"] [--pitch]');
    process.exit(1);
  }

  const { profile, warnings } = await gatherProfile(handle, { contact: flag("contact") });
  warnings.forEach((w) => console.warn(`  ⚠ ${w}`));

  const targets = await discoverTargets({
    profile,
    hints: flag("companies")?.split(",").map((s) => s.trim()).filter(Boolean),
    useLLM: has("llm"),
    note: flag("note"),
  });

  const reachable = targets.filter((t) => t.reachable);
  console.log(`\ncandidate: ${profile.name}  ·  ${reachable.length} reachable target(s) of ${targets.length}\n`);
  for (const t of targets) {
    const channel = t.email ?? t.careersUrl ?? "(no official channel found)";
    const tag = t.reachable ? `→ ${channel}` : "skipped — no official channel";
    console.log(`  ${t.reachable ? "✓" : "·"} ${t.company.padEnd(20)} [${t.source}] ${tag}`);
  }

  if (has("pitch")) {
    for (const t of reachable) {
      const email = renderProfilePitch(profile, { company: t.company });
      console.log(`\n--- pitch → ${t.email ?? t.careersUrl} ---\nSubject: ${email.subject}\n\n${email.markdown}`);
    }
  } else {
    console.log(`\nto apply: HAP posting → \`apply --posting <url>\`; these (no HAP posting) → re-run with --pitch to draft a cover email.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

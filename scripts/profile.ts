/**
 * `profile` — build/refresh your living, candidate-owned HAP profile.
 *
 *   tsx scripts/profile.ts --handle <github> [--contact you@x] [--proof <gistUrl>]
 *                          [--with-claude] [--open-to "rust,payments"]
 *
 * Single-player: useful with zero employers — your résumé that keeps itself up
 * to date. Re-run anytime to refresh; schedule it (cron / Task Scheduler) to
 * keep it living. Writes ./hap-profile.json, which YOU own.
 *
 * --with-claude opts into reading your LOCAL Claude Code footprint (project
 * names + session counts only — never transcript contents). It's your own data
 * and stays local; only what you see printed goes into the profile.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { buildLivingProfile } from "@hap/candidate-runtime";

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
    console.error('usage: profile --handle <github> [--contact you@x] [--proof <gistUrl>] [--with-claude] [--open-to "a,b"]');
    process.exit(1);
  }

  const withClaude = has("with-claude");
  if (withClaude) {
    console.log("• Reading LOCAL Claude Code footprint: directory names + session counts only — never transcript contents. Your data stays local; only the project list below goes into the profile.\n");
  }

  const proofUrl = flag("proof");
  const { profile, warnings } = await buildLivingProfile({
    handle,
    contact: flag("contact"),
    proof: proofUrl ? { method: "github_gist", url: proofUrl } : undefined,
    includeClaude: withClaude,
    openTo: flag("open-to")?.split(",").map((s) => s.trim()).filter(Boolean),
  });
  warnings.forEach((w) => console.warn(`  ⚠ ${w}`));

  const c = profile.candidate;
  console.log(`\nprofile for ${c.name}`);
  console.log(`  evidence  : ${c.profile_evidence.length} public source(s)${c.specializations?.length ? ` · ${c.specializations.join(", ")}` : ""}`);
  if (c.cc_footprint?.length) {
    console.log(`  cc footprint (self-reported, not scored):`);
    for (const p of c.cc_footprint.slice(0, 8)) {
      console.log(`    - ${p.project}  (${p.sessions ?? "?"} sessions, last ${p.last_active})${p.repo_url ? "  ✓ public repo" : ""}`);
    }
  }
  console.log(`  identity  : ${c.proof_of_control ? "proof-of-control provided" : "asserted (add --proof <gist> to prove)"}`);

  const out = resolve(process.cwd(), "hap-profile.json");
  writeFileSync(out, JSON.stringify(profile, null, 2));
  console.log(`\nwrote ${out}`);
  console.log(`This is yours. Re-run to refresh; schedule it (cron / Task Scheduler) to keep it living.`);

  // Opt-in discovery: publish the profile into a central index so recruiters can find you.
  const indexUrl = flag("publish");
  if (indexUrl) {
    console.log(`\npublishing (opt-in) to ${indexUrl} ...`);
    try {
      const res = await fetch(`${indexUrl.replace(/\/$/, "")}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; key?: string; verified?: { note?: string }; error?: string } | null;
      if (res.ok && j?.ok) console.log(`  ✓ indexed as @${j.key} — ${j.verified?.note ?? ""}`);
      else console.error(`  ✗ ${j?.error ?? res.status}`);
    } catch (e) {
      console.error(`  ✗ ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

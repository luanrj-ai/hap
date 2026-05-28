/**
 * `apply` — a candidate's one-command application (HAP v0.2).
 *
 * Same backend as the web "Sign in with GitHub" flow; this is the CLI wrapper.
 * Reads PUBLIC GitHub only (never your local machine). Drafts evidenced answers
 * to the posting's rubric, writes a review file, and sends NOTHING until you
 * confirm with --send — that file is exactly what will leave your machine.
 *
 *   tsx scripts/apply.ts --posting <url> --handle <gh> [--contact you@x] [--proof <gistUrl>]
 *   # review ./hap-application.json, then:
 *   tsx scripts/apply.ts --send
 *
 * Identity is "asserted" with --handle; --proof <gist> makes it "proven" (the
 * web flow will do this via GitHub OAuth instead of a gist).
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { PostingZ, parseAsyncHapMessage, type Application } from "@hap/a2a-adapter";
import { gatherProfile, buildApplication, renderApplicationEmail, applyToTargets } from "@hap/candidate-runtime";

loadEnv({ path: resolve(process.cwd(), "apps/web/.env") });

const OUT = resolve(process.cwd(), "hap-application.json");
const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name: string) => argv.includes(`--${name}`);

async function send(): Promise<void> {
  if (!existsSync(OUT)) {
    console.error(`No ${OUT} found — run the draft step first.`);
    process.exit(1);
  }
  const application = JSON.parse(readFileSync(OUT, "utf8")) as Application;
  const url = application.posting_ref.posting_url;
  if (!url) {
    console.error("Reviewed packet has no posting_ref.posting_url to send to.");
    process.exit(1);
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(application),
  });
  const receipt = parseAsyncHapMessage(await res.json().catch(() => null));
  if (receipt && receipt.kind === "hap.receipt") {
    console.log(`✓ sent to ${url} — ${receipt.status} → ${receipt.next}`);
  } else {
    console.error(`✗ inbox returned ${res.status} with no valid receipt`);
    process.exit(1);
  }
}

async function draft(): Promise<void> {
  const postingUrl = flag("posting");
  const handle = flag("handle");
  if (!postingUrl || !handle) {
    console.error("usage: apply --posting <url> --handle <github> [--contact you@x] [--proof <gistUrl>]");
    process.exit(1);
  }

  const posting = PostingZ.parse(await fetch(postingUrl).then((r) => r.json()));
  console.log(`\nposting : ${posting.jd.title}  (${posting.from.company ?? "?"})`);

  const proofUrl = flag("proof");
  const { profile, warnings } = await gatherProfile(handle, {
    contact: flag("contact"),
    proof: proofUrl ? { method: "github_gist", url: proofUrl } : undefined,
  });
  warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
  console.log(`candidate: ${profile.name}  ·  ${profile.evidenceSources.length} public evidence source(s)\n`);

  const application = await buildApplication({
    profile,
    posting,
    onAnswer: (qid, r) => {
      const tag = r.answer.decline_reason ? `decline:${r.answer.decline_reason}` : r.answer.confidence;
      console.log(`  ${qid}  [${tag}, ${r.answer.evidence.length} cite(s)]  ${r.answer.text.slice(0, 80)}`);
    },
  });

  writeFileSync(OUT, JSON.stringify(application, null, 2));
  const email = renderApplicationEmail(application, posting);
  console.log(`\n--- preview (what will be sent) ---\n`);
  console.log(email.markdown);
  console.log(`\nReviewed nothing yet. Edit ${OUT} to remove anything you don't want to disclose,`);
  console.log(`then send it for real:\n   tsx scripts/apply.ts --send\n`);
}

// --- identity fallback: reuse the living profile (P1) if --handle is omitted ---
function resolveIdentity(): { handle?: string; contact?: string; proof?: { method: "github_gist"; url: string } } {
  const handle = flag("handle");
  const contact = flag("contact");
  const proofUrl = flag("proof");
  const proof = proofUrl ? { method: "github_gist" as const, url: proofUrl } : undefined;
  if (handle) return { handle, contact, proof };

  const profPath = resolve(process.cwd(), "hap-profile.json");
  if (existsSync(profPath)) {
    try {
      const p = JSON.parse(readFileSync(profPath, "utf8")) as {
        candidate?: { profile_evidence?: Array<{ type: string; url: string }>; inbox?: { endpoint?: string }; proof_of_control?: { method: "github_gist"; url: string } };
      };
      const gh = p.candidate?.profile_evidence?.find((e) => e.type === "github_user");
      const login = gh?.url.match(/github\.com\/([^/]+)/i)?.[1];
      const mail = p.candidate?.inbox?.endpoint?.replace(/^mailto:/, "");
      return { handle: login, contact: contact ?? mail, proof: proof ?? p.candidate?.proof_of_control };
    } catch {
      /* fall through */
    }
  }
  return { handle: undefined, contact, proof };
}

// --- applied-ledger: dedupe / rate-cap cooldown for full-auto ---
const LEDGER = resolve(process.cwd(), "hap-applied.json");
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
function readApplied(): Set<string> {
  if (!existsSync(LEDGER)) return new Set();
  try {
    const j = JSON.parse(readFileSync(LEDGER, "utf8")) as { applied?: Array<{ posting_id: string; at: number }> };
    const cutoff = Date.now() - COOLDOWN_MS;
    return new Set((j.applied ?? []).filter((a) => a.at >= cutoff).map((a) => a.posting_id));
  } catch {
    return new Set();
  }
}
function recordApplied(ids: string[]): void {
  let existing: Array<{ posting_id: string; at: number }> = [];
  if (existsSync(LEDGER)) {
    try { existing = (JSON.parse(readFileSync(LEDGER, "utf8")).applied ?? []) as Array<{ posting_id: string; at: number }>; } catch {}
  }
  const now = Date.now();
  for (const id of ids) existing.push({ posting_id: id, at: now });
  writeFileSync(LEDGER, JSON.stringify({ applied: existing }, null, 2));
}

async function targets(): Promise<void> {
  const urls = (flag("targets") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!urls.length) { console.error("usage: apply --targets <url1,url2,...> [--handle <gh>] [--auto --threshold 0.5 --cap 5]"); process.exit(1); }

  const { handle, contact, proof } = resolveIdentity();
  if (!handle) { console.error("need --handle <github> (or a hap-profile.json from `npm run profile`)"); process.exit(1); }

  const { profile, warnings } = await gatherProfile(handle, { contact, proof });
  warnings.forEach((w) => console.warn(`  ⚠ ${w}`));

  const mode = has("auto") ? "auto" : "list";
  const threshold = Number(flag("threshold") ?? 0.5);
  const cap = Number(flag("cap") ?? 5);
  const already = mode === "auto" ? readApplied() : new Set<string>();

  const results = await applyToTargets({ profile, postingUrls: urls, mode, threshold, cap, alreadyApplied: already });

  console.log(`\ncandidate: ${profile.name}  ·  mode: ${mode}\nranked targets (match%):`);
  for (const r of results) {
    const status = r.error ? `error: ${r.error}` : r.applied ? `APPLIED → ${r.receipt?.status}` : r.skipped ? `skipped: ${r.skipped}` : "";
    console.log(`  ${String(Math.round(r.match * 100)).padStart(3)}%  ${r.title ?? r.url}${status ? `  — ${status}` : ""}`);
  }

  if (mode === "auto") {
    recordApplied(results.filter((r) => r.applied && r.posting_id).map((r) => r.posting_id!));
    console.log(`\napplied to ${results.filter((r) => r.applied).length} (threshold ${threshold}, cap ${cap}).`);
  } else {
    console.log(`\nlist mode (agent recommended). apply to one you pick:\n   tsx scripts/apply.ts --posting <url> --handle ${handle}\n   (or re-run with --auto to auto-apply above --threshold)`);
  }
}

const run = has("send") ? send() : flag("targets") !== undefined ? targets() : draft();
run.catch((e) => {
  console.error(e);
  process.exit(1);
});

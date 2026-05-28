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
import { gatherProfile, buildApplication, renderApplicationEmail } from "@hap/candidate-runtime";

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

(has("send") ? send() : draft()).catch((e) => {
  console.error(e);
  process.exit(1);
});

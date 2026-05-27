/**
 * Candidate-initiated apply demo (HAP v0.2 draft, reversed flow).
 *
 *   npx tsx scripts/demo-apply.ts
 *
 * Spins up a dumb employer inbox, publishes one posting (modelled on the
 * renlab AI-Builder role), then runs a candidate-agent that answers the
 * rubric with evidence and submits — all outbound, no candidate server.
 * Prints the packet the employer receives + the receipt.
 *
 * Reads LLM env from apps/web/.env if present; falls back to template answers.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { applyToPosting, renderApplicationEmail, findApplicationContact, EXAMPLE_PROFILE } from "@hap/candidate-runtime";
import { buildInbox, postingFromJD, type JobDescription } from "@hap/hr-runtime";

loadEnv({ path: resolve(process.cwd(), "apps/web/.env") });

const INBOX_PORT = 4910;

// Modelled on the real renlab "AI Builder · multi-agent / SWM" posting.
const RENLAB_JD: JobDescription = {
  title: "AI Builder · multi-agent simulation / social world model",
  summary:
    "Build the prediction & coordination substrate for AI-native orgs. From-scratch multi-agent simulation of real orgs and populations, distilled into a trainable social world model (SWM). Research-heavy but must ship.",
  must_have: [
    "Built multi-agent simulations end to end",
    "Ships production code, not just research prototypes",
    "Comfortable going 0 to 1 on an ambiguous problem",
  ],
  nice_to_have: ["World models / SWM background", "Claude Code / agent-native workflow"],
  domain: "ai-research",
};

async function main() {
  const posting = postingFromJD({
    jd: RENLAB_JD,
    posting_id: "renlab-ai-builder-001",
    submitEndpoint: `http://localhost:${INBOX_PORT}/api/apply`,
    company: "renlab",
    human_contact: "jobs@renlab.ai",
  });

  const { app, records, idle } = buildInbox({ posting, autoScore: true });
  const server = serve({ fetch: app.fetch, port: INBOX_PORT });

  const provider = process.env.OPENAI_API_KEY ? "openai" : process.env.ANTHROPIC_API_KEY ? "anthropic" : "none (template)";
  console.log("\n=== HAP candidate-initiated apply (v0.2 draft) ===\n");
  console.log(`posting   : ${posting.jd.title}`);
  console.log(`employer  : ${posting.from.company}  ·  inbox ${posting.submit.endpoint}`);
  console.log(`rubric    : ${posting.rubric.length} items (${posting.rubric.filter((r) => r.required).length} required)`);
  console.log(`candidate : ${EXAMPLE_PROFILE.name}  ← swap in your real profile to apply for real`);
  console.log(`llm       : ${provider}\n`);

  try {
    const result = await applyToPosting({
      profile: EXAMPLE_PROFILE,
      posting,
      onAnswer: (qid, r) => {
        const tag = r.answer.decline_reason ? `decline:${r.answer.decline_reason}` : r.answer.confidence;
        const cites = r.answer.evidence.length;
        console.log(`  ${qid}  [${tag}, ${cites} cite${cites === 1 ? "" : "s"}]  ${r.answer.text.slice(0, 88)}`);
      },
    });

    console.log(`\nself-assessed fit : ${result.application.self_assessment?.fit}`);

    // --- Path 1: employer has a HAP inbox (machine-to-machine) ---
    console.log(`\n[machine path] receipt : ${result.receipt ? `${result.receipt.status} → ${result.receipt.next}` : `(none) — ${result.error}`}`);

    // --- Path 2: employer is a human (the realistic case) ---
    const email = renderApplicationEmail(result.application, posting);
    console.log(`\n[human path] finding renlab's official application channel ...`);
    const contact = await findApplicationContact({ company: "renlab", domain: "renlab.ai" });
    console.log(`  ${contact.source} · confidence=${contact.confidence}`);
    console.log(`  careers page : ${contact.careersUrl ?? "(none found)"}`);
    console.log(`  emails       : ${contact.emails.length ? contact.emails.join(", ") : "(none found — fall back to posting contact " + (posting.from.human_contact ?? "?") + ")"}`);

    const to = contact.emails[0] ?? posting.from.human_contact ?? "(unknown)";
    console.log(`\n--- ready-to-send email (to: ${to}) ---`);
    console.log(`Subject: ${email.subject}\n`);
    console.log(email.markdown);

    // --- The employer's inbox auto-scored it (neutral scorer, in background) ---
    console.log(`\n[inbox auto-score] waiting for the employer's neutral scorer ...`);
    await idle();
    const report = records[0]?.report;
    if (!report) {
      console.log(`  (no report — ${records[0]?.scoreError ?? "not scored"})`);
    } else {
      console.log(`  verdict  : ${report.verdict}  (overall ${report.overall}, required-all-pass=${report.requiredAllPass}, llm=${report.usedLLM})`);
      console.log(`  identity : ${report.identity.note}  [proven=${report.identity.proven}]`);
      for (const it of report.items) {
        const tag = it.bestLevel === "declined" ? `declined(${it.declineReason})` : it.bestLevel;
        console.log(`    ${it.required ? "REQ " : "nice"} ${it.question_id}  score=${it.score.toFixed(2)}  [${tag}]  ${it.requirement.slice(0, 46)}`);
      }
      if (report.flags.length) {
        console.log(`  flags:`);
        for (const f of report.flags) console.log(`    🚩 ${f}`);
      }
    }
  } finally {
    await new Promise<void>((r) => (server as { close: (cb: () => void) => void }).close(() => r()));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Render a hap.application into a clean, human-readable application email.
 *
 * Real employers are people, not HAP inboxes. So the candidate-agent can turn
 * the structured packet into an email a hiring manager can read in 30 seconds:
 * per-requirement, evidence as clickable links, honest declines shown as such.
 */
import type { Application, Posting, PublishedAsk } from "@hap/a2a-adapter";

export interface RenderedEmail {
  subject: string;
  /** Markdown body. */
  markdown: string;
}

/** Recover the underlying requirement from a published ask prompt, if possible. */
function requirementLabel(ask: PublishedAsk): string {
  const m = ask.ask.prompt.match(/Show evidence for:\s*(.+?)\.\s/i);
  return m ? m[1] : ask.ask.prompt;
}

function evidenceLine(e: { type: string; url: string; title?: string; venue?: string; note?: string }): string {
  const label = [e.title, e.venue, e.note].filter(Boolean).join(" · ");
  return `  - [${e.type}] ${e.url}${label ? ` — ${label}` : ""}`;
}

export function renderApplicationEmail(application: Application, posting: Posting): RenderedEmail {
  const company = posting.from.company ?? "team";
  const byId = new Map(posting.rubric.map((r) => [r.question_id, r]));

  const sections = application.responses.map((resp) => {
    const ask = byId.get(resp.question_id);
    const tier = ask?.required === false ? "Nice-to-have" : "Required";
    const label = ask ? requirementLabel(ask) : resp.question_id;
    const a = resp.answer;

    if (a.decline_reason) {
      return `### ${tier} — ${label}\n_No evidence (${a.decline_reason})._ ${a.text}`;
    }
    const ev = a.evidence.length
      ? `\nEvidence:\n${a.evidence.map(evidenceLine).join("\n")}`
      : "";
    return `### ${tier} — ${label}\n${a.text} _(confidence: ${a.confidence})_${ev}`;
  });

  const about = (application.candidate.profile_evidence ?? []).map(evidenceLine).join("\n");

  const markdown = [
    `Hi ${company},`,
    ``,
    `I'm applying for **${posting.jd.title}**. Instead of a resume, here is evidence for each requirement — every link is yours to open and verify.`,
    ``,
    `**Self-assessed fit:** ${application.self_assessment?.fit ?? "unspecified"}`,
    ``,
    `## Evidence by requirement`,
    ``,
    sections.join("\n\n"),
    ``,
    about ? `## About me\n${about}\n` : ``,
    `**Contact:** ${application.candidate.human_contact || "(withheld)"}`,
    ``,
    `---`,
    `_Sent by a HAP candidate-agent · application ${application.application_id}. Claims are constrained to cited, dereferenceable evidence._`,
  ].join("\n");

  return {
    subject: `Application — ${application.candidate.name} for ${posting.jd.title}`,
    markdown,
  };
}

/**
 * Turn a JobDescription into a static hap.posting — i.e. "publish a role".
 *
 * The rubric is just the JD's must_have / nice_to_have expanded into questions.
 * Because the questions are published statically, the employer needs NO LLM to
 * run an interview: the candidate-agent answers the published rubric directly.
 */
import { PostingZ, type Posting } from "@hap/a2a-adapter";
import type { JobDescription } from "./jd";

export interface PostingFromJDOptions {
  jd: JobDescription;
  /** Stable id for the role (>= 8 chars). */
  posting_id: string;
  /** Where applications are delivered (the inbox). */
  submitEndpoint: string;
  company?: string;
  human_contact?: string;
}

function askPrompt(requirement: string): string {
  return `Show evidence for: ${requirement}. Cite a specific project, commit, talk, or paper — or decline honestly if you have none.`;
}

export function postingFromJD(o: PostingFromJDOptions): Posting {
  const rubric = [
    ...o.jd.must_have.map((m, i) => ({
      question_id: `m${i + 1}`,
      ask: { type: "open" as const, prompt: askPrompt(m) },
      required: true,
    })),
    ...(o.jd.nice_to_have ?? []).map((n, i) => ({
      question_id: `n${i + 1}`,
      ask: { type: "open" as const, prompt: askPrompt(n) },
      required: false,
      weight: 0.5,
    })),
  ];

  return PostingZ.parse({
    kind: "hap.posting",
    posting_id: o.posting_id,
    jd: o.jd,
    rubric,
    submit: { endpoint: o.submitEndpoint },
    from: { company: o.company, human_contact: o.human_contact },
  });
}

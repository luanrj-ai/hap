/**
 * The HR-agent's interview loop. Given a candidate-agent URL and a JD:
 *   1. POST hap.session.open
 *   2. Read accept / decline
 *   3. Generate questions from JD (LLM)
 *   4. POST hap.ask one at a time, collect hap.answer
 *   5. POST hap.session.close with our verdict
 *
 * Returns a full transcript and a verdict.
 */
import {
  type Ask,
  type Answer,
  type HapMessage,
  type SessionAccept,
  type SessionClose,
  type SessionDecline,
  type SessionOpen,
  parseHapMessage,
} from "@hap/a2a-adapter";
import { callLLMJson, activeProvider } from "@resumetruth/scoring/llm-client";
import type { HrIdentity, JobDescription } from "./jd";

export interface InterviewResult {
  candidateAgentUrl: string;
  sessionId: string;
  status: "completed" | "declined" | "error";
  errorReason?: string;
  declineReason?: SessionDecline["reason"];
  questions: Ask[];
  answers: Answer[];
  verdict: SessionClose | null;
  elapsedMs: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_NUM_QUESTIONS = 3;

function genSessionId(): string {
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function postMessage<T extends HapMessage>(
  candidateAgentUrl: string,
  msg: HapMessage,
  timeoutMs: number,
): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${candidateAgentUrl.replace(/\/$/, "")}/agent/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(msg),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`candidate-agent ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as unknown;
    const parsed = parseHapMessage(body);
    if (!parsed) throw new Error(`candidate-agent returned invalid HAP message`);
    return parsed as T;
  } finally {
    clearTimeout(t);
  }
}

async function generateQuestions(jd: JobDescription, n: number): Promise<string[]> {
  if (!activeProvider()) {
    // Fallback: template questions
    return [
      `What's your experience with ${jd.must_have[0] ?? "the role"}?`,
      `Tell me about a specific project related to ${jd.domain ?? "this domain"}.`,
      `What's a hard technical problem you've solved recently?`,
    ].slice(0, n);
  }

  const parsed = await callLLMJson<{ questions: string[] }>({
    messages: [
      {
        role: "system",
        content: `You generate interview questions for a hiring agent.

Rules:
- Each question targets ONE of the JD's must-have or nice-to-have requirements.
- Questions probe for specific projects, numbers, and evidence — not opinions.
- Be concise. Each question one sentence, under 25 words.
- Variety: technical depth, domain experience, scale handling.

Output JSON only.`,
      },
      {
        role: "user",
        content: `JD title: ${jd.title}\nSummary: ${jd.summary}\nMust-have: ${jd.must_have.join("; ")}\nNice-to-have: ${(jd.nice_to_have ?? []).join("; ")}\n\nGenerate exactly ${n} interview questions.`,
      },
    ],
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["questions"],
      properties: {
        questions: {
          type: "array",
          items: { type: "string" },
          minItems: n,
          maxItems: n,
        },
      },
    },
    schemaName: "interview_questions",
    maxTokens: 400,
  });

  if (!parsed) {
    // Fallback to templates
    return Array.from({ length: n }, (_, i) => `Tell me about your experience with ${jd.must_have[i] ?? jd.title}.`);
  }
  return parsed.questions;
}

async function decideVerdict(
  jd: JobDescription,
  answers: Answer[],
): Promise<{ outcome: SessionClose["outcome"]; summary: string; next_step: SessionClose["next_step"] }> {
  if (!activeProvider()) {
    const decent = answers.filter((a) => a.answer.confidence !== "low" && !a.answer.decline_reason).length;
    return {
      outcome: decent >= 2 ? "fit" : "unclear",
      summary: `[no-LLM] ${decent}/${answers.length} answers were high/medium confidence with evidence.`,
      next_step: decent >= 2 ? "schedule_human_interview" : "human_follow_up",
    };
  }
  const ctx = answers.map((a, i) => `Q${i + 1} answer (conf=${a.answer.confidence}${a.answer.decline_reason ? `, declined=${a.answer.decline_reason}` : ""}): ${a.answer.text}`).join("\n\n");
  const parsed = await callLLMJson<{
    outcome: SessionClose["outcome"];
    summary: string;
    next_step: SessionClose["next_step"];
  }>({
    messages: [
      {
        role: "system",
        content: `You are an HR-agent making a fit verdict from interview answers.

outcome options:
- "fit": clear evidence the candidate matches must-haves. Schedule human interview.
- "no_fit": clear gaps on must-haves or evidence is weak.
- "unclear": needs human follow-up to investigate.
- "candidate_declined": candidate declined the session entirely (different path; you won't be called in that case usually).

next_step:
- "schedule_human_interview" when outcome = fit
- "human_follow_up" when outcome = unclear
- "archive" when outcome = no_fit

Output JSON only. Summary <= 500 chars, no PII.`,
      },
      {
        role: "user",
        content: `JD: ${jd.title}\nMust-have: ${jd.must_have.join("; ")}\n\nInterview answers:\n${ctx}\n\nDeliver verdict.`,
      },
    ],
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["outcome", "summary", "next_step"],
      properties: {
        outcome: { type: "string", enum: ["fit", "no_fit", "unclear", "candidate_declined"] },
        summary: { type: "string" },
        next_step: { type: "string", enum: ["schedule_human_interview", "human_follow_up", "archive"] },
      },
    },
    schemaName: "interview_verdict",
    maxTokens: 400,
  });
  if (!parsed) {
    return { outcome: "unclear", summary: "LLM verdict failed; defaulted to unclear.", next_step: "human_follow_up" };
  }
  return parsed;
}

export interface InterviewOptions {
  candidateAgentUrl: string;
  jd: JobDescription;
  hr: HrIdentity;
  numQuestions?: number;
  timeoutMs?: number;
  /** Hook called per message in the loop — useful for streaming UI. */
  onMessage?: (direction: "out" | "in", msg: HapMessage) => void;
}

export async function runInterview(opts: InterviewOptions): Promise<InterviewResult> {
  const t0 = Date.now();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const numQ = opts.numQuestions ?? DEFAULT_NUM_QUESTIONS;
  const sessionId = genSessionId();

  const openMsg: SessionOpen = {
    kind: "hap.session.open",
    session_id: sessionId,
    jd: opts.jd,
    from: opts.hr,
  };
  opts.onMessage?.("out", openMsg);

  let openReply: SessionAccept | SessionDecline;
  try {
    openReply = await postMessage<SessionAccept | SessionDecline>(
      opts.candidateAgentUrl,
      openMsg,
      timeoutMs,
    );
  } catch (err) {
    return {
      candidateAgentUrl: opts.candidateAgentUrl,
      sessionId,
      status: "error",
      errorReason: err instanceof Error ? err.message : String(err),
      questions: [],
      answers: [],
      verdict: null,
      elapsedMs: Date.now() - t0,
    };
  }
  opts.onMessage?.("in", openReply);

  if (openReply.kind === "hap.session.decline") {
    return {
      candidateAgentUrl: opts.candidateAgentUrl,
      sessionId,
      status: "declined",
      declineReason: openReply.reason,
      questions: [],
      answers: [],
      verdict: null,
      elapsedMs: Date.now() - t0,
    };
  }

  const questionTexts = await generateQuestions(opts.jd, numQ);
  const asks: Ask[] = [];
  const answers: Answer[] = [];

  for (let i = 0; i < questionTexts.length; i++) {
    const ask: Ask = {
      kind: "hap.ask",
      session_id: sessionId,
      question_id: `q${i + 1}`,
      ask: { type: "open", prompt: questionTexts[i] },
    };
    asks.push(ask);
    opts.onMessage?.("out", ask);
    try {
      const reply = await postMessage<Answer>(opts.candidateAgentUrl, ask, timeoutMs);
      opts.onMessage?.("in", reply);
      if (reply.kind === "hap.answer") answers.push(reply);
    } catch (err) {
      // Continue with other questions on error
      console.warn(`[interview] question ${i + 1} failed:`, err);
    }
  }

  const verdict = await decideVerdict(opts.jd, answers);
  const closeMsg: SessionClose = {
    kind: "hap.session.close",
    session_id: sessionId,
    outcome: verdict.outcome,
    summary: verdict.summary,
    next_step: verdict.next_step,
  };
  opts.onMessage?.("out", closeMsg);
  // Best-effort, don't fail if candidate-agent is gone
  postMessage(opts.candidateAgentUrl, closeMsg, timeoutMs).catch(() => {});

  return {
    candidateAgentUrl: opts.candidateAgentUrl,
    sessionId,
    status: "completed",
    questions: asks,
    answers,
    verdict: closeMsg,
    elapsedMs: Date.now() - t0,
  };
}

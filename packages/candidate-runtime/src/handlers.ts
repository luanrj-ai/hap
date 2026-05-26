/**
 * HAP message handlers for the candidate-agent.
 *
 * For each incoming HAP message kind, decide what to do and return the
 * appropriate response message (or null for fire-and-forget).
 *
 * The candidate-agent's job is: be the candidate's representative.
 *   - On session.open: decide accept / decline based on JD vs preferences
 *   - On ask: produce an answer with cited evidence
 *   - On session.close: log and forget
 */
import {
  type Ask,
  type Answer,
  type Evidence,
  type HapMessage,
  type SessionAccept,
  type SessionClose,
  type SessionDecline,
  type SessionOpen,
} from "@hap/a2a-adapter";
import { callLLMJson, activeProvider } from "@resumetruth/scoring/llm-client";
import type { CandidateProfile } from "./profile";

export interface HandlerResponse {
  ok: boolean;
  response: HapMessage | null;
  error?: string;
}

/** session.open → decide accept / decline. */
export function handleSessionOpen(
  msg: SessionOpen,
  profile: CandidateProfile,
): SessionAccept | SessionDecline {
  const prefs = profile.preferences ?? {};

  // Hard switch: not looking
  if (prefs.open_to_offers === false) {
    return {
      kind: "hap.session.decline",
      session_id: msg.session_id,
      reason: "not_seeking",
      note: "Candidate is not currently open to offers.",
    };
  }

  // Domain disinterest filter
  const lc = (msg.jd.title + " " + msg.jd.summary).toLowerCase();
  const disinterested = (prefs.domains_of_disinterest ?? []).find((d) =>
    lc.includes(d.toLowerCase()),
  );
  if (disinterested) {
    return {
      kind: "hap.session.decline",
      session_id: msg.session_id,
      reason: "domain_mismatch",
      note: `Not interested in ${disinterested}.`,
    };
  }

  // Seniority filter (rough heuristic — JD with "senior" / "staff" / "principal")
  if (prefs.min_seniority_match && profile.seniority) {
    const seniorityLevels = ["junior", "mid", "senior", "staff", "principal"];
    const myLevel = seniorityLevels.indexOf(profile.seniority);
    const jdLooksSenior = /\b(staff|principal)\b/i.test(lc) && myLevel < 3;
    if (jdLooksSenior) {
      return {
        kind: "hap.session.decline",
        session_id: msg.session_id,
        reason: "domain_mismatch",
        note: `JD looks staff/principal-level, candidate is ${profile.seniority}.`,
      };
    }
  }

  return { kind: "hap.session.accept", session_id: msg.session_id };
}

/** ask → produce an answer with evidence citations. */
export async function handleAsk(
  msg: Ask,
  profile: CandidateProfile,
): Promise<Answer> {
  // Build the candidate-side context
  const ctx = [
    `Candidate: ${profile.name}`,
    profile.tagline ? `Tagline: ${profile.tagline}` : "",
    `Seniority: ${profile.seniority ?? "unspecified"}`,
    profile.specializations ? `Specializations: ${profile.specializations.join(", ")}` : "",
    "",
    "Evidence sources I can cite:",
    ...profile.evidenceSources.map(
      (e, i) => `  [${i}] ${e.type}: ${e.url}${e.title ? ` — ${e.title}` : ""}${e.venue ? ` (${e.venue})` : ""}${e.note ? ` — ${e.note}` : ""}`,
    ),
  ].filter(Boolean).join("\n");

  if (!activeProvider()) {
    // No LLM: return a stub that cites all evidence
    return {
      kind: "hap.answer",
      session_id: msg.session_id,
      question_id: msg.question_id,
      answer: {
        text: `[no-LLM mode] ${profile.name} would normally answer with LLM. Question was: ${msg.ask.prompt}`,
        evidence: profile.evidenceSources.slice(0, 3),
        confidence: "low",
        decline_reason: null,
      },
    };
  }

  const parsed = await callLLMJson<{
    answerText: string;
    citedIndexes: number[];
    confidence: "low" | "medium" | "high";
    declineReason: string | null;
  }>({
    messages: [
      {
        role: "system",
        content: `You are a candidate's HAP agent. You answer interview questions concisely using the candidate's CV facts.

Rules:
- Only cite evidence sources by index. Don't make up new URLs.
- If a question is outside your evidence, say so honestly and set declineReason to "no_evidence".
- If a question asks for private info (salary, contact), declineReason="private".
- Keep answers under 3 short sentences. HR-agent will follow up if needed.
- Confidence reflects how strongly the cited evidence supports the answer.`,
      },
      {
        role: "user",
        content: `${ctx}\n\n---\n\nHR-agent question: ${msg.ask.prompt}\n\nReturn JSON {answerText, citedIndexes, confidence, declineReason}.`,
      },
    ],
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["answerText", "citedIndexes", "confidence", "declineReason"],
      properties: {
        answerText: { type: "string" },
        citedIndexes: { type: "array", items: { type: "integer" } },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        declineReason: { type: ["string", "null"], enum: [null, "private", "not_applicable", "no_evidence", "out_of_scope"] },
      },
    },
    schemaName: "candidate_answer",
    maxTokens: 600,
  });

  if (!parsed) {
    return {
      kind: "hap.answer",
      session_id: msg.session_id,
      question_id: msg.question_id,
      answer: {
        text: "[LLM call failed] Unable to formulate an answer right now.",
        evidence: [],
        confidence: "low",
        decline_reason: "out_of_scope",
      },
    };
  }

  const evidence: Evidence[] = parsed.citedIndexes
    .filter((i) => Number.isInteger(i) && i >= 0 && i < profile.evidenceSources.length)
    .slice(0, 6)
    .map((i) => profile.evidenceSources[i]);

  return {
    kind: "hap.answer",
    session_id: msg.session_id,
    question_id: msg.question_id,
    answer: {
      text: parsed.answerText.slice(0, 4000),
      evidence,
      confidence: parsed.confidence,
      decline_reason: (parsed.declineReason as Answer["answer"]["decline_reason"]) ?? null,
    },
  };
}

/** session.close → log only, no response needed. */
export function handleSessionClose(msg: SessionClose): void {
  console.log(
    `[candidate-runtime] session ${msg.session_id} closed: ${msg.outcome} — ${msg.summary.slice(0, 100)}`,
  );
}

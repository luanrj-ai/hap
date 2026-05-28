/**
 * Neutral scorer for a HAP application (v0.2 draft).
 *
 * The fairness core: the score depends on DEREFERENCED, VERIFIED evidence and
 * its relevance — never on the candidate-agent's prose or its self-reported
 * `confidence`. A better-written or sneakier agent earns nothing here; only
 * real, attributable artifacts do. Runs on the employer/neutral side, not on
 * the candidate's machine.
 *
 * Pipeline per rubric item:
 *   1. verify each cited evidence link  (verifiers/evidence)
 *   2. judge relevance from the verified FACTS only (LLM, or keyword fallback)
 *   3. strength = f(level, relevance); item score = max over its evidence
 * Then: required-item gating, weighted aggregate, integrity/quality flags.
 */
import type { Application, Evidence, Posting } from "@hap/a2a-adapter";
import { activeProvider, callLLMJson } from "./llm-client";
import { extractGitHubUser, verifyGitHubUser } from "./verifiers/github";
import {
  verifyEvidence,
  verifyProofOfControl,
  type IdentityAnchor,
  type ProofOfControl,
  type ProofResult,
  type VerificationLevel,
  type VerificationResult,
} from "./verifiers/evidence";

// This module is the public entry point for the HAP application scorer
// (imported as "@resumetruth/scoring/score-application"). Re-export the
// evidence-verifier surface so consumers get everything from one subpath.
export { verifyEvidence, verifyProofOfControl } from "./verifiers/evidence";
export type {
  IdentityAnchor,
  ProofOfControl,
  ProofResult,
  VerificationLevel,
  VerificationResult,
} from "./verifiers/evidence";

type Relevance = "strong" | "partial" | "none";

export interface EvidenceScore {
  url: string;
  type: string;
  level: VerificationLevel;
  relevance: Relevance | "n/a";
  strength: number;
  note: string;
}

export interface ItemScore {
  question_id: string;
  requirement: string;
  required: boolean;
  score: number;
  bestLevel: VerificationLevel | "declined";
  declineReason?: string | null;
  evidence: EvidenceScore[];
}

export interface ScoreReport {
  verdict: "fit" | "partial" | "no_fit";
  /** 0..1 weighted aggregate. */
  overall: number;
  requiredAllPass: boolean;
  items: ItemScore[];
  /** Human-readable integrity / quality flags. */
  flags: string[];
  identity: { anchor?: string; proven: boolean; note: string };
  usedLLM: boolean;
  scoredAt: string;
}

const REQUIRED_PASS = 0.5;
const W_REQUIRED = 0.7;
const W_NICE = 0.3;

function requirementOf(prompt: string): string {
  return prompt.match(/Show evidence for:\s*(.+?)\.\s/i)?.[1] ?? prompt;
}

// `unverifiable` (0.1) and `fabricated` (gate) are handled in the loop before
// this is called, since neither has facts to judge relevance against.
function strength(level: VerificationLevel, relevance: Relevance): number {
  if (relevance === "none") return 0;
  if (level === "verified") return relevance === "strong" ? 1.0 : 0.6;
  if (level === "exists_unlinked") return relevance === "strong" ? 0.5 : 0.3;
  return 0;
}

const UNVERIFIABLE_STRENGTH = 0.1;

function keywordRelevance(requirement: string, facts: string): Relevance {
  const f = facts.toLowerCase();
  const words = Array.from(new Set(requirement.toLowerCase().match(/[a-z][a-z0-9+]{3,}/g) ?? []));
  const hits = words.filter((w) => f.includes(w)).length;
  return hits >= 2 ? "strong" : hits === 1 ? "partial" : "none";
}

async function judgeRelevance(requirement: string, facts: string): Promise<Relevance> {
  if (!facts) return "none";
  if (!activeProvider()) return keywordRelevance(requirement, facts);
  const parsed = await callLLMJson<{ relevance: Relevance }>({
    messages: [
      {
        role: "system",
        content:
          "Judge whether an artifact supports a hiring requirement, using ONLY the supplied artifact facts. Never assume anything not in the facts. strong = facts directly demonstrate the requirement; partial = adjacent/suggestive; none = unrelated. Output JSON only.",
      },
      { role: "user", content: `Requirement: ${requirement}\n\nArtifact facts (verified, machine-read): ${facts}\n\nRelevance?` },
    ],
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["relevance"],
      properties: { relevance: { type: "string", enum: ["strong", "partial", "none"] } },
    },
    schemaName: "relevance",
    maxTokens: 50,
  });
  return parsed?.relevance ?? keywordRelevance(requirement, facts);
}

async function deriveAnchor(app: Application): Promise<IdentityAnchor> {
  const gh = (app.candidate.profile_evidence ?? []).find((e) => e.type === "github_user");
  let githubLogin: string | undefined;
  if (gh) {
    const u = extractGitHubUser(gh.url);
    if (u) {
      const v = await verifyGitHubUser(u);
      githubLogin = v.exists ? v.login : u;
    }
  }
  return { githubLogin, name: app.candidate.name };
}

export interface ScoreOptions {
  /** Force keyword relevance even when an LLM key is present (tests). */
  noLLM?: boolean;
  /** Injectable verifier (defaults to the live one). For tests / custom registries. */
  verify?: (ev: Evidence, anchor: IdentityAnchor) => Promise<VerificationResult>;
  /** Injectable proof-of-control verifier (defaults to the live one). */
  verifyProof?: (poc: ProofOfControl, anchor: IdentityAnchor) => Promise<ProofResult>;
}

export async function scoreApplication(
  application: Application,
  posting: Posting,
  opts: ScoreOptions = {},
): Promise<ScoreReport> {
  const anchor = await deriveAnchor(application);
  const verify = opts.verify ?? verifyEvidence;
  const usedLLM = !opts.noLLM && activeProvider() !== null;
  const byQ = new Map(application.responses.map((r) => [r.question_id, r]));

  // Proof-of-control: does the candidate actually control the anchor account?
  let identityProven = false;
  let identityNote = anchor.githubLogin
    ? `anchored to GitHub @${anchor.githubLogin} (asserted, not proof-of-control verified)`
    : "no GitHub identity anchor provided";
  const poc = application.candidate.proof_of_control;
  const fabrications: string[] = [];
  const items: ItemScore[] = [];

  for (const ask of posting.rubric) {
    const required = ask.required;
    const requirement = requirementOf(ask.ask.prompt);
    const resp = byQ.get(ask.question_id);
    const answer = resp?.answer;

    if (!answer || answer.decline_reason || answer.evidence.length === 0) {
      items.push({
        question_id: ask.question_id,
        requirement,
        required,
        score: 0,
        bestLevel: "declined",
        declineReason: answer?.decline_reason ?? (answer ? "no_evidence" : "no_answer"),
        evidence: [],
      });
      continue;
    }

    const scored: EvidenceScore[] = [];
    for (const ev of answer.evidence) {
      const v: VerificationResult = await verify(ev, anchor);
      if (v.level === "fabricated") {
        fabrications.push(ev.url);
        scored.push({ url: ev.url, type: ev.type, level: v.level, relevance: "n/a", strength: 0, note: v.note });
        continue;
      }
      if (v.level === "unverifiable") {
        // Can't dereference → can't judge relevance. Small fixed benefit of the doubt.
        scored.push({ url: ev.url, type: ev.type, level: v.level, relevance: "n/a", strength: UNVERIFIABLE_STRENGTH, note: v.note });
        continue;
      }
      const relevance = opts.noLLM ? keywordRelevance(requirement, v.facts) : await judgeRelevance(requirement, v.facts);
      scored.push({ url: ev.url, type: ev.type, level: v.level, relevance, strength: strength(v.level, relevance), note: v.note });
    }

    const best = scored.reduce((a, b) => (b.strength > a.strength ? b : a), scored[0]);
    items.push({
      question_id: ask.question_id,
      requirement,
      required,
      score: Math.max(0, best.strength),
      bestLevel: best.strength > 0 ? best.level : "declined",
      evidence: scored,
    });
  }

  // ---- aggregate ----
  const reqScores = items.filter((i) => i.required).map((i) => i.score);
  const niceScores = items.filter((i) => !i.required).map((i) => i.score);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const avgR = mean(reqScores);
  const avgN = mean(niceScores);

  let overall: number;
  if (avgR !== null && avgN !== null) overall = W_REQUIRED * avgR + W_NICE * avgN;
  else overall = avgR ?? avgN ?? 0;

  const requiredAllPass = reqScores.every((s) => s >= REQUIRED_PASS);

  // ---- verdict (fabrication and required-gating come first) ----
  let verdict: ScoreReport["verdict"];
  if (fabrications.length) verdict = "no_fit";
  else if (!requiredAllPass) verdict = "no_fit";
  else if (overall >= 0.7) verdict = "fit";
  else if (overall >= 0.4) verdict = "partial";
  else verdict = "no_fit";

  // ---- flags ----
  const flags: string[] = [];
  for (const url of fabrications) flags.push(`fabrication: cited evidence does not exist — ${url}`);

  if (poc) {
    const pr = await (opts.verifyProof ?? verifyProofOfControl)(poc, anchor);
    identityProven = pr.proven;
    identityNote = pr.proven ? `proof-of-control verified — ${pr.note}` : `proof-of-control claimed but failed — ${pr.note}`;
    flags.push(pr.proven ? `✅ identity proven: ${pr.note}` : `proof_of_control failed: ${pr.note}`);
  }

  const positive = items.filter((i) => i.score > 0);
  const unverifiedHeavy = positive.filter((i) => i.bestLevel === "unverifiable").length;
  if (positive.length > 0 && unverifiedHeavy >= Math.ceil(positive.length / 2)) {
    flags.push("score relies mostly on unverifiable claims — treat with caution");
  }

  const selfFit = application.self_assessment?.fit;
  if (selfFit === "strong" && verdict !== "fit") {
    flags.push(`overclaim: self-assessed "strong" but verified evidence supports "${verdict}"`);
  } else if (selfFit === "stretch" && verdict === "fit") {
    flags.push(`humble: self-assessed "stretch" but verified evidence supports "fit"`);
  }

  return {
    verdict,
    overall: Math.round(overall * 100) / 100,
    requiredAllPass,
    items,
    flags,
    identity: { anchor: anchor.githubLogin, proven: identityProven, note: identityNote },
    usedLLM,
    scoredAt: new Date().toISOString(),
  };
}

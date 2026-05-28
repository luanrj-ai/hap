/**
 * Candidate-side rough match estimate: does this posting plausibly fit me?
 *
 * Used to RANK target postings and to GATE full-auto apply (only auto-apply
 * above a threshold). This is a cheap local heuristic over public evidence +
 * specializations — NOT the authoritative employer score (that's the neutral
 * scorer, which dereferences and verifies). Keep them distinct on purpose.
 */
import type { Posting } from "@hap/a2a-adapter";
import type { CandidateProfile } from "./profile";

export interface MatchItem {
  question_id: string;
  requirement: string;
  required: boolean;
  hit: boolean;
}

export interface MatchResult {
  /** 0..1 weighted fraction of requirements with a keyword hit. */
  score: number;
  items: MatchItem[];
}

function requirementOf(prompt: string): string {
  return prompt.match(/Show evidence for:\s*(.+?)\.\s/i)?.[1] ?? prompt;
}

function keywords(s: string): string[] {
  return Array.from(new Set(s.toLowerCase().match(/[a-z][a-z0-9+]{3,}/g) ?? []));
}

export function estimateMatch(profile: CandidateProfile, posting: Posting): MatchResult {
  const corpus = [
    profile.tagline ?? "",
    ...(profile.specializations ?? []),
    ...profile.evidenceSources.map((e) => `${e.note ?? ""} ${e.title ?? ""} ${e.url}`),
  ]
    .join(" ")
    .toLowerCase();

  const items: MatchItem[] = posting.rubric.map((r) => {
    const requirement = requirementOf(r.ask.prompt);
    const hit = keywords(requirement).some((w) => corpus.includes(w));
    return { question_id: r.question_id, requirement, required: r.required, hit };
  });

  const weight = (required: boolean) => (required ? 1 : 0.5);
  const total = items.reduce((s, i) => s + weight(i.required), 0);
  const got = items.reduce((s, i) => s + (i.hit ? weight(i.required) : 0), 0);
  return { score: total ? Math.round((got / total) * 100) / 100 : 0, items };
}

/**
 * Candidate profile config — what the candidate-agent knows about itself.
 * In production this loads from a YAML / JSON file the candidate maintains.
 */
import type { Evidence } from "@hap/a2a-adapter";

export interface CandidateProfile {
  /** Display name. Not validated — agent trust is per-URL, not per-name. */
  name: string;
  /** Optional tagline / one-liner. */
  tagline?: string;
  /** Public web presence URLs the agent will use as evidence sources. */
  evidenceSources: Evidence[];
  /** Self-declared seniority for filter purposes. */
  seniority?: "junior" | "mid" | "senior" | "staff" | "principal";
  /** Self-declared specializations / domain focus. */
  specializations?: string[];
  /** Soft constraints to apply when deciding to engage. */
  preferences?: {
    domains_of_interest?: string[];
    domains_of_disinterest?: string[];
    min_seniority_match?: boolean;     // refuse if JD asks for senior+ and we are junior
    open_to_offers?: boolean;          // hard switch
  };
  /** How to reach human if HR-agent wants direct contact. */
  human_contact?: string;
}

export const EXAMPLE_PROFILE: CandidateProfile = {
  name: "Alex Chen",
  tagline: "Senior backend engineer · payments / distributed systems",
  evidenceSources: [
    { type: "github_user", url: "https://github.com/alex-chen", note: "primary OSS handle" },
    { type: "github_repo", url: "https://github.com/alex-chen/ratelimit-go", note: "1.2k stars" },
    { type: "talk", url: "https://youtu.be/example", venue: "GopherCon 2024", title: "Designing Idempotent Payment APIs" },
    { type: "personal_site", url: "https://alex-chen.dev" },
    { type: "linkedin", url: "https://linkedin.com/in/alexchen" },
  ],
  seniority: "senior",
  specializations: ["payments", "idempotency", "high-throughput APIs", "Go"],
  preferences: {
    domains_of_interest: ["payments", "fintech", "infrastructure"],
    domains_of_disinterest: ["adtech", "crypto-trading"],
    min_seniority_match: true,
    open_to_offers: true,
  },
  human_contact: "alex@example.com",
};

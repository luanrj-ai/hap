/**
 * A2A AgentCard generator for HAP agents, published at /.well-known/agent.json.
 *
 * Declares the HAP skill + role so any A2A runtime can discover that this agent
 * speaks HAP, which version(s), and where it publishes its profile/postings
 * (the agent2agent discovery entry points).
 */
import { HAP_VERSION, type EvidenceType } from "./schemas";
import { HAP_DRAFT_VERSION } from "./async-schemas";

// "hr" kept for v0.1 back-compat; "employer" is the v0.2 name.
export type HapRole = "candidate" | "hr" | "employer" | "index";

export interface HapAgentCardInput {
  name: string;
  description: string;
  url: string; // canonical agent URL
  role: HapRole;
  /** Evidence types this agent will issue (candidate) or accept (employer/index). */
  supportedEvidenceTypes: EvidenceType[];
  ratePerDay?: number;
  ratePerHour?: number;
  humanContact?: string;
  /** Candidate: URL of the published hap.profile (e.g. /.well-known/hap-profile.json). */
  profileUrl?: string;
  /** Employer: URL listing published hap.postings. */
  postingsUrl?: string;
  /** Additional A2A skill IDs this agent supports. */
  additionalSkills?: string[];
}

export interface AgentCard {
  name: string;
  description: string;
  url: string;
  skills: string[];
  hap: {
    role: HapRole;
    supported_versions: string[];
    supported_evidence_types: EvidenceType[];
    rate_limit: { per_day: number; per_hour: number };
    human_contact?: string;
    profile_url?: string;
    postings_url?: string;
  };
}

export function buildAgentCard(input: HapAgentCardInput): AgentCard {
  const skills = [
    `hap.v${HAP_VERSION}`, // v0.1 (live interview, L1)
    `hap.v${HAP_DRAFT_VERSION}`, // v0.2 (async, candidate-initiated, discovery)
    `hap.${input.role}`,
    ...(input.additionalSkills ?? []),
  ];
  return {
    name: input.name,
    description: input.description,
    url: input.url,
    skills,
    hap: {
      role: input.role,
      supported_versions: [HAP_VERSION, HAP_DRAFT_VERSION],
      supported_evidence_types: input.supportedEvidenceTypes,
      rate_limit: {
        per_day: input.ratePerDay ?? 100,
        per_hour: input.ratePerHour ?? 20,
      },
      ...(input.humanContact ? { human_contact: input.humanContact } : {}),
      ...(input.profileUrl ? { profile_url: input.profileUrl } : {}),
      ...(input.postingsUrl ? { postings_url: input.postingsUrl } : {}),
    },
  };
}

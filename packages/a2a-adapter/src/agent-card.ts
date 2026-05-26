/**
 * A2A AgentCard generator for HAP agents.
 * Both candidate-agents and HR-agents publish one of these at
 *   /.well-known/agent.json
 * per the A2A protocol standard.
 */
import { HAP_VERSION, type EvidenceType } from "./schemas";

export type HapRole = "candidate" | "hr";

export interface HapAgentCardInput {
  name: string;
  description: string;
  url: string;                  // canonical agent URL
  role: HapRole;
  /** Evidence types this agent will issue (candidate) or accept (HR). */
  supportedEvidenceTypes: EvidenceType[];
  ratePerDay?: number;
  ratePerHour?: number;
  humanContact?: string;
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
  };
}

export function buildAgentCard(input: HapAgentCardInput): AgentCard {
  const baseSkills = [`hap.v${HAP_VERSION}`, `hap.${input.role}`];
  return {
    name: input.name,
    description: input.description,
    url: input.url,
    skills: [...baseSkills, ...(input.additionalSkills ?? [])],
    hap: {
      role: input.role,
      supported_versions: [HAP_VERSION],
      supported_evidence_types: input.supportedEvidenceTypes,
      rate_limit: {
        per_day: input.ratePerDay ?? 100,
        per_hour: input.ratePerHour ?? 20,
      },
      ...(input.humanContact ? { human_contact: input.humanContact } : {}),
    },
  };
}

/**
 * Job description config — what the HR-agent knows about the open role.
 * Used both to populate hap.session.open and to drive question generation.
 */
export interface JobDescription {
  title: string;
  summary: string;
  must_have: string[];
  nice_to_have?: string[];
  /** Optional domain tag for routing / candidate-side filtering. */
  domain?: string;
  external_url?: string;
}

export interface HrIdentity {
  agent_url: string;
  company?: string;
  human_contact?: string;
}

export const EXAMPLE_JD: JobDescription = {
  title: "Senior Backend Engineer · Payments",
  summary:
    "Design and operate high-throughput payment APIs (>10k RPS). Deep ownership of idempotency, retries, distributed transactions. 5+ yrs required.",
  must_have: [
    "5+ years backend engineering",
    "Payments / fintech domain experience",
    "Strong Go or Rust",
    "Idempotency / distributed transactions",
  ],
  nice_to_have: [
    "Open source contributions",
    "Public talks or technical writing",
    "On-call experience for tier-1 services",
  ],
  domain: "payments",
};

export const EXAMPLE_HR: HrIdentity = {
  agent_url: "http://localhost:4002",
  company: "Acme Corp",
  human_contact: "hiring@acme.example",
};

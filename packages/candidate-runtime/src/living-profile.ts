/**
 * Build a candidate's living, candidate-OWNED profile (the single-player
 * artifact). Useful with zero employers — it's your résumé that keeps itself
 * up to date — and opt-in publishable into a discovery index later.
 *
 * Two sources, kept strictly separate:
 *   - PUBLIC GitHub  → verifiable evidence (the part a scorer can dereference)
 *   - LOCAL Claude footprint (opt-in) → self-reported context, never scored
 * Where a Claude project name maps to a public repo, it's cross-linked so that
 * slice becomes verifiable.
 */
import { ProfileCardZ, type CcFootprintItem, type ProfileCard } from "@hap/a2a-adapter";
import { gatherProfile } from "./gather";
import { readClaudeFootprint } from "./claude-footprint";

export interface BuildProfileOptions {
  handle: string;
  contact?: string;
  proof?: { method: "github_gist"; url: string };
  /** Opt-in: read LOCAL Claude Code footprint metadata (the candidate's own data). */
  includeClaude?: boolean;
  /** Override the Claude transcript root (tests). */
  claudeBaseDir?: string;
  /** Roles the candidate is open to (coarse routing for discovery). */
  openTo?: string[];
  /** Where recruiters reach the candidate (only needed once discoverable). */
  inboxEndpoint?: string;
}

export interface BuildProfileResult {
  profile: ProfileCard;
  warnings: string[];
}

export async function buildLivingProfile(opts: BuildProfileOptions): Promise<BuildProfileResult> {
  const warnings: string[] = [];

  const { profile: cand, warnings: gw } = await gatherProfile(opts.handle, {
    contact: opts.contact,
    proof: opts.proof,
  });
  warnings.push(...gw);

  let cc_footprint: CcFootprintItem[] | undefined;
  if (opts.includeClaude) {
    const fp = readClaudeFootprint(opts.claudeBaseDir);
    warnings.push(...fp.warnings);
    // Cross-link a Claude project to a public repo of the same name → verifiable.
    const repoByName = new Map(
      cand.evidenceSources
        .filter((e) => e.type === "github_repo")
        .map((e) => [e.url.split("/").pop()!.toLowerCase(), e.url] as const),
    );
    cc_footprint = fp.projects.slice(0, 30).map((p) => ({
      project: p.project,
      sessions: p.sessions,
      last_active: p.lastActive,
      repo_url: repoByName.get(p.project.toLowerCase()),
      self_reported: true as const,
    }));
  }

  const inbox = opts.inboxEndpoint
    ? { endpoint: opts.inboxEndpoint }
    : opts.contact
      ? { endpoint: `mailto:${opts.contact}`, transport: "mailto" as const }
      : undefined;

  const profile = ProfileCardZ.parse({
    kind: "hap.profile",
    generated_at: new Date().toISOString(),
    candidate: {
      name: cand.name,
      headline: cand.tagline,
      specializations: cand.specializations,
      profile_evidence: cand.evidenceSources.slice(0, 12),
      cc_footprint,
      proof_of_control: opts.proof,
      inbox,
      open_to: opts.openTo,
    },
  });

  return { profile, warnings };
}

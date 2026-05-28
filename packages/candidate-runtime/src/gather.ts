/**
 * Build a candidate profile automatically from a PUBLIC GitHub handle.
 *
 * This is the convenience unlock: instead of hand-writing a profile.json, a
 * technical IC just gives their GitHub username and the agent assembles the
 * evidence sources from their public footprint. Both the web ("Sign in with
 * GitHub") and CLI (`apply --handle`) flows sit on top of this.
 *
 * Privacy by construction: it reads ONLY the public GitHub API — never the
 * candidate's local machine or private repos. (Scanning a work laptop for
 * private repos to apply elsewhere is an NDA/legal hazard, and unverifiable
 * private signals score ~nothing anyway.) Identity is asserted here; the
 * caller supplies proof-of-control (gist now, OAuth once configured).
 */
import type { Evidence } from "@hap/a2a-adapter";
import { verifyGitHubUser, extractGitHubUser } from "@resumetruth/scoring/verifiers/github";
import type { CandidateProfile } from "./profile";

export interface GatherOptions {
  /** Contact the candidate consents to share (only goes out on submit). */
  contact?: string;
  /** Proof of control over the GitHub identity anchor (gist URL). */
  proof?: { method: "github_gist"; url: string };
  /** Max repos to cite as evidence. */
  maxRepos?: number;
}

export interface GatherResult {
  profile: CandidateProfile;
  /** Non-fatal notes (e.g. rate-limited, account not found). */
  warnings: string[];
}

export async function gatherProfile(handleOrUrl: string, opts: GatherOptions = {}): Promise<GatherResult> {
  const warnings: string[] = [];
  const login =
    extractGitHubUser(handleOrUrl.includes("github.com") ? handleOrUrl : `https://github.com/${handleOrUrl}`) ??
    handleOrUrl.trim();

  const gh = await verifyGitHubUser(login);
  if (gh.error) warnings.push(`GitHub: ${gh.error} — profile is partial`);
  if (!gh.error && !gh.exists) warnings.push(`GitHub user @${login} not found`);

  const canonical = gh.login ?? login;
  const evidenceSources: Evidence[] = [
    {
      type: "github_user",
      url: `https://github.com/${canonical}`,
      note: gh.exists
        ? `${gh.publicRepos ?? 0} public repos · ${gh.followers ?? 0} followers · ~${gh.accountAgeDays ?? "?"}d`
        : undefined,
    },
  ];

  for (const r of (gh.topRepos ?? []).slice(0, opts.maxRepos ?? 5)) {
    evidenceSources.push({
      type: "github_repo",
      url: `https://github.com/${canonical}/${r.name}`,
      note: `${r.stars}★${r.lang ? ` · ${r.lang}` : ""}`,
    });
  }

  // A profile "blog" URL is often a personal site — cite it, candidate can drop it.
  if (gh.blog) {
    let url = gh.blog;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      new URL(url);
      evidenceSources.push({ type: "personal_site", url });
    } catch {
      /* skip malformed blog url */
    }
  }

  const profile: CandidateProfile = {
    name: gh.name || canonical,
    tagline: gh.topLanguages?.length ? `Works mainly in ${gh.topLanguages.join(", ")}` : undefined,
    evidenceSources,
    specializations: gh.topLanguages,
    human_contact: opts.contact,
    proof_of_control: opts.proof,
  };

  return { profile, warnings };
}

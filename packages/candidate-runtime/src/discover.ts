/**
 * Discover target companies for a candidate, then keep only the ones with a
 * real, official application channel.
 *
 * Sources of candidate companies: (a) hints the candidate names, (b) optional
 * LLM suggestions from the candidate's specializations. Either way, each is run
 * through findApplicationContact (reads the company's OWN careers/contact page)
 * and only surfaced if a genuine channel is found — which doubles as the
 * anti-hallucination filter (a made-up company has no reachable channel) and
 * the anti-spam guard (official channels only, small cap, recommend-not-blast).
 */
import type { CandidateProfile } from "./profile";
import { findApplicationContact } from "./find-contact";
import { activeProvider, callLLMJson } from "@resumetruth/scoring/llm-client";

export interface Target {
  company: string;
  domain?: string;
  careersUrl?: string;
  email?: string;
  source: "hint" | "llm";
  reachable: boolean;
  note?: string;
}

export interface DiscoverOptions {
  profile: CandidateProfile;
  /** Companies/domains the candidate explicitly names. */
  hints?: string[];
  /** Let the LLM propose companies from the candidate's specializations. */
  useLLM?: boolean;
  /** Free-text on what the candidate wants (steers LLM suggestions). */
  note?: string;
  /** Cap on reachable targets (anti-spam — keep it small). */
  max?: number;
  fetchImpl?: typeof fetch;
}

async function llmCompanies(opts: DiscoverOptions, n: number): Promise<Array<{ name: string; domain?: string }>> {
  const parsed = await callLLMJson<{ companies: Array<{ name: string; domain?: string }> }>({
    messages: [
      {
        role: "system",
        content:
          "Suggest REAL companies that are plausibly hiring for the candidate's profile. Real, currently-operating companies only — never invent names. Prefer ones with a public careers page. Output JSON only.",
      },
      {
        role: "user",
        content: `Candidate specializations: ${(opts.profile.specializations ?? []).join(", ") || "(unspecified)"}\nWants: ${opts.note ?? "roles matching the above"}\n\nList up to ${n} companies with their primary domain.`,
      },
    ],
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["companies"],
      properties: {
        companies: {
          type: "array",
          maxItems: n,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name"],
            properties: { name: { type: "string" }, domain: { type: "string" } },
          },
        },
      },
    },
    schemaName: "target_companies",
    maxTokens: 400,
  });
  return parsed?.companies ?? [];
}

export async function discoverTargets(opts: DiscoverOptions): Promise<Target[]> {
  const max = opts.max ?? 5;

  const seeds: Array<{ company: string; domain?: string; source: "hint" | "llm" }> = [];
  for (const h of opts.hints ?? []) {
    const t = h.trim();
    if (!t) continue;
    const isDomain = /\.[a-z]{2,}$/i.test(t);
    seeds.push({ company: isDomain ? t.split(".")[0] : t, domain: isDomain ? t : undefined, source: "hint" });
  }
  if (opts.useLLM && activeProvider()) {
    for (const c of await llmCompanies(opts, max + 3)) seeds.push({ company: c.name, domain: c.domain, source: "llm" });
  }

  // dedupe by company name (lowercased)
  const seen = new Set<string>();
  const uniq = seeds.filter((s) => {
    const k = s.company.toLowerCase();
    return seen.has(k) ? false : (seen.add(k), true);
  });

  const targets: Target[] = [];
  let reachableCount = 0;
  for (const s of uniq) {
    const c = await findApplicationContact({ company: s.company, domain: s.domain, fetchImpl: opts.fetchImpl });
    const email = c.emails[0];
    const reachable = !!(email || c.careersUrl);
    targets.push({ company: s.company, domain: s.domain, careersUrl: c.careersUrl, email, source: s.source, reachable, note: c.source });
    if (reachable) reachableCount++;
    if (reachableCount >= max) break;
  }

  // reachable first, then role-based emails (jobs@/careers@) ahead of generic
  const roleish = (e?: string) => (e && /^(jobs|careers|hiring|recruit|talent|people)/i.test(e) ? 1 : 0);
  targets.sort((a, b) => Number(b.reachable) - Number(a.reachable) || roleish(b.email) - roleish(a.email));
  return targets;
}

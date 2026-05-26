/**
 * GitHub API verifier. Resolves a github.com/USER URL to verifiable signals.
 *
 *   - Without GITHUB_TOKEN: 60 req/hour unauth limit (fine for dev/demo)
 *   - With GITHUB_TOKEN: 5000 req/hour
 *
 * Cached 1 hour to survive repeated scores of the same candidate.
 */
import { TTLCache } from "./cache";

export interface GitHubProfile {
  /** True when the user account exists on github.com. */
  exists: boolean;
  /** The login (case-corrected by GitHub) when exists. */
  login?: string;
  publicRepos?: number;
  followers?: number;
  /** Days since account was created. */
  accountAgeDays?: number;
  /** Recent commits (last 90 days, from events API). Capped at 90. */
  recentCommits?: number;
  /** Top languages from the user's most-starred repos. */
  topLanguages?: string[];
  topRepos?: Array<{ name: string; stars: number; lang: string | null }>;
  /** Set when the verifier could not complete (rate-limited, network, etc.). */
  error?: string;
}

const cache = new TTLCache<GitHubProfile>(60 * 60 * 1000); // 1 hour

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ResumeTruth/0.1 (+dev)",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Extract a GitHub username from a URL or "github.com/user" string. */
export function extractGitHubUser(input: string): string | null {
  const m = input.match(/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/);
  if (!m) return null;
  const user = m[1];
  // Skip obvious non-user paths
  if (["sponsors", "orgs", "topics", "trending", "explore", "marketplace", "settings"].includes(user.toLowerCase())) {
    return null;
  }
  return user;
}

async function fetchWithTimeout(url: string, ms = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: authHeaders(), signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function verifyGitHubUser(login: string): Promise<GitHubProfile> {
  const cacheKey = `gh:${login.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    // 1. User profile
    const userRes = await fetchWithTimeout(`https://api.github.com/users/${encodeURIComponent(login)}`);
    if (userRes.status === 404) {
      const result: GitHubProfile = { exists: false };
      cache.set(cacheKey, result);
      return result;
    }
    if (userRes.status === 403) {
      return { exists: false, error: "rate limited (set GITHUB_TOKEN for 5000/h)" };
    }
    if (!userRes.ok) {
      return { exists: false, error: `github user api ${userRes.status}` };
    }
    const user = (await userRes.json()) as {
      login: string;
      public_repos: number;
      followers: number;
      created_at: string;
    };

    const accountAgeDays = Math.floor(
      (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24),
    );

    // 2. Recent activity (events; up to 90 events)
    const eventsRes = await fetchWithTimeout(
      `https://api.github.com/users/${encodeURIComponent(login)}/events/public?per_page=100`,
    );
    let recentCommits = 0;
    if (eventsRes.ok) {
      const events = (await eventsRes.json()) as Array<{
        type: string;
        created_at: string;
        payload?: { commits?: unknown[] };
      }>;
      const ninetyDaysAgo = Date.now() - 90 * 86_400_000;
      for (const ev of events) {
        if (ev.type !== "PushEvent") continue;
        if (new Date(ev.created_at).getTime() < ninetyDaysAgo) continue;
        recentCommits += ev.payload?.commits?.length ?? 0;
      }
    }

    // 3. Top repos (by stars)
    const reposRes = await fetchWithTimeout(
      `https://api.github.com/users/${encodeURIComponent(login)}/repos?sort=updated&per_page=20`,
    );
    let topRepos: GitHubProfile["topRepos"] = [];
    let topLanguages: string[] = [];
    if (reposRes.ok) {
      const repos = (await reposRes.json()) as Array<{
        name: string;
        stargazers_count: number;
        language: string | null;
        fork: boolean;
      }>;
      const own = repos.filter((r) => !r.fork);
      own.sort((a, b) => b.stargazers_count - a.stargazers_count);
      topRepos = own.slice(0, 5).map((r) => ({
        name: r.name,
        stars: r.stargazers_count,
        lang: r.language,
      }));
      const langCount: Record<string, number> = {};
      for (const r of own.slice(0, 10)) {
        if (!r.language) continue;
        langCount[r.language] = (langCount[r.language] ?? 0) + 1;
      }
      topLanguages = Object.entries(langCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([lang]) => lang);
    }

    const result: GitHubProfile = {
      exists: true,
      login: user.login,
      publicRepos: user.public_repos,
      followers: user.followers,
      accountAgeDays,
      recentCommits,
      topLanguages,
      topRepos,
    };
    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { exists: false, error: msg.slice(0, 100) };
  }
}

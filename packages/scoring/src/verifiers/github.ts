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
  /** Display name from the profile, if set. */
  name?: string;
  /** Profile "blog"/website URL, if set (often a personal site). */
  blog?: string;
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
const repoCache = new TTLCache<GitHubRepoInfo>(60 * 60 * 1000);
const commitCache = new TTLCache<GitHubCommitInfo>(60 * 60 * 1000);
const prCache = new TTLCache<GitHubPrInfo>(60 * 60 * 1000);
const gistCache = new TTLCache<GistInfo>(60 * 60 * 1000);

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
      name: string | null;
      blog: string | null;
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
      name: user.name ?? undefined,
      blog: user.blog && user.blog.trim() ? user.blog.trim() : undefined,
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

// ---- Evidence-level verifiers: repo / commit / PR ---------------------
// `notFound: true` means the server DEFINITIVELY said it does not exist (404)
// — that's the only signal that justifies a "fabricated" verdict. `error`
// means we couldn't check (rate limit / network) → treat as unverifiable.

export interface GitHubRepoInfo {
  exists: boolean;
  notFound?: boolean;
  fullName?: string;
  ownerLogin?: string;
  stars?: number;
  language?: string;
  description?: string;
  topics?: string[];
  pushedAt?: string;
  error?: string;
}

export interface GitHubCommitInfo {
  exists: boolean;
  notFound?: boolean;
  authorLogin?: string | null;
  authorName?: string;
  message?: string;
  date?: string;
  error?: string;
}

export interface GitHubPrInfo {
  exists: boolean;
  notFound?: boolean;
  authorLogin?: string;
  merged?: boolean;
  title?: string;
  error?: string;
}

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([^/\s]+)\/([^/#?\s]+)/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

export function parseCommitUrl(url: string): { owner: string; repo: string; sha: string } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{7,40})/i);
  return m ? { owner: m[1], repo: m[2], sha: m[3] } : null;
}

export function parsePrUrl(url: string): { owner: string; repo: string; number: string } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i);
  return m ? { owner: m[1], repo: m[2], number: m[3] } : null;
}

export async function verifyGitHubRepo(owner: string, repo: string): Promise<GitHubRepoInfo> {
  const key = `ghrepo:${owner}/${repo}`.toLowerCase();
  const hit = repoCache.get(key);
  if (hit) return hit;
  try {
    const res = await fetchWithTimeout(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    if (res.status === 404) {
      const r: GitHubRepoInfo = { exists: false, notFound: true };
      repoCache.set(key, r);
      return r;
    }
    if (res.status === 403) return { exists: false, error: "rate limited (set GITHUB_TOKEN)" };
    if (!res.ok) return { exists: false, error: `repo api ${res.status}` };
    const j = (await res.json()) as {
      full_name: string; owner?: { login?: string }; stargazers_count?: number;
      language?: string | null; description?: string | null; topics?: string[]; pushed_at?: string;
    };
    const r: GitHubRepoInfo = {
      exists: true, fullName: j.full_name, ownerLogin: j.owner?.login,
      stars: j.stargazers_count, language: j.language ?? undefined,
      description: j.description ?? undefined, topics: j.topics, pushedAt: j.pushed_at,
    };
    repoCache.set(key, r);
    return r;
  } catch (err) {
    return { exists: false, error: (err instanceof Error ? err.message : String(err)).slice(0, 100) };
  }
}

export async function isRepoContributor(owner: string, repo: string, login: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors?per_page=100`);
    if (!res.ok) return false;
    const arr = (await res.json()) as Array<{ login?: string }>;
    return arr.some((c) => c.login?.toLowerCase() === login.toLowerCase());
  } catch {
    return false;
  }
}

export async function verifyGitHubCommit(owner: string, repo: string, sha: string): Promise<GitHubCommitInfo> {
  const key = `ghcommit:${owner}/${repo}@${sha}`.toLowerCase();
  const hit = commitCache.get(key);
  if (hit) return hit;
  try {
    const res = await fetchWithTimeout(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`);
    if (res.status === 404 || res.status === 422) {
      const r: GitHubCommitInfo = { exists: false, notFound: true };
      commitCache.set(key, r);
      return r;
    }
    if (res.status === 403) return { exists: false, error: "rate limited" };
    if (!res.ok) return { exists: false, error: `commit api ${res.status}` };
    const j = (await res.json()) as {
      author?: { login?: string } | null;
      commit?: { author?: { name?: string; date?: string }; message?: string };
    };
    const r: GitHubCommitInfo = {
      exists: true,
      authorLogin: j.author?.login ?? null,
      authorName: j.commit?.author?.name,
      message: j.commit?.message?.split("\n")[0]?.slice(0, 120),
      date: j.commit?.author?.date,
    };
    commitCache.set(key, r);
    return r;
  } catch (err) {
    return { exists: false, error: (err instanceof Error ? err.message : String(err)).slice(0, 100) };
  }
}

export async function verifyGitHubPr(owner: string, repo: string, number: string): Promise<GitHubPrInfo> {
  const key = `ghpr:${owner}/${repo}#${number}`.toLowerCase();
  const hit = prCache.get(key);
  if (hit) return hit;
  try {
    const res = await fetchWithTimeout(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${encodeURIComponent(number)}`);
    if (res.status === 404) {
      const r: GitHubPrInfo = { exists: false, notFound: true };
      prCache.set(key, r);
      return r;
    }
    if (res.status === 403) return { exists: false, error: "rate limited" };
    if (!res.ok) return { exists: false, error: `pr api ${res.status}` };
    const j = (await res.json()) as { user?: { login?: string }; merged?: boolean; title?: string };
    const r: GitHubPrInfo = { exists: true, authorLogin: j.user?.login, merged: j.merged, title: j.title };
    prCache.set(key, r);
    return r;
  } catch (err) {
    return { exists: false, error: (err instanceof Error ? err.message : String(err)).slice(0, 100) };
  }
}

// ---- Gist verifier (for proof-of-control) -----------------------------

export interface GistInfo {
  exists: boolean;
  notFound?: boolean;
  ownerLogin?: string;
  /** Concatenated text of all files in the gist. */
  text?: string;
  error?: string;
}

/** Pull the gist id from a gist.github.com URL (with or without the username). */
export function parseGistId(url: string): string | null {
  const m = url.match(/gist\.github\.com\/(?:[^/]+\/)?([0-9a-f]{20,})/i);
  return m ? m[1] : null;
}

export async function verifyGist(id: string): Promise<GistInfo> {
  const key = `ghgist:${id}`.toLowerCase();
  const hit = gistCache.get(key);
  if (hit) return hit;
  try {
    const res = await fetchWithTimeout(`https://api.github.com/gists/${encodeURIComponent(id)}`);
    if (res.status === 404) {
      const r: GistInfo = { exists: false, notFound: true };
      gistCache.set(key, r);
      return r;
    }
    if (res.status === 403) return { exists: false, error: "rate limited" };
    if (!res.ok) return { exists: false, error: `gist api ${res.status}` };
    const j = (await res.json()) as { owner?: { login?: string }; files?: Record<string, { content?: string }> };
    const text = Object.values(j.files ?? {}).map((f) => f.content ?? "").join("\n");
    const r: GistInfo = { exists: true, ownerLogin: j.owner?.login, text };
    gistCache.set(key, r);
    return r;
  } catch (err) {
    return { exists: false, error: (err instanceof Error ? err.message : String(err)).slice(0, 100) };
  }
}

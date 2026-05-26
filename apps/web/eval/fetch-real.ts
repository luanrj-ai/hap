/**
 * Fetch real-human-written documents from public GitHub for each curated user.
 *
 *   cd apps/web && npx tsx eval/fetch-real.ts
 *   cd apps/web && npx tsx eval/fetch-real.ts --force   # re-fetch all
 *
 * Writes:
 *   apps/web/eval/data/real-fetched/<username>.md
 *   apps/web/eval/data/real-fetched/manifest.json
 *
 * Source priority for each user:
 *   1. Profile README at github.com/<user>/<user>/README.md (main or master)
 *   2. Fallback: synthesize a minimal "bio document" from GitHub API user data
 *      (name, bio, blog, company, location, top repos)
 *
 * Skips users whose total document is < 500 chars (signal will be too weak).
 *
 * Rate limit: README via raw.githubusercontent.com is unlimited.
 *             API user/repos: 60/h without GITHUB_TOKEN, 5000/h with.
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { REAL_SOURCES, type RealSource } from "./real-sources";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "data/real-fetched");

const MIN_DOC_LEN = 500;
const FORCE = process.argv.includes("--force");

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ResumeTruth/0.1 (+eval)",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function fetchWithTimeout(url: string, ms = 8000, headers?: Record<string, string>): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, headers });
  } finally {
    clearTimeout(t);
  }
}

interface UserApi {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  public_repos: number;
  followers: number;
  created_at: string;
}

interface RepoApi {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
}

async function fetchReadme(user: string): Promise<string | null> {
  for (const branch of ["main", "master"]) {
    try {
      const url = `https://raw.githubusercontent.com/${user}/${user}/${branch}/README.md`;
      const r = await fetchWithTimeout(url);
      if (r.ok) {
        const text = await r.text();
        if (text.trim().length > 0) return text;
      }
    } catch {
      /* try next branch */
    }
  }
  return null;
}

async function fetchUser(user: string): Promise<UserApi | null> {
  try {
    const r = await fetchWithTimeout(`https://api.github.com/users/${encodeURIComponent(user)}`, 8000, ghHeaders());
    if (!r.ok) return null;
    return (await r.json()) as UserApi;
  } catch {
    return null;
  }
}

async function fetchRepos(user: string): Promise<RepoApi[]> {
  try {
    const r = await fetchWithTimeout(
      `https://api.github.com/users/${encodeURIComponent(user)}/repos?sort=updated&per_page=10`,
      8000,
      ghHeaders(),
    );
    if (!r.ok) return [];
    return (await r.json()) as RepoApi[];
  } catch {
    return [];
  }
}

function stripMarkdown(md: string): string {
  // Quick-and-dirty: strip image/badge links, raw HTML, and image lines.
  // We keep most prose so signals can still work.
  return md
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "") // images
    .replace(/\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)/g, "") // badge image+link
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)") // [text](url) → text (url)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function synthesizeBio(user: UserApi, repos: RepoApi[]): string {
  const lines: string[] = [];
  lines.push(user.name ? `${user.name} (${user.login})` : user.login);
  if (user.bio) lines.push(user.bio);
  if (user.company) lines.push(`Company: ${user.company}`);
  if (user.location) lines.push(`Location: ${user.location}`);
  if (user.blog) lines.push(`Website: ${user.blog}`);
  lines.push(`GitHub: github.com/${user.login} · ${user.public_repos} public repos · ${user.followers} followers`);
  const accountYears = ((Date.now() - new Date(user.created_at).getTime()) / (365 * 86400_000)).toFixed(1);
  lines.push(`GitHub account age: ${accountYears} years`);
  lines.push("");
  if (repos.length > 0) {
    lines.push("Top repositories (most recently updated):");
    const own = repos.filter((r) => !r.fork).slice(0, 8);
    for (const r of own) {
      const desc = r.description || "(no description)";
      lines.push(`- ${r.name} (${r.language ?? "?"}, ${r.stargazers_count}⭐): ${desc}`);
    }
  }
  return lines.join("\n");
}

interface ManifestEntry {
  username: string;
  primaryRole: string;
  source: "readme" | "synthesized-bio";
  charCount: number;
  filename: string;
  notes?: string;
}

async function processOne(src: RealSource): Promise<ManifestEntry | null> {
  const outPath = resolve(OUT_DIR, `${src.username}.md`);
  if (existsSync(outPath) && !FORCE) {
    // assume already-fetched is good
    return null;
  }

  // 1. Try profile README (cheap, unlimited)
  const readme = await fetchReadme(src.username);
  let bodyText: string | null = null;
  let sourceKind: "readme" | "synthesized-bio" = "readme";

  if (readme && stripMarkdown(readme).length >= MIN_DOC_LEN) {
    bodyText = stripMarkdown(readme);
  } else {
    // 2. Fallback: synthesize bio from API
    const user = await fetchUser(src.username);
    if (!user) return null;
    const repos = await fetchRepos(src.username);
    const bio = synthesizeBio(user, repos);
    if (bio.length >= MIN_DOC_LEN) {
      bodyText = bio;
      sourceKind = "synthesized-bio";
    }
  }

  if (!bodyText) return null;

  writeFileSync(outPath, bodyText);
  return {
    username: src.username,
    primaryRole: src.primaryRole,
    source: sourceKind,
    charCount: bodyText.length,
    filename: `${src.username}.md`,
    notes: src.notes,
  };
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  if (FORCE) {
    for (const f of readdirSync(OUT_DIR)) {
      if (f.endsWith(".md") || f === "manifest.json") {
        try { unlinkSync(resolve(OUT_DIR, f)); } catch {}
      }
    }
    console.log(`Cleared old fetched files\n`);
  }

  console.log(`Fetching ${REAL_SOURCES.length} real GitHub profiles → ${OUT_DIR}\n`);
  if (!process.env.GITHUB_TOKEN) {
    console.log(`(no GITHUB_TOKEN — fallback API limited to 60/hr, README path is unlimited)\n`);
  }

  const results: Array<ManifestEntry | null> = [];
  let i = 0;
  for (const src of REAL_SOURCES) {
    i++;
    process.stdout.write(`  [${i}/${REAL_SOURCES.length}] ${src.username.padEnd(20)} ... `);
    const entry = await processOne(src);
    results.push(entry);
    if (!entry) console.log("SKIPPED (too short / fetch failed)");
    else console.log(`OK (${entry.source}, ${entry.charCount} chars)`);
  }

  const kept = results.filter((e): e is ManifestEntry => e !== null);
  console.log(`\nKept ${kept.length} / ${REAL_SOURCES.length} fixtures`);

  const manifest = {
    fetchedAt: new Date().toISOString(),
    minDocLen: MIN_DOC_LEN,
    entries: kept,
  };
  writeFileSync(resolve(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`✓ Manifest: ${resolve(OUT_DIR, "manifest.json")}`);
  console.log(`Next: npx tsx eval/run.ts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

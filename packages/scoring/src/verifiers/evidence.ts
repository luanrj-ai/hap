/**
 * Verify one piece of cited evidence against a candidate's identity anchor.
 *
 * Output is a verification LEVEL plus machine-read FACTS (what the artifact
 * actually is). Only the facts — never the candidate-agent's prose — are later
 * fed to relevance judging. This is the line that makes the score ungameable:
 * a fancier-written answer earns nothing; only dereferenceable reality does.
 *
 *   verified         link resolves AND ties to the anchor (e.g. commit author
 *                    login == anchor's GitHub account)
 *   exists_unlinked  link resolves but we can't prove it's the candidate's
 *                    (name-only matches land here — names are weak identity)
 *   unverifiable     this type can't be checked programmatically, OR we
 *                    couldn't reach it right now (transient — never penalised)
 *   fabricated       the server DEFINITIVELY says it does not exist (404 etc.)
 *
 * Identity caveat (防君子不防小人): the anchor account itself is *asserted*,
 * not proven to be operated by this human. We verify that cited artifacts are
 * internally consistent with that one asserted account; proving control of the
 * account is a future `proof_of_control` challenge (not implemented).
 */
import type { Evidence } from "@hap/a2a-adapter";
import {
  extractGitHubUser,
  isRepoContributor,
  parseCommitUrl,
  parseGistId,
  parsePrUrl,
  parseRepoUrl,
  verifyGist,
  verifyGitHubCommit,
  verifyGitHubPr,
  verifyGitHubRepo,
  verifyGitHubUser,
} from "./github";

export type VerificationLevel = "verified" | "exists_unlinked" | "unverifiable" | "fabricated";

export interface VerificationResult {
  level: VerificationLevel;
  /** Machine-read facts about the artifact (safe to feed to relevance). */
  facts: string;
  note: string;
}

export interface IdentityAnchor {
  /** Canonical GitHub login, if the candidate anchored one. */
  githubLogin?: string;
  /** Candidate display name (weak identity — name matches stay unlinked). */
  name?: string;
}

/** Token a proof-of-control gist must contain. */
const PROOF_MARKER = /HAP-PROOF/i;

export interface ProofOfControl {
  method: "github_gist";
  url: string;
}

export interface ProofResult {
  proven: boolean;
  note: string;
}

/**
 * Verify the candidate CONTROLS the anchor account (not merely cites it).
 * v0: a public gist owned by the anchor's GitHub account carrying a HAP-PROOF
 * marker. A faker citing someone else's account can't produce a gist under it.
 *
 * Residual gap (honest): a determined attacker who wholesale-impersonates a
 * public account+proof is still possible; full defence needs an interactive
 * server-issued challenge or a signature. This is the "防小人" step, not a cure.
 */
export async function verifyProofOfControl(proof: ProofOfControl, anchor: IdentityAnchor): Promise<ProofResult> {
  if (proof.method !== "github_gist") return { proven: false, note: `unsupported proof method ${proof.method}` };
  if (!anchor.githubLogin) return { proven: false, note: "no GitHub anchor to prove control of" };
  const id = parseGistId(proof.url);
  if (!id) return { proven: false, note: "not a valid gist URL" };
  const g = await verifyGist(id);
  if (g.error) return { proven: false, note: `gist unreachable: ${g.error}` };
  if (!g.exists) return { proven: false, note: "proof gist not found" };
  const ownerOk = g.ownerLogin?.toLowerCase() === anchor.githubLogin.toLowerCase();
  if (!ownerOk) return { proven: false, note: `gist owner (@${g.ownerLogin}) != anchor (@${anchor.githubLogin})` };
  if (!(g.text && PROOF_MARKER.test(g.text))) return { proven: false, note: "gist lacks HAP-PROOF marker" };
  return { proven: true, note: `gist owned by @${g.ownerLogin} carries HAP-PROOF` };
}

const UA = { "user-agent": "HAP-verifier/0.1 (+https://hap.dev)" };

async function fetchJson(url: string, ms = 7000): Promise<{ status: number; json: unknown } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal, redirect: "follow" });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url: string, ms = 7000): Promise<{ status: number; body: string } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal, redirect: "follow" });
    const body = res.ok ? await res.text().catch(() => "") : "";
    return { status: res.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const UNVERIFIABLE = (note: string): VerificationResult => ({ level: "unverifiable", facts: "", note });
const FABRICATED = (note: string): VerificationResult => ({ level: "fabricated", facts: "", note });

export async function verifyEvidence(ev: Evidence, anchor: IdentityAnchor): Promise<VerificationResult> {
  switch (ev.type) {
    case "linkedin":
    case "email_domain":
      return UNVERIFIABLE(`${ev.type} is auth-walled / not programmatically checkable`);

    case "github_user": {
      const login = extractGitHubUser(ev.url);
      if (!login) return FABRICATED("not a valid github.com/<user> URL");
      const u = await verifyGitHubUser(login);
      if (u.error) return UNVERIFIABLE(u.error);
      if (!u.exists) return FABRICATED("GitHub user does not exist");
      const facts = `GitHub user @${u.login}: ${u.publicRepos} repos, ${u.followers} followers, ~${u.accountAgeDays}d old, langs ${(u.topLanguages ?? []).join("/")}, top ${(u.topRepos ?? []).map((r) => `${r.name}(${r.stars}★)`).join(", ")}`;
      const isAnchor = anchor.githubLogin && u.login?.toLowerCase() === anchor.githubLogin.toLowerCase();
      return { level: "verified", facts, note: isAnchor ? "identity anchor" : "real account (asserted as candidate's)" };
    }

    case "github_repo":
    case "oss_maintainer": {
      const p = parseRepoUrl(ev.url);
      if (!p) return FABRICATED("not a valid github.com/<owner>/<repo> URL");
      const r = await verifyGitHubRepo(p.owner, p.repo);
      if (r.error) return UNVERIFIABLE(r.error);
      if (!r.exists) return FABRICATED("repo does not exist");
      const facts = `Repo ${r.fullName}: ${r.language ?? "?"}, ${r.stars ?? 0}★, topics [${(r.topics ?? []).join(", ")}], pushed ${r.pushedAt?.slice(0, 10) ?? "?"}. ${r.description ?? ""}`.trim();
      const ownerIsAnchor = anchor.githubLogin && r.ownerLogin?.toLowerCase() === anchor.githubLogin.toLowerCase();
      if (ownerIsAnchor) return { level: "verified", facts, note: "owned by anchor" };
      if (anchor.githubLogin && (await isRepoContributor(p.owner, p.repo, anchor.githubLogin))) {
        return { level: "verified", facts, note: "anchor is a contributor" };
      }
      return { level: "exists_unlinked", facts, note: "repo is real but not owned by / linked to anchor" };
    }

    case "github_commit": {
      const p = parseCommitUrl(ev.url);
      if (!p) return FABRICATED("not a valid commit URL");
      const c = await verifyGitHubCommit(p.owner, p.repo, p.sha);
      if (c.error) return UNVERIFIABLE(c.error);
      if (!c.exists) return FABRICATED("commit sha not found");
      const facts = `Commit ${p.owner}/${p.repo}@${p.sha.slice(0, 7)} by @${c.authorLogin ?? c.authorName ?? "?"} (${c.date?.slice(0, 10) ?? "?"}): ${c.message ?? ""}`;
      const isAnchor = anchor.githubLogin && c.authorLogin && c.authorLogin.toLowerCase() === anchor.githubLogin.toLowerCase();
      return isAnchor
        ? { level: "verified", facts, note: "commit author == anchor" }
        : { level: "exists_unlinked", facts, note: `commit is real but author (@${c.authorLogin ?? "unknown"}) != anchor` };
    }

    case "github_pr": {
      const p = parsePrUrl(ev.url);
      if (!p) return FABRICATED("not a valid pull-request URL");
      const pr = await verifyGitHubPr(p.owner, p.repo, p.number);
      if (pr.error) return UNVERIFIABLE(pr.error);
      if (!pr.exists) return FABRICATED("PR not found");
      const facts = `PR ${p.owner}/${p.repo}#${p.number} by @${pr.authorLogin ?? "?"} (${pr.merged ? "merged" : "not merged"}): ${pr.title ?? ""}`;
      const isAnchor = anchor.githubLogin && pr.authorLogin?.toLowerCase() === anchor.githubLogin.toLowerCase();
      return isAnchor
        ? { level: "verified", facts, note: "PR author == anchor" }
        : { level: "exists_unlinked", facts, note: `PR is real but author (@${pr.authorLogin ?? "unknown"}) != anchor` };
    }

    case "package": {
      const res = await verifyPackage(ev.url, anchor);
      return res;
    }

    case "paper": {
      const res = await verifyPaper(ev.url, anchor);
      return res;
    }

    case "talk":
    case "blog_post":
    case "personal_site":
    default: {
      // Reachability + name presence. Name match is weak → exists_unlinked at best.
      const r = await fetchText(ev.url);
      if (!r) return UNVERIFIABLE("page unreachable (transient)");
      if (r.status === 404 || r.status === 410) return FABRICATED(`page returns ${r.status}`);
      if (r.status >= 400) return UNVERIFIABLE(`page returns ${r.status}`);
      const title = r.body.match(/<title[^>]*>([^<]{1,160})<\/title>/i)?.[1]?.trim();
      const nameHit = anchor.name ? new RegExp(anchor.name.replace(/[^a-z0-9\s]/gi, "").trim(), "i").test(r.body) : false;
      const facts = `${ev.type} page (${r.status})${title ? `: "${title}"` : ""}${ev.venue ? ` · venue ${ev.venue}` : ""}`;
      return {
        level: "exists_unlinked",
        facts,
        note: nameHit ? "page reachable, candidate name appears" : "page reachable, name not confirmed on page",
      };
    }
  }
}

async function verifyPackage(url: string, anchor: IdentityAnchor): Promise<VerificationResult> {
  const host = (() => { try { return new URL(url).host; } catch { return ""; } })();
  const name = url.split("/").filter(Boolean).pop()?.split("?")[0] ?? "";
  if (!name) return FABRICATED("no package name in URL");

  if (host.includes("npmjs.com") || host.includes("npmjs.org")) {
    const r = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
    if (!r) return UNVERIFIABLE("npm registry unreachable");
    if (r.status === 404) return FABRICATED("npm package not found");
    const j = r.json as { description?: string; maintainers?: Array<{ name?: string }>; "dist-tags"?: { latest?: string } };
    const maint = (j.maintainers ?? []).map((m) => m.name?.toLowerCase());
    const linked = anchor.githubLogin && maint.includes(anchor.githubLogin.toLowerCase());
    const facts = `npm ${name}@${j["dist-tags"]?.latest ?? "?"}: ${j.description ?? ""} (maintainers: ${maint.join(", ")})`;
    return { level: linked ? "verified" : "exists_unlinked", facts, note: linked ? "anchor is a maintainer" : "package real; maintainer not linked to anchor" };
  }
  if (host.includes("pypi.org")) {
    const r = await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
    if (!r) return UNVERIFIABLE("pypi unreachable");
    if (r.status === 404) return FABRICATED("pypi package not found");
    const j = r.json as { info?: { summary?: string; version?: string; author?: string } };
    const facts = `pypi ${name}@${j.info?.version ?? "?"}: ${j.info?.summary ?? ""} (author: ${j.info?.author ?? "?"})`;
    return { level: "exists_unlinked", facts, note: "package real; author linkage is name-only" };
  }
  if (host.includes("crates.io")) {
    const r = await fetchJson(`https://crates.io/api/v1/crates/${encodeURIComponent(name)}`);
    if (!r) return UNVERIFIABLE("crates.io unreachable");
    if (r.status === 404) return FABRICATED("crate not found");
    const j = r.json as { crate?: { description?: string; newest_version?: string } };
    const facts = `crate ${name}@${j.crate?.newest_version ?? "?"}: ${j.crate?.description ?? ""}`;
    return { level: "exists_unlinked", facts, note: "crate real; ownership not checked" };
  }
  return UNVERIFIABLE("unknown package registry");
}

async function verifyPaper(url: string, anchor: IdentityAnchor): Promise<VerificationResult> {
  const arxiv = url.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5})/i)?.[1];
  if (arxiv) {
    const r = await fetchText(`http://export.arxiv.org/api/query?id_list=${arxiv}`);
    if (!r) return UNVERIFIABLE("arxiv unreachable");
    const title = r.body.match(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim();
    if (!title) return FABRICATED("arxiv id not found");
    const authors = Array.from(r.body.matchAll(/<author>\s*<name>([^<]+)<\/name>/gi)).map((m) => m[1]);
    const nameHit = anchor.name ? authors.some((a) => a.toLowerCase().includes(anchor.name!.toLowerCase().split(" ")[0])) : false;
    const facts = `arXiv:${arxiv} "${title}" — authors: ${authors.join(", ")}`;
    return { level: "exists_unlinked", facts, note: nameHit ? "paper real; candidate name among authors (name-only)" : "paper real; candidate not matched in author list" };
  }
  const doi = url.match(/(10\.\d{4,9}\/[^\s/?#]+)/)?.[1];
  if (doi) {
    const r = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (!r) return UNVERIFIABLE("crossref unreachable");
    if (r.status === 404) return FABRICATED("DOI not found");
    const j = r.json as { message?: { title?: string[]; author?: Array<{ family?: string }> } };
    const title = j.message?.title?.[0];
    const facts = `DOI ${doi} "${title ?? "?"}" — ${(j.message?.author ?? []).map((a) => a.family).join(", ")}`;
    return { level: "exists_unlinked", facts, note: "paper real; author linkage is name-only" };
  }
  // Fall back to plain reachability.
  const r = await fetchText(url);
  if (!r) return UNVERIFIABLE("paper URL unreachable");
  if (r.status === 404) return FABRICATED("paper URL 404");
  return { level: "exists_unlinked", facts: `paper page (${r.status})`, note: "reachable; could not parse authorship" };
}

import type { SignalResult, VerificationDetail } from "@resumetruth/shared";
import { extractGitHubUser, verifyGitHubUser, type GitHubProfile } from "../verifiers/github";
import { extractUrls, verifyWebsite } from "../verifiers/website";

interface EvidenceContext {
  githubUrl?: string;
  personalSiteUrl?: string;
  linkedinUrl?: string;
  resumeText: string;
  /** When true, actually fetch GitHub API + HEAD websites. Adds 1-3s latency. */
  verify?: boolean;
}

const URL_REGEX = /https?:\/\/[^\s)\],]+/gi;

function extractDeclaredUrls(ctx: EvidenceContext): {
  github: string | null;
  linkedin: string | null;
  others: string[];
} {
  const all = new Set<string>();
  const matches = ctx.resumeText.match(URL_REGEX) ?? [];
  for (const m of matches) all.add(m.replace(/[.,;:!?)]+$/, ""));
  if (ctx.githubUrl) all.add(ctx.githubUrl);
  if (ctx.personalSiteUrl) all.add(ctx.personalSiteUrl);
  if (ctx.linkedinUrl) all.add(ctx.linkedinUrl);

  // Also pick up bare "github.com/user" and "site.dev" references
  const bareGh = ctx.resumeText.match(/\bgithub\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\b/gi) ?? [];
  for (const b of bareGh) all.add(`https://${b}`);

  let github: string | null = null;
  let linkedin: string | null = null;
  const others: string[] = [];
  for (const u of all) {
    if (/github\.com/i.test(u) && !github) github = u;
    else if (/linkedin\.com/i.test(u) && !linkedin) linkedin = u;
    else if (!/twitter\.com|x\.com|gitlab\.com/i.test(u)) others.push(u);
  }
  return { github, linkedin, others: others.slice(0, 3) }; // cap to 3 to limit network
}

/**
 * Sync path used when verify=false. Original behavior — only checks whether
 * links are declared in the resume text.
 */
export function externalEvidenceSignal(ctx: EvidenceContext): SignalResult {
  const { github, linkedin, others } = extractDeclaredUrls(ctx);

  let score = 30;
  const reasons: string[] = [];

  if (github) {
    score += 30;
    reasons.push("简历声明了 GitHub 链接");
  } else {
    reasons.push("未发现 GitHub 链接");
  }
  if (linkedin) {
    score += 15;
    reasons.push("含 LinkedIn profile");
  }
  if (others.length > 0) {
    score += 25;
    reasons.push("含个人网站 / 作品集");
  }

  const numbers = (ctx.resumeText.match(/\d+%|\$\d|\d+x|\d+ ?(million|k\b)/gi) || []).length;
  if (numbers >= 3) {
    score += 10;
    reasons.push(`含 ${numbers}+ 处具体数字证据`);
  }

  score = Math.max(0, Math.min(100, score));

  return {
    id: "external-evidence",
    label: "外部可验证证据",
    dimension: "verifiability",
    weight: 25,
    score,
    impact: score >= 70 ? "positive" : score < 40 ? "negative" : "neutral",
    explanation:
      reasons.join("；") +
      "。当前只检查链接是否声明；启用 verify=true 启动真实 GitHub API + HEAD 验证。",
  };
}

/**
 * Async path: actually fetches GitHub API and HEAD-checks personal sites.
 * Returns both the signal AND the structured verification detail.
 */
export async function externalEvidenceVerified(
  ctx: EvidenceContext,
): Promise<{ signal: SignalResult; detail: VerificationDetail }> {
  const { github, linkedin, others } = extractDeclaredUrls(ctx);
  const detail: VerificationDetail = {};
  const reasons: string[] = [];
  let score = 30;

  // GitHub verification
  if (github) {
    const login = extractGitHubUser(github);
    if (!login) {
      detail.github = { declared: true, error: "couldn't extract username from URL" };
      reasons.push("声明了 GitHub 但 URL 格式异常");
    } else {
      const gh = await verifyGitHubUser(login);
      detail.github = {
        declared: true,
        login,
        exists: gh.exists,
        publicRepos: gh.publicRepos,
        followers: gh.followers,
        accountAgeDays: gh.accountAgeDays,
        recentCommits: gh.recentCommits,
        topLanguages: gh.topLanguages,
        topRepos: gh.topRepos,
        error: gh.error,
      };
      if (gh.error?.includes("rate limited")) {
        score += 15;
        reasons.push("GitHub 验证因限流跳过（声明视作部分证据）");
      } else if (!gh.exists) {
        score -= 25;
        reasons.push(`⚠ 声明的 GitHub ${login} 不存在`);
      } else {
        score += scoreGitHubProfile(gh, reasons);
      }
    }
  } else {
    reasons.push("未声明 GitHub");
    detail.github = { declared: false };
  }

  if (linkedin) {
    score += 8;
    reasons.push("声明了 LinkedIn（未验证，登录墙限制）");
  }

  // Other websites
  if (others.length > 0) {
    detail.websites = [];
    const checks = await Promise.all(others.map((u) => verifyWebsite(u)));
    let liveCount = 0;
    let deadCount = 0;
    for (let i = 0; i < others.length; i++) {
      const w = checks[i];
      detail.websites.push({
        url: others[i],
        reachable: w.reachable,
        status: w.status,
        looksReal: w.looksReal,
        error: w.error,
      });
      if (w.looksReal) liveCount++;
      else if (!w.reachable) deadCount++;
    }
    if (liveCount > 0) {
      score += Math.min(25, liveCount * 15);
      reasons.push(`${liveCount} 个声明网站可访问`);
    }
    if (deadCount > 0) {
      score -= deadCount * 8;
      reasons.push(`⚠ ${deadCount} 个声明网站不可达`);
    }
  }

  // Numbers in resume
  const numbers = (ctx.resumeText.match(/\d+%|\$\d|\d+x|\d+ ?(million|k\b)/gi) || []).length;
  if (numbers >= 3) {
    score += 5;
    reasons.push(`含 ${numbers}+ 处具体数字`);
  }

  score = Math.max(0, Math.min(100, score));

  return {
    signal: {
      id: "external-evidence",
      label: "外部可验证证据（已实际验证）",
      dimension: "verifiability",
      weight: 25,
      score,
      impact: score >= 70 ? "positive" : score < 40 ? "negative" : "neutral",
      explanation: reasons.join("；") + "。",
    },
    detail,
  };
}

function scoreGitHubProfile(gh: GitHubProfile, reasons: string[]): number {
  let delta = 0;
  // Account exists and old enough
  if ((gh.accountAgeDays ?? 0) > 365) {
    delta += 8;
    reasons.push(`GitHub 账户 ${((gh.accountAgeDays ?? 0) / 365).toFixed(1)} 年`);
  } else if ((gh.accountAgeDays ?? 0) > 30) {
    delta += 3;
    reasons.push(`GitHub 账户较新（${gh.accountAgeDays} 天）`);
  } else {
    reasons.push(`⚠ GitHub 账户极新（${gh.accountAgeDays} 天）`);
  }
  // Public repos
  if ((gh.publicRepos ?? 0) >= 5) {
    delta += 8;
    reasons.push(`${gh.publicRepos} 个公开仓库`);
  } else if ((gh.publicRepos ?? 0) > 0) {
    delta += 3;
  } else {
    reasons.push("⚠ 0 个公开仓库");
  }
  // Recent activity
  if ((gh.recentCommits ?? 0) >= 20) {
    delta += 12;
    reasons.push(`90 天内 ${gh.recentCommits} commits`);
  } else if ((gh.recentCommits ?? 0) > 0) {
    delta += 5;
    reasons.push(`90 天内 ${gh.recentCommits} commits（偏少）`);
  } else {
    reasons.push("⚠ 90 天内无 commit");
  }
  // Top repo stars
  const maxStars = Math.max(0, ...(gh.topRepos ?? []).map((r) => r.stars));
  if (maxStars >= 100) {
    delta += 10;
    reasons.push(`最热仓库 ${maxStars} ⭐`);
  } else if (maxStars >= 10) {
    delta += 4;
  }
  return delta;
}

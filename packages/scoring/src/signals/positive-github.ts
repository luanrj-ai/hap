import type { SignalResult } from "@resumetruth/shared";
import { extractGitHubUser, verifyGitHubUser } from "../verifiers/github";

/**
 * Positive signal: real GitHub activity boosts the candidate.
 * Only meaningful when verify=true (else we have no real data).
 *
 * Score formula:
 *   account age ≥ 2y                +20
 *   account age 1-2y                +12
 *   public repos ≥ 10               +20
 *   public repos 3-9                +12
 *   recent (90d) commits ≥ 50       +25
 *   recent (90d) commits 10-49      +15
 *   recent (90d) commits 1-9        +5
 *   max repo stars ≥ 500            +15
 *   max repo stars 50-499           +8
 *   max repo stars 5-49             +3
 */
export async function positiveGithubSignal(resumeText: string): Promise<SignalResult> {
  const ghUrlMatch = resumeText.match(/\bgithub\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\b/i);
  if (!ghUrlMatch) {
    return {
      id: "positive-github",
      label: "GitHub 活跃度",
      dimension: "verifiability",
      weight: 15,
      score: 40,
      impact: "neutral",
      explanation: "未声明 GitHub。无法验证开源活跃度。",
    };
  }
  const login = extractGitHubUser(ghUrlMatch[0]);
  if (!login) {
    return {
      id: "positive-github",
      label: "GitHub 活跃度",
      dimension: "verifiability",
      weight: 15,
      score: 40,
      impact: "neutral",
      explanation: "声明了 GitHub 但 URL 格式异常。",
    };
  }

  const gh = await verifyGitHubUser(login);
  if (!gh.exists || gh.error) {
    if (gh.error?.includes("rate limited")) {
      return {
        id: "positive-github",
        label: "GitHub 活跃度",
        dimension: "verifiability",
        weight: 15,
        score: 50,
        impact: "neutral",
        explanation: `GitHub API 限流，无法评估 @${login} 活跃度（设置 GITHUB_TOKEN 解除）。`,
      };
    }
    return {
      id: "positive-github",
      label: "GitHub 活跃度",
      dimension: "verifiability",
      weight: 15,
      score: 15,
      impact: "negative",
      explanation: `⚠ 声明的 GitHub @${login} 不存在或不可达。`,
    };
  }

  let score = 20; // base for "exists"
  const reasons: string[] = [];

  const yrs = (gh.accountAgeDays ?? 0) / 365;
  if (yrs >= 2) { score += 20; reasons.push(`${yrs.toFixed(1)} 年账号`); }
  else if (yrs >= 1) { score += 12; reasons.push(`${yrs.toFixed(1)} 年账号`); }
  else reasons.push(`账号仅 ${yrs.toFixed(1)} 年（较新）`);

  const repos = gh.publicRepos ?? 0;
  if (repos >= 10) { score += 20; reasons.push(`${repos} 个公开仓库`); }
  else if (repos >= 3) { score += 12; reasons.push(`${repos} 个公开仓库`); }
  else reasons.push(`仅 ${repos} 个公开仓库`);

  const commits = gh.recentCommits ?? 0;
  if (commits >= 50) { score += 25; reasons.push(`90 天 ${commits} commits（高活跃）`); }
  else if (commits >= 10) { score += 15; reasons.push(`90 天 ${commits} commits`); }
  else if (commits > 0) { score += 5; reasons.push(`90 天仅 ${commits} commits`); }
  else reasons.push("90 天无 commit");

  const maxStars = Math.max(0, ...(gh.topRepos ?? []).map((r) => r.stars));
  if (maxStars >= 500) { score += 15; reasons.push(`最热仓库 ${maxStars} ⭐`); }
  else if (maxStars >= 50) { score += 8; reasons.push(`最热仓库 ${maxStars} ⭐`); }
  else if (maxStars >= 5) { score += 3; reasons.push(`最热仓库 ${maxStars} ⭐`); }

  score = Math.max(0, Math.min(100, score));

  return {
    id: "positive-github",
    label: "GitHub 活跃度",
    dimension: "verifiability",
    weight: 15,
    score,
    impact: score >= 70 ? "positive" : score < 40 ? "negative" : "neutral",
    explanation: `@${login}：${reasons.join("、")}。`,
  };
}

export type ScoreDimension = "authenticity" | "verifiability" | "interview";

export type SignalImpact = "positive" | "negative" | "neutral";

export interface SignalResult {
  id: string;
  label: string;
  dimension: ScoreDimension;
  weight: number;
  score: number;
  impact: SignalImpact;
  explanation: string;
}

export interface LLMEnhancement {
  enhancedSummary: string;
  riskAssessment: string;
  interviewQuestions: string[];
  model: string;
  generatedAt: string;
}

export interface ScoreResult {
  authenticity: number;
  verifiability: number;
  interview: number;
  signals: SignalResult[];
  summary: string;
  candidateName?: string;
  scoredAt: string;
  enhancement?: LLMEnhancement;
  scoreId?: string;
  verification?: VerificationDetail;
  extractedSkills?: ExtractedSkills;
  expertPanel?: ExpertPanelVerdict;
}

export interface ScoreRequest {
  resumeText: string;
  candidateName?: string;
  jobDescription?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  personalSiteUrl?: string;
  enhance?: boolean;
  /**
   * Use LLM-based semantic JD match instead of bag-of-words.
   * Defaults to true when an LLM key is configured.
   * Set explicitly to false to force the rule-only path (e.g. for eval baseline).
   */
  useLlmJdMatch?: boolean;
  /**
   * Use LLM-based AI-text detection instead of regex template-matching.
   * Defaults to true when an LLM key is configured.
   * Set explicitly to false to force the rule-only path (e.g. for eval baseline).
   */
  useLlmAiText?: boolean;
  /**
   * Use LLM-based technical depth evaluation instead of regex.
   * Defaults to true when an LLM key is configured.
   */
  useLlmRareDepth?: boolean;
  /**
   * Run external verifiers (GitHub API, website HEAD) on declared URLs.
   * Adds 1–3 seconds latency per resume. Default false.
   * Requires GITHUB_TOKEN for >60 verifications/hour.
   */
  verify?: boolean;
}

export interface ExtractedSkills {
  skills: string[];
  yearsExperience: number | null;
  seniority: "junior" | "mid" | "senior" | "staff" | "principal" | "unknown";
  currentTitle: string | null;
  currentCompany: string | null;
  pastCompanies: string[];
  education: Array<{ degree: string; school: string; year: number | null }>;
  specializations: string[];
  ossArtifacts: Array<{ name: string; stars: number | null }>;
  publicTalks: string[];
  extractedAt: string;
  model: string;
}

export interface ExpertPanelVerdict {
  triggered: boolean;
  reason: string;          // why panel was triggered
  devilArgs: string[];     // top reasons against the candidate
  championArgs: string[];  // top reasons for the candidate
  judgeVerdict: "candidate is real and fits" | "candidate is real but poor fit" | "candidate is AI or unreliable" | "uncertain";
  confidence: "low" | "medium" | "high";
  aiTextOverride?: number;  // if judge changes ai-text
  jdMatchOverride?: number; // if judge changes jd-match
  rationale: string;
  generatedAt: string;
  model: string;
}

export interface VerificationDetail {
  github?: {
    declared: boolean;
    login?: string;
    exists?: boolean;
    publicRepos?: number;
    followers?: number;
    accountAgeDays?: number;
    recentCommits?: number;
    topLanguages?: string[];
    topRepos?: Array<{ name: string; stars: number; lang: string | null }>;
    error?: string;
  };
  websites?: Array<{
    url: string;
    reachable: boolean;
    status?: number;
    looksReal?: boolean;
    error?: string;
  }>;
}

export interface FeedbackRequest {
  scoreId: string;
  signalId?: string;
  thumbs: "up" | "down";
  reason?: string;
}

export interface ApiErrorBody {
  error: string;
  details?: string;
}

export const SCORE_BANDS = {
  excellent: 80,
  good: 60,
  flagged: 40,
} as const;

export function bandOf(score: number): "excellent" | "good" | "flagged" | "rejected" {
  if (score >= SCORE_BANDS.excellent) return "excellent";
  if (score >= SCORE_BANDS.good) return "good";
  if (score >= SCORE_BANDS.flagged) return "flagged";
  return "rejected";
}

export interface Env {
  // KV namespace for quota counters
  QUOTA_KV: KVNamespace;

  // Owner-side LLM credentials (wrangler secrets)
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  ANTHROPIC_BASE_URL?: string;
  PROXY_ADMIN_TOKEN?: string;

  // Vars from wrangler.toml
  DAILY_LIMIT_PER_CLIENT: string;
  DAILY_LIMIT_PER_IP: string;
  MINUTE_LIMIT_PER_CLIENT: string;
  DEFAULT_OPENAI_MODEL: string;
  DEFAULT_ANTHROPIC_MODEL: string;
}

/** Shape returned by quota.consumeQuota / quota.checkQuota. */
export interface QuotaResult {
  allowed: boolean;
  /** Calls remaining for the day on the client bucket. */
  remainingDay: number;
  /** Calls remaining for the current minute on the client bucket. */
  remainingMinute: number;
  /** Calls remaining for the day on the IP bucket. */
  remainingIp: number;
  /** Seconds until daily window resets (UTC). */
  resetInSec: number;
  /** Human-readable refusal reason if !allowed. */
  reason?: "day_exceeded" | "minute_exceeded" | "ip_exceeded";
}

export type Bindings = Env;

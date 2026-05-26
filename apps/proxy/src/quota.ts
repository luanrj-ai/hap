/**
 * KV-backed quota tracking. We use three independent counters:
 *   - per client per day  (the user's intended quota)
 *   - per client per minute (burst protection)
 *   - per IP per day      (catches the "spawn 1000 client IDs" attack)
 *
 * KV is eventually consistent (~60s lag globally). That's fine for our
 * budget — we'd rather slightly over-serve than block a real user.
 */
import type { Env, QuotaResult } from "./types";

const HOUR_SEC = 60 * 60;
const DAY_SEC = 24 * HOUR_SEC;

function utcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcMinuteKey(): string {
  return new Date().toISOString().slice(0, 16);
}

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

async function readCounter(kv: KVNamespace, key: string): Promise<number> {
  const v = await kv.get(key);
  return v ? parseInt(v, 10) || 0 : 0;
}

async function incrementCounter(
  kv: KVNamespace,
  key: string,
  ttlSec: number,
): Promise<number> {
  const current = await readCounter(kv, key);
  const next = current + 1;
  await kv.put(key, String(next), { expirationTtl: ttlSec });
  return next;
}

/**
 * Check (read-only) the current quota state for a client+ip pair without
 * incrementing. Used for the /quota endpoint.
 */
export async function checkQuota(
  env: Env,
  clientId: string,
  ip: string,
): Promise<QuotaResult> {
  const dayK = utcDateKey();
  const minK = utcMinuteKey();
  const dailyClient = parseInt(env.DAILY_LIMIT_PER_CLIENT, 10);
  const dailyIp = parseInt(env.DAILY_LIMIT_PER_IP, 10);
  const minuteClient = parseInt(env.MINUTE_LIMIT_PER_CLIENT, 10);

  const [usedDay, usedMin, usedIp] = await Promise.all([
    readCounter(env.QUOTA_KV, `c:${clientId}:d:${dayK}`),
    readCounter(env.QUOTA_KV, `c:${clientId}:m:${minK}`),
    readCounter(env.QUOTA_KV, `ip:${ip}:d:${dayK}`),
  ]);

  return {
    allowed: usedDay < dailyClient && usedMin < minuteClient && usedIp < dailyIp,
    remainingDay: Math.max(0, dailyClient - usedDay),
    remainingMinute: Math.max(0, minuteClient - usedMin),
    remainingIp: Math.max(0, dailyIp - usedIp),
    resetInSec: secondsUntilUtcMidnight(),
  };
}

/**
 * Reserve one call for this client+ip. Returns the post-reservation state.
 * If any bucket is exhausted, returns allowed=false WITHOUT incrementing the
 * other buckets (so a single rejected call doesn't burn other quotas).
 */
export async function consumeQuota(
  env: Env,
  clientId: string,
  ip: string,
): Promise<QuotaResult> {
  const dayK = utcDateKey();
  const minK = utcMinuteKey();
  const dailyClient = parseInt(env.DAILY_LIMIT_PER_CLIENT, 10);
  const dailyIp = parseInt(env.DAILY_LIMIT_PER_IP, 10);
  const minuteClient = parseInt(env.MINUTE_LIMIT_PER_CLIENT, 10);

  const [usedDay, usedMin, usedIp] = await Promise.all([
    readCounter(env.QUOTA_KV, `c:${clientId}:d:${dayK}`),
    readCounter(env.QUOTA_KV, `c:${clientId}:m:${minK}`),
    readCounter(env.QUOTA_KV, `ip:${ip}:d:${dayK}`),
  ]);

  if (usedDay >= dailyClient) {
    return {
      allowed: false,
      remainingDay: 0,
      remainingMinute: Math.max(0, minuteClient - usedMin),
      remainingIp: Math.max(0, dailyIp - usedIp),
      resetInSec: secondsUntilUtcMidnight(),
      reason: "day_exceeded",
    };
  }
  if (usedMin >= minuteClient) {
    return {
      allowed: false,
      remainingDay: Math.max(0, dailyClient - usedDay),
      remainingMinute: 0,
      remainingIp: Math.max(0, dailyIp - usedIp),
      resetInSec: 60,
      reason: "minute_exceeded",
    };
  }
  if (usedIp >= dailyIp) {
    return {
      allowed: false,
      remainingDay: Math.max(0, dailyClient - usedDay),
      remainingMinute: Math.max(0, minuteClient - usedMin),
      remainingIp: 0,
      resetInSec: secondsUntilUtcMidnight(),
      reason: "ip_exceeded",
    };
  }

  const [newDay, newMin, newIp] = await Promise.all([
    incrementCounter(env.QUOTA_KV, `c:${clientId}:d:${dayK}`, DAY_SEC + HOUR_SEC),
    incrementCounter(env.QUOTA_KV, `c:${clientId}:m:${minK}`, 120),
    incrementCounter(env.QUOTA_KV, `ip:${ip}:d:${dayK}`, DAY_SEC + HOUR_SEC),
  ]);

  return {
    allowed: true,
    remainingDay: Math.max(0, dailyClient - newDay),
    remainingMinute: Math.max(0, minuteClient - newMin),
    remainingIp: Math.max(0, dailyIp - newIp),
    resetInSec: secondsUntilUtcMidnight(),
  };
}

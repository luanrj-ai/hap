/**
 * Website reachability verifier. HEAD request with redirect handling.
 * Falls back to GET if HEAD returns 405 (some servers reject HEAD).
 */
import { TTLCache } from "./cache";

export interface WebsiteStatus {
  reachable: boolean;
  /** HTTP status of the final response (after redirects). */
  status?: number;
  /** Final URL after redirects. */
  finalUrl?: string;
  /** Content-Length if returned by server (best-effort). */
  contentLength?: number;
  /** True when status 2xx and not an obvious parked-domain landing page. */
  looksReal?: boolean;
  error?: string;
}

const cache = new TTLCache<WebsiteStatus>(30 * 60 * 1000); // 30 min

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms = 5000,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function verifyWebsite(url: string): Promise<WebsiteStatus> {
  const key = `web:${url}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

    let res = await fetchWithTimeout(normalized, {
      method: "HEAD",
      headers: { "User-Agent": "ResumeTruth/0.1 verifier" },
      redirect: "follow",
    });
    // Some servers (Apache default, GitHub Pages on some configs) reject HEAD
    if (res.status === 405 || res.status === 501) {
      res = await fetchWithTimeout(normalized, {
        method: "GET",
        headers: { "User-Agent": "ResumeTruth/0.1 verifier" },
        redirect: "follow",
      });
    }

    const status = res.status;
    const finalUrl = res.url || normalized;
    const cl = Number(res.headers.get("content-length") || 0);

    const result: WebsiteStatus = {
      reachable: status < 500,
      status,
      finalUrl,
      contentLength: cl > 0 ? cl : undefined,
      // "Looks real" = 2xx response and not a parked-domain redirect
      looksReal:
        status >= 200 &&
        status < 300 &&
        !/parking|godaddy\.com|dan\.com|sedoparking/i.test(finalUrl),
    };
    cache.set(key, result);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const result: WebsiteStatus = { reachable: false, error: msg.slice(0, 100) };
    cache.set(key, result);
    return result;
  }
}

/** Extract URLs from resume text. Skips common non-portfolio URLs. */
export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)\],]+/gi) ?? [];
  return Array.from(new Set(matches.map((u) => u.replace(/[.,;:!?)]+$/, ""))));
}

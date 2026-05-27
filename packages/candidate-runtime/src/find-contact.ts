/**
 * Find a company's OFFICIAL application channel — for ONE company you're
 * actually applying to.
 *
 * Deliberate scope, because this is where a hiring agent turns into spam:
 *   - ONE named company at a time. No list, no fan-out.
 *   - Reads the company's OWN published site (careers / jobs / contact pages),
 *     not a search engine's scrape of personal inboxes.
 *   - Surfaces role-based addresses (jobs@, careers@, hiring@), never tries to
 *     dig up a CEO's personal email.
 * Targeted single-company application = normal. Mass exec-email blast = the
 * thing that kills the whole protocol's reputation. Keep it on this side.
 *
 * "Live web search" (a search API) is a drop-in behind this same interface;
 * reading the company's official site first is both safer and usually enough.
 */

const ROLE_PREFIXES = ["jobs", "careers", "hiring", "recruiting", "recruit", "talent", "people", "work", "join", "hr"];
const COMMON_PATHS = ["/careers", "/jobs", "/careers/", "/jobs/", "/contact", "/about", "/company/careers"];
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const NOISE = /(example|sentry|wixpress|\.png|\.jpg|\.svg|@2x|sentry\.io|godaddy)/i;

export interface FoundContact {
  emails: string[];
  careersUrl?: string;
  source: string;
  confidence: "high" | "medium" | "low";
}

export interface FindContactOptions {
  company: string;
  /** Known domain, e.g. "renlab.ai". If omitted, a few TLDs are guessed. */
  domain?: string;
  /** A specific careers/jobs URL you already have. Tried first. */
  careersUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function slug(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function rankEmails(emails: string[], domain: string): string[] {
  const seen = new Set<string>();
  const cleaned = emails
    .map((e) => e.toLowerCase())
    .filter((e) => !NOISE.test(e))
    .filter((e) => (seen.has(e) ? false : (seen.add(e), true)));
  return cleaned.sort((a, b) => score(b, domain) - score(a, domain));
}

function score(email: string, domain: string): number {
  const [local, host] = email.split("@");
  let s = 0;
  if (ROLE_PREFIXES.some((p) => local.startsWith(p))) s += 10;
  if (domain && host.endsWith(domain)) s += 5;
  return s;
}

async function tryFetch(url: string, f: typeof fetch, timeoutMs: number): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await f(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0 (HAP candidate-agent; +https://hap.dev)" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function findApplicationContact(opts: FindContactOptions): Promise<FoundContact> {
  const f = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const domains = opts.domain ? [opts.domain] : [`${slug(opts.company)}.com`, `${slug(opts.company)}.ai`, `${slug(opts.company)}.io`];

  const urls: string[] = [];
  if (opts.careersUrl) urls.push(opts.careersUrl);
  for (const d of domains) for (const p of COMMON_PATHS) urls.push(`https://${d}${p}`);

  const found: string[] = [];
  let hitUrl: string | undefined;
  for (const url of urls) {
    const html = await tryFetch(url, f, timeoutMs);
    if (!html) continue;
    const matches = html.match(EMAIL_RE) ?? [];
    if (matches.length) {
      found.push(...matches);
      hitUrl ??= url;
      // a careers/jobs page with role addresses is good enough — stop early
      if (/\/(careers|jobs)/i.test(url) && matches.some((m) => ROLE_PREFIXES.some((p) => m.toLowerCase().startsWith(p)))) {
        break;
      }
    }
  }

  const emails = rankEmails(found, opts.domain ?? "");
  const hasRole = emails.some((e) => ROLE_PREFIXES.some((p) => e.startsWith(p)));
  return {
    emails,
    careersUrl: hitUrl,
    source: hitUrl ? `read ${new URL(hitUrl).host}` : "no official page reachable",
    confidence: hasRole ? "high" : emails.length ? "medium" : "low",
  };
}

/**
 * Recruiter-side search against the discovery index (P3).
 *
 *   tsx scripts/search.ts --index <url> --q "rust payments" [--open-to backend]
 *                         --as <your-company-domain> [--contact <candidateKey>]
 *
 * Results never include contact — to reach a candidate, pass --contact <key>,
 * which the index gates by your identity + the candidate's own rate_limit.
 */
const argv = process.argv.slice(2);
const flag = (n: string): string | undefined => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

async function main() {
  const index = flag("index");
  const as = flag("as");
  if (!index || !as) {
    console.error('usage: search --index <url> --as <company-domain> [--q "rust"] [--open-to backend] [--contact <key>]');
    process.exit(1);
  }
  const headers = { "x-hap-recruiter": as };

  const contactKey = flag("contact");
  if (contactKey) {
    const res = await fetch(`${index.replace(/\/$/, "")}/contact`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ candidate: contactKey }),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; contact?: string; error?: string } | null;
    console.log(j?.ok ? `contact for @${contactKey}: ${j.contact}` : `✗ ${j?.error ?? res.status}`);
    return;
  }

  const qs = new URLSearchParams();
  if (flag("q")) qs.set("q", flag("q")!);
  if (flag("open-to")) qs.set("open_to", flag("open-to")!);
  const res = await fetch(`${index.replace(/\/$/, "")}/search?${qs}`, { headers });
  const j = (await res.json().catch(() => null)) as { ok?: boolean; hits?: Array<{ key: string; name: string; headline?: string; verified: { note: string; rankSignal: number } }>; error?: string } | null;
  if (!j?.ok) {
    console.error(`✗ ${j?.error ?? res.status}`);
    process.exit(1);
  }
  console.log(`\n${j.hits!.length} candidate(s) (ranked by verified signal):`);
  for (const h of j.hits!) {
    console.log(`  @${h.key.padEnd(16)} ${h.name}${h.headline ? ` — ${h.headline}` : ""}  [${h.verified.note}]`);
  }
  console.log(`\nto reach one: search --index ${index} --as ${as} --contact <key>`);
}

main().catch((e) => { console.error(e); process.exit(1); });

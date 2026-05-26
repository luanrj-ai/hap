# HAP v0.1 launch plan — solo developer runbook

**Today**: 2026-05-26 (Tue)
**Target launch**: 2026-06-10 (Tue) · gives 2 weeks of pre-launch hardening
**6-month goal**: 1,000+ GitHub stars · 1–2 published articles · 1–3 verbal integrators
**Stop condition**: if at month 3 we have < 200 stars AND zero integrator conversations, pivot to direct ATS outreach (see §G).

---

## A. Pre-launch hardening · weeks 1–2 (May 26 → Jun 9)

These are the things that ruin a launch if they're broken. Do them in this order.

### A.1 — Identity & infra
- [ ] Buy `hap.dev` (check: `whois hap.dev`). If taken, fall back to `hap.run` or `hap-protocol.org`.
- [ ] Push the GitHub repo public at `github.com/<org>/hap`. Pick the org name now (suggestion: `hap-protocol`).
- [ ] Global find/replace `your-org` → real GitHub org. Touches:
  - `apps/web/app/page.tsx` (6 occurrences)
  - `apps/web/app/landing-content.tsx` (4 occurrences)
  - `scripts/demo-video-storyboard.md`
  - `README.md` if/when written
- [ ] Real star count widget: drop the hardcoded `2.1k` in the nav; wire to GitHub API or remove.
- [ ] Deploy proxy: `cd apps/proxy && npm run kv:create && wrangler secret put OPENAI_API_KEY && npm run deploy`. Wire `api.hap.dev` to the worker.
- [ ] Deploy landing: `vercel --prod` from `apps/web`. Wire `hap.dev` → vercel.

### A.2 — Demo artifact
- [ ] Record the 60-second demo video per `scripts/demo-video-storyboard.md`. asciinema → mp4. Host at `hap.dev/demo.mp4` + YouTube mirror.
- [ ] Embed the video above the fold on the landing OR replace the hero transcript with the recorded GIF if the live transcript fails to load on mobile (test it).
- [ ] Verify `npm run demo` works from a clean clone on a fresh machine. Time it. If > 90 seconds, it's not "60-second quick start" — fix.

### A.3 — Content preload (write before launch, publish after)
Write three pieces. None of them publish on launch day — they publish on the calendar in §C. Drafting them now gives you ammunition for HN comment threads.

- [ ] **Piece #1 — "Why I'm publishing a hiring protocol before anyone uses it"** (founder voice, ~1,200 words, technical). Explain the bet on A2A + the gap that ATS plugins leave.
- [ ] **Piece #2 — "HAP is not MCP, and here's why that matters"** (~1,800 words, hugely technical). MCP = agent ↔ tool, A2A = agent ↔ agent. Cite the Google A2A spec.
- [ ] **Piece #3 — "Reading hireIC carefully: where protocols beat products"** (~1,400 words, respectful diff). Position HAP as the layer underneath, not the competitor. Email a draft to the renlab team before publishing — invite them to co-author or rebut.

### A.4 — Outreach pipeline (warm before launch)
Send these emails the week before launch, not on launch day. They need time to respond.

| Target | Why | Ask |
|---|---|---|
| Google A2A maintainers (via their public Discord) | HAP is literally an A2A profile | "Is this what an A2A profile should look like? Feedback welcome." |
| Anthropic developer relations | MCP-adjacent, will be asked about HAP | "Heads up; here's the diff. Happy to clarify if your dev community asks." |
| Renlab (hireIC team) | Closest adjacent product | "We're a layer beneath you. Want to talk?" — draft of piece #3 attached. |
| 2–3 ATS-vendor PMs (Greenhouse, Lever, Ashby) | Long-shot integrators | "Free reference impl available. 30-min call to discuss?" |
| Pragmatic Engineer / TLDR newsletter / Last Week in AI | Tech newsletters that cover OSS launches | "Launching X on date Y. Embargo until then. Demo link." |

Maintain this as a real CRM (a Notion table or a `outreach.csv`). Track: sent date / replied? / outcome.

---

## B. Launch day · Tue 2026-06-10

Tuesday is statistically the best HN day. 8–10am PT (16:00–18:00 UTC) catches both US west-coast morning and EU end-of-day.

### B.1 — Pre-flight (T-1 hour)
- [ ] Verify `hap.dev` resolves. Hard-refresh in incognito. Check mobile.
- [ ] Verify `npm run demo` from clean clone.
- [ ] Demo video plays inline on landing.
- [ ] `api.hap.dev/health` returns ok.
- [ ] GitHub repo is public, README is decent, LICENSE is MIT, CONTRIBUTING.md tells people how to file an RFC issue.
- [ ] Pin a GitHub issue: "Frequently asked questions (read before opening one)" — copy the FAQ from the landing.

### B.2 — Post to Hacker News
URL: `https://news.ycombinator.com/submit`

**Title** (80-char limit):
> Show HN: HAP – an open A2A profile for AI-mediated hiring

Notes on title choice:
- "Show HN" prefix → Show HN gets its own queue with more forgiving ranking
- "HAP" gets the brand a second of recall before the description
- "A2A profile" is technical specificity HN loves; it positions immediately
- "AI-mediated hiring" is the high-level WHAT
- Don't say "no-resume" / "no-blockchain" / "no-LinkedIn" in the title — anti-claims read as defensive

**URL field**: `https://hap.dev` (landing, not the GitHub repo — the landing has higher conversion to star). The HN comment links the repo.

### B.3 — First comment (OP, posted within 90 seconds of submit)
HN convention: the submitter writes the first detailed comment explaining "I made this." Have this ready in a text file. Verbatim draft:

> Hi HN — solo dev here. I've been working on HAP for ~2 months. Short version:
>
> Resumes don't survive the AI-generation era. ATS systems are vendor-locked. So I drafted a protocol that lets a candidate's AI agent and a recruiter's AI agent run a structured interview directly, exchanging cited evidence (GitHub commits, talks, papers) over an A2A channel.
>
> It's *not* a product. It's a v0.1 RFC + 4 reference TypeScript implementations + a hosted free-tier LLM proxy so you can `npm run demo` in 60 seconds without an API key.
>
> Why publish before adoption: I want the schemas critiqued before v1.0 locks them in. v0.x explicitly allows breaking changes.
>
> Specifically not:
> - Not a SaaS, not an ATS replacement. (Greenhouse / Lever own that pipe and I don't want it.)
> - Not blockchain / VCs. (Ecosystem isn't there for hiring; 3–5 years out.)
> - Not MCP. MCP is agent↔tool. HAP is agent↔agent.
> - Not a LinkedIn competitor. No central DB, no identity broker.
>
> Repo: `github.com/<org>/hap` · Spec: `hap.dev/spec` · Demo video on landing.
>
> Happy to argue any of this in the comments.

Notes:
- First-person, terse, lists what it ISN'T (HN loves anti-positioning when it's specific)
- Volunteers the awkward parts ("solo dev", "before adoption") — disarms the "who are you / why should I care" replies
- Three concrete artifacts (repo / spec / demo) so a skeptical reader can verify in 30 seconds

### B.4 — First 4 hours: be at the keyboard
HN ranking peaks in the first 4 hours. Comment-response latency matters more than comment quality. Have a tea ready.

Response playbook by comment archetype:

| Comment | Don't | Do |
|---|---|---|
| "This is just X" (LinkedIn, MCP, …) | Defend by listing differences | One-sentence acknowledge, then "the actual diff is X; here's the spec section" with a link |
| "Why not blockchain / VCs?" | Get philosophical | Quote the FAQ verbatim. Don't argue. |
| "Adoption?" | Promise the future | Honest: zero today. That's why we're publishing now. |
| "Cool, where's the Python SDK?" | Apologize | "TS reference impl only at v0.1. PR welcome. Issue here: [link]" |
| Hostile / dismissive | Engage in detail | One sentence, link to spec section, move on. |
| Praise | "Thanks!" | Reply with a specific ask: "PRs on the evidence registry would help — issue #X" |

Do not edit the OP comment after it's posted. HN treats edits as a tell.

### B.5 — End-of-day
- [ ] Capture metrics: HN points peak, page views (Vercel analytics), GitHub star count, demo runs (proxy quota), unique IPs to landing
- [ ] Write a brief retrospective (private, ~500 words) on what worked / what didn't. Used for piece #4 later.

---

## C. Content & community cadence · weeks 0–8

The launch is **t=0**. Don't post all content at once — drip it.

| Week | Date (Tue) | Action | Channel |
|---|---|---|---|
| 0 | Jun 10 | HN Show HN post | HN |
| 0 | Jun 11 | Piece #1 publishes — "Why publish before anyone uses it" | Personal blog + cross-post HN (no "Show HN" prefix; ask a friend to submit) |
| 1 | Jun 17 | Piece #2 — "HAP is not MCP" | Personal blog · cross-post r/programming · LinkedIn for the recruiting side |
| 2 | Jun 24 | Piece #3 — "Reading hireIC carefully" | Personal blog (after renlab review) |
| 3 | Jul 01 | Office hours / AMA on GitHub Discussions | Pin on landing for 1 week |
| 4 | Jul 08 | First "what changed in v0.2 RFC" post | Personal blog + GitHub release notes |
| 5 | Jul 15 | Integrator interview #1 (if exists) — "How [X] uses HAP" | Personal blog |
| 6 | Jul 22 | Recap of HN comments → issues filed → PRs landed | Personal blog |
| 7 | Jul 29 | "Verifier framework" v0.3 proposal | RFC issue + Discord ping |
| 8 | Aug 05 | Quarterly state-of-HAP — stars / demo runs / integrators / lessons | Personal blog + LinkedIn |

Rule: ship one piece a week, no more. Burning out at week 3 with three half-written pieces is the failure mode.

---

## D. Community surfaces · pick 2, ignore the rest

You're solo. You can't moderate 5 channels.

- **PRIMARY · GitHub Discussions** — RFC threads, design proposals, "did I implement this right?" questions. Free, indexed by Google, version-controlled.
- **SECONDARY · A2A Discord** — go to the existing Google A2A community. Do not start your own Discord. Engage in their #integrations channel. Be the "the hiring profile guy."

Explicitly skipping:
- Twitter / X — single tweet at launch + replies, that's it. No daily posting.
- /r/hap subreddit — wait for organic demand. Empty subreddits look worse than no subreddit.
- LinkedIn — one launch post + one quarterly post, no more. (LinkedIn is the recruiter audience and you're not optimizing for them yet.)
- Slack workspaces — never. Maintenance cost too high.
- Mastodon — selectively re-share blog posts, no daily presence.

---

## E. Outreach pipeline · keep filling it

After launch, dedicate **Friday afternoons** to outreach. 2 hours. 5–10 emails. Track in the `outreach.csv`.

Tiers:

1. **High-leverage (1–2 per month)**: ATS PMs, A2A maintainers, big-name dev advocates
2. **Newsletter / press (2–3 per month)**: keep reaching out as content lands
3. **Individual integrators (5–10 per month)**: anyone who stars + opens an issue → DM them, ask what they're building

Email template (high-leverage):

> Subject: HAP — 30 sec on why this might matter to <company>
>
> <First name>,
>
> Saw <something specific about their work / company>. I'm the author of HAP, a v0.1 open protocol for AI agents to run hiring interviews on each other's behalf (`hap.dev`). It's an A2A profile, MIT, federated.
>
> Why I'm writing you: <specific reason — e.g. "your ATS team is building agent integrations and I want to make sure HAP doesn't paint you into a corner">.
>
> 20 min call this or next week? I'll listen more than talk.
>
> — <name>

Three-strike rule: if no response after two follow-ups (2 weeks apart), drop them. Don't waste energy.

---

## F. Metrics · weekly, public, honest

Track these every Friday. Post to landing page or GitHub Discussions:

| Metric | Source | What "healthy" looks like at month 1 / 3 / 6 |
|---|---|---|
| GitHub stars | repo | 200 / 600 / 1000 |
| Unique landing visitors | Vercel analytics | 5k / 15k / 30k cumulative |
| `npm run demo` invocations | proxy quota logs | 100 / 500 / 2000 |
| GitHub issues opened | repo | 8 / 40 / 100 |
| GitHub Discussions threads | repo | 4 / 15 / 40 |
| Integrator conversations | `outreach.csv` | 1 / 5 / 15 — counting "had a 20-min call" |
| Verbal integrators (commits to using HAP in their roadmap) | `outreach.csv` | 0 / 1 / 3 |
| Articles citing HAP (not by us) | manual Google alert | 0 / 1 / 3 |

Pivot signal: at month 3, if stars < 200 AND integrator conversations < 3, drop content cadence and switch fully to direct ATS outreach. The protocol-homepage strategy isn't working in this category.

---

## G. Risk playbook

| Risk | Pre-mortem | Mitigation |
|---|---|---|
| HN post flops (front page < 4 hrs, < 50 points) | Don't repost. HN penalizes reposts hard. | Wait 4 weeks. Resubmit with a different angle ("Show HN: I built X using HAP" — third-party launch). |
| Goes viral, server falls over | Load-test the proxy at 100 RPS. Verify Cloudflare Workers KV doesn't melt. | Free-tier proxy quota is per-IP — naturally caps. Landing is static on Vercel. |
| A2A maintainers push back ("this isn't a valid A2A profile") | They'll see the launch | Pre-launch outreach (§A.4) defuses this. Have a "we'd love guidance on profile registration" reply ready. |
| Renlab (hireIC) takes it as competitive attack | The "respectful diff" piece (#3) plus pre-publication review | Get their sign-off on piece #3 before launch. If they object, drop it; ship piece #4 instead. |
| Someone forks and renames | Welcome them publicly. The protocol thrives on adoption. | One tweet + a sentence on the landing: "Forks welcome. We're a spec, not a product." |
| Recruiter PMs ask "where's the ATS integration?" | Likely on day 1 | "I have a reference HR-agent in TypeScript that you can wrap. Issue #X: 'first-party ATS adapter request'." Direct them to file the issue. |
| Solo burnout | Real risk by month 3 | Hard rule: 1 blog post / week max. 1 release / month max. Sundays off the keyboard. |

---

## H. The thing this plan deliberately doesn't have

- No "hire a community manager" line item. (You can't afford one. Don't pretend you can.)
- No paid ads. (HN/blog audience can't be bought; ATS audience can but isn't worth it yet.)
- No multi-language localization. (EN + ZH is in the landing already; that's enough.)
- No Discord server. (Maintenance > value at v0.1.)
- No founding-team page. (You're solo. Putting a stock photo would be worse.)
- No press release. (HN + 3 blog posts > any PR firm at this scale.)

---

## I. Quick decisions you need to make this week

| Decision | Default | Why I think this |
|---|---|---|
| GitHub org name | `hap-protocol` | Mirrors a2a-protocol, mcp-protocol — fits the category. |
| Primary domain | `hap.dev` | If available. `.dev` is the protocol-page TLD in 2026. |
| Should the spec live in the same repo as code? | Yes | Lowers contributor friction; one PR = spec + impl change. |
| License | MIT (already) | Apache 2.0 would be slightly safer for patent protection — but MIT is what HN expects for an indie OSS launch. Don't overthink. |
| Should you actually attend HN comments live? | Yes — block 9am–1pm PT on Jun 10 | Comment latency in the first 4 hours determines whether you stay on the front page. |
| Should you cross-post to /r/programming on launch day? | No — wait until piece #2 | Reddit and HN audiences resent simultaneous posts. |
| Should you tweet at @ylecun / @karpathy / etc.? | No | Begging-for-attention reads obvious. If they engage organically, great. |

---

## J. After-action (do this no matter how the launch goes)

By 2026-06-17 (one week post-launch):
- [ ] Write the post-mortem (private, ~1,500 words). What worked, what didn't, what surprised you.
- [ ] Update this file with actuals against the §F metrics targets.
- [ ] Decide: pivot, stay course, or accelerate. Three concrete options written down.

---

## TL;DR runbook (for the day-of you, panicking)

1. **Jun 10, 8am PT**: open laptop. Coffee. Do not edit the landing.
2. **8:45am**: paste the title + URL into HN submit form. Hit submit.
3. **8:46am**: paste the first comment (B.3). Hit submit.
4. **8:47am to 1pm**: stay at the keyboard. Reply to comments. Don't argue. Link to the spec.
5. **1pm**: lunch. Come back, capture metrics.
6. **5pm**: stop. Take a walk.
7. **Tomorrow**: piece #1 publishes. Repeat the cadence in §C.

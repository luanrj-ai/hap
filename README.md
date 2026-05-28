# HAP · Hiring Agent Protocol

> **Your work is your résumé — your agent does the rest.** Your agent keeps a verified profile from your real GitHub (and, opt-in, your local Claude Code work), applies to roles for you, and gets you found — ranked on **evidence employers can check**, not a résumé.

**Status:** v0.2 · draft · breaking changes allowed before v1.0
**Spec:** [`spec/hap-v0.2.md`](./spec/hap-v0.2.md) · **Schemas:** [`spec/schemas/`](./spec/schemas)
**License:** MIT (code) · Apache-2.0 (spec) · built on [A2A](https://a2a-protocol.org)

---

## What this is

Resumes are self-reported, and AI made the medium unfalsifiable. So don't trust the writing — trust the links. HAP turns your real work into a **verified, candidate-owned profile** that applies for you and gets you found, while every claim an employer sees is one they can **dereference**.

- **Candidate-initiated · async.** You run an ephemeral agent; the employer publishes static data and receives. No always-on candidate server.
- **Scored on verified evidence, not prose.** A neutral scorer opens every cited link (commit author is you, the repo is real, the talk exists) and scores *that*. The agent's wording and its self-rated confidence count for zero. A fabricated citation is a hard gate.
- **Found by what's verified.** Opt-in discovery ranks you on verified signal; your contact is never bulk-exposed — a recruiter must request it, gated by a limit you set.
- **Open & yours.** An [A2A](https://a2a-protocol.org) profile with published JSON Schema. Self-hostable, federated, MIT. Free, unlimited, agent-friendly. Your profile and contact live with you, not in someone's database.

What HAP is **not**: an ATS, a LinkedIn, a central résumé database, or a KYC provider. The hiring *decision* stays human (and is regulated — EU AI Act, NYC LL144, GDPR Art. 22).

---

## 60-second quick start

```bash
git clone https://github.com/luanrj-ai/hap
cd hap
npm install && npm run build
npm run demo:apply
```

Spins up an employer inbox, publishes a role, runs a candidate-agent that answers the rubric with cited evidence and submits, and the inbox **auto-scores** it on dereferenced links — prints the packet, the receipt, and the verified report. No API keys required (falls back to template answers).

To enable real LLM relevance, add `apps/web/.env`:

```
OPENAI_API_KEY=sk-...        # or ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...         # optional: avoids the 60/h unauthenticated GitHub limit when verifying
```

---

## The whole loop

**Candidate**

```bash
# 1. build your living profile from PUBLIC github (+ opt-in LOCAL Claude Code footprint, metadata only)
npm run profile -- --handle <your-github> --with-claude

# 2. apply (one role, with a review file before anything is sent)
npm run apply -- --posting <postingUrl> --handle <your-github>
npm run apply -- --send

# 2b. or apply across many roles: rank by match, then auto-apply (threshold + cap + dedupe)
npm run apply -- --targets <url1,url2,...> --auto --threshold 0.5

# 3. opt in to discovery so recruiters can find you
npm run profile -- --handle <your-github> --publish http://localhost:4920
```

**Employer**

```bash
npm run serve:inbox     # publish a role + a dumb inbox that auto-scores applications  (:4910)
npm run serve:index     # a discovery index: verify + rank opt-in profiles            (:4920)
npm run search -- --index http://localhost:4920 --q "rust payments" --as your-co.com
```

**Recruiter dashboard:** set `HAP_INBOX_URL` / `HAP_INDEX_URL` in `apps/web/.env`, run `npm run dev:web`, open **`/hap`** — applications with verified reports + candidate search with gated "reveal contact".

---

## How it works

Four async messages (canonical [JSON Schema](./spec/schemas)):

| Message | From → to | What |
|---|---|---|
| `hap.posting` | employer → world | a JD + a published rubric + a submit endpoint (static; no agent to post) |
| `hap.application` | candidate-agent → inbox | one evidenced answer per rubric item, outbound |
| `hap.receipt` | inbox → candidate | async ACK (scoring runs in the background) |
| `hap.profile` | candidate-owned | living profile; opt-in publishable to a discovery index |

The **neutral scorer** dereferences each citation → `verified` / `exists_unlinked` / `unverifiable` / `fabricated`, judges relevance from the *fetched facts* (never the candidate's prose), gates on required items + fabrication, and lifts identity from *asserted* to *proven* via `proof_of_control` (a `HAP-PROOF` gist today; GitHub OAuth in v0.3). Self-reported Claude footprint is **never scored**.

The v0.1 synchronous interview (`hap.ask` / `hap.answer` / `hap.session.close`) survives as an **optional L1 layer** for live follow-up once both sides run agents.

Honest about limits: this is "防君子不防小人" — it makes padding fail and identity provable, but full anti-impersonation needs the interactive challenge on the roadmap. Best today for technical / product ICs with a public footprint.

---

## Repository layout

```
hap/
├── spec/
│   ├── hap-v0.2.md            # the v0.2 RFC (v0.1 interview kept as hap-v0.md)
│   └── schemas/*.schema.json  # generated from the canonical Zod
├── packages/
│   ├── a2a-adapter/           # message schemas (Zod) + AgentCard builder
│   ├── candidate-runtime/     # gather · living-profile · apply · apply-targets · render · find-contact · claude-footprint
│   ├── hr-runtime/            # inbox (auto-score) · posting · discovery index
│   ├── scoring/               # neutral verified scorer + evidence verifiers + LLM client
│   └── shared/                # shared types
├── apps/
│   ├── web/                   # Next.js landing + /spec + /hap recruiter dashboard
│   ├── proxy/                 # Cloudflare Worker: free-tier LLM key proxy
│   └── extension/             # Chrome MV3 extension (legacy)
└── scripts/                   # demo-apply · profile · apply · search · serve-inbox · serve-index · gen-schemas · test-*
```

`npm` workspaces, Node ≥ 20. Tests: `npm run test:all` (scorer · profile · match · discovery · spec — all offline).

---

## How HAP differs · honestly

| | HAP | Job board / ATS | AI résumé screener |
|---|---|---|---|
| Trust root | dereferenced evidence + proof-of-control | the platform's database | the résumé's own words |
| What's scored | verified artifacts, not prose | keywords + recruiter eyeballing | an LLM reading self-reported claims |
| Who owns the data | the candidate (profile + contact) | the platform | whatever you upload |
| Cost / access | free · unlimited · agent-friendly | paid · daily caps · bans bots | per-seat SaaS |
| Ships today | v0.2 · MIT · demo + JSON Schema | yes (owns the pipe) | yes (trusts the text) |

Where we lose: adoption is early; the spec is v0.x; it's strongest for technical/IC roles today.

---

## Contributing

We're 0.x — anything before v1.0 may change; the point of publishing now is to get the schemas critiqued before they're hard to move.

- **Spec critiques:** open an issue tagged `rfc`, referencing a section of `spec/hap-v0.2.md`.
- **Implementations / verifiers:** PRs welcome on the reference packages; new evidence types extend the registry.
- **Regenerate schemas** after changing the Zod: `npm run spec:schemas` (needs `npm i -D zod-to-json-schema`).

Goal-state for v1.0 (≥ Q3 2027): ≥ 5 independent runtimes interoperating cleanly.

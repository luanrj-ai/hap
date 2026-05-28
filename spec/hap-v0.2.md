# HAP · Hiring Agent Protocol v0.2 (draft)

> **Status**: Draft. Comments → GitHub issues.
> **Versioning**: v0.x = breaking changes allowed. v1.0 = stable.
> **Base layer**: Google [A2A](https://a2a-protocol.org/). HAP is an A2A profile — it standardizes the *content* of a hiring exchange, not the transport.
> **Machine-readable schemas**: [`spec/schemas/*.schema.json`](./schemas) (generated from the canonical Zod in `packages/a2a-adapter`).
> **License**: Apache-2.0 (spec) + MIT (reference impls).

## What changed from v0.1

v0.1 was **synchronous and recruiter-driven**: an HR-agent POSTed into a live
candidate-agent HTTP server and blocked for each reply. That forced every
candidate to host an always-on, publicly reachable server — the single biggest
adoption tax, and it contradicted the "federated like SMTP" goal.

v0.2 decouples two things v0.1 welded together:

- **WHO EVALUATES vs WHO PROVES** — unchanged: the employer side asks/scores, the candidate side proves with evidence.
- **WHO INITIATES** — now either side, and the transport is **async / store-and-forward**. Neither party need be online at once.

The v0.1 live interview still exists as an **optional L1 layer** (reuse the v0.1
`hap.ask` / `hap.answer` / `hap.session.close` messages, threaded by
`application_id`) for when both sides run agents and want real-time follow-up.

## Principles

1. **Candidate-initiated, low friction.** The motivated party (the candidate) runs an ephemeral agent; the employer publishes static data and receives. No always-on candidate server.
2. **Score on verified evidence, not prose.** The employer's neutral scorer DEREFERENCES each cited link and scores what checks out. The agent's wording and its self-reported confidence count for zero. A fabricated citation is a hard gate, not a deduction.
3. **Identity you can prove.** An identity anchor (a GitHub account) is *asserted* by default and becomes *proven* via proof-of-control (a `HAP-PROOF` gist today; OAuth later). Residual gap (wholesale impersonation) is acknowledged, not hidden.
4. **Decentralized data, central discovery.** Candidates own their profile; an optional central index makes them searchable (Web/Google model, NOT P2P — P2P is worst at search and can't enforce anti-abuse). Discovery is opt-in.
5. **Progressive disclosure end to end.** A candidate applies to the one employer they choose; in discovery, contact is never bulk-exposed — a recruiter must request it, gated by the candidate's own rate limit.

## Roles

| Role | Holds | Does |
|---|---|---|
| **Candidate-agent** | the candidate's public footprint + a living profile | reads a posting, answers the rubric with cited evidence, submits one packet; optionally publishes a discoverable profile |
| **Employer** | one or more postings + an inbox | publishes static postings; receives applications; runs the neutral scorer |
| **Index** (optional) | opt-in candidate profiles | verifies + ranks published profiles; serves recruiter search; gates contact |

## Message types (v0.2)

All four are A2A `Message` payloads discriminated by `kind`. Canonical JSON
Schema: [`spec/schemas/`](./schemas).

### `hap.posting` — employer → world (static)

A role plus a **published rubric** (the `must_have` / `nice_to_have` expanded
into questions) and a submit endpoint. No agent required to publish one.

```json
{
  "kind": "hap.posting",
  "posting_id": "renlab-ai-builder-001",
  "jd": { "title": "AI Builder · multi-agent / SWM", "summary": "…", "must_have": ["…"], "nice_to_have": ["…"] },
  "rubric": [
    { "question_id": "m1", "required": true,
      "ask": { "type": "open", "prompt": "Show evidence for: multi-agent simulations end to end." } }
  ],
  "submit": { "endpoint": "https://api.renlab.ai/apply", "transport": "https" },
  "from": { "company": "renlab", "human_contact": "jobs@renlab.ai" },
  "flows": ["candidate_initiated"]
}
```

### `hap.application` — candidate-agent → employer inbox (one outbound packet)

One evidenced answer per rubric item. Identity anchor in `profile_evidence`;
optional `proof_of_control`. Private `human_contact` (only this employer sees it).

```json
{
  "kind": "hap.application",
  "application_id": "a_01HXY7K4M2P9",
  "posting_ref": { "posting_id": "renlab-ai-builder-001" },
  "candidate": {
    "name": "Alex Chen",
    "human_contact": "alex@example.com",
    "profile_evidence": [{ "type": "github_user", "url": "https://github.com/alex-chen" }],
    "proof_of_control": { "method": "github_gist", "url": "https://gist.github.com/alex-chen/…" }
  },
  "responses": [
    { "question_id": "m1",
      "answer": { "text": "…", "evidence": [{ "type": "github_repo", "url": "https://github.com/alex-chen/abm-sim" }], "confidence": "high", "decline_reason": null } }
  ],
  "self_assessment": { "fit": "plausible" },
  "disclosure": { "contact_release": "on_submit", "public": false }
}
```

Declining honestly (`decline_reason: "no_evidence"`) is first-class and unpenalised.

### `hap.receipt` — inbox → candidate (async ACK)

The inbox may be dumb: store + return this. Scoring runs in the background.

```json
{ "kind": "hap.receipt", "application_id": "a_01HXY7K4M2P9", "status": "received", "next": "agent_followup_possible" }
```

### `hap.profile` — candidate-owned, opt-in publishable (discovery)

The candidate's living profile: verifiable `profile_evidence` plus a
**self-reported, never-scored** `cc_footprint` (Claude Code projects derived
locally). Useful with zero employers; publish it to an index to be discoverable.

```json
{
  "kind": "hap.profile",
  "generated_at": "2026-05-28T00:00:00Z",
  "candidate": {
    "name": "Alex Chen",
    "specializations": ["rust", "payments"],
    "profile_evidence": [{ "type": "github_user", "url": "https://github.com/alex-chen" }],
    "cc_footprint": [{ "project": "abm-sim", "sessions": 12, "last_active": "2026-05-20", "repo_url": "https://github.com/alex-chen/abm-sim", "self_reported": true }],
    "proof_of_control": { "method": "github_gist", "url": "https://gist.github.com/alex-chen/…" },
    "inbox": { "endpoint": "mailto:alex@example.com", "transport": "mailto" },
    "open_to": ["backend", "ai"],
    "rate_limit": { "per_day": 10 }
  }
}
```

## Verification & scoring (employer / index side)

The neutral scorer produces a transparent report; it never trusts the candidate
agent's text.

- **Dereference** each cited evidence URL. Per item: `verified` (resolves AND ties to the anchor), `exists_unlinked` (real but not provably the candidate's — name matches land here), `unverifiable` (auth-walled, or transient unreachable — never penalised), `fabricated` (server says it does not exist).
- **Relevance** is judged only from the *fetched facts*, never the candidate's prose.
- **Score** = strength(verification × relevance), max over an item's evidence; self-reported `confidence` is ignored; `cc_footprint` is never scored.
- **Gates**: any required item below threshold → `no_fit`; any `fabricated` citation → `no_fit` + a fabrication flag (a hard gate, even amid strong evidence).
- **Identity**: `proof_of_control` lifts the anchor from *asserted* to *proven*.

Evidence types (open registry): `github_user|repo|commit|pr`, `talk`,
`blog_post`, `paper`, `package`, `linkedin`, `personal_site`, `oss_maintainer`,
`email_domain`. Verifier hints per type live with the reference verifiers.

## Discovery protocol (optional, opt-in)

Web/Google model: candidates own a `hap.profile`; a central index verifies +
ranks + serves search. Anti-abuse is enforced centrally:

- **publish** — candidate opt-in; index verifies evidence and stores. Candidate may unpublish.
- **search** — requires a recruiter identity; rate-limited per recruiter; blocklist; ranked by *verified* signal. Results carry no contact.
- **contact** — a recruiter must request a candidate's contact; gated by recruiter identity + the candidate's own `rate_limit.per_day`. (Progressive disclosure preserved in discovery.)

## Well-known endpoints (agent2agent)

- Employer publishes each `hap.posting` at a stable URL (e.g. `/.well-known/hap/postings/<id>.json` or any indexable page).
- Candidate (if discoverable) publishes `hap.profile` at `/.well-known/hap-profile.json` on a domain they control; the index crawls/verifies it.
- A2A `AgentCard` (`/.well-known/agent.json`) declares the `hap.v0.2` skill, the role (`candidate` | `employer` | `index`), and supported evidence types.

## Flows

**Candidate-initiated (default).** read posting → answer rubric with evidence →
(optional review) → POST `hap.application` → `hap.receipt` → employer scores →
human contacts. Full-auto across many postings is opt-in, gated by a candidate-
side match threshold + a per-run cap + a dedupe ledger.

**Recruiter-initiated (sourcing).** recruiter searches the index → ranked
verified candidates → requests contact (gated) → reaches out. Symmetric: the
asker is still the employer, only the initiative differs.

**L1 live interview (optional).** once both run agents, the employer may send
v0.1 `hap.ask`, candidate replies `hap.answer`, employer sends
`hap.session.close` — threaded by `application_id`.

## Decision boundary

Agents handle gather → verify → score → shortlist → (opt-in) apply. The hiring
**decision stays human** — automated employment decisions are regulated (EU AI
Act, NYC LL144, GDPR Art. 22) and a human should make the call regardless.

## Non-goals

ATS replacement; identity/KYC verification of the human behind an agent; a job
marketplace; a central résumé database. HAP is the application + evidence +
discovery layer; data stays candidate-owned.

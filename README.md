# HAP · Hiring Agent Protocol

> An open A2A profile for AI-mediated hiring. Two agents — one for the candidate, one for the recruiter — interview each other with cited, dereferenceable evidence. Federated. Self-hosted. MIT.

**Status:** v0.1 RFC · draft · breaking changes allowed before v1.0
**Spec:** [`spec/hap-v0.md`](./spec/hap-v0.md)
**Landing:** [hap.dev](https://hap.dev) *(pending)*

---

## What this is

HAP is to [Google A2A](https://a2a-protocol.org) what HTTP is to TCP. A2A handles the envelope (agent cards, message routing, auth). HAP standardizes the **payload** — what a hiring conversation actually contains.

Both sides of the hiring conversation are about to be agents. They need a wire format. HAP is that wire format.

- **Federated** — no central server, no on-chain claims. Each side runs its own agent.
- **Evidence over claim** — answers cite GitHub commits, talks, papers, etc. Every claim is a hyperlink.
- **Progressive disclosure** — no full resume, no full JD; just the relevant pieces, by mutual consent.
- **An A2A profile** — not a new protocol war. Any A2A runtime speaks HAP the moment it declares the skill.

What HAP is **not**: an ATS replacement, a LinkedIn competitor, an MCP fork, a blockchain credential scheme.

---

## 60-second quick start

```bash
git clone https://github.com/luanrj-ai/hap
cd hap
npm install
npm run demo
```

Spins up a candidate-agent and an HR-agent on `localhost`, runs one HAP session, prints the transcript. No API keys required — falls back to a template HR-agent if no LLM is configured.

To enable real LLM-generated answers, add to `apps/web/.env`:

```
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Repository layout

```
hap/
├── spec/
│   └── hap-v0.md                  # the v0.1 RFC
├── packages/
│   ├── a2a-adapter/               # HAP message schemas (Zod) + AgentCard builder
│   ├── candidate-runtime/         # reference candidate-agent (Hono)
│   ├── hr-runtime/                # reference HR-agent (Hono)
│   ├── scoring/                   # LLM client + scoring engine
│   └── shared/                    # shared types
├── apps/
│   ├── web/                       # Next.js landing + reference HR dashboard
│   ├── proxy/                     # Cloudflare Worker: free-tier LLM key proxy
│   └── extension/                 # Chrome MV3 extension (legacy ResumeTruth)
└── scripts/
    ├── demo-interview.ts          # the npm run demo entrypoint
    ├── demo-video-storyboard.md   # 60-second launch video plan
    └── launch-plan.md             # the launch runbook
```

`npm` workspaces, Node ≥ 20.

---

## How HAP differs · honestly

| | HAP | ATS plugin | Web3 hiring chain |
|---|---|---|---|
| Trust root | HTTPS + per-URL evidence | ATS vendor's DB | on-chain DID claims |
| Interop | federated · any A2A runtime | walled garden | chain-locked, bridge-broken |
| Candidate consent | progressive | full resume upfront | credentials minted ahead |
| Ships today | v0.1 RFC + TS impls | yes | 3–5 years out |
| Where we lose | adoption is zero today | we don't track applications | no on-chain attestation primitive |

---

## Run your own agents

```bash
# candidate-agent (defaults to bundled example profile)
PROFILE=./me.json PORT=4001 npm run dev:candidate

# HR-agent (defaults to bundled example JD)
JD=./role.json PORT=4002 npm run dev:hr

# trigger an interview
curl -X POST http://localhost:4002/interview \
  -H 'content-type: application/json' \
  -d '{"candidateAgentUrl":"http://localhost:4001"}'
```

Both servers publish A2A-compliant `AgentCard`s at `/.well-known/agent.json`.

---

## Free-key LLM proxy

If you don't have an OpenAI / Anthropic key, point your agents at the hosted free-tier proxy:

```bash
OPENAI_BASE_URL=https://api.hap.dev/v1 OPENAI_API_KEY=anon npm run demo
```

The proxy rate-limits per anonymous client ID (header `X-HAP-Client-Id`). Source: [`apps/proxy/`](./apps/proxy/).

---

## License

MIT — see [`LICENSE`](./LICENSE). Built on [A2A](https://a2a-protocol.org).

---

## Contributing

We're 0.1. Anything before v1.0 may change. The point of publishing now is to get the schemas critiqued before they're hard to move.

- **Spec critiques**: open an issue tagged `rfc`, reference the section of `spec/hap-v0.md`.
- **Implementations**: PRs welcome on the four reference packages.
- **New verifiers / evidence types**: see `spec/hap-v0.md` §evidence-registry.
- **Discussion**: GitHub Discussions, tag `rfc-v0.2-proposal` if it's a protocol change.

Goal-state for v1.0 (≥ Q3 2027): ≥ 5 independent runtimes interoperating cleanly.

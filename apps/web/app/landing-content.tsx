import type { ReactNode } from "react";

export type Lang = "en" | "zh";

type Sym = "y" | "m" | "n";

export interface ContentTree {
  nav: {
    spec: string;
    quickstart: string;
    roadmap: string;
    faq: string;
    profileOf: string;
    toggleThemeAria: string;
    toggleLangAria: string;
  };
  hero: {
    eyebrowVer: string;
    headline: ReactNode;
    sub: ReactNode;
    ctaStar: string;
    ctaSpec: string;
    metaStable: ReactNode;
    metaImpls: ReactNode;
    metaA2A: ReactNode;
    metaBYO: ReactNode;
    anchors: Array<{ kbd: string; h: string; p: string; href: string }>;
  };
  why: {
    eyebrow: string;
    h2: ReactNode;
    lead: string;
    pillars: Array<{ num: string; h: ReactNode; p: ReactNode; sig: string }>;
  };
  quickstart: {
    eyebrow: string;
    h2: ReactNode;
    lead: ReactNode;
    barLabel: string;
    barNode: string;
    steps: Array<{ cmd: ReactNode; copyText: string; copyLabel: string }>;
    note1: ReactNode;
    note2: ReactNode;
  };
  a2a: {
    eyebrow: string;
    h2: ReactNode;
    lead: ReactNode;
    bullets: ReactNode[];
    stack: Array<{ h: ReactNode; tag?: string; p: string; cls?: "hap" | "a2a" }>;
  };
  spec: {
    eyebrow: string;
    h2: ReactNode;
    lead: ReactNode;
    links: Array<{ label: string; href: string }>;
  };
  comparison: {
    eyebrow: string;
    h2: ReactNode;
    lead: ReactNode;
    headers: { empty: string; hap: string; ats: ReactNode; web3: ReactNode };
    rows: Array<{
      cat: string;
      hap: [Sym, string];
      ats: [Sym, string];
      web3: [Sym, string];
    }>;
    loseRow: { cat: string; hap: string; ats: string; web3: string };
  };
  roadmap: {
    eyebrow: string;
    h2: ReactNode;
    lead: string;
    rows: Array<{
      ver: string;
      date: string;
      title: string;
      sub: string;
      line: string;
      pill: [string | null, string];
    }>;
  };
  faq: {
    eyebrow: string;
    h2: ReactNode;
    items: Array<{ q: ReactNode; a: ReactNode; open?: boolean }>;
  };
  finalCta: {
    h2: ReactNode;
    p: string;
    ctaStar: string;
    ctaClone: string;
    ctaSpec: string;
  };
  footer: {
    blurb: string;
    cols: Array<{ h: string; links: Array<{ label: string; href: string }> }>;
    bottomLeft: ReactNode;
    bottomRight: string;
  };
  langSwitchLabel: string;
}

const em = (s: string) => <em className="vA-em-serif">{s}</em>;
const code = (s: string) => <code>{s}</code>;
const a2aLink = (text: string) => (
  <a href="https://a2a-protocol.org" target="_blank" rel="noopener noreferrer">{text}</a>
);

export const EN: ContentTree = {
  nav: {
    spec: "spec",
    quickstart: "quickstart",
    roadmap: "roadmap",
    faq: "faq",
    profileOf: "profile of",
    toggleThemeAria: "Toggle theme",
    toggleLangAria: "Switch language",
  },
  hero: {
    eyebrowVer: "v0.1 · RFC draft · 2026",
    headline: (
      <>
        The hiring funnel runs on <em>protocol</em>,<br />
        not <span className="vA-strike">resumes</span>.
      </>
    ),
    sub: (
      <>
        An open {a2aLink("A2A")} profile for AI-mediated hiring. Two agents — one on
        the candidate's side, one on the recruiter's — interview each other with{" "}
        {em("cited, dereferenceable evidence")}. Federated. Self-hosted. No central server. MIT.
      </>
    ),
    ctaStar: "Star on GitHub",
    ctaSpec: "read the spec",
    metaStable: <>spec stable for v0.1</>,
    metaImpls: <>📦 <b>4 reference impls</b> · TS</>,
    metaA2A: <>↪ runs over <b>A2A</b>, not against it</>,
    metaBYO: <>🔐 <b>BYO LLM</b> · OpenAI · Anthropic · local</>,
    anchors: [
      { kbd: "§1 · WHY", h: "A protocol, not a SaaS", p: "What HAP fixes that ATS plugins can't.", href: "#why" },
      { kbd: "§2 · RUN", h: "60-second local demo", p: "Three commands. No keys. No login.", href: "#quickstart" },
      { kbd: "§3 · SPEC", h: "Message schemas + AgentCard", p: "Wire format, evidence types, disclosure rules.", href: "#spec" },
      { kbd: "§4 · WHY-NOT", h: "Trust, spam, identity, MCP", p: "Honest answers to the skeptical reader.", href: "#faq" },
    ],
  },
  why: {
    eyebrow: "§1 · Why HAP exists",
    h2: <>Both sides of the hiring conversation are about to be agents.<br />They need a wire format.</>,
    lead:
      "Resumes are static; AI generators have made the medium unverifiable. ATS giants (Greenhouse / Lever / Workday) own the pipe but won't compose. HAP fixes both — without asking either side to switch vendors.",
    pillars: [
      {
        num: "01 · FEDERATED",
        h: <>Like SMTP. Like ActivityPub.<br />Not like a blockchain.</>,
        p: <>No central server, no on-chain claims. Each side runs its own agent on its own infra. Discovery is optional and lives in a tracker layer, BitTorrent-style. Spam is a federation-policy problem — blocklists, rate limits, reputation — solved on top, not in the core.</>,
        sig: "// peer-to-peer · no broker · vendor-neutral",
      },
      {
        num: "02 · EVIDENCE OVER CLAIM",
        h: <>URLs to public traces,<br />not unverifiable assertions.</>,
        p: <>A candidate-agent answers with a GitHub commit SHA, a conference talk URL, a paper DOI. The HR-agent dereferences and verifies — author byline matches, maintainer list contains the candidate, talk venue is real. Self-claim without trace is allowed but flagged as low-confidence.</>,
        sig: "// every claim is a hyperlink · trust is per-URL, not per-name",
      },
      {
        num: "03 · PROGRESSIVE DISCLOSURE",
        h: <>No full resume. No full JD.<br />Just the relevant pieces.</>,
        p: <>The candidate-agent decides what to disclose, in response to each question. The HR-agent asks for what the JD requires. PII stays on the candidate's box until both sides have committed to the session. Refusing to answer is a first-class outcome, not a red flag.</>,
        sig: "// piece-wise · candidate consent on every byte",
      },
      {
        num: "04 · A2A PROFILE",
        h: <>We didn't start a new<br />protocol war.</>,
        p: (
          <>HAP messages are valid {a2aLink("Google A2A")} messages. We standardize <i className="vA-em-serif">content</i>, not transport. Any A2A-compliant runtime — OpenAI's, Anthropic's, Google's, yours — speaks HAP the moment it declares the skill.</>
        ),
        sig: "// transport: A2A · semantics: HAP · LLM: BYO",
      },
    ],
  },
  quickstart: {
    eyebrow: "§2 · 60-second quick start",
    h2: <>Two agents. One interview. <em className="vA-em-serif vA-em-cyan">Local.</em></>,
    lead: (
      <>
        Three commands. Spins up a candidate-agent and an HR-agent on{" "}
        <code style={{ color: "var(--text)" }}>localhost</code>, runs one HAP session,
        prints the transcript. No API keys required — falls back to a template HR-agent
        if no LLM is configured.
      </>
    ),
    barLabel: "~/code",
    barNode: "node ≥ 20",
    steps: [
      { cmd: <><span className="c-prompt">$</span>git clone https://github.com/luanrj-ai/hap && cd hap</>, copyText: "git clone https://github.com/luanrj-ai/hap && cd hap", copyLabel: "copy" },
      { cmd: <><span className="c-prompt">$</span>npm install && npm run build <span className="c-com"># ~ 20s</span></>, copyText: "npm install && npm run build", copyLabel: "copy" },
      { cmd: <><span className="c-prompt">$</span>npm run demo <span className="c-com"># runs candidate ⇄ hr interview, prints transcript</span></>, copyText: "npm run demo", copyLabel: "copy" },
    ],
    note1: (
      <>↪ want OpenAI / Anthropic enhancement? add{" "}
        <code style={{ color: "var(--cyan)" }}>OPENAI_API_KEY</code> to{" "}
        <code style={{ color: "var(--cyan)" }}>.env</code>
      </>
    ),
    note2: (
      <>↪ no key? a hosted free-tier proxy is online at{" "}
        <a href="#" style={{ color: "var(--cyan)" }}>hap.dev/proxy</a>
      </>
    ),
  },
  a2a: {
    eyebrow: "§3 · Where HAP sits",
    h2: <>It's an A2A profile.<br />Not a competing protocol.</>,
    lead: (
      <>
        HAP is to {a2aLink("Google's A2A")} what HTTP is to TCP. A2A handles the
        envelope: agent cards, message routing, auth. HAP standardizes the{" "}
        {em("payload")}: what a hiring conversation actually contains.
      </>
    ),
    bullets: [
      <>Agents publish an A2A {code("AgentCard")} at {code("/.well-known/agent.json")} declaring the {code("hap.v0")} skill.</>,
      <>Wire format is JSON-over-HTTPS. Auth is HTTPS + optional bearer. Nothing exotic.</>,
      <>Seven HAP message kinds. All carry {code("metadata.hap.version")} for forward-compat.</>,
      <>Evidence registry is an open extension point — community-extended, not vendor-owned.</>,
    ],
    stack: [
      { h: <>your agent runtime <span className="vA-stack__tag">any LLM · BYO</span></>, p: "OpenAI · Anthropic · local · or no LLM at all (template fallback)" },
      { h: <>hap.v0 · skill</>, p: "7 message kinds · evidence registry · disclosure model", cls: "hap" },
      { h: <>A2A · agent2agent</>, p: "envelope · agent card · routing · auth · open standard", cls: "a2a" },
      { h: <>HTTPS · TLS</>, p: "no central broker · no on-chain claims" },
    ],
  },
  spec: {
    eyebrow: "§3 · Spec excerpt · v0.1",
    h2: <>Two artifacts. <em className="vA-em-serif vA-em-cyan">Read them in five minutes.</em></>,
    lead: (
      <>
        Every HAP agent publishes an {code("AgentCard")} declaring the skill. Every
        interview is a sequence of HAP messages over A2A. Below are the canonical
        shapes — the full RFC has prose, registries, and versioning rules.
      </>
    ),
    links: [
      { label: "→ read the full v0.1 RFC", href: "/spec" },
      { label: "→ evidence registry", href: "#" },
      { label: "→ TypeScript schemas (Zod)", href: "#" },
    ],
  },
  comparison: {
    eyebrow: "§4 · How HAP differs · honestly",
    h2: <>A protocol, a product, and a pitch deck<br />walk into a hiring conversation.</>,
    lead: <>We get asked "isn't this just another {em("X")}?" a lot. Short answer: no. Long answer below. Where we lose, we say so.</>,
    headers: {
      empty: "",
      hap: "HAP",
      ats: <>ATS plugin <span style={{ color: "var(--dim)" }}>(Greenhouse · Lever)</span></>,
      web3: <>Web3 hiring chain <span style={{ color: "var(--dim)" }}>(VC)</span></>,
    },
    rows: [
      { cat: "trust root", hap: ["y", "HTTPS + per-URL evidence"], ats: ["m", "ATS vendor's database"], web3: ["n", "on-chain DID claims"] },
      { cat: "interop", hap: ["y", "federated · any A2A runtime"], ats: ["n", "walled garden per vendor"], web3: ["m", "chain-locked, bridge-broken"] },
      { cat: "candidate consent", hap: ["y", "progressive · piece-wise"], ats: ["n", "full resume + cover letter upfront"], web3: ["m", "credentials minted ahead of time"] },
      { cat: "verifiability", hap: ["y", "dereference any URL · author byline · commit author"], ats: ["m", "resume text + LinkedIn cross-check"], web3: ["m", "cryptographic but issuer-trusted"] },
      { cat: "ships today", hap: ["y", "v0.1 RFC · MIT · TypeScript impls"], ats: ["y", "yes (and they own the pipe)"], web3: ["n", "3–5 yrs out, by ecosystem estimate"] },
    ],
    loseRow: {
      cat: "where we lose",
      hap: "spec is v0.x · adoption is zero today",
      ats: "we don't track applications. (we're not an ATS.)",
      web3: "no on-chain attestation primitive (yet)",
    },
  },
  roadmap: {
    eyebrow: "§5 · Roadmap · published, dated, honest",
    h2: <>v0.x = breaking changes allowed. <em className="vA-em-serif vA-em-cyan">v1.0 = stable.</em></>,
    lead: "We're 0.1. Anything before v1 may change. The point of publishing now is to get the schemas critiqued before they're hard to move.",
    rows: [
      { ver: "v0.1", date: "May 2026", title: "RFC draft", sub: "candidate-runtime · hr-runtime · a2a-adapter · scoring", line: "· 7 message kinds · evidence registry · TS reference impls", pill: ["cyan", "shipped"] },
      { ver: "v0.2", date: "Q3 2026", title: "Tracker", sub: "DNS-style, BitTorrent-tracker model; not required for known-URL contact", line: "— optional discovery directory", pill: ["yellow", "drafting"] },
      { ver: "v0.3", date: "Q4 2026", title: "Verifier framework", sub: "github-author-match, talk-venue-check, oss-maintainer-list, …", line: "· pluggable per evidence-type · community contrib", pill: [null, "planned"] },
      { ver: "v0.4", date: "Q1 2027", title: "Disclosure scopes", sub: '"public-by-default", "after-accept-only", "PII never"', line: "— formal grammar for candidate-agent consent", pill: [null, "planned"] },
      { ver: "v1.0", date: "≥ Q3 2027", title: "Schema freeze", sub: "predicated on ≥ 5 independent runtimes interoperating cleanly", line: "— backward-compatible additions only", pill: [null, "target"] },
    ],
  },
  faq: {
    eyebrow: "§6 · FAQ · for the skeptical reader",
    h2: <>"Isn't this just <em className="vA-em-serif">X</em>?"</>,
    items: [
      { q: <>Why not just MCP?</>, a: <>MCP is agent ↔ tool. HAP is agent ↔ agent. Two AI agents talking to each other about a job is a peer conversation, not a tool call. A2A is the right layer; HAP is the right profile on that layer.</>, open: true },
      { q: <>Why not blockchain / Verifiable Credentials?</>, a: <>We considered W3C VC and rejected it as premature. Adoption is 3–5 years out and depends on an issuer ecosystem that doesn't exist for hiring. We don't want to be a dead-on-arrival spec waiting for an ecosystem. When VC matures, HAP evidence can wrap a VC like any other URL — the registry is open.</> },
      { q: <>What stops spam?</>, a: <>The same things that work for email and ActivityPub: TLS-served agent cards, rate limits in the AgentCard, blocklists, reputation services. Spam is a federation-policy problem solved on top of the protocol — not inside the core. The reference HR-runtime ships with per-IP throttling and an allowlist hook.</> },
      { q: <>Will candidates actually trust their agent with real data?</>, a: <>That's the candidate's choice. Reference impls are self-host by default. The hosted convenience tier on {code("hap.dev")} uses a "do not log" policy and publishes its system prompt. Your data never leaves the candidate-agent unless the candidate-agent <i className="vA-em-serif">chooses</i> to disclose it.</> },
      { q: <>How does this not become Yet Another LinkedIn?</>, a: <>LinkedIn is a database with auth-walled identity and a marketplace attached. HAP is a wire format with no database, no marketplace, and no identity broker. We can't centralize even if we wanted to — the spec doesn't have a place to put a central server.</> },
      { q: <>What about identity verification — is the candidate "real"?</>, a: <>Out of scope. KYC providers do that. HAP doesn't validate that a candidate-agent's claimed human exists — it gives the HR-agent enough public evidence (commits, talks, papers) to {em("decide")} how much identity proof to ask for, before involving a human.</> },
      { q: <>Is this an ATS replacement?</>, a: <>No. HAP is the {em("interview channel")}, not the application tracking system. An ATS can plug in as the HR-agent runner; the ATS keeps its database and HAP carries the conversation.</> },
      { q: <>Who built this, and why solo?</>, a: <>One person. v0.1 is a draft published to get punched at. PRs and issues on the GitHub repo are the entire roadmap process — there's no closed company, no investor list, no team page. If it turns out the schemas are wrong, we want to know <i className="vA-em-serif">before</i> v1.0 locks them in.</> },
    ],
  },
  finalCta: {
    h2: <>Three ways in. <em>Pick one.</em></>,
    p: "It's MIT. It's v0.1. The fastest way to find out if it's any good is to run it.",
    ctaStar: "★ Star on GitHub",
    ctaClone: "clone & npm run demo",
    ctaSpec: "→ read the spec",
  },
  footer: {
    blurb: "Hiring Agent Protocol — an open A2A profile for AI-mediated hiring. MIT-licensed. Federated. No central server.",
    cols: [
      { h: "Spec", links: [
        { label: "v0.1 RFC", href: "/spec" },
        { label: "Message kinds", href: "/spec" },
        { label: "Evidence registry", href: "/spec" },
        { label: "AgentCard", href: "/spec" },
      ]},
      { h: "Code", links: [
        { label: "GitHub repo", href: "https://github.com/luanrj-ai/hap" },
        { label: "candidate-runtime", href: "https://github.com/luanrj-ai/hap/tree/main/packages/candidate-runtime" },
        { label: "hr-runtime", href: "https://github.com/luanrj-ai/hap/tree/main/packages/hr-runtime" },
        { label: "hosted proxy", href: "https://github.com/luanrj-ai/hap/tree/main/apps/proxy" },
      ]},
      { h: "Community", links: [
        { label: "RFC discussion", href: "https://github.com/luanrj-ai/hap/discussions" },
        { label: "Issues & PRs", href: "https://github.com/luanrj-ai/hap/issues" },
        { label: "HR dashboard (ref)", href: "/dashboard" },
        { label: "Editorial reading", href: "/variants/spec.html" },
      ]},
    ],
    bottomLeft: <>MIT · v0.1 draft · built on {a2aLink("A2A")}</>,
    bottomRight: "this page renders no analytics",
  },
  langSwitchLabel: "中",
};

export const ZH: ContentTree = {
  nav: {
    spec: "协议",
    quickstart: "快速开始",
    roadmap: "路线图",
    faq: "常见问题",
    profileOf: "基于",
    toggleThemeAria: "切换主题",
    toggleLangAria: "切换语言",
  },
  hero: {
    eyebrowVer: "v0.1 · RFC 草案 · 2026",
    headline: (
      <>
        招聘流程跑在 <em>协议</em> 上，<br />
        不是 <span className="vA-strike">简历</span> 上。
      </>
    ),
    sub: (
      <>
        一个开放的 {a2aLink("A2A")} 协议子集，用于 AI 中介的招聘。两个 agent —— 一个代表候选人，一个代表招聘方 ——
        基于 {em("可引用、可验证的证据")} 互相面试。联邦化、自托管、无中心服务器、MIT 许可。
      </>
    ),
    ctaStar: "在 GitHub 上 Star",
    ctaSpec: "阅读协议",
    metaStable: <>v0.1 协议已稳定</>,
    metaImpls: <>📦 <b>4 个参考实现</b> · TS</>,
    metaA2A: <>↪ 运行于 <b>A2A</b> 之上，而非与其竞争</>,
    metaBYO: <>🔐 <b>BYO LLM</b> · OpenAI · Anthropic · 本地</>,
    anchors: [
      { kbd: "§1 · 为什么", h: "协议，不是 SaaS", p: "HAP 解决的是 ATS 插件解决不了的问题。", href: "#why" },
      { kbd: "§2 · 运行", h: "60 秒本地 demo", p: "三行命令。无需密钥，无需注册。", href: "#quickstart" },
      { kbd: "§3 · 规范", h: "消息 schema + AgentCard", p: "传输格式、证据类型、披露规则。", href: "#spec" },
      { kbd: "§4 · 反驳", h: "信任、垃圾、身份、MCP", p: "对怀疑读者的诚实回答。", href: "#faq" },
    ],
  },
  why: {
    eyebrow: "§1 · 为什么需要 HAP",
    h2: <>招聘对话的两端都将是 agent。<br />它们需要一种传输格式。</>,
    lead:
      "简历是静态的；AI 生成器让这种媒介无法被验证。ATS 巨头（Greenhouse / Lever / Workday）掌控管道却不互通。HAP 修复这两个问题 —— 而不要求任何一方更换供应商。",
    pillars: [
      {
        num: "01 · 联邦化",
        h: <>像 SMTP，像 ActivityPub。<br />不像区块链。</>,
        p: <>无中心服务器，无链上声明。每一方在自己的基础设施上运行自己的 agent。发现机制是可选的，存在于追踪层（类似 BitTorrent）。垃圾过滤是联邦策略问题 —— 黑名单、限流、声誉 —— 在协议之上解决，而非协议本身。</>,
        sig: "// P2P · 无中介 · 厂商中立",
      },
      {
        num: "02 · 证据优于声明",
        h: <>指向公开痕迹的 URL，<br />而非无法验证的断言。</>,
        p: <>候选 agent 用 GitHub commit SHA、技术大会演讲 URL、论文 DOI 作答。HR agent 解引用并验证 —— 作者署名匹配、维护者列表包含候选人、会场真实存在。无痕迹的自述被允许但标记为低置信。</>,
        sig: "// 每个声明都是超链接 · 信任基于 URL 而非姓名",
      },
      {
        num: "03 · 渐进式披露",
        h: <>不要完整简历，不要完整 JD，<br />只要相关片段。</>,
        p: <>候选 agent 决定针对每个问题披露什么。HR agent 只问 JD 真正需要的。PII 留在候选人的机器上，直到双方都决定继续。拒答是协议的一等输出，不是红旗。</>,
        sig: "// 按片段披露 · 每个字节都需候选人同意",
      },
      {
        num: "04 · A2A 子集",
        h: <>我们没有发动<br />新一轮协议战争。</>,
        p: (
          <>HAP 消息是合法的 {a2aLink("Google A2A")} 消息。我们标准化的是 <i className="vA-em-serif">内容</i>，不是传输。任何兼容 A2A 的运行时 —— OpenAI、Anthropic、Google 或你自己的 —— 只要声明这个 skill 就立刻支持 HAP。</>
        ),
        sig: "// 传输：A2A · 语义：HAP · LLM：自带",
      },
    ],
  },
  quickstart: {
    eyebrow: "§2 · 60 秒快速开始",
    h2: <>两个 agent。一场面试。<em className="vA-em-serif vA-em-cyan">本地。</em></>,
    lead: (
      <>
        三条命令。在 <code style={{ color: "var(--text)" }}>localhost</code>{" "}
        上启动一个候选 agent 和一个 HR agent，跑一次 HAP 会话，打印 transcript。
        不需要 API 密钥 —— 没配 LLM 时会回落到模板模式。
      </>
    ),
    barLabel: "~/code",
    barNode: "node ≥ 20",
    steps: [
      { cmd: <><span className="c-prompt">$</span>git clone https://github.com/luanrj-ai/hap && cd hap</>, copyText: "git clone https://github.com/luanrj-ai/hap && cd hap", copyLabel: "复制" },
      { cmd: <><span className="c-prompt">$</span>npm install && npm run build <span className="c-com"># 约 20 秒</span></>, copyText: "npm install && npm run build", copyLabel: "复制" },
      { cmd: <><span className="c-prompt">$</span>npm run demo <span className="c-com"># 跑候选 ⇄ HR 面试，打印 transcript</span></>, copyText: "npm run demo", copyLabel: "复制" },
    ],
    note1: (
      <>↪ 想要 OpenAI / Anthropic 增强？在{" "}
        <code style={{ color: "var(--cyan)" }}>.env</code> 加上{" "}
        <code style={{ color: "var(--cyan)" }}>OPENAI_API_KEY</code>
      </>
    ),
    note2: (
      <>↪ 没密钥？托管的免费代理在线 ——{" "}
        <a href="#" style={{ color: "var(--cyan)" }}>hap.dev/proxy</a>
      </>
    ),
  },
  a2a: {
    eyebrow: "§3 · HAP 位于何处",
    h2: <>它是 A2A 的子集，<br />而不是与 A2A 竞争。</>,
    lead: (
      <>
        HAP 之于 {a2aLink("Google 的 A2A")} 就像 HTTP 之于 TCP。A2A 负责信封：agent card、消息路由、认证。HAP 标准化的是 {em("负载")}：一场招聘对话究竟应该包含什么。
      </>
    ),
    bullets: [
      <>Agent 在 {code("/.well-known/agent.json")} 发布 A2A {code("AgentCard")}，声明 {code("hap.v0")} skill。</>,
      <>传输格式是 JSON-over-HTTPS。认证是 HTTPS + 可选 bearer。没有玄学。</>,
      <>7 种 HAP 消息类型。全部携带 {code("metadata.hap.version")} 用于前向兼容。</>,
      <>证据注册表是开放的扩展点 —— 社区扩展，不被任何厂商占有。</>,
    ],
    stack: [
      { h: <>你的 agent 运行时 <span className="vA-stack__tag">任意 LLM · BYO</span></>, p: "OpenAI · Anthropic · 本地 · 或完全不用 LLM（模板回落）" },
      { h: <>hap.v0 · skill</>, p: "7 种消息 · 证据注册表 · 披露模型", cls: "hap" },
      { h: <>A2A · agent2agent</>, p: "信封 · agent card · 路由 · 认证 · 开放标准", cls: "a2a" },
      { h: <>HTTPS · TLS</>, p: "无中心 broker · 无链上声明" },
    ],
  },
  spec: {
    eyebrow: "§3 · 协议节选 · v0.1",
    h2: <>两个 artifact。<em className="vA-em-serif vA-em-cyan">五分钟读完。</em></>,
    lead: (
      <>
        每个 HAP agent 发布一份 {code("AgentCard")} 声明其 skill。每场面试是 A2A 上的一串 HAP 消息序列。下方是标准形态 —— 完整 RFC 包含散文、注册表与版本规则。
      </>
    ),
    links: [
      { label: "→ 阅读完整 v0.1 RFC", href: "/spec" },
      { label: "→ 证据注册表", href: "#" },
      { label: "→ TypeScript schema (Zod)", href: "#" },
    ],
  },
  comparison: {
    eyebrow: "§4 · HAP 与其他方案的诚实对比",
    h2: <>一个协议、一个产品、一个 pitch deck，<br />走进一场招聘对话。</>,
    lead: <>我们常被问"这不就是另一个 {em("X")} 吗？"短答：不是。长答见下。在我们劣势的地方，我们承认。</>,
    headers: {
      empty: "",
      hap: "HAP",
      ats: <>ATS 插件 <span style={{ color: "var(--dim)" }}>(Greenhouse · Lever)</span></>,
      web3: <>Web3 招聘链 <span style={{ color: "var(--dim)" }}>(VC)</span></>,
    },
    rows: [
      { cat: "信任根", hap: ["y", "HTTPS + 单 URL 证据"], ats: ["m", "ATS 厂商的数据库"], web3: ["n", "链上 DID 声明"] },
      { cat: "互操作", hap: ["y", "联邦化 · 任何 A2A 运行时"], ats: ["n", "每个厂商一个围墙花园"], web3: ["m", "锁定在链上、桥总是坏"] },
      { cat: "候选人同意", hap: ["y", "渐进式 · 按片段"], ats: ["n", "上来就要完整简历+求职信"], web3: ["m", "凭证提前铸造"] },
      { cat: "可验证性", hap: ["y", "解引用任意 URL · 作者署名 · commit 作者"], ats: ["m", "简历文本 + LinkedIn 交叉对照"], web3: ["m", "密码学上可验，但仍依赖签发方"] },
      { cat: "今天能用吗", hap: ["y", "v0.1 RFC · MIT · TypeScript 实现"], ats: ["y", "能用（管道是他们的）"], web3: ["n", "按生态估计还要 3–5 年"] },
    ],
    loseRow: {
      cat: "我们劣势在哪",
      hap: "协议是 v0.x · 当下采用率为零",
      ats: "我们不跟踪应聘（我们不是 ATS）",
      web3: "目前没有链上凭证原语",
    },
  },
  roadmap: {
    eyebrow: "§5 · 路线图 · 已公开、有日期、不打马虎眼",
    h2: <>v0.x = 允许破坏性变更。<em className="vA-em-serif vA-em-cyan">v1.0 = 稳定。</em></>,
    lead: "我们在 v0.1。v1 之前的任何东西都可能改。现在公开发布的意义就是趁 schema 还没固化时收到批评。",
    rows: [
      { ver: "v0.1", date: "2026 年 5 月", title: "RFC 草案", sub: "candidate-runtime · hr-runtime · a2a-adapter · scoring", line: "· 7 种消息 · 证据注册表 · TS 参考实现", pill: ["cyan", "已发布"] },
      { ver: "v0.2", date: "2026 Q3", title: "Tracker", sub: "DNS 风格、BitTorrent tracker 模型；已知 URL 情况下非必需", line: "—— 可选的发现目录", pill: ["yellow", "起草中"] },
      { ver: "v0.3", date: "2026 Q4", title: "验证器框架", sub: "github-author-match、talk-venue-check、oss-maintainer-list 等", line: "· 按证据类型可插拔 · 社区贡献", pill: [null, "计划中"] },
      { ver: "v0.4", date: "2027 Q1", title: "披露范围语法", sub: '"public-by-default"、"after-accept-only"、"PII never"', line: "—— 候选 agent 同意的形式语法", pill: [null, "计划中"] },
      { ver: "v1.0", date: "≥ 2027 Q3", title: "Schema 冻结", sub: "前提：≥ 5 个独立运行时能干净互操作", line: "—— 只允许向后兼容的新增", pill: [null, "目标"] },
    ],
  },
  faq: {
    eyebrow: "§6 · 常见问题 · 写给怀疑的读者",
    h2: <>"这不就是另一个 <em className="vA-em-serif">X</em> 吗？"</>,
    items: [
      { q: <>为什么不直接用 MCP？</>, a: <>MCP 是 agent ↔ tool。HAP 是 agent ↔ agent。两个 AI agent 关于一份工作的对话是同辈对话，不是工具调用。A2A 是正确的传输层；HAP 是这一层上正确的子集。</>, open: true },
      { q: <>为什么不用区块链 / Verifiable Credentials？</>, a: <>我们考虑过 W3C VC 并把它否了 —— 太早。其采用还要 3–5 年，而且依赖一个目前在招聘领域并不存在的发行方生态。我们不想做一个躺在 GitHub 上等生态成熟的死协议。等 VC 成熟时，HAP 的 evidence 可以像包装任意 URL 那样包装一个 VC —— 注册表是开放的。</> },
      { q: <>怎么防垃圾消息？</>, a: <>邮件和 ActivityPub 怎么防，我们就怎么防：TLS 服务的 agent card、AgentCard 里的限流、黑名单、声誉服务。垃圾过滤是联邦策略问题，在协议之上解决 —— 不属于协议本身。参考 HR-runtime 自带 per-IP 限流和允许列表 hook。</> },
      { q: <>候选人真的愿意把真实数据交给自己的 agent 吗？</>, a: <>那是候选人自己的选择。参考实现默认是自托管的。{code("hap.dev")} 上的便捷托管层使用"不记录"政策，并公开 system prompt。除非候选 agent <i className="vA-em-serif">选择</i>披露，否则你的数据不离开候选 agent。</> },
      { q: <>这怎么不变成另一个 LinkedIn？</>, a: <>LinkedIn 是一个带认证墙身份和市场的数据库。HAP 是一种传输格式，没有数据库，没有市场，没有身份 broker。我们想中心化都做不到 —— 协议里就没有放中心服务器的位置。</> },
      { q: <>身份验证怎么办 —— 候选人是不是"真人"？</>, a: <>不在范围内。KYC 提供商解决这事。HAP 不验证候选 agent 声称的人类是否存在 —— 它给 HR agent 提供足够的公开证据（commits、talks、papers），由 HR agent {em("决定")}在介入真人之前要求多少身份证明。</> },
      { q: <>它是 ATS 替代品吗？</>, a: <>不是。HAP 是 {em("面试通道")}，不是申请追踪系统。ATS 可以接入 HAP 作为 HR agent runner；ATS 保留自己的数据库，HAP 负责承载对话。</> },
      { q: <>谁做的？为什么单干？</>, a: <>一个人。v0.1 是为了被打脸而公开的草案。PR 和 issue 是整个路线图过程 —— 没有闭源公司、没有投资人列表、没有团队页面。如果 schema 是错的，我们想在 v1.0 锁定它们 <i className="vA-em-serif">之前</i> 知道。</> },
    ],
  },
  finalCta: {
    h2: <>三种切入方式。<em>挑一种。</em></>,
    p: "它是 MIT。它是 v0.1。判断它好不好用最快的办法就是把它跑一遍。",
    ctaStar: "★ 在 GitHub 上 Star",
    ctaClone: "clone & npm run demo",
    ctaSpec: "→ 阅读协议",
  },
  footer: {
    blurb: "Hiring Agent Protocol —— 一个用于 AI 中介招聘的开放 A2A 子集。MIT 许可。联邦化。无中心服务器。",
    cols: [
      { h: "协议", links: [
        { label: "v0.1 RFC", href: "/spec" },
        { label: "消息类型", href: "/spec" },
        { label: "证据注册表", href: "/spec" },
        { label: "AgentCard", href: "/spec" },
      ]},
      { h: "代码", links: [
        { label: "GitHub 仓库", href: "https://github.com/luanrj-ai/hap" },
        { label: "candidate-runtime", href: "https://github.com/luanrj-ai/hap/tree/main/packages/candidate-runtime" },
        { label: "hr-runtime", href: "https://github.com/luanrj-ai/hap/tree/main/packages/hr-runtime" },
        { label: "托管代理", href: "https://github.com/luanrj-ai/hap/tree/main/apps/proxy" },
      ]},
      { h: "社区", links: [
        { label: "RFC 讨论", href: "https://github.com/luanrj-ai/hap/discussions" },
        { label: "Issues 与 PR", href: "https://github.com/luanrj-ai/hap/issues" },
        { label: "HR dashboard 参考", href: "/dashboard" },
        { label: "Editorial 风格", href: "/variants/spec.html" },
      ]},
    ],
    bottomLeft: <>MIT · v0.1 草案 · 基于 {a2aLink("A2A")}</>,
    bottomRight: "本页面不加载任何 analytics",
  },
  langSwitchLabel: "EN",
};

export function getContent(lang: Lang): ContentTree {
  return lang === "zh" ? ZH : EN;
}

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
    eyebrowVer: "v0.2 · RFC draft · 2026",
    headline: (
      <>
        Apply with your <em>agent</em>,<br />
        not a <span className="vA-strike">résumé</span>.
      </>
    ),
    sub: (
      <>
        Your candidate-agent reads a role, answers each requirement with{" "}
        {em("cited, dereferenceable evidence")}, and submits one packet — no server to
        host, no public job-hunt. A neutral scorer {em("opens every link")} and scores
        what's real, not what your agent wrote. An open {a2aLink("A2A")} profile.
        Federated. MIT.
      </>
    ),
    ctaStar: "Star on GitHub",
    ctaSpec: "read the spec",
    metaStable: <>candidate-initiated · async</>,
    metaImpls: <>📦 <b>scored on verified evidence</b>, not prose</>,
    metaA2A: <>↪ runs over <b>A2A</b>, not against it</>,
    metaBYO: <>🔐 <b>BYO LLM</b> · OpenAI · Anthropic · local</>,
    anchors: [
      { kbd: "§1 · WHY", h: "Apply, don't get screened", p: "Why the agent is on the candidate's side.", href: "#why" },
      { kbd: "§2 · RUN", h: "60-second local demo", p: "One command. Your agent applies; the inbox scores it.", href: "#quickstart" },
      { kbd: "§3 · SPEC", h: "posting · application · score", p: "The async message shapes + the verified report.", href: "#spec" },
      { kbd: "§4 · WHY-NOT", h: "Lies, identity, spam, MCP", p: "Honest answers to the skeptical reader.", href: "#faq" },
    ],
  },
  why: {
    eyebrow: "§1 · Why HAP exists",
    h2: <>The agent that represents you should work for <em>you</em><br />— and still be checkable by them.</>,
    lead:
      "Resumes are self-reported, and AI has made the medium unfalsifiable. So don't trust the writing — trust the links. HAP puts the agent on the candidate's side, then scores only the evidence a neutral verifier can dereference.",
    pillars: [
      {
        num: "01 · CANDIDATE-INITIATED",
        h: <>One command.<br />Nothing to write or host.</>,
        p: <>Your profile is auto-built from your <i className="vA-em-serif">public</i> GitHub — nothing to fill in, no server to run, your local machine never touched. The agent answers each requirement with evidence and sends one outbound packet to the one employer you chose. No public profile broadcasting that you're looking.</>,
        sig: "// public github → packet · ephemeral · no local scan",
      },
      {
        num: "02 · SCORED ON VERIFIED EVIDENCE",
        h: <>We open every link.<br />Prose scores nothing.</>,
        p: <>The neutral scorer dereferences each citation — commit author matches you, the repo is real, the talk venue exists — and scores that. Your agent's wording and its self-reported confidence count for <i className="vA-em-serif">zero</i>. Citing something fake is a hard gate, not a deduction. "I have no evidence" is a first-class, unpenalised answer.</>,
        sig: "// score the artifact, not the sentence",
      },
      {
        num: "03 · IDENTITY YOU CAN PROVE",
        h: <>Anchor it. Prove it.<br />Don't just claim it.</>,
        p: <>Publish a {code("HAP-PROOF")} gist under your GitHub account and the scorer lifts your identity from <i className="vA-em-serif">asserted</i> to <i className="vA-em-serif">proven</i> — you can't pass off someone else's account as yours. We're honest about the residual gap: wholesale impersonation still needs an interactive challenge, which is on the roadmap.</>,
        sig: "// asserted → proven · 防君子，渐防小人",
      },
      {
        num: "04 · STILL AN A2A PROFILE",
        h: <>Federated. Async.<br />Either side can start.</>,
        p: (
          <>HAP messages are valid {a2aLink("Google A2A")} messages, store-and-forward like email — neither side has to be online at once. The candidate initiates today; an employer-agent can initiate sourcing too. No central server, no broker, MIT. We standardize the <i className="vA-em-serif">content</i>, not the transport.</>
        ),
        sig: "// transport: A2A · async · candidate-initiated first",
      },
    ],
  },
  quickstart: {
    eyebrow: "§2 · 60-second quick start",
    h2: <>Apply to a role. <em className="vA-em-serif vA-em-cyan">Locally.</em></>,
    lead: (
      <>
        One command spins up an employer inbox, publishes a role, and runs your
        candidate-agent: it answers the rubric with evidence, submits, and the inbox{" "}
        {em("auto-scores")} it on dereferenced links. No API keys required — falls back
        to template answers if no LLM is configured.
      </>
    ),
    barLabel: "~/code",
    barNode: "node ≥ 20",
    steps: [
      { cmd: <><span className="c-prompt">$</span>git clone https://github.com/luanrj-ai/hap && cd hap</>, copyText: "git clone https://github.com/luanrj-ai/hap && cd hap", copyLabel: "copy" },
      { cmd: <><span className="c-prompt">$</span>npm install && npm run build <span className="c-com"># ~ 20s</span></>, copyText: "npm install && npm run build", copyLabel: "copy" },
      { cmd: <><span className="c-prompt">$</span>npm run demo:apply <span className="c-com"># builds a packet from public GitHub → inbox verifies &amp; scores</span></>, copyText: "npm run demo:apply", copyLabel: "copy" },
    ],
    note1: (
      <>↪ apply as yourself:{" "}
        <code style={{ color: "var(--cyan)" }}>GH_HANDLE=&lt;your-github&gt; npm run demo:apply</code>
      </>
    ),
    note2: (
      <>↪ real flow: <code style={{ color: "var(--cyan)" }}>npm run serve:inbox</code> +{" "}
        <code style={{ color: "var(--cyan)" }}>npm run apply</code>
        <span style={{ color: "var(--dim)" }}> · set GITHUB_TOKEN to verify links (unauth = 60/h)</span>
      </>
    ),
  },
  a2a: {
    eyebrow: "§3 · Where HAP sits",
    h2: <>An A2A profile.<br />Now async, candidate-first.</>,
    lead: (
      <>
        HAP is to {a2aLink("Google's A2A")} what HTTP is to TCP. A2A handles the
        envelope: agent cards, routing, auth. HAP standardizes the {em("payload")} —
        and v0.2 makes it store-and-forward, so neither side has to be online at once.
      </>
    ),
    bullets: [
      <>Employers publish a {code("hap.posting")} — a JD plus a rubric — as static data. No agent required to post.</>,
      <>The candidate-agent submits one {code("hap.application")}: an evidenced answer per rubric item, outbound to a dumb inbox.</>,
      <>A neutral scorer dereferences the cited links and returns a verified report — fabrication gated, identity flagged.</>,
      <>Optional {code("proof_of_control")} ties the identity anchor to a GitHub account the candidate provably owns.</>,
    ],
    stack: [
      { h: <>your candidate-agent <span className="vA-stack__tag">any LLM · BYO</span></>, p: "reads a posting, answers with evidence, submits outbound — runs once and exits" },
      { h: <>hap.v0.2 · skill</>, p: "posting · application · receipt · verified score · proof-of-control", cls: "hap" },
      { h: <>A2A · agent2agent</>, p: "envelope · agent card · routing · auth · open standard", cls: "a2a" },
      { h: <>HTTPS · store-and-forward</>, p: "no central broker · no always-on candidate server" },
    ],
  },
  spec: {
    eyebrow: "§3 · Spec excerpt · v0.2",
    h2: <>Four shapes. <em className="vA-em-serif vA-em-cyan">Read them in five minutes.</em></>,
    lead: (
      <>
        An employer publishes a {code("hap.posting")}; the candidate-agent returns one{" "}
        {code("hap.application")}; the inbox replies with a {code("hap.receipt")} and a
        neutral, dereferenced {code("score")}. Below are the canonical shapes — the full
        RFC has the prose, registries, and versioning rules.
      </>
    ),
    links: [
      { label: "→ read the full RFC", href: "/spec" },
      { label: "→ evidence + verifier registry", href: "#" },
      { label: "→ TypeScript schemas (Zod)", href: "#" },
    ],
  },
  comparison: {
    eyebrow: "§4 · How HAP differs · honestly",
    h2: <>A protocol, a job board, and a screening bot<br />walk into a hiring conversation.</>,
    lead: <>We get asked "isn't this just another {em("X")}?" a lot. Short answer: no. Long answer below. Where we lose, we say so.</>,
    headers: {
      empty: "",
      hap: "HAP",
      ats: <>ATS / job board <span style={{ color: "var(--dim)" }}>(Greenhouse · Lever)</span></>,
      web3: <>AI résumé screener <span style={{ color: "var(--dim)" }}>(self-reported)</span></>,
    },
    rows: [
      { cat: "trust root", hap: ["y", "dereferenced evidence + proof-of-control"], ats: ["m", "ATS vendor's database"], web3: ["n", "the résumé's own words"] },
      { cat: "what gets scored", hap: ["y", "verified artifacts — not the agent's prose"], ats: ["m", "keyword match on resume text"], web3: ["n", "an LLM reading self-reported claims"] },
      { cat: "candidate consent", hap: ["y", "apply to one employer · no public profile"], ats: ["n", "full resume + profile upfront"], web3: ["m", "whatever you upload, then ranked"] },
      { cat: "faking it", hap: ["y", "fabricated link = hard gate to no_fit"], ats: ["m", "manual reference checks, much later"], web3: ["n", "confident prose scores well"] },
      { cat: "ships today", hap: ["y", "v0.2 · MIT · TS impls + runnable demo"], ats: ["y", "yes (and they own the pipe)"], web3: ["y", "yes (and it trusts the text)"] },
    ],
    loseRow: {
      cat: "where we lose",
      hap: "spec is v0.x · adoption is zero today",
      ats: "we don't track applications (we're not an ATS)",
      web3: "no model tuned on your exact funnel (yet)",
    },
  },
  roadmap: {
    eyebrow: "§5 · Roadmap · published, dated, honest",
    h2: <>v0.x = breaking changes allowed. <em className="vA-em-serif vA-em-cyan">v1.0 = stable.</em></>,
    lead: "We're 0.x. Anything before v1 may change. The point of publishing now is to get the schemas critiqued before they're hard to move.",
    rows: [
      { ver: "v0.1", date: "May 2026", title: "HR-driven interview", sub: "candidate-runtime · hr-runtime · a2a-adapter · scoring", line: "· synchronous · now the optional L1 layer", pill: ["cyan", "shipped"] },
      { ver: "v0.2", date: "May 2026", title: "Candidate-initiated + verified score", sub: "async posting / application / receipt · neutral scorer · proof-of-control gist", line: "· score on dereferenced evidence, not prose", pill: ["cyan", "shipped"] },
      { ver: "v0.3", date: "Q3 2026", title: "Interactive identity challenge", sub: "server-issued nonce / signature — close the wholesale-impersonation gap", line: "· + more evidence verifiers", pill: ["yellow", "drafting"] },
      { ver: "v0.4", date: "Q4 2026", title: "Employer-initiated sourcing", sub: "the HR-initiated flow + candidate ProfileCard discovery", line: "— 双向, fully symmetric", pill: [null, "planned"] },
      { ver: "v1.0", date: "≥ Q3 2027", title: "Schema freeze", sub: "predicated on ≥ 5 independent runtimes interoperating cleanly", line: "— backward-compatible additions only", pill: [null, "target"] },
    ],
  },
  faq: {
    eyebrow: "§6 · FAQ · for the skeptical reader",
    h2: <>"Isn't this just <em className="vA-em-serif">X</em>?"</>,
    items: [
      { q: <>Can't a candidate's agent just lie?</>, a: <>It can write anything — and the writing scores nothing. The neutral scorer ignores the prose and the self-reported confidence; it dereferences each cited link and scores only what checks out. Citing something fake isn't a small deduction, it's a hard gate to {code("no_fit")}. Honestly declining ("no evidence") costs you nothing.</>, open: true },
      { q: <>How do you know the GitHub account is really theirs?</>, a: <>Two levels. By default the anchor is {em("asserted")}. Add a {code("proof_of_control")} gist — a {code("HAP-PROOF")} marker in a gist under that account — and it becomes {em("proven")}: a faker can't publish under an account they don't control. The residual gap (wholesale impersonation of a public account) needs an interactive challenge, which is on the roadmap. We don't pretend it's solved.</> },
      { q: <>Why not just MCP?</>, a: <>MCP is agent ↔ tool. A candidate-agent POSTing to an employer inbox is close to that — but HAP standardizes the {em("payload")} (posting, evidence, the verified score) on top of {a2aLink("A2A")}, not the transport. Bring whichever you like underneath.</> },
      { q: <>What stops spam?</>, a: <>The flow is candidate-initiated and {em("targeted")}: you apply to the one employer you chose, at their published inbox. No fan-out, no scraped exec emails. Beyond that it's federation policy — rate limits, blocklists, reputation — exactly like email.</> },
      { q: <>Isn't this just an AI résumé screener?</>, a: <>Those read what you {em("wrote")} and rank the most confident prose. HAP scores what it can {em("open and verify")}, and the candidate — not the employer — drives. Different trust root, opposite direction.</> },
      { q: <>Why not blockchain / Verifiable Credentials?</>, a: <>Premature for hiring; the issuer ecosystem isn't there. When VC matures, a HAP evidence item can wrap a VC like any other dereferenceable URL — the registry is open.</> },
      { q: <>Is this an ATS replacement?</>, a: <>No. HAP is the {em("application + evidence channel")}, not the tracking system. An ATS can be the employer's inbox; it keeps its database, HAP carries the verified packet.</> },
      { q: <>Who built this, and why solo?</>, a: <>One person. v0.2 is a draft published to get punched at. PRs and issues are the entire roadmap process — no closed company, no investor list, no team page. If the schemas are wrong, we want to know <i className="vA-em-serif">before</i> v1.0 locks them in.</> },
    ],
  },
  finalCta: {
    h2: <>Apply with your agent. <em>Run it.</em></>,
    p: "It's MIT. It's v0.2. The fastest way to judge it is to watch your agent apply and get scored on what it can prove.",
    ctaStar: "★ Star on GitHub",
    ctaClone: "clone & npm run demo:apply",
    ctaSpec: "→ read the spec",
  },
  footer: {
    blurb: "Hiring Agent Protocol — an open A2A profile where your agent applies with verified evidence. MIT-licensed. Federated. No central server.",
    cols: [
      { h: "Spec", links: [
        { label: "v0.2 RFC", href: "/spec" },
        { label: "Message kinds", href: "/spec" },
        { label: "Verifier registry", href: "/spec" },
        { label: "Proof-of-control", href: "/spec" },
      ]},
      { h: "Code", links: [
        { label: "GitHub repo", href: "https://github.com/luanrj-ai/hap" },
        { label: "candidate-runtime", href: "https://github.com/luanrj-ai/hap/tree/main/packages/candidate-runtime" },
        { label: "scoring (verifier)", href: "https://github.com/luanrj-ai/hap/tree/main/packages/scoring" },
        { label: "hosted proxy", href: "https://github.com/luanrj-ai/hap/tree/main/apps/proxy" },
      ]},
      { h: "Community", links: [
        { label: "RFC discussion", href: "https://github.com/luanrj-ai/hap/discussions" },
        { label: "Issues & PRs", href: "https://github.com/luanrj-ai/hap/issues" },
        { label: "HR dashboard (ref)", href: "/dashboard" },
        { label: "Editorial reading", href: "/variants/spec.html" },
      ]},
    ],
    bottomLeft: <>MIT · v0.2 draft · built on {a2aLink("A2A")}</>,
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
    eyebrowVer: "v0.2 · RFC 草案 · 2026",
    headline: (
      <>
        让你的 <em>agent</em> 替你投递，<br />
        而不是投 <span className="vA-strike">简历</span>。
      </>
    ),
    sub: (
      <>
        你的候选 agent 读一个职位，针对每条要求用 {em("可引用、可解引用的证据")} 作答，
        然后发出一个应答包 —— 不用架服务器、不用公开求职。一个中立打分器 {em("逐条点开你引用的链接")}，
        只给核得实的东西打分，而不是你的 agent 写了什么。一个开放的 {a2aLink("A2A")} 子集。联邦化。MIT。
      </>
    ),
    ctaStar: "在 GitHub 上 Star",
    ctaSpec: "阅读协议",
    metaStable: <>候选发起 · 异步</>,
    metaImpls: <>📦 <b>按核实的证据打分</b>，不看漂亮话</>,
    metaA2A: <>↪ 运行于 <b>A2A</b> 之上，而非与其竞争</>,
    metaBYO: <>🔐 <b>BYO LLM</b> · OpenAI · Anthropic · 本地</>,
    anchors: [
      { kbd: "§1 · 为什么", h: "主动投递，不是被筛", p: "为什么 agent 站在候选人这边。", href: "#why" },
      { kbd: "§2 · 运行", h: "60 秒本地 demo", p: "一条命令。你的 agent 投递，收件箱打分。", href: "#quickstart" },
      { kbd: "§3 · 规范", h: "posting · application · 评分", p: "异步消息形态 + 核实后的报告。", href: "#spec" },
      { kbd: "§4 · 反驳", h: "撒谎、身份、垃圾、MCP", p: "对怀疑读者的诚实回答。", href: "#faq" },
    ],
  },
  why: {
    eyebrow: "§1 · 为什么需要 HAP",
    h2: <>代表你的那个 agent 应当为 <em>你</em> 工作 ——<br />同时仍然能被对方核验。</>,
    lead:
      "简历是自报的，AI 又让这种媒介无法被证伪。所以别信文字 —— 信链接。HAP 把 agent 放在候选人这边，然后只给中立验证器能解引用的证据打分。",
    pillars: [
      {
        num: "01 · 候选发起",
        h: <>一条命令。<br />不用写、不用托管。</>,
        p: <>你的 profile 从你的<i className="vA-em-serif">公开</i> GitHub 自动生成 —— 不用填、不用跑服务器、绝不碰你本地机器。agent 针对每条要求用证据作答，发一个出站包给你选定的那一家。没有公开档案向全世界广播你在看机会。</>,
        sig: "// 公开 github → 应答包 · 用完即走 · 不扫本地",
      },
      {
        num: "02 · 按核实的证据打分",
        h: <>我们逐条点开链接。<br />漂亮话不计分。</>,
        p: <>中立打分器解引用每条证据 —— commit 作者是不是你、repo 是否真实、talk 会场是否存在 —— 然后给这个打分。你的 agent 措辞、它自报的 confidence，权重为 <i className="vA-em-serif">零</i>。引用一条假证据是一票否决，不是扣几分。诚实地说"我没有证据"则毫无惩罚。</>,
        sig: "// 给证据打分，不给句子打分",
      },
      {
        num: "03 · 能证明的身份",
        h: <>锚定它，证明它，<br />而不只是声称它。</>,
        p: <>在你的 GitHub 账号下发一个含 {code("HAP-PROOF")} 标记的 gist，打分器就把你的身份从 <i className="vA-em-serif">声称</i> 提升为 <i className="vA-em-serif">已证明</i> —— 你没法把别人的账号冒充成自己的。残余缺口我们也直说：整套冒充一个公开账号仍需要交互式挑战，已在路线图上。</>,
        sig: "// 声称 → 已证明 · 防君子，渐防小人",
      },
      {
        num: "04 · 仍是 A2A 子集",
        h: <>联邦化。异步。<br />任一方都能发起。</>,
        p: (
          <>HAP 消息是合法的 {a2aLink("Google A2A")} 消息，像 email 那样存转 —— 双方不必同时在线。今天由候选人发起；雇主 agent 也可以发起 sourcing。无中心服务器、无中介、MIT。我们标准化的是 <i className="vA-em-serif">内容</i>，不是传输。</>
        ),
        sig: "// 传输：A2A · 异步 · 候选发起优先",
      },
    ],
  },
  quickstart: {
    eyebrow: "§2 · 60 秒快速开始",
    h2: <>投一个职位。<em className="vA-em-serif vA-em-cyan">本地。</em></>,
    lead: (
      <>
        一条命令：起一个雇主收件箱、发布一个职位，并运行你的候选 agent —— 它用证据逐条作答、提交，
        收件箱 {em("自动")} 基于解引用后的链接打分。不需要 API 密钥 —— 没配 LLM 时回落到模板作答。
      </>
    ),
    barLabel: "~/code",
    barNode: "node ≥ 20",
    steps: [
      { cmd: <><span className="c-prompt">$</span>git clone https://github.com/luanrj-ai/hap && cd hap</>, copyText: "git clone https://github.com/luanrj-ai/hap && cd hap", copyLabel: "复制" },
      { cmd: <><span className="c-prompt">$</span>npm install && npm run build <span className="c-com"># 约 20 秒</span></>, copyText: "npm install && npm run build", copyLabel: "复制" },
      { cmd: <><span className="c-prompt">$</span>npm run demo:apply <span className="c-com"># 从公开 GitHub 生成应答包 → 收件箱核实并打分</span></>, copyText: "npm run demo:apply", copyLabel: "复制" },
    ],
    note1: (
      <>↪ 以你自己的身份投：{" "}
        <code style={{ color: "var(--cyan)" }}>GH_HANDLE=&lt;你的-github&gt; npm run demo:apply</code>
      </>
    ),
    note2: (
      <>↪ 真实流程：<code style={{ color: "var(--cyan)" }}>npm run serve:inbox</code> +{" "}
        <code style={{ color: "var(--cyan)" }}>npm run apply</code>
        <span style={{ color: "var(--dim)" }}> · 配 GITHUB_TOKEN 才能核实链接（不带 = 60/小时）</span>
      </>
    ),
  },
  a2a: {
    eyebrow: "§3 · HAP 位于何处",
    h2: <>它是 A2A 的子集。<br />现在是异步、候选优先。</>,
    lead: (
      <>
        HAP 之于 {a2aLink("Google 的 A2A")} 就像 HTTP 之于 TCP。A2A 负责信封：agent card、路由、认证。HAP 标准化的是 {em("负载")} —— 而 v0.2 把它做成存转式，双方不必同时在线。
      </>
    ),
    bullets: [
      <>雇主把一个 {code("hap.posting")}（JD + rubric）作为静态数据发布。发职位不需要跑 agent。</>,
      <>候选 agent 提交一个 {code("hap.application")}：每条 rubric 一条带证据的回答，出站投给一个哑收件箱。</>,
      <>中立打分器解引用引用的链接，返回一份核实后的报告 —— 造假一票否决、身份标注。</>,
      <>可选的 {code("proof_of_control")} 把身份锚点绑定到候选人可证明拥有的 GitHub 账号。</>,
    ],
    stack: [
      { h: <>你的候选 agent <span className="vA-stack__tag">任意 LLM · BYO</span></>, p: "读职位、用证据作答、出站提交 —— 跑一次就退出" },
      { h: <>hap.v0.2 · skill</>, p: "posting · application · receipt · 核实评分 · proof-of-control", cls: "hap" },
      { h: <>A2A · agent2agent</>, p: "信封 · agent card · 路由 · 认证 · 开放标准", cls: "a2a" },
      { h: <>HTTPS · 存转</>, p: "无中心 broker · 候选侧无需常驻服务器" },
    ],
  },
  spec: {
    eyebrow: "§3 · 协议节选 · v0.2",
    h2: <>四个形态。<em className="vA-em-serif vA-em-cyan">五分钟读完。</em></>,
    lead: (
      <>
        雇主发布一个 {code("hap.posting")}；候选 agent 返回一个 {code("hap.application")}；收件箱回一个 {code("hap.receipt")} 和一份中立、解引用后的 {code("评分")}。下方是标准形态 —— 完整 RFC 含散文、注册表与版本规则。
      </>
    ),
    links: [
      { label: "→ 阅读完整 RFC", href: "/spec" },
      { label: "→ 证据 + 验证器注册表", href: "#" },
      { label: "→ TypeScript schema (Zod)", href: "#" },
    ],
  },
  comparison: {
    eyebrow: "§4 · HAP 与其他方案的诚实对比",
    h2: <>一个协议、一个招聘网站、一个筛简历机器人，<br />走进一场招聘对话。</>,
    lead: <>我们常被问"这不就是另一个 {em("X")} 吗？"短答：不是。长答见下。在我们劣势的地方，我们承认。</>,
    headers: {
      empty: "",
      hap: "HAP",
      ats: <>ATS / 招聘网站 <span style={{ color: "var(--dim)" }}>(Greenhouse · Lever)</span></>,
      web3: <>AI 简历筛选器 <span style={{ color: "var(--dim)" }}>(自报)</span></>,
    },
    rows: [
      { cat: "信任根", hap: ["y", "解引用的证据 + proof-of-control"], ats: ["m", "ATS 厂商的数据库"], web3: ["n", "简历自己的文字"] },
      { cat: "给什么打分", hap: ["y", "核实过的证据 —— 不是 agent 的话"], ats: ["m", "对简历文本做关键词匹配"], web3: ["n", "LLM 读自报的声明"] },
      { cat: "候选人同意", hap: ["y", "只投一家 · 无公开档案"], ats: ["n", "上来就要完整简历 + 档案"], web3: ["m", "你上传什么就排什么"] },
      { cat: "能不能注水", hap: ["y", "假链接 = 一票否决到 no_fit"], ats: ["m", "靠事后人工背调"], web3: ["n", "自信的漂亮话得分高"] },
      { cat: "今天能用吗", hap: ["y", "v0.2 · MIT · TS 实现 + 可跑 demo"], ats: ["y", "能用（管道是他们的）"], web3: ["y", "能用（且它信文字）"] },
    ],
    loseRow: {
      cat: "我们劣势在哪",
      hap: "协议是 v0.x · 当下采用率为零",
      ats: "我们不跟踪应聘（我们不是 ATS）",
      web3: "没有针对你这条漏斗调过的模型（暂时）",
    },
  },
  roadmap: {
    eyebrow: "§5 · 路线图 · 已公开、有日期、不打马虎眼",
    h2: <>v0.x = 允许破坏性变更。<em className="vA-em-serif vA-em-cyan">v1.0 = 稳定。</em></>,
    lead: "我们在 v0.x。v1 之前的任何东西都可能改。现在公开发布的意义就是趁 schema 还没固化时收到批评。",
    rows: [
      { ver: "v0.1", date: "2026 年 5 月", title: "HR 驱动面试", sub: "candidate-runtime · hr-runtime · a2a-adapter · scoring", line: "· 同步式 · 现为可选的 L1 层", pill: ["cyan", "已发布"] },
      { ver: "v0.2", date: "2026 年 5 月", title: "候选发起 + 核实评分", sub: "异步 posting / application / receipt · 中立打分器 · proof-of-control gist", line: "· 按解引用的证据打分，不看漂亮话", pill: ["cyan", "已发布"] },
      { ver: "v0.3", date: "2026 Q3", title: "交互式身份挑战", sub: "服务端下发 nonce / 签名 —— 补上整套冒充的缺口", line: "· + 更多证据验证器", pill: ["yellow", "起草中"] },
      { ver: "v0.4", date: "2026 Q4", title: "雇主发起 sourcing", sub: "HR 发起流程 + 候选 ProfileCard 发现", line: "—— 双向，完全对称", pill: [null, "计划中"] },
      { ver: "v1.0", date: "≥ 2027 Q3", title: "Schema 冻结", sub: "前提：≥ 5 个独立运行时能干净互操作", line: "—— 只允许向后兼容的新增", pill: [null, "目标"] },
    ],
  },
  faq: {
    eyebrow: "§6 · 常见问题 · 写给怀疑的读者",
    h2: <>"这不就是另一个 <em className="vA-em-serif">X</em> 吗？"</>,
    items: [
      { q: <>候选人的 agent 直接撒谎怎么办？</>, a: <>它可以写任何话 —— 而这些话不计分。中立打分器无视文字和自报的 confidence；它解引用每条引用的链接，只给核得实的东西打分。引用一条假证据不是扣几分，是一票否决到 {code("no_fit")}。诚实地 decline（"没有证据"）则毫无代价。</>, open: true },
      { q: <>你怎么知道那个 GitHub 账号真是他的？</>, a: <>两个级别。默认锚点是 {em("声称")}。加一个 {code("proof_of_control")} gist —— 在该账号下发一个含 {code("HAP-PROOF")} 标记的 gist —— 它就变成 {em("已证明")}：冒充者没法在自己不控制的账号下发 gist。残余缺口（整套冒充一个公开账号）需要交互式挑战，已在路线图上。我们不假装它已解决。</> },
      { q: <>为什么不直接用 MCP？</>, a: <>MCP 是 agent ↔ tool。候选 agent 向雇主收件箱 POST 接近这个 —— 但 HAP 在 {a2aLink("A2A")} 之上标准化的是 {em("负载")}（posting、证据、核实后的评分），不是传输。底下用哪个随你。</> },
      { q: <>怎么防垃圾消息？</>, a: <>流程是候选发起、且 {em("有的放矢")}：你只投你选定的那一家，发到他们公布的收件箱。没有 fan-out、不扒高管邮箱。再往上是联邦策略 —— 限流、黑名单、声誉 —— 和 email 一样。</> },
      { q: <>这不就是个 AI 简历筛选器吗？</>, a: <>那些读你 {em("写")} 的东西、给最自信的漂亮话排名。HAP 给它能 {em("点开并核实")} 的东西打分，而且是候选人 —— 不是雇主 —— 在驱动。信任根不同，方向相反。</> },
      { q: <>为什么不用区块链 / Verifiable Credentials？</>, a: <>对招聘太早了，签发方生态不存在。等 VC 成熟，HAP 的一条 evidence 可以像包装任意可解引用 URL 那样包装一个 VC —— 注册表是开放的。</> },
      { q: <>它是 ATS 替代品吗？</>, a: <>不是。HAP 是 {em("投递 + 证据通道")}，不是追踪系统。ATS 可以当雇主收件箱；它保留自己的数据库，HAP 负责承载核实过的应答包。</> },
      { q: <>谁做的？为什么单干？</>, a: <>一个人。v0.2 是为了被打脸而公开的草案。PR 和 issue 是整个路线图过程 —— 没有闭源公司、没有投资人列表、没有团队页面。如果 schema 是错的，我们想在 v1.0 锁定它们 <i className="vA-em-serif">之前</i> 知道。</> },
    ],
  },
  finalCta: {
    h2: <>让你的 agent 投递。<em>跑一遍。</em></>,
    p: "它是 MIT。它是 v0.2。判断它好不好用最快的办法，就是看你的 agent 投递、并按它能证明的东西被打分。",
    ctaStar: "★ 在 GitHub 上 Star",
    ctaClone: "clone & npm run demo:apply",
    ctaSpec: "→ 阅读协议",
  },
  footer: {
    blurb: "Hiring Agent Protocol —— 一个开放的 A2A 子集，你的 agent 带可验证证据投递。MIT 许可。联邦化。无中心服务器。",
    cols: [
      { h: "协议", links: [
        { label: "v0.2 RFC", href: "/spec" },
        { label: "消息类型", href: "/spec" },
        { label: "验证器注册表", href: "/spec" },
        { label: "Proof-of-control", href: "/spec" },
      ]},
      { h: "代码", links: [
        { label: "GitHub 仓库", href: "https://github.com/luanrj-ai/hap" },
        { label: "candidate-runtime", href: "https://github.com/luanrj-ai/hap/tree/main/packages/candidate-runtime" },
        { label: "scoring（验证器）", href: "https://github.com/luanrj-ai/hap/tree/main/packages/scoring" },
        { label: "托管代理", href: "https://github.com/luanrj-ai/hap/tree/main/apps/proxy" },
      ]},
      { h: "社区", links: [
        { label: "RFC 讨论", href: "https://github.com/luanrj-ai/hap/discussions" },
        { label: "Issues 与 PR", href: "https://github.com/luanrj-ai/hap/issues" },
        { label: "HR dashboard 参考", href: "/dashboard" },
        { label: "Editorial 风格", href: "/variants/spec.html" },
      ]},
    ],
    bottomLeft: <>MIT · v0.2 草案 · 基于 {a2aLink("A2A")}</>,
    bottomRight: "本页面不加载任何 analytics",
  },
  langSwitchLabel: "EN",
};

export function getContent(lang: Lang): ContentTree {
  return lang === "zh" ? ZH : EN;
}

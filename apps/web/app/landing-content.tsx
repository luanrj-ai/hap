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
  howItWorks: {
    eyebrow: string;
    h2: ReactNode;
    lead: string;
    flows: Array<{ title: string; steps: ReactNode[]; outcome: string }>;
  };
  demo: {
    eyebrow: string;
    h2: ReactNode;
    lead: ReactNode;
    cmd: string;
  };
  install: {
    eyebrow: string;
    h2: ReactNode;
    lead: ReactNode;
    ccLabel: string;
    ccText: string;
    copyLabel: string;
    note: ReactNode;
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
    eyebrowVer: "v0.2 · candidate-initiated · MIT",
    headline: (
      <>
        Your work is your résumé.<br />
        Your <em>agent</em> does the rest.
      </>
    ),
    sub: (
      <>
        Your agent builds a profile from your real GitHub work, applies to jobs for
        you, and helps employers find you. They rank you on {em("work they can open and check")} —
        not a <span className="vA-strike">résumé you wrote</span>. Free, no limits, built for
        agents. You own your profile — it's an open {a2aLink("A2A")} format, not a locked-in database.
      </>
    ),
    ctaStar: "Star on GitHub",
    ctaSpec: "read the spec",
    metaStable: <>free · unlimited · agent-friendly</>,
    metaImpls: <>📦 <b>scored on verified evidence</b>, not prose</>,
    metaA2A: <>↪ open <b>A2A</b> profile · self-hostable</>,
    metaBYO: <>🔐 <b>your data stays yours</b></>,
    anchors: [
      { kbd: "§ · HOW", h: "How it works", p: "The step-by-step for job-seekers and for hiring.", href: "#how" },
      { kbd: "§2 · RUN", h: "60-second local demo", p: "One command: apply with verified evidence.", href: "#quickstart" },
      { kbd: "§3 · SPEC", h: "Four messages + JSON Schema", p: "posting · application · receipt · profile.", href: "#spec" },
      { kbd: "§4 · WHY-NOT", h: "Lies, identity, spam, MCP", p: "Honest answers to the skeptical reader.", href: "#faq" },
    ],
  },
  howItWorks: {
    eyebrow: "How it works",
    h2: <>No résumé, no forms.<br />Here's the <em>actual</em> flow.</>,
    lead: "Two short commands on each side — that's the whole thing.",
    flows: [
      {
        title: "① If you're job-hunting",
        steps: [
          "Run one command — your profile builds itself from your real GitHub work (and, if you opt in, what you've built with Claude Code).",
          "Name a company, or let it find matches — it pulls the role and checks how well you fit.",
          "It writes the application for you, citing your real commits, repos, and talks. You see exactly what it'll send, first.",
          "Employers reach out to you. Your contact only shows when one actually asks — you never broadcast that you're looking.",
        ],
        outcome: "You apply with proof, not a résumé — in about a minute.",
      },
      {
        title: "② If you're hiring",
        steps: [
          "Post a role: a title plus what you require. It's just a file — no account, no dashboard to set up.",
          "Candidates' agents apply with evidence — links to real commits, repos, and talks.",
          "The scorer opens every link and verifies it (is this commit theirs? is the repo real?). Faked links are rejected outright.",
          "You get a ranked shortlist with the proof attached — or search candidates yourself, ranked by what's verified.",
        ],
        outcome: "You read verified work, not self-written resumes.",
      },
    ],
  },
  demo: {
    eyebrow: "See it run",
    h2: <>One application in. <em>One verified report</em> back.</>,
    lead: <>Not a chat — the candidate submits a single packet (evidence per requirement), the scorer opens every link, and one report comes back. Same scorer, opposite outcomes.</>,
    cmd: "npm run demo:tour",
  },
  install: {
    eyebrow: "Get started",
    h2: <>Two ways in. <em className="vA-em-serif vA-em-cyan">~60 seconds.</em></>,
    lead: <>Paste one block to your Claude Code, or run three commands yourself. No keys — template fallback if no LLM.</>,
    ccLabel: "paste to Claude Code",
    copyLabel: "copy",
    ccText:
      "Set up HAP for me. Clone https://github.com/luanrj-ai/hap, then run `npm install && npm run build`. Then build my HAP profile from my PUBLIC GitHub: `npm run profile -- --handle <your-github> --with-claude`. Show me my verified evidence and the command to apply to a role.",
    note: <>↪ replace <code>&lt;your-github&gt;</code> with your handle.</>,
  },
  why: {
    eyebrow: "What makes it different",
    h2: <>A job board makes you sell yourself.<br />HAP lets your <em>work</em> speak — and checks it.</>,
    lead:
      "Anyone can write a great résumé — and AI made that free. So HAP doesn't grade what you wrote; it grades what it can open and verify. Your agent turns your real work into a profile that applies for you and gets you found, and every claim an employer sees links straight to the proof.",
    pillars: [
      {
        num: "01 · LIVING PROFILE",
        h: <>Your résumé writes<br />and updates itself.</>,
        p: <>Run one command and your profile builds itself from your <i className="vA-em-serif">public</i> GitHub. Opt in, and it also counts your <i className="vA-em-serif">local</i> Claude Code projects — only their names and how often you used them, never the contents, and nothing leaves your machine. Nothing to fill in, nothing to host. Re-run it (or schedule it) and it stays up to date.</>,
        sig: "// public github + opt-in cc footprint · candidate-owned",
      },
      {
        num: "02 · SCORED ON EVIDENCE",
        h: <>Employers open every link.<br />Prose scores nothing.</>,
        p: <>The employer's scorer opens every link you cite and checks it — is this commit yours, is the repo real, did that talk happen — and scores that. What your agent <i className="vA-em-serif">wrote</i>, and how confident it says it is, count for nothing. Cite something fake and you're out. Say "I don't have that" honestly and you lose nothing.</>,
        sig: "// score the artifact, not the sentence",
      },
      {
        num: "03 · FOUND BY EVIDENCE",
        h: <>Recruiters find you by<br />what's verified, not keywords.</>,
        p: <>Publish your profile only if you want to, and an index ranks you by what's been <i className="vA-em-serif">verified</i> — not keywords. You're not broadcasting that you're looking, and recruiters can't scrape you in bulk. Your contact isn't shown in results — to reach you, they have to ask, within a limit <i className="vA-em-serif">you</i> set.</>,
        sig: "// opt-in discovery · contact gated by your rate limit",
      },
      {
        num: "04 · OPEN & YOURS",
        h: <>Free, unlimited, agent-friendly.<br />The opposite of a walled job board.</>,
        p: (
          <>It's an open format with published {code("JSON Schema")}, so any agent in any language can implement it — and you can run it yourself. No paywall, no daily caps, no banning your bot. Your profile and contact live with <i className="vA-em-serif">you</i>, not in someone else's database. Built on {a2aLink("A2A")}, MIT.</>
        ),
        sig: "// no paywall · no bot bans · data stays candidate-owned",
      },
    ],
  },
  quickstart: {
    eyebrow: "§2 · 60-second quick start",
    h2: <>See the whole loop. <em className="vA-em-serif vA-em-cyan">Locally.</em></>,
    lead: (
      <>
        One command runs a candidate-agent that answers a role's rubric with cited
        evidence, submits, and an employer inbox that {em("auto-scores")} it on
        dereferenced links. No API keys required — template fallback if no LLM.
      </>
    ),
    barLabel: "~/code",
    barNode: "node ≥ 20",
    steps: [
      { cmd: <><span className="c-prompt">$</span>git clone https://github.com/luanrj-ai/hap && cd hap</>, copyText: "git clone https://github.com/luanrj-ai/hap && cd hap", copyLabel: "copy" },
      { cmd: <><span className="c-prompt">$</span>npm install && npm run build <span className="c-com"># ~ 20s</span></>, copyText: "npm install && npm run build", copyLabel: "copy" },
      { cmd: <><span className="c-prompt">$</span>npm run demo:apply <span className="c-com"># apply w/ evidence → inbox verifies &amp; scores</span></>, copyText: "npm run demo:apply", copyLabel: "copy" },
    ],
    note1: (
      <>↪ build your living profile:{" "}
        <code style={{ color: "var(--cyan)" }}>npm run profile -- --handle &lt;you&gt; --with-claude</code>
      </>
    ),
    note2: (
      <>↪ the rest: <code style={{ color: "var(--cyan)" }}>apply --targets --auto</code> ·{" "}
        <code style={{ color: "var(--cyan)" }}>serve:index</code> + <code style={{ color: "var(--cyan)" }}>search</code> ·{" "}
        dashboard at <code style={{ color: "var(--cyan)" }}>/hap</code>
      </>
    ),
  },
  a2a: {
    eyebrow: "§3 · Where HAP sits",
    h2: <>An A2A profile.<br />Async, candidate-first.</>,
    lead: (
      <>
        HAP is to {a2aLink("Google's A2A")} what HTTP is to TCP. A2A is the
        envelope; HAP standardizes the {em("payload")} — and it's store-and-forward,
        so neither side has to be online at once.
      </>
    ),
    bullets: [
      <>Four messages — {code("hap.posting")}, {code("hap.application")}, {code("hap.receipt")}, {code("hap.profile")} — with published {code("JSON Schema")}.</>,
      <>Employers publish a posting (a JD + rubric) as static data; no agent required to post.</>,
      <>The candidate-agent submits one evidenced packet; a neutral scorer dereferences and scores it.</>,
      <>An opt-in index makes a candidate discoverable, ranked by verified signal, with contact gated.</>,
    ],
    stack: [
      { h: <>your candidate-agent <span className="vA-stack__tag">any LLM · BYO</span></>, p: "builds a profile, applies with evidence — runs and exits" },
      { h: <>hap.v0.2 · skill</>, p: "posting · application · receipt · profile · verified score · discovery", cls: "hap" },
      { h: <>A2A · agent2agent</>, p: "envelope · agent card · routing · auth · open standard", cls: "a2a" },
      { h: <>HTTPS · store-and-forward</>, p: "no central broker · no always-on candidate server" },
    ],
  },
  spec: {
    eyebrow: "§3 · Spec excerpt · v0.2",
    h2: <>Four shapes. <em className="vA-em-serif vA-em-cyan">Read them in five minutes.</em></>,
    lead: (
      <>
        Employer publishes a {code("hap.posting")}; the candidate-agent returns a{" "}
        {code("hap.application")}; the inbox replies with a {code("hap.receipt")} and a
        neutral, dereferenced {code("score")}. A candidate-owned {code("hap.profile")}
        powers opt-in discovery. All four have machine-readable JSON Schema.
      </>
    ),
    links: [
      { label: "→ read the full v0.2 RFC", href: "/spec" },
      { label: "→ JSON Schemas", href: "https://github.com/luanrj-ai/hap/tree/main/spec/schemas" },
      { label: "→ TypeScript schemas (Zod)", href: "https://github.com/luanrj-ai/hap/tree/main/packages/a2a-adapter" },
    ],
  },
  comparison: {
    eyebrow: "§4 · How HAP differs · honestly",
    h2: <>A protocol, a job board, and a screening bot<br />walk into a hiring conversation.</>,
    lead: <>We get asked "isn't this just another {em("X")}?" a lot. Short answer: no. Long answer below. Where we lose, we say so.</>,
    headers: {
      empty: "",
      hap: "HAP",
      ats: <>Job board / ATS <span style={{ color: "var(--dim)" }}>(centralized)</span></>,
      web3: <>AI résumé screener <span style={{ color: "var(--dim)" }}>(self-reported)</span></>,
    },
    rows: [
      { cat: "trust root", hap: ["y", "dereferenced evidence + proof-of-control"], ats: ["m", "the platform's database"], web3: ["n", "the résumé's own words"] },
      { cat: "what gets scored", hap: ["y", "verified artifacts — not the agent's prose"], ats: ["m", "keywords + recruiter eyeballing"], web3: ["n", "an LLM reading self-reported claims"] },
      { cat: "who owns the data", hap: ["y", "the candidate — profile + contact stay with you"], ats: ["n", "the platform owns the graph"], web3: ["m", "whatever you upload, ranked"] },
      { cat: "cost / access", hap: ["y", "free · unlimited · agent-friendly"], ats: ["n", "paid · daily caps · bans bots"], web3: ["m", "per-seat SaaS"] },
      { cat: "ships today", hap: ["y", "v0.2 · MIT · runnable demo + JSON Schema"], ats: ["y", "yes (and owns the pipe)"], web3: ["y", "yes (and trusts the text)"] },
    ],
    loseRow: {
      cat: "where we lose",
      hap: "spec is v0.x · adoption is early · best for technical/IC roles today",
      ats: "we don't track applications (we're not an ATS)",
      web3: "no model tuned on your exact funnel (yet)",
    },
  },
  roadmap: {
    eyebrow: "§5 · Roadmap · published, dated, honest",
    h2: <>v0.x = breaking changes allowed. <em className="vA-em-serif vA-em-cyan">v1.0 = stable.</em></>,
    lead: "Built in the open. v1 freezes the schemas once independent runtimes interoperate cleanly.",
    rows: [
      { ver: "v0.1", date: "May 2026", title: "Live interview", sub: "synchronous recruiter-driven interview — now the optional L1 layer", line: "· ask / answer / session.close", pill: ["cyan", "shipped"] },
      { ver: "v0.2", date: "May 2026", title: "Candidate-initiated platform", sub: "living profile · verified scorer · multi-target apply · opt-in discovery · recruiter dashboard · spec + JSON Schema", line: "· score on dereferenced evidence, not prose", pill: ["cyan", "shipped"] },
      { ver: "v0.3", date: "Q3 2026", title: "One-click identity", sub: "Sign-in-with-GitHub OAuth + interactive challenge to close the impersonation gap", line: "· + more evidence verifiers", pill: ["yellow", "drafting"] },
      { ver: "v0.4", date: "Q4 2026", title: "Recruiter-initiated sourcing", sub: "fully symmetric agent2agent; both sides may initiate", line: "— 双向", pill: [null, "planned"] },
      { ver: "v1.0", date: "≥ Q3 2027", title: "Schema freeze", sub: "predicated on ≥ 5 independent runtimes interoperating cleanly", line: "— backward-compatible additions only", pill: [null, "target"] },
    ],
  },
  faq: {
    eyebrow: "§6 · FAQ · for the skeptical reader",
    h2: <>"Isn't this just <em className="vA-em-serif">X</em>?"</>,
    items: [
      { q: <>Can't a candidate's agent just lie?</>, a: <>It can write anything — and the writing scores nothing. The scorer ignores the prose and the self-rated confidence; it dereferences each cited link and scores only what checks out. A fabricated citation isn't a small deduction, it's a hard gate to {code("no_fit")}. Declining honestly ("no evidence") costs nothing.</>, open: true },
      { q: <>How do you know the GitHub account is really theirs?</>, a: <>By default the anchor is {em("asserted")}. A {code("proof_of_control")} gist (a {code("HAP-PROOF")} marker under that account) makes it {em("proven")}; v0.3 adds one-click GitHub OAuth. The residual gap (wholesale impersonation of a public account) is acknowledged, not hidden.</> },
      { q: <>Does it read my private code or Claude chats?</>, a: <>No. Scoring uses only {em("public")} evidence. The Claude Code footprint is opt-in and reads {em("metadata only")} — project names + session counts, never transcript contents — and stays on your machine; only what you see goes into your profile.</> },
      { q: <>What stops spam — both ways?</>, a: <>Applying is candidate-initiated and targeted (auto-apply is gated by a match threshold + a cap). Discovery never exposes contact; a recruiter must request it, rate-limited by {em("your")} terms, with a blocklist. No bot bans — abuse is priced by verification + reputation.</> },
      { q: <>Isn't this just an AI résumé screener?</>, a: <>Those read what you {em("wrote")} and rank the confident prose. HAP scores what it can {em("open and verify")}, and the candidate drives. Different trust root, opposite direction.</> },
      { q: <>Why not just MCP?</>, a: <>MCP is agent ↔ tool. HAP standardizes the {em("payload")} (posting, evidence, verified score, profile) on top of {a2aLink("A2A")}, not the transport. Bring whichever you like underneath.</> },
      { q: <>Is this an ATS / a LinkedIn?</>, a: <>No. It's the application + evidence + discovery layer, with no central résumé database — your profile and contact stay candidate-owned. An ATS can be the employer's inbox.</> },
      { q: <>Who's it for right now?</>, a: <>Technical / product ICs with a public footprint — where the verified signal is strongest. The evidence registry is open, so other domains can extend it.</> },
    ],
  },
  finalCta: {
    h2: <>Your work already speaks. <em>Let your agent use it.</em></>,
    p: "It's MIT. It's v0.2. The fastest way to judge it is to run it and watch your work get scored on what it can prove.",
    ctaStar: "★ Star on GitHub",
    ctaClone: "clone & npm run demo:apply",
    ctaSpec: "→ read the spec",
  },
  footer: {
    blurb: "Hiring Agent Protocol — your agent keeps a verified profile, applies for you, and gets you found by evidence employers can check. MIT. Federated. Your data stays yours.",
    cols: [
      { h: "Spec", links: [
        { label: "v0.2 RFC", href: "/spec" },
        { label: "JSON Schemas", href: "https://github.com/luanrj-ai/hap/tree/main/spec/schemas" },
        { label: "Message kinds", href: "/spec" },
        { label: "Proof-of-control", href: "/spec" },
      ]},
      { h: "Code", links: [
        { label: "GitHub repo", href: "https://github.com/luanrj-ai/hap" },
        { label: "candidate-runtime", href: "https://github.com/luanrj-ai/hap/tree/main/packages/candidate-runtime" },
        { label: "scoring (verifier)", href: "https://github.com/luanrj-ai/hap/tree/main/packages/scoring" },
        { label: "recruiter dashboard", href: "/hap" },
      ]},
      { h: "Community", links: [
        { label: "RFC discussion", href: "https://github.com/luanrj-ai/hap/discussions" },
        { label: "Issues & PRs", href: "https://github.com/luanrj-ai/hap/issues" },
        { label: "Editorial reading", href: "/variants/spec.html" },
        { label: "A2A", href: "https://a2a-protocol.org" },
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
    eyebrowVer: "v0.2 · 候选发起 · MIT",
    headline: (
      <>
        你的作品就是简历。<br />
        剩下的交给你的 <em>agent</em>。
      </>
    ),
    sub: (
      <>
        你的 agent 从你真实的 GitHub 作品生成一份 profile,替你投简历,并帮雇主找到你。雇主给你排序,
        靠的是 {em("他们能打开核实的作品")},不是你自己写的 <span className="vA-strike">简历</span>。
        免费、不限量、为 agent 而生。profile 归你 —— 一种开放的 {a2aLink("A2A")} 格式,而不是被锁进某个数据库。
      </>
    ),
    ctaStar: "在 GitHub 上 Star",
    ctaSpec: "阅读协议",
    metaStable: <>免费 · 不限量 · 对 agent 友好</>,
    metaImpls: <>📦 <b>按核实的证据打分</b>,不看漂亮话</>,
    metaA2A: <>↪ 开放 <b>A2A</b> 子集 · 可自托管</>,
    metaBYO: <>🔐 <b>你的数据归你</b></>,
    anchors: [
      { kbd: "§ · 怎么用", h: "怎么用", p: "求职和招聘各自的一步步流程。", href: "#how" },
      { kbd: "§2 · 运行", h: "60 秒本地 demo", p: "一条命令:带可核实证据投递。", href: "#quickstart" },
      { kbd: "§3 · 规范", h: "四种消息 + JSON Schema", p: "posting · application · receipt · profile。", href: "#spec" },
      { kbd: "§4 · 反驳", h: "撒谎、身份、垃圾、MCP", p: "对怀疑读者的诚实回答。", href: "#faq" },
    ],
  },
  howItWorks: {
    eyebrow: "怎么用",
    h2: <>不写简历,不填表。<br />这是<em>真实</em>的流程。</>,
    lead: "两边各两条短命令,就这么多。",
    flows: [
      {
        title: "① 你在找工作",
        steps: [
          "跑一条命令 —— profile 从你真实的 GitHub 作品自动生成(你愿意的话,再算上你用 Claude Code 做过的东西)。",
          "给它一个公司,或让它自己找匹配 —— 它会拉取职位、看你有多契合。",
          "它替你写好申请,引用你真实的 commit、repo、talk。发出去之前,你先看到要发的全部内容。",
          "雇主来联系你。你的联系方式只在对方真的发出请求时才出现 —— 你从不向全世界广播你在看机会。",
        ],
        outcome: "你用证据投递,不是简历 —— 大约一分钟。",
      },
      {
        title: "② 你在招人",
        steps: [
          "发一个职位:一个标题 + 你的要求。它就是个文件 —— 不用注册、不用搭后台。",
          "候选人的 agent 带证据来投 —— 指向真实 commit、repo、talk 的链接。",
          "打分器把每个链接都打开核实(这 commit 是不是他写的?repo 是不是真的?)。造假的链接直接拒。",
          "你拿到一份带证据的排序候选清单 —— 或自己搜索候选人,按已核实的东西排序。",
        ],
        outcome: "你看到的是核实过的作品,不是自己写的简历。",
      },
    ],
  },
  demo: {
    eyebrow: "看它跑",
    h2: <>投一份申请。<em>回一份核实报告</em>。</>,
    lead: <>不是聊天 —— 候选人提交一个包(逐条要求附证据),打分器把每个链接打开核实,回一份报告。同一打分器,相反结果。</>,
    cmd: "npm run demo:tour",
  },
  install: {
    eyebrow: "开始用",
    h2: <>两种方式,<em className="vA-em-serif vA-em-cyan">约 60 秒。</em></>,
    lead: <>把一段粘进你的 Claude Code,或自己跑三条命令。无需密钥 —— 没配 LLM 时回落到模板。</>,
    ccLabel: "复制给 Claude Code",
    copyLabel: "复制",
    ccText:
      "帮我装好 HAP。Clone https://github.com/luanrj-ai/hap,然后运行 `npm install && npm run build`。再从我的公开 GitHub 生成 HAP profile:`npm run profile -- --handle <你的-github> --with-claude`。把我核实到的证据和投递命令告诉我。",
    note: <>↪ 把 <code>&lt;你的-github&gt;</code> 换成你的用户名。</>,
  },
  why: {
    eyebrow: "有什么不同",
    h2: <>招聘网站让你推销自己。<br />HAP 让你的 <em>作品</em> 说话 —— 而且去核实它。</>,
    lead:
      "谁都能写一份漂亮简历 —— AI 让这事变得免费。所以 HAP 不评你写了什么,只评它能打开并核实的东西。你的 agent 把你真实的工作变成一份 profile,替你投递、让你被找到,而雇主看到的每条声明都直接链到证据。",
    pillars: [
      {
        num: "01 · 活简历",
        h: <>简历自己写、<br />自己更新。</>,
        p: <>跑一条命令,profile 就从你的<i className="vA-em-serif">公开</i> GitHub 自动生成。你愿意的话,它还会统计你<i className="vA-em-serif">本地</i>的 Claude Code 项目 —— 只看项目名和你用了多少次,绝不读内容,什么都不离开你的机器。不用填、不用托管。重跑(或挂定时)它就保持最新。</>,
        sig: "// 公开 github + 可选 cc 足迹 · 归候选人所有",
      },
      {
        num: "02 · 按证据打分",
        h: <>雇主逐条点开链接。<br />漂亮话不计分。</>,
        p: <>雇主的打分器把你引用的每个链接都打开核实 —— 这个 commit 是不是你写的、repo 是不是真的、那场 talk 有没有发生 —— 然后给这个打分。你的 agent <i className="vA-em-serif">写了什么</i>、自称多有把握,都不算分。引用一条假的,你出局。诚实说"我没有",你毫无损失。</>,
        sig: "// 给证据打分,不给句子打分",
      },
      {
        num: "03 · 靠证据被发现",
        h: <>招聘方靠核实信号找你,<br />不是关键词。</>,
        p: <>你愿意才发布 profile,索引按"<i className="vA-em-serif">已核实</i>的东西"给你排序 —— 不是关键词。你不会向全世界广播你在找工作,招聘方也没法批量扒你。联系方式不出现在结果里 —— 想联系你,得发请求,且受<i className="vA-em-serif">你</i>设的上限限制。</>,
        sig: "// opt-in 发现 · 联系方式受你设的上限限制",
      },
      {
        num: "04 · 开放且归你",
        h: <>免费、不限量、对 agent 友好。<br />和围墙招聘站相反。</>,
        p: (
          <>一种带公开 {code("JSON Schema")} 的开放格式,任何语言的 agent 都能实现 —— 你也能自己跑。没有付费墙、没有每日限制、不封你的 bot。你的 profile 和联系方式归<i className="vA-em-serif">你</i>,不在别人的数据库里。基于 {a2aLink("A2A")},MIT。</>
        ),
        sig: "// 无付费墙 · 不封 bot · 数据归候选人",
      },
    ],
  },
  quickstart: {
    eyebrow: "§2 · 60 秒快速开始",
    h2: <>看完整闭环。<em className="vA-em-serif vA-em-cyan">本地。</em></>,
    lead: (
      <>
        一条命令:候选 agent 针对职位的 rubric 用证据逐条作答、提交,雇主收件箱 {em("自动")} 基于解引用的链接打分。
        不需要 API 密钥 —— 没配 LLM 时回落到模板。
      </>
    ),
    barLabel: "~/code",
    barNode: "node ≥ 20",
    steps: [
      { cmd: <><span className="c-prompt">$</span>git clone https://github.com/luanrj-ai/hap && cd hap</>, copyText: "git clone https://github.com/luanrj-ai/hap && cd hap", copyLabel: "复制" },
      { cmd: <><span className="c-prompt">$</span>npm install && npm run build <span className="c-com"># 约 20 秒</span></>, copyText: "npm install && npm run build", copyLabel: "复制" },
      { cmd: <><span className="c-prompt">$</span>npm run demo:apply <span className="c-com"># 带证据投递 → 收件箱核实并打分</span></>, copyText: "npm run demo:apply", copyLabel: "复制" },
    ],
    note1: (
      <>↪ 生成你的活简历:{" "}
        <code style={{ color: "var(--cyan)" }}>npm run profile -- --handle &lt;你&gt; --with-claude</code>
      </>
    ),
    note2: (
      <>↪ 其余:<code style={{ color: "var(--cyan)" }}>apply --targets --auto</code> ·{" "}
        <code style={{ color: "var(--cyan)" }}>serve:index</code> + <code style={{ color: "var(--cyan)" }}>search</code> ·{" "}
        看板在 <code style={{ color: "var(--cyan)" }}>/hap</code>
      </>
    ),
  },
  a2a: {
    eyebrow: "§3 · HAP 位于何处",
    h2: <>一个 A2A 子集。<br />异步、候选优先。</>,
    lead: (
      <>
        HAP 之于 {a2aLink("Google 的 A2A")} 就像 HTTP 之于 TCP。A2A 是信封;HAP 标准化 {em("负载")} —— 而且是存转式,双方不必同时在线。
      </>
    ),
    bullets: [
      <>四种消息 —— {code("hap.posting")}、{code("hap.application")}、{code("hap.receipt")}、{code("hap.profile")} —— 都有公开的 {code("JSON Schema")}。</>,
      <>雇主把职位(JD + rubric)作为静态数据发布;发职位不需要跑 agent。</>,
      <>候选 agent 提交一个带证据的包;中立打分器解引用并打分。</>,
      <>opt-in 索引让候选人可被发现,按核实信号排序,联系方式受控。</>,
    ],
    stack: [
      { h: <>你的候选 agent <span className="vA-stack__tag">任意 LLM · BYO</span></>, p: "生成 profile、带证据投递 —— 跑一次就退出" },
      { h: <>hap.v0.2 · skill</>, p: "posting · application · receipt · profile · 核实评分 · 发现", cls: "hap" },
      { h: <>A2A · agent2agent</>, p: "信封 · agent card · 路由 · 认证 · 开放标准", cls: "a2a" },
      { h: <>HTTPS · 存转</>, p: "无中心 broker · 候选侧无需常驻服务器" },
    ],
  },
  spec: {
    eyebrow: "§3 · 协议节选 · v0.2",
    h2: <>四个形态。<em className="vA-em-serif vA-em-cyan">五分钟读完。</em></>,
    lead: (
      <>
        雇主发布 {code("hap.posting")};候选 agent 返回 {code("hap.application")};收件箱回 {code("hap.receipt")} 和一份中立、解引用后的 {code("评分")}。候选人自持的 {code("hap.profile")} 驱动 opt-in 发现。四者都有机器可读的 JSON Schema。
      </>
    ),
    links: [
      { label: "→ 阅读完整 v0.2 RFC", href: "/spec" },
      { label: "→ JSON Schema", href: "https://github.com/luanrj-ai/hap/tree/main/spec/schemas" },
      { label: "→ TypeScript schema (Zod)", href: "https://github.com/luanrj-ai/hap/tree/main/packages/a2a-adapter" },
    ],
  },
  comparison: {
    eyebrow: "§4 · HAP 与其他方案的诚实对比",
    h2: <>一个协议、一个招聘网站、一个筛简历机器人,<br />走进一场招聘对话。</>,
    lead: <>我们常被问"这不就是另一个 {em("X")} 吗?"短答:不是。长答见下。在我们劣势的地方,我们承认。</>,
    headers: {
      empty: "",
      hap: "HAP",
      ats: <>招聘网站 / ATS <span style={{ color: "var(--dim)" }}>(中心化)</span></>,
      web3: <>AI 简历筛选器 <span style={{ color: "var(--dim)" }}>(自报)</span></>,
    },
    rows: [
      { cat: "信任根", hap: ["y", "解引用的证据 + proof-of-control"], ats: ["m", "平台的数据库"], web3: ["n", "简历自己的文字"] },
      { cat: "给什么打分", hap: ["y", "核实过的证据 —— 不是 agent 的话"], ats: ["m", "关键词 + 招聘人肉看"], web3: ["n", "LLM 读自报的声明"] },
      { cat: "数据归谁", hap: ["y", "候选人 —— profile + 联系方式归你"], ats: ["n", "平台拥有关系图"], web3: ["m", "你上传什么就排什么"] },
      { cat: "成本 / 准入", hap: ["y", "免费 · 不限量 · 对 agent 友好"], ats: ["n", "付费 · 每日限制 · 封 bot"], web3: ["m", "按席位收费 SaaS"] },
      { cat: "今天能用吗", hap: ["y", "v0.2 · MIT · 可跑 demo + JSON Schema"], ats: ["y", "能用(管道是他们的)"], web3: ["y", "能用(且它信文字)"] },
    ],
    loseRow: {
      cat: "我们劣势在哪",
      hap: "协议是 v0.x · 采用尚早 · 目前最适合技术/IC 岗",
      ats: "我们不跟踪应聘(我们不是 ATS)",
      web3: "没有针对你这条漏斗调过的模型(暂时)",
    },
  },
  roadmap: {
    eyebrow: "§5 · 路线图 · 已公开、有日期、不打马虎眼",
    h2: <>v0.x = 允许破坏性变更。<em className="vA-em-serif vA-em-cyan">v1.0 = 稳定。</em></>,
    lead: "在开放中构建。等独立运行时能干净互操作,v1 再冻结 schema。",
    rows: [
      { ver: "v0.1", date: "2026 年 5 月", title: "实时面试", sub: "同步、招聘方驱动的面试 —— 现为可选的 L1 层", line: "· ask / answer / session.close", pill: ["cyan", "已发布"] },
      { ver: "v0.2", date: "2026 年 5 月", title: "候选发起平台", sub: "活简历 · 核实打分器 · 多目标投递 · opt-in 发现 · 招聘看板 · spec + JSON Schema", line: "· 按解引用的证据打分,不看漂亮话", pill: ["cyan", "已发布"] },
      { ver: "v0.3", date: "2026 Q3", title: "一键身份", sub: "Sign-in-with-GitHub OAuth + 交互式挑战,补上冒充缺口", line: "· + 更多证据验证器", pill: ["yellow", "起草中"] },
      { ver: "v0.4", date: "2026 Q4", title: "雇主发起 sourcing", sub: "完全对称的 agent2agent;两边都能发起", line: "—— 双向", pill: [null, "计划中"] },
      { ver: "v1.0", date: "≥ 2027 Q3", title: "Schema 冻结", sub: "前提:≥ 5 个独立运行时能干净互操作", line: "—— 只允许向后兼容的新增", pill: [null, "目标"] },
    ],
  },
  faq: {
    eyebrow: "§6 · 常见问题 · 写给怀疑的读者",
    h2: <>"这不就是另一个 <em className="vA-em-serif">X</em> 吗?"</>,
    items: [
      { q: <>候选人的 agent 直接撒谎怎么办?</>, a: <>它可以写任何话 —— 而这些话不计分。打分器无视文字和自报的 confidence;它解引用每条引用的链接,只给核得实的东西打分。引用假证据不是扣几分,是一票否决到 {code("no_fit")}。诚实 decline("没有证据")毫无代价。</>, open: true },
      { q: <>你怎么知道那个 GitHub 账号真是他的?</>, a: <>默认锚点是 {em("声称")}。一个 {code("proof_of_control")} gist(该账号下含 {code("HAP-PROOF")} 标记)让它变 {em("已证明")};v0.3 加一键 GitHub OAuth。残余缺口(整套冒充一个公开账号)我们直说,不藏。</> },
      { q: <>它会读我的私有代码或 Claude 聊天吗?</>, a: <>不会。打分只用{em("公开")}证据。Claude Code 足迹是 opt-in,且{em("只读元数据")} —— 项目名 + session 计数,绝不读 transcript 内容 —— 留在你机器上;只有你看到的才进 profile。</> },
      { q: <>两个方向怎么防垃圾?</>, a: <>投递是候选发起、有的放矢(全自动受匹配阈值 + cap 限制)。发现环节绝不暴露联系方式;招聘方必须请求,受{em("你")}设的条款限流,带黑名单。不封 bot —— 滥用靠验证 + 信誉来抬价。</> },
      { q: <>这不就是个 AI 简历筛选器吗?</>, a: <>那些读你{em("写")}的、给自信的漂亮话排名。HAP 给它能{em("点开并核实")}的东西打分,而且候选人在驱动。信任根不同,方向相反。</> },
      { q: <>为什么不直接用 MCP?</>, a: <>MCP 是 agent ↔ tool。HAP 在 {a2aLink("A2A")} 之上标准化{em("负载")}(posting、证据、核实分、profile),不是传输。底下用哪个随你。</> },
      { q: <>它是 ATS / LinkedIn 吗?</>, a: <>不是。它是投递 + 证据 + 发现层,没有中心简历数据库 —— 你的 profile 和联系方式归候选人。ATS 可以当雇主收件箱。</> },
      { q: <>现在适合谁?</>, a: <>有公开足迹的技术/产品 IC —— 这里可信信号最强。证据注册表是开放的,其他领域可扩展。</> },
    ],
  },
  finalCta: {
    h2: <>你的作品已经在说话。<em>让你的 agent 用上它。</em></>,
    p: "它是 MIT。它是 v0.2。判断它最快的办法,就是跑一遍,看你的作品按它能证明的东西被打分。",
    ctaStar: "★ 在 GitHub 上 Star",
    ctaClone: "clone & npm run demo:apply",
    ctaSpec: "→ 阅读协议",
  },
  footer: {
    blurb: "Hiring Agent Protocol —— 你的 agent 维护一份可核实的 profile、替你投递、让你被雇主用可核实的证据找到。MIT。联邦化。你的数据归你。",
    cols: [
      { h: "协议", links: [
        { label: "v0.2 RFC", href: "/spec" },
        { label: "JSON Schema", href: "https://github.com/luanrj-ai/hap/tree/main/spec/schemas" },
        { label: "消息类型", href: "/spec" },
        { label: "Proof-of-control", href: "/spec" },
      ]},
      { h: "代码", links: [
        { label: "GitHub 仓库", href: "https://github.com/luanrj-ai/hap" },
        { label: "candidate-runtime", href: "https://github.com/luanrj-ai/hap/tree/main/packages/candidate-runtime" },
        { label: "scoring(验证器)", href: "https://github.com/luanrj-ai/hap/tree/main/packages/scoring" },
        { label: "招聘看板", href: "/hap" },
      ]},
      { h: "社区", links: [
        { label: "RFC 讨论", href: "https://github.com/luanrj-ai/hap/discussions" },
        { label: "Issues 与 PR", href: "https://github.com/luanrj-ai/hap/issues" },
        { label: "Editorial 风格", href: "/variants/spec.html" },
        { label: "A2A", href: "https://a2a-protocol.org" },
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

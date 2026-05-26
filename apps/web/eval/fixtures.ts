/**
 * Eval fixtures. 30 hand-crafted real-style resumes + AI resumes (loaded from data/ai/).
 * Each resume has expected-fit labels against each JD in JOBS.
 */
export type FitBand = "HIGH" | "MED" | "LOW";

export const JOBS = {
  paymentsBackend: {
    key: "paymentsBackend",
    label: "Senior Backend · Payments",
    description: `Senior Backend Engineer — Payment Infrastructure

About the role:
- Design and operate high-throughput payment APIs (>10K RPS sustained)
- Deep ownership of idempotency, retries, distributed transactions
- 5+ years backend experience required
- Strong Go or Rust skills preferred
- Fintech / payments domain experience strongly preferred
- Track record of shipping reliability improvements (latency, error rate)
- Comfortable with on-call for tier-1 services

Nice to have:
- Open source contributions
- Experience scaling teams or mentoring
- Public talks or technical writing`,
  },
  seniorFrontend: {
    key: "seniorFrontend",
    label: "Senior Frontend Engineer",
    description: `Senior Frontend Engineer — Consumer Web

About the role:
- 5+ years building production React/TypeScript applications
- Owner-level experience with design systems, component libraries
- Performance work: bundle size, TTI, animation frame budgets
- Real ownership of a consumer-facing surface (millions of users)
- A11y / web standards literate
- Comfortable collaborating with designers (Figma fluency)

Nice to have:
- Experience with React Server Components, Next.js App Router
- Visualization / canvas / WebGL rendering experience
- Public talks at frontend conferences`,
  },
  dataEngineer: {
    key: "dataEngineer",
    label: "Senior Data Engineer / ML Platform",
    description: `Senior Data / ML Platform Engineer

About the role:
- 5+ years building petabyte-scale data pipelines (Spark / Flink / Kafka)
- Owner-level experience with feature stores, real-time pipelines
- Strong Python or Scala; comfortable with SQL at scale
- Working with ML / recsys teams, productionizing models
- Familiar with feature freshness, training-serving skew, drift

Nice to have:
- Recommendation system or ranking experience
- Open-source data infra contributions
- Stream processing experience at scale`,
  },
} as const;

export type JobKey = keyof typeof JOBS;

export const ALL_JOBS = Object.values(JOBS) as Array<(typeof JOBS)[JobKey]>;

/** Legacy single-JD export for back-compat with original run.ts. */
export const EVAL_JD = JOBS.paymentsBackend.description;

export interface EvalResume {
  id: string;
  source: "real" | "ai";
  /** For AI fixtures, which difficulty tier (loaded from filename prefix). */
  aiTier?: "naive" | "coached" | "adversarial";
  /** Expected fit band per JD. */
  expectedFit: Record<JobKey, FitBand>;
  /** Ground truth for ai-text signal. */
  expectedIsAi: boolean;
  resumeText: string;
}

/** Helper: payments-domain candidate → HIGH/LOW/LOW. */
const FIT_PAYMENTS_HIGH = {
  paymentsBackend: "HIGH",
  seniorFrontend: "LOW",
  dataEngineer: "LOW",
} as const;
/** Non-payments senior backend → MED/LOW/LOW. */
const FIT_BACKEND_MED = {
  paymentsBackend: "MED",
  seniorFrontend: "LOW",
  dataEngineer: "LOW",
} as const;
/** Senior frontend → LOW/HIGH/LOW. */
const FIT_FE_HIGH = {
  paymentsBackend: "LOW",
  seniorFrontend: "HIGH",
  dataEngineer: "LOW",
} as const;
/** Data / ML senior → MED/LOW/HIGH. */
const FIT_DATA_HIGH = {
  paymentsBackend: "MED",
  seniorFrontend: "LOW",
  dataEngineer: "HIGH",
} as const;

const REAL: EvalResume[] = [
  // ============================================================
  // PAYMENTS BACKEND HIGH-FIT (n=8)
  // ============================================================
  {
    id: "real-pay-01-stripe-senior",
    source: "real",
    expectedFit: FIT_PAYMENTS_HIGH,
    expectedIsAi: false,
    resumeText: `Alex Chen — Senior Backend Engineer
github.com/alex-chen | alex-chen.dev | linkedin.com/in/alexchen

Stripe — Senior Backend Engineer (Jan 2022 — Present)
- Led migration of payment routing service from Ruby to Go, cutting p99 from 340ms to 110ms across 18M daily requests
- Designed idempotency key system used by 2,400+ merchants; reduced double-charge incidents by 94%
- On-call rotation for payment routing tier-1 service for 3 years
- Mentored 3 junior engineers, two promoted to L4 within 12 months

Notion — Backend Engineer (Mar 2019 — Dec 2021)
- Built real-time collab editing backend supporting 850k concurrent users at peak
- Authored operational transforms internal RFC adopted across 4 product teams

Open Source: ratelimit-go (1.2k stars), pgbouncer-helm (480 stars)
Talk: GopherCon 2024 — "Designing Idempotent Payment APIs"
Carnegie Mellon University, BS Computer Science (2012–2016)`,
  },
  {
    id: "real-pay-02-paypal-staff",
    source: "real",
    expectedFit: FIT_PAYMENTS_HIGH,
    expectedIsAi: false,
    resumeText: `Priya Iyer — Staff Backend Engineer
Mountain View, CA | github.com/piyer | piyer.io

PayPal — Staff Engineer, Money Movement (Apr 2020 — Present)
- Tech lead for 11-person team owning cross-border settlement APIs ($14B annual flow)
- Designed two-phase commit fallback for distributed FX trades; cut settlement disputes by 38%
- Drove migration of legacy Java services to Go for 4 highest-RPS endpoints (~22k RPS sustained)
- Authored company-wide idempotency SDK used by 200+ services

Square (Cash App) — Senior Backend Engineer (Jul 2017 — Mar 2020)
- Built P2P transfer rate limiting; prevented $4M/yr in detected abuse
- Led on-call ergonomics revamp (runbook automation, alert dedup)

BITS Pilani, BE Computer Science (2010–2014)
Open source: pq-retry (Go, 320 stars)`,
  },
  {
    id: "real-pay-03-block-senior",
    source: "real",
    expectedFit: FIT_PAYMENTS_HIGH,
    expectedIsAi: false,
    resumeText: `Marcus Weber — Senior Software Engineer
Berlin, Germany | github.com/mweber

Block (Cash App) — Senior Backend Engineer (Sept 2021 — Present)
- Owner of merchant payouts service: 8M daily transactions, 99.97% SLA
- Wrote Kafka-based exactly-once pipeline replacing flaky cron job; cut reconciliation tickets by 70%
- Co-led migration of two services from Ruby to Rust for hot-path latency

Adyen — Backend Engineer (2018 — 2021)
- Worked on tokenization service handling 5K RPS sustained
- Implemented PCI-DSS scope reduction project

TU München, MSc Informatik (2016)
Speaker at QCon Berlin 2023 on distributed payment idempotency`,
  },
  {
    id: "real-pay-04-revolut-senior",
    source: "real",
    expectedFit: FIT_PAYMENTS_HIGH,
    expectedIsAi: false,
    resumeText: `Sophie Laurent — Senior Backend Engineer
London | github.com/sophie-l

Revolut — Senior Backend Engineer, Core Banking (May 2022 — Present)
- Owner of internal ledger service (double-entry, 6M txns/day, sub-50ms p99)
- Designed retry-safe wallet operations; eliminated a class of duplicate-credit bugs (~$120k/yr saved)
- 4 years Go in production, regular on-call

Klarna — Software Engineer (Aug 2019 — Apr 2022)
- BNPL underwriting backend, ML feature pipeline

École Polytechnique, MSc CS (2017)`,
  },
  {
    id: "real-pay-05-ant-group-senior",
    source: "real",
    expectedFit: FIT_PAYMENTS_HIGH,
    expectedIsAi: false,
    resumeText: `Liang Wei (梁威) — Senior Backend Engineer
Hangzhou, China | github.com/liangwei-cn

Ant Group (Alipay) — Senior Backend Engineer, Trading Platform (Mar 2020 — Present)
- Core engineer of Alipay merchant transaction processing (50M+ daily transactions in peak Singles Day)
- Built deduplication service using Redis+Lua, handled 400K QPS during 11.11 promotion
- Java to Go migration of risk scoring module, reduced GC pauses 80%
- 5 years on-call experience for tier-0 services

JD.com — Backend Engineer (2017 — 2020)
- Worked on order placement service, optimized peak handling capacity

Zhejiang University, Master in Software Engineering (2015)`,
  },
  {
    id: "real-pay-06-nubank-senior",
    source: "real",
    expectedFit: FIT_PAYMENTS_HIGH,
    expectedIsAi: false,
    resumeText: `João Silva — Senior Backend Engineer
São Paulo | github.com/joaosilva-dev

Nubank — Senior Backend Engineer, Payments Core (Feb 2021 — Present)
- Tech lead for instant payments (Brazil Pix integration): 80M txn/day at peak
- Designed compensation logic for partial failures in fan-out transfers
- Clojure + Datomic stack, also some Go for high-throughput edge services
- Authored "Pix fraud signatures" feature, reduced fraud loss 22% in first quarter

Stone Co. — Software Engineer (2018 — 2021)
- Acquiring backend, settlement reconciliation

USP, BS Computer Science (2017)
Public talk: BrazilJS 2024 — "Building Pix at 80M tx/day"`,
  },
  {
    id: "real-pay-07-tencent-wechatpay",
    source: "real",
    expectedFit: FIT_PAYMENTS_HIGH,
    expectedIsAi: false,
    resumeText: `Chen Mei (陈梅) — Senior Backend Engineer
Shenzhen, China | github.com/chenmei

Tencent WeChat Pay — Senior Backend Engineer (Aug 2019 — Present)
- Member of red packet team, handle 1.5B red packets in 10 min during Chinese New Year
- Designed sharded counter service for popular red packets (10K writes/sec/key)
- Co-author of internal RPC library used by 50+ services
- C++ and Go, on-call for red packet service tier-0

Baidu — Software Engineer (2016 — 2019)
- Search ranking infra

Tsinghua University, BS CS (2016)
Note: my English writing is less formal, but I have detailed technical materials and references in Chinese available upon request.`,
  },
  {
    id: "real-pay-08-razorpay-senior",
    source: "real",
    expectedFit: FIT_PAYMENTS_HIGH,
    expectedIsAi: false,
    resumeText: `Aarav Sharma — Senior Software Engineer
Bangalore, India | github.com/aaravs | aaravsharma.in

Razorpay — Senior Backend Engineer (Jun 2021 — Present)
- Built reconciliation engine processing 20M txns/day between banks/PSPs and merchants
- Reduced settlement breaks by 65% via early matching algorithm
- Go + Postgres + Kafka, 3 years on-call rotation
- Authored UPI webhook retry library used across 4 products internally

Paytm — Software Engineer (2018 — 2021)
- Payments gateway, OTP service
- Migrated 3 hot-path services from Node.js to Go

IIT Roorkee, B.Tech CS (2018)`,
  },

  // ============================================================
  // NON-PAYMENTS SENIOR BACKEND (n=5)
  // ============================================================
  {
    id: "real-be-01-notion-senior",
    source: "real",
    expectedFit: FIT_BACKEND_MED,
    expectedIsAi: false,
    resumeText: `Diego Romero — Senior Backend Engineer
San Francisco | github.com/dromero

Notion — Senior Backend Engineer (Feb 2021 — Present)
- Tech lead for sync service: bidirectional sync for 35M users
- Designed conflict resolution algo handling 14B events/month
- Reduced cold-start latency for collab sessions from 1.8s to 320ms

Twitch — Backend Engineer (2017 — 2021)
- Live chat infrastructure (Go, Cassandra) for 2.5M concurrent users
- Wrote internal RPC framework still in use across 30+ services

UT Austin, BS CS (2017)
Open source: sync-merge (Go, 180 stars)`,
  },
  {
    id: "real-be-02-linear-senior",
    source: "real",
    expectedFit: FIT_BACKEND_MED,
    expectedIsAi: false,
    resumeText: `Hiroshi Tanaka — Senior Backend Engineer
Remote (Tokyo) | github.com/htanaka

Linear — Senior Backend Engineer (Aug 2022 — Present)
- Real-time sync engine maintainer (Postgres LISTEN/NOTIFY + custom diff format)
- Cut server-side merge conflicts by 60% via lock-free CRDT redesign
- Go since 2018, also strong TypeScript

Mercari — Backend Engineer (2019 — 2022)
- Search ranking service, Elasticsearch + Go gRPC API

Keio University, BE CS (2018)`,
  },
  {
    id: "real-be-03-figma-senior",
    source: "real",
    expectedFit: FIT_BACKEND_MED,
    expectedIsAi: false,
    resumeText: `Olivia Park — Senior Backend Engineer
NYC | github.com/oliviapark

Figma — Senior Backend Engineer, Multiplayer (Oct 2020 — Present)
- Multiplayer state-sync service: 4M+ concurrent edit sessions
- Designed presence service, p99 <80ms across 7 regions
- Mostly Rust + TypeScript, some Go

Dropbox — Software Engineer (2016 — 2020)
- File-sync engine, content delivery, on-call for tier-1

Stanford BS CS (2016)`,
  },
  {
    id: "real-be-04-vercel-senior",
    source: "real",
    expectedFit: FIT_BACKEND_MED,
    expectedIsAi: false,
    resumeText: `Tom Reilly — Senior Software Engineer
Dublin | github.com/treilly

Vercel — Senior Software Engineer (Apr 2022 — Present)
- Edge runtime team: V8 isolate pool, 200+ regions
- Cut cold-start p99 from 240ms to 35ms via warm-pool redesign
- TypeScript, Rust, some Go

Cloudflare — Software Engineer (2018 — 2022)
- Workers KV consistency improvements
- Authored internal Rust serde derive crate adopted by 12 teams

Trinity College Dublin, MSc CS (2018)`,
  },
  {
    id: "real-be-05-datadog-sre",
    source: "real",
    expectedFit: FIT_BACKEND_MED,
    expectedIsAi: false,
    resumeText: `Yusuf Khan — Senior Site Reliability Engineer
New York | github.com/ykhan-sre

Datadog — Senior SRE, Ingestion Platform (Jan 2022 — Present)
- On-call for tier-0 metrics intake: 18M time series/sec sustained
- Designed graceful-degradation tier for ingestion under DDoS; survived 3 real attacks with zero data loss
- Go + Kafka + Cassandra; some Rust

Etsy — SRE (2018 — 2022)
- Migrated search backend from Solr to Elasticsearch (~6M searches/day)
- Authored chaos-engineering library used company-wide

NYU, BS CS (2017)
SREcon EMEA 2023 speaker — "Ingestion under attack"`,
  },

  // ============================================================
  // SENIOR FRONTEND (n=6)
  // ============================================================
  {
    id: "real-fe-01-wix-senior",
    source: "real",
    expectedFit: FIT_FE_HIGH,
    expectedIsAi: false,
    resumeText: `Maya Goldberg — Senior Frontend Engineer
Tel Aviv | github.com/mgoldberg

Wix — Senior Frontend Engineer (Mar 2021 — Present)
- Editor performance: cut TTI by 1.4s on the page builder
- React, TypeScript, WebGL canvas rendering
- Led design system migration affecting 200+ components

Monday.com — Frontend Engineer (2018 — 2021)
- Drag-and-drop board UX, accessibility (a11y) compliance

Technion, BSc CS (2018)
Talk: ReactNext 2023 — "Animating 10k DOM nodes at 60fps"`,
  },
  {
    id: "real-fe-02-cashapp-fe",
    source: "real",
    expectedFit: FIT_FE_HIGH,
    expectedIsAi: false,
    resumeText: `Akira Mori (森 章) — Senior Frontend Engineer
Tokyo | github.com/akmori

Cash App — Senior Frontend Engineer, P2P (Jul 2021 — Present)
- Owner of money-send UI, ships to 50M+ users
- Cut LCP from 2.4s to 0.9s on the send-money flow via Suspense + RSC
- React, TypeScript, some Swift (cross-team)

LINE Corp — Frontend Engineer (2018 — 2021)
- Sticker shop UX (40M MAU); A/B framework adopted org-wide

UTokyo, BE CS (2017)
Note: native Japanese, fluent English`,
  },
  {
    id: "real-fe-03-airbnb-senior",
    source: "real",
    expectedFit: FIT_FE_HIGH,
    expectedIsAi: false,
    resumeText: `Hannah Chen — Senior Frontend Engineer
San Francisco | hannah.dev | github.com/hannahchen

Airbnb — Senior Frontend Engineer, Booking Flow (Sept 2020 — Present)
- Owner of the booking confirmation flow (90M bookings/yr touch this code)
- Migrated from class components to hooks across 300+ files; led RFC
- React, TypeScript, deep a11y work (WCAG AA across 11 locales)

Pinterest — Frontend Engineer (2017 — 2020)
- Search results page performance team
- Component library maintainer (300+ components, 100+ contributors)

Brown University, BS CS (2017)`,
  },
  {
    id: "real-fe-04-sap-fe",
    source: "real",
    expectedFit: FIT_FE_HIGH,
    expectedIsAi: false,
    resumeText: `Lukas Müller — Senior Frontend Engineer
Walldorf, Germany | github.com/lukasm

SAP — Senior Frontend Engineer, S/4HANA (Mar 2020 — Present)
- Owner of UI5 → React migration tooling: enabled 80+ teams to migrate enterprise apps
- Reduced bundle size on key flows from 4.2MB to 980KB
- TypeScript, React, micro-frontends (Module Federation)

Deutsche Bahn (DB) — Software Engineer (2017 — 2020)
- Ticketing site frontend; massive a11y compliance project for DBSV mandate

KIT Karlsruhe, MSc Informatik (2017)`,
  },
  {
    id: "real-fe-05-spotify-fe",
    source: "real",
    expectedFit: FIT_FE_HIGH,
    expectedIsAi: false,
    resumeText: `Sara Okafor — Senior Frontend Engineer
Stockholm | github.com/sara-o | sara-okafor.dev

Spotify — Senior Frontend Engineer, Web Player (Apr 2021 — Present)
- Cut playback start latency p99 from 1.8s to 410ms via prefetch + worker streaming
- React + TypeScript + Web Audio API
- Authored internal a11y testing framework, blocks PRs that regress WCAG

BBC — Frontend Engineer (2018 — 2021)
- iPlayer web app, Edge optimization, video player UX

KCL London, BSc CS (2017)
Talk: ViewSource 2024 — "Streaming the player shell"`,
  },
  {
    id: "real-fe-06-tiktok-fe",
    source: "real",
    expectedFit: FIT_FE_HIGH,
    expectedIsAi: false,
    resumeText: `Wei Zhang (张伟) — Senior Frontend Engineer
Singapore | github.com/wzhang-fe

TikTok — Senior Frontend Engineer, Creator Studio (Aug 2021 — Present)
- Owner of video upload + edit web flow (5M+ daily uploads via web)
- Built WASM video preview pipeline (FFmpeg + AVIF thumbnails)
- React, TypeScript, Rust for WASM modules

Alibaba — Frontend Engineer (2018 — 2021)
- DingTalk video conferencing web client
- Helped open-source Rax (React-like for mobile web)

Fudan University, BS CS (2018)`,
  },

  // ============================================================
  // DATA / ML SENIOR (n=5)
  // ============================================================
  {
    id: "real-data-01-bytedance-data",
    source: "real",
    expectedFit: FIT_DATA_HIGH,
    expectedIsAi: false,
    resumeText: `Wang Lei (王磊) — Senior Data Engineer
Shanghai | github.com/wleidata

ByteDance — Senior Data Engineer, Recommendation (Jun 2021 — Present)
- Owner of feature pipeline for TikTok video recsys (Flink, Spark, Hadoop)
- Cut feature freshness lag from 4h to 18min
- Python, Scala, some Java

Meituan — Data Engineer (2018 — 2021)
- Real-time order ingestion pipeline (Kafka + ClickHouse)

Shanghai Jiao Tong University, MS Data Science (2018)`,
  },
  {
    id: "real-data-02-spotify-ml",
    source: "real",
    expectedFit: FIT_DATA_HIGH,
    expectedIsAi: false,
    resumeText: `Ahmed Hassan — Senior ML Engineer
London | github.com/ahmedh | ahmedh.dev

Spotify — Senior ML Engineer, Discovery (Sept 2020 — Present)
- Owner of Daily Mix candidate generation pipeline (Flink, 500M users)
- Designed online A/B with shadow ranker; cut model deploy cycle from 14 days to 2
- Python + Scala; some Rust (vector index hot path)

DeepMind — Research Engineer (2017 — 2020)
- Distributed training infra for protein folding work
- Co-author on 2 publications (NeurIPS, ICML)

Oxford, DPhil Comp Sci (2017)`,
  },
  {
    id: "real-data-03-mercadolibre-ml",
    source: "real",
    expectedFit: FIT_DATA_HIGH,
    expectedIsAi: false,
    resumeText: `Sofía García — Senior ML Engineer
Buenos Aires | github.com/sgarcia-ml

Mercado Libre — Senior ML Engineer, Fraud (Mar 2021 — Present)
- Owner of transaction-fraud model (XGBoost + GBDT ensemble; serves 60M txn/day)
- Cut FP rate by 31% via feature-store rebuild + online learning loop
- Python, Spark, some Go for serving layer

Globant — ML Engineer (2018 — 2021)
- Customer-churn models for telco client, MLOps platform work

UBA, MSc Data Mining (2018)`,
  },
  {
    id: "real-data-04-uber-ml",
    source: "real",
    expectedFit: FIT_DATA_HIGH,
    expectedIsAi: false,
    resumeText: `Ravi Patel — Staff ML Engineer
San Jose | github.com/rpatel-ml

Uber — Staff ML Engineer, Marketplace (Oct 2019 — Present)
- Tech lead for surge pricing model (75M trips/wk routed)
- Drove migration of training infra to Ray (cut iter time from 3h to 22min)
- Python, Go, deep familiarity with Michelangelo internals

LinkedIn — Sr ML Engineer (2016 — 2019)
- Feed ranking models, online learning infra
- Authored open-source feature serving library: 4.1k stars

UMich Ann Arbor, PhD CS (Information Retrieval, 2016)`,
  },
  {
    id: "real-data-05-recruit-ml",
    source: "real",
    expectedFit: FIT_DATA_HIGH,
    expectedIsAi: false,
    resumeText: `Yuki Sato (佐藤 由紀) — Senior ML Engineer
Tokyo | github.com/yukisato

Recruit Holdings — Senior ML Engineer, Indeed Search Quality (Apr 2021 — Present)
- Owner of job-search ranking model (200M queries/day, JP+EN+US markets)
- Cut click-through-rate regressions across 3 markets via multi-task learning
- Python, Scala, some C++ for inference path

Mercari — ML Engineer (2018 — 2021)
- Product photo classification, dynamic pricing

Kyoto University, MSc CS (2018)
Note: my writing in English is sometimes formal/stiff but my technical work is well documented in JP and EN.`,
  },

  // ============================================================
  // LOW-FIT / OUTLIER (n=6)
  // ============================================================
  {
    id: "real-low-01-monzo-designer",
    source: "real",
    expectedFit: { paymentsBackend: "LOW", seniorFrontend: "LOW", dataEngineer: "LOW" },
    expectedIsAi: false,
    resumeText: `Emily Watson — Senior Product Designer
London | dribbble.com/ewatson | emilywatson.design

Monzo — Senior Product Designer (Jul 2021 — Present)
- Led design for joint accounts feature (1.2M users adopted in 6 months)
- Owner of design system, 80+ components, Figma libraries
- Run weekly user research sessions

Bumble — Product Designer (2018 — 2021)
- Match flow redesign; +18% match rate

Glasgow School of Art, MDes (2018)`,
  },
  {
    id: "real-low-02-coupang-junior",
    source: "real",
    expectedFit: { paymentsBackend: "LOW", seniorFrontend: "LOW", dataEngineer: "LOW" },
    expectedIsAi: false,
    resumeText: `Kevin Park — Junior Backend Engineer
Seoul | github.com/kpark99

Coupang — Junior Backend Engineer (Mar 2024 — Present)
- Java Spring Boot services for fulfillment center inventory
- Wrote 6 internal REST endpoints; on-call shadow for tier-2 services

Internship — Naver Pay (Summer 2023)
- Wrote a tool to deduplicate transaction logs (Python)
- 3 months only

SNU, BS CSE (2024)`,
  },
  {
    id: "real-low-03-cloudflare-sec",
    source: "real",
    expectedFit: { paymentsBackend: "MED", seniorFrontend: "LOW", dataEngineer: "LOW" },
    expectedIsAi: false,
    resumeText: `David Cohen — Senior Security Engineer
Tel Aviv | github.com/dcohen-sec | research notes at dcohen.security

Cloudflare — Senior Security Engineer, Product Security (May 2021 — Present)
- Led design review for Workers + R2 platform
- Found and shipped fix for 4 high-severity bugs in queue infra
- Go, Rust (audit), some TypeScript

Check Point Research — Researcher (2017 — 2021)
- Published CVE-2019-1xxxx, CVE-2020-2xxxx
- Reverse-engineered 6 banking trojan families

Bar-Ilan, BSc CS (2017)
Black Hat USA 2022 speaker — "Trust boundaries in V8 isolate platforms"`,
  },
  {
    id: "real-low-04-career-change-fe",
    source: "real",
    expectedFit: { paymentsBackend: "LOW", seniorFrontend: "MED", dataEngineer: "LOW" },
    expectedIsAi: false,
    resumeText: `Anna Kowalska — Frontend Engineer (career switcher)
Warsaw | github.com/akowalska | annak.design (old portfolio)

Allegro — Frontend Engineer (Jun 2023 — Present)
- Built 4 features on the seller dashboard (React + TypeScript)
- Pair-program with senior on accessibility audits
- 14 months since transition from design

Allegro — Product Designer (2019 — 2023, internal transfer to engineering)
- Designed checkout funnel; redesign drove +6% conversion
- Self-taught React, completed CS50 + 2 advanced courses

ASP Warsaw, BFA Graphic Design (2019)`,
  },
  {
    id: "real-low-05-github-devops",
    source: "real",
    expectedFit: { paymentsBackend: "MED", seniorFrontend: "LOW", dataEngineer: "LOW" },
    expectedIsAi: false,
    resumeText: `Brian O'Connor — Senior DevOps Engineer
Dublin | github.com/boconnor-ops

GitHub — Senior DevOps Engineer, Codespaces (Sept 2021 — Present)
- Owner of container scheduler for Codespaces (peak 80k concurrent dev environments)
- Cut p99 startup from 38s to 11s via warm-pool + image layer caching
- Go + Kubernetes; Bash where it really fits

HubSpot — DevOps Engineer (2018 — 2021)
- Kubernetes platform for 600+ engineers, internal IDP team
- Wrote in-house CD tool (later open-sourced as deployer-cli, 220 stars)

UCD, BSc CS (2018)`,
  },
  {
    id: "real-low-06-junior-fe",
    source: "real",
    expectedFit: { paymentsBackend: "LOW", seniorFrontend: "LOW", dataEngineer: "LOW" },
    expectedIsAi: false,
    resumeText: `Min-jun Lee — Junior Frontend Engineer
Seoul | github.com/minjunl

Toss — Junior Frontend Engineer (Sept 2024 — Present)
- Shipped 3 components for the savings product page
- Pair-programming pair with senior, on-call shadow

Intern — Naver Webtoon (Summer 2024)
- Comment widget A11y improvements
- 3 month internship

KAIST, BS CS (2024)`,
  },
];

/** Hand-written, synthetic real fixtures (n=30). Kept for back-compat / baseline. */
export const REAL_FIXTURES_SYNTHETIC = REAL;

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname_fx = dirname(fileURLToPath(import.meta.url));
const FETCHED_DIR = resolve(__dirname_fx, "data/real-fetched");

interface FetchedManifestEntry {
  username: string;
  primaryRole: "backend" | "frontend" | "data-ml" | "infra" | "general";
  source: "readme" | "synthesized-bio";
  charCount: number;
  filename: string;
  notes?: string;
}

const ROLE_FIT_DEFAULTS: Record<string, Record<JobKey, FitBand>> = {
  backend: { paymentsBackend: "MED", seniorFrontend: "LOW", dataEngineer: "LOW" },
  frontend: { paymentsBackend: "LOW", seniorFrontend: "HIGH", dataEngineer: "LOW" },
  "data-ml": { paymentsBackend: "MED", seniorFrontend: "LOW", dataEngineer: "HIGH" },
  infra: { paymentsBackend: "MED", seniorFrontend: "LOW", dataEngineer: "LOW" },
  general: { paymentsBackend: "LOW", seniorFrontend: "MED", dataEngineer: "LOW" },
};

/** Real-human-authored fixtures fetched from public GitHub Profile READMEs. */
export function loadFetchedRealFixtures(): EvalResume[] {
  const manifestPath = resolve(FETCHED_DIR, "manifest.json");
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    entries: FetchedManifestEntry[];
  };
  return manifest.entries.map((e) => ({
    id: `real-fetched-${e.username}`,
    source: "real" as const,
    expectedFit: ROLE_FIT_DEFAULTS[e.primaryRole] ?? ROLE_FIT_DEFAULTS.general,
    expectedIsAi: false,
    resumeText: readFileSync(resolve(FETCHED_DIR, e.filename), "utf8"),
  }));
}

const PDF_SAMPLED_DIR = resolve(__dirname_fx, "data/real-pdf-sampled");

interface PdfSampledEntry {
  fileId: string;
  bucket: "backend" | "frontend" | "data-ml" | "other";
  expectedFitHigh: JobKey;
  textLength: number;
  topSkills: string[];
  margin: number;
}

// Same evidence-based labeling logic as eval/recompute-eval.ts
// Keep these regexes in sync if you update one — applied at load time.
const PAY_HIGH_RX = /\b(payment|fintech|billing|banking|stripe|paypal|square|adyen|braintree|transaction processing|merchant|settlement|reconciliation|fraud detection|chargebac|currency|fx\b|forex|wallet)\b/i;
const PAY_BE_RX = /\b(senior backend|staff engineer|backend engineer|distributed|microservic|kafka|kubernetes|go(lang)?\b|rust\b|spring\b|node\.?js|grpc|api gateway)\b/i;
const FE_FW_RX = /\b(react|vue|svelte|angular|next\.?js|nuxt)\b/i;
const FE_SR_RX = /\b(senior|lead|principal|staff|7\+|6\+|5\+|10\+|8\+ years|frontend lead|ui lead)\b/i;
const FE_GEN_RX = /\b(front\s?end|javascript|typescript|html|css)\b/i;
const ML_HIGH_RX = /\b(machine learning|deep learning|tensorflow|pytorch|scikit-learn|sklearn|recommendation|ranking|feature store|model serving|mlops|data pipeline|spark|flink|kafka streams|feature engineering|nlp engineer|ml engineer)\b/i;
const DATA_GEN_RX = /\b(data science|data engineer|data analyst|sql|python|pandas|numpy|etl|big data)\b/i;
const NEG_BE_RX = /\b(media buyer|advertising|sales|marketing manager|consultant|hr\b|recruiter|teacher|nurse|accountant)\b/i;
const JR_RX = /\b(intern\b|trainee|fresher|junior\b|entry[\s-]level|new grad|recent graduate|assistant (software|developer|engineer|data)|graduate trainee)\b/i;

function evidenceBasedFit(text: string): Record<JobKey, FitBand> {
  const t = text.slice(0, 5000);
  const isJr = JR_RX.test(t);
  const pay: FitBand =
    PAY_HIGH_RX.test(t) && PAY_BE_RX.test(t) && !isJr ? "HIGH"
    : PAY_BE_RX.test(t) && !NEG_BE_RX.test(t) ? "MED" : "LOW";
  const fe: FitBand =
    FE_FW_RX.test(t) && FE_SR_RX.test(t) && !isJr ? "HIGH"
    : FE_FW_RX.test(t) || (FE_GEN_RX.test(t) && FE_SR_RX.test(t)) ? "MED" : "LOW";
  const dml: FitBand =
    ML_HIGH_RX.test(t) && !isJr ? "HIGH"
    : ML_HIGH_RX.test(t) || DATA_GEN_RX.test(t) ? "MED" : "LOW";
  return { paymentsBackend: pay, seniorFrontend: fe, dataEngineer: dml };
}

/** Real CV resumes sampled from HuggingFace Mehyaar/Annotated_NER_PDF_Resumes (MIT). */
export function loadRealPdfFixtures(): EvalResume[] {
  const manifestPath = resolve(PDF_SAMPLED_DIR, "manifest.json");
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    entries: PdfSampledEntry[];
  };
  return manifest.entries.map((e) => {
    const text = readFileSync(resolve(PDF_SAMPLED_DIR, `${e.fileId}.txt`), "utf8");
    return {
      id: `real-pdf-${e.fileId}`,
      source: "real" as const,
      expectedFit: evidenceBasedFit(text),
      expectedIsAi: false,
      resumeText: text,
    };
  });
}

/**
 * Active real-fixture set used by the eval runner.
 *   EVAL_REAL=synthetic   → 30 hand-written
 *   EVAL_REAL=fetched     → 19 GitHub Profile READMEs
 *   EVAL_REAL=pdf-sampled → 60 real CVs from HuggingFace dataset (DEFAULT)
 */
export const REAL_FIXTURES: EvalResume[] = (() => {
  const which = process.env.EVAL_REAL || "pdf-sampled";
  if (which === "synthetic") return REAL_FIXTURES_SYNTHETIC;
  if (which === "fetched") {
    const fetched = loadFetchedRealFixtures();
    if (fetched.length > 0) return fetched;
  }
  if (which === "pdf-sampled" || which === "default") {
    const pdf = loadRealPdfFixtures();
    if (pdf.length > 0) return pdf;
  }
  return REAL_FIXTURES_SYNTHETIC;
})();

export const REAL_COUNT = REAL_FIXTURES.length;

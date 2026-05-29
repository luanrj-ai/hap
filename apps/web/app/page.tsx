"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import "./hap-theme.css";
import "./hap-landing.css";
import { type Lang, EN, ZH, getContent } from "./landing-content";

declare global {
  interface Window {
    HAPTranscript?: {
      mount: (el: HTMLElement, opts?: { autoplay?: boolean; speed?: number; compact?: boolean }) => void;
    };
  }
}

// "See it run" — faithful: one application packet (evidence per requirement) →
// one score report. Two candidates: honest (FIT) and faker (NO_FIT). Not a chat.
type DemoEv = { type: string; url: string; verified: boolean };
type DemoItem = { req: string; required: boolean; evidence?: DemoEv[]; declined?: string };
type DemoCase = { who: string; verdict: "fit" | "no_fit"; overall: string; identity: string; application: DemoItem[]; score: string[]; flags: string[] };

const DEMO_CASES: DemoCase[] = [
  {
    who: "Alex Chen · proof-of-control ✓",
    verdict: "fit", overall: "0.85", identity: "proven",
    application: [
      { req: "multi-agent simulations end to end", required: true, evidence: [{ type: "github_repo", url: "github.com/alex-chen/abm-sim · 1.2k★", verified: true }] },
      { req: "ships production code", required: true, evidence: [{ type: "github_commit", url: "github.com/alex-chen/abm-sim/commit/9f4ac21", verified: true }] },
      { req: "world models / SWM", required: false, declined: "no_evidence (honest)" },
      { req: "agent / LLM product", required: false, evidence: [{ type: "github_repo", url: "github.com/alex-chen/eval-harness", verified: true }] },
    ],
    score: ["m1  verified · 1.00", "m2  verified · 1.00", "n1  declined · no_evidence — 0 penalty", "n2  verified · 1.00"],
    flags: ["✅ identity proven (@alex-chen)"],
  },
  {
    who: 'Sam Faker · self-assessed "strong"',
    verdict: "no_fit", overall: "0", identity: "asserted",
    application: [
      { req: "multi-agent simulations end to end", required: true, evidence: [{ type: "github_commit", url: "github.com/torvalds/linux/commit/000000…", verified: false }] },
      { req: "ships production code", required: true, evidence: [{ type: "github_repo", url: "github.com/sam-faker/app (unrelated)", verified: false }] },
    ],
    score: [],
    flags: ['🚩 fabrication: cited evidence does not exist', '🚩 overclaim: said "strong" · evidence: no_fit'],
  },
];

export default function HapLanding() {
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [lang, setLang] = useState<Lang>("en");
  const [scriptReady, setScriptReady] = useState(false);

  // restore saved theme + lang
  useEffect(() => {
    try {
      const savedT = localStorage.getItem("hap-theme");
      if (savedT === "light" || savedT === "dark") setTheme(savedT);

      const savedL = localStorage.getItem("hap-lang");
      if (savedL === "en" || savedL === "zh") {
        setLang(savedL);
      } else {
        // first-time detect from navigator
        const nav = navigator.language || "en";
        if (nav.toLowerCase().startsWith("zh")) setLang("zh");
      }
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("hap-theme", theme); } catch {}
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("lang", lang === "zh" ? "zh-CN" : "en");
    try { localStorage.setItem("hap-lang", lang); } catch {}
  }, [lang]);

  useEffect(() => {
    if (!scriptReady) return;
    const host = document.getElementById("hero-transcript");
    if (host && window.HAPTranscript) {
      host.innerHTML = "";
      window.HAPTranscript.mount(host, { autoplay: true });
    }
  }, [scriptReady]);

  // "See it run": reveal the application → score blocks with a light stagger.
  const [demoIn, setDemoIn] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDemoIn(true), 150);
    return () => clearTimeout(id);
  }, []);
  const reveal = (i: number) => ({
    opacity: demoIn ? 1 : 0,
    transform: demoIn ? "none" : "translateY(10px)",
    transition: `opacity .5s ease ${i * 0.12}s, transform .5s ease ${i * 0.12}s`,
  });

  useEffect(() => {
    function handler(this: HTMLElement, ev: Event) {
      const btn = ev.currentTarget as HTMLElement;
      const text = btn.getAttribute("data-copy");
      if (!text) return;
      navigator.clipboard?.writeText(text).then(() => {
        btn.setAttribute("data-copied", "1");
        if (btn.classList.contains("vA-qs__copy")) {
          const original = btn.textContent;
          btn.textContent = lang === "zh" ? "已复制 ✓" : "copied ✓";
          setTimeout(() => {
            btn.textContent = original;
            btn.removeAttribute("data-copied");
          }, 1400);
        } else {
          setTimeout(() => btn.removeAttribute("data-copied"), 1400);
        }
      }).catch(() => {});
    }
    const btns = document.querySelectorAll<HTMLElement>("[data-copy]");
    btns.forEach((b) => b.addEventListener("click", handler));
    return () => btns.forEach((b) => b.removeEventListener("click", handler));
  }, [lang]);

  const t = getContent(lang);

  return (
    <>
      <Script
        src="/variants/shared/transcript.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />

      {/* ============ NAV ============ */}
      <nav className="hap-nav">
        <div className="hap-wrap hap-nav__inner">
          <a className="hap-wordmark" href="/">
            <span className="hap-wordmark__h">hap</span>
            <span className="hap-wordmark__v">v0.2 · {lang === "zh" ? "草案" : "draft"}</span>
          </a>
          <div className="hap-nav__links">
            <a href="#spec">{t.nav.spec}</a>
            <a href="#quickstart">{t.nav.quickstart}</a>
            <a href="#roadmap">{t.nav.roadmap}</a>
            <a href="#faq">{t.nav.faq}</a>
          </div>
          <div className="hap-nav__spacer" />
          <div className="hap-nav__meta">
            <span className="hap-pill hap-pill--cyan">
              {t.nav.profileOf}{" "}
              <a
                href="https://a2a-protocol.org"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                A2A
              </a>
            </span>
            <span className="hap-pill">MIT</span>
            <button
              className="hap-btn hap-btn--ghost"
              onClick={() => setLang((l) => (l === "en" ? "zh" : "en"))}
              aria-label={t.nav.toggleLangAria}
              title={t.nav.toggleLangAria}
              style={{ fontSize: 12, padding: "8px 10px" }}
            >
              {lang === "en" ? ZH.langSwitchLabel : EN.langSwitchLabel}
            </button>
            <button
              className="hap-btn hap-btn--ghost"
              onClick={() => setTheme((th) => (th === "dark" ? "light" : "dark"))}
              aria-label={t.nav.toggleThemeAria}
              title={t.nav.toggleThemeAria}
            >
              <span>{theme === "light" ? "☀" : "◐"}</span>
            </button>
            <a
              className="hap-btn hap-btn--cyan"
              href="https://github.com/luanrj-ai/hap"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GithubIcon />
              github
            </a>
          </div>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section className="vA-hero">
        <div className="hap-wrap hap-wrap--wide">
          <div className="vA-hero__top">
            <div>
              <span className="vA-eyebrow">
                <b>$</b>
                <span>HAP · Hiring Agent Protocol</span>
                <span className="vA-eyebrow__sep">·</span>
                <span>{t.hero.eyebrowVer}</span>
              </span>

              <h1 className="vA-headline">{t.hero.headline}</h1>

              <p className="vA-sub">{t.hero.sub}</p>

              <div className="vA-ctas">
                <a
                  className="hap-btn hap-btn--primary"
                  href="https://github.com/luanrj-ai/hap"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <StarIcon />
                  {t.hero.ctaStar}
                </a>
                <button
                  className="hap-btn hap-btn--cyan"
                  data-copy="git clone https://github.com/luanrj-ai/hap && npm run demo:apply"
                >
                  <span style={{ color: "var(--accent)" }}>$</span>&nbsp;npm&nbsp;run&nbsp;demo:apply
                  <span style={{ color: "var(--dim)", marginLeft: 6, fontSize: 11 }}>⌘C</span>
                </button>
                <a className="hap-btn" href="#spec">
                  <span style={{ color: "var(--cyan)" }}>→</span>&nbsp;{t.hero.ctaSpec}
                </a>
              </div>

              <div className="vA-meta">
                <span><span className="hap-pill hap-pill--green hap-pill--dot" /> {t.hero.metaStable}</span>
                <span>{t.hero.metaImpls}</span>
                <span>{t.hero.metaA2A}</span>
                <span>{t.hero.metaBYO}</span>
              </div>
            </div>

            <div className="vA-hero__tx" id="hero-transcript" />
          </div>

          <div className="vA-anchors">
            {t.hero.anchors.map((a) => (
              <a key={a.kbd} className="vA-anchor" href={a.href}>
                <span className="vA-anchor__kbd">{a.kbd}</span>
                <span className="vA-anchor__h">{a.h}</span>
                <span className="vA-anchor__p">{a.p}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="hap-section">
        <div className="hap-wrap">
          <p className="hap-eyebrow">{t.howItWorks.eyebrow}</p>
          <h2 className="hap-h2">{t.howItWorks.h2}</h2>
          <p className="hap-lead">{t.howItWorks.lead}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginTop: 26 }}>
            {t.howItWorks.flows.map((flow) => (
              <div key={flow.title} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "22px 24px" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 600 }}>{flow.title}</h3>
                <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {flow.steps.map((s, i) => (
                    <li key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
                      <span style={{ flex: "0 0 24px", height: 24, borderRadius: "50%", border: "1px solid var(--accent)", color: "var(--accent)", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                      <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text)" }}>{s}</span>
                    </li>
                  ))}
                </ol>
                <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--cyan)" }}>↳ {flow.outcome}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ SEE IT RUN (demo) ============ */}
      <section id="demo" className="hap-section">
        <div className="hap-wrap">
          <p className="hap-eyebrow">{t.demo.eyebrow}</p>
          <h2 className="hap-h2">{t.demo.h2}</h2>
          <p className="hap-lead">{t.demo.lead}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 20, marginTop: 26 }}>
            {DEMO_CASES.map((c, ci) => (
              <div key={c.who}>
                <div style={{ ...reveal(ci * 2), border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                  <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>① one hap.application → renlab · {c.who}</div>
                  <div style={{ padding: "12px 16px", lineHeight: 1.65 }}>
                    {c.application.map((it, k) => (
                      <div key={k} style={{ marginBottom: 8 }}>
                        <div style={{ color: "var(--text)" }}>{it.required ? "REQ " : "nice"} · {it.req}</div>
                        {it.declined ? (
                          <div style={{ color: "var(--dim)", paddingLeft: 14 }}>— declined: {it.declined}</div>
                        ) : (
                          it.evidence!.map((e, j) => (
                            <div key={j} style={{ paddingLeft: 14, color: "var(--muted)" }}>
                              {e.type} {e.url} {e.verified ? <span style={{ color: "var(--green)" }}>✓ verified</span> : <span style={{ color: "var(--dim)" }}>· unverified</span>}
                            </div>
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: "center", color: "var(--dim)", fontFamily: "var(--font-mono)", fontSize: 12, margin: "6px 0" }}>↓ the scorer opens every link</div>
                <div style={{ ...reveal(ci * 2 + 1), border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                  <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>② one score report</div>
                  <div style={{ padding: "12px 16px", lineHeight: 1.7 }}>
                    <div style={{ fontWeight: 700, color: c.verdict === "fit" ? "var(--green)" : "var(--red)" }}>{c.verdict.toUpperCase()} · overall {c.overall} · identity {c.identity}</div>
                    {c.score.map((s, k) => <div key={k} style={{ color: "var(--text)" }}>{s}</div>)}
                    {c.flags.map((f, k) => <div key={k} style={{ color: f.startsWith("✅") ? "var(--green)" : "var(--yellow)" }}>{f}</div>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 18, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}><span style={{ color: "var(--accent)" }}>$</span> {t.demo.cmd} <span style={{ color: "var(--dim)" }}>— run it live</span></p>
        </div>
      </section>

      {/* ============ WHY ============ */}
      <section id="why" className="hap-section">
        <div className="hap-wrap">
          <p className="hap-eyebrow">{t.why.eyebrow}</p>
          <h2 className="hap-h2">{t.why.h2}</h2>
          <p className="hap-lead">{t.why.lead}</p>

          <div className="vA-why-grid">
            {t.why.pillars.map((p) => (
              <article key={p.num} className="vA-why">
                <span className="vA-why__num">{p.num}</span>
                <h3 className="vA-why__h">{p.h}</h3>
                <p className="vA-why__p">{p.p}</p>
                <span className="vA-why__sig">{p.sig}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ GET STARTED (Claude Code paste + manual, merged) ============ */}
      <section id="quickstart" className="hap-section">
        <div className="hap-wrap">
          <p className="hap-eyebrow">{t.install.eyebrow}</p>
          <h2 className="hap-h2">{t.install.h2}</h2>
          <p className="hap-lead">{t.install.lead}</p>

          {/* ① paste to Claude Code */}
          <div className="vA-qs" style={{ marginTop: 22 }}>
            <div className="vA-qs__bar">
              <div className="hap-tx__bar-dots">
                <div className="hap-tx__bar-dot hap-tx__bar-dot--r" />
                <div className="hap-tx__bar-dot hap-tx__bar-dot--y" />
                <div className="hap-tx__bar-dot hap-tx__bar-dot--g" />
              </div>
              <b>{t.install.ccLabel}</b>
              <button className="vA-qs__copy" data-copy={t.install.ccText} style={{ marginLeft: "auto" }}>{t.install.copyLabel}</button>
            </div>
            <div style={{ padding: "16px 18px", fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.7, color: "var(--text)", whiteSpace: "pre-wrap" }}>{t.install.ccText}</div>
          </div>

          {/* ② or run it yourself */}
          <p style={{ margin: "20px 0 10px", fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--dim)" }}>{lang === "zh" ? "── 或者,自己跑 ──" : "── or run it yourself ──"}</p>
          <div className="vA-qs">
            <div className="vA-qs__bar">
              <div className="hap-tx__bar-dots">
                <div className="hap-tx__bar-dot hap-tx__bar-dot--r" />
                <div className="hap-tx__bar-dot hap-tx__bar-dot--y" />
                <div className="hap-tx__bar-dot hap-tx__bar-dot--g" />
              </div>
              <b>{t.quickstart.barLabel}</b> <span style={{ color: "var(--dim)" }}>·</span> bash{" "}
              <span style={{ color: "var(--dim)", marginLeft: "auto", fontSize: 11 }}>{t.quickstart.barNode}</span>
            </div>
            <div className="vA-qs__steps">
              {t.quickstart.steps.map((s, i) => (
                <div key={i} className="vA-qs__step">
                  <span className="vA-qs__step-n">{i + 1}</span>
                  <div className="vA-qs__cmd">{s.cmd}</div>
                  <button className="vA-qs__copy" data-copy={s.copyText}>{s.copyLabel}</button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18, fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--muted)", display: "flex", gap: 24, flexWrap: "wrap" }}>
            <span>{t.install.note}</span>
            <span>{t.quickstart.note1}</span>
            <span>{t.quickstart.note2}</span>
          </div>
        </div>
      </section>

      {/* ============ A2A PROFILE ============ */}
      <section id="a2a" className="hap-section">
        <div className="hap-wrap">
          <p className="hap-eyebrow">{t.a2a.eyebrow}</p>
          <div className="vA-a2a">
            <div>
              <h2 className="hap-h2">{t.a2a.h2}</h2>
              <p className="hap-lead" style={{ maxWidth: "50ch" }}>{t.a2a.lead}</p>
              <ul className="vA-a2a__list">
                {t.a2a.bullets.map((b, i) => (
                  <li key={i}>
                    <span className="vA-a2a__list-bullet">⊢</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="vA-a2a__diagram">
              <div className="vA-stack">
                {t.a2a.stack.map((layer, i) => (
                  <div key={i}>
                    <div className={`vA-stack__layer${layer.cls ? ` vA-stack__layer--${layer.cls}` : ""}`}>
                      <div className="vA-stack__h">{layer.h}</div>
                      <div className="vA-stack__p">{layer.p}</div>
                    </div>
                    {i < t.a2a.stack.length - 1 && <div className="vA-stack__arrow">↑</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ SPEC EXCERPT ============ */}
      <section id="spec" className="hap-section">
        <div className="hap-wrap">
          <p className="hap-eyebrow">{t.spec.eyebrow}</p>
          <h2 className="hap-h2">{t.spec.h2}</h2>
          <p className="hap-lead">{t.spec.lead}</p>

          <div className="vA-spec__links">
            {t.spec.links.map((l, i) => (
              <span key={l.href + i}>
                {i > 0 && <span>·</span>}
                <a href={l.href}>{l.label}</a>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============ COMPARISON ============ */}
      <section className="hap-section">
        <div className="hap-wrap">
          <p className="hap-eyebrow">{t.comparison.eyebrow}</p>
          <h2 className="hap-h2">{t.comparison.h2}</h2>
          <p className="hap-lead">{t.comparison.lead}</p>

          <div className="vA-cmp">
            <div className="vA-cmp__row vA-cmp__row--head">
              <div>{t.comparison.headers.empty}</div>
              <div>{t.comparison.headers.hap}</div>
              <div>{t.comparison.headers.ats}</div>
              <div>{t.comparison.headers.web3}</div>
            </div>
            {t.comparison.rows.map((row) => (
              <div key={row.cat} className="vA-cmp__row">
                <div className="vA-cmp__cat">{row.cat}</div>
                <CmpCell sym={row.hap[0]} text={row.hap[1]} />
                <CmpCell sym={row.ats[0]} text={row.ats[1]} />
                <CmpCell sym={row.web3[0]} text={row.web3[1]} />
              </div>
            ))}
            <div className="vA-cmp__row">
              <div className="vA-cmp__cat">{t.comparison.loseRow.cat}</div>
              <div className="vA-cmp__lose">{t.comparison.loseRow.hap}</div>
              <div className="vA-cmp__lose">{t.comparison.loseRow.ats}</div>
              <div className="vA-cmp__lose">{t.comparison.loseRow.web3}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ROADMAP ============ */}
      <section id="roadmap" className="hap-section">
        <div className="hap-wrap">
          <p className="hap-eyebrow">{t.roadmap.eyebrow}</p>
          <h2 className="hap-h2">{t.roadmap.h2}</h2>
          <p className="hap-lead">{t.roadmap.lead}</p>

          <div className="vA-rm">
            {t.roadmap.rows.map((r) => {
              const [color, label] = r.pill;
              const pillClass = color ? `hap-pill hap-pill--${color} hap-pill--dot` : "hap-pill hap-pill--dot";
              return (
                <div key={r.ver} className="vA-rm__row">
                  <span className="vA-rm__ver">{r.ver}</span>
                  <span className="vA-rm__date">{r.date}</span>
                  <div className="vA-rm__what">
                    <b>{r.title}</b> {r.line}
                    <span className="vA-rm__sub">{r.sub}</span>
                  </div>
                  <span className={pillClass}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="hap-section">
        <div className="hap-wrap hap-wrap--narrow">
          <p className="hap-eyebrow">{t.faq.eyebrow}</p>
          <h2 className="hap-h2">{t.faq.h2}</h2>

          <div className="vA-faq">
            {t.faq.items.map((item, i) => (
              <details key={i} className="vA-faq__item" {...(item.open ? { open: true } : {})}>
                <summary className="vA-faq__q">{item.q}</summary>
                <div className="vA-faq__a">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="vA-cta-final">
        <div className="hap-wrap hap-wrap--narrow">
          <h2>{t.finalCta.h2}</h2>
          <p>{t.finalCta.p}</p>
          <div className="vA-ctas">
            <a
              className="hap-btn hap-btn--primary"
              href="https://github.com/luanrj-ai/hap"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.finalCta.ctaStar}
            </a>
            <button
              className="hap-btn hap-btn--cyan"
              data-copy="git clone https://github.com/luanrj-ai/hap && npm run demo:apply"
            >
              <span style={{ color: "var(--accent)" }}>$</span>&nbsp;{t.finalCta.ctaClone}
            </button>
            <a className="hap-btn" href="#spec">{t.finalCta.ctaSpec}</a>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="hap-footer">
        <div className="hap-wrap">
          <div className="hap-footer__row" style={{ justifyContent: "space-between" }}>
            <div className="hap-footer__col" style={{ maxWidth: 280 }}>
              <div className="hap-wordmark" style={{ fontSize: 14 }}>
                <span className="hap-wordmark__h">hap</span>
                <span className="hap-wordmark__v">v0.2 · {lang === "zh" ? "草案" : "draft"}</span>
              </div>
              <p style={{ margin: "6px 0 0", color: "var(--muted)", lineHeight: 1.6 }}>{t.footer.blurb}</p>
            </div>
            {t.footer.cols.map((col) => (
              <div key={col.h} className="hap-footer__col">
                <h4>{col.h}</h4>
                {col.links.map((l) => (
                  <a key={l.label} href={l.href}>{l.label}</a>
                ))}
              </div>
            ))}
          </div>
          <div className="hap-footer__bottom">
            <span>{t.footer.bottomLeft}</span>
            <span>{t.footer.bottomRight}</span>
          </div>
        </div>
      </footer>
    </>
  );
}

function GithubIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.81.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 014 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.19c0 .21.15.46.55.38A8 8 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01z" />
    </svg>
  );
}

type Sym = "y" | "m" | "n";

function CmpCell({ sym, text }: { sym: Sym; text: string }) {
  return (
    <div>
      <span className={`vA-cmp__sym vA-cmp__${sym}`}>●</span>
      {text}
    </div>
  );
}

/* HAP — transcript animation engine
 * Renders an animated agent-to-agent interview into a host element.
 * Usage:  HAPTranscript.mount(el, { autoplay: true, speed: 1 })
 */
(function () {
  const MESSAGES = [
    {
      side: "hr",
      kind: "hap.session.open",
      status: "200 OK",
      typingMs: 700,
      fields: [
        { k: "session_id", v: "h_01HXY7K4M2", strong: true },
        { k: "jd.title", v: "Senior Backend Engineer · Payments" },
        { k: "must_have", v: "5+ yrs · Go/Rust · idempotency · >10k RPS" },
        { k: "from", v: "acme-corp.com/.well-known/agent.json" },
      ],
    },
    {
      side: "cand",
      kind: "hap.session.accept",
      status: "200 OK",
      typingMs: 600,
      fields: [
        { k: "session_id", v: "h_01HXY7K4M2" },
        { k: "agent", v: "alex-chen.dev/.well-known/agent.json" },
        { k: "discloses", v: "github · talks · personal_site" },
      ],
    },
    {
      side: "hr",
      kind: "hap.ask",
      status: "200 OK",
      typingMs: 900,
      fields: [
        { k: "question_id", v: "q1" },
        { k: "type", v: "open · evidence_request" },
      ],
      quote: "Walk me through an idempotency system you've shipped at >10k RPS. What broke first?",
      evidencePref: ["github_commit", "talk"],
    },
    {
      side: "cand",
      kind: "hap.answer",
      status: "200 OK",
      typingMs: 1500,
      fields: [
        { k: "question_id", v: "q1" },
        { k: "confidence", v: "high", color: "green" },
      ],
      quote: "Designed the key-normalization layer for our payment router. Tuned LRU eviction after a retry storm under network partition.",
      evidence: [
        { type: "github_commit", url: "github.com/alex-chen/ratelimit-go/commit/9f4ac21", verified: true },
        { type: "talk", url: "youtu.be/AbCdE — GopherCon '24", verified: true },
      ],
    },
    {
      side: "hr",
      kind: "hap.ask",
      status: "200 OK",
      typingMs: 700,
      fields: [
        { k: "question_id", v: "q2" },
        { k: "type", v: "evidence_request" },
      ],
      quote: "Any maintained OSS in this space we can read?",
      evidencePref: ["github_repo", "package"],
    },
    {
      side: "cand",
      kind: "hap.answer",
      status: "200 OK",
      typingMs: 1100,
      fields: [
        { k: "question_id", v: "q2" },
        { k: "confidence", v: "high", color: "green" },
      ],
      quote: "ratelimit-go · 1.2k ★ · 23 contributors. Last commit 4 days ago.",
      evidence: [
        { type: "github_repo", url: "github.com/alex-chen/ratelimit-go", verified: true },
      ],
    },
    {
      side: "hr",
      kind: "hap.session.close",
      status: "fit",
      statusKind: "fit",
      typingMs: 800,
      fields: [
        { k: "outcome", v: "fit", color: "green" },
        { k: "next_step", v: "schedule_human_interview" },
        { k: "elapsed", v: "1.8s · 7 messages · 0 resumes" },
      ],
    },
  ];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  }

  function avatarHtml(side) {
    const cls = side === "hr" ? "hap-tx__avatar--hr" : "hap-tx__avatar--cand";
    const txt = side === "hr" ? "HR" : "CA";
    return `<div class="hap-tx__avatar ${cls}" title="${side === "hr" ? "HR-agent" : "candidate-agent"}">${txt}</div>`;
  }

  function fieldsHtml(fields) {
    if (!fields || !fields.length) return "";
    const rows = fields.map((f) => {
      const colorClass = f.color ? `style="color: var(--${f.color});"` : "";
      const strong = f.strong ? "hap-tx__strong" : "";
      return `<div class="hap-tx__field"><div class="hap-tx__field-k">${esc(f.k)}</div><div class="hap-tx__field-v ${strong}" ${colorClass}>${esc(f.v)}</div></div>`;
    }).join("");
    return rows;
  }

  function evidenceHtml(ev, pref) {
    if (!ev && !pref) return "";
    if (pref) {
      const pills = pref.map((p) => `<span class="hap-tx__ev-type">${esc(p)}</span>`).join(`<span style="color:var(--dim);margin:0 4px;">·</span>`);
      return `<div class="hap-tx__field"><div class="hap-tx__field-k">prefer</div><div class="hap-tx__field-v">${pills}</div></div>`;
    }
    const rows = ev.map((e) => `
      <div class="hap-tx__ev-row">
        <span class="hap-tx__ev-type">${esc(e.type)}</span>
        <span class="hap-tx__ev-url">${esc(e.url)}</span>
        ${e.verified ? '<span class="hap-tx__ev-verify">verified</span>' : ""}
      </div>
    `).join("");
    return `<div class="hap-tx__ev">${rows}</div>`;
  }

  function buildMessageHtml(m) {
    const rowCls = `hap-tx__row hap-tx__row--${m.side}`;
    const kindParts = m.kind.split(".");
    const kindHtml = `<span class="hap-tx__k-prefix">${esc(kindParts[0])}.</span>${esc(kindParts.slice(1).join("."))}`;
    const statusCls = m.statusKind === "decline" ? "hap-tx__status hap-tx__status--decline" : "hap-tx__status";
    const quoteHtml = m.quote ? `<div class="hap-tx__quote">${esc(m.quote)}</div>` : "";

    return `
      <div class="${rowCls}">
        ${avatarHtml(m.side)}
        <div class="hap-tx__card">
          <div class="hap-tx__head">
            <span class="hap-tx__kind">${kindHtml}</span>
            <span class="hap-tx__head-spacer"></span>
            <span class="${statusCls}">${esc(m.status || "")}</span>
          </div>
          <div class="hap-tx__body">
            ${fieldsHtml(m.fields)}
            ${quoteHtml}
            ${evidenceHtml(m.evidence, m.evidencePref)}
          </div>
        </div>
      </div>
    `;
  }

  function typingRowHtml(side) {
    return `
      <div class="hap-tx__row hap-tx__row--${side} hap-tx__row--in" data-typing="1">
        ${avatarHtml(side)}
        <div class="hap-tx__card" style="flex: 0 0 auto;">
          <div class="hap-tx__body" style="padding: 10px 14px;">
            <div class="hap-tx__typing"><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>
    `;
  }

  function mount(el, opts) {
    opts = opts || {};
    const speed = opts.speed || 1;       // 1 = normal; lower = faster
    const compact = !!opts.compact;
    const sessionId = "h_01HXY7K4M2P9R8VQNDS";
    const html = `
      <div class="hap-tx" data-compact="${compact ? 1 : 0}">
        <div class="hap-tx__bar">
          <div class="hap-tx__bar-dots">
            <div class="hap-tx__bar-dot hap-tx__bar-dot--r"></div>
            <div class="hap-tx__bar-dot hap-tx__bar-dot--y"></div>
            <div class="hap-tx__bar-dot hap-tx__bar-dot--g"></div>
          </div>
          <div class="hap-tx__bar-mid">hr-agent ⇄ candidate-agent · A2A · TLS</div>
          <div class="hap-tx__bar-id">session ${sessionId.slice(0, 14)}…</div>
        </div>
        <div class="hap-tx__feed" data-tx-feed></div>
        <div class="hap-tx__foot">
          <span data-tx-progress>0 / ${MESSAGES.length} messages</span>
          <span class="hap-tx__foot-spacer"></span>
          <button class="hap-tx__pause" data-tx-pause>pause</button>
          <button class="hap-tx__replay" data-tx-replay>↻ replay</button>
        </div>
      </div>
    `;
    el.innerHTML = html;

    const feed = el.querySelector("[data-tx-feed]");
    const progressEl = el.querySelector("[data-tx-progress]");
    const replayBtn = el.querySelector("[data-tx-replay]");
    const pauseBtn = el.querySelector("[data-tx-pause]");

    let cancelled = false;
    let paused = false;
    let waiter = null;

    function delay(ms) {
      return new Promise((res) => {
        const tick = () => {
          if (cancelled) return res();
          if (paused) { waiter = tick; return; }
          setTimeout(res, ms);
        };
        tick();
      });
    }

    async function play() {
      cancelled = false;
      feed.innerHTML = "";
      progressEl.textContent = `0 / ${MESSAGES.length} messages`;
      await delay(400 * speed);
      for (let i = 0; i < MESSAGES.length; i++) {
        if (cancelled) return;
        const m = MESSAGES[i];

        // typing indicator
        feed.insertAdjacentHTML("beforeend", typingRowHtml(m.side));
        const typingEl = feed.querySelector("[data-typing]");
        await delay((m.typingMs || 600) * speed);
        if (cancelled) return;
        typingEl && typingEl.remove();

        // real message
        feed.insertAdjacentHTML("beforeend", buildMessageHtml(m));
        const lastRow = feed.lastElementChild;
        requestAnimationFrame(() => lastRow.classList.add("hap-tx__row--in"));
        progressEl.textContent = `${i + 1} / ${MESSAGES.length} messages`;

        await delay(700 * speed);
      }
      pauseBtn.style.display = "none";
    }

    function reset() {
      cancelled = true;
      paused = false;
      pauseBtn.textContent = "pause";
      pauseBtn.style.display = "";
      setTimeout(() => { play(); }, 50);
    }

    pauseBtn.addEventListener("click", () => {
      paused = !paused;
      pauseBtn.textContent = paused ? "resume" : "pause";
      if (!paused && waiter) { const w = waiter; waiter = null; w(); }
    });
    replayBtn.addEventListener("click", reset);

    if (opts.autoplay !== false) {
      // Defer just slightly so the page paints first
      setTimeout(play, 150);
    }

    return { play, reset, replay: reset };
  }

  window.HAPTranscript = { mount, MESSAGES };
})();

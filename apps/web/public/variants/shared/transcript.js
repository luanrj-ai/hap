/* HAP — transcript animation engine
 * Renders an animated agent-to-agent interview into a host element.
 * Usage:  HAPTranscript.mount(el, { autoplay: true, speed: 1 })
 */
(function () {
  const MESSAGES = [
    {
      side: "hr",
      kind: "hap.posting",
      status: "published",
      typingMs: 600,
      fields: [
        { k: "posting_id", v: "renlab-ai-builder-001", strong: true },
        { k: "jd.title", v: "AI Builder · multi-agent / SWM" },
        { k: "rubric", v: "m1 sim end-to-end · m2 ships · m3 0→1" },
        { k: "submit", v: "api.renlab.ai/apply · static · any agent can read" },
      ],
    },
    {
      side: "cand",
      kind: "hap.application",
      status: "200 OK",
      typingMs: 1500,
      fields: [
        { k: "application_id", v: "a_01HXY7K4M2", strong: true },
        { k: "candidate", v: "alex-chen · github.com/alex-chen" },
        { k: "proof_of_control", v: "gist · HAP-PROOF", color: "green" },
      ],
      quote: "Built from PUBLIC github — no résumé, nothing self-hosted. m1: a 200-agent market simulation, end to end.",
      evidence: [
        { type: "github_repo", url: "github.com/alex-chen/abm-sim · 1.2k★", verified: true },
        { type: "github_commit", url: "github.com/alex-chen/abm-sim/commit/9f4ac21", verified: true },
      ],
    },
    {
      side: "hr",
      kind: "hap.receipt",
      status: "received",
      typingMs: 500,
      fields: [
        { k: "application_id", v: "a_01HXY7K4M2" },
        { k: "next", v: "agent_followup_possible" },
      ],
    },
    {
      side: "hr",
      kind: "hap.score",
      status: "fit",
      statusKind: "fit",
      typingMs: 1200,
      fields: [
        { k: "verdict", v: "fit", color: "green" },
        { k: "overall", v: "0.79 · required all pass" },
        { k: "identity", v: "proven · @alex-chen", color: "green" },
        { k: "m1 · sim", v: "verified · strong · 1.00", color: "green" },
        { k: "m2 · ships", v: "verified · 0.60", color: "green" },
        { k: "n1 · SWM", v: "declined · no_evidence (honest)" },
      ],
      quote: "Scored on dereferenced evidence — not the agent's prose. Fabricated links are a hard gate. 0 résumés.",
    },
  ];

  // "See it run" contrast: an honest candidate (FIT) then a faker (NO_FIT).
  const DEMO_MESSAGES = [
    {
      side: "cand", kind: "hap.application", status: "200 OK", typingMs: 1100,
      fields: [
        { k: "candidate", v: "alex-chen", strong: true },
        { k: "proof_of_control", v: "gist · HAP-PROOF", color: "green" },
      ],
      quote: "m1: 200-agent simulation, end to end · m2: ships production · n1: no SWM evidence (declining honestly).",
      evidence: [
        { type: "github_repo", url: "github.com/alex-chen/abm-sim · 1.2k★", verified: true },
        { type: "github_commit", url: "github.com/alex-chen/abm-sim/commit/9f4ac21", verified: true },
      ],
    },
    {
      side: "hr", kind: "hap.score", status: "fit", statusKind: "fit", typingMs: 1300,
      fields: [
        { k: "verdict", v: "fit", color: "green" },
        { k: "overall", v: "0.85 · required all pass" },
        { k: "identity", v: "proven · @alex-chen", color: "green" },
        { k: "m1 / m2", v: "verified · 1.00", color: "green" },
        { k: "n1", v: "declined · no_evidence — honest, 0 penalty" },
      ],
    },
    {
      side: "cand", kind: "hap.application", status: "200 OK", typingMs: 900,
      fields: [{ k: "candidate", v: "sam-faker · self-assessed \"strong\"" }],
      quote: "Huge multi-agent system — here's the commit.",
      evidence: [{ type: "github_commit", url: "github.com/torvalds/linux/commit/000000…", verified: false }],
    },
    {
      side: "hr", kind: "hap.score", status: "no_fit", statusKind: "decline", typingMs: 1200,
      fields: [
        { k: "verdict", v: "no_fit", color: "red" },
        { k: "🚩 fabrication", v: "cited evidence does not exist", color: "red" },
        { k: "🚩 overclaim", v: "said \"strong\" · evidence: no_fit" },
      ],
    },
  ];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  }

  function avatarHtml(side) {
    const cls = side === "hr" ? "hap-tx__avatar--hr" : "hap-tx__avatar--cand";
    const txt = side === "hr" ? "EMP" : "CA";
    return `<div class="hap-tx__avatar ${cls}" title="${side === "hr" ? "employer / neutral scorer" : "candidate-agent"}">${txt}</div>`;
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
    const messages = opts.messages || MESSAGES;
    const speed = opts.speed || 1;       // 1 = normal; lower = faster
    const compact = !!opts.compact;
    const applicationId = "a_01HXY7K4M2P9R8VQNDS";
    const html = `
      <div class="hap-tx" data-compact="${compact ? 1 : 0}">
        <div class="hap-tx__bar">
          <div class="hap-tx__bar-dots">
            <div class="hap-tx__bar-dot hap-tx__bar-dot--r"></div>
            <div class="hap-tx__bar-dot hap-tx__bar-dot--y"></div>
            <div class="hap-tx__bar-dot hap-tx__bar-dot--g"></div>
          </div>
          <div class="hap-tx__bar-mid">candidate-agent → employer · A2A · evidence-verified</div>
          <div class="hap-tx__bar-id">application ${applicationId.slice(0, 12)}…</div>
        </div>
        <div class="hap-tx__feed" data-tx-feed></div>
        <div class="hap-tx__foot">
          <span data-tx-progress>0 / ${messages.length} messages</span>
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
      progressEl.textContent = `0 / ${messages.length} messages`;
      await delay(400 * speed);
      for (let i = 0; i < messages.length; i++) {
        if (cancelled) return;
        const m = messages[i];

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
        progressEl.textContent = `${i + 1} / ${messages.length} messages`;

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

  window.HAPTranscript = { mount, MESSAGES, DEMO_MESSAGES };
})();

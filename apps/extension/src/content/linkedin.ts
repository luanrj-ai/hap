import { scoreViaApi } from "../shared/api";

const PANEL_ID = "resumetruth-panel-root";

function extractLinkedInResume(): { text: string; name: string } {
  const name =
    document.querySelector("h1")?.textContent?.trim() ||
    document.querySelector("[data-test-id='profile-name']")?.textContent?.trim() ||
    "";

  const sectionSelectors = [
    "section[id*='experience']",
    "section[id*='education']",
    "section[id*='about']",
    "section[id*='skills']",
    "main .pv-profile-section",
    "main section",
  ];

  const blocks: string[] = [];
  for (const sel of sectionSelectors) {
    document.querySelectorAll(sel).forEach((el) => {
      const text = (el as HTMLElement).innerText?.trim();
      if (text && text.length > 50 && !blocks.includes(text)) {
        blocks.push(text);
      }
    });
  }

  if (blocks.length === 0) {
    const main = document.querySelector("main");
    if (main) blocks.push((main as HTMLElement).innerText || "");
  }

  return {
    text: blocks.join("\n\n").slice(0, 45_000),
    name,
  };
}

function createPanel(): HTMLDivElement {
  const existing = document.getElementById(PANEL_ID);
  if (existing) return existing as HTMLDivElement;

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.style.cssText = `
    position: fixed;
    top: 92px;
    right: 24px;
    width: 340px;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    background: #0e1118;
    color: #e8ecf3;
    border: 1px solid #242a36;
    border-radius: 16px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
    box-shadow: 0 18px 60px rgba(0,0,0,.5);
    font-size: 13px;
  `;
  document.body.appendChild(panel);
  return panel;
}

function colorFor(score: number): string {
  if (score >= 75) return "#3ddc97";
  if (score >= 50) return "#ffd166";
  return "#ff5d73";
}

function renderLoading(panel: HTMLDivElement) {
  panel.innerHTML = `
    <div style="padding:16px 18px;border-bottom:1px solid #242a36;display:flex;align-items:center;justify-content:space-between;">
      <strong style="font-size:13px;letter-spacing:-.2px;">ResumeTruth</strong>
      <span style="font-size:11px;color:#9aa3b2;">analyzing…</span>
    </div>
    <div style="padding:24px 18px;text-align:center;color:#9aa3b2;font-size:13px;">
      正在分析当前 profile…
    </div>
  `;
}

function renderError(panel: HTMLDivElement, msg: string) {
  panel.innerHTML = `
    <div style="padding:16px 18px;border-bottom:1px solid #242a36;display:flex;align-items:center;justify-content:space-between;">
      <strong style="font-size:13px;">ResumeTruth</strong>
      <button id="rt-close" style="background:transparent;border:0;color:#9aa3b2;cursor:pointer;font-size:16px;line-height:1;">×</button>
    </div>
    <div style="padding:18px;color:#ff5d73;font-size:13px;line-height:1.5;">
      ❌ ${msg}
      <div style="color:#9aa3b2;margin-top:10px;font-size:11px;">
        请确认本地后端运行：<code style="color:#22d3ee;">npm run dev:web</code>
        （默认 http://localhost:3000）
      </div>
    </div>
  `;
  panel.querySelector<HTMLButtonElement>("#rt-close")?.addEventListener("click", () => panel.remove());
}

function renderResult(panel: HTMLDivElement, result: any, name: string) {
  const rings = [
    { label: "真实度", value: result.authenticity },
    { label: "可验证度", value: result.verifiability },
    { label: "推荐面试度", value: result.interview },
  ];

  panel.innerHTML = `
    <div style="padding:14px 18px;border-bottom:1px solid #242a36;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <strong style="font-size:13px;letter-spacing:-.2px;">ResumeTruth</strong>
        <div style="font-size:11px;color:#9aa3b2;margin-top:2px;">${escapeHtml(name || "candidate")}</div>
      </div>
      <button id="rt-close" style="background:transparent;border:0;color:#9aa3b2;cursor:pointer;font-size:16px;line-height:1;">×</button>
    </div>

    <div style="padding:18px;display:flex;justify-content:space-around;gap:12px;border-bottom:1px solid #242a36;">
      ${rings
        .map(
          (r) => `
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
          <div style="font-size:26px;font-weight:700;color:${colorFor(r.value)};">${r.value}</div>
          <div style="font-size:10px;color:#9aa3b2;text-transform:uppercase;letter-spacing:.08em;">${r.label}</div>
        </div>
      `,
        )
        .join("")}
    </div>

    <div style="padding:14px 18px;border-bottom:1px solid #242a36;font-size:12.5px;color:#cdd3df;line-height:1.55;">
      ${escapeHtml(result.summary)}
    </div>

    <div style="padding:12px 18px 16px;">
      <div style="font-size:10px;color:#9aa3b2;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;">信号 (${result.signals.length})</div>
      ${result.signals
        .map(
          (s: any) => `
        <div style="background:#171b24;border:1px solid #242a36;border-radius:8px;padding:8px 10px;margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <span style="font-weight:600;font-size:12px;">${escapeHtml(s.label)}</span>
            <span style="color:${colorFor(s.score)};font-weight:700;font-size:12px;">${s.score}</span>
          </div>
          <div style="color:#cdd3df;font-size:11.5px;line-height:1.5;">${escapeHtml(s.explanation)}</div>
        </div>
      `,
        )
        .join("")}
    </div>

    <div style="padding:10px 18px;border-top:1px solid #242a36;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:10px;color:#9aa3b2;">${new Date(result.scoredAt).toLocaleTimeString()}</span>
      <button id="rt-rescore" style="background:#7c5cff;border:0;color:white;padding:5px 10px;font-size:11px;border-radius:6px;cursor:pointer;">重新评估</button>
    </div>
  `;

  panel.querySelector<HTMLButtonElement>("#rt-close")?.addEventListener("click", () => panel.remove());
  panel.querySelector<HTMLButtonElement>("#rt-rescore")?.addEventListener("click", () => run());
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function run() {
  const panel = createPanel();
  renderLoading(panel);

  const { text, name } = extractLinkedInResume();
  if (!text || text.length < 80) {
    renderError(panel, "未能从此页面提取出足够的文本（profile 可能尚未完全加载）。");
    return;
  }

  try {
    const result = await scoreViaApi({
      resumeText: text,
      candidateName: name,
      linkedinUrl: location.href,
    });
    renderResult(panel, result, name);
  } catch (err) {
    renderError(panel, err instanceof Error ? err.message : "Unknown error");
  }
}

let lastUrl = "";
function maybeRun() {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  if (!/linkedin\.com\/in\//.test(location.href)) return;
  setTimeout(run, 1500);
}

maybeRun();

const observer = new MutationObserver(() => maybeRun());
observer.observe(document, { subtree: true, childList: true });

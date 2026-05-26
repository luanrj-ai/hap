/**
 * Generate the weekly HR digest: top picks, hidden gems, AI flagged, volume.
 *
 *   cd apps/web && npx tsx scripts/weekly-digest.ts
 *   cd apps/web && npx tsx scripts/weekly-digest.ts --days=14
 *   cd apps/web && npx tsx scripts/weekly-digest.ts --out=path.html
 *
 * Categories:
 *   - Top picks: highest interview score, last 7 days
 *   - Hidden gems: positive signals (github / rare-depth) strong, but interview not top
 *   - Risk picks: ai-text borderline OR notable false-positive risk
 *   - Volume / trend stats
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = resolve(__dirname, "../eval/weekly-digest.html");

const SEED_MARKER = "[seeded-history]";

interface SignalRow {
  signalId: string;
  label: string;
  dimension: string;
  value: number;
  explanation: string;
}

interface ScoreWithSignals {
  id: string;
  candidateName: string | null;
  authenticity: number;
  verifiability: number;
  interview: number;
  summary: string;
  scoredAt: Date;
  jobDescription: string | null;
  signals: SignalRow[];
  skillsJson: string | null;
  hiringOutcome: string | null;
}

function getSkills(s: ScoreWithSignals): string[] {
  if (!s.skillsJson) return [];
  try {
    return (JSON.parse(s.skillsJson) as { skills?: string[] }).skills ?? [];
  } catch {
    return [];
  }
}

function pickSignal(s: ScoreWithSignals, id: string): SignalRow | undefined {
  return s.signals.find((sig) => sig.signalId === id);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function shortJd(jd: string | null): string {
  if (!jd) return "(no JD)";
  const firstLine = jd.split("\n").find((l) => l.trim().length > 0) ?? jd;
  return firstLine.slice(0, 60).replace(/^Senior Backend Engineer — /, "");
}

function shortName(name: string | null): string {
  if (!name) return "(unnamed)";
  return name.replace(SEED_MARKER, "").trim();
}

async function main(): Promise<void> {
  const days = Number(process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] ?? "7");
  const outPath = process.argv.find((a) => a.startsWith("--out="))?.split("=")[1] ?? DEFAULT_OUT;

  const prisma = new PrismaClient();
  const since = new Date(Date.now() - days * 86_400_000);

  const scores: ScoreWithSignals[] = await prisma.score.findMany({
    where: { scoredAt: { gte: since } },
    orderBy: { scoredAt: "desc" },
    include: { signals: true },
  }) as unknown as ScoreWithSignals[];

  // Aggregate top skills across all scored candidates
  const skillCounts = new Map<string, number>();
  for (const s of scores) {
    for (const sk of getSkills(s)) {
      const norm = sk.trim();
      if (norm.length > 0) skillCounts.set(norm, (skillCounts.get(norm) ?? 0) + 1);
    }
  }
  const topSkills = [...skillCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 25);

  // Top picks: highest interview score
  const topPicks = [...scores]
    .filter((s) => s.authenticity >= 50)
    .sort((a, b) => b.interview - a.interview)
    .slice(0, 8);

  // Hidden gems: positive-rare-depth or positive-github HIGH, but interview score 40-74
  // Critical: require ai-text ≥ 60 directly so we don't recommend adversarial AI that
  // inserted fake depth markers (RFC numbers, algo names, etc.) to game the signal.
  const gems = scores
    .filter((s) => {
      if (s.interview >= 75 || s.interview < 40) return false;
      const aiText = pickSignal(s, "ai-text")?.value ?? 100;
      if (aiText < 60) return false; // any AI suspicion → never a gem
      const jdScore = pickSignal(s, "jd-match")?.value ?? 0;
      if (jdScore < 50) return false; // depth markers must be ON-TOPIC for this JD
      const depth = pickSignal(s, "positive-rare-depth")?.value ?? 0;
      const github = pickSignal(s, "positive-github")?.value ?? 0;
      return depth >= 70 || github >= 70;
    })
    .sort((a, b) => {
      const aMax = Math.max(pickSignal(a, "positive-rare-depth")?.value ?? 0, pickSignal(a, "positive-github")?.value ?? 0);
      const bMax = Math.max(pickSignal(b, "positive-rare-depth")?.value ?? 0, pickSignal(b, "positive-github")?.value ?? 0);
      return bMax - aMax;
    })
    .slice(0, 6);

  // AI flagged: ai-text < 60
  const aiFlagged = scores.filter((s) => (pickSignal(s, "ai-text")?.value ?? 100) < 60);

  // Risk picks: borderline ai-text (40-65) — neither clear human nor clear AI
  const risky = scores
    .filter((s) => {
      const ai = pickSignal(s, "ai-text")?.value ?? 100;
      return ai >= 40 && ai < 65;
    })
    .sort((a, b) => (pickSignal(a, "ai-text")?.value ?? 0) - (pickSignal(b, "ai-text")?.value ?? 0))
    .slice(0, 5);

  // Volume stats
  const totalScored = scores.length;
  const flaggedPct = totalScored === 0 ? 0 : (aiFlagged.length / totalScored) * 100;
  const verifiedCount = scores.filter((s) => s.signals.some((sig) => sig.label.includes("已实际验证"))).length;
  const enhancedCount = scores.filter((s) =>
    s.signals.some((sig) => sig.label.includes("LLM") || sig.label.includes("Haiku")),
  ).length;

  // Group by JD
  const byJd = new Map<string, number>();
  for (const s of scores) {
    const k = shortJd(s.jobDescription);
    byJd.set(k, (byJd.get(k) ?? 0) + 1);
  }

  await prisma.$disconnect();

  // ---- Build HTML ----
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ResumeTruth · Weekly Digest · ${new Date().toISOString().slice(0, 10)}</title>
<style>
  :root{--bg:#0b0d12;--panel:#12151c;--panel-2:#171b24;--line:#242a36;--text:#e8ecf3;--muted:#9aa3b2;--accent:#7c5cff;--cyan:#22d3ee;--green:#3ddc97;--yellow:#ffd166;--red:#ff5d73}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.6;font-size:15px}
  .wrap{max-width:1100px;margin:0 auto;padding:32px 24px 80px}
  code{background:#0a0c11;border:1px solid var(--line);padding:1px 6px;border-radius:4px;font-size:13px;font-family:"SF Mono",Menlo,Consolas,monospace}
  header.hero{background:radial-gradient(900px 320px at 0% -20%,rgba(124,92,255,.22),transparent 60%),radial-gradient(900px 320px at 100% 0%,rgba(34,211,238,.15),transparent 60%),linear-gradient(180deg,#0e1118,#0b0d12);border:1px solid var(--line);border-radius:18px;padding:32px 30px;margin-bottom:24px}
  .eyebrow{color:var(--cyan);text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:700}
  h1{font-size:28px;margin:8px 0;line-height:1.2;letter-spacing:-.4px}
  .lede{color:var(--muted);max-width:780px;font-size:14px}
  .meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
  .pill{background:#1f2533;color:var(--muted);font-size:11px;padding:5px 9px;border-radius:999px;border:1px solid var(--line)}
  h2{font-size:20px;margin:38px 0 12px;letter-spacing:-.3px;border-bottom:1px solid var(--line);padding-bottom:8px}
  .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  @media(max-width:760px){.grid-4{grid-template-columns:1fr}}
  .stat{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}
  .stat .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
  .stat .val{font-size:32px;font-weight:700;margin-top:6px;letter-spacing:-.5px}
  .stat .delta{font-size:12px;color:var(--muted);margin-top:4px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:10px}
  .row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
  .row .name{font-weight:600;font-size:15px}
  .row .meta-line{color:var(--muted);font-size:12px;margin-top:2px}
  .scores{display:flex;gap:10px;font-size:12px;color:var(--muted);text-align:right;flex-shrink:0;flex-wrap:wrap}
  .scores b{display:block;font-size:18px;font-weight:700;letter-spacing:-.3px}
  .scores .good{color:var(--green)}.scores .mid{color:var(--yellow)}.scores .bad{color:var(--red)}
  .why{font-size:13px;color:#cdd3df;margin-top:8px}
  .why span{display:inline-block;background:rgba(34,211,238,.1);color:var(--cyan);border:1px solid rgba(34,211,238,.2);border-radius:6px;padding:2px 8px;margin-right:6px;margin-top:4px;font-size:11px}
  .ai-card{border-color:rgba(255,93,115,.3)}
  .ai-card .why span{background:rgba(255,93,115,.1);color:var(--red);border-color:rgba(255,93,115,.2)}
  .gem-card{border-color:rgba(61,220,151,.3)}
  .gem-card .why span{background:rgba(61,220,151,.1);color:var(--green);border-color:rgba(61,220,151,.2)}
  .empty{color:var(--muted);font-size:14px;text-align:center;padding:24px}
  footer{margin-top:50px;border-top:1px solid var(--line);padding-top:18px;color:var(--muted);font-size:12px}
  .scope-bar{display:flex;gap:14px;color:var(--muted);font-size:12px;margin:8px 0 24px;flex-wrap:wrap}
  .scope-bar span strong{color:var(--text)}
</style>
</head>
<body>
<div class="wrap">

  <header class="hero">
    <div class="eyebrow">ResumeTruth · 周度 HR 摘要</div>
    <h1>本周 ${totalScored} 份候选人评分回顾</h1>
    <p class="lede">
      自动从 ResumeTruth Score 表过去 ${days} 天的数据聚合。识别值得优先面试的 top picks、被埋没的 hidden gems、需要复核的 risk picks。
    </p>
    <div class="meta">
      <span class="pill">${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC</span>
      <span class="pill">回溯窗口：${days} 天</span>
      <span class="pill">数据行：${totalScored}</span>
      <span class="pill">AI 标记 ${aiFlagged.length} (${flaggedPct.toFixed(0)}%)</span>
    </div>
  </header>

  <div class="grid-4">
    <div class="stat"><div class="label">本周评分总数</div><div class="val">${totalScored}</div><div class="delta">来自 ${byJd.size} 个不同 JD</div></div>
    <div class="stat"><div class="label">AI 简历命中</div><div class="val" style="color:var(--red)">${aiFlagged.length}</div><div class="delta">占比 ${flaggedPct.toFixed(0)}%</div></div>
    <div class="stat"><div class="label">LLM 增强</div><div class="val" style="color:var(--cyan)">${enhancedCount}</div><div class="delta">${enhancedCount === 0 ? "—" : (enhancedCount / totalScored * 100).toFixed(0) + "% 启用率"}</div></div>
    <div class="stat"><div class="label">外部验证</div><div class="val" style="color:var(--green)">${verifiedCount}</div><div class="delta">${verifiedCount === 0 ? "—" : "实打 GitHub / 网站"}</div></div>
  </div>

  <h2>🏆 Top Picks · 推荐优先面试 (${topPicks.length})</h2>
  ${
    topPicks.length === 0
      ? `<div class="empty">本周没有评分</div>`
      : topPicks
          .map((s) => {
            const outcomeBadge = s.hiringOutcome
              ? `<span style="background:rgba(61,220,151,.15);color:var(--green);border:1px solid rgba(61,220,151,.3);border-radius:6px;padding:2px 8px;font-size:11px">${escapeHtml(s.hiringOutcome)}</span>`
              : `<span class="outcome-buttons" data-score-id="${s.id}" style="font-size:11px;color:var(--muted)">outcome?</span>`;
            // (continued below in original block)
            const jd = pickSignal(s, "jd-match");
            const depth = pickSignal(s, "positive-rare-depth");
            const reasons: string[] = [];
            if (jd && jd.value >= 75) reasons.push(`JD 强匹配 ${jd.value}`);
            if (depth && depth.value >= 70) reasons.push(`技术深度 ${depth.value}`);
            const auth = pickSignal(s, "ai-text");
            if (auth && auth.value >= 80) reasons.push(`真人写作 ${auth.value}`);
            return `<div class="card">
              <div class="row">
                <div>
                  <div class="name">${escapeHtml(shortName(s.candidateName))} ${outcomeBadge}</div>
                  <div class="meta-line">${escapeHtml(shortJd(s.jobDescription))} · ${s.scoredAt.toISOString().slice(0, 10)}</div>
                </div>
                <div class="scores">
                  <div><div style="font-size:10px">推荐</div><b class="${s.interview >= 75 ? "good" : "mid"}">${s.interview}</b></div>
                  <div><div style="font-size:10px">真实</div><b class="${s.authenticity >= 75 ? "good" : "mid"}">${s.authenticity}</b></div>
                  <div><div style="font-size:10px">可验证</div><b class="${s.verifiability >= 75 ? "good" : "mid"}">${s.verifiability}</b></div>
                </div>
              </div>
              ${reasons.length ? `<div class="why">${reasons.map((r) => `<span>${escapeHtml(r)}</span>`).join("")}</div>` : ""}
            </div>`;
          })
          .join("\n")
  }

  <h2>💎 Hidden Gems · 被埋没的真人才 (${gems.length})</h2>
  <p style="color:var(--muted);font-size:13px;margin-top:0">
    标准：interview 分 40-74（不会自动入 top picks）但 positive-github 或 positive-rare-depth ≥ 70。这是产品的差异化卖点——发现规则系统会过滤掉但实际值得看的人。
  </p>
  ${
    gems.length === 0
      ? `<div class="empty">本周没有命中——可能数据太少，或所有强 positive 信号的候选人都进 top picks 了</div>`
      : gems
          .map((s) => {
            const depth = pickSignal(s, "positive-rare-depth");
            const github = pickSignal(s, "positive-github");
            const jd = pickSignal(s, "jd-match");
            const reasons: string[] = [];
            if (depth && depth.value >= 70) reasons.push(`深度信号 ${depth.value}`);
            if (github && github.value >= 70) reasons.push(`GitHub ${github.value}`);
            if (jd) reasons.push(`但 JD 匹配仅 ${jd.value}`);
            return `<div class="card gem-card">
              <div class="row">
                <div>
                  <div class="name">${escapeHtml(shortName(s.candidateName))}</div>
                  <div class="meta-line">${escapeHtml(shortJd(s.jobDescription))} · ${s.scoredAt.toISOString().slice(0, 10)}</div>
                </div>
                <div class="scores">
                  <div><div style="font-size:10px">推荐</div><b class="mid">${s.interview}</b></div>
                  <div><div style="font-size:10px">真实</div><b class="${s.authenticity >= 75 ? "good" : "mid"}">${s.authenticity}</b></div>
                </div>
              </div>
              <div class="why">${reasons.map((r) => `<span>${escapeHtml(r)}</span>`).join("")}</div>
              ${depth && depth.value >= 70 ? `<div style="margin-top:6px;font-size:12px;color:#cdd3df">${escapeHtml(depth.explanation.slice(0, 200))}</div>` : ""}
            </div>`;
          })
          .join("\n")
  }

  <h2>⚠ Risk Picks · 需要复核的边缘 case (${risky.length})</h2>
  <p style="color:var(--muted);font-size:13px;margin-top:0">
    标准：ai-text 分 40-65（既不是明显真人也不是明显 AI）。可能是 coached AI，也可能是非英语母语真人——建议人工最后审一眼。
  </p>
  ${
    risky.length === 0
      ? `<div class="empty">本周没有边缘 case</div>`
      : risky
          .map((s) => {
            const ai = pickSignal(s, "ai-text");
            return `<div class="card ai-card">
              <div class="row">
                <div>
                  <div class="name">${escapeHtml(shortName(s.candidateName))}</div>
                  <div class="meta-line">${escapeHtml(shortJd(s.jobDescription))} · ${s.scoredAt.toISOString().slice(0, 10)}</div>
                </div>
                <div class="scores">
                  <div><div style="font-size:10px">ai-text</div><b class="${(ai?.value ?? 100) < 60 ? "bad" : "mid"}">${ai?.value ?? "—"}</b></div>
                  <div><div style="font-size:10px">推荐</div><b class="mid">${s.interview}</b></div>
                </div>
              </div>
              ${ai ? `<div style="margin-top:6px;font-size:12px;color:#cdd3df">${escapeHtml(ai.explanation.slice(0, 200))}</div>` : ""}
            </div>`;
          })
          .join("\n")
  }

  <h2>🏷  Top Skills（本周候选人池）</h2>
  ${topSkills.length === 0
    ? `<div class="empty">还没有抽取过 skills 数据。需要 LLM key + 重跑评分</div>`
    : `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px">${
        topSkills.map(([sk, n]) => `<span style="background:var(--panel-2);border:1px solid var(--line);border-radius:999px;padding:4px 10px;font-size:12px;color:#cdd3df">${escapeHtml(sk)} <span style="color:var(--cyan);font-weight:600">${n}</span></span>`).join("")
      }</div>`
  }

  <h2>📊 按岗位分布</h2>
  <table style="width:100%;border-collapse:collapse;border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:13px">
    <thead><tr><th style="background:var(--panel-2);color:var(--muted);font-weight:600;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:9px 12px;text-align:left">JD</th><th style="background:var(--panel-2);color:var(--muted);font-weight:600;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:9px 12px;text-align:right">数量</th></tr></thead>
    <tbody>
      ${[...byJd.entries()]
        .sort(([, a], [, b]) => b - a)
        .map(([jd, n]) => `<tr><td style="padding:9px 12px;border-top:1px solid var(--line)">${escapeHtml(jd)}</td><td style="padding:9px 12px;border-top:1px solid var(--line);text-align:right">${n}</td></tr>`)
        .join("\n")}
    </tbody>
  </table>

  <footer>
    Generated by <code>npx tsx scripts/weekly-digest.ts</code> · windowed last ${days} days ·
    schedule weekly via <code>schtasks /Create /SC WEEKLY ...</code> (Windows) or crontab (Linux/macOS).
    <br/><br/>
    💡 Record outcomes: hit ⬇ on any "outcome?" link below. Once you have 20+ outcomes, run
    <code>npm run calibrate</code> to auto-adjust HIGH/MED thresholds from real hiring data.
  </footer>
</div>
<script>
  // Outcome recording: click → choose → POST
  document.querySelectorAll('.outcome-buttons').forEach((el) => {
    const scoreId = el.dataset.scoreId;
    el.style.cursor = 'pointer';
    el.style.textDecoration = 'underline dotted';
    el.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const choice = prompt('Outcome? Type one: hired / interviewed / declined / rejected (or empty to cancel)');
      if (!choice) return;
      const valid = ['hired', 'interviewed', 'declined', 'rejected'];
      if (!valid.includes(choice)) { alert('invalid'); return; }
      try {
        const res = await fetch('/api/outcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scoreId, outcome: choice }),
        });
        if (res.ok) {
          el.outerHTML = '<span style="background:rgba(61,220,151,.15);color:var(--green);border:1px solid rgba(61,220,151,.3);border-radius:6px;padding:2px 8px;font-size:11px">' + choice + '</span>';
        } else {
          alert('Failed: ' + (await res.text()));
        }
      } catch (err) {
        alert('Network error: ' + err.message);
      }
    });
  });
</script>
</body>
</html>
`;

  writeFileSync(outPath, html);
  console.log(`✓ Wrote ${outPath}`);
  console.log(`  ${totalScored} scores · ${topPicks.length} top · ${gems.length} gems · ${aiFlagged.length} AI · ${risky.length} risky`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

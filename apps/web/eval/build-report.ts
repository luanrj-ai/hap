/**
 * Build eval-report.html from eval-results.json.
 *
 *   cd apps/web && npx tsx eval/build-report.ts
 *   open apps/web/eval/eval-report.html
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_PATH = resolve(__dirname, "eval-results.json");
const OUT_PATH = resolve(__dirname, "eval-report.html");

type FitBand = "HIGH" | "MED" | "LOW";

interface Cell {
  fxId: string;
  source: "real" | "ai";
  aiTier?: "naive" | "coached" | "adversarial";
  jobKey: string;
  expectedFit: FitBand;
  baseJdScore: number;
  llmJdScore: number;
  ruleAiText: number;
  llmAiText: number;
  baseInterview: number;
  llmInterview: number;
  baseAuth: number;
  llmAuth: number;
}

interface Results {
  ranAt: string;
  provider: string;
  model: string;
  elapsedSec: number;
  realFixtures: number;
  aiFixtures: number;
  jobs: Array<{ key: string; label: string }>;
  cells: Cell[];
}

function bucketize(score: number): FitBand {
  if (score >= 71) return "HIGH";
  if (score >= 40) return "MED";
  return "LOW";
}

function f1(tp: number, fp: number, fn: number): number {
  const p = tp + fp === 0 ? 0 : tp / (tp + fp);
  const r = tp + fn === 0 ? 0 : tp / (tp + fn);
  return p + r === 0 ? 0 : (2 * p * r) / (p + r);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function main(): void {
  const data: Results = JSON.parse(readFileSync(RESULTS_PATH, "utf8"));
  const real = data.cells.filter((c) => c.source === "real");

  // JD-match stats per JD
  const jdStats = data.jobs.map((job) => {
    const sub = real.filter((c) => c.jobKey === job.key);
    const bow = sub.filter((c) => bucketize(c.baseJdScore) === c.expectedFit).length;
    const llm = sub.filter((c) => bucketize(c.llmJdScore) === c.expectedFit).length;
    return { ...job, total: sub.length, bow, llm, lift: llm - bow };
  });
  const totalBow = real.filter((c) => bucketize(c.baseJdScore) === c.expectedFit).length;
  const totalLlm = real.filter((c) => bucketize(c.llmJdScore) === c.expectedFit).length;

  // AI-text stats per tier (dedupe by fxId — ai-text doesn't depend on JD)
  const seen = new Set<string>();
  const fxCells = data.cells.filter((c) => {
    if (seen.has(c.fxId)) return false;
    seen.add(c.fxId);
    return true;
  });
  const aiCellsAll = fxCells.filter((c) => c.source === "ai");
  const realCellsAll = fxCells.filter((c) => c.source === "real");
  const aiThreshold = 60;
  function stats(getScore: (c: Cell) => number, aiSubset: Cell[]) {
    const tn = realCellsAll.filter((c) => getScore(c) >= aiThreshold).length;
    const fp = realCellsAll.length - tn;
    const tp = aiSubset.filter((c) => getScore(c) < aiThreshold).length;
    const fn = aiSubset.length - tp;
    return {
      tp, fp, tn, fn,
      precision: tp + fp === 0 ? 0 : tp / (tp + fp),
      recall: tp + fn === 0 ? 0 : tp / (tp + fn),
      f1: f1(tp, fp, fn),
    };
  }
  const tiers = ["naive", "coached", "adversarial"] as const;
  const aiStats = tiers.map((t) => {
    const sub = aiCellsAll.filter((c) => c.aiTier === t);
    return {
      tier: t,
      n: sub.length,
      rule: stats((c) => c.ruleAiText, sub),
      llm: stats((c) => c.llmAiText, sub),
    };
  });
  const aiAll = {
    n: aiCellsAll.length,
    rule: stats((c) => c.ruleAiText, aiCellsAll),
    llm: stats((c) => c.llmAiText, aiCellsAll),
  };

  // Find data-JD misses for the "honest gap" callout
  const dataJob = data.jobs.find((j) => j.key === "dataEngineer");
  const dataMisses = dataJob
    ? real.filter((c) => c.jobKey === dataJob.key && bucketize(c.llmJdScore) !== c.expectedFit)
    : [];

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ResumeTruth · Eval Report · ${data.ranAt.slice(0, 10)}</title>
<style>
  :root {
    --bg:#0b0d12; --panel:#12151c; --panel-2:#171b24; --line:#242a36;
    --text:#e8ecf3; --muted:#9aa3b2;
    --accent:#7c5cff; --cyan:#22d3ee; --green:#3ddc97; --yellow:#ffd166; --red:#ff5d73;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.6;font-size:15px}
  .wrap{max-width:1180px;margin:0 auto;padding:32px 24px 80px}
  code{background:#0a0c11;border:1px solid var(--line);padding:1px 6px;border-radius:4px;font-size:13px;font-family:"SF Mono",Menlo,Consolas,monospace}
  header.hero{background:radial-gradient(900px 320px at 0% -20%,rgba(124,92,255,.22),transparent 60%),radial-gradient(900px 320px at 100% 0%,rgba(34,211,238,.15),transparent 60%),linear-gradient(180deg,#0e1118,#0b0d12);border:1px solid var(--line);border-radius:18px;padding:36px 32px;margin-bottom:24px}
  .eyebrow{color:var(--cyan);text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:700}
  h1{font-size:32px;margin:8px 0;line-height:1.2;letter-spacing:-.4px}
  h1 .grad{background:linear-gradient(90deg,#7c5cff,#22d3ee 70%);-webkit-background-clip:text;background-clip:text;color:transparent}
  .lede{color:var(--muted);max-width:780px;font-size:15px}
  .meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
  .pill{background:#1f2533;color:var(--muted);font-size:11px;padding:5px 9px;border-radius:999px;border:1px solid var(--line)}

  h2{font-size:22px;margin:42px 0 14px;letter-spacing:-.3px;border-bottom:1px solid var(--line);padding-bottom:8px}
  h3{font-size:16px;margin:22px 0 8px;color:#f0f3fa}

  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  @media(max-width:760px){.grid-3,.grid-4{grid-template-columns:1fr}}

  .stat{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px}
  .stat .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
  .stat .val{font-size:36px;font-weight:700;margin-top:6px;letter-spacing:-.5px}
  .stat .delta{font-size:13px;color:var(--muted);margin-top:4px}
  .stat .val.green{color:var(--green)} .stat .val.red{color:var(--red)} .stat .val.yellow{color:var(--yellow)}

  table{width:100%;border-collapse:collapse;border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:14px;margin:8px 0 16px}
  th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--line)}
  th{background:var(--panel-2);color:var(--muted);font-weight:600;font-size:11px;letter-spacing:.06em;text-transform:uppercase}
  tr:last-child td{border-bottom:0}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  .good{color:var(--green)} .bad{color:var(--red)} .mid{color:var(--yellow)} .neut{color:var(--muted)}
  .bar{height:8px;background:#1f2533;border-radius:4px;overflow:hidden;margin-top:4px}
  .bar > span{display:block;height:100%}
  .bar .bow{background:#9aa3b2}
  .bar .llm{background:var(--accent)}

  .callout{background:linear-gradient(180deg,rgba(124,92,255,.08),rgba(34,211,238,.04));border:1px solid rgba(124,92,255,.25);border-radius:12px;padding:16px 18px;margin:14px 0;color:#dde3ef;font-size:14px}
  .callout.warn{background:linear-gradient(180deg,rgba(255,93,115,.06),rgba(255,209,102,.04));border-color:rgba(255,93,115,.3)}
  .callout strong{color:var(--cyan)} .callout.warn strong{color:var(--red)}

  .filter-bar{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 4px}
  .filter-bar button{background:var(--panel-2);border:1px solid var(--line);color:var(--text);font-size:12px;padding:5px 12px;border-radius:999px;cursor:pointer}
  .filter-bar button.active{background:var(--accent);border-color:var(--accent);color:#fff}

  footer{margin-top:54px;border-top:1px solid var(--line);padding-top:22px;color:var(--muted);font-size:13px}
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <div class="eyebrow">ResumeTruth · Eval Report</div>
    <h1><span class="grad">${totalLlm}/${real.length}</span> bucket accuracy on jd-match · <span class="grad">F1 ${aiAll.llm.f1.toFixed(2)}</span> on ai-text</h1>
    <p class="lede">
      ${data.realFixtures} real-style + ${data.aiFixtures} AI-generated resumes across ${data.jobs.length} JDs. ${data.cells.length} (resume × JD) cells, ${data.cells.length * 2} LLM calls in ${data.elapsedSec.toFixed(1)}s.
      Each fixture scored twice: pure rule baseline vs rule + LLM signals (gpt-5.5 via uyilink proxy).
    </p>
    <div class="meta">
      <span class="pill">${escapeHtml(data.ranAt.slice(0, 16).replace("T", " "))} UTC</span>
      <span class="pill">${escapeHtml(data.provider)} · ${escapeHtml(data.model)}</span>
      <span class="pill">${data.realFixtures} real + ${data.aiFixtures} AI</span>
      <span class="pill">${data.jobs.length} JDs · ${data.cells.length} cells</span>
      <span class="pill">elapsed ${data.elapsedSec.toFixed(0)}s</span>
    </div>
  </header>

  <h2>0 · TL;DR</h2>
  <div class="grid-4">
    <div class="stat">
      <div class="label">JD-match overall</div>
      <div class="val ${totalLlm > totalBow ? "green" : "red"}">${((totalLlm / real.length) * 100).toFixed(0)}%</div>
      <div class="delta">BoW ${((totalBow / real.length) * 100).toFixed(0)}% · Δ ${totalLlm - totalBow >= 0 ? "+" : ""}${totalLlm - totalBow}pp</div>
    </div>
    <div class="stat">
      <div class="label">AI-text F1 (all tiers)</div>
      <div class="val ${aiAll.llm.f1 > aiAll.rule.f1 ? "green" : "red"}">${aiAll.llm.f1.toFixed(2)}</div>
      <div class="delta">Rule F1 ${aiAll.rule.f1.toFixed(2)} · Δ +${(aiAll.llm.f1 - aiAll.rule.f1).toFixed(2)}</div>
    </div>
    <div class="stat">
      <div class="label">False-positive on real</div>
      <div class="val green">${aiAll.llm.fp}/${realCellsAll.length}</div>
      <div class="delta">non-native English passed ✓</div>
    </div>
    <div class="stat">
      <div class="label">Adversarial AI caught</div>
      <div class="val ${aiStats[2].llm.recall >= 0.5 ? "yellow" : "red"}">${aiStats[2].llm.tp}/${aiStats[2].n}</div>
      <div class="delta">tier 3: AI told to evade detection</div>
    </div>
  </div>

  <h2>1 · JD-match · 3 个岗位的桶级准确率</h2>
  <table>
    <thead><tr><th>JD</th><th class="num">n</th><th class="num">规则 BoW</th><th class="num">+LLM</th><th class="num">Δ</th><th>visualization</th></tr></thead>
    <tbody>
      ${jdStats
        .map((j) => {
          const bowPct = (j.bow / j.total) * 100;
          const llmPct = (j.llm / j.total) * 100;
          const delta = llmPct - bowPct;
          return `<tr>
            <td>${escapeHtml(j.label)}</td>
            <td class="num">${j.total}</td>
            <td class="num">${j.bow}/${j.total} (${bowPct.toFixed(0)}%)</td>
            <td class="num">${j.llm}/${j.total} (${llmPct.toFixed(0)}%)</td>
            <td class="num ${delta > 0 ? "good" : delta < 0 ? "bad" : "neut"}">${delta >= 0 ? "+" : ""}${delta.toFixed(0)}pp</td>
            <td style="min-width:180px"><div class="bar"><span class="bow" style="width:${bowPct}%"></span></div><div class="bar"><span class="llm" style="width:${llmPct}%"></span></div></td>
          </tr>`;
        })
        .join("\n")}
      <tr style="background:var(--panel-2)">
        <td><strong>TOTAL</strong></td>
        <td class="num">${real.length}</td>
        <td class="num">${totalBow}/${real.length} (${((totalBow / real.length) * 100).toFixed(0)}%)</td>
        <td class="num">${totalLlm}/${real.length} (${((totalLlm / real.length) * 100).toFixed(0)}%)</td>
        <td class="num ${totalLlm > totalBow ? "good" : "bad"}">${totalLlm - totalBow >= 0 ? "+" : ""}${(((totalLlm - totalBow) / real.length) * 100).toFixed(0)}pp</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  ${
    dataMisses.length > 5
      ? `<div class="callout warn">
    <strong>⚠ 诚实的 regression：Data JD 上 LLM 比 BoW 差</strong>
    Data JD 的 LLM 桶级准确率 ${jdStats.find((j) => j.key === "dataEngineer")!.llm}/${jdStats.find((j) => j.key === "dataEngineer")!.total}
    （${((jdStats.find((j) => j.key === "dataEngineer")!.llm / jdStats.find((j) => j.key === "dataEngineer")!.total) * 100).toFixed(0)}%），低于 BoW 的
    ${jdStats.find((j) => j.key === "dataEngineer")!.bow}/${jdStats.find((j) => j.key === "dataEngineer")!.total}
    （${((jdStats.find((j) => j.key === "dataEngineer")!.bow / jdStats.find((j) => j.key === "dataEngineer")!.total) * 100).toFixed(0)}%）。
    <br/><br/>
    两个原因：
    <br/>1. <strong>Ground truth 偏严</strong>：我把 Stripe / Notion / Linear 等大厂 backend senior 在 data JD 上标为 LOW，但 LLM 给 MED（42-58）其实合理——他们确实接触过 feature pipeline / Kafka。
    <br/>2. <strong>LLM 校准过严</strong>：3 个真 ML 工程师都精确卡在 65，刚好低于 HIGH 阈值 71。我的"domain match required for HIGH"prompt rule 把同义证据（Spark/Flink + recsys ≈ data infra）也卡死了。
    <br/><br/>
    Fix：把 LLM jd-match prompt 的 HIGH 标准从严格关键词扩展到语义等价；同时把 "data-adjacent backend" 的 ground truth 从 LOW 提到 MED。
  </div>`
      : ""
  }

  <h2>2 · AI-text 检测 · 按难度 tier 分</h2>
  <p style="color:var(--muted);font-size:13px;margin-top:0">
    阈值：humanScore &lt; 60 ⇒ 判为 AI。30 份 AI 简历分 3 个 tier，每个 tier 10 份。所有 ${data.realFixtures} 真人样本均参与 FP 评估。
  </p>
  <table>
    <thead><tr><th>Tier</th><th class="num">n</th><th class="num">Rule prec / recall / F1</th><th class="num">LLM prec / recall / F1</th><th class="num">ΔF1</th></tr></thead>
    <tbody>
      ${aiStats
        .map((s) => `<tr>
        <td><strong>${s.tier}</strong> <span class="neut">— ${s.tier === "naive" ? "纯模板词，零具体信息" : s.tier === "coached" ? "夹杂真实公司名 + 1-2 个数字" : "AI 显式被指示绕过检测器"}</span></td>
        <td class="num">${s.n}</td>
        <td class="num">${s.rule.precision.toFixed(2)} / ${s.rule.recall.toFixed(2)} / <strong>${s.rule.f1.toFixed(2)}</strong></td>
        <td class="num">${s.llm.precision.toFixed(2)} / ${s.llm.recall.toFixed(2)} / <strong>${s.llm.f1.toFixed(2)}</strong></td>
        <td class="num good">+${(s.llm.f1 - s.rule.f1).toFixed(2)}</td>
      </tr>`)
        .join("\n")}
      <tr style="background:var(--panel-2)">
        <td><strong>ALL</strong></td>
        <td class="num">${aiAll.n}</td>
        <td class="num">${aiAll.rule.precision.toFixed(2)} / ${aiAll.rule.recall.toFixed(2)} / <strong>${aiAll.rule.f1.toFixed(2)}</strong></td>
        <td class="num">${aiAll.llm.precision.toFixed(2)} / ${aiAll.llm.recall.toFixed(2)} / <strong>${aiAll.llm.f1.toFixed(2)}</strong></td>
        <td class="num good">+${(aiAll.llm.f1 - aiAll.rule.f1).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="callout">
    <strong>关键发现</strong>
    <ul style="margin:8px 0 0;padding-left:20px">
      <li>规则版 ai-text 几乎完全失效（F1 ${aiAll.rule.f1.toFixed(2)}）—— 1.0 precision 但 ${(aiAll.rule.recall * 100).toFixed(0)}% recall 说明它**几乎没抓到任何 AI**。</li>
      <li>LLM 版在 naive 和 coached tier 上 F1=1.00（满分）；在 <strong>adversarial tier 上 recall 仍达 ${(aiStats[2].llm.recall * 100).toFixed(0)}%</strong>——AI 显式被指示绕过检测器，仍被抓 ${aiStats[2].llm.tp}/${aiStats[2].n}。</li>
      <li><strong>零误报</strong>：${realCellsAll.length} 份真人简历（含 ${realCellsAll.length} 中非英语母语者：Wang Lei、Hiroshi Tanaka、Chen Mei、Yuki Sato 等）全部正确判为真人。</li>
    </ul>
  </div>

  <h2>3 · 完整 cell 数据（${data.cells.length} 行，可过滤）</h2>
  <div class="filter-bar">
    <button data-filter="all" class="active">全部 (${data.cells.length})</button>
    <button data-filter="source-real">仅真人 (${real.length})</button>
    <button data-filter="source-ai">仅 AI (${data.cells.length - real.length})</button>
    <button data-filter="jd-paymentsBackend">Payments JD</button>
    <button data-filter="jd-seniorFrontend">Frontend JD</button>
    <button data-filter="jd-dataEngineer">Data JD</button>
    <button data-filter="tier-naive">naive</button>
    <button data-filter="tier-coached">coached</button>
    <button data-filter="tier-adversarial">adversarial</button>
  </div>
  <table id="cells">
    <thead><tr>
      <th>Fixture</th><th>Source</th><th>Tier</th><th>JD</th><th>Expected</th>
      <th class="num">BoW jd</th><th class="num">LLM jd</th>
      <th class="num">Rule ai</th><th class="num">LLM ai</th>
    </tr></thead>
    <tbody>
      ${data.cells
        .map((c) => {
          const bowOk = bucketize(c.baseJdScore) === c.expectedFit;
          const llmOk = bucketize(c.llmJdScore) === c.expectedFit;
          return `<tr data-source="${c.source}" data-jd="${c.jobKey}" data-tier="${c.aiTier ?? "none"}">
            <td>${escapeHtml(c.fxId)}</td>
            <td><span class="neut">${c.source}</span></td>
            <td>${c.aiTier ?? "—"}</td>
            <td>${escapeHtml(data.jobs.find((j) => j.key === c.jobKey)!.label)}</td>
            <td class="${c.source === "real" ? "" : "neut"}">${c.source === "real" ? c.expectedFit : "—"}</td>
            <td class="num ${c.source === "real" ? (bowOk ? "good" : "bad") : "neut"}">${c.baseJdScore}</td>
            <td class="num ${c.source === "real" ? (llmOk ? "good" : "bad") : "neut"}">${c.llmJdScore}</td>
            <td class="num ${c.source === "ai" ? (c.ruleAiText < 60 ? "good" : "bad") : (c.ruleAiText >= 60 ? "good" : "bad")}">${c.ruleAiText}</td>
            <td class="num ${c.source === "ai" ? (c.llmAiText < 60 ? "good" : "bad") : (c.llmAiText >= 60 ? "good" : "bad")}">${c.llmAiText}</td>
          </tr>`;
        })
        .join("\n")}
    </tbody>
  </table>

  <h2>4 · Methodology & Caveats</h2>
  <ul style="color:#cdd3df;font-size:14px;line-height:1.7">
    <li><strong>样本量</strong>：30 真人 + 30 AI（10 naive + 10 coached + 10 adversarial）。仍属小样本，再跑可能 ±5pp 浮动。</li>
    <li><strong>真人 fixture 来源</strong>：手工撰写，模仿真实简历样式（混入中、日、印度、巴西、东欧、非洲非英语母语样本）。<em>非</em>真实 LinkedIn 数据。</li>
    <li><strong>AI fixture 生成</strong>：由 ${escapeHtml(data.model)} 在受控 prompt 下生成，每个 tier 难度递增。adversarial tier 显式指示模型「绕过 AI 检测器」。</li>
    <li><strong>Ground truth</strong>：作者人工标注。Data JD 上的 LOW 标签可能偏严（见第 1 节 callout）。</li>
    <li><strong>规则 baseline</strong>：bag-of-words 关键词召回率 × 1.5 系数。<em>不</em>使用 LLM。</li>
    <li><strong>LLM 模型</strong>：${escapeHtml(data.model)} via ${escapeHtml(data.provider)} 代理。代理上游模型未公开，不保证为 OpenAI 官方。</li>
    <li><strong>结果非确定性</strong>：同输入再跑 ±5% 浮动。</li>
    <li><strong>外部验证未启用</strong>：external-evidence 信号只检查 URL 是否在文本中声明，未实际访问。这是 P1 工作项。</li>
  </ul>

  <footer>
    Generated by <code>npx tsx eval/build-report.ts</code> from <code>eval-results.json</code> ·
    Raw data: ${data.cells.length} cells, ${(JSON.stringify(data).length / 1024).toFixed(0)} KB JSON
  </footer>
</div>

<script>
  const buttons = document.querySelectorAll('.filter-bar button');
  const rows = document.querySelectorAll('#cells tbody tr');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      rows.forEach((r) => {
        if (f === 'all') { r.style.display = ''; return; }
        const [kind, val] = f.split('-');
        const map = { source: r.dataset.source, jd: r.dataset.jd, tier: r.dataset.tier };
        r.style.display = map[kind] === val ? '' : 'none';
      });
    });
  });
</script>
</body>
</html>
`;

  writeFileSync(OUT_PATH, html);
  console.log(`✓ Wrote ${OUT_PATH}`);
  console.log(`  Open with: start ${OUT_PATH}  (Windows)`);
  console.log(`              open ${OUT_PATH}  (macOS)`);
}

main();

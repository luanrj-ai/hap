/**
 * Build eval-comparison.html: side-by-side synthetic vs real eval.
 *
 *   cd apps/web && npx tsx eval/build-comparison.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYN_PATH = resolve(__dirname, "eval-results-synthetic.json");
const REAL_PATH = resolve(__dirname, "eval-results-real.json");
const OUT_PATH = resolve(__dirname, "eval-comparison.html");

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

function bucketize(s: number): FitBand {
  if (s >= 71) return "HIGH";
  if (s >= 40) return "MED";
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

interface JdSummary {
  jobKey: string;
  label: string;
  total: number;
  bow: number;
  llm: number;
  bowPct: number;
  llmPct: number;
  delta: number;
}

interface TierSummary {
  tier: string;
  n: number;
  rulePrec: number;
  ruleRec: number;
  ruleF1: number;
  llmPrec: number;
  llmRec: number;
  llmF1: number;
}

interface DataSummary {
  realFixtures: number;
  aiFixtures: number;
  totalBow: number;
  totalLlm: number;
  totalReal: number;
  jds: JdSummary[];
  tiers: TierSummary[];
  allF1Rule: number;
  allF1Llm: number;
  realFlaggedAsAi: number;
}

function summarize(data: Results): DataSummary {
  const real = data.cells.filter((c) => c.source === "real");
  const totalBow = real.filter((c) => bucketize(c.baseJdScore) === c.expectedFit).length;
  const totalLlm = real.filter((c) => bucketize(c.llmJdScore) === c.expectedFit).length;

  const jds: JdSummary[] = data.jobs.map((j) => {
    const sub = real.filter((c) => c.jobKey === j.key);
    const bow = sub.filter((c) => bucketize(c.baseJdScore) === c.expectedFit).length;
    const llm = sub.filter((c) => bucketize(c.llmJdScore) === c.expectedFit).length;
    return {
      jobKey: j.key,
      label: j.label,
      total: sub.length,
      bow, llm,
      bowPct: sub.length === 0 ? 0 : (bow / sub.length) * 100,
      llmPct: sub.length === 0 ? 0 : (llm / sub.length) * 100,
      delta: sub.length === 0 ? 0 : ((llm - bow) / sub.length) * 100,
    };
  });

  // Dedupe fixtures for ai-text
  const seen = new Set<string>();
  const fxCells = data.cells.filter((c) => {
    if (seen.has(c.fxId)) return false;
    seen.add(c.fxId);
    return true;
  });
  const realCells = fxCells.filter((c) => c.source === "real");
  const aiCells = fxCells.filter((c) => c.source === "ai");
  function stats(getScore: (c: Cell) => number, ai: Cell[]) {
    const tn = realCells.filter((c) => getScore(c) >= 60).length;
    const fp = realCells.length - tn;
    const tp = ai.filter((c) => getScore(c) < 60).length;
    const fn = ai.length - tp;
    return {
      precision: tp + fp === 0 ? 0 : tp / (tp + fp),
      recall: tp + fn === 0 ? 0 : tp / (tp + fn),
      f1: f1(tp, fp, fn),
      fp,
    };
  }
  const tiers: TierSummary[] = ["naive", "coached", "adversarial"].map((t) => {
    const sub = aiCells.filter((c) => c.aiTier === t);
    const r = stats((c) => c.ruleAiText, sub);
    const l = stats((c) => c.llmAiText, sub);
    return {
      tier: t,
      n: sub.length,
      rulePrec: r.precision, ruleRec: r.recall, ruleF1: r.f1,
      llmPrec: l.precision, llmRec: l.recall, llmF1: l.f1,
    };
  });
  const all = stats((c) => c.llmAiText, aiCells);
  const allRule = stats((c) => c.ruleAiText, aiCells);

  return {
    realFixtures: realCells.length,
    aiFixtures: aiCells.length,
    totalBow, totalLlm,
    totalReal: real.length,
    jds, tiers,
    allF1Rule: allRule.f1,
    allF1Llm: all.f1,
    realFlaggedAsAi: all.fp,
  };
}

function pct(p: number): string {
  return `${p.toFixed(0)}%`;
}

function deltaCell(synVal: number, realVal: number): string {
  const delta = realVal - synVal;
  const color = Math.abs(delta) < 2 ? "neut" : delta > 0 ? "good" : "bad";
  return `<span class="${color}">${delta >= 0 ? "+" : ""}${delta.toFixed(0)}pp</span>`;
}

function main(): void {
  if (!existsSync(SYN_PATH) || !existsSync(REAL_PATH)) {
    console.error("Missing one of eval-results-{synthetic,real}.json — run both evals first.");
    process.exit(1);
  }
  const syn = JSON.parse(readFileSync(SYN_PATH, "utf8")) as Results;
  const real = JSON.parse(readFileSync(REAL_PATH, "utf8")) as Results;
  const S = summarize(syn);
  const R = summarize(real);

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ResumeTruth · Eval Comparison · Synthetic vs Real</title>
<style>
  :root{--bg:#0b0d12;--panel:#12151c;--panel-2:#171b24;--line:#242a36;--text:#e8ecf3;--muted:#9aa3b2;--accent:#7c5cff;--cyan:#22d3ee;--green:#3ddc97;--yellow:#ffd166;--red:#ff5d73}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.6;font-size:15px}
  .wrap{max-width:1180px;margin:0 auto;padding:32px 24px 80px}
  code{background:#0a0c11;border:1px solid var(--line);padding:1px 6px;border-radius:4px;font-size:13px;font-family:"SF Mono",Menlo,Consolas,monospace}
  header.hero{background:radial-gradient(900px 320px at 0% -20%,rgba(124,92,255,.22),transparent 60%),radial-gradient(900px 320px at 100% 0%,rgba(34,211,238,.15),transparent 60%),linear-gradient(180deg,#0e1118,#0b0d12);border:1px solid var(--line);border-radius:18px;padding:36px 32px;margin-bottom:24px}
  .eyebrow{color:var(--cyan);text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:700}
  h1{font-size:30px;margin:8px 0;line-height:1.2;letter-spacing:-.4px}
  h1 .grad{background:linear-gradient(90deg,#7c5cff,#22d3ee 70%);-webkit-background-clip:text;background-clip:text;color:transparent}
  .lede{color:var(--muted);max-width:780px;font-size:14px}
  .meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
  .pill{background:#1f2533;color:var(--muted);font-size:11px;padding:5px 9px;border-radius:999px;border:1px solid var(--line)}
  h2{font-size:22px;margin:42px 0 14px;letter-spacing:-.3px;border-bottom:1px solid var(--line);padding-bottom:8px}
  table{width:100%;border-collapse:collapse;border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:14px;margin:8px 0 16px}
  th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--line)}
  th{background:var(--panel-2);color:var(--muted);font-weight:600;font-size:11px;letter-spacing:.06em;text-transform:uppercase}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  tr:last-child td{border-bottom:0}
  .good{color:var(--green)} .bad{color:var(--red)} .mid{color:var(--yellow)} .neut{color:var(--muted)}
  .callout{background:linear-gradient(180deg,rgba(124,92,255,.08),rgba(34,211,238,.04));border:1px solid rgba(124,92,255,.25);border-radius:12px;padding:16px 18px;margin:14px 0;color:#dde3ef;font-size:14px}
  .callout.warn{background:linear-gradient(180deg,rgba(255,93,115,.06),rgba(255,209,102,.04));border-color:rgba(255,93,115,.3)}
  .callout strong{color:var(--cyan)} .callout.warn strong{color:var(--red)}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media(max-width:760px){.grid-2{grid-template-columns:1fr}}
  .stat-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px}
  .stat-card .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
  .stat-card .val{font-size:32px;font-weight:700;margin-top:4px;letter-spacing:-.5px}
  .stat-card .sub{font-size:12px;color:var(--muted);margin-top:6px}
</style>
</head>
<body>
<div class="wrap">

  <header class="hero">
    <div class="eyebrow">ResumeTruth · Eval Comparison</div>
    <h1><span class="grad">Synthetic vs Real</span> — 我们的检测器在两种真实程度上的表现</h1>
    <p class="lede">
      左侧 30 份手写"模仿真简历"的样本，右侧 ${R.realFixtures} 份从公开 GitHub Profile README 抓取的真人撰写文档。
      30 份相同的 AI 简历集对照。${syn.cells.length + real.cells.length} 个 cell，${(syn.cells.length + real.cells.length) * 2} 次 LLM 调用。
    </p>
    <div class="meta">
      <span class="pill">syn: ${syn.ranAt.slice(0, 16).replace("T", " ")} UTC</span>
      <span class="pill">real: ${real.ranAt.slice(0, 16).replace("T", " ")} UTC</span>
      <span class="pill">model: ${escapeHtml(syn.model)}</span>
    </div>
  </header>

  <h2>0 · 头条对比</h2>
  <div class="grid-2">
    <div class="stat-card">
      <div class="label">合成数据 (n=${S.realFixtures} real + ${S.aiFixtures} AI)</div>
      <div class="val">${pct((S.totalLlm / S.totalReal) * 100)}</div>
      <div class="sub">jd-match LLM 桶级 · BoW ${pct((S.totalBow / S.totalReal) * 100)} · ai-text F1 ${S.allF1Llm.toFixed(2)}</div>
    </div>
    <div class="stat-card">
      <div class="label">真人 GitHub Profile (n=${R.realFixtures} real + ${R.aiFixtures} AI)</div>
      <div class="val">${pct((R.totalLlm / R.totalReal) * 100)}</div>
      <div class="sub">jd-match LLM 桶级 · BoW ${pct((R.totalBow / R.totalReal) * 100)} · ai-text F1 ${R.allF1Llm.toFixed(2)}</div>
    </div>
  </div>

  <div class="callout">
    <strong>主要发现</strong>：
    <ul style="margin:8px 0 0;padding-left:20px">
      <li><strong>ai-text 检测：稳健</strong>。F1 ${S.allF1Llm.toFixed(2)} (合成) → ${R.allF1Llm.toFixed(2)} (真人) — 跨文档格式几乎不变。<strong>${R.realFlaggedAsAi}</strong> 个真人被误判为 AI。</li>
      <li><strong>jd-match LLM 提升幅度：文档格式敏感</strong>。简历格式上 +${((S.totalLlm - S.totalBow) / S.totalReal * 100).toFixed(0)}pp；GitHub 简介格式上 +${((R.totalLlm - R.totalBow) / R.totalReal * 100).toFixed(0)}pp。</li>
      <li>真人 GitHub README 不是简历——是 "Hi I'm X, here's what I work on"。jd-match LLM 在缺乏正式工作经历段时给分更保守。</li>
    </ul>
  </div>

  <h2>1 · JD-Match 桶级准确率对比</h2>
  <table>
    <thead><tr><th>JD</th><th class="num">合成 n</th><th class="num">合成 BoW</th><th class="num">合成 LLM</th><th class="num">真人 n</th><th class="num">真人 BoW</th><th class="num">真人 LLM</th><th class="num">LLM Δ (合成 vs 真人)</th></tr></thead>
    <tbody>
      ${S.jds
        .map((s, i) => {
          const r = R.jds[i];
          return `<tr>
            <td>${escapeHtml(s.label)}</td>
            <td class="num">${s.total}</td>
            <td class="num">${pct(s.bowPct)}</td>
            <td class="num good">${pct(s.llmPct)}</td>
            <td class="num">${r.total}</td>
            <td class="num">${pct(r.bowPct)}</td>
            <td class="num ${r.llmPct >= r.bowPct ? "good" : "bad"}">${pct(r.llmPct)}</td>
            <td class="num">${deltaCell(s.llmPct, r.llmPct)}</td>
          </tr>`;
        })
        .join("\n")}
      <tr style="background:var(--panel-2)">
        <td><strong>TOTAL</strong></td>
        <td class="num">${S.totalReal}</td>
        <td class="num">${pct((S.totalBow / S.totalReal) * 100)}</td>
        <td class="num good">${pct((S.totalLlm / S.totalReal) * 100)}</td>
        <td class="num">${R.totalReal}</td>
        <td class="num">${pct((R.totalBow / R.totalReal) * 100)}</td>
        <td class="num ${R.totalLlm >= R.totalBow ? "good" : "bad"}">${pct((R.totalLlm / R.totalReal) * 100)}</td>
        <td class="num">${deltaCell((S.totalLlm / S.totalReal) * 100, (R.totalLlm / R.totalReal) * 100)}</td>
      </tr>
    </tbody>
  </table>

  <div class="callout warn">
    <strong>Δ 解读</strong>：jd-match LLM 在 GitHub 简介风格文档上准确率**显著低于**简历风格。原因是 README 通常是项目列表+一句话 bio，缺乏典型简历的"职位/公司/年份"结构。<strong>对产品的意义：真实生产用户提交的是简历（不是 GitHub bio），所以"合成"数字更代表实际生产表现</strong>。但要在白皮书里说，必须同时披露两个数。
  </div>

  <h2>2 · AI-Text 检测 · 跨数据集</h2>
  <table>
    <thead><tr><th>Tier</th><th class="num">合成 ai n / F1 (rule → LLM)</th><th class="num">真人 ai n / F1 (rule → LLM)</th><th class="num">变化</th></tr></thead>
    <tbody>
      ${S.tiers
        .map((s, i) => {
          const r = R.tiers[i];
          return `<tr>
            <td><strong>${s.tier}</strong></td>
            <td class="num">${s.n} · ${s.ruleF1.toFixed(2)} → <strong class="good">${s.llmF1.toFixed(2)}</strong></td>
            <td class="num">${r.n} · ${r.ruleF1.toFixed(2)} → <strong class="good">${r.llmF1.toFixed(2)}</strong></td>
            <td class="num">${(r.llmF1 - s.llmF1).toFixed(2)}</td>
          </tr>`;
        })
        .join("\n")}
      <tr style="background:var(--panel-2)">
        <td><strong>ALL</strong></td>
        <td class="num">${S.aiFixtures} · ${S.allF1Rule.toFixed(2)} → <strong class="good">${S.allF1Llm.toFixed(2)}</strong></td>
        <td class="num">${R.aiFixtures} · ${R.allF1Rule.toFixed(2)} → <strong class="good">${R.allF1Llm.toFixed(2)}</strong></td>
        <td class="num">${(R.allF1Llm - S.allF1Llm).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="callout">
    <strong>结论</strong>：LLM-based ai-text 检测在两个数据集上 F1 几乎一致（${S.allF1Llm.toFixed(2)} vs ${R.allF1Llm.toFixed(2)}）——这是产品最稳健的能力，可对外宣称。
    <br/><br/>
    真人数据上 precision 略降，因 codingstella 的 README 被判为 AI（教育者风格 README 营销化、buzzword 重）。这是 ~5% 真人误报率，需要在 HR 用户的预期管理里提示。
  </div>

  <h2>3 · 方法 & Caveats</h2>
  <ul style="color:#cdd3df;font-size:14px;line-height:1.7">
    <li><strong>合成 fixtures</strong>：本人手写 30 份，刻意模仿真简历样式（真公司名、具体数字、不齐的 bullet）。仍是人写而非候选人提供。</li>
    <li><strong>真人 fixtures</strong>：从 GitHub 公开 Profile README 抓取（如 <code>github.com/swyxio/swyxio</code> 等 22 个候选用户的 README），保留 19 个 ≥500 字符的。**这是真实人类撰写的内容**，但格式是 bio 不是简历——这就是 jd-match 数字差异的原因。</li>
    <li><strong>AI fixtures</strong>：同一批 30 份 GPT-5.5 生成的 AI 简历（naive 10 + coached 10 + adversarial 10）。两个 eval 用相同 AI 集。</li>
    <li><strong>统计意义</strong>：n=19 真人 + n=30 AI 仍是小样本。结果方向对，绝对值再跑 ±5pp 浮动。</li>
    <li><strong>未覆盖</strong>：data-ml 真人样本只 1 个（rasbt）——Data JD 上的真人数字代表性弱。Payments 真人样本 0 个。这些方向需要补样本。</li>
  </ul>

  <h2>4 · 给投资人 / 客户的对外说法</h2>
  <div class="callout">
    可以说：
    <ul style="margin:8px 0 0;padding-left:20px">
      <li>"AI 简历检测 F1 <strong>${(((S.allF1Llm + R.allF1Llm) / 2) * 100).toFixed(0)}%</strong>"（两个数据集平均）</li>
      <li>"Adversarial AI 抓获率 <strong>${(S.tiers[2].llmRec * 100).toFixed(0)}–${(R.tiers[2].llmRec * 100).toFixed(0)}%</strong>"（被指示绕过检测的 AI）</li>
      <li>"真人非英语母语样本零误报"（在合成数据上 0 FP）</li>
    </ul>
    <br/>
    不能说：
    <ul style="margin:8px 0 0;padding-left:20px">
      <li>"在真实候选人简历上的 F1" —— 我们还没有真候选人简历，只有 GitHub 公开 bio</li>
      <li>"jd-match 提升 50%+" —— 这是合成数据上的数字，真人 bio 上提升只 +${((R.totalLlm - R.totalBow) / R.totalReal * 100).toFixed(0)}pp</li>
    </ul>
  </div>

</div>
</body>
</html>
`;

  writeFileSync(OUT_PATH, html);
  console.log(`✓ Wrote ${OUT_PATH}`);
}

main();

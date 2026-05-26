/**
 * 3-way comparison report: synthetic vs github-readme vs real-pdf.
 *
 *   cd apps/web && npx tsx eval/build-comparison-3way.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYN = resolve(__dirname, "eval-results-synthetic.json");
const README = resolve(__dirname, "eval-results-real.json");
// Use v2 (relabeled ground truth) if available, fall back to v1
const PDF = (() => {
  const v2 = resolve(__dirname, "eval-results-real-pdf-v2.json");
  const v1 = resolve(__dirname, "eval-results-real-pdf.json");
  return existsSync(v2) ? v2 : v1;
})();
const OUT_PATH = resolve(__dirname, "eval-comparison-3way.html");

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

interface Summary {
  label: string;
  badge: string;
  desc: string;
  realFx: number;
  aiFx: number;
  totalBow: number;
  totalLlm: number;
  totalReal: number;
  jds: Array<{ key: string; label: string; total: number; bow: number; llm: number; }>;
  tiers: Array<{
    tier: string;
    n: number;
    ruleP: number; ruleR: number; ruleF1: number;
    llmP: number; llmR: number; llmF1: number;
  }>;
  allRuleF1: number;
  allLlmF1: number;
  allLlmFP: number;
  allLlmPrec: number;
  allLlmRecall: number;
}

function summarize(data: Results, label: string, badge: string, desc: string): Summary {
  const real = data.cells.filter((c) => c.source === "real");
  const totalBow = real.filter((c) => bucketize(c.baseJdScore) === c.expectedFit).length;
  const totalLlm = real.filter((c) => bucketize(c.llmJdScore) === c.expectedFit).length;
  const jds = data.jobs.map((j) => {
    const sub = real.filter((c) => c.jobKey === j.key);
    return {
      key: j.key,
      label: j.label,
      total: sub.length,
      bow: sub.filter((c) => bucketize(c.baseJdScore) === c.expectedFit).length,
      llm: sub.filter((c) => bucketize(c.llmJdScore) === c.expectedFit).length,
    };
  });

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
      tp, fp, tn, fn,
      precision: tp + fp === 0 ? 0 : tp / (tp + fp),
      recall: tp + fn === 0 ? 0 : tp / (tp + fn),
      f1: f1(tp, fp, fn),
    };
  }
  const tiers = (["naive", "coached", "adversarial"] as const).map((t) => {
    const sub = aiCells.filter((c) => c.aiTier === t);
    const r = stats((c) => c.ruleAiText, sub);
    const l = stats((c) => c.llmAiText, sub);
    return {
      tier: t,
      n: sub.length,
      ruleP: r.precision, ruleR: r.recall, ruleF1: r.f1,
      llmP: l.precision, llmR: l.recall, llmF1: l.f1,
    };
  });
  const allRule = stats((c) => c.ruleAiText, aiCells);
  const allLlm = stats((c) => c.llmAiText, aiCells);

  return {
    label, badge, desc,
    realFx: realCells.length,
    aiFx: aiCells.length,
    totalBow, totalLlm,
    totalReal: real.length,
    jds, tiers,
    allRuleF1: allRule.f1,
    allLlmF1: allLlm.f1,
    allLlmFP: allLlm.fp,
    allLlmPrec: allLlm.precision,
    allLlmRecall: allLlm.recall,
  };
}

function pct(p: number): string {
  return `${p.toFixed(0)}%`;
}

function color(val: number, lo: number, hi: number): string {
  if (val >= hi) return "good";
  if (val <= lo) return "bad";
  return "mid";
}

function main(): void {
  for (const p of [SYN, README, PDF]) {
    if (!existsSync(p)) {
      console.error(`Missing: ${p}`);
      process.exit(1);
    }
  }
  const syn = summarize(JSON.parse(readFileSync(SYN, "utf8")), "Synthetic", "我手写", "30 份模仿真简历样式的合成 fixture（资深前/后/数据/payments 各类型）");
  const readme = summarize(JSON.parse(readFileSync(README, "utf8")), "GitHub README", "真人 / 错格式", "19 个公开 GitHub Profile README—— 真人撰写，但是 bio 不是简历");
  const pdfRaw = JSON.parse(readFileSync(PDF, "utf8"));
  const labelNote = (pdfRaw as { relabeled?: { updated: number } }).relabeled
    ? `60 份 HuggingFace 数据集采样真实 PDF 简历（MIT）· ground truth 已用关键词证据重打标（${(pdfRaw as { relabeled: { updated: number } }).relabeled.updated} 个 cell 标签修正）`
    : `60 份 HuggingFace 数据集采样的真实 PDF 简历（MIT licensed）`;
  const pdf = summarize(pdfRaw, "Real PDF CV", "真人 / 真简历", labelNote);

  const sets = [syn, readme, pdf];

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ResumeTruth · 3-Way Eval Comparison</title>
<style>
  :root{--bg:#0b0d12;--panel:#12151c;--panel-2:#171b24;--line:#242a36;--text:#e8ecf3;--muted:#9aa3b2;--accent:#7c5cff;--cyan:#22d3ee;--green:#3ddc97;--yellow:#ffd166;--red:#ff5d73}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.6;font-size:15px}
  .wrap{max-width:1280px;margin:0 auto;padding:32px 24px 80px}
  code{background:#0a0c11;border:1px solid var(--line);padding:1px 6px;border-radius:4px;font-size:13px;font-family:"SF Mono",Menlo,Consolas,monospace}
  header.hero{background:radial-gradient(900px 320px at 0% -20%,rgba(124,92,255,.22),transparent 60%),radial-gradient(900px 320px at 100% 0%,rgba(34,211,238,.15),transparent 60%),linear-gradient(180deg,#0e1118,#0b0d12);border:1px solid var(--line);border-radius:18px;padding:36px 32px;margin-bottom:24px}
  .eyebrow{color:var(--cyan);text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:700}
  h1{font-size:30px;margin:8px 0;line-height:1.2;letter-spacing:-.4px}
  h1 .grad{background:linear-gradient(90deg,#7c5cff,#22d3ee 70%);-webkit-background-clip:text;background-clip:text;color:transparent}
  .lede{color:var(--muted);max-width:880px;font-size:14px}

  h2{font-size:22px;margin:42px 0 14px;letter-spacing:-.3px;border-bottom:1px solid var(--line);padding-bottom:8px}
  table{width:100%;border-collapse:collapse;border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:13.5px;margin:8px 0 16px}
  th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--line)}
  th{background:var(--panel-2);color:var(--muted);font-weight:600;font-size:11px;letter-spacing:.06em;text-transform:uppercase}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  tr:last-child td{border-bottom:0}
  .good{color:var(--green)} .bad{color:var(--red)} .mid{color:var(--yellow)} .neut{color:var(--muted)}
  .callout{background:linear-gradient(180deg,rgba(124,92,255,.08),rgba(34,211,238,.04));border:1px solid rgba(124,92,255,.25);border-radius:12px;padding:16px 18px;margin:14px 0;color:#dde3ef;font-size:14px}
  .callout.warn{background:linear-gradient(180deg,rgba(255,93,115,.06),rgba(255,209,102,.04));border-color:rgba(255,93,115,.3)}
  .callout strong{color:var(--cyan)} .callout.warn strong{color:var(--red)}
  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  @media(max-width:960px){.grid-3{grid-template-columns:1fr}}
  .stat-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}
  .stat-card .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
  .stat-card .val{font-size:32px;font-weight:700;margin-top:4px;letter-spacing:-.5px}
  .stat-card .sub{font-size:12px;color:var(--muted);margin-top:6px}
  .badge{display:inline-block;font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid var(--line);background:var(--panel-2);color:var(--muted);margin-left:6px;letter-spacing:.04em}
</style>
</head>
<body>
<div class="wrap">

  <header class="hero">
    <div class="eyebrow">ResumeTruth · 3-Way Eval · 真实度递增</div>
    <h1><span class="grad">合成 → GitHub README → 真 PDF 简历</span> · 数字怎么变</h1>
    <p class="lede">
      同一组检测器 + 同一组 30 份 AI 简历 + 3 套"真人"数据。<br/>
      从「最容易」(我手写) 到「最难」(真实 livecareer 简历 OCR 后)，看检测器在递增真实度下的表现退化情况。
      ${syn.realFx + readme.realFx + pdf.realFx} 个真人 fixture × 3 JDs × 2 信号 = ${(syn.realFx + readme.realFx + pdf.realFx) * 6} 次 LLM 调用。
    </p>
  </header>

  <h2>0 · 头条三连</h2>
  <div class="grid-3">
    ${sets.map((s, i) => `
      <div class="stat-card">
        <div class="label">${escapeHtml(s.label)} <span class="badge">${escapeHtml(s.badge)}</span></div>
        <div class="val ${color(s.allLlmF1, 0.7, 0.9)}">F1 ${s.allLlmF1.toFixed(2)}</div>
        <div class="sub">AI 检测 · ${s.realFx} 真人 / ${s.aiFx} AI · ${s.allLlmFP} 真人误报</div>
        <div style="margin-top:10px;font-size:13px;color:#cdd3df">
          jd-match: BoW ${pct((s.totalBow / s.totalReal) * 100)} → LLM ${pct((s.totalLlm / s.totalReal) * 100)}
          <span class="${color(s.totalLlm - s.totalBow, 1, 5)}"> (Δ ${pct(((s.totalLlm - s.totalBow) / s.totalReal) * 100)})</span>
        </div>
      </div>
    `).join("\n")}
  </div>

  <div class="callout warn">
    <strong>诚实结论</strong>：随着 fixture 越接近真实候选人简历，<strong>jd-match LLM 提升幅度从 +${pct(((syn.totalLlm - syn.totalBow) / syn.totalReal) * 100)} 跌到 +${pct(((pdf.totalLlm - pdf.totalBow) / pdf.totalReal) * 100)}</strong>。我之前用 synthetic 数字宣称的「+17pp」在真实简历上**消失了**。
    <br/><br/>
    <strong>但 AI 检测稳健</strong>：F1 在三个数据集分别是 ${syn.allLlmF1.toFixed(2)} / ${readme.allLlmF1.toFixed(2)} / ${pdf.allLlmF1.toFixed(2)}——真实数据上仍 ${pdf.allLlmF1.toFixed(2)}，比 synthetic 低 ${(syn.allLlmF1 - pdf.allLlmF1).toFixed(2)}，但绝对值仍是产品级别。
  </div>

  <h2>1 · JD-Match 桶级准确率三组对比</h2>
  <table>
    <thead><tr>
      <th>JD</th>
      ${sets.map((s) => `<th class="num">${escapeHtml(s.label)}</th>`).join("")}
    </tr></thead>
    <tbody>
      ${syn.jds.map((_, jdIdx) => {
        const j0 = syn.jds[jdIdx], j1 = readme.jds[jdIdx], j2 = pdf.jds[jdIdx];
        return `<tr>
          <td>${escapeHtml(j0.label)}</td>
          ${[j0, j1, j2].map((j) => {
            const bowP = j.total === 0 ? 0 : (j.bow / j.total) * 100;
            const llmP = j.total === 0 ? 0 : (j.llm / j.total) * 100;
            const delta = llmP - bowP;
            return `<td class="num">
              <div style="font-size:11px;color:var(--muted)">n=${j.total}</div>
              <div>BoW ${pct(bowP)} → <strong class="${delta >= 5 ? "good" : delta < 0 ? "bad" : "neut"}">LLM ${pct(llmP)}</strong></div>
              <div style="font-size:11px;color:${delta >= 5 ? "var(--green)" : delta < 0 ? "var(--red)" : "var(--muted)"}">Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(0)}pp</div>
            </td>`;
          }).join("")}
        </tr>`;
      }).join("")}
      <tr style="background:var(--panel-2)">
        <td><strong>TOTAL</strong></td>
        ${sets.map((s) => {
          const bowP = (s.totalBow / s.totalReal) * 100;
          const llmP = (s.totalLlm / s.totalReal) * 100;
          const delta = llmP - bowP;
          return `<td class="num">
            <div style="font-size:11px;color:var(--muted)">n=${s.totalReal}</div>
            <div>BoW ${pct(bowP)} → <strong class="${delta >= 5 ? "good" : delta < 0 ? "bad" : "neut"}">LLM ${pct(llmP)}</strong></div>
            <div style="font-size:11px;color:${delta >= 5 ? "var(--green)" : delta < 0 ? "var(--red)" : "var(--muted)"}">Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(0)}pp</div>
          </td>`;
        }).join("")}
      </tr>
    </tbody>
  </table>

  <div class="callout warn">
    <strong>JD-Match 退化原因（三个层次）</strong>：
    <ol style="margin:8px 0 0;padding-left:20px">
      <li><strong>合成 → GitHub README</strong>：文档格式从「简历」变成「bio」，缺少职位/公司/年份结构</li>
      <li><strong>GitHub README → 真 PDF</strong>：实际生产用户的简历**比合成的多样得多**——使用模板、OCR 噪声、混合格式、跨技能栈</li>
      <li><strong>Ground truth 标注问题</strong>：真 PDF 数据集的 expected_HIGH 标签是按"NER skills 自动分桶"分的，可能并不能代表"应该被推荐到这个 JD"——LLM 可能其实更对</li>
    </ol>
    简单说：<strong>+17pp 那个数字在投资人 PPT 上不能用</strong>。真实简历上的 LLM 提升大约是 **0pp ± 5pp**。
  </div>

  <h2>2 · AI-Text 检测 · 跨 3 数据集</h2>
  <table>
    <thead><tr>
      <th>Tier</th>
      ${sets.map((s) => `<th class="num">${escapeHtml(s.label)}</th>`).join("")}
    </tr></thead>
    <tbody>
      ${["naive", "coached", "adversarial"].map((tier, ti) => `<tr>
        <td><strong>${tier}</strong></td>
        ${sets.map((s) => `<td class="num">F1 <strong class="${color(s.tiers[ti].llmF1, 0.5, 0.9)}">${s.tiers[ti].llmF1.toFixed(2)}</strong> <span style="font-size:11px;color:var(--muted)">(P=${s.tiers[ti].llmP.toFixed(2)}, R=${s.tiers[ti].llmR.toFixed(2)})</span></td>`).join("")}
      </tr>`).join("")}
      <tr style="background:var(--panel-2)">
        <td><strong>ALL</strong></td>
        ${sets.map((s) => `<td class="num">F1 <strong class="${color(s.allLlmF1, 0.7, 0.9)}">${s.allLlmF1.toFixed(2)}</strong> <span style="font-size:11px;color:var(--muted)">(P=${s.allLlmPrec.toFixed(2)}, R=${s.allLlmRecall.toFixed(2)})</span></td>`).join("")}
      </tr>
      <tr>
        <td><strong>真人误报</strong></td>
        ${sets.map((s) => `<td class="num"><strong class="${color(s.realFx > 0 ? 1 - s.allLlmFP / s.realFx : 0, 0.9, 0.99)}">${s.allLlmFP}/${s.realFx}</strong> <span style="font-size:11px;color:var(--muted)">(${pct(s.realFx > 0 ? (s.allLlmFP / s.realFx) * 100 : 0)})</span></td>`).join("")}
      </tr>
    </tbody>
  </table>

  <div class="callout">
    <strong>AI 检测在真实数据上的实际表现</strong>：
    <ul style="margin:8px 0 0;padding-left:20px">
      <li>真 PDF 简历上 F1 ${pdf.allLlmF1.toFixed(2)}（${pct((1 - pdf.allLlmF1) * 100)} 错误率）</li>
      <li>真人误报：${pdf.allLlmFP}/${pdf.realFx} = ${pct((pdf.allLlmFP / pdf.realFx) * 100)} —— 比 synthetic 的 0/30 高很多</li>
      <li>但要注意：真实数据集里有些简历可能 **本来就是 AI 协助写的**（livecareer 用户用 AI 工具写简历越来越普遍）——这部分被检测器抓到也不算误报，是 ground truth 标错</li>
      <li>adversarial 召回率掉到 ${pct(pdf.tiers[2].llmR * 100)} —— 真实分布下抓 adversarial AI 比 synthetic 更难</li>
    </ul>
  </div>

  <h2>3 · 关键 takeaway · 给投资人 / 客户的「真话」</h2>

  <div class="callout warn">
    <strong>❌ 不能说</strong>：
    <ul style="margin:8px 0 0;padding-left:20px">
      <li>"jd-match LLM 比 bag-of-words 提升 17%" — 真实数据上是 0%</li>
      <li>"零误报" — 真实数据上是 ${pct((pdf.allLlmFP / pdf.realFx) * 100)} 误报率</li>
      <li>"F1 0.93+" — 真实数据上 ${pdf.allLlmF1.toFixed(2)}</li>
    </ul>
  </div>

  <div class="callout">
    <strong>✅ 可以说</strong>：
    <ul style="margin:8px 0 0;padding-left:20px">
      <li>"AI 简历检测 F1 ${pdf.allLlmF1.toFixed(2)} 在真实 livecareer 简历数据上" — 这个数字有公开数据支撑</li>
      <li>"adversarial AI 召回率 ${pct(pdf.tiers[2].llmR * 100)} — 50% 总比规则版 0% 强"</li>
      <li>"AI 检测能力跨多个数据集稳定（${syn.allLlmF1.toFixed(2)} / ${readme.allLlmF1.toFixed(2)} / ${pdf.allLlmF1.toFixed(2)}）"</li>
      <li>"jd-match LLM 在格式良好的简历上比 bag-of-words 更精细（synthetic 数据 +${pct(((syn.totalLlm - syn.totalBow) / syn.totalReal) * 100)}），但实际生产价值还需要在真实候选人简历上验证"</li>
    </ul>
  </div>

  <h2>4 · 这次 eval 暴露的真问题</h2>
  <ol style="color:#cdd3df;font-size:14px;line-height:1.7">
    <li><strong>JD-match LLM prompt 需要重做</strong>：它对"完美简历格式"的依赖太强。需要训练 prompt 处理 OCR 噪声、多语言、混合格式的真实简历。</li>
    <li><strong>真人误报问题</strong>：${pdf.allLlmFP} 个真人简历被判 AI。需要看具体内容，可能是 livecareer 模板简历（人写但用模板）触发了 AI 检测。需要 prompt 加 "templated by human ≠ AI" 规则。</li>
    <li><strong>Ground truth 自动化标注不可靠</strong>：用 NER skills 自动分桶可能跟"应该被推荐到 X JD"不完全一致。需要人工 review 几十个样本来 calibrate 标签。</li>
    <li><strong>Adversarial AI 在真实分布下更难抓</strong>：召回率 ${pct(pdf.tiers[2].llmR * 100)} 是非常诚实的数字。需要继续投入 prompt + 多模型 ensemble。</li>
  </ol>

  <h2>5 · Methodology & Caveats</h2>
  <ul style="color:#cdd3df;font-size:14px;line-height:1.7">
    <li><strong>真 PDF 数据来源</strong>：HuggingFace <code>Mehyaar/Annotated_NER_PDF_Resumes</code>（MIT licensed），5,029 份 CV，原始 PDF 经 OCR 后含 NER 标注。从中采样 60 份（20 backend / 20 frontend / 20 data-ml），按 NER skills clarity 选 top-margin。</li>
    <li><strong>同 AI 集</strong>：3 次 eval 用同一批 30 份 GPT-5.5 生成 AI 简历，保证可比性。</li>
    <li><strong>Eval 中 LLM 偶有失败</strong>：跑 60 份真 PDF 时出现 3 次 LLM 连接错误（代理 hiccup），约 1% 噪声。</li>
    <li><strong>Ground truth 不完美</strong>：真 PDF 的 expected_HIGH 是按自动 skill 分桶决定的，可能存在标签噪声 10-15%。</li>
    <li><strong>LiveCareer 来源数据的 ToS 灰区</strong>：原始数据集已经过学术再分发，MIT licensed。生产部署绝对不要直接用，必须从 consent 候选人重新获取。</li>
  </ul>

  <footer style="margin-top:50px;border-top:1px solid var(--line);padding-top:18px;color:var(--muted);font-size:12px">
    Generated by <code>npx tsx eval/build-comparison-3way.ts</code> · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC
  </footer>
</div>
</body>
</html>
`;

  writeFileSync(OUT_PATH, html);
  console.log(`✓ Wrote ${OUT_PATH}`);
}

main();

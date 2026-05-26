"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

interface BatchItem {
  filename: string;
  ok: boolean;
  error?: string;
  scoreId?: string;
  candidateName?: string;
  authenticity?: number;
  verifiability?: number;
  interview?: number;
  pageCount?: number;
  charCount?: number;
}

interface BatchResponse {
  total: number;
  succeeded: number;
  failed: number;
  items: BatchItem[];
}

type SortKey = "interview" | "authenticity" | "verifiability" | "name";

function colorOf(score?: number) {
  if (score == null) return "text-[#9aa3b2]";
  if (score >= 75) return "text-green";
  if (score >= 50) return "text-yellow";
  return "text-red";
}

function bandLabel(interview?: number, authenticity?: number) {
  if (interview == null || authenticity == null) return { text: "—", color: "text-[#9aa3b2]" };
  if (authenticity < 50) return { text: "⚠ 真实度低", color: "text-red" };
  if (interview >= 65) return { text: "推荐面试", color: "text-green" };
  if (interview >= 50) return { text: "可纳入", color: "text-yellow" };
  return { text: "暂不推荐", color: "text-[#9aa3b2]" };
}

export default function BatchPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [jd, setJd] = useState("");
  const [enhance, setEnhance] = useState(false);
  const [verify, setVerify] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("interview");
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf"),
    );
    if (dropped.length === 0) {
      setError("请拖入 .pdf 文件（其他格式已被过滤）");
      return;
    }
    setError(null);
    setFiles((prev) => [...prev, ...dropped].slice(0, 20));
  }, []);

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onScore() {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      if (jd.trim()) fd.append("jobDescription", jd);
      if (enhance) fd.append("enhance", "true");
      if (verify) fd.append("verify", "true");
      const res = await fetch("/api/score/batch", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Batch failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (!result) return;
    const rows = [["filename", "candidate", "authenticity", "verifiability", "interview", "status"]];
    for (const it of result.items) {
      rows.push([
        it.filename,
        it.candidateName || "",
        String(it.authenticity ?? ""),
        String(it.verifiability ?? ""),
        String(it.interview ?? ""),
        it.ok ? "ok" : (it.error || "error"),
      ]);
    }
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumetruth-batch-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sortedItems = result
    ? [...result.items].sort((a, b) => {
        if (a.ok && !b.ok) return -1;
        if (!a.ok && b.ok) return 1;
        if (sortKey === "name")
          return (a.candidateName || a.filename).localeCompare(b.candidateName || b.filename);
        return (b[sortKey] ?? 0) - (a[sortKey] ?? 0);
      })
    : [];

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-cyan uppercase tracking-widest font-semibold">
            ResumeTruth · Batch
          </div>
          <Link
            href="/"
            className="text-xs text-[#9aa3b2] hover:text-cyan transition-colors"
          >
            ← 单份评分
          </Link>
        </div>
        <h1 className="text-3xl font-bold leading-tight">
          批量上传 PDF，30 秒拿到推荐面试排名
        </h1>
        <p className="text-[#9aa3b2] mt-2 max-w-2xl text-sm">
          支持 1–20 份 PDF，单份 ≤ 5 MB。每份独立评分 + 持久化，错误的不影响其他。
          原文不入库，只存 sha256 + 评分。扫描版 PDF 需先 OCR。
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
              dragOver ? "border-accent bg-[#7c5cff14]" : "border-line bg-panel"
            }`}
          >
            <div className="text-4xl mb-2">📁</div>
            <div className="text-sm font-medium mb-1">拖入 PDF 文件</div>
            <div className="text-xs text-[#9aa3b2] mb-3">
              或点击选择（最多 20 份）
            </div>
            <input
              id="file-input"
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []).slice(0, 20 - files.length);
                setFiles((prev) => [...prev, ...picked].slice(0, 20));
                e.target.value = "";
              }}
              className="hidden"
            />
            <label
              htmlFor="file-input"
              className="inline-block bg-panel2 hover:bg-[#1d2330] border border-line rounded-lg px-3 py-1.5 text-xs cursor-pointer transition-colors"
            >
              选择文件
            </label>
          </div>

          {files.length > 0 && (
            <div className="bg-panel border border-line rounded-2xl p-4 space-y-1.5 max-h-64 overflow-y-auto">
              <div className="text-xs text-[#9aa3b2] uppercase tracking-widest mb-2">
                待评分 ({files.length}/20)
              </div>
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-2 text-xs bg-panel2 border border-line rounded px-2 py-1.5"
                >
                  <span className="truncate flex-1" title={f.name}>
                    📄 {f.name}
                  </span>
                  <span className="text-[#9aa3b2] flex-shrink-0">
                    {(f.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    onClick={() => removeFile(i)}
                    className="text-[#9aa3b2] hover:text-red transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="bg-panel border border-line rounded-2xl p-5">
            <div className="text-xs text-[#9aa3b2] uppercase tracking-widest mb-2">
              岗位描述（可选，应用到所有文件）
            </div>
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              rows={4}
              className="w-full bg-panel2 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="Senior Backend Engineer with 5+ years building distributed systems..."
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[#cdd3df] bg-panel border border-line rounded-lg px-3 py-2 cursor-pointer hover:border-accent transition-colors">
            <input
              type="checkbox"
              checked={enhance}
              onChange={(e) => setEnhance(e.target.checked)}
              className="accent-accent"
            />
            <span>
              批量 <strong className="text-cyan">LLM</strong> 增强（每份 +1–2s，需 OPENAI/ANTHROPIC_API_KEY）
            </span>
          </label>

          <label className="flex items-center gap-2 text-xs text-[#cdd3df] bg-panel border border-line rounded-lg px-3 py-2 cursor-pointer hover:border-accent transition-colors">
            <input
              type="checkbox"
              checked={verify}
              onChange={(e) => setVerify(e.target.checked)}
              className="accent-accent"
            />
            <span>
              <strong className="text-green">外部验证</strong>：实打 GitHub API + HEAD 个人网站（每份 +1-3s，需 GITHUB_TOKEN）
            </span>
          </label>

          <button
            onClick={onScore}
            disabled={loading || files.length === 0}
            className="w-full bg-accent hover:bg-[#6a4cff] disabled:bg-[#2d3447] disabled:text-[#666] disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? `评分中… (${files.length} 份)` : `开始评分 ${files.length} 份`}
          </button>

          {error && (
            <div className="bg-red/10 border border-red/30 text-red rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}
        </div>

        <div>
          {!result ? (
            <div className="bg-panel border border-line border-dashed rounded-2xl p-10 text-center text-[#9aa3b2] h-full flex flex-col items-center justify-center">
              <div className="text-5xl mb-3">📊</div>
              <div className="text-sm">评分结果会按"推荐面试度"排序显示</div>
              <div className="text-xs mt-2 text-[#666] max-w-sm">
                每份简历的细节可点击展开。结果可导出 CSV。
                左侧的反馈按钮（👍 / 👎）数据进 Feedback 表，喂给周度自动调参。
              </div>
            </div>
          ) : (
            <div className="bg-panel border border-line rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <div className="text-sm">
                    <span className="text-green font-semibold">{result.succeeded}</span>
                    <span className="text-[#9aa3b2]"> / {result.total} 成功</span>
                    {result.failed > 0 && (
                      <span className="ml-2 text-red">· {result.failed} 失败</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#9aa3b2]">排序：</span>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="bg-panel2 border border-line rounded px-2 py-1 text-xs"
                  >
                    <option value="interview">推荐面试度</option>
                    <option value="authenticity">真实度</option>
                    <option value="verifiability">可验证度</option>
                    <option value="name">姓名</option>
                  </select>
                  <button
                    onClick={exportCsv}
                    className="bg-panel2 hover:bg-[#1d2330] border border-line rounded px-2 py-1 text-xs"
                  >
                    导出 CSV
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-[#9aa3b2] border-b border-line">
                      <th className="text-left py-2 pr-2 w-8">#</th>
                      <th className="text-left py-2 pr-2">候选人 / 文件</th>
                      <th className="text-right py-2 px-2">真实</th>
                      <th className="text-right py-2 px-2">可验证</th>
                      <th className="text-right py-2 px-2">推荐</th>
                      <th className="text-right py-2 pl-2">判断</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((it, i) => {
                      const band = bandLabel(it.interview, it.authenticity);
                      return (
                        <tr
                          key={`${it.filename}-${i}`}
                          className={`border-b border-line/50 ${it.ok ? "" : "opacity-60"}`}
                        >
                          <td className="py-2 pr-2 text-[#9aa3b2] text-xs">
                            {it.ok ? i + 1 : "—"}
                          </td>
                          <td className="py-2 pr-2">
                            <div className="font-medium">
                              {it.candidateName || it.filename}
                            </div>
                            <div className="text-[10px] text-[#9aa3b2] truncate max-w-xs">
                              {it.ok ? (
                                <>
                                  📄 {it.filename} · {it.pageCount}p · {it.charCount} chars
                                </>
                              ) : (
                                <span className="text-red">⚠ {it.error}</span>
                              )}
                            </div>
                          </td>
                          <td className={`py-2 px-2 text-right font-bold ${colorOf(it.authenticity)}`}>
                            {it.authenticity ?? "—"}
                          </td>
                          <td className={`py-2 px-2 text-right font-bold ${colorOf(it.verifiability)}`}>
                            {it.verifiability ?? "—"}
                          </td>
                          <td className={`py-2 px-2 text-right font-bold ${colorOf(it.interview)}`}>
                            {it.interview ?? "—"}
                          </td>
                          <td className={`py-2 pl-2 text-right text-xs ${band.color}`}>
                            {band.text}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

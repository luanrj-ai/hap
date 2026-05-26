"use client";

import { useState } from "react";
import type { ScoreResult } from "@resumetruth/shared";
import { ScoreCard } from "../../components/ScoreCard";

const SAMPLE_RESUME = `Alex Chen
Senior Backend Engineer · San Francisco · alex@example.com
github.com/alex-chen · alex-chen.dev · linkedin.com/in/alexchen

EXPERIENCE
Stripe — Senior Backend Engineer (Jan 2022 - Present)
• Led migration of payment routing service from Ruby to Go, cutting p99 latency from 340ms to 110ms across 18M daily requests.
• Designed and shipped idempotency key system used by 2,400+ merchants; reduced double-charge incidents by 94%.
• Mentored 3 junior engineers, two of whom were promoted to L4 within 12 months.

Notion — Backend Engineer (Mar 2019 - Dec 2021)
• Built real-time collaborative editing backend supporting 850k concurrent users at peak.
• Authored "operational transforms" internal RFC adopted across 4 product teams.

Coinbase — Software Engineer (Jul 2016 - Feb 2019)
• Implemented order-matching engine extensions handling $400M+ daily volume.

OPEN SOURCE
• Maintainer of ratelimit-go (1.2k stars) and pgbouncer-helm (480 stars).
• Talk at GopherCon 2024: "Designing Idempotent Payment APIs".

EDUCATION
Carnegie Mellon University, BS Computer Science (2012-2016)`;

const SAMPLE_AI_RESUME = `John Smith
Results-driven Senior Software Engineer

PROFESSIONAL SUMMARY
A results-driven professional with a proven track record of delivering impactful solutions in today's fast-paced, ever-evolving landscape. Passionate about leveraging cutting-edge technologies to drive meaningful results through cross-functional collaboration and stakeholder engagement.

EXPERIENCE
Senior Software Engineer · TechCorp (2021 - Present)
• Spearheaded innovative solutions to leverage robust frameworks for delivering best-in-class results.
• Orchestrated cross-functional initiatives to spearhead transformative outcomes across the organization.
• Pioneered actionable insights to revolutionize the digital transformation journey.
• Championed strategic initiatives to architect scalable solutions for global stakeholders.
• Transformed legacy systems through extensive experience in modern cloud architectures.

Software Engineer · DataSolutions (2018 - 2021)
• Spearheaded data-driven decision making to deliver impactful business outcomes.
• Leveraged advanced analytics to drive meaningful results across multiple verticals.
• Demonstrated ability to architect robust solutions in cross-functional environments.

EDUCATION
State University, Computer Science Degree`;

export default function Dashboard() {
  const [resumeText, setResumeText] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [enhance, setEnhance] = useState(false);
  const [verify, setVerify] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onScore() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, candidateName, jobDescription, enhance, verify }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Score failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-cyan uppercase tracking-widest font-semibold">
            ResumeTruth · 单边评分（HAP 之前的 HR-only 工具）
          </div>
          <div className="flex gap-4 text-xs">
            <a href="/" className="text-[#9aa3b2] hover:text-cyan">← HAP 主页</a>
            <a href="/batch" className="text-accent hover:text-cyan">批量 PDF →</a>
          </div>
        </div>
        <h1 className="text-3xl font-bold mt-2 leading-tight">
          AI 时代的简历真实度评分层
        </h1>
        <p className="text-[#9aa3b2] mt-2 max-w-2xl text-sm">
          粘贴简历文本 + 可选岗位描述，立即拿到三维分数 + 每条信号的解释。
          所有评分均在本地推理完成（MVP 阶段），不存储简历内容。
          一次要筛多份？用<a href="/batch" className="text-cyan hover:underline">批量 PDF</a>。
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-panel border border-line rounded-2xl p-5">
            <div className="text-xs text-[#9aa3b2] uppercase tracking-widest mb-2">
              候选人姓名（可选）
            </div>
            <input
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              className="w-full bg-panel2 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="Alex Chen"
            />
          </div>

          <div className="bg-panel border border-line rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-[#9aa3b2] uppercase tracking-widest">
                简历文本
              </div>
              <div className="flex gap-2 text-[11px]">
                <button
                  onClick={() => setResumeText(SAMPLE_RESUME)}
                  className="text-cyan hover:underline"
                >
                  示例：真人简历
                </button>
                <span className="text-[#444]">·</span>
                <button
                  onClick={() => setResumeText(SAMPLE_AI_RESUME)}
                  className="text-red hover:underline"
                >
                  示例：AI 生成
                </button>
              </div>
            </div>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              rows={14}
              className="w-full bg-panel2 border border-line rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent"
              placeholder="粘贴简历全文…"
            />
            <div className="text-[11px] text-[#9aa3b2] mt-1">
              {resumeText.length} / 50,000 字符
            </div>
          </div>

          <div className="bg-panel border border-line rounded-2xl p-5">
            <div className="text-xs text-[#9aa3b2] uppercase tracking-widest mb-2">
              岗位描述（可选，影响"推荐面试度"）
            </div>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={5}
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
              <strong className="text-cyan">LLM 增强</strong>：生成定制点评 + 3 个面试问题（需 LLM key，+1–2s）
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
              <strong className="text-green">外部验证</strong>：真访问 GitHub API + HEAD 个人网站（+1-3s，需 GITHUB_TOKEN）
            </span>
          </label>

          <button
            onClick={onScore}
            disabled={loading || resumeText.trim().length < 50}
            className="w-full bg-accent hover:bg-[#6a4cff] disabled:bg-[#2d3447] disabled:text-[#666] disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? (enhance ? "评分 + LLM 增强中…" : "评分中…") : "Score Resume"}
          </button>

          {error && (
            <div className="bg-red/10 border border-red/30 text-red rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}
        </div>

        <div>
          {result ? (
            <ScoreCard result={result} />
          ) : (
            <div className="bg-panel border border-line border-dashed rounded-2xl p-10 text-center text-[#9aa3b2]">
              <div className="text-5xl mb-3">📋</div>
              <div className="text-sm">在左侧粘贴简历后点击评分</div>
              <div className="text-xs mt-2 text-[#666]">
                两个示例可一键加载，对比"真人 vs AI 生成"
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-12 pt-6 border-t border-line text-xs text-[#9aa3b2]">
        ResumeTruth v0.1 · MVP · 评分逻辑见{" "}
        <code className="text-cyan">packages/scoring</code>
      </footer>
    </main>
  );
}

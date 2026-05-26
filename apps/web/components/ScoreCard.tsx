"use client";

import { useState } from "react";
import type { ScoreResult, ScoreDimension } from "@resumetruth/shared";

const DIM_LABEL: Record<ScoreDimension, string> = {
  authenticity: "真实度",
  verifiability: "可验证度",
  interview: "推荐面试度",
};

function colorOf(score: number) {
  if (score >= 75) return "text-green";
  if (score >= 50) return "text-yellow";
  return "text-red";
}

function ringColor(score: number) {
  if (score >= 75) return "#3ddc97";
  if (score >= 50) return "#ffd166";
  return "#ff5d73";
}

function Ring({ value, label }: { value: number; label: string }) {
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (value / 100) * circ;
  const color = ringColor(value);
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r={radius} stroke="#242a36" strokeWidth="8" fill="none" />
        <circle
          cx="46"
          cy="46"
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 46 46)"
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
        <text
          x="46"
          y="52"
          textAnchor="middle"
          fontSize="22"
          fill={color}
          fontWeight="700"
        >
          {value}
        </text>
      </svg>
      <div className="text-xs text-[#9aa3b2] uppercase tracking-wider">{label}</div>
    </div>
  );
}

function FeedbackButtons({
  scoreId,
  signalId,
}: {
  scoreId: string;
  signalId?: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function send(thumbs: "up" | "down") {
    if (state !== "idle") return;
    setState("sending");
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoreId, signalId, thumbs }),
      });
      setState("sent");
    } catch {
      setState("idle");
    }
  }

  if (state === "sent") {
    return <span className="text-[10px] text-[#9aa3b2]">谢谢</span>;
  }

  return (
    <div className="flex gap-1.5">
      <button
        onClick={() => send("up")}
        disabled={state === "sending"}
        className="text-xs px-1.5 py-0.5 rounded border border-line hover:border-green hover:text-green transition-colors disabled:opacity-50"
        title="评分准确"
      >
        👍
      </button>
      <button
        onClick={() => send("down")}
        disabled={state === "sending"}
        className="text-xs px-1.5 py-0.5 rounded border border-line hover:border-red hover:text-red transition-colors disabled:opacity-50"
        title="评分有问题"
      >
        👎
      </button>
    </div>
  );
}

export function ScoreCard({ result }: { result: ScoreResult }) {
  return (
    <div className="bg-panel border border-line rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-[#9aa3b2] uppercase tracking-widest">
            评分结果
          </div>
          <div className="text-lg font-semibold mt-1">
            {result.candidateName || "未命名候选人"}
          </div>
        </div>
        <div className="text-xs text-[#9aa3b2] text-right">
          <div>{new Date(result.scoredAt).toLocaleString()}</div>
          {result.scoreId && (
            <div className="text-[10px] mt-1 font-mono opacity-60">
              {result.scoreId.slice(0, 12)}…
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-8 justify-around py-4 border-y border-line">
        <Ring value={result.authenticity} label={DIM_LABEL.authenticity} />
        <Ring value={result.verifiability} label={DIM_LABEL.verifiability} />
        <Ring value={result.interview} label={DIM_LABEL.interview} />
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="text-sm text-[#cdd3df] flex-1">{result.summary}</div>
        {result.scoreId && <FeedbackButtons scoreId={result.scoreId} />}
      </div>

      {result.verification && (
        <div className="mt-5 bg-gradient-to-br from-[#3ddc9714] to-[#22d3ee08] border border-[#3ddc9740] rounded-xl p-4">
          <div className="text-xs text-green uppercase tracking-widest font-semibold mb-3">
            🔍 外部验证（实打 API）
          </div>
          {result.verification.github && (
            <div className="mb-3">
              <div className="text-xs text-[#9aa3b2] uppercase tracking-wider mb-1">GitHub</div>
              {!result.verification.github.declared ? (
                <div className="text-sm text-[#9aa3b2]">简历未声明 GitHub 链接</div>
              ) : result.verification.github.error ? (
                <div className="text-sm text-yellow">
                  ⚠ {result.verification.github.login || "?"} — {result.verification.github.error}
                </div>
              ) : !result.verification.github.exists ? (
                <div className="text-sm text-red">
                  ⚠ 声明的 GitHub @{result.verification.github.login} <strong>不存在</strong>
                </div>
              ) : (
                <div className="text-sm text-[#e8ecf3]">
                  <span className="text-green font-bold">✓ @{result.verification.github.login}</span>
                  {" · "}
                  <span>{result.verification.github.publicRepos} repos</span>
                  {" · "}
                  <span>{result.verification.github.followers} followers</span>
                  {" · "}
                  <span>{((result.verification.github.accountAgeDays ?? 0) / 365).toFixed(1)} 年账号</span>
                  {" · "}
                  <span className={result.verification.github.recentCommits! >= 10 ? "text-green" : "text-yellow"}>
                    90 天 {result.verification.github.recentCommits} commits
                  </span>
                  {result.verification.github.topLanguages && result.verification.github.topLanguages.length > 0 && (
                    <div className="text-xs text-[#9aa3b2] mt-1">
                      主语言：{result.verification.github.topLanguages.join(" · ")}
                    </div>
                  )}
                  {result.verification.github.topRepos && result.verification.github.topRepos.length > 0 && (
                    <div className="text-xs text-[#9aa3b2] mt-1">
                      热门仓库：{result.verification.github.topRepos.slice(0, 3).map((r) => `${r.name} (${r.stars}⭐)`).join(" · ")}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {result.verification.websites && result.verification.websites.length > 0 && (
            <div>
              <div className="text-xs text-[#9aa3b2] uppercase tracking-wider mb-1">个人网站</div>
              {result.verification.websites.map((w, i) => (
                <div key={i} className="text-sm text-[#cdd3df] truncate">
                  {w.looksReal ? (
                    <span className="text-green">✓</span>
                  ) : !w.reachable ? (
                    <span className="text-red">✗</span>
                  ) : (
                    <span className="text-yellow">?</span>
                  )}
                  {" "}
                  <span className="font-mono text-xs">{w.url}</span>
                  {" "}
                  <span className="text-[#9aa3b2] text-xs">
                    {w.status ? `(${w.status})` : w.error ? `· ${w.error}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {result.enhancement && (
        <div className="mt-5 bg-gradient-to-br from-[#7c5cff14] to-[#22d3ee08] border border-[#7c5cff40] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-cyan uppercase tracking-widest font-semibold">
              ✨ Haiku 4.5 增强
            </div>
            <div className="text-[10px] text-[#9aa3b2] font-mono">
              {result.enhancement.model}
            </div>
          </div>
          <div className="text-sm text-[#e8ecf3] mb-3">
            {result.enhancement.enhancedSummary}
          </div>
          <div className="text-xs text-yellow mb-3">
            ⚠ {result.enhancement.riskAssessment}
          </div>
          <div className="text-xs text-[#9aa3b2] uppercase tracking-widest mb-2 mt-3">
            建议面试问题
          </div>
          <ol className="space-y-1.5 text-sm text-[#cdd3df]">
            {result.enhancement.interviewQuestions.map((q, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-cyan font-bold flex-shrink-0">{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-5">
        <div className="text-xs text-[#9aa3b2] uppercase tracking-widest mb-2">
          信号解释（{result.signals.length}）
        </div>
        <ul className="space-y-2">
          {result.signals.map((s) => (
            <li
              key={s.id}
              className="bg-panel2 border border-line rounded-lg p-3 text-sm"
            >
              <div className="flex items-center justify-between mb-1 gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.label}</span>
                  <span className="text-[10px] uppercase tracking-wider text-[#9aa3b2] border border-line rounded px-1.5 py-0.5">
                    {DIM_LABEL[s.dimension]}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-bold ${colorOf(s.score)}`}>{s.score}</span>
                  {result.scoreId && (
                    <FeedbackButtons scoreId={result.scoreId} signalId={s.id} />
                  )}
                </div>
              </div>
              <div className="text-[#cdd3df] text-[13px]">{s.explanation}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

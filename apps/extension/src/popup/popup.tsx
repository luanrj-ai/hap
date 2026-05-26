import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { checkHealth, setApiBase, DEFAULT_API } from "../shared/api";

function App() {
  const [apiBase, setApiBaseState] = useState(DEFAULT_API);
  const [health, setHealth] = useState<"ok" | "bad" | "checking">("checking");

  useEffect(() => {
    chrome.storage.sync.get(["apiBase"], (res) => {
      if (res.apiBase) setApiBaseState(res.apiBase);
    });
    checkHealth().then((ok) => setHealth(ok ? "ok" : "bad"));
  }, []);

  async function save() {
    await setApiBase(apiBase);
    const ok = await checkHealth();
    setHealth(ok ? "ok" : "bad");
  }

  return (
    <>
      <div className="brand">
        <div className="brand-dot" />
        <h1>ResumeTruth</h1>
      </div>
      <div className="muted">
        在 LinkedIn profile 上自动浮出三维评分。在 Greenhouse / Lever 等 ATS 候选人页同样工作。
      </div>

      <div className="field">
        <div className="label">API 地址</div>
        <input
          type="text"
          value={apiBase}
          onChange={(e) => setApiBaseState(e.target.value)}
        />
      </div>

      <button className="btn" onClick={save}>
        保存并测试连接
      </button>

      <div className={`status ${health === "ok" ? "ok" : health === "bad" ? "bad" : ""}`}>
        {health === "checking" && "检查中…"}
        {health === "ok" && "✓ 后端连接正常"}
        {health === "bad" && "✗ 后端不可达，先运行 npm run dev:web"}
      </div>

      <div className="field">
        <div className="label">使用方法</div>
        <ol style={{ paddingLeft: 18, margin: 0, color: "#cdd3df" }}>
          <li>启动后端：<code>npm run dev:web</code></li>
          <li>打开任一 LinkedIn profile 页（/in/xxx）</li>
          <li>右上角自动出现评分浮窗</li>
        </ol>
      </div>

      <div className="footer">
        ResumeTruth v0.1 · MVP ·{" "}
        <a href="http://localhost:3000" target="_blank" rel="noreferrer">
          打开 Dashboard
        </a>
      </div>
    </>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

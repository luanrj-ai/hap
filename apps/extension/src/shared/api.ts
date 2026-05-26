import type { ScoreRequest, ScoreResult } from "@resumetruth/shared";

const DEFAULT_API = "http://localhost:3000";

async function getApiBase(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["apiBase"], (res) => {
      resolve((res.apiBase as string) || DEFAULT_API);
    });
  });
}

export async function setApiBase(url: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ apiBase: url }, () => resolve());
  });
}

export async function scoreViaApi(req: ScoreRequest): Promise<ScoreResult> {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return (await res.json()) as ScoreResult;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const base = await getApiBase();
    const res = await fetch(`${base}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export { DEFAULT_API };

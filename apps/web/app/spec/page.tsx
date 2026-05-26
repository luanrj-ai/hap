import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Link from "next/link";

export const metadata = {
  title: "HAP v0.1 — Spec",
};

function loadSpec(): { ok: true; body: string } | { ok: false; error: string } {
  try {
    const p = resolve(process.cwd(), "../../spec/hap-v0.md");
    return { ok: true, body: readFileSync(p, "utf8") };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export default function SpecPage() {
  const r = loadSpec();
  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="text-xs uppercase tracking-widest text-cyan mb-2">
        v0.1 RFC · draft
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-6">HAP — Hiring Agent Protocol</h1>
      <div className="flex gap-4 text-sm mb-6">
        <Link href="/" className="text-[#9aa3b2] hover:text-cyan">← Home</Link>
        <a
          href="https://github.com/luanrj-ai/hap/blob/main/spec/hap-v0.md"
          className="text-accent hover:text-cyan"
        >
          View on GitHub →
        </a>
      </div>
      {r.ok ? (
        <pre className="bg-panel border border-line rounded-2xl p-6 text-xs font-mono text-[#cdd3df] whitespace-pre-wrap leading-relaxed">
          {r.body}
        </pre>
      ) : (
        <div className="bg-red/10 border border-red/30 text-red rounded-lg px-4 py-3 text-sm">
          Could not load spec: {r.error}
        </div>
      )}
    </main>
  );
}

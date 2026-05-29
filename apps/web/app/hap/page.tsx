"use client";

import { useEffect, useState } from "react";

// Loose local types — the dashboard only renders what the proxies relay; it
// imports nothing from @hap/* so the web build stays free of raw-TS workspace deps.
type Item = { question_id: string; requirement: string; required: boolean; score: number; bestLevel: string; declineReason?: string | null };
type Report = {
  verdict: "fit" | "partial" | "no_fit" | "needs_review";
  overall: number;
  requiredAllPass: boolean;
  identity: { anchor?: string; proven: boolean; note: string };
  flags: string[];
  items: Item[];
};
type Rec = { application: { candidate: { name: string; human_contact: string } }; report?: Report; scoreError?: string; receivedAt: string };
type Hit = { key: string; name: string; headline?: string; specializations?: string[]; verified: { note: string; rankSignal: number; identityProven: boolean; verifiedEvidence: number } };

const verdictColor: Record<string, string> = { fit: "#16a34a", partial: "#d97706", no_fit: "#dc2626", needs_review: "#0891b2" };

export default function HapDashboard() {
  const [tab, setTab] = useState<"apps" | "search">("apps");
  const [records, setRecords] = useState<Rec[]>([]);
  const [appsHint, setAppsHint] = useState<string>("");
  const [open, setOpen] = useState<number | null>(null);

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searchHint, setSearchHint] = useState<string>("");
  const [contacts, setContacts] = useState<Record<string, string>>({});

  async function loadApps() {
    const r = await fetch("/api/hap/applications", { cache: "no-store" }).then((x) => x.json()).catch(() => ({ records: [] }));
    setRecords(r.records ?? []);
    setAppsHint(r.hint ?? r.error ?? "");
  }
  useEffect(() => { loadApps(); }, []);

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const r = await fetch(`/api/hap/search?q=${encodeURIComponent(q)}`, { cache: "no-store" }).then((x) => x.json()).catch(() => ({ ok: false }));
    setHits(r.hits ?? []);
    setSearchHint(r.hint ?? r.error ?? (r.ok === false ? "search failed" : ""));
  }
  async function reveal(key: string) {
    const r = await fetch("/api/hap/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ candidate: key }) }).then((x) => x.json()).catch(() => ({ ok: false, error: "request failed" }));
    setContacts((c) => ({ ...c, [key]: r.ok ? r.contact : `✗ ${r.error}` }));
  }

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui, sans-serif", color: "#111" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>HAP recruiter dashboard</h1>
      <p style={{ color: "#666", marginTop: 0, fontSize: 14 }}>
        Verified-evidence applications &amp; candidate discovery. Scores come from dereferenced evidence — not the agent&apos;s prose.
      </p>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        {(["apps", "search"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "6px 14px", border: "1px solid #ddd", borderRadius: 6, background: tab === t ? "#111" : "#fff", color: tab === t ? "#fff" : "#111", cursor: "pointer" }}>
            {t === "apps" ? "Applications" : "Find candidates"}
          </button>
        ))}
      </div>

      {tab === "apps" && (
        <section>
          {appsHint && <p style={{ color: "#b45309", fontSize: 13 }}>⚠ {appsHint}</p>}
          {records.length === 0 && !appsHint && <p style={{ color: "#666" }}>No applications yet.</p>}
          {records.map((rec, i) => {
            const rep = rec.report;
            return (
              <div key={i} style={{ border: "1px solid #eee", borderRadius: 8, padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setOpen(open === i ? null : i)}>
                  <strong style={{ flex: 1 }}>{rec.application.candidate.name}</strong>
                  {rep ? (
                    <>
                      <span style={{ fontWeight: 600, color: verdictColor[rep.verdict] ?? "#111" }}>{rep.verdict}</span>
                      <span style={{ color: "#666", fontSize: 13 }}>overall {rep.overall}</span>
                      <span style={{ fontSize: 12, color: rep.identity.proven ? "#16a34a" : "#999" }}>{rep.identity.proven ? "id ✓" : "id asserted"}</span>
                    </>
                  ) : (
                    <span style={{ color: "#999", fontSize: 13 }}>{rec.scoreError ? `score error` : "scoring…"}</span>
                  )}
                </div>
                {open === i && rep && (
                  <div style={{ marginTop: 10, fontSize: 13 }}>
                    {rep.flags.length > 0 && (
                      <ul style={{ margin: "0 0 8px", paddingLeft: 18, color: "#b45309" }}>
                        {rep.flags.map((f, j) => <li key={j}>🚩 {f}</li>)}
                      </ul>
                    )}
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        {rep.items.map((it) => (
                          <tr key={it.question_id} style={{ borderTop: "1px solid #f0f0f0" }}>
                            <td style={{ padding: "4px 6px", color: "#888", width: 60 }}>{it.required ? "REQ" : "nice"}</td>
                            <td style={{ padding: "4px 6px" }}>{it.requirement}</td>
                            <td style={{ padding: "4px 6px", textAlign: "right", width: 60 }}>{it.score.toFixed(2)}</td>
                            <td style={{ padding: "4px 6px", color: "#888", width: 130 }}>{it.bestLevel === "declined" ? `declined(${it.declineReason})` : it.bestLevel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p style={{ color: "#666", marginTop: 8 }}>contact: {rec.application.candidate.human_contact || "(withheld)"} · {rep.identity.note}</p>
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={loadApps} style={{ marginTop: 6, fontSize: 13, padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", cursor: "pointer" }}>refresh</button>
        </section>
      )}

      {tab === "search" && (
        <section>
          <form onSubmit={runSearch} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. rust payments" style={{ flex: 1, padding: "8px 10px", border: "1px solid #ddd", borderRadius: 6 }} />
            <button style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "#111", color: "#fff", cursor: "pointer" }}>search</button>
          </form>
          {searchHint && <p style={{ color: "#b45309", fontSize: 13 }}>⚠ {searchHint}</p>}
          {hits.map((h) => (
            <div key={h.key} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <strong style={{ flex: 1 }}>{h.name} <span style={{ color: "#999", fontWeight: 400 }}>@{h.key}</span></strong>
                <span style={{ fontSize: 12, color: h.verified.identityProven ? "#16a34a" : "#999" }}>{h.verified.note}</span>
                <button onClick={() => reveal(h.key)} style={{ fontSize: 12, padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", cursor: "pointer" }}>reveal contact</button>
              </div>
              {h.headline && <p style={{ margin: "4px 0 0", color: "#555", fontSize: 13 }}>{h.headline}</p>}
              {contacts[h.key] && <p style={{ margin: "6px 0 0", fontSize: 13, color: "#111" }}>{contacts[h.key]}</p>}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

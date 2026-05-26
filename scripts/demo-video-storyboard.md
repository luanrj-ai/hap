# HAP 60-second demo video — storyboard

Target audience: technical HN reader, OSS maintainer, AI/agents engineer.
Goal: in 60 seconds, convey that two agents can interview each other with cited evidence, and that you can run it now.

Tools recommended:
- Terminal recording: **asciinema** (`asciinema rec`) for the CLI half, **agg** to convert to GIF, or screen-record direct with **OBS** / **QuickTime Screen Recording**.
- Editor: any. Final export: 1920x1080 mp4, 30fps.
- Voiceover: optional. The on-screen text + caption track carries the message; pace assumes no narration.

---

## Beat sheet (60 seconds, ~5-second segments)

| t (s)  | screen                                                                                                                                                                                | caption (top, ~24px)                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 0–4    | Static title card. `HAP` huge in cyan, `Hiring Agent Protocol` smaller below, `v0.1 · A2A profile · MIT` in muted gray.                                                              | (no caption — let the logo breathe)                                                 |
| 4–8    | Fade to a split screen: left says **"Candidate"** with a name + a tiny GitHub avatar; right says **"Recruiter"** with a JD title. Both connected by a dotted line labeled `HAP`.   | "Two agents. One protocol."                                                         |
| 8–14   | Cut to a clean terminal. Type `npm run demo` slowly. Hit enter.                                                                                                                       | "One command to run the whole loop."                                                |
| 14–20  | Terminal output: `=== HAP demo interview ===`, then the candidate + HR + LLM lines appear with a brief pause.                                                                       | "Both agents spin up locally. BYO LLM."                                             |
| 20–28  | `HR → hap.session.open` and `← cand hap.session.accept` appear. Candidate's accept highlighted (color: green).                                                                       | "A2A handshake. Candidate accepts or declines."                                     |
| 28–40  | `HR → hap.ask` types out the generated question. `← cand hap.answer` types out the answer. Highlight the `decline_reason: no_evidence` part by pausing 1 second on it.                | "Every answer cites — or honestly declines."                                        |
| 40–48  | Second Q/A pair scrolls past faster. Then `HR → hap.session.close` with `outcome: no_fit → archive` highlighted in yellow.                                                            | "Verdict is reasoned, not rubber-stamped."                                          |
| 48–54  | Cut to browser. Show the landing page hero zooming in on the headline `The hiring funnel runs on protocol, not resumes.` Hover to a `Star on GitHub` button.                          | "Federated. MIT. No central server."                                                |
| 54–60  | End card: `hap.dev` URL big, `github.com/luanrj-ai/hap` below. Small text "Built on Google A2A". Logo.                                                                                  | "Try it: `npm run demo`"                                                            |

---

## Recording commands (literal — paste in order)

### Step 1 — start the dev server in one terminal
```sh
npm run dev:web
```
Wait for `Ready`. Leave running.

### Step 2 — in a second terminal, ensure env is set
```sh
export OPENAI_API_KEY=sk-...
export OPENAI_BASE_URL=https://sz.uyilink.com/v1
export OPENAI_MODEL=gpt-5.5
# (or use ANTHROPIC_API_KEY instead)
```

### Step 3 — start asciinema and run the demo
```sh
asciinema rec hap-demo.cast --idle-time-limit 1.5
# inside the recording shell:
clear
npm run demo
# wait for transcript to print, then:
exit
```

### Step 4 — convert to GIF (optional, for landing page hero)
```sh
agg hap-demo.cast hap-demo.gif --speed 1.2 --theme monokai
```

### Step 5 — capture the landing page
```
http://localhost:3000/        → landing
http://localhost:3000/spec    → spec viewer
http://localhost:3000/dashboard → reference HR dashboard
```
Record with QuickTime / OBS. Scroll smoothly. Hover the `Replay` button on the live transcript widget to show interactivity.

---

## Voiceover script (optional, if narrated — ~140 words for 60s, can trim)

> "AI-written resumes broke recruiting. ATS systems made it worse.
>
> HAP — the Hiring Agent Protocol — is a different shape. Every candidate runs their own agent. Every recruiter runs their own agent. They talk directly, over HTTP, using a profile of Google's open A2A protocol.
>
> One command spins up both sides locally. The HR-agent generates questions from the JD. The candidate-agent answers — but only by citing evidence it can actually link to. A GitHub repo. A conference talk. A paper DOI. No URL, no claim.
>
> When the candidate doesn't have the receipts, it says so. The HR-agent's verdict is reasoned, not rubber-stamped. You read the transcript and decide.
>
> Federated. Self-hosted. MIT-licensed. No central server, no token, no chain. Just HTTP and a published schema.
>
> Star the repo. Run the demo. We ship weekly."

---

## Style notes

- **Dark theme everywhere.** Terminal and browser both. Matches the landing page.
- **No music** for the dev cut. Add a low-key lo-fi loop only if posting to YouTube or LinkedIn.
- **Cursor visible** in the terminal. Some viewers tune out otherwise.
- **No fake speed-up.** The interview really takes 20-25 seconds; trim dead air with the `--idle-time-limit` flag but don't show 100x playback. The whole point is that it's real.
- **Subtitles burned in** for HN/LinkedIn auto-play (most viewers watch muted).

---

## Hosting

- Primary: `hap.dev/demo.mp4` (self-host on Vercel/Cloudflare).
- Mirror: YouTube unlisted, embed link on landing.
- HN post: link directly to `hap.dev` (the video plays inline on the page if we embed it).
- Twitter / X: 60s cap fits perfectly. Crop to 1:1 or 4:5 if mobile-first.

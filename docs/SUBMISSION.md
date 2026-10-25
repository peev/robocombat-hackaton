# Hackathon submission — copy/paste answers

Use these answers in BuilderBase. Update the **Demo video URL** and **Pitch deck** links after you upload those assets. Pitch deck HTML is in this repo: open `docs/pitch.html` locally, or use the GitHub link below once merged.

---

## Project name

**RoboCombat BlackBox**

*(BuilderBase currently says “Robo Combat” — prefer **RoboCombat BlackBox** so it matches the product.)*

---

## One-line pitch

**BlackBox is an always-on AI robot test engineer on a Dell Pro Max GB10 that continuously benchmarks humanoid robots, investigates failures with controlled experiments, and files shift reports for robotics labs — 100% local inference, no cloud.**

---

## Repository URL

https://github.com/peev/robocombat-hackaton

---

## Demo video URL

*(Record with `docs/DEMO_VIDEO_SCRIPT.md`, upload to YouTube/Loom unlisted, paste link here.)*

**Placeholder:** _add after recording_

---

## What you built, and what runs locally

**RoboCombat BlackBox** is an always-on work agent for humanoid robot QA labs. It lives on the Dell Pro Max with GB10 and acts as a tireless robot test engineer.

**Agent workflow**
1. **Scheduled shift work (always-on):** OpenClaw automation every 15 minutes runs a regression sweep across Unitree G1, Boston Dynamics Atlas, and AgiBot A2 Ultra on Fire Rescue and Deep Mine missions (3 stress profiles each). Heartbeat every 30 minutes keeps the lab alive.
2. **Investigate:** Failures or >15% regressions trigger controlled follow-ups (change one condition) and a severity-tagged shift report (`info` / `warn` / `critical`) posted to the lab feed.
3. **On-demand chat:** Operators ask in the dashboard (or OpenClaw Control UI). BlackBox uses the `robocombat-lab` skill to call local lab APIs (`/api/agent/brief`, `/run`, `/sweep`, `/report`) via `curl`/`exec` — never invents numbers.
4. **Live proof:** Every experiment auto-replays in a 3D simulator on the lab screen so you see what the agent is doing, not just a text log.

**Stack / tools**
- **OpenClaw** gateway (systemd user service) + skill + persona + cron automations
- **NVIDIA NemoClaw + OpenShell** sandbox path: same agent deny-by-default, policy opens only `GET/POST /api/agent/**` for `/usr/bin/curl`
- Next.js lab UI + React Three Fiber missions + deterministic simulation engine
- Local evaluator for mission analysis and schema-validated follow-up experiments

**Local-first confirmation:** All reasoning and tool selection run on the GB10 via **Ollama `gpt-oss:20b`**. No cloud LLM API keys are configured in the agent runtime path. Dashboard chat can target host OpenClaw or the NemoClaw/OpenShell sandbox; both talk to the same local model.

> Illustrative simulation for rankings — not claimed as verified physical hardware performance.

---

## Walk us through getting started with the DGX Spark

**Hardware:** Dell Pro Max with GB10 (NVIDIA Grace Blackwell), 128 GB unified memory, DGX OS / AI Enterprise image as provided at the venue.

**Software stack we used**
1. Boot GB10 → confirm `nvidia-smi` sees the GPU.
2. Start local inference: `OLLAMA_FLASH_ATTENTION=1 OLLAMA_KEEP_ALIVE=-1 ollama serve` then `ollama pull gpt-oss:20b` (~14 GB on GPU).
3. Lab app: `npm install && npm run build && npm start` → `http://127.0.0.1:3000`.
4. Always-on agent: `./scripts/setup-openclaw.sh` onboards OpenClaw to local Ollama, installs the `robocombat-lab` skill + BlackBox persona, registers the 15‑min regression sweep, and runs `openclaw-gateway` as a systemd user service (`loginctl enable-linger` so it survives logout).
5. Optional hardened path: NemoClaw Express/`nemoclaw.sh` with `NEMOCLAW_AGENT=openclaw`, `NEMOCLAW_PROVIDER=ollama`, `NEMOCLAW_MODEL=gpt-oss:20b`, sandbox name `blackbox`, custom L7 policy preset, plus `scripts/sandbox-bridge.mjs` so the sandbox reaches the lab API only over the Docker bridge.

**What worked well:** DGX OS + Ollama on the GB10 GPU made local 20B inference straightforward; OpenClaw’s coding tool profile + disabled tool-search kept tool calls reliable on a smaller local model.

**Friction for NVIDIA:** First-time NemoClaw/OpenShell policy authoring and bridging host localhost services into the sandbox took iteration; a one-click “expose selected host ports to sandbox” recipe would have saved time.

---

## Pitch deck

https://github.com/peev/robocombat-hackaton/blob/main/docs/pitch.html

*(After merge to `main`. Until then use the branch blob URL from the PR. Or open the file locally / upload the same slides to Google Slides / SpeakerDeck and paste that link if BuilderBase prefers a hosted viewer.)*

**Mirror (markdown slides for GitHub reading):** https://github.com/peev/robocombat-hackaton/blob/main/docs/PITCH.md

---

## Which resources helped most, and what do you wish you'd had access to?

**Helped most**
- OpenClaw docs + local Ollama onboarding on the GB10
- NVIDIA NemoClaw / OpenShell playbooks for sandboxed always-on agents
- NVIDIA DGX OS + `nvidia-smi` visibility for proving local GPU inference
- BuilderBase mentors and venue GB10 machines

**Wish we'd had**
- A pre-pulled “agent-ready” model image on every GB10 (or faster shared model cache)
- A turnkey NemoClaw policy template for “agent may only hit these localhost APIs”
- Sample robotics telemetry fixtures / Unitree-style log formats for optional physical sensor hooks
- Slightly longer Round‑1 video allowance for showing both always-on cron and interactive chat

---

## What would have got you there faster?

1. Pre-cached `gpt-oss:20b` (or venue-recommended agent model) already resident on the GB10.
2. Documented OpenShell ↔ host service bridging for local Next.js APIs on day one.
3. An official OpenClaw “lab skill” skeleton with digest-sized tool outputs for 20B models.
4. Earlier clarity that demo judges will not screen-share — we would have locked the pitch deck + video storyboard first.

---

## What model(s) did you move forward with, and for what?

- **`gpt-oss:20b` (Ollama)** — primary brain for OpenClaw/NemoClaw: tool selection, regression reasoning, chat answers, shift reports, and in-app mission evaluation/follow-up planning.
- Sized for reliable tool use on the GB10 with flash attention + keep-alive; reasoning set to `low` so output budget stays for actionable digests.

---

## What drove your model choices?

- Must run **fully local** on GB10 with no cloud path (judging + IP sensitivity for robot labs).
- Need **reliable tool calling** for an always-on agent (sweeps, reports, follow-ups) — 20B with a **narrow coding tool profile** beat a larger model we couldn’t keep warm under hackathon time.
- Latency budget for live demo chat + 3D replay (~tens of seconds acceptable for a test engineer, not a chatbot toy).
- Unified memory headroom left for the Next.js lab + 3D viz + Ollama concurrently.

---

## How did you get set up with your models?

```bash
OLLAMA_FLASH_ATTENTION=1 OLLAMA_KEEP_ALIVE=-1 ollama serve &
ollama pull gpt-oss:20b
```

Configured the lab via `.env.local`:

```bash
LOCAL_LLM_URL=http://127.0.0.1:11434
LOCAL_LLM_MODEL=gpt-oss:20b
LOCAL_LLM_THINK=low
LOCAL_LLM_MAX_TOKENS=2048
LOCAL_LLM_TIMEOUT_MS=120000
```

OpenClaw onboarded with `--auth-choice ollama` pointing at that endpoint. NemoClaw sandbox used `NEMOCLAW_PROVIDER=ollama` / `NEMOCLAW_MODEL=gpt-oss:20b` so host and sandbox share the same local weights. No cloud provider keys.

---

## Did you use NVIDIA NemoClaw and/or OpenShell today?

**Yes — both (plus OpenClaw).**

- OpenClaw on the host as the primary always-on gateway + scheduled sweeps.
- NemoClaw sandbox `blackbox` running OpenClaw inside **OpenShell**, GPU enabled, deny-by-default L7 policy limited to lab agent APIs.
- Dashboard runtime switch: **OpenClaw · host** vs **NemoClaw · OpenShell sandbox**.

---

## If you used NVIDIA NemoClaw and/or OpenShell, how likely are you to recommend it to other developers? (1–10)

**9**

---

## Please share why or provide additional feedback.

NemoClaw + OpenShell gave us a credible “agent next to the robots” story: the same BlackBox personality, but network-isolated so a compromised or confused tool loop cannot roam the host. The deny-by-default L7 policy (only `/api/agent/**` via `curl`) is exactly what a robotics lab would demand. Express-style install + Ollama provider got us to a working sandbox quickly once we understood host bridging. We’d recommend it for any always-on agent that must touch factory or lab systems. Deducted one point only for the learning curve on custom policy + exposing a host localhost app into the sandbox under time pressure.

---

## If you used NVIDIA NemoClaw or OpenShell, how secure did you feel building with it? (1–10)

**8**

---

## What influenced your rating? Please share any concerns, positive experiences, or other feedback.

**Positive:** OpenShell’s policy denial was observable and real (`policy_denied` when probing non-allowlisted routes like `/api/robots`). Sandbox GPU path verified; inference stayed on-box. Credential/network surface felt smaller than a naked host agent with shell tools.

**Concerns / nuance:** Sandboxes reduce risk; they don’t eliminate prompt-injection or malicious skill content. We still treat the GB10 as a dedicated lab machine, keep cloud channels off for the demo, and only allowlisted lab APIs. Would love signed skill packages and a GUI policy editor for L7 allowlists. Overall: secure enough that we’d run the sandboxed agent unattended on a lab network — which is the point of this hackathon track.

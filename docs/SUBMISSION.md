# Hackathon submission — copy/paste answers

Use these answers in BuilderBase. Update the **Demo video URL** and **Pitch deck** links after you upload those assets. Pitch deck HTML is in this repo: open `docs/pitch.html` locally, or use the GitHub link below once merged.

---

## Project name

**RoboCombat BlackBox**

*(BuilderBase currently says “Robo Combat” — prefer **RoboCombat BlackBox** so it matches the product.)*

---

## One-line pitch

**BlackBox is a portable, always-on AI evaluation kit on a Dell Pro Max GB10 — today it stress-tests humanoids in game-like critical-mission sims; the product is a real on-robot device that runs real evaluations in real-world fire, mine, and industrial environments, fully local.**

---

## Repository URL

https://github.com/peev/robocombat-hackaton

---

## Demo video URL

*(Record with `docs/DEMO_VIDEO_SCRIPT.md`, upload to YouTube/Loom unlisted, paste link here.)*

**Placeholder:** _add after recording_

---

## What you built, and what runs locally

**RoboCombat BlackBox** is an always-on AI robot test engineer on the Dell Pro Max with GB10. The product idea: a **real portable evaluation device** that travels with humanoid robots and independently scores them on **critical real-world missions** (fire rescue, deep mines, industrial sites) — all inference local, so labs never push IP or safety logs to the cloud.

**Honest demo scope vs. destination**
- **Today (hackathon):** the agent drives a **game-like 3D simulation** of those critical missions. It looks and plays like a sim game (ship engine-room fire, underground mine) so operators watch robots succeed or fail live. Demo rankings are **illustrative simulation**, not verified physical hardware numbers.
- **Destination:** the same always-on agent loop on a backpack / deskside GB10 BlackBox, fed by **real robot sensors** (camera, depth, IMU, pose — interface already stubbed) to produce **real evaluations** in real environments.

**The game / sim stack (what you see on screen)**
- **Next.js 15 + React 19** — lab dashboard: chat, leaderboard, GPU/AI panels, hands-off “START ROBOCOMBAT DEMO”
- **React Three Fiber + Three.js + Drei + postprocessing** — real-time 3D worlds (PBR, HDRI, soft shadows, bloom, ACES), skeletal humanoids (Unitree G1 meshes + Mixamo rig/anim), director camera, free-play WASD
- **Headless deterministic sim engine** — seeded RNG, A* navigation, FSM mission tasks, fire/smoke and mine physics; scores come from **measured telemetry** (completion, collisions, falls, energy, distance), not LLM guesswork
- **Replay** — every agent experiment auto-plays in 3D so the lab screen shows the test, not just a text log

**Agent workflow (always-on work agent)**
1. **Scheduled shifts:** OpenClaw every 15 min sweeps G1 / Atlas / AgiBot A2 Ultra on Fire Rescue + Deep Mine (3 stress profiles each). Heartbeat every 30 min.
2. **Investigate:** failures or >15% regressions → one-variable follow-ups → severity-tagged shift report (`info` / `warn` / `critical`).
3. **On-demand chat:** operator asks in the dashboard; BlackBox uses `robocombat-lab` → `curl` to `/api/agent/brief|run|sweep|report` — never invents numbers.
4. **Path to real robots:** keep agent + reports; swap sim observations for live telemetry from the on-robot GB10.

**Agent / security stack**
- **OpenClaw** gateway (systemd) + skill + persona + cron
- **NVIDIA NemoClaw + OpenShell** sandbox: deny-by-default L7, only `GET/POST /api/agent/**` via `/usr/bin/curl`
- Local evaluator + schema-validated follow-ups on the same GB10

**Local-first confirmation:** All reasoning and tool selection run on the GB10 via **Ollama `gpt-oss:20b`**. No cloud LLM API keys in the agent runtime path. Dashboard can target host OpenClaw or the NemoClaw/OpenShell sandbox; both use the same local model.

---

## Walk us through getting started with the DGX Spark

We used the venue **Dell Pro Max with GB10** (NVIDIA Grace Blackwell superchip, 128 GB unified memory) running the preloaded **DGX OS + AI Enterprise** stack. For us the Spark/GB10 is the BlackBox: a deskside AI computer that runs all agent reasoning and our humanoid-mission sim locally — no cloud LLM calls.

**Getting started (what we actually did)**
1. **Hardware check** — Boot, confirm Wi‑Fi, `nvidia-smi` shows the GB10 GPU. Unified memory is what let us keep Ollama + Next.js + Three.js 3D viz + OpenClaw resident together.
2. **Local inference** — Ollama on the GB10 GPU: `OLLAMA_FLASH_ATTENTION=1 OLLAMA_KEEP_ALIVE=-1 ollama serve`, then `ollama pull gpt-oss:20b` (~14 GB). This is the only model in the agent runtime path.
3. **App / “game” lab** — Node app on the box: `npm install && npm run build && npm start` → `http://127.0.0.1:3000`. Stack: Next.js dashboard + React Three Fiber / Three.js mission worlds + a headless deterministic sim the agent scores from measured telemetry.
4. **Always-on agent (OpenClaw)** — `./scripts/setup-openclaw.sh`: onboard to local Ollama, install `robocombat-lab` skill + BlackBox persona, register a 15‑min regression sweep, run `openclaw-gateway` as a systemd user service; `loginctl enable-linger` so it survives logout. Tool-search off + `coding` tool profile so the 20B model’s tool calls stay reliable.
5. **Hardened path (NemoClaw + OpenShell)** — `nemoclaw.sh` with `NEMOCLAW_AGENT=openclaw`, `NEMOCLAW_PROVIDER=ollama`, `NEMOCLAW_MODEL=gpt-oss:20b`, sandbox `blackbox`. Custom deny-by-default L7 policy allows only `GET/POST /api/agent/**` via `curl`. `sandbox-bridge.mjs` exposes the lab API on the Docker bridge so the sandbox can reach the host app without opening the whole machine. Dashboard switches **OpenClaw · host** vs **NemoClaw · OpenShell sandbox**.

**What worked well for NVIDIA to keep**
- DGX OS + `nvidia-smi` made “prove it’s local GPU” easy for judges.
- Ollama on GB10 with flash attention / keep-alive was a fast path to a working always-on agent.
- NemoClaw + OpenShell’s observable `policy_denied` responses made the security story demoable (critical for an evaluation device next to robots).

**Friction / ask for NVIDIA**
- Model pull time ate early hacking hours — a pre-cached agent-ready model (or shared venue cache) on every GB10 would help.
- Bridging a host localhost Next.js app into OpenShell took custom work; a documented one-click “expose these host ports to the sandbox” recipe would have saved a lot of time.
- Custom L7 policy authoring was powerful but steep under a same-day deadline; a GUI or starter template for “agent may only hit these localhost APIs” would accelerate teams.

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
- Three.js / R3F ecosystem for the mission “game” viz that makes evaluations watchable
- BuilderBase mentors and venue GB10 machines

**Wish we'd had**
- A pre-pulled “agent-ready” model image on every GB10 (or faster shared model cache)
- A turnkey NemoClaw policy template for “agent may only hit these localhost APIs”
- Sample robotics telemetry fixtures / Unitree-style log formats to plug the stubbed sensor interface into a real robot sooner
- Slightly longer Round‑1 video allowance for showing both always-on cron and interactive chat + 3D replay

---

## What would have got you there faster?

1. Pre-cached `gpt-oss:20b` (or venue-recommended agent model) already resident on the GB10.
2. Documented OpenShell ↔ host service bridging for local Next.js APIs on day one.
3. An official OpenClaw “lab skill” skeleton with digest-sized tool outputs for 20B models.
4. Earlier clarity that demo judges will not screen-share — we would have locked the pitch deck + video storyboard first.
5. A thin “sim → real sensor” adapter example so the path from game telemetry to physical BlackBox was even clearer in the demo narrative.

---

## What model(s) did you move forward with, and for what?

- **`gpt-oss:20b` (Ollama)** — primary brain for OpenClaw/NemoClaw: tool selection, regression reasoning, chat answers, shift reports, and in-app mission evaluation/follow-up planning over sim telemetry digests.
- Sized for reliable tool use on the GB10 with flash attention + keep-alive; reasoning set to `low` so output budget stays for actionable digests.

---

## What drove your model choices?

- Must run **fully local** on GB10 with no cloud path (judging + IP sensitivity for robot labs — and for the eventual on-robot BlackBox).
- Need **reliable tool calling** for an always-on agent (sweeps, reports, follow-ups) — 20B with a **narrow coding tool profile** beat a larger model we couldn’t keep warm under hackathon time.
- Latency budget for live demo chat + 3D game replay (~tens of seconds acceptable for a test engineer, not a chatbot toy).
- Unified memory headroom left for the Next.js lab + Three.js 3D viz + Ollama concurrently.

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

- OpenClaw on the host as the primary always-on gateway + scheduled sweeps against the sim lab.
- NemoClaw sandbox `blackbox` running OpenClaw inside **OpenShell**, GPU enabled, deny-by-default L7 policy limited to lab agent APIs — the security model we’d want on a real evaluation device next to robots.
- Dashboard runtime switch: **OpenClaw · host** vs **NemoClaw · OpenShell sandbox**.

---

## If you used NVIDIA NemoClaw and/or OpenShell, how likely are you to recommend it to other developers? (1–10)

**9**

---

## Please share why or provide additional feedback.

NemoClaw + OpenShell gave us a credible “evaluation device next to the robots” story: the same BlackBox personality, but network-isolated so a compromised or confused tool loop cannot roam the host. The deny-by-default L7 policy (only `/api/agent/**` via `curl`) is exactly what a robotics lab would demand before putting an always-on agent near factory or field systems. Express-style install + Ollama provider got us to a working sandbox quickly once we understood host bridging. We’d recommend it for any always-on agent that must touch lab or robot infrastructure. Deducted one point only for the learning curve on custom policy + exposing a host localhost app into the sandbox under time pressure.

---

## If you used NVIDIA NemoClaw or OpenShell, how secure did you feel building with it? (1–10)

**8**

---

## What influenced your rating? Please share any concerns, positive experiences, or other feedback.

**Positive:** OpenShell’s policy denial was observable and real (`policy_denied` when probing non-allowlisted routes like `/api/robots`). Sandbox GPU path verified; inference stayed on-box. Credential/network surface felt smaller than a naked host agent with shell tools — important if BlackBox becomes a real field device.

**Concerns / nuance:** Sandboxes reduce risk; they don’t eliminate prompt-injection or malicious skill content. We still treat the GB10 as a dedicated lab machine, keep cloud channels off for the demo, and only allowlisted lab APIs. Would love signed skill packages and a GUI policy editor for L7 allowlists. Overall: secure enough that we’d run the sandboxed agent unattended on a lab network — which is the point of this hackathon track.

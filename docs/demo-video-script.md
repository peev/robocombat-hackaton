# ROBOCOMBAT BLACKBOX

## 100-Second Demo Video Script

**Product line (from the live build):** Always-on AI robot test engineer on a Dell Pro Max GB10 · OpenClaw agent · local `gpt-oss:20b` · Fire Rescue + Deep Mine · Unitree G1 / Boston Dynamics Atlas / AgiBot A2 Ultra · hands-off `START ROBOCOMBAT DEMO` (~72s on-screen) · agent verdicts + next-test proposals.

**Disclaimer (on-screen lower-third or end card):** ILLUSTRATIVE SIMULATION, NOT VERIFIED HARDWARE PERFORMANCE.

---

### 00:00–00:10 | INTRODUCING BLACKBOX

**Visual:** Cover still / cinematic close-up of the physical BlackBox kit on a humanoid’s back. Slow push-in past Dell and NVIDIA marks on the Dell Pro Max GB10.

**VO:**
> Introducing RoboCombat BlackBox — an always-on AI robot test engineer that lives on a Dell Pro Max GB10. The ultimate test of physical AI.

**On-screen text (optional):** ROBOCOMBAT BLACKBOX

---

### 00:10–00:20 | THE PROBLEM

**Visual:** Cover art — humanoid fighting a shipboard fire; cut to a tight shot of the compact evaluation kit.

**VO:**
> Humanoids are racing ahead. But who independently measures how they perform when the environment turns hostile? BlackBox makes physical AI measurable — and keeps testing around the clock.

---

### 00:20–00:30 | THE LIVE LAB

**Visual:** Cut into the app. Click **START ROBOCOMBAT DEMO**. Director camera engages. Show all three robots: Unitree G1, Boston Dynamics Atlas, AgiBot A2 Ultra. Optional flash of the agent panel — OpenClaw gateway up, local model on the GB10.

**VO:**
> Here’s the working lab. Three robots. Two missions. One local OpenClaw agent on the GB10 — no cloud required — that evaluates every run, spots weaknesses, and designs the next experiment.

---

### 00:30–00:48 | MISSION ONE: FIRE RESCUE

**Visual:** Fire Rescue world — container ship at sunset, engine-room fire, smoke and spray. Director cuts follow each robot locating the fire and attempting suppression. Lower-third: manufacturer + robot name.

**VO:**
> Mission one: Fire Rescue. A cargo-ship engine-room fire at sea. Under smoke, each robot must navigate, find the blaze, and attempt containment — while BlackBox records every collision, fall, and second of response time.

---

### 00:48–00:58 | FIRE RESULTS + AGENT VERDICT

**Visual:** Mission Benchmark overlay — scores for completion, time, navigation, stability, energy. BlackBox AI strip: live verdict (“analysing on GB10…”) then winner + **next test** chip.

**VO:**
> Scores come from measured telemetry only — mission success, navigation, stability, energy. Then the on-box agent delivers a verdict and proposes the next stress test.

---

### 00:58–01:16 | MISSION TWO: DEEP MINE

**Visual:** Transition to Deep Mine — rock tunnels, timber sets, rails, dust. Robots navigate incline, identify ore, haul material. Progress bar + director shots.

**VO:**
> Mission two: Deep Mine. Forty meters down. Rough terrain and incline. Identify the deposit, recover material, and stay upright — BlackBox scores the physical work, not the marketing claims.

---

### 01:16–01:28 | ALWAYS-ON EVALUATION

**Visual:** Deep Mine benchmark + RESULTS screen (both mission rankings). Cut to agent chat: operator asks a stress question; reply appears under the input. Optional: NemoClaw · OpenShell sandbox runtime badge, or a scheduled sweep / shift report in the feed; 3D auto-replay of an agent-triggered run.

**VO:**
> Between demos, BlackBox keeps working — regression sweeps, shift reports, and chat you can ask anything. Sandboxed on NemoClaw when you need deny-by-default isolation. Every experiment it runs plays back live in 3D.

---

### 01:28–01:40 | THE BIGGER VISION

**Visual:** Side-by-side leaderboard / compare of G1, Atlas, and A2 Ultra. Hold on RESULTS, then RoboCombat BlackBox end card.

**VO:**
> From simulated missions to independent physical testing. One platform to benchmark, compare, and advance the next generation of humanoid robots.

---

### FINAL SCREEN (hold ~3–4 s)

```
ROBOCOMBAT BLACKBOX

THE ULTIMATE TEST OF PHYSICAL AI.

BENCHMARK. IMPROVE. ADVANCE.
```

Small type: *Illustrative simulation. Not verified hardware performance.*

---

## Production notes (aligned to the build)

| Beat | What exists in-product |
|------|-------------------------|
| Hands-off demo | `START ROBOCOMBAT DEMO` → Fire (~30s) → bench (~6s) → Mine (~30s) → bench → RESULTS (~72s core) |
| Robots | Unitree G1, Boston Dynamics Atlas, AgiBot A2 Ultra |
| Missions | **Fire Rescue** (ship engine-room fire); **Deep Mine** (underground ore recovery) |
| Metrics | Completion, time, navigation, stability (falls/collisions), energy, task accuracy — from sim telemetry |
| Agent | OpenClaw on GB10 (`gpt-oss:20b` via Ollama); optional **NemoClaw · OpenShell** sandbox; verdicts + next-test; scheduled sweeps / chat |
| Honesty | Never imply real OEM rankings; keep the illustrative-simulation disclaimer visible |

## What changed vs. the prior draft

1. **Positioning** — “always-on AI robot test engineer on a Dell Pro Max GB10,” matching the README, not a generic “evaluation kit” line.
2. **Naming** — Fire Rescue / Deep Mine (not “fire response” / “deep mining”).
3. **Concrete robots** — name all three early; leaderboard is a compare of those platforms, not abstract brands.
4. **Local agent truth** — OpenClaw, on-box inference, verdict + next test, always-on sweeps/chat; NemoClaw sandbox as a beat, not the whole story.
5. **Metrics language** — telemetry-backed scores (collisions, falls, energy, response time), not vague “safety events.”
6. **Visuals** — map to actual UI: START DEMO, director camera, Mission Benchmark, BlackBox AI verdict strip, RESULTS, agent reply under chat.
7. **Timing** — intro/problem (~20s) + lab demo (~80s) fits the ~72s in-app timeline with room for agent B-roll.
8. **Disclaimer** — explicit end-card / lower-third so the video stays accurate.

# RoboCombat BlackBox — Pitch Deck

**Portable AI evaluation kit for humanoids · Dell Pro Max GB10 · 100% local**

---

## 1. Title

# RoboCombat BlackBox
### The ultimate test of Physical AI

A portable, always-on evaluation device on the GB10.  
Today: game-like critical-mission sims.  
Destination: real evaluations of real humanoids in real-world fire, mine, and industrial environments.

*Demo rankings are illustrative simulation — not verified hardware performance.*

---

## 2. The problem

Humanoid robots are shipping into dangerous work: fire, mines, industrial sites.

Today’s evaluation is:
- Manual, sporadic, and expert-scarce
- Hard to reproduce across vendors and sites
- Too sensitive for cloud LLM pipelines (IP, safety logs, site data)

Labs need a **local BlackBox** that independently tests robots on critical missions — not another chat demo.

---

## 3. The product (vision → demo)

**Vision:** BlackBox is a real device (deskside or on-robot backpack GB10) that runs **real evaluations** in **real-world critical environments**.

**Hackathon demo:** that same always-on agent drives a **game-like 3D sim lab** of Fire Rescue and Deep Mine so judges can see the loop live.

| Always-on | On demand |
|-----------|-----------|
| Regression sweeps every 15 min | Operator chat → experiment |
| Heartbeat every 30 min | Controlled follow-ups |
| Shift reports with severity | Live 3D replay of every run |

Robots under test: **Unitree G1 · Boston Dynamics Atlas · AgiBot A2 Ultra**

---

## 4. The game / sim stack

What looks like a game is the evaluation environment:

- **Next.js + React** lab dashboard  
- **React Three Fiber / Three.js** — PBR worlds, skeletal humanoids, director camera  
- **Deterministic headless engine** — A*, FSM tasks, fire/mine physics, seeded runs  
- Scores from **measured telemetry** (complete, collisions, falls, energy) — agent never invents numbers  

Path to hardware: stubbed sensor interface (camera / depth / IMU / pose) swaps sim observations for real robot data without replacing the agent.

---

## 5. Demo story (what judges will see)

1. Lab screen is already alive — last unattended sweep + report  
2. Operator: *“Stress test all three in Deep Mine at max incline — who fails and why?”*  
3. BlackBox calls lab tools → runs the mission sim → answers with **measured numbers**  
4. 3D “game” view auto-plays the experiment as evidence  
5. Flip to **NemoClaw · OpenShell** — same brain, deny-by-default network (field-device security model)

---

## 6. Architecture (local-first)

```
Operator / Cron
      ↓
OpenClaw  ──or──  NemoClaw + OpenShell sandbox
      ↓                    ↓
  Ollama gpt-oss:20b   (same local weights on GB10 GPU)
      ↓
robocombat-lab skill → curl → /api/agent/*
      ↓
Deterministic sim  ←→  (future) real robot sensors
      ↓
3D game viz + shift reports
```

**No cloud LLM calls in the agent runtime path.**

---

## 7. Business value

**Buyer:** robotics OEMs, integrators, and industrial safety labs  
**Job-to-be-done:** continuous, independent evaluation of humanoids on critical missions — before and during field deployment  

Measurable outcomes:
- Hours of unattended sweeps per day
- Failures caught before a robot walks into a fire or a mine
- Comparable scores across robot SKUs
- Audit trail of hypotheses → experiments → reports

**Would a company pay?** Yes — this is QA / certification infrastructure that ships with the robot, not a toy chatbot.

---

## 8. Why we win this track

| Criterion | How we hit it |
|-----------|----------------|
| Technical execution | Full agent loop + real-time 3D mission game + tools/cron/reports |
| Usefulness | Clear path: sim lab today → real on-robot BlackBox tomorrow |
| Local-first | `gpt-oss:20b` on GB10; host + OpenShell paths |
| Demo quality | Live “game” evidence + real agent numbers |

Stack: **OpenClaw + NemoClaw + OpenShell**

---

## 9. Ask / close

**RoboCombat BlackBox** — ship the GB10 with the robots.  
Simulate the critical mission. Then evaluate it for real.

Repo: https://github.com/peev/robocombat-hackaton

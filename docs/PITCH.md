# RoboCombat BlackBox — Pitch Deck

**Always-on AI robot test engineer · Dell Pro Max GB10 · 100% local**

---

## 1. Title

# RoboCombat BlackBox
### The ultimate test of Physical AI

An always-on agent that lives on the GB10 and stress-tests humanoid robots like a tireless QA engineer.

*Illustrative simulation — not verified hardware performance.*

---

## 2. The problem

Humanoid robots are shipping into dangerous work: fire, mines, industrial sites.

Today’s evaluation is:
- Manual, sporadic, and expert-scarce
- Hard to reproduce across vendors
- Too sensitive for cloud LLM pipelines (IP, safety logs, site data)

Labs need a **local, always-on test engineer** — not another chat demo.

---

## 3. The product

**BlackBox** = OpenClaw agent on the Dell Pro Max GB10

| Always-on | On demand |
|-----------|-----------|
| Regression sweeps every 15 min | Operator chat → experiment |
| Heartbeat every 30 min | Controlled follow-ups |
| Shift reports with severity | Live 3D replay of every run |

Robots under test: **Unitree G1 · Boston Dynamics Atlas · AgiBot A2 Ultra**  
Missions: **Fire Rescue · Deep Mine**

---

## 4. Demo story (what judges will see)

1. Lab screen is already alive — last sweep + report in the feed  
2. Operator: *“Stress test all three in Deep Mine at max incline — who fails and why?”*  
3. BlackBox calls lab tools → runs sim → answers with **measured numbers**  
4. 3D view auto-plays the experiment  
5. Flip to **NemoClaw · OpenShell sandbox** — same agent, deny-by-default network policy  

---

## 5. Architecture (local-first)

```
Operator / Cron
      ↓
OpenClaw  ──or──  NemoClaw + OpenShell sandbox
      ↓                    ↓
  Ollama gpt-oss:20b   (same local weights on GB10 GPU)
      ↓
robocombat-lab skill → curl → /api/agent/*
      ↓
Deterministic sim + 3D viz + shift reports
```

**No cloud LLM calls in the agent runtime path.**

---

## 6. Business value

**Buyer:** robotics OEMs, integrators, and industrial safety labs  
**Job-to-be-done:** continuous regression + incident investigation without hiring a night-shift test team  

Measurable outcomes:
- Hours of unattended sweeps per day
- Failures caught before field deployment
- Comparable scores across robot SKUs
- Audit trail of hypotheses → experiments → reports

**Would a company pay?** Yes — this is QA infrastructure next to the robots, not a toy chatbot.

---

## 7. Why we win this track

| Criterion | How we hit it |
|-----------|----------------|
| Technical execution | Full agent loop: tools, cron, chat, follow-ups, reports |
| Usefulness | Clear owner (lab lead), clear workflow, measurable flags |
| Local-first | `gpt-oss:20b` on GB10 via Ollama; host + sandbox paths |
| Demo quality | Live 3D + real agent answers with numbers |

Stack requirement: **OpenClaw + NemoClaw + OpenShell**

---

## 8. Ask / close

**RoboCombat BlackBox** — ship the GB10 with the robots.  
Let Physical AI prove itself before it walks into a fire.

Repo: https://github.com/peev/robocombat-hackaton

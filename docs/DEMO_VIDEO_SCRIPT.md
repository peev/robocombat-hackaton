# Demo video script (< 2 minutes)

Record on the GB10 with the lab UI full-screen. **No screen-share narration for the live pitch later — this video must show the agent working end to end.**

Target length: **90–110 seconds**.

---

## Shot list

| Time | Visual | Voice (tight) |
|------|--------|----------------|
| 0:00–0:10 | Cover / 3D mission world + GPU panel | “BlackBox is a portable AI evaluation kit on the Dell GB10. Today it tests humanoids in a game-like critical-mission sim — destination is real evaluations on real robots in the real world. All inference local.” |
| 0:10–0:25 | Agent feed with prior cron sweep + shift report | “Every 15 minutes it sweeps G1, Atlas, and AgiBot on Fire Rescue and Deep Mine, and files severity-tagged reports.” |
| 0:25–1:00 | Type chat → reply with numbers; 3D game auto-plays | “Operator asks for a Deep Mine stress test. BlackBox runs the mission sim like a game, answers with measured scores — watch the 3D replay.” |
| 1:00–1:18 | Switch to **NemoClaw · OpenShell** | “Same agent sandboxed for a real field device — deny-by-default, only lab APIs.” |
| 1:18–1:35 | Leaderboard | “Path: sim lab today, on-robot BlackBox tomorrow — comparable scores and an audit trail.” |
| 1:35–1:50 | Closing frame | “RoboCombat BlackBox — ship the GB10 with the robots.” |

---

## Exact chat prompt to type on camera

```text
Stress test all three robots in Deep Mine at max incline 0.6 with rough terrain 1.0. Which robots fail and why?
```

Expect a reply citing pass/fail, score, energy, collisions — from `/api/agent/run`, not invented.

---

## Recording checklist

- [ ] Ollama serving `gpt-oss:20b` (`OLLAMA_KEEP_ALIVE=-1`)
- [ ] `npm start` lab on `127.0.0.1:3000`
- [ ] OpenClaw gateway up; optional NemoClaw sandbox reachable
- [ ] Prefetch one sweep so the feed isn’t empty at second 0
- [ ] Hide passwords / tokens; show `nvidia-smi` or GPU panel if possible
- [ ] Export 1080p, upload **unlisted** YouTube or Loom
- [ ] Paste URL into BuilderBase **Demo video URL**

---

## Live Round 2 (5 min) — if you advance

| Min | Beat |
|-----|------|
| 0–0:30 | Problem + one-liner (open `docs/pitch.html` on a second machine / phone for judges’ link) |
| 0:30–3:00 | Live: chat → run → 3D; mention cron; flip to NemoClaw |
| 3:00–5:00 | Q&A: local-only, who pays, why 20B, OpenShell policy |

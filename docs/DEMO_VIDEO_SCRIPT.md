# Demo video script (< 2 minutes)

Record on the GB10 with the lab UI full-screen. **No screen-share narration for the live pitch later — this video must show the agent working end to end.**

Target length: **90–110 seconds**.

---

## Shot list

| Time | Visual | Voice (tight) |
|------|--------|----------------|
| 0:00–0:08 | Cover / dashboard with GPU panel + “local gpt-oss:20b” | “BlackBox is an always-on robot test engineer on the Dell GB10. All inference is local — no cloud.” |
| 0:08–0:22 | Agent activity feed showing a prior cron sweep + shift report | “Every 15 minutes it runs regression sweeps across G1, Atlas, and AgiBot, and files severity-tagged reports.” |
| 0:22–0:55 | Type chat prompt → thinking → reply with numbers; 3D auto-plays | “Operator: stress-test Deep Mine at max incline. BlackBox calls lab tools, runs the sim, and answers with measured scores — watch the 3D replay.” |
| 0:55–1:15 | Switch runtime to **NemoClaw · OpenShell sandbox**; quick ask or show policy deny clip | “Same agent inside NemoClaw OpenShell — deny-by-default, only lab APIs allowed.” |
| 1:15–1:35 | Leaderboard / benchmark panel | “Labs get comparable scores and an audit trail of hypotheses to experiments to reports.” |
| 1:35–1:50 | Closing frame: logo + repo URL | “RoboCombat BlackBox — ship the GB10 with the robots.” |

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

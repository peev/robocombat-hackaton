---
name: robocombat-lab
description: "Operate the RoboCombat BlackBox humanoid-robot evaluation lab on this GB10: run experiments, regression sweeps, read the leaderboard and file shift/incident reports. Use for any request about robots, Unitree G1, Atlas, AgiBot A2, fire rescue, deep mine, evaluations, comparisons, regressions or lab status."
metadata: { "openclaw": { "emoji": "🤖", "requires": { "bins": ["curl"] } } }
---

# RoboCombat Lab

The lab API runs locally at `http://localhost:3000`. Always call it with the
`exec` tool and `curl`. Never invent numbers: every figure you report must come
from an API response. Results are illustrative simulation, not verified
hardware performance.

Robots: `g1` (Unitree G1), `atlas` (Boston Dynamics Atlas), `a2` (AgiBot A2 Ultra).
Missions: `fire-rescue` (ship engine-room fire), `deep-mine` (underground ore recovery).

## Reading a digest

- **Stability** = fewest `falls` first, then fewest `collisions`. A robot with a fall is never the most stable.
- **Effectiveness** = `complete=yes` first, then `score`.
- **Endurance** = `energy_left`.
- Answer the exact question asked (stability is not the same as score).

## 1. Lab status

```bash
curl -s http://localhost:3000/api/agent/brief
```

## 2. Run one experiment

Every run is replayed live in the 3D view. `robots` may be omitted to run all
three. `conditions` keys (all optional, 0..1 unless noted): `smokeDensity`,
`visibility`, `lighting`, `terrainDifficulty`, `incline` (0..0.6),
`fireSpreadRate` (0..0.5), `obstacleShift`, `tunnelAccessibility` (0.3..1),
`seed` (integer).

```bash
curl -s -X POST http://localhost:3000/api/agent/run -H 'Content-Type: application/json' \
  -d '{"mission":"fire-rescue","robots":["g1","atlas","a2"],"conditions":{"smokeDensity":0.8,"visibility":0.4},"hypothesis":"Dense smoke degrades navigation","source":"openclaw-chat"}'
```

To investigate a weakness, run a follow-up that changes ONE condition and
compare the two digests.

## 3. Regression sweep

Runs every robot through 3 stress profiles per mission and prints FLAGS.

```bash
curl -s -X POST http://localhost:3000/api/agent/sweep -H 'Content-Type: application/json' -d '{"mission":"all","source":"openclaw-cron"}'
```

## 4. File a report to the lab feed

`severity` is `info`, `warn` (any flag) or `critical` (a robot failed a mission).
Keep `body` under 120 words: findings, evidence (numbers), recommended next test.

```bash
curl -s -X POST http://localhost:3000/api/agent/report -H 'Content-Type: application/json' \
  -d '{"title":"Shift report: ...","severity":"warn","body":"...","source":"openclaw-cron"}'
```

Use `"source":"openclaw-chat"` when a human asked you in chat,
`"openclaw-cron"` for scheduled jobs and `"openclaw-heartbeat"` for heartbeats.
Use single quotes around the JSON and avoid apostrophes inside it.

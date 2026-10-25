# RoboCombat BlackBox — Acceptance Progress

Updated during development. Do not claim untested features as complete.

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Runs locally | **complete** | `npm run dev` / `npm start` |
| 2 | Functioning 3D environment | **complete** | R3F ship + mine |
| 3 | Robots visibly walk | **complete** | Procedural articulated limbs synced to velocity |
| 4 | Camera controls | **complete** | Third / spectator / cinematic / robot |
| 5 | Fire Rescue playable | **complete** | Autonomous + free explore + replay |
| 6 | Deep Mine playable | **complete** | Same |
| 7 | Interact with mission objects | **complete** | Sim FSM + visual extinguisher/ore/hose |
| 8 | Real simulation telemetry | **complete** | Deterministic engine events |
| 9 | Three illustrative profiles | **complete** | G1, Atlas, A2 Ultra |
| 10 | Scores from measured results | **complete** | `lib/simulation/scoring.ts` |
| 11 | Real NVIDIA GPU activity | **partial** | Live panel; N/A without nvidia-smi (this CI VM has no GPU) |
| 12 | Local AI analyzes outcomes | **partial** | Wired to Ollama/compat; falls back to labeled heuristic if no model |
| 13 | Agent requests another experiment | **complete** | Max 3 follow-ups, schema-validated |
| 14 | NemoClaw / OpenClaw / OpenShell | **partial** | Status probe + intent bridge; CLIs not installed here |
| 15 | Discord triggers evaluations | **partial** | API path ready; not tested with real Discord message |
| 16 | Results stored / comparable | **complete** | `data/experiments.json` + rankings |
| 17 | No remote AI for live demo | **complete** | Only local endpoints; heuristic if offline |

## Demo button

`START ROBOCOMBAT DEMO` → Fire Rescue AI eval + follow-up + Deep Mine eval. Uses real sim data throughout.

## Blocked / needs host

- Large local model download — **ask before download**
- Discord credentials
- NemoClaw install per NVIDIA docs on GB10
- Rapier interactive physics in free-play — package installed; mission scoring uses custom deterministic engine (documented)

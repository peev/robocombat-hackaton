# RoboCombat BlackBox

**THE ULTIMATE TEST OF PHYSICAL AI.**

Interactive 3D humanoid robot evaluation simulator for the hackathon demo. Robots perform Fire Rescue and Deep Mine missions; measured telemetry drives scoring and an autonomous local AI evaluator; NVIDIA GB10 hardware metrics are displayed when available.

> **ILLUSTRATIVE SIMULATION, NOT VERIFIED HARDWARE PERFORMANCE.**

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production:

```bash
npm run build && npm start
```

Tests (deterministic simulation + evaluator):

```bash
npm test
```

## What works

- **Fire Rescue** & **Deep Mine** missions with articulated humanoid robots (procedural walk)
- Free play (WASD), autonomous missions, 3-robot compare, AI evaluation, demo button
- Deterministic seeded simulation engine (A* navigation, FSM tasks, fire/mine physics)
- Scores from measured telemetry only
- Live GPU panel via `nvidia-smi` when present (otherwise honest **N/A**)
- Local LLM evaluator (Ollama / OpenAI-compatible); heuristic fallback if unavailable — never fakes AI text
- Leaderboard persistence under `data/`
- Discord/NemoClaw integration **prepared** (env vars); not marked complete until a real Discord round-trip

## Controls

| Key | Action |
|-----|--------|
| WASD | Move (free play) |
| Shift | Run |
| Mouse | Camera look (click canvas to capture) |
| Wheel | Zoom |
| C | Cycle camera modes |
| 1 / 2 / 3 | Select G1 / Atlas / A2 Ultra |
| Esc | Pause |

## Local AI (GB10)

```bash
# Example with Ollama
ollama serve
ollama pull llama3.2   # ask before large downloads
export LOCAL_LLM_URL=http://127.0.0.1:11434
export LOCAL_LLM_MODEL=llama3.2
```

Copy `.env.example` → `.env.local` for Discord / LLM settings. Never commit secrets.

## NemoClaw / OpenClaw / OpenShell / Discord

See NVIDIA docs: https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/get-started/quickstart

Required env (when wiring Discord):

- `DISCORD_BOT_TOKEN`
- `DISCORD_CHANNEL_ID`
- `LOCAL_LLM_URL` / `LOCAL_LLM_MODEL`

Status: `GET /api/discord`, `GET /api/evaluate`.

## Architecture

| Layer | Role |
|-------|------|
| Next.js UI + R3F | Game view, HUD, GPU/AI panels |
| `lib/simulation` | Headless deterministic experiments |
| `lib/ai` | Local inference + autonomous follow-ups |
| `lib/hardware` | nvidia-smi / system metrics |
| `lib/nemo` | OpenClaw/Discord intent bridge |
| `lib/sensors` | Future physical BlackBox observation interface |

## Real vs simulated vs planned

| Item | Status |
|------|--------|
| Robot locomotion & missions | Simulated (deterministic engine + 3D viz) |
| Manufacturer rankings | Simulated / illustrative only |
| GPU metrics | Real when NVIDIA driver present |
| AI analysis | Real local LLM when available; else labeled heuristic |
| NemoClaw/Discord live | Prepared — needs install + credentials + test |
| Physical robot sensors | Interface stubbed for future BlackBox hardware |

See [PROGRESS.md](./PROGRESS.md) for acceptance criteria.

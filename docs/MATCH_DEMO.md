# RoboCombat Match Demo

> **ILLUSTRATIVE SIMULATION** — match format, teams, scoring, and robot stats are configurable placeholders. No real teams, partners, or match results are represented.

## Overview

The Match Demo is an **interactive investor/media demonstration** of the RoboCombat competition format. It showcases:

- A purpose-built arena with scoring zones
- Two teams of humanoid robots (squads of 2)
- Operator control (the viewer pilots one robot while AI controls the others)
- Zone-control objective (capture and hold zones to score points)
- 90-second match timer
- Live scoring with broadcast-style overlay
- Spectator-friendly telemetry (speed, battery, control latency)
- Clear winner screen with match stats

## How to Run

```bash
npm run dev
# Open http://localhost:3000/match-demo
```

Or navigate from the main BlackBox dashboard:
1. Open the app at http://localhost:3000
2. Click **"MATCH DEMO"** button in the header
3. Or click **"TRY MATCH DEMO →"** on the intro screen

## Presenting the Demo (2-3 minute walkthrough)

### Opening (30s)
1. Open the match demo page
2. Read through the intro screen explaining the format
3. Point out: "This is an illustrative simulation of how RoboCombat matches work"

### Gameplay (90s)
1. Click **START MATCH DEMO**
2. Wait for 3-second countdown
3. Use keyboard controls to pilot your robot:
   - **WASD / Arrow keys** — Move forward/backward, turn left/right
   - **SHIFT** — Sprint (faster movement, more battery drain)
   - **C** — Cycle camera modes (Third-person → Spectator → Broadcast)
4. Objective: Move into zones and stay there to capture them
5. Point out the broadcast overlay showing:
   - Score bug (team scores, match timer)
   - Zone status indicators
   - Player telemetry (speed, battery, latency)

### Conclusion (30s)
1. When the match ends, review the winner screen
2. Show team and player statistics
3. Click **PLAY AGAIN** for another round, or navigate back to BlackBox

## Controls Reference

| Key | Action |
|-----|--------|
| W / ↑ | Move forward |
| S / ↓ | Move backward |
| A / ← | Turn left |
| D / → | Turn right |
| SHIFT | Sprint |
| C | Cycle camera mode |

## Camera Modes

1. **Third-person** — Follow camera behind your robot
2. **Spectator** — Elevated view with orbit control
3. **Broadcast** — Slow-rotating aerial view of the entire arena

## What's Illustrative vs Confirmed

### Illustrative (Configurable Placeholders)
- Team names and colors (ALPHA / BRAVO)
- Robot assignments per team
- Arena layout and zone positions
- Match duration (90 seconds)
- Scoring rates (points per second per zone)
- Robot statistics (speed, battery drain, latency simulation)

### Confirmed Concepts
- Zone-control format as one match type
- Teams consist of squads of humanoid robots
- Remote operation by human pilots
- Spectator-friendly broadcast presentation
- Match timer and scoring system

## Configuration

Match parameters are defined in `src/lib/match/config.ts`:

```typescript
// Teams
ILLUSTRATIVE_TEAMS: TeamConfig[]

// Arena layout
DEMO_ARENA: ArenaConfig

// Match duration
matchDurationSec: 90

// Scoring
scoring: {
  zoneHoldPointsPerSec: 1,
  objectiveBonus: 10,
}
```

To customize:
1. Edit the config file
2. Modify team names, colors, robot assignments
3. Adjust arena dimensions and zone positions
4. Change match duration and scoring rules

## Architecture

```
src/
├── app/match-demo/page.tsx      # Match demo page component
├── components/match/
│   ├── MatchCanvas.tsx          # Main canvas with game loop
│   ├── MatchArena.tsx           # Arena geometry and zones
│   ├── BroadcastHUD.tsx         # Score bug and telemetry overlay
│   └── WinnerScreen.tsx         # End-of-match results screen
└── lib/match/
    ├── types.ts                 # Type definitions
    ├── config.ts                # Configurable match parameters
    └── engine.ts                # Match simulation logic
```

## Known Limitations

1. **AI behavior is simple** — AI-controlled robots use basic zone-seeking behavior, not sophisticated tactics
2. **No physics collisions** — Robots can pass through each other (visual overlap only)
3. **Fixed arena size** — Arena boundaries are hardcoded to 40x30 units
4. **Single match type** — Only zone-control is implemented; delivery objective is placeholder
5. **No network play** — All control is local; remote operation simulation only

## Next Practical Steps

1. **Add robot-robot collision** — Prevent overlap using physics or soft collision
2. **Implement delivery objective** — Add objects to carry between zones
3. **Network simulation** — Simulate latency and packet loss for realism
4. **Multiple arenas** — Add arena selection with different layouts
5. **Spectator mode improvements** — Picture-in-picture, instant replay
6. **Commentary system** — Automated play-by-play commentary

## Technical Notes

- Uses React Three Fiber (R3F) for 3D rendering
- Reuses existing HumanoidRobot component from BlackBox
- Match state managed in React useState with requestAnimationFrame loop
- AI decisions updated every 2-4 seconds for natural-looking behavior
- Zone capture uses progress bar system with capture/decay rates

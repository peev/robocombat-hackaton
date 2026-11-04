/**
 * ILLUSTRATIVE SIMULATION — default match configuration.
 * Teams, robots, and arena layout are configurable placeholders.
 * No real teams, partners, or match results are represented.
 */

import type { ArenaConfig, MatchConfig, PlayerConfig, TeamConfig } from "./types";

export const ILLUSTRATIVE_TEAMS: TeamConfig[] = [
  {
    id: "team-alpha",
    name: "TEAM ALPHA",
    shortName: "ALPHA",
    primaryColor: "#e10600",
    accentColor: "#ff6b4a",
  },
  {
    id: "team-bravo",
    name: "TEAM BRAVO",
    shortName: "BRAVO",
    primaryColor: "#0066cc",
    accentColor: "#4da6ff",
  },
];

export const DEMO_ARENA: ArenaConfig = {
  id: "arena-alpha",
  name: "PROVING GROUNDS",
  width: 40,
  depth: 30,
  zones: [
    {
      id: "zone-center",
      position: { x: 0, z: 0 },
      radius: 4,
      pointsPerSecond: 3,
      name: "CENTER",
    },
    {
      id: "zone-north",
      position: { x: 0, z: 10 },
      radius: 3,
      pointsPerSecond: 2,
      name: "NORTH",
    },
    {
      id: "zone-south",
      position: { x: 0, z: -10 },
      radius: 3,
      pointsPerSecond: 2,
      name: "SOUTH",
    },
  ],
  teamSpawns: {
    "team-alpha": [
      { x: -15, z: 3, heading: 0 },
      { x: -15, z: -3, heading: 0 },
    ],
    "team-bravo": [
      { x: 15, z: 3, heading: Math.PI },
      { x: 15, z: -3, heading: Math.PI },
    ],
  },
  floorColor: "#1a1a1a",
  ambientColor: "#2d3436",
};

export function createDemoPlayers(): PlayerConfig[] {
  return [
    {
      id: "player-1",
      teamId: "team-alpha",
      robotId: "unitree-g1",
      displayName: "ALPHA-1",
      isHumanControlled: true,
    },
    {
      id: "player-2",
      teamId: "team-alpha",
      robotId: "bd-atlas",
      displayName: "ALPHA-2",
      isHumanControlled: false,
    },
    {
      id: "player-3",
      teamId: "team-bravo",
      robotId: "agibot-a2",
      displayName: "BRAVO-1",
      isHumanControlled: false,
    },
    {
      id: "player-4",
      teamId: "team-bravo",
      robotId: "bd-atlas",
      displayName: "BRAVO-2",
      isHumanControlled: false,
    },
  ];
}

export function createDemoMatchConfig(): MatchConfig {
  return {
    id: `match_${Date.now().toString(36)}`,
    name: "ZONE CONTROL DEMO",
    teams: ILLUSTRATIVE_TEAMS,
    players: createDemoPlayers(),
    arena: DEMO_ARENA,
    matchDurationSec: 90,
    objective: "zone-control",
    scoring: {
      zoneHoldPointsPerSec: 1,
      objectiveBonus: 10,
    },
  };
}

export const CONTROL_INSTRUCTIONS = `
KEYBOARD CONTROLS (PILOT MODE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
W/↑    Forward
S/↓    Backward  
A/←    Turn left
D/→    Turn right
SHIFT  Sprint
C      Cycle camera

CAMERA MODES
━━━━━━━━━━━━
Third-person · Spectator · Cinematic · Broadcast
`.trim();

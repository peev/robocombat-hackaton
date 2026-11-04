/**
 * ILLUSTRATIVE SIMULATION — match format, teams, and scoring are configurable.
 * This module defines the data types for the RoboCombat match demo.
 * All values are illustrative and not verified against any real competition format.
 */

export type TeamId = string;
export type PlayerId = string;
export type ZoneId = string;

export interface TeamConfig {
  id: TeamId;
  name: string;
  shortName: string;
  primaryColor: string;
  accentColor: string;
}

export interface PlayerConfig {
  id: PlayerId;
  teamId: TeamId;
  robotId: string;
  displayName: string;
  isHumanControlled: boolean;
}

export interface ZoneConfig {
  id: ZoneId;
  position: { x: number; z: number };
  radius: number;
  pointsPerSecond: number;
  name: string;
}

export interface ArenaConfig {
  id: string;
  name: string;
  width: number;
  depth: number;
  zones: ZoneConfig[];
  teamSpawns: Record<TeamId, { x: number; z: number; heading: number }[]>;
  floorColor: string;
  ambientColor: string;
}

export interface MatchConfig {
  id: string;
  name: string;
  teams: TeamConfig[];
  players: PlayerConfig[];
  arena: ArenaConfig;
  matchDurationSec: number;
  objective: "zone-control" | "delivery";
  scoring: {
    zoneHoldPointsPerSec: number;
    objectiveBonus: number;
  };
}

export interface PlayerState {
  playerId: PlayerId;
  teamId: TeamId;
  robotId: string;
  position: { x: number; y: number; z: number };
  heading: number;
  velocity: number;
  battery: number;
  latencyMs: number;
  state: "idle" | "moving" | "capturing" | "defending";
  inZone: ZoneId | null;
}

export interface ZoneState {
  zoneId: ZoneId;
  controlledBy: TeamId | null;
  captureProgress: Record<TeamId, number>;
  contested: boolean;
}

export interface TeamScore {
  teamId: TeamId;
  points: number;
  zonesControlled: number;
}

export interface MatchState {
  matchId: string;
  timeRemaining: number;
  timeElapsed: number;
  phase: "countdown" | "active" | "overtime" | "finished";
  players: Map<PlayerId, PlayerState>;
  zones: Map<ZoneId, ZoneState>;
  scores: Map<TeamId, TeamScore>;
  events: MatchEvent[];
}

export interface MatchEvent {
  time: number;
  type: "zone_captured" | "zone_contested" | "zone_lost" | "player_entered_zone" | "match_start" | "match_end";
  teamId?: TeamId;
  playerId?: PlayerId;
  zoneId?: ZoneId;
  detail: string;
}

export interface MatchResult {
  matchId: string;
  winner: TeamId | null;
  finalScores: Record<TeamId, number>;
  duration: number;
  stats: MatchStats;
}

export interface MatchStats {
  teamStats: Record<TeamId, TeamMatchStats>;
  playerStats: Record<PlayerId, PlayerMatchStats>;
}

export interface TeamMatchStats {
  totalPoints: number;
  zonesCaptured: number;
  zonesLost: number;
  totalTimeInZones: number;
}

export interface PlayerMatchStats {
  distanceTraveled: number;
  zonesEntered: number;
  captureAssists: number;
  timeInZones: number;
  avgBattery: number;
  avgLatency: number;
}

export const DISCLAIMER = "ILLUSTRATIVE SIMULATION — match format and scoring are configurable.";

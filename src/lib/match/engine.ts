/**
 * ILLUSTRATIVE SIMULATION — match engine for zone control.
 * A simple FSM-based engine for the investor/media demo.
 */

import type {
  MatchConfig,
  MatchState,
  MatchEvent,
  PlayerState,
  ZoneState,
  TeamScore,
  PlayerId,
  ZoneId,
  TeamId,
} from "./types";
import { getRobot, type RobotId } from "@/lib/robots/profiles";

const CAPTURE_RATE = 0.4;
const DECAY_RATE = 0.15;
const CAPTURE_THRESHOLD = 1.0;

export function createInitialMatchState(config: MatchConfig): MatchState {
  const players = new Map<PlayerId, PlayerState>();
  const zones = new Map<ZoneId, ZoneState>();
  const scores = new Map<TeamId, TeamScore>();

  for (const player of config.players) {
    const spawns = config.arena.teamSpawns[player.teamId];
    const teamPlayers = config.players.filter((p) => p.teamId === player.teamId);
    const playerIndex = teamPlayers.findIndex((p) => p.id === player.id);
    const spawn = spawns[playerIndex % spawns.length];

    players.set(player.id, {
      playerId: player.id,
      teamId: player.teamId,
      robotId: player.robotId,
      position: { x: spawn.x, y: 0, z: spawn.z },
      heading: spawn.heading,
      velocity: 0,
      battery: 1.0,
      latencyMs: 20 + Math.random() * 30,
      state: "idle",
      inZone: null,
    });
  }

  for (const zone of config.arena.zones) {
    const captureProgress: Record<TeamId, number> = {};
    for (const team of config.teams) {
      captureProgress[team.id] = 0;
    }
    zones.set(zone.id, {
      zoneId: zone.id,
      controlledBy: null,
      captureProgress,
      contested: false,
    });
  }

  for (const team of config.teams) {
    scores.set(team.id, {
      teamId: team.id,
      points: 0,
      zonesControlled: 0,
    });
  }

  return {
    matchId: config.id,
    timeRemaining: config.matchDurationSec,
    timeElapsed: 0,
    phase: "countdown",
    players,
    zones,
    scores,
    events: [],
  };
}

export interface AIBehavior {
  targetZone: ZoneId | null;
  patrolOffset: { x: number; z: number };
  lastDecisionTime: number;
}

export function createAIBehaviors(config: MatchConfig): Map<PlayerId, AIBehavior> {
  const behaviors = new Map<PlayerId, AIBehavior>();
  for (const player of config.players) {
    if (!player.isHumanControlled) {
      behaviors.set(player.id, {
        targetZone: null,
        patrolOffset: { x: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 2 },
        lastDecisionTime: 0,
      });
    }
  }
  return behaviors;
}

function distToZone(
  player: PlayerState,
  zone: { position: { x: number; z: number }; radius: number }
): number {
  return Math.hypot(player.position.x - zone.position.x, player.position.z - zone.position.z);
}

function findNearestUncontrolledZone(
  config: MatchConfig,
  state: MatchState,
  teamId: TeamId
): ZoneId | null {
  let nearest: ZoneId | null = null;
  let nearestDist = Infinity;

  const teamPlayers = Array.from(state.players.values()).filter((p) => p.teamId === teamId);
  const avgPos = {
    x: teamPlayers.reduce((s, p) => s + p.position.x, 0) / teamPlayers.length,
    z: teamPlayers.reduce((s, p) => s + p.position.z, 0) / teamPlayers.length,
  };

  for (const zone of config.arena.zones) {
    const zoneState = state.zones.get(zone.id)!;
    if (zoneState.controlledBy !== teamId) {
      const dist = Math.hypot(avgPos.x - zone.position.x, avgPos.z - zone.position.z);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = zone.id;
      }
    }
  }
  return nearest;
}

function findDefendableZone(
  config: MatchConfig,
  state: MatchState,
  teamId: TeamId
): ZoneId | null {
  for (const zone of config.arena.zones) {
    const zoneState = state.zones.get(zone.id)!;
    if (zoneState.controlledBy === teamId && zoneState.contested) {
      return zone.id;
    }
  }
  for (const zone of config.arena.zones) {
    const zoneState = state.zones.get(zone.id)!;
    if (zoneState.controlledBy === teamId) {
      return zone.id;
    }
  }
  return null;
}

export function updateAIDecisions(
  config: MatchConfig,
  state: MatchState,
  behaviors: Map<PlayerId, AIBehavior>,
  dt: number
): void {
  void dt;
  for (const player of config.players) {
    if (player.isHumanControlled) continue;
    const behavior = behaviors.get(player.id);
    if (!behavior) continue;

    if (state.timeElapsed - behavior.lastDecisionTime > 2 + Math.random() * 2) {
      behavior.lastDecisionTime = state.timeElapsed;

      const teamScore = state.scores.get(player.teamId)!;
      const otherTeam = config.teams.find((t) => t.id !== player.teamId)!;
      const otherScore = state.scores.get(otherTeam.id)!;

      if (teamScore.points < otherScore.points || teamScore.zonesControlled < 2) {
        behavior.targetZone = findNearestUncontrolledZone(config, state, player.teamId);
      } else {
        behavior.targetZone = findDefendableZone(config, state, player.teamId);
      }

      behavior.patrolOffset = {
        x: (Math.random() - 0.5) * 2.5,
        z: (Math.random() - 0.5) * 2.5,
      };
    }
  }
}

export function getAIMovementTarget(
  config: MatchConfig,
  state: MatchState,
  playerId: PlayerId,
  behaviors: Map<PlayerId, AIBehavior>
): { x: number; z: number } | null {
  const behavior = behaviors.get(playerId);
  if (!behavior || !behavior.targetZone) return null;

  const zone = config.arena.zones.find((z) => z.id === behavior.targetZone);
  if (!zone) return null;

  return {
    x: zone.position.x + behavior.patrolOffset.x,
    z: zone.position.z + behavior.patrolOffset.z,
  };
}

export function movePlayer(
  state: MatchState,
  playerId: PlayerId,
  input: { forward: number; turn: number; sprint: boolean },
  dt: number
): void {
  const player = state.players.get(playerId);
  if (!player) return;

  const profile = getRobot(player.robotId as RobotId).simulation;
  const baseSpeed = input.sprint ? profile.runSpeed : profile.walkSpeed;
  const speed = baseSpeed * input.forward;

  player.heading += input.turn * profile.turnSpeed * dt;

  const nx = player.position.x + Math.sin(player.heading) * speed * dt;
  const nz = player.position.z + Math.cos(player.heading) * speed * dt;

  const halfW = 18;
  const halfD = 13;
  player.position.x = Math.max(-halfW, Math.min(halfW, nx));
  player.position.z = Math.max(-halfD, Math.min(halfD, nz));

  player.velocity = Math.abs(speed);
  player.state = player.velocity > 0.1 ? "moving" : "idle";

  player.battery = Math.max(0, player.battery - profile.energyDrainPerSecond * dt * (input.sprint ? 1.5 : 1));
  player.latencyMs = 20 + Math.random() * 30 + (1 - player.battery) * 20;
}

export function moveAIPlayer(
  config: MatchConfig,
  state: MatchState,
  playerId: PlayerId,
  behaviors: Map<PlayerId, AIBehavior>,
  dt: number
): void {
  const player = state.players.get(playerId);
  if (!player) return;

  const target = getAIMovementTarget(config, state, playerId, behaviors);
  if (!target) return;

  const dx = target.x - player.position.x;
  const dz = target.z - player.position.z;
  const dist = Math.hypot(dx, dz);

  if (dist < 0.5) {
    player.velocity = 0;
    player.state = "idle";
    return;
  }

  const desiredHeading = Math.atan2(dx, dz);
  let headingDiff = desiredHeading - player.heading;
  while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
  while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;

  const profile = getRobot(player.robotId as RobotId).simulation;
  const turn = Math.max(-1, Math.min(1, headingDiff * 2));
  player.heading += turn * profile.turnSpeed * dt;

  const sprint = dist > 5;
  const speed = sprint ? profile.runSpeed : profile.walkSpeed;
  const forward = Math.abs(headingDiff) < 0.5 ? 1 : 0.3;

  const nx = player.position.x + Math.sin(player.heading) * speed * forward * dt;
  const nz = player.position.z + Math.cos(player.heading) * speed * forward * dt;

  const halfW = 18;
  const halfD = 13;
  player.position.x = Math.max(-halfW, Math.min(halfW, nx));
  player.position.z = Math.max(-halfD, Math.min(halfD, nz));

  player.velocity = speed * forward;
  player.state = "moving";

  player.battery = Math.max(0, player.battery - profile.energyDrainPerSecond * dt * (sprint ? 1.5 : 1));
  player.latencyMs = 20 + Math.random() * 30 + (1 - player.battery) * 20;
}

export function updateZoneControl(
  config: MatchConfig,
  state: MatchState,
  dt: number
): MatchEvent[] {
  const events: MatchEvent[] = [];

  for (const zone of config.arena.zones) {
    const zoneState = state.zones.get(zone.id)!;
    const playersInZone: { teamId: TeamId; count: number }[] = [];

    for (const [teamId] of state.scores) {
      const count = Array.from(state.players.values()).filter(
        (p) => p.teamId === teamId && distToZone(p, zone) < zone.radius
      ).length;
      if (count > 0) {
        playersInZone.push({ teamId, count });
      }
    }

    for (const player of state.players.values()) {
      const inZone = distToZone(player, zone) < zone.radius;
      const wasInZone = player.inZone === zone.id;
      if (inZone && !wasInZone) {
        player.inZone = zone.id;
        player.state = "capturing";
        events.push({
          time: state.timeElapsed,
          type: "player_entered_zone",
          playerId: player.playerId,
          teamId: player.teamId,
          zoneId: zone.id,
          detail: `${player.playerId} entered ${zone.name}`,
        });
      } else if (!inZone && wasInZone) {
        player.inZone = null;
      }
    }

    const contested = playersInZone.length > 1;
    zoneState.contested = contested;

    if (contested) {
      for (const team of config.teams) {
        zoneState.captureProgress[team.id] = Math.max(
          0,
          zoneState.captureProgress[team.id] - DECAY_RATE * dt * 0.5
        );
      }
    } else if (playersInZone.length === 1) {
      const capturingTeam = playersInZone[0].teamId;
      const otherTeams = config.teams.filter((t) => t.id !== capturingTeam);

      zoneState.captureProgress[capturingTeam] = Math.min(
        CAPTURE_THRESHOLD,
        zoneState.captureProgress[capturingTeam] + CAPTURE_RATE * dt * playersInZone[0].count
      );

      for (const team of otherTeams) {
        zoneState.captureProgress[team.id] = Math.max(
          0,
          zoneState.captureProgress[team.id] - DECAY_RATE * dt
        );
      }

      if (
        zoneState.captureProgress[capturingTeam] >= CAPTURE_THRESHOLD &&
        zoneState.controlledBy !== capturingTeam
      ) {
        const previousOwner = zoneState.controlledBy;
        zoneState.controlledBy = capturingTeam;

        if (previousOwner) {
          const prevScore = state.scores.get(previousOwner)!;
          prevScore.zonesControlled = Math.max(0, prevScore.zonesControlled - 1);
          events.push({
            time: state.timeElapsed,
            type: "zone_lost",
            teamId: previousOwner,
            zoneId: zone.id,
            detail: `${previousOwner} lost ${zone.name}`,
          });
        }

        const score = state.scores.get(capturingTeam)!;
        score.zonesControlled += 1;
        events.push({
          time: state.timeElapsed,
          type: "zone_captured",
          teamId: capturingTeam,
          zoneId: zone.id,
          detail: `${capturingTeam} captured ${zone.name}`,
        });
      }
    } else {
      for (const team of config.teams) {
        if (zoneState.controlledBy !== team.id) {
          zoneState.captureProgress[team.id] = Math.max(
            0,
            zoneState.captureProgress[team.id] - DECAY_RATE * dt
          );
        }
      }
    }
  }

  return events;
}

export function updateScoring(config: MatchConfig, state: MatchState, dt: number): void {
  for (const zone of config.arena.zones) {
    const zoneState = state.zones.get(zone.id)!;
    if (zoneState.controlledBy && !zoneState.contested) {
      const score = state.scores.get(zoneState.controlledBy)!;
      score.points += zone.pointsPerSecond * dt;
    }
  }
}

export function tickMatch(
  config: MatchConfig,
  state: MatchState,
  behaviors: Map<PlayerId, AIBehavior>,
  humanInput: { playerId: PlayerId; forward: number; turn: number; sprint: boolean } | null,
  dt: number
): void {
  if (state.phase === "countdown") {
    return;
  }

  if (state.phase === "finished") {
    return;
  }

  state.timeElapsed += dt;
  state.timeRemaining = Math.max(0, config.matchDurationSec - state.timeElapsed);

  if (state.timeRemaining <= 0) {
    state.phase = "finished";
    state.events.push({
      time: state.timeElapsed,
      type: "match_end",
      detail: "Match ended",
    });
    return;
  }

  updateAIDecisions(config, state, behaviors, dt);

  for (const player of config.players) {
    if (player.isHumanControlled && humanInput && humanInput.playerId === player.id) {
      movePlayer(state, player.id, humanInput, dt);
    } else if (!player.isHumanControlled) {
      moveAIPlayer(config, state, player.id, behaviors, dt);
    }
  }

  const zoneEvents = updateZoneControl(config, state, dt);
  state.events.push(...zoneEvents);

  updateScoring(config, state, dt);
}

export function getMatchResult(config: MatchConfig, state: MatchState): {
  winner: TeamId | null;
  finalScores: Record<TeamId, number>;
  isTie: boolean;
} {
  const scores: Record<TeamId, number> = {};
  let maxScore = -1;
  let winner: TeamId | null = null;
  let isTie = false;

  for (const [teamId, teamScore] of state.scores) {
    scores[teamId] = Math.round(teamScore.points);
    if (teamScore.points > maxScore) {
      maxScore = teamScore.points;
      winner = teamId;
      isTie = false;
    } else if (teamScore.points === maxScore) {
      isTie = true;
    }
  }

  return { winner: isTie ? null : winner, finalScores: scores, isTie };
}

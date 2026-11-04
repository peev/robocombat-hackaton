"use client";

import { useMemo } from "react";
import type {
  MatchConfig,
  MatchState,
  PlayerState,
  TeamConfig,
  ZoneState,
} from "@/lib/match/types";
import { DISCLAIMER } from "@/lib/match/types";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface ScoreBugProps {
  teams: TeamConfig[];
  scores: Map<string, { points: number; zonesControlled: number }>;
  timeRemaining: number;
  phase: MatchState["phase"];
}

function ScoreBug({ teams, scores, timeRemaining, phase }: ScoreBugProps) {
  const teamA = teams[0];
  const teamB = teams[1];
  const scoreA = Math.round(scores.get(teamA.id)?.points ?? 0);
  const scoreB = Math.round(scores.get(teamB.id)?.points ?? 0);
  const zonesA = scores.get(teamA.id)?.zonesControlled ?? 0;
  const zonesB = scores.get(teamB.id)?.zonesControlled ?? 0;

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-stretch overflow-hidden rounded-lg bg-black/80 shadow-2xl backdrop-blur-sm">
        <div
          className="flex min-w-[140px] flex-col items-center justify-center px-4 py-2"
          style={{ backgroundColor: `${teamA.primaryColor}20` }}
        >
          <span
            className="text-xs font-bold tracking-wider"
            style={{ color: teamA.primaryColor }}
          >
            {teamA.shortName}
          </span>
          <span className="font-mono text-3xl font-bold text-white">{scoreA}</span>
          <div className="mt-1 flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-3 rounded-sm"
                style={{
                  backgroundColor: i < zonesA ? teamA.primaryColor : "#333",
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center border-x border-white/10 bg-black/60 px-4">
          <span className="text-[10px] uppercase tracking-widest text-white/50">
            {phase === "countdown" ? "STARTING" : phase === "finished" ? "FINAL" : "LIVE"}
          </span>
          <span className="font-mono text-2xl font-bold text-white">
            {formatTime(timeRemaining)}
          </span>
          {phase === "active" && (
            <span className="flex items-center gap-1 text-[10px] text-white/40">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              LIVE
            </span>
          )}
        </div>

        <div
          className="flex min-w-[140px] flex-col items-center justify-center px-4 py-2"
          style={{ backgroundColor: `${teamB.primaryColor}20` }}
        >
          <span
            className="text-xs font-bold tracking-wider"
            style={{ color: teamB.primaryColor }}
          >
            {teamB.shortName}
          </span>
          <span className="font-mono text-3xl font-bold text-white">{scoreB}</span>
          <div className="mt-1 flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-3 rounded-sm"
                style={{
                  backgroundColor: i < zonesB ? teamB.primaryColor : "#333",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PlayerTelemetryProps {
  player: PlayerState;
  team: TeamConfig;
  isControlled: boolean;
  displayName: string;
}

function PlayerTelemetry({ player, team, isControlled, displayName }: PlayerTelemetryProps) {
  const speedKmh = (player.velocity * 3.6).toFixed(1);
  const batteryPercent = Math.round(player.battery * 100);
  const latencyMs = Math.round(player.latencyMs);

  return (
    <div
      className="flex min-w-[180px] flex-col rounded border-l-2 bg-black/70 px-3 py-2 backdrop-blur-sm"
      style={{ borderColor: team.primaryColor }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: team.primaryColor }}>
          {displayName}
        </span>
        {isControlled && (
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/70">
            YOU
          </span>
        )}
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-2 text-[10px]">
        <div className="flex flex-col">
          <span className="text-white/40">SPEED</span>
          <span className="font-mono text-white">{speedKmh}</span>
          <span className="text-white/30">km/h</span>
        </div>
        <div className="flex flex-col">
          <span className="text-white/40">BATTERY</span>
          <span
            className="font-mono"
            style={{ color: batteryPercent < 20 ? "#ff4444" : batteryPercent < 50 ? "#ffaa00" : "#44ff44" }}
          >
            {batteryPercent}%
          </span>
          <div className="mt-0.5 h-1 w-full rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${batteryPercent}%`,
                backgroundColor: batteryPercent < 20 ? "#ff4444" : batteryPercent < 50 ? "#ffaa00" : "#44ff44",
              }}
            />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-white/40">LATENCY</span>
          <span
            className="font-mono"
            style={{ color: latencyMs > 60 ? "#ffaa00" : "#44ff44" }}
          >
            {latencyMs}
          </span>
          <span className="text-white/30">ms</span>
        </div>
      </div>
      <div className="mt-1.5 text-[9px] uppercase tracking-wider text-white/30">
        {player.state === "idle" ? "STANDBY" : player.state === "capturing" ? "IN ZONE" : "MOVING"}
      </div>
    </div>
  );
}

interface ZoneStatusProps {
  zones: Map<string, ZoneState>;
  zoneConfigs: { id: string; name: string; pointsPerSecond: number }[];
  teams: TeamConfig[];
}

function ZoneStatus({ zones, zoneConfigs, teams }: ZoneStatusProps) {
  return (
    <div className="flex gap-2">
      {zoneConfigs.map((zone) => {
        const state = zones.get(zone.id);
        const team = state?.controlledBy ? teams.find((t) => t.id === state.controlledBy) : null;
        const color = team?.primaryColor ?? "#444";
        return (
          <div
            key={zone.id}
            className="flex flex-col items-center rounded bg-black/60 px-3 py-1.5 backdrop-blur-sm"
          >
            <span className="text-[9px] uppercase tracking-wider text-white/40">{zone.name}</span>
            <div
              className="mt-1 flex h-4 w-4 items-center justify-center rounded-full"
              style={{ backgroundColor: color }}
            >
              {state?.contested && (
                <span className="text-[8px] font-bold text-white">!</span>
              )}
            </div>
            <span className="mt-0.5 text-[8px] text-white/30">+{zone.pointsPerSecond}/s</span>
          </div>
        );
      })}
    </div>
  );
}

function ControlsHelp() {
  return (
    <div className="rounded bg-black/60 px-3 py-2 backdrop-blur-sm">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
        <span className="text-white/40">W/↑</span>
        <span className="text-white/70">Forward</span>
        <span className="text-white/40">S/↓</span>
        <span className="text-white/70">Backward</span>
        <span className="text-white/40">A/D</span>
        <span className="text-white/70">Turn</span>
        <span className="text-white/40">SHIFT</span>
        <span className="text-white/70">Sprint</span>
        <span className="text-white/40">C</span>
        <span className="text-white/70">Camera</span>
      </div>
    </div>
  );
}

export interface BroadcastHUDProps {
  config: MatchConfig;
  state: MatchState;
  controlledPlayerId: string | null;
  showControls?: boolean;
}

export function BroadcastHUD({ config, state, controlledPlayerId, showControls = true }: BroadcastHUDProps) {
  const controlledPlayer = controlledPlayerId ? state.players.get(controlledPlayerId) : null;
  const controlledTeam = controlledPlayer
    ? config.teams.find((t) => t.id === controlledPlayer.teamId)
    : null;

  const teamPlayers = useMemo(() => {
    const result: Map<string, { player: PlayerState; team: TeamConfig; config: typeof config.players[0] }[]> = new Map();
    for (const team of config.teams) {
      result.set(team.id, []);
    }
    for (const [playerId, player] of state.players) {
      const team = config.teams.find((t) => t.id === player.teamId);
      const playerConfig = config.players.find((p) => p.id === playerId);
      if (team && playerConfig) {
        result.get(team.id)!.push({ player, team, config: playerConfig });
      }
    }
    return result;
  }, [config, state.players]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute left-1/2 top-4 -translate-x-1/2">
        <ScoreBug
          teams={config.teams}
          scores={state.scores}
          timeRemaining={state.timeRemaining}
          phase={state.phase}
        />
      </div>

      <div className="absolute right-4 top-4">
        <ZoneStatus zones={state.zones} zoneConfigs={config.arena.zones} teams={config.teams} />
      </div>

      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        {teamPlayers.get(config.teams[0].id)?.map(({ player, team, config: pc }) => (
          <PlayerTelemetry
            key={player.playerId}
            player={player}
            team={team}
            isControlled={player.playerId === controlledPlayerId}
            displayName={pc.displayName}
          />
        ))}
      </div>

      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
        {teamPlayers.get(config.teams[1].id)?.map(({ player, team, config: pc }) => (
          <PlayerTelemetry
            key={player.playerId}
            player={player}
            team={team}
            isControlled={player.playerId === controlledPlayerId}
            displayName={pc.displayName}
          />
        ))}
      </div>

      {showControls && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <ControlsHelp />
        </div>
      )}

      <div className="absolute left-4 top-4">
        <div className="rounded bg-black/60 px-2 py-1 text-[9px] uppercase tracking-widest text-white/40">
          {config.arena.name}
        </div>
      </div>

      {controlledPlayer && controlledTeam && (
        <div className="absolute left-4 top-12">
          <div
            className="rounded border-l-2 bg-black/60 px-2 py-1 text-[10px] uppercase tracking-wider"
            style={{ borderColor: controlledTeam.primaryColor }}
          >
            <span style={{ color: controlledTeam.primaryColor }}>PILOTING</span>
            <span className="ml-2 text-white">
              {config.players.find((p) => p.id === controlledPlayerId)?.displayName}
            </span>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
        <span className="text-[8px] uppercase tracking-widest text-white/20">{DISCLAIMER}</span>
      </div>
    </div>
  );
}

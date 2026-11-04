"use client";

import type { MatchConfig, MatchState, TeamId } from "@/lib/match/types";
import { DISCLAIMER } from "@/lib/match/types";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface TeamStatsCardProps {
  teamName: string;
  teamColor: string;
  score: number;
  zonesControlled: number;
  isWinner: boolean;
  players: {
    name: string;
    distanceTraveled: number;
    avgBattery: number;
    avgLatency: number;
  }[];
}

function TeamStatsCard({
  teamName,
  teamColor,
  score,
  zonesControlled,
  isWinner,
  players,
}: TeamStatsCardProps) {
  return (
    <div
      className={`flex flex-col rounded-lg border bg-black/80 p-4 backdrop-blur-sm ${
        isWinner ? "border-2" : "border-white/10"
      }`}
      style={{ borderColor: isWinner ? teamColor : undefined }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: teamColor }}
          />
          <span
            className="text-sm font-bold uppercase tracking-wider"
            style={{ color: teamColor }}
          >
            {teamName}
          </span>
        </div>
        {isWinner && (
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/80">
            WINNER
          </span>
        )}
      </div>

      <div className="mb-4 flex items-end gap-2">
        <span className="font-mono text-5xl font-bold text-white">{score}</span>
        <span className="mb-2 text-sm text-white/40">points</span>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-white/40">ZONES HELD:</span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-4 rounded-sm"
              style={{
                backgroundColor: i < zonesControlled ? teamColor : "#333",
              }}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 pt-3">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-white/40">
          PLAYER STATS
        </p>
        {players.map((player, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-white/5 py-1.5 last:border-0"
          >
            <span className="text-xs text-white/70">{player.name}</span>
            <div className="flex gap-3 text-[10px] text-white/50">
              <span>{player.distanceTraveled.toFixed(0)}m</span>
              <span
                style={{
                  color:
                    player.avgBattery < 30
                      ? "#ff4444"
                      : player.avgBattery < 60
                        ? "#ffaa00"
                        : "#44ff44",
                }}
              >
                {player.avgBattery}%
              </span>
              <span>{player.avgLatency}ms</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface WinnerScreenProps {
  config: MatchConfig;
  state: MatchState;
  winner: TeamId | null;
  finalScores: Record<string, number>;
  isTie: boolean;
  onRestart: () => void;
  onExit?: () => void;
}

export function WinnerScreen({
  config,
  state,
  winner,
  finalScores,
  isTie,
  onRestart,
  onExit,
}: WinnerScreenProps) {
  const winnerTeam = winner ? config.teams.find((t) => t.id === winner) : null;

  const teamStats = config.teams.map((team) => {
    const score = state.scores.get(team.id);
    const teamPlayers = config.players
      .filter((p) => p.teamId === team.id)
      .map((p) => {
        const playerState = state.players.get(p.id);
        return {
          name: p.displayName,
          distanceTraveled: playerState
            ? Math.sqrt(
                playerState.position.x ** 2 + playerState.position.z ** 2
              ) * 2
            : 0,
          avgBattery: Math.round((playerState?.battery ?? 1) * 100),
          avgLatency: Math.round(playerState?.latencyMs ?? 30),
        };
      });

    return {
      team,
      score: finalScores[team.id] ?? 0,
      zonesControlled: score?.zonesControlled ?? 0,
      players: teamPlayers,
    };
  });

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-3xl px-4">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.5em] text-white/40">
            {config.name}
          </p>
          <h1 className="mt-2 font-display text-5xl font-bold tracking-wider text-white md:text-6xl">
            {isTie ? "MATCH TIED" : "MATCH COMPLETE"}
          </h1>
          {winnerTeam && (
            <p
              className="mt-2 text-xl font-bold uppercase tracking-wider"
              style={{ color: winnerTeam.primaryColor }}
            >
              {winnerTeam.name} WINS
            </p>
          )}
          <p className="mt-2 text-sm text-white/40">
            Duration: {formatTime(state.timeElapsed)}
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {teamStats.map(({ team, score, zonesControlled, players }) => (
            <TeamStatsCard
              key={team.id}
              teamName={team.name}
              teamColor={team.primaryColor}
              score={score}
              zonesControlled={zonesControlled}
              isWinner={team.id === winner}
              players={players}
            />
          ))}
        </div>

        <div className="mb-4 rounded bg-black/40 p-4">
          <h3 className="mb-2 text-xs uppercase tracking-wider text-white/40">
            MATCH EVENTS
          </h3>
          <div className="max-h-32 overflow-y-auto text-xs">
            {state.events
              .filter(
                (e) =>
                  e.type === "zone_captured" ||
                  e.type === "zone_lost" ||
                  e.type === "match_start" ||
                  e.type === "match_end"
              )
              .slice(-10)
              .map((event, i) => {
                const team = event.teamId
                  ? config.teams.find((t) => t.id === event.teamId)
                  : null;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 border-b border-white/5 py-1 last:border-0"
                  >
                    <span className="font-mono text-white/30">
                      {formatTime(event.time)}
                    </span>
                    {team && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: team.primaryColor }}
                      />
                    )}
                    <span className="text-white/60">{event.detail}</span>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={onRestart}
            className="rounded bg-[#e10600] px-6 py-2 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff1a1a]"
          >
            PLAY AGAIN
          </button>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="rounded border border-white/20 bg-transparent px-6 py-2 text-sm font-bold uppercase tracking-wider text-white/70 transition-colors hover:bg-white/10"
            >
              EXIT DEMO
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-[9px] uppercase tracking-widest text-white/20">
          {DISCLAIMER}
        </p>
      </div>
    </div>
  );
}

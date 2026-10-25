"use client";

import type { RobotTelemetry } from "@/lib/simulation/types";
import { getRobot } from "@/lib/robots/profiles";

export function TelemetryPanel({
  robots,
  missionProgress,
}: {
  robots: RobotTelemetry[];
  missionProgress: string[];
}) {
  return (
    <section className="panel">
      <h2 className="panel-title">LIVE TELEMETRY</h2>
      <p className="mb-2 text-[10px] text-white/40">
        ILLUSTRATIVE SIMULATION — measured from deterministic sim ticks
      </p>
      <div className="flex flex-col gap-2">
        {robots.map((r) => {
          const p = getRobot(r.robotId);
          return (
            <div
              key={r.robotId}
              className="rounded border border-white/10 bg-black/40 p-2 text-xs"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-white">{p.displayName}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    r.state === "COMPLETED"
                      ? "bg-emerald-900 text-emerald-300"
                      : r.state === "FAILED"
                        ? "bg-red-900 text-red-300"
                        : "bg-white/10 text-white/70"
                  }`}
                >
                  {r.state}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px] text-white/70">
                <span>Score {r.score}</span>
                <span>Energy {(r.energy * 100).toFixed(0)}%</span>
                <span>Dist {r.distanceTraveled.toFixed(1)}m</span>
                <span>Coll {r.collisions}</span>
                <span>Falls {r.falls}</span>
                <span>Path {(r.pathEfficiency * 100).toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
        {!robots.length && (
          <p className="text-xs text-white/40">Run an experiment to stream telemetry.</p>
        )}
      </div>
      {missionProgress.length > 0 && (
        <div className="mt-3 border-t border-white/10 pt-2">
          <h3 className="mb-1 text-[10px] uppercase tracking-wider text-white/50">
            Objectives
          </h3>
          <ul className="space-y-0.5 text-[10px] text-white/70">
            {missionProgress.map((o) => (
              <li key={o}>✓ {o}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

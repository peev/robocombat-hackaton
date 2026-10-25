"use client";

import { useEffect, useState } from "react";
import type { ExperimentResult, RobotTelemetry } from "@/lib/simulation/types";
import { getRobot } from "@/lib/robots/profiles";
import { ROBOT_COLOR } from "./LivePerformance";

interface Metric {
  label: string;
  better: "high" | "low";
  get: (r: RobotTelemetry) => number | undefined;
  fmt: (v: number) => string;
}

function finishTime(result: ExperimentResult, robotId: string): number {
  for (const s of result.snapshots) {
    const r = s.robots.find((x) => x.robotId === robotId);
    if (r && (r.missionComplete || r.state === "COMPLETED")) return s.time;
  }
  return result.durationSec;
}

function useCountUp(target: number, ms = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/** End-of-mission scorecard comparing the three robots side by side. */
export function MissionBenchmark({ result, index }: { result: ExperimentResult; index: number }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const fire = result.config.mission === "fire-rescue";
  const robots = result.final.robots;
  const finish = new Map(robots.map((r) => [r.robotId, finishTime(result, r.robotId)]));
  const ranked = [...robots].sort((a, b) => b.score - a.score);
  const rank = new Map(ranked.map((r, i) => [r.robotId, i + 1]));

  const metrics: Metric[] = [
    { label: "Finish time", better: "low", get: (r) => finish.get(r.robotId), fmt: (v) => `${v.toFixed(1)}s` },
    ...(fire
      ? ([
          { label: "Fire located", better: "low", get: (r) => r.timeToLocateFire, fmt: (v) => `${v.toFixed(1)}s` },
          { label: "Suppression", better: "low", get: (r) => r.suppressionTime, fmt: (v) => `${v.toFixed(1)}s` },
          { label: "Water used", better: "low", get: (r) => r.waterUsed, fmt: (v) => v.toFixed(1) },
        ] as Metric[])
      : ([
          { label: "Deposit found", better: "low", get: (r) => r.timeToIdentifyDeposit, fmt: (v) => `${v.toFixed(1)}s` },
          { label: "Ore recovered", better: "high", get: (r) => r.materialRecoveredKg, fmt: (v) => `${v.toFixed(1)}kg` },
        ] as Metric[])),
    { label: "Path efficiency", better: "high", get: (r) => r.pathEfficiency * 100, fmt: (v) => `${v.toFixed(0)}%` },
    { label: "Energy left", better: "high", get: (r) => r.energy * 100, fmt: (v) => `${v.toFixed(0)}%` },
    { label: "Distance", better: "low", get: (r) => r.distanceTraveled, fmt: (v) => `${v.toFixed(1)}m` },
    { label: "Collisions", better: "low", get: (r) => r.collisions, fmt: (v) => `${v}` },
    { label: "Falls", better: "low", get: (r) => r.falls, fmt: (v) => `${v}` },
  ];

  const winner = ranked[0];

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-[3px]">
      <div
        className={`w-[min(980px,92%)] border border-white/10 bg-[#0a0b0c]/90 p-5 transition-all duration-500 ${
          shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.5em] text-[#e10600]">
              Mission {String(index).padStart(2, "0")} · benchmark
            </p>
            <h2 className="font-display text-4xl tracking-[0.12em]">{fire ? "FIRE RESCUE" : "DEEP MINE"}</h2>
          </div>
          <p className="text-right font-mono text-[10px] uppercase tracking-wider text-white/40">
            seed {result.config.conditions.seed} · identical conditions
          </p>
        </div>

        <div className="grid grid-cols-[150px_repeat(3,1fr)] gap-x-4">
          <div />
          {robots.map((r) => (
            <RobotHeader key={r.robotId} robot={r} rank={rank.get(r.robotId)!} />
          ))}

          {metrics.map((m, row) => {
            const vals = robots.map((r) => m.get(r));
            const defined = vals.filter((v): v is number => v != null);
            const best = defined.length ? (m.better === "high" ? Math.max(...defined) : Math.min(...defined)) : undefined;
            const allEqual = defined.length > 1 && defined.every((v) => v === defined[0]);
            const max = Math.max(...defined, 1e-6);
            const min = Math.min(...defined);
            return (
              <div key={m.label} className="contents">
                <div className="flex items-center border-t border-white/5 py-1.5 text-[11px] uppercase tracking-wider text-white/50">
                  {m.label}
                </div>
                {robots.map((r, i) => {
                  const v = vals[i];
                  const color = ROBOT_COLOR[r.robotId];
                  const frac =
                    v == null ? 0 : m.better === "high" ? v / max : v === 0 ? 1 : Math.max(0.08, (min || 0) === 0 ? 1 - v / (max * 1.25) : min / v);
                  const isBest = v != null && v === best && !allEqual;
                  return (
                    <div key={r.robotId} className="flex items-center gap-2 border-t border-white/5 py-1.5">
                      <div className="relative h-2.5 flex-1 overflow-hidden rounded-sm bg-white/5">
                        <div
                          className="absolute inset-y-0 left-0 rounded-sm transition-[width] duration-700 ease-out"
                          style={{
                            width: shown ? `${Math.max(0, Math.min(1, frac)) * 100}%` : "0%",
                            transitionDelay: `${150 + row * 70}ms`,
                            background: isBest ? color : `${color}66`,
                          }}
                        />
                      </div>
                      <span className={`w-14 text-right font-mono text-[12px] tabular-nums ${isBest ? "text-white" : "text-white/55"}`}>
                        {v == null ? "—" : m.fmt(v)}
                      </span>
                      <span className="w-3 text-[11px]" style={{ color }}>
                        {isBest ? "★" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Mission winner</p>
          <p className="font-display text-3xl tracking-[0.1em]" style={{ color: ROBOT_COLOR[winner.robotId] }}>
            {getRobot(winner.robotId).displayName}
          </p>
        </div>
      </div>
    </div>
  );
}

function RobotHeader({ robot, rank }: { robot: RobotTelemetry; rank: number }) {
  const score = useCountUp(robot.score);
  const color = ROBOT_COLOR[robot.robotId];
  const medal = ["#f5c542", "#c9ced6", "#c07a3a"][rank - 1] ?? "#555";
  return (
    <div className="mb-2 border-t-2 pt-2" style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color }}>
          {getRobot(robot.robotId).displayName}
        </span>
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full font-display text-sm text-black"
          style={{ background: medal }}
        >
          {rank}
        </span>
      </div>
      <p className="font-mono text-5xl leading-tight tabular-nums text-white">{score}</p>
      <p className="text-[9px] uppercase tracking-[0.3em] text-white/35">score</p>
    </div>
  );
}

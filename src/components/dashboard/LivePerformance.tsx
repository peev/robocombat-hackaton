"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { ExperimentResult, MissionId, RobotTelemetry } from "@/lib/simulation/types";
import type { RobotId } from "@/lib/robots/profiles";
import { getRobot } from "@/lib/robots/profiles";
import { computeMissionScore } from "@/lib/simulation/scoring";

export const ROBOT_COLOR: Record<RobotId, string> = {
  "unitree-g1": "#3b8cff",
  "bd-atlas": "#ff3b30",
  "agibot-a2": "#ffb000",
};

const RADAR_KEYS: { key: string; label: string }[] = [
  { key: "navigation", label: "NAV" },
  { key: "stability", label: "STAB" },
  { key: "manipulation", label: "MANIP" },
  { key: "perception", label: "PERC" },
  { key: "energy", label: "ENERGY" },
  { key: "taskAccuracy", label: "TASK" },
];

const OBJECTIVE_TOTAL: Record<MissionId, number> = { "fire-rescue": 8, "deep-mine": 5 };

interface Sample {
  t: number;
  [k: string]: number;
}

function liveScore(mission: MissionId, r: RobotTelemetry, t: number) {
  return computeMissionScore(mission, r, Math.max(t, 0.1));
}

export function LivePerformance({ result, time }: { result: ExperimentResult | null; time: number }) {
  const mission = result?.config.mission ?? "fire-rescue";

  // Whole-run series computed once per experiment; the charts reveal it up to the playhead.
  const series = useMemo(() => {
    if (!result) return [] as Sample[];
    return result.snapshots.map((s) => {
      const row: Sample = { t: Math.round(s.time * 10) / 10 };
      for (const r of s.robots) {
        row[`${r.robotId}:score`] = liveScore(mission, r, s.time).score;
        row[`${r.robotId}:energy`] = Math.round(r.energy * 100);
      }
      return row;
    });
  }, [result, mission]);

  if (!result) {
    return (
      <section className="panel">
        <h2 className="panel-title">LIVE PERFORMANCE</h2>
        <div className="flex h-24 items-center justify-center text-[11px] uppercase tracking-[0.3em] text-white/25">
          awaiting run
        </div>
      </section>
    );
  }

  const ids = result.config.robotIds;
  const idx = Math.max(0, result.snapshots.findIndex((s) => s.time > time) - 1);
  const atEnd = time >= result.durationSec - 1e-3;
  const snap = atEnd ? result.final : result.snapshots[idx] ?? result.final;
  const visible = series.filter((s) => s.t <= time + 1e-6);
  const live = snap.robots.map((r) => {
    const { score, categoryScores } = atEnd ? { score: r.score, categoryScores: r.categoryScores } : liveScore(mission, r, time);
    return { r, score, categoryScores };
  });
  const ranked = [...live].sort((a, b) => b.score - a.score);
  const radarData = RADAR_KEYS.map(({ key, label }) => {
    const row: Record<string, number | string> = { axis: label };
    for (const l of live) row[l.r.robotId] = Math.round(l.categoryScores[key] ?? 0);
    return row;
  });
  const objectivesTotal = OBJECTIVE_TOTAL[mission];

  return (
    <section className="panel space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="panel-title">LIVE PERFORMANCE</h2>
        <span className="font-mono text-[10px] text-white/40">
          T+{time.toFixed(1)}s
        </span>
      </header>

      {/* Score race */}
      <div className="space-y-1.5">
        {ranked.map(({ r, score }, i) => {
          const color = ROBOT_COLOR[r.robotId];
          const done = r.objectivesCompleted.length;
          return (
            <div key={r.robotId} className="grid grid-cols-[18px_56px_1fr_34px] items-center gap-2">
              <span className={`font-display text-sm ${i === 0 ? "text-white" : "text-white/40"}`}>{i + 1}</span>
              <span className="truncate text-[11px] font-semibold" style={{ color }}>
                {getRobot(r.robotId).shortName}
              </span>
              <div className="relative h-3 overflow-hidden rounded-sm bg-white/5">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm transition-[width] duration-500 ease-out"
                  style={{ width: `${score}%`, background: `linear-gradient(90deg, ${color}55, ${color})` }}
                />
                <div className="absolute inset-0 flex gap-px px-px py-[3px]">
                  {Array.from({ length: objectivesTotal }).map((_, k) => (
                    <span key={k} className={`flex-1 rounded-[1px] ${k < done ? "bg-white/50" : "bg-transparent"}`} />
                  ))}
                </div>
              </div>
              <span className="text-right font-mono text-sm text-white">{score}</span>
            </div>
          );
        })}
      </div>

      {/* Score over time */}
      <Chart title="SCORE">
        <LineChart data={visible} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
          <XAxis dataKey="t" type="number" domain={[0, result.durationSec]} hide />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#666" }} tickCount={3} />
          {ids.map((id) => (
            <Line key={id} dataKey={`${id}:score`} stroke={ROBOT_COLOR[id]} dot={false} strokeWidth={2} isAnimationActive={false} />
          ))}
        </LineChart>
      </Chart>

      {/* Energy */}
      <Chart title="ENERGY %">
        <AreaChart data={visible} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
          <XAxis dataKey="t" type="number" domain={[0, result.durationSec]} hide />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#666" }} tickCount={3} />
          {ids.map((id) => (
            <Area
              key={id}
              dataKey={`${id}:energy`}
              stroke={ROBOT_COLOR[id]}
              fill={ROBOT_COLOR[id]}
              fillOpacity={0.08}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </Chart>

      {/* Capability radar */}
      <div>
        <p className="mb-0.5 text-[9px] uppercase tracking-[0.25em] text-white/40">CAPABILITY</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid stroke="#2a2a2a" />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: "#8a8a8a" }} />
              {ids.map((id) => (
                <Radar
                  key={id}
                  dataKey={id}
                  stroke={ROBOT_COLOR[id]}
                  fill={ROBOT_COLOR[id]}
                  fillOpacity={0.12}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Incident tiles */}
      <div className="grid grid-cols-3 gap-1.5">
        {live.map(({ r }) => (
          <div key={r.robotId} className="rounded-sm border-t-2 bg-white/[0.03] px-1.5 py-1" style={{ borderColor: ROBOT_COLOR[r.robotId] }}>
            <Stat icon="⟷" value={`${r.distanceTraveled.toFixed(0)}m`} />
            <Stat icon="✕" value={r.collisions} warn={r.collisions > 0} />
            <Stat icon="⤓" value={r.falls} warn={r.falls > 0} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Chart({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div>
      <p className="mb-0.5 text-[9px] uppercase tracking-[0.25em] text-white/40">{title}</p>
      <div className="h-20">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Stat({ icon, value, warn }: { icon: string; value: string | number; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between font-mono text-[11px]">
      <span className="text-white/35">{icon}</span>
      <span className={warn ? "text-[#ff6b5a]" : "text-white/85"}>{value}</span>
    </div>
  );
}

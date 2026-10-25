"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getRobot, ROBOT_IDS, type RobotId } from "@/lib/robots/profiles";
import type { ExperimentResult, MissionId, RobotState, RobotTelemetry } from "@/lib/simulation/types";
import { computeMissionScore } from "@/lib/simulation/scoring";
import { ROBOT_COLOR } from "./LivePerformance";

interface RankingEntry {
  robotId: RobotId;
  mission: string;
  score: number;
  tests: number;
  categoryScores: Record<string, number>;
  simulated: true;
}

const CATEGORIES: { key: string; label: string }[] = [
  { key: "navigation", label: "NAV" },
  { key: "stability", label: "STB" },
  { key: "manipulation", label: "MAN" },
  { key: "perception", label: "PER" },
  { key: "energy", label: "NRG" },
  { key: "taskAccuracy", label: "TSK" },
];

const STATE_SHORT: Record<RobotState, string> = {
  IDLE: "STANDBY",
  NAVIGATING: "NAVIGATING",
  SEARCHING: "SCANNING",
  INTERACTING: "OPERATING",
  CARRYING: "HAULING",
  SUPPRESSING: "SUPPRESSING",
  RECOVERING: "RECOVERING",
  COMPLETED: "COMPLETE",
  FAILED: "FAILED",
};

const STATE_LED: Record<RobotState, string> = {
  IDLE: "#6b7280",
  NAVIGATING: "#3bd16f",
  SEARCHING: "#38bdf8",
  INTERACTING: "#a78bfa",
  CARRYING: "#ffb000",
  SUPPRESSING: "#ff5a1f",
  RECOVERING: "#ff3b30",
  COMPLETED: "#76b900",
  FAILED: "#ff3b30",
};

const MAX_SPEED = 3;
const SPARK_WINDOW = 20;

interface LiveRow {
  robotId: RobotId;
  state: RobotState;
  score: number;
  delta: number;
  speed: number;
  energy: number;
  distance: number;
  collisions: number;
  falls: number;
  objectives: number;
  categories: Record<string, number>;
  spark: number[];
}

function speedBetween(a: RobotTelemetry, b: RobotTelemetry, dt: number) {
  if (dt <= 0) return 0;
  return Math.hypot(b.position.x - a.position.x, b.position.z - a.position.z) / dt;
}

function liveRows(result: ExperimentResult, time: number): LiveRow[] {
  const mission = result.config.mission;
  const snaps = result.snapshots;
  const atEnd = time >= result.durationSec - 1e-3;
  let i = snaps.findIndex((s) => s.time > time) - 1;
  if (i < 0) i = atEnd ? snaps.length - 1 : 0;
  const snap = atEnd ? result.final : snaps[i];
  const back = snaps[Math.max(0, i - 3)];

  return snap.robots.map((r) => {
    const scored = atEnd ? { score: r.score, categoryScores: r.categoryScores } : computeMissionScore(mission, r, Math.max(time, 0.1));
    const prev = back.robots.find((x) => x.robotId === r.robotId) ?? r;
    const prevScore = computeMissionScore(mission, prev, Math.max(back.time, 0.1)).score;
    const spark: number[] = [];
    for (let k = Math.max(1, i - SPARK_WINDOW * 2); k <= i; k++) {
      const a = snaps[k - 1].robots.find((x) => x.robotId === r.robotId);
      const b = snaps[k].robots.find((x) => x.robotId === r.robotId);
      spark.push(a && b ? speedBetween(a, b, snaps[k].time - snaps[k - 1].time) : 0);
    }
    const next = snaps[Math.min(snaps.length - 1, i + 1)];
    const nr = next.robots.find((x) => x.robotId === r.robotId);
    const speed = atEnd || !nr ? 0 : speedBetween(r, nr, next.time - snaps[i].time);
    return {
      robotId: r.robotId,
      state: atEnd ? (r.missionComplete ? "COMPLETED" : r.state) : r.state,
      score: scored.score,
      delta: scored.score - prevScore,
      speed,
      energy: Math.round(r.energy * 100),
      distance: r.distanceTraveled,
      collisions: r.collisions,
      falls: r.falls,
      objectives: r.objectivesCompleted.length,
      categories: scored.categoryScores,
      spark,
    };
  });
}

export function Leaderboard({
  refreshKey,
  result,
  time,
}: {
  refreshKey: number;
  result?: ExperimentResult | null;
  time?: number;
}) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [tab, setTab] = useState<MissionId>("fire-rescue");

  useEffect(() => {
    fetch("/api/rankings")
      .then((r) => r.json())
      .then((d) => setRankings(d.rankings ?? []))
      .catch(() => undefined);
  }, [refreshKey]);

  const live = !!result;
  const mission: MissionId = result?.config.mission ?? tab;
  const history = useMemo(() => {
    const map = new Map<RobotId, RankingEntry>();
    for (const r of rankings) if (r.mission === mission) map.set(r.robotId, r);
    return map;
  }, [rankings, mission]);

  const rows: LiveRow[] = live
    ? liveRows(result!, time ?? 0)
    : ROBOT_IDS.filter((id) => history.has(id)).map((id) => {
        const h = history.get(id)!;
        return {
          robotId: id,
          state: "IDLE" as RobotState,
          score: h.score,
          delta: 0,
          speed: 0,
          energy: h.categoryScores.energy ?? 0,
          distance: 0,
          collisions: 0,
          falls: 0,
          objectives: 0,
          categories: h.categoryScores,
          spark: [],
        };
      });
  const ranked = [...rows].sort((a, b) => b.score - a.score);
  const rankOf = new Map(ranked.map((r, i) => [r.robotId, i + 1]));
  const order = live ? rows : ranked;

  return (
    <section className="rounded-sm border border-white/10 bg-[#0b0c0d] p-2">
      <header className="mb-2 flex items-center gap-3">
        <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-[#e10600]" : "bg-white/20"}`} />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/85">Robocombat control</h2>
        <span className="font-mono text-[10px] text-white/35">
          {live ? `LIVE · ${mission === "fire-rescue" ? "FIRE RESCUE" : "DEEP MINE"} · T+${(time ?? 0).toFixed(1)}s` : "STANDBY · SESSION RANKINGS"}
        </span>
        <div className="ml-auto flex gap-1">
          {(["fire-rescue", "deep-mine"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={live}
              onClick={() => setTab(m)}
              className={`rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                mission === m ? "bg-[#e10600] text-white" : "bg-white/5 text-white/50"
              } disabled:cursor-default`}
            >
              {m === "fire-rescue" ? "Fire" : "Mine"}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {order.map((r) => (
          <RobotCard key={r.robotId} row={r} rank={rankOf.get(r.robotId)!} live={live} tests={history.get(r.robotId)?.tests ?? 0} />
        ))}
        {!order.length && (
          <div className="col-span-3 py-6 text-center text-[11px] uppercase tracking-[0.3em] text-white/25">no runs yet</div>
        )}
      </div>
      <p className="mt-1.5 text-[9px] uppercase tracking-wider text-amber-500/60">Simulated — not verified hardware performance</p>
    </section>
  );
}

function useFlash(value: number) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (value > prev.current) {
      setFlash(true);
      const id = setTimeout(() => setFlash(false), 900);
      prev.current = value;
      return () => clearTimeout(id);
    }
    prev.current = value;
  }, [value]);
  return flash;
}

function RobotCard({ row, rank, live, tests }: { row: LiveRow; rank: number; live: boolean; tests: number }) {
  const color = ROBOT_COLOR[row.robotId];
  const led = STATE_LED[row.state];
  const hitFlash = useFlash(row.collisions + row.falls);
  const energyColor = row.energy > 50 ? "#76b900" : row.energy > 25 ? "#ffb000" : "#ff3b30";

  return (
    <div
      className={`relative overflow-hidden rounded-sm border bg-gradient-to-b from-white/[0.04] to-transparent p-2 transition-colors duration-300 ${
        hitFlash ? "border-[#ff3b30]" : "border-white/10"
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: color }} />
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="font-display text-xl leading-none text-white/90">{rank}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>
            {getRobot(row.robotId).displayName}
          </p>
          <p className="flex items-center gap-1 text-[9px] font-semibold tracking-[0.2em]" style={{ color: led }}>
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${live && row.state !== "COMPLETED" ? "animate-pulse" : ""}`}
              style={{ background: led, boxShadow: `0 0 6px ${led}` }}
            />
            {STATE_SHORT[row.state]}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl leading-none tabular-nums text-white">{row.score}</p>
          <p
            className={`font-mono text-[10px] tabular-nums ${
              row.delta > 0 ? "text-[#76b900]" : row.delta < 0 ? "text-[#ff3b30]" : "text-white/25"
            }`}
          >
            {row.delta > 0 ? "▲" : row.delta < 0 ? "▼" : "■"} {Math.abs(row.delta)}
          </p>
        </div>
      </div>

      {/* Instruments */}
      <div className="mt-2 grid grid-cols-[64px_1fr] gap-2">
        <Gauge value={row.speed} max={MAX_SPEED} color={color} />
        <div className="space-y-1">
          <Spark values={row.spark} color={color} />
          <div className="grid grid-cols-4 gap-1 font-mono text-[10px] tabular-nums">
            <Readout label="NRG" value={`${row.energy}%`} color={energyColor} />
            <Readout label="DIST" value={live ? `${row.distance.toFixed(1)}` : `${tests}`} sub={live ? "m" : "runs"} />
            <Readout label="COLL" value={row.collisions} warn={row.collisions > 0} />
            <Readout label="FALL" value={row.falls} warn={row.falls > 0} />
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <div className="h-full transition-[width] duration-500" style={{ width: `${row.energy}%`, background: energyColor }} />
          </div>
        </div>
      </div>

      {/* Capability bars */}
      <div className="mt-2 grid grid-cols-6 gap-1">
        {CATEGORIES.map((c) => {
          const v = Math.round(row.categories[c.key] ?? 0);
          return (
            <div key={c.key} className="flex flex-col items-center gap-0.5">
              <div className="relative h-9 w-full overflow-hidden rounded-[2px] bg-white/[0.04]">
                <div
                  className="absolute inset-x-0 bottom-0 transition-[height] duration-500 ease-out"
                  style={{ height: `${v}%`, background: `linear-gradient(0deg, ${color}40, ${color})` }}
                />
              </div>
              <span className="text-[8px] tracking-wider text-white/40">{c.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Gauge({ value, max, color }: { value: number; max: number; color: string }) {
  const f = Math.min(1, value / max);
  const arc = Math.PI * 40;
  return (
    <div className="relative h-[46px] w-16">
      <svg viewBox="0 0 100 58" className="h-full w-full">
        <path d="M10 52 A40 40 0 0 1 90 52" fill="none" stroke="#222" strokeWidth="9" strokeLinecap="round" />
        <path
          d="M10 52 A40 40 0 0 1 90 52"
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${f * arc} ${arc}`}
          style={{ transition: "stroke-dasharray 0.3s ease-out" }}
        />
        <line
          x1="50"
          y1="52"
          x2={50 - Math.cos(f * Math.PI) * 30}
          y2={52 - Math.sin(f * Math.PI) * 30}
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ transition: "all 0.3s ease-out" }}
        />
      </svg>
      <p className="absolute inset-x-0 bottom-[-4px] text-center font-mono text-[10px] tabular-nums text-white/80">
        {value.toFixed(1)}
        <span className="text-white/35"> m/s</span>
      </p>
    </div>
  );
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const w = 100;
  const h = 18;
  if (values.length < 2) return <div className="h-[18px] rounded-[2px] bg-white/[0.03]" />;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - Math.min(1, v / MAX_SPEED) * (h - 2) - 1}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[18px] w-full rounded-[2px] bg-white/[0.03]">
      <polyline points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill={`${color}22`} stroke="none" />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Readout({
  label,
  value,
  sub,
  color,
  warn,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-[2px] bg-black/40 px-1 py-0.5 text-center">
      <p className="leading-tight" style={{ color: warn ? "#ff5a4f" : color ?? "#e5e5e5" }}>
        {value}
        {sub && <span className="text-[8px] text-white/35">{sub}</span>}
      </p>
      <p className="text-[8px] tracking-wider text-white/35">{label}</p>
    </div>
  );
}

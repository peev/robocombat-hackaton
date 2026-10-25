"use client";

import { useEffect, useState } from "react";
import { getRobot, type RobotId } from "@/lib/robots/profiles";

interface RankingEntry {
  robotId: RobotId;
  mission: string;
  score: number;
  tests: number;
  categoryScores: Record<string, number>;
  simulated: true;
}

export function Leaderboard({ refreshKey }: { refreshKey: number }) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [mission, setMission] = useState<string>("fire-rescue");

  useEffect(() => {
    fetch("/api/rankings")
      .then((r) => r.json())
      .then((d) => setRankings(d.rankings ?? []))
      .catch(() => undefined);
  }, [refreshKey]);

  const filtered = rankings
    .filter((r) => r.mission === mission)
    .sort((a, b) => b.score - a.score);

  const categories = [
    "navigation",
    "stability",
    "manipulation",
    "perception",
    "energy",
    "completion",
  ];

  return (
    <section className="panel">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="panel-title">ROBOCOMBAT RANKINGS</h2>
        <div className="flex gap-1">
          {(["fire-rescue", "deep-mine"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMission(m)}
              className={`rounded px-2 py-0.5 text-[10px] uppercase ${
                mission === m
                  ? "bg-[#e10600] text-white"
                  : "bg-white/10 text-white/60"
              }`}
            >
              {m === "fire-rescue" ? "Fire" : "Mine"}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-2 text-[10px] text-amber-500/80">
        SIMULATED RANKINGS — NOT VERIFIED HARDWARE PERFORMANCE
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase text-white/40">
            <tr>
              <th className="pb-1">#</th>
              <th className="pb-1">Robot</th>
              <th className="pb-1">Score</th>
              <th className="pb-1">Tests</th>
              {categories.map((c) => (
                <th key={c} className="pb-1 capitalize">
                  {c.slice(0, 4)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={`${r.robotId}-${r.mission}`} className="border-t border-white/5">
                <td className="py-1.5 text-[#e10600]">{i + 1}</td>
                <td className="py-1.5 font-medium">
                  {getRobot(r.robotId).displayName}
                </td>
                <td className="py-1.5 font-mono">{r.score}</td>
                <td className="py-1.5 text-white/50">{r.tests}</td>
                {categories.map((c) => (
                  <td key={c} className="py-1.5 font-mono text-white/70">
                    {r.categoryScores[c] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="py-3 text-white/40">
                  No rankings yet — run Compare or AI Evaluation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

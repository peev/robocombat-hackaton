"use client";

import { useCallback, useEffect, useState } from "react";
import { GameCanvas, useFreePlayRobots } from "@/components/game/GameCanvas";
import type { CameraMode } from "@/components/game/GameCamera";
import { GpuPanel } from "@/components/dashboard/GpuPanel";
import { TelemetryPanel } from "@/components/dashboard/TelemetryPanel";
import { AiPanel } from "@/components/dashboard/AiPanel";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import type { ExperimentResult, MissionId, RobotTelemetry } from "@/lib/simulation/types";
import type { RobotId } from "@/lib/robots/profiles";
import { ROBOT_IDS, getRobot, DISCLAIMER } from "@/lib/robots/profiles";

type PlayMode = "free-play" | "autonomous" | "compare" | "ai-evaluation" | "demo";

export function AppShell() {
  const [mission, setMission] = useState<MissionId>("fire-rescue");
  const [selectedRobot, setSelectedRobot] = useState<RobotId>("unitree-g1");
  const [playMode, setPlayMode] = useState<PlayMode>("free-play");
  const [cameraMode, setCameraMode] = useState<CameraMode>("third");
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [replayTime, setReplayTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [cinematicPhase, setCinematicPhase] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [aiStatus, setAiStatus] = useState("Probing local inference…");
  const [aiMode, setAiMode] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [batchInfo, setBatchInfo] = useState<string>("");
  const [quality, setQuality] = useState<"high" | "low">("high");

  const freeRobots = useFreePlayRobots(
    mission,
    selectedRobot,
    playMode === "free-play" && !paused
  );

  useEffect(() => {
    fetch("/api/evaluate")
      .then((r) => r.json())
      .then((d) => {
        if (d.inference?.available) {
          setAiStatus(
            `Local LLM ready (${d.inference.provider}/${d.inference.model})`
          );
        } else {
          setAiStatus(
            "Local LLM unavailable — heuristic evaluator will be used (no fake AI text)"
          );
        }
      })
      .catch(() => setAiStatus("Inference probe failed"));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPaused((p) => !p);
      if (e.key === "c" || e.key === "C") {
        setCameraMode((m) => {
          const order: CameraMode[] = ["third", "spectator", "robot", "cinematic"];
          return order[(order.indexOf(m) + 1) % order.length];
        });
      }
      if (e.key === "1") setSelectedRobot("unitree-g1");
      if (e.key === "2") setSelectedRobot("bd-atlas");
      if (e.key === "3") setSelectedRobot("agibot-a2");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!playing || !result || paused) return;
    const id = setInterval(() => {
      setReplayTime((t) => {
        const next = t + 0.2;
        if (next >= result.durationSec) {
          setPlaying(false);
          return result.durationSec;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(id);
  }, [playing, result, paused]);

  const liveRobots: RobotTelemetry[] =
    result?.final.robots ??
    [];

  const objectives =
    result?.final.robots.find((r) => r.robotId === selectedRobot)
      ?.objectivesCompleted ?? [];

  const runExperiment = useCallback(
    async (mode: PlayMode, opts?: { batchSize?: number }) => {
      setBusy(true);
      setPlayMode(mode);
      setShowIntro(false);
      try {
        if (mode === "ai-evaluation" || mode === "demo") {
          setCameraMode("cinematic");
          setCinematicPhase(0);
          const cine = setInterval(
            () => setCinematicPhase((p) => Math.min(1, p + 0.02)),
            50
          );
          setTimeout(() => {
            clearInterval(cine);
            setCameraMode("third");
          }, 2800);

          if (mode === "demo") {
            setAiStatus("Running full RoboCombat demo…");
            const res = await fetch("/api/demo", { method: "POST" });
            const data = await res.json();
            setResult(data.fire.initialResult);
            setAnalyses(data.fire.analyses ?? []);
            setSummary(data.fire.finalSummary ?? "");
            setAiMode(data.fire.mode);
            setReplayTime(0);
            setPlaying(true);
            setMission("fire-rescue");
            setRefreshKey((k) => k + 1);
            // After fire, briefly show mine
            setTimeout(() => {
              setMission("deep-mine");
              setResult(data.mine.initialResult);
              setAnalyses((a) => [...a, ...(data.mine.analyses ?? [])]);
              setSummary(data.mine.finalSummary ?? "");
              setReplayTime(0);
              setPlaying(true);
              setRefreshKey((k) => k + 1);
            }, Math.min(12000, (data.fire.initialResult.durationSec + 2) * 1000));
          } else {
            setAiStatus("AI evaluation running…");
            const res = await fetch("/api/evaluate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mission,
                robotIds: ROBOT_IDS,
                maxFollowUps: 2,
              }),
            });
            const data = await res.json();
            const report = data.report;
            setResult(report.initialResult);
            setAnalyses(report.analyses ?? []);
            setSummary(report.finalSummary ?? "");
            setAiMode(report.mode);
            setAiStatus(
              report.inference.realInference
                ? `Local LLM (${report.inference.provider})`
                : "Heuristic fallback (no local LLM)"
            );
            setReplayTime(0);
            setPlaying(true);
            setRefreshKey((k) => k + 1);

            if (report.followUps?.[0]) {
              setTimeout(() => {
                setResult(report.followUps[0].result);
                setReplayTime(0);
                setPlaying(true);
                setRefreshKey((k) => k + 1);
              }, Math.min(8000, report.initialResult.durationSec * 400));
            }
          }
        } else {
          const body: Record<string, unknown> = {
            mission,
            robotIds:
              mode === "compare" ? ROBOT_IDS : [selectedRobot],
            mode,
            conditions: { seed: 42 },
          };
          if (opts?.batchSize) body.batchSize = opts.batchSize;

          setCameraMode("cinematic");
          setCinematicPhase(0);
          const cine = setInterval(
            () => setCinematicPhase((p) => Math.min(1, p + 0.025)),
            40
          );
          setTimeout(() => {
            clearInterval(cine);
            setCameraMode("third");
          }, 2200);

          const res = await fetch("/api/experiments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (data.batch) {
            setBatchInfo(
              `Batch ${data.completed}/${data.total} · ${data.experimentsPerSecond.toFixed(2)} exp/s · ${data.elapsedSec.toFixed(2)}s`
            );
            setRefreshKey((k) => k + 1);
          } else {
            setResult(data.experiment);
            setReplayTime(0);
            setPlaying(true);
            setRefreshKey((k) => k + 1);
            setAnalyses([]);
            setSummary("");
          }
        }
      } catch (e) {
        setAiStatus(`Error: ${e instanceof Error ? e.message : "failed"}`);
      } finally {
        setBusy(false);
      }
    },
    [mission, selectedRobot]
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a0a] text-white">
      {/* TOP BAR */}
      <header className="z-20 flex shrink-0 items-center gap-4 border-b border-white/10 bg-gradient-to-r from-black via-[#141414] to-black px-4 py-2">
        <div className="flex flex-col leading-none">
          <span className="font-display text-xl tracking-[0.15em] text-white">
            ROBOCOMBAT
          </span>
          <span className="text-[10px] tracking-[0.35em] text-[#e10600]">
            BLACKBOX
          </span>
        </div>
        <span className="hidden text-[11px] text-white/40 md:inline">
          THE ULTIMATE TEST OF PHYSICAL AI.
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            label="Mission"
            value={mission}
            onChange={(v) => setMission(v as MissionId)}
            options={[
              { value: "fire-rescue", label: "Fire Rescue" },
              { value: "deep-mine", label: "Deep Mine" },
            ]}
          />
          <Select
            label="Robot"
            value={selectedRobot}
            onChange={(v) => setSelectedRobot(v as RobotId)}
            options={ROBOT_IDS.map((id) => ({
              value: id,
              label: getRobot(id).shortName,
            }))}
          />
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => {
              setPlayMode("free-play");
              setResult(null);
              setPlaying(false);
            }}
          >
            Free Play
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => runExperiment("autonomous")}
          >
            Autonomous
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => runExperiment("compare")}
          >
            Compare
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => runExperiment("ai-evaluation")}
          >
            AI Eval
          </button>
          <button
            type="button"
            className="btn-demo"
            disabled={busy}
            onClick={() => runExperiment("demo")}
          >
            START ROBOCOMBAT DEMO
          </button>
        </div>
      </header>

      {/* MAIN */}
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {showIntro && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-b from-black/80 via-transparent to-black/60">
              <h1 className="font-display text-5xl tracking-[0.2em] text-white md:text-7xl">
                ROBOCOMBAT
              </h1>
              <p className="mt-2 text-sm tracking-[0.45em] text-[#e10600] md:text-base">
                BLACKBOX
              </p>
              <p className="mt-4 max-w-md text-center text-sm text-white/70">
                THE ULTIMATE TEST OF PHYSICAL AI.
              </p>
            </div>
          )}
          {paused && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
              <p className="font-display text-3xl tracking-widest">PAUSED</p>
            </div>
          )}
          <GameCanvas
            mission={mission}
            mode={
              playMode === "free-play" && !result
                ? "free-play"
                : cameraMode === "cinematic"
                  ? "cinematic"
                  : "replay"
            }
            selectedRobot={selectedRobot}
            cameraMode={cameraMode}
            result={result}
            replayTime={replayTime}
            freeRobots={freeRobots}
            cinematicPhase={cinematicPhase}
            smokeDensity={result?.config.conditions.smokeDensity ?? 0.35}
            lighting={result?.config.conditions.lighting ?? 0.7}
            quality={quality}
          />
          {result && (
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs">
              <button
                type="button"
                className="text-white/80"
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <input
                type="range"
                min={0}
                max={result.durationSec}
                step={0.1}
                value={replayTime}
                onChange={(e) => {
                  setPlaying(false);
                  setReplayTime(Number(e.target.value));
                }}
                className="w-40 accent-[#e10600]"
              />
              <span className="font-mono text-white/60">
                {replayTime.toFixed(1)}s / {result.durationSec.toFixed(1)}s
              </span>
            </div>
          )}
        </div>

        {/* RIGHT RAIL */}
        <aside className="flex w-[340px] shrink-0 flex-col gap-2 overflow-y-auto border-l border-white/10 bg-[#0d0d0d] p-2">
          <TelemetryPanel robots={liveRobots} missionProgress={objectives} />
          <AiPanel
            status={aiStatus}
            analyses={analyses}
            summary={summary}
            mode={aiMode}
          />
          <GpuPanel />
          <div className="panel space-y-2">
            <h2 className="panel-title">PARALLEL EVALUATION</h2>
            <div className="flex gap-1">
              {[4, 16, 32].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="btn flex-1 text-[10px]"
                  disabled={busy}
                  onClick={() => runExperiment("compare", { batchSize: n })}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn w-full bg-[#76b900]/20 text-[#76b900]"
              disabled={busy}
              onClick={() => runExperiment("compare", { batchSize: 4 })}
            >
              RUN PARALLEL EVALUATION
            </button>
            {batchInfo && (
              <p className="font-mono text-[10px] text-white/60">{batchInfo}</p>
            )}
            <button
              type="button"
              className="btn w-full"
              onClick={() =>
                setQuality((q) => (q === "high" ? "low" : "high"))
              }
            >
              Graphics: {quality}
            </button>
          </div>
        </aside>
      </div>

      {/* BOTTOM */}
      <footer className="shrink-0 border-t border-white/10 bg-[#0d0d0d] p-2">
        <Leaderboard refreshKey={refreshKey} />
        <p className="mt-1 text-center text-[10px] text-white/30">{DISCLAIMER}</p>
        <p className="text-center text-[10px] text-white/25">
          WASD move · Mouse look · Wheel zoom · Shift run · C camera · 1/2/3 robot · Esc pause
        </p>
      </footer>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-white/50">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-white/15 bg-black px-2 py-1 text-xs text-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameCanvas, useFreePlayRobots, type CanvasMode } from "@/components/game/GameCanvas";
import type { CameraMode } from "@/components/game/GameCamera";
import type { DirectorFocus } from "@/components/game/DirectorCamera";
import { GpuPanel } from "@/components/dashboard/GpuPanel";
import { TelemetryPanel } from "@/components/dashboard/TelemetryPanel";
import { AiPanel } from "@/components/dashboard/AiPanel";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import type { ExperimentResult, MissionId, RobotTelemetry } from "@/lib/simulation/types";
import type { RobotId } from "@/lib/robots/profiles";
import { ROBOT_IDS, getRobot, DISCLAIMER } from "@/lib/robots/profiles";

type PlayMode = "free-play" | "autonomous" | "compare" | "ai-evaluation" | "demo";

/** Simulated seconds per real second during playback. */
const PLAYBACK_RATE: Record<MissionId, number> = { "fire-rescue": 2, "deep-mine": 3 };
const DEMO_FIRE = { seed: 42, smokeDensity: 0.4 };
const DEMO_MINE = { seed: 100, incline: 0.25 };

interface DemoState {
  phase: "fire" | "mine" | "done";
  fire: ExperimentResult | null;
  mine: ExperimentResult | null;
  aiReady: boolean;
}

const MISSION_CARD: Record<MissionId, { title: string; subtitle: string }> = {
  "fire-rescue": { title: "FIRE RESCUE", subtitle: "Container ship · engine-room fire at sea" },
  "deep-mine": { title: "DEEP MINE", subtitle: "Underground ore recovery · 40 m below surface" },
};

async function fetchExperiment(mission: MissionId, conditions: Record<string, number>) {
  const res = await fetch("/api/experiments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mission, robotIds: ROBOT_IDS, mode: "demo", conditions }),
  });
  const data = await res.json();
  return data.experiment as ExperimentResult;
}

/** requestAnimationFrame playback clock: precise time in a ref, coarse time in state for the UI. */
function useReplayClock(
  result: ExperimentResult | null,
  playing: boolean,
  paused: boolean,
  rate: number,
  onEnd: () => void
) {
  const clock = useRef(0);
  const [time, setTime] = useState(0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    if (!result || !playing || paused) return;
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      clock.current = Math.min(result.durationSec, clock.current + dt * rate);
      const ended = clock.current >= result.durationSec;
      if (now - lastUi > 100 || ended) {
        lastUi = now;
        setTime(clock.current);
      }
      if (ended) {
        endRef.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result, playing, paused, rate]);

  const seek = useCallback((t: number) => {
    clock.current = t;
    setTime(t);
  }, []);
  return { clock, time, seek };
}

export function AppShell() {
  const [mission, setMission] = useState<MissionId>("fire-rescue");
  const [selectedRobot, setSelectedRobot] = useState<RobotId>("unitree-g1");
  const [playMode, setPlayMode] = useState<PlayMode>("free-play");
  const [cameraMode, setCameraMode] = useState<CameraMode>("third");
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExperimentResult | null>(null);
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
  const [demo, setDemo] = useState<DemoState | null>(null);
  const [focus, setFocus] = useState<DirectorFocus | null>(null);
  const [cardVisible, setCardVisible] = useState(false);
  const demoRun = useRef(0);

  const demoActive = demo !== null;
  const rate = PLAYBACK_RATE[mission];
  const { clock, time: replayTime, seek } = useReplayClock(result, playing, paused && !demoActive, rate, () =>
    setPlaying(false)
  );

  const freeRobots = useFreePlayRobots(mission, selectedRobot, playMode === "free-play" && !paused);

  const startReplay = useCallback(
    (r: ExperimentResult) => {
      setResult(r);
      seek(0);
      setPlaying(true);
      setRefreshKey((k) => k + 1);
    },
    [seek]
  );

  useEffect(() => {
    fetch("/api/evaluate")
      .then((r) => r.json())
      .then((d) => {
        if (d.inference?.available) {
          setAiStatus(`Local LLM ready (${d.inference.provider}/${d.inference.model})`);
        } else {
          setAiStatus("Local LLM unavailable — heuristic evaluator will be used (no fake AI text)");
        }
      })
      .catch(() => setAiStatus("Inference probe failed"));
  }, []);

  const exitDemo = useCallback(() => {
    demoRun.current += 1;
    setDemo(null);
    setFocus(null);
    setPlayMode("free-play");
    setResult(null);
    setPlaying(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (demoActive) {
        if (e.key === "Escape") exitDemo();
        return;
      }
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
  }, [demoActive, exitDemo]);

  /* ------------------------------------------------------------- demo */

  const showCard = useCallback(() => {
    setCardVisible(true);
    window.setTimeout(() => setCardVisible(false), 4500);
  }, []);

  const startDemo = useCallback(async () => {
    const run = ++demoRun.current;
    setShowIntro(false);
    setPaused(false);
    setPlayMode("demo");
    setMission("fire-rescue");
    setAnalyses([]);
    setSummary("");
    setAiMode(null);
    setDemo({ phase: "fire", fire: null, mine: null, aiReady: false });
    showCard();
    setAiStatus("Local AI analysing Fire Rescue telemetry…");

    // AI evaluation of both missions runs on the GB10 while the replay plays.
    fetch("/api/demo", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (run !== demoRun.current) return;
        setAnalyses([...(data.fire?.analyses ?? []), ...(data.mine?.analyses ?? [])]);
        setSummary([data.fire?.finalSummary, data.mine?.finalSummary].filter(Boolean).join(" "));
        setAiMode(data.fire?.mode ?? null);
        const inf = data.fire?.inference;
        setAiStatus(
          inf?.realInference ? `Local LLM (${inf.provider}/${inf.model})` : "Heuristic fallback (no local LLM)"
        );
        setDemo((d) =>
          d ? { ...d, aiReady: true, mine: d.mine ?? (data.mine?.initialResult as ExperimentResult) ?? null } : d
        );
        setRefreshKey((k) => k + 1);
      })
      .catch(() => {
        if (run === demoRun.current) setAiStatus("AI evaluation failed");
      });

    const fire = await fetchExperiment("fire-rescue", DEMO_FIRE);
    if (run !== demoRun.current) return;
    setDemo((d) => (d ? { ...d, fire } : d));
    startReplay(fire);
  }, [showCard, startReplay]);

  // Advance demo phases when a replay finishes.
  useEffect(() => {
    if (!demo || playing || !result || replayTime < result.durationSec) return;
    const run = demoRun.current;
    if (demo.phase === "fire") {
      const id = window.setTimeout(async () => {
        const mine = demo.mine ?? (await fetchExperiment("deep-mine", DEMO_MINE));
        if (run !== demoRun.current) return;
        setMission("deep-mine");
        setDemo((d) => (d ? { ...d, phase: "mine", mine } : d));
        showCard();
        startReplay(mine);
      }, 2500);
      return () => clearTimeout(id);
    }
    if (demo.phase === "mine") {
      const id = window.setTimeout(() => {
        if (run === demoRun.current) setDemo((d) => (d ? { ...d, phase: "done" } : d));
      }, 2000);
      return () => clearTimeout(id);
    }
  }, [demo, playing, result, replayTime, showCard, startReplay]);

  /* --------------------------------------------------- other run modes */

  const runExperiment = useCallback(
    async (mode: PlayMode, opts?: { batchSize?: number }) => {
      setBusy(true);
      setPlayMode(mode);
      setShowIntro(false);
      try {
        setCameraMode("cinematic");
        setCinematicPhase(0);
        const cine = setInterval(() => setCinematicPhase((p) => Math.min(1, p + 0.02)), 50);
        setTimeout(() => {
          clearInterval(cine);
          setCameraMode("third");
        }, 2800);

        if (mode === "ai-evaluation") {
          setAiStatus("AI evaluation running…");
          const res = await fetch("/api/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mission, robotIds: ROBOT_IDS, maxFollowUps: 2 }),
          });
          const data = await res.json();
          const report = data.report;
          setAnalyses(report.analyses ?? []);
          setSummary(report.finalSummary ?? "");
          setAiMode(report.mode);
          setAiStatus(
            report.inference.realInference
              ? `Local LLM (${report.inference.provider})`
              : "Heuristic fallback (no local LLM)"
          );
          startReplay(report.initialResult);
          if (report.followUps?.[0]) {
            setTimeout(
              () => startReplay(report.followUps[0].result),
              (report.initialResult.durationSec / PLAYBACK_RATE[mission]) * 1000 + 1500
            );
          }
        } else {
          const body: Record<string, unknown> = {
            mission,
            robotIds: mode === "compare" ? ROBOT_IDS : [selectedRobot],
            mode,
            conditions: { seed: 42 },
          };
          if (opts?.batchSize) body.batchSize = opts.batchSize;
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
            startReplay(data.experiment);
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
    [mission, selectedRobot, startReplay]
  );

  const liveRobots: RobotTelemetry[] = result?.final.robots ?? [];
  const objectives = result?.final.robots.find((r) => r.robotId === selectedRobot)?.objectivesCompleted ?? [];

  const canvasMode: CanvasMode = demoActive
    ? "director"
    : playMode === "free-play" && !result
      ? "free-play"
      : cameraMode === "cinematic"
        ? "cinematic"
        : "replay";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a0a] text-white">
      <header className="z-20 flex shrink-0 items-center gap-4 border-b border-white/10 bg-gradient-to-r from-black via-[#141414] to-black px-4 py-2">
        <div className="flex flex-col leading-none">
          <span className="font-display text-xl tracking-[0.15em] text-white">ROBOCOMBAT</span>
          <span className="text-[10px] tracking-[0.35em] text-[#e10600]">BLACKBOX</span>
        </div>
        <span className="hidden text-[11px] text-white/40 md:inline">THE ULTIMATE TEST OF PHYSICAL AI.</span>

        {demoActive ? (
          <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/70">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#e10600]" />
              Autonomous demo · robots operating on their own
            </span>
            <button type="button" className="btn" onClick={exitDemo}>
              Exit demo
            </button>
          </div>
        ) : (
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
              options={ROBOT_IDS.map((id) => ({ value: id, label: getRobot(id).shortName }))}
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
            <button type="button" className="btn" disabled={busy} onClick={() => runExperiment("autonomous")}>
              Autonomous
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => runExperiment("compare")}>
              Compare
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => runExperiment("ai-evaluation")}>
              AI Eval
            </button>
            <button type="button" className="btn-demo" disabled={busy} onClick={startDemo}>
              START ROBOCOMBAT DEMO
            </button>
          </div>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {showIntro && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-b from-black/80 via-transparent to-black/60">
              <h1 className="font-display text-5xl tracking-[0.2em] text-white md:text-7xl">ROBOCOMBAT</h1>
              <p className="mt-2 text-sm tracking-[0.45em] text-[#e10600] md:text-base">BLACKBOX</p>
              <p className="mt-4 max-w-md text-center text-sm text-white/70">THE ULTIMATE TEST OF PHYSICAL AI.</p>
            </div>
          )}
          {paused && !demoActive && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
              <p className="font-display text-3xl tracking-widest">PAUSED</p>
            </div>
          )}

          <div className={demoActive ? "pointer-events-none h-full w-full" : "h-full w-full"}>
            <GameCanvas
              mission={mission}
              mode={canvasMode}
              selectedRobot={selectedRobot}
              cameraMode={cameraMode}
              result={result}
              replayTime={replayTime}
              replayClock={clock}
              freeRobots={freeRobots}
              cinematicPhase={cinematicPhase}
              quality={quality}
              onDirectorFocus={setFocus}
              focusRobot={focus?.robotId ?? null}
            />
          </div>

          {demoActive && (
            <DemoHud
              mission={mission}
              demo={demo}
              focus={focus}
              cardVisible={cardVisible}
              time={replayTime}
              duration={result?.durationSec ?? 0}
              rate={rate}
              aiStatus={aiStatus}
              onExit={exitDemo}
              onReplay={startDemo}
            />
          )}

          {result && !demoActive && (
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs">
              <button type="button" className="text-white/80" onClick={() => setPlaying((p) => !p)}>
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
                  seek(Number(e.target.value));
                }}
                className="w-40 accent-[#e10600]"
              />
              <span className="font-mono text-white/60">
                {replayTime.toFixed(1)}s / {result.durationSec.toFixed(1)}s
              </span>
            </div>
          )}
        </div>

        <aside className="flex w-[340px] shrink-0 flex-col gap-2 overflow-y-auto border-l border-white/10 bg-[#0d0d0d] p-2">
          <TelemetryPanel robots={liveRobots} missionProgress={objectives} />
          <AiPanel status={aiStatus} analyses={analyses} summary={summary} mode={aiMode} />
          <GpuPanel />
          {!demoActive && (
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
              {batchInfo && <p className="font-mono text-[10px] text-white/60">{batchInfo}</p>}
              <button type="button" className="btn w-full" onClick={() => setQuality((q) => (q === "high" ? "low" : "high"))}>
                Graphics: {quality}
              </button>
            </div>
          )}
        </aside>
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-[#0d0d0d] p-2">
        <Leaderboard refreshKey={refreshKey} />
        <p className="mt-1 text-center text-[10px] text-white/30">{DISCLAIMER}</p>
        {!demoActive && (
          <p className="text-center text-[10px] text-white/25">
            WASD move · Mouse look · Wheel zoom · Shift run · C camera · 1/2/3 robot · Esc pause
          </p>
        )}
      </footer>
    </div>
  );
}

const SHOT_NAMES: Record<DirectorFocus["shot"], string> = {
  establish: "Wide",
  chase: "Chase cam",
  front: "Front tracking",
  side: "Side tracking",
  low: "Low angle",
  orbit: "Orbit",
  objective: "Objective cam",
};

function DemoHud({
  mission,
  demo,
  focus,
  cardVisible,
  time,
  duration,
  rate,
  aiStatus,
  onExit,
  onReplay,
}: {
  mission: MissionId;
  demo: DemoState;
  focus: DirectorFocus | null;
  cardVisible: boolean;
  time: number;
  duration: number;
  rate: number;
  aiStatus: string;
  onExit: () => void;
  onReplay: () => void;
}) {
  const card = MISSION_CARD[mission];
  const robot = focus ? getRobot(focus.robotId) : null;
  const progress = duration > 0 ? Math.min(1, time / duration) : 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Mission title card */}
      <div
        className={`absolute left-8 top-8 transition-all duration-1000 ${
          cardVisible ? "translate-x-0 opacity-100" : "-translate-x-6 opacity-0"
        }`}
      >
        <p className="text-[11px] uppercase tracking-[0.5em] text-[#e10600]">
          Mission {demo.phase === "fire" ? "01" : "02"}
        </p>
        <h2 className="font-display text-6xl tracking-[0.12em] text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)]">
          {card.title}
        </h2>
        <p className="mt-1 text-sm text-white/80 drop-shadow">{card.subtitle}</p>
      </div>

      {/* Top-right status */}
      <div className="absolute right-4 top-4 flex flex-col items-end gap-1.5">
        <span className="rounded-sm bg-black/60 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-white/80">
          {card.title} · {rate}× speed
        </span>
        <span className="max-w-[320px] truncate rounded-sm bg-black/60 px-2 py-1 text-[10px] uppercase tracking-wider text-[#76b900]">
          {demo.aiReady ? "● " : "◌ "}
          {aiStatus}
        </span>
      </div>

      {/* Lower third: who the camera is following */}
      {robot && demo.phase !== "done" && (
        <div className="absolute bottom-10 left-8">
          <div className="border-l-4 border-[#e10600] bg-gradient-to-r from-black/80 to-transparent py-2 pl-3 pr-16">
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/50">
              {SHOT_NAMES[focus!.shot]} · {robot.publicSpecs.manufacturer}
            </p>
            <p className="font-display text-3xl tracking-[0.08em] text-white">{robot.displayName}</p>
          </div>
        </div>
      )}

      {/* Progress */}
      {demo.phase !== "done" && (
        <div className="absolute bottom-4 left-8 right-8 h-[3px] bg-white/10">
          <div className="h-full bg-[#e10600]" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {demo.phase === "done" && (
        <DemoResults demo={demo} aiStatus={aiStatus} onExit={onExit} onReplay={onReplay} />
      )}
    </div>
  );
}

function DemoResults({
  demo,
  aiStatus,
  onExit,
  onReplay,
}: {
  demo: DemoState;
  aiStatus: string;
  onExit: () => void;
  onReplay: () => void;
}) {
  const sections: { label: string; result: ExperimentResult | null }[] = [
    { label: "Fire Rescue", result: demo.fire },
    { label: "Deep Mine", result: demo.mine },
  ];
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[560px] border border-white/10 bg-[#0d0d0d]/95 p-6">
        <p className="text-[11px] uppercase tracking-[0.45em] text-[#e10600]">Demo complete</p>
        <h2 className="font-display text-4xl tracking-[0.1em]">RESULTS</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {sections.map((s) => (
            <div key={s.label}>
              <p className="mb-2 text-[11px] uppercase tracking-[0.25em] text-white/50">{s.label}</p>
              {s.result?.rankings.map((r) => (
                <div key={r.robotId} className="flex items-baseline justify-between border-b border-white/5 py-1.5">
                  <span className="text-sm">
                    <span className="mr-2 font-mono text-white/40">#{r.rank}</span>
                    {getRobot(r.robotId).displayName}
                  </span>
                  <span className="font-mono text-sm text-[#76b900]">{r.score.toFixed(0)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-white/50">{aiStatus}</p>
        <p className="mt-1 text-[10px] text-white/30">{DISCLAIMER}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" className="btn-demo" onClick={onReplay}>
            Replay demo
          </button>
          <button type="button" className="btn" onClick={onExit}>
            Exit demo
          </button>
        </div>
      </div>
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

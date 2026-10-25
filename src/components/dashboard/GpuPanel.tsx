"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
  XAxis,
  Tooltip,
} from "recharts";

interface Metrics {
  gpuAvailable: boolean;
  gpuName: string | null;
  gpuUtilization: number | null;
  gpuPowerW: number | null;
  gpuTempC: number | null;
  gpuClockMhz: number | null;
  unifiedMemoryUsedGb: number | null;
  unifiedMemoryTotalGb: number | null;
  cpuUtilization: number | null;
  inferenceLatencyMs: number | null;
  tokensPerSecond: number | null;
  completedEvaluations: number;
  activeAiRequests: number;
  notes: string[];
}

function fmt(v: number | null | undefined, suffix = ""): string {
  if (v == null || Number.isNaN(v)) return "N/A";
  return `${v}${suffix}`;
}

export function GpuPanel() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<{ t: string; util: number }[]>([]);
  const [timeline, setTimeline] = useState<{ t: number; label: string }[]>([]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/hardware");
        const data = await res.json();
        if (!alive) return;
        setMetrics(data.metrics);
        setTimeline(data.timeline ?? []);
        const util = data.metrics.gpuUtilization;
        setHistory((h) =>
          [
            ...h,
            {
              t: new Date().toLocaleTimeString(),
              util: util == null ? 0 : util,
            },
          ].slice(-40)
        );
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const util = metrics?.gpuUtilization;

  return (
    <section className="panel flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="panel-title text-[#76b900]">NVIDIA GB10 LIVE COMPUTE</h2>
        <span className="text-[10px] uppercase tracking-wider text-white/40">
          {metrics?.gpuAvailable ? metrics.gpuName : "NO GPU DRIVER"}
        </span>
      </header>

      <div className="relative mx-auto h-28 w-28">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#222"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#76b900"
            strokeWidth="8"
            strokeDasharray={`${((util ?? 0) / 100) * 251.2} 251.2`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-white">
            {util == null ? "N/A" : `${Math.round(util)}%`}
          </span>
          <span className="text-[9px] text-white/50">GPU UTIL</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Metric label="Power" value={fmt(metrics?.gpuPowerW, " W")} />
        <Metric label="Temp" value={fmt(metrics?.gpuTempC, " °C")} />
        <Metric label="Clock" value={fmt(metrics?.gpuClockMhz, " MHz")} />
        <Metric label="CPU" value={fmt(metrics?.cpuUtilization, "%")} />
        <Metric
          label="Unified Mem"
          value={
            metrics?.unifiedMemoryUsedGb != null
              ? `${metrics.unifiedMemoryUsedGb}/${metrics.unifiedMemoryTotalGb} GB`
              : "N/A"
          }
        />
        <Metric
          label="Infer Latency"
          value={fmt(metrics?.inferenceLatencyMs, " ms")}
        />
        <Metric label="Tok/s" value={fmt(metrics?.tokensPerSecond)} />
        <Metric
          label="Evals / Active"
          value={`${metrics?.completedEvaluations ?? 0} / ${metrics?.activeAiRequests ?? 0}`}
        />
      </div>

      <div className="h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history}>
            <XAxis dataKey="t" hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              contentStyle={{
                background: "#111",
                border: "1px solid #333",
                fontSize: 11,
              }}
            />
            <Line
              type="monotone"
              dataKey="util"
              stroke="#76b900"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="max-h-24 overflow-y-auto border-t border-white/10 pt-2 text-[10px] text-white/60">
        {timeline
          .slice()
          .reverse()
          .slice(0, 8)
          .map((e, i) => (
            <div key={i} className="flex justify-between gap-2 py-0.5">
              <span className="text-[#76b900]">{e.label}</span>
              <span>{new Date(e.t).toLocaleTimeString()}</span>
            </div>
          ))}
        {!timeline.length && <span>No experiment events yet.</span>}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-white/5 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-white/40">
        {label}
      </div>
      <div className="font-mono text-white">{value}</div>
    </div>
  );
}

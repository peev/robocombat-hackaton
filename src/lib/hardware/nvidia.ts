import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";

const execFileAsync = promisify(execFile);

export interface HardwareMetrics {
  timestamp: number;
  gpuAvailable: boolean;
  gpuName: string | null;
  gpuUtilization: number | null;
  gpuPowerW: number | null;
  gpuTempC: number | null;
  gpuClockMhz: number | null;
  /** Unified memory on GB10 — never labeled as dedicated VRAM. */
  unifiedMemoryUsedGb: number | null;
  unifiedMemoryTotalGb: number | null;
  cpuUtilization: number | null;
  inferenceLatencyMs: number | null;
  tokensPerSecond: number | null;
  completedEvaluations: number;
  activeAiRequests: number;
  notes: string[];
}

let lastCpuIdle = 0;
let lastCpuTotal = 0;
let inferenceLatencyMs: number | null = null;
let tokensPerSecond: number | null = null;
let completedEvaluations = 0;
let activeAiRequests = 0;

export function setInferenceStats(latencyMs: number | null, tps: number | null) {
  inferenceLatencyMs = latencyMs;
  tokensPerSecond = tps;
}

export function bumpEvaluations() {
  completedEvaluations += 1;
}

export function setActiveAiRequests(n: number) {
  activeAiRequests = n;
}

function readCpuUtilization(): number | null {
  try {
    const stat = fs.readFileSync("/proc/stat", "utf8").split("\n")[0];
    const parts = stat.split(/\s+/).slice(1).map(Number);
    const idle = parts[3] + (parts[4] ?? 0);
    const total = parts.reduce((a, b) => a + b, 0);
    if (lastCpuTotal === 0) {
      lastCpuIdle = idle;
      lastCpuTotal = total;
      return null;
    }
    const idleDelta = idle - lastCpuIdle;
    const totalDelta = total - lastCpuTotal;
    lastCpuIdle = idle;
    lastCpuTotal = total;
    if (totalDelta <= 0) return null;
    return Math.round((1 - idleDelta / totalDelta) * 1000) / 10;
  } catch {
    return null;
  }
}

async function queryNvidia(): Promise<Partial<HardwareMetrics>> {
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      [
        "--query-gpu=name,utilization.gpu,power.draw,temperature.gpu,clocks.gr,memory.used,memory.total",
        "--format=csv,noheader,nounits",
      ],
      { timeout: 2000 }
    );
    const line = stdout.trim().split("\n")[0];
    if (!line) throw new Error("empty");
    const [name, util, power, temp, clock, memUsed, memTotal] = line
      .split(",")
      .map((s) => s.trim());
    return {
      gpuAvailable: true,
      gpuName: name,
      gpuUtilization: Number.isFinite(+util) ? +util : null,
      gpuPowerW: Number.isFinite(+power) ? +power : null,
      gpuTempC: Number.isFinite(+temp) ? +temp : null,
      gpuClockMhz: Number.isFinite(+clock) ? +clock : null,
      // On GB10 this is unified memory — label accordingly in UI
      unifiedMemoryUsedGb: Number.isFinite(+memUsed) ? +memUsed / 1024 : null,
      unifiedMemoryTotalGb: Number.isFinite(+memTotal) ? +memTotal / 1024 : null,
      notes: [],
    };
  } catch {
    return {
      gpuAvailable: false,
      gpuName: null,
      gpuUtilization: null,
      gpuPowerW: null,
      gpuTempC: null,
      gpuClockMhz: null,
      unifiedMemoryUsedGb: null,
      unifiedMemoryTotalGb: null,
      notes: [
        "nvidia-smi unavailable — GPU metrics shown as N/A (not fabricated).",
      ],
    };
  }
}

export async function collectHardwareMetrics(): Promise<HardwareMetrics> {
  const gpu = await queryNvidia();
  const totalMem = os.totalmem() / 1e9;
  const freeMem = os.freemem() / 1e9;
  const usedMem = totalMem - freeMem;

  // Prefer system unified memory numbers when nvidia memory query is null (GB10 style)
  const unifiedUsed =
    gpu.unifiedMemoryUsedGb != null ? gpu.unifiedMemoryUsedGb : usedMem;
  const unifiedTotal =
    gpu.unifiedMemoryTotalGb != null ? gpu.unifiedMemoryTotalGb : totalMem;

  return {
    timestamp: Date.now(),
    gpuAvailable: gpu.gpuAvailable ?? false,
    gpuName: gpu.gpuName ?? null,
    gpuUtilization: gpu.gpuUtilization ?? null,
    gpuPowerW: gpu.gpuPowerW ?? null,
    gpuTempC: gpu.gpuTempC ?? null,
    gpuClockMhz: gpu.gpuClockMhz ?? null,
    unifiedMemoryUsedGb: Math.round(unifiedUsed * 100) / 100,
    unifiedMemoryTotalGb: Math.round(unifiedTotal * 100) / 100,
    cpuUtilization: readCpuUtilization(),
    inferenceLatencyMs,
    tokensPerSecond,
    completedEvaluations,
    activeAiRequests,
    notes: [
      ...(gpu.notes ?? []),
      "Memory reported as unified system memory (GB10 architecture).",
    ],
  };
}

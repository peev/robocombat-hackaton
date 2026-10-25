import fs from "fs";
import path from "path";
import type { ExperimentResult } from "@/lib/simulation/types";
import type { RobotId } from "@/lib/robots/profiles";

const DATA_DIR = path.join(process.cwd(), "data");
const RESULTS_FILE = path.join(DATA_DIR, "experiments.json");
const RANKINGS_FILE = path.join(DATA_DIR, "rankings.json");
const EVENTS_FILE = path.join(DATA_DIR, "gpu_events.json");

export interface RankingEntry {
  robotId: RobotId;
  mission: string;
  score: number;
  tests: number;
  categoryScores: Record<string, number>;
  lastUpdated: string;
  simulated: true;
}

export interface GpuTimelineEvent {
  t: number;
  label: string;
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(RESULTS_FILE)) fs.writeFileSync(RESULTS_FILE, "[]");
  if (!fs.existsSync(RANKINGS_FILE)) fs.writeFileSync(RANKINGS_FILE, "[]");
  if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, "[]");
}

function readJson<T>(file: string, fallback: T): T {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  ensure();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function saveExperiment(result: ExperimentResult): void {
  const all = readJson<ExperimentResult[]>(RESULTS_FILE, []);
  // Strip heavy snapshots for storage — keep last + every Nth
  const compact: ExperimentResult = {
    ...result,
    snapshots:
      result.snapshots.length <= 40
        ? result.snapshots
        : result.snapshots.filter(
            (_, i) => i % Math.ceil(result.snapshots.length / 30) === 0
          ),
  };
  all.unshift(compact);
  writeJson(RESULTS_FILE, all.slice(0, 200));
  updateRankings(result);
}

export function listExperiments(limit = 50): ExperimentResult[] {
  return readJson<ExperimentResult[]>(RESULTS_FILE, []).slice(0, limit);
}

export function getExperiment(id: string): ExperimentResult | undefined {
  return readJson<ExperimentResult[]>(RESULTS_FILE, []).find(
    (e) => e.config.id === id
  );
}

function updateRankings(result: ExperimentResult): void {
  const rankings = readJson<RankingEntry[]>(RANKINGS_FILE, []);
  for (const robot of result.final.robots) {
    const key = rankings.findIndex(
      (r) => r.robotId === robot.robotId && r.mission === result.config.mission
    );
    const entry: RankingEntry = {
      robotId: robot.robotId,
      mission: result.config.mission,
      score: robot.score,
      tests: 1,
      categoryScores: robot.categoryScores,
      lastUpdated: result.completedAt,
      simulated: true,
    };
    if (key >= 0) {
      const prev = rankings[key];
      const tests = prev.tests + 1;
      entry.tests = tests;
      entry.score = Math.round((prev.score * prev.tests + robot.score) / tests);
      const cats = { ...prev.categoryScores };
      for (const [k, v] of Object.entries(robot.categoryScores)) {
        cats[k] = Math.round(((cats[k] ?? v) * prev.tests + v) / tests);
      }
      entry.categoryScores = cats;
      rankings[key] = entry;
    } else {
      rankings.push(entry);
    }
  }
  writeJson(RANKINGS_FILE, rankings);
}

export function getRankings(): RankingEntry[] {
  return readJson<RankingEntry[]>(RANKINGS_FILE, []);
}

export function pushGpuEvent(label: string): void {
  const events = readJson<GpuTimelineEvent[]>(EVENTS_FILE, []);
  events.push({ t: Date.now(), label });
  writeJson(EVENTS_FILE, events.slice(-100));
}

export function getGpuEvents(): GpuTimelineEvent[] {
  return readJson<GpuTimelineEvent[]>(EVENTS_FILE, []);
}

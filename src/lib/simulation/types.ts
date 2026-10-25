import type { RobotId } from "@/lib/robots/profiles";

export type MissionId = "fire-rescue" | "deep-mine";
export type GameMode =
  | "free-play"
  | "autonomous"
  | "compare"
  | "ai-evaluation"
  | "demo";

export type RobotState =
  | "IDLE"
  | "NAVIGATING"
  | "SEARCHING"
  | "INTERACTING"
  | "CARRYING"
  | "SUPPRESSING"
  | "RECOVERING"
  | "COMPLETED"
  | "FAILED";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ExperimentConditions {
  seed: number;
  smokeDensity: number;
  visibility: number;
  lighting: number;
  terrainDifficulty: number;
  fireSpreadRate: number;
  fireInitialIntensity: number;
  obstacleShift: number;
  depositRelocation: number;
  materialQuantity: number;
  tunnelAccessibility: number;
  incline: number;
}

export const DEFAULT_CONDITIONS: ExperimentConditions = {
  seed: 42,
  smokeDensity: 0.35,
  visibility: 0.85,
  lighting: 0.7,
  terrainDifficulty: 0.3,
  fireSpreadRate: 0.08,
  fireInitialIntensity: 1.0,
  obstacleShift: 0,
  depositRelocation: 0,
  materialQuantity: 1,
  tunnelAccessibility: 1,
  incline: 0.15,
};

export interface ExperimentConfig {
  id: string;
  mission: MissionId;
  robotIds: RobotId[];
  conditions: ExperimentConditions;
  mode: GameMode;
  parentExperimentId?: string;
  hypothesis?: string;
  createdAt: string;
}

export interface RobotTelemetry {
  robotId: RobotId;
  state: RobotState;
  position: Vec3;
  heading: number;
  velocity: number;
  energy: number;
  distanceTraveled: number;
  collisions: number;
  falls: number;
  pathEfficiency: number;
  carrying: boolean;
  carriedMassKg: number;
  objectivesCompleted: string[];
  timeToLocateFire?: number;
  timeToReachFire?: number;
  suppressionTime?: number;
  timeToIdentifyDeposit?: number;
  materialRecoveredKg?: number;
  equipmentInteractions: number;
  waterUsed: number;
  missionComplete: boolean;
  missionFailed: boolean;
  score: number;
  categoryScores: Record<string, number>;
  timeline: TelemetryEvent[];
}

export interface TelemetryEvent {
  t: number;
  type: string;
  detail: string;
}

export interface FireState {
  position: Vec3;
  intensity: number;
  spreadRate: number;
  smoke: number;
  suppressed: boolean;
}

export interface MineralDeposit {
  id: string;
  position: Vec3;
  quantityKg: number;
  identified: boolean;
  extractedKg: number;
}

export interface MissionWorldState {
  fire?: FireState;
  deposits?: MineralDeposit[];
  collectionPoint?: Vec3;
  extinguisherPos?: Vec3;
  hosePos?: Vec3;
  obstacles: { position: Vec3; radius: number }[];
}

export interface SimulationSnapshot {
  tick: number;
  time: number;
  mission: MissionId;
  robots: RobotTelemetry[];
  world: MissionWorldState;
  events: TelemetryEvent[];
  complete: boolean;
}

export interface ExperimentResult {
  config: ExperimentConfig;
  snapshots: SimulationSnapshot[];
  final: SimulationSnapshot;
  rankings: { robotId: RobotId; score: number; rank: number }[];
  durationSec: number;
  completedAt: string;
}

export const CONDITION_LIMITS: Record<
  keyof ExperimentConditions,
  { min: number; max: number }
> = {
  seed: { min: 0, max: 2_147_483_647 },
  smokeDensity: { min: 0, max: 1 },
  visibility: { min: 0.1, max: 1 },
  lighting: { min: 0.05, max: 1 },
  terrainDifficulty: { min: 0, max: 1 },
  fireSpreadRate: { min: 0, max: 0.5 },
  fireInitialIntensity: { min: 0.2, max: 1.5 },
  obstacleShift: { min: 0, max: 1 },
  depositRelocation: { min: 0, max: 1 },
  materialQuantity: { min: 0.5, max: 3 },
  tunnelAccessibility: { min: 0.3, max: 1 },
  incline: { min: 0, max: 0.6 },
};

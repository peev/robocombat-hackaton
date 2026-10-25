/**
 * ILLUSTRATIVE SIMULATION PROFILES — NOT VERIFIED HARDWARE PERFORMANCE.
 * Official manufacturer specs (publicly documented dimensions) are stored
 * separately from assumed simulation controller parameters.
 */

export type RobotId = "unitree-g1" | "bd-atlas" | "agibot-a2";

export interface PublicSpecs {
  manufacturer: string;
  model: string;
  documentedHeightM: number | null;
  documentedMassKg: number | null;
  notes: string;
  source: string;
}

/** Assumed simulation-only controller / physics parameters. */
export interface SimulationParams {
  heightM: number;
  massKg: number;
  walkSpeed: number;
  runSpeed: number;
  turnSpeed: number;
  balanceTolerance: number;
  reactionLatencyMs: number;
  obstacleAvoidance: number;
  gripSuccess: number;
  energyDrainPerSecond: number;
  recoveryCapability: number;
  colorPrimary: string;
  colorAccent: string;
}

export interface RobotProfile {
  id: RobotId;
  displayName: string;
  shortName: string;
  publicSpecs: PublicSpecs;
  simulation: SimulationParams;
  disclaimer: string;
}

export const DISCLAIMER =
  "ILLUSTRATIVE SIMULATION, NOT VERIFIED HARDWARE PERFORMANCE.";

export const ROBOT_PROFILES: Record<RobotId, RobotProfile> = {
  "unitree-g1": {
    id: "unitree-g1",
    displayName: "Unitree G1",
    shortName: "G1",
    publicSpecs: {
      manufacturer: "Unitree",
      model: "G1",
      documentedHeightM: 1.32,
      documentedMassKg: 35,
      notes: "Public marketing dimensions used for visual proportion only.",
      source: "Public manufacturer materials (illustrative)",
    },
    simulation: {
      heightM: 1.32,
      massKg: 35,
      walkSpeed: 1.35,
      runSpeed: 2.4,
      turnSpeed: 2.2,
      balanceTolerance: 0.72,
      reactionLatencyMs: 90,
      obstacleAvoidance: 0.78,
      gripSuccess: 0.82,
      energyDrainPerSecond: 0.004,
      recoveryCapability: 0.7,
      colorPrimary: "#1a1a1a",
      colorAccent: "#c0c0c0",
    },
    disclaimer: DISCLAIMER,
  },
  "bd-atlas": {
    id: "bd-atlas",
    displayName: "Boston Dynamics Atlas",
    shortName: "Atlas",
    publicSpecs: {
      manufacturer: "Boston Dynamics",
      model: "Atlas",
      documentedHeightM: 1.5,
      documentedMassKg: 89,
      notes: "Approximate public dimensions; controller is simulated.",
      source: "Public manufacturer materials (illustrative)",
    },
    simulation: {
      heightM: 1.5,
      massKg: 89,
      walkSpeed: 1.2,
      runSpeed: 2.8,
      turnSpeed: 1.9,
      balanceTolerance: 0.88,
      reactionLatencyMs: 70,
      obstacleAvoidance: 0.85,
      gripSuccess: 0.9,
      energyDrainPerSecond: 0.005,
      recoveryCapability: 0.92,
      colorPrimary: "#e8e8e8",
      colorAccent: "#2a2a2a",
    },
    disclaimer: DISCLAIMER,
  },
  "agibot-a2": {
    id: "agibot-a2",
    displayName: "AgiBot A2 Ultra",
    shortName: "A2 Ultra",
    publicSpecs: {
      manufacturer: "AgiBot",
      model: "A2 Ultra",
      documentedHeightM: 1.75,
      documentedMassKg: 55,
      notes: "Approximate public dimensions; controller is simulated.",
      source: "Public manufacturer materials (illustrative)",
    },
    simulation: {
      heightM: 1.75,
      massKg: 55,
      walkSpeed: 1.15,
      runSpeed: 2.1,
      turnSpeed: 1.7,
      balanceTolerance: 0.75,
      reactionLatencyMs: 110,
      obstacleAvoidance: 0.7,
      gripSuccess: 0.86,
      energyDrainPerSecond: 0.0045,
      recoveryCapability: 0.68,
      colorPrimary: "#0d2b4a",
      colorAccent: "#f0a500",
    },
    disclaimer: DISCLAIMER,
  },
};

export const ROBOT_IDS = Object.keys(ROBOT_PROFILES) as RobotId[];

export function getRobot(id: RobotId): RobotProfile {
  return ROBOT_PROFILES[id];
}

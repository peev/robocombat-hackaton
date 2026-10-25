import { getRobot, type RobotId } from "@/lib/robots/profiles";
import { createRng, hashSeed } from "./rng";
import { NavGrid } from "./pathfinding";
import { computeMissionScore } from "./scoring";
import {
  DEFAULT_CONDITIONS,
  type ExperimentConditions,
  type ExperimentConfig,
  type ExperimentResult,
  type FireState,
  type MineralDeposit,
  type MissionId,
  type MissionWorldState,
  type RobotState,
  type RobotTelemetry,
  type SimulationSnapshot,
  type TelemetryEvent,
  type Vec3,
} from "./types";

const DT = 1 / 30;
const MAX_SECONDS = 120;

interface Agent {
  robotId: RobotId;
  telemetry: RobotTelemetry;
  path: { x: number; z: number }[];
  pathIndex: number;
  phase: number;
  hasExtinguisher: boolean;
  suppressing: boolean;
  carryingDepositId: string | null;
  fallCooldown: number;
  interactionTimer: number;
  idealDistance: number;
  lastPos: Vec3;
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function dist2(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function makeTelemetry(robotId: RobotId, spawn: Vec3): RobotTelemetry {
  return {
    robotId,
    state: "IDLE",
    position: { ...spawn },
    heading: 0,
    velocity: 0,
    energy: 1,
    distanceTraveled: 0,
    collisions: 0,
    falls: 0,
    pathEfficiency: 1,
    carrying: false,
    carriedMassKg: 0,
    objectivesCompleted: [],
    equipmentInteractions: 0,
    waterUsed: 0,
    missionComplete: false,
    missionFailed: false,
    score: 0,
    categoryScores: {},
    timeline: [],
  };
}

function event(t: number, type: string, detail: string): TelemetryEvent {
  return { t, type, detail };
}

function buildFireWorld(
  conditions: ExperimentConditions,
  rng: () => number
): { world: MissionWorldState; grid: NavGrid; spawn: Vec3 } {
  const grid = new NavGrid(80, 50, 1, -20, -10);
  const obstacles: { position: Vec3; radius: number }[] = [];

  // Shipping containers as obstacles (north of the approach lane)
  for (let i = 0; i < 12; i++) {
    const ox =
      -6 +
      (i % 4) * 6 +
      conditions.obstacleShift * (rng() - 0.5) * 3;
    const oz =
      14 +
      Math.floor(i / 4) * 4 +
      conditions.obstacleShift * (rng() - 0.5) * 2;
    obstacles.push({ position: { x: ox, y: 1.3, z: oz }, radius: 1.2 });
    grid.blockCircle(ox, oz, 1.3);
  }

  // Corridor walls (leave a path)
  for (let z = -8; z < 20; z++) {
    if (z > 8 && z < 14) continue;
    grid.setBlocked(grid.worldToCell(-18, z).x, grid.worldToCell(-18, z).z, true);
    grid.setBlocked(grid.worldToCell(55, z).x, grid.worldToCell(55, z).z, true);
  }

  const firePos: Vec3 = {
    x: 28 + conditions.obstacleShift * 3,
    y: 0.5,
    z: 12,
  };
  const extinguisherPos: Vec3 = { x: 8, y: 0.5, z: 4 };
  const hosePos: Vec3 = { x: 18, y: 0.5, z: 10 };
  const spawn: Vec3 = { x: -5, y: 0, z: -2 };

  // Keep spawn, equipment, fire, and approach corridors clear
  const clear = (p: Vec3, r = 2) => {
    const c = grid.worldToCell(p.x, p.z);
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++)
        grid.setBlocked(c.x + dx, c.z + dz, false);
  };
  clear(spawn, 3);
  clear(firePos, 3);
  clear(extinguisherPos, 2);
  clear(hosePos, 2);
  // Lane along deck toward engine room
  for (let x = -5; x <= 30; x++) {
    clear({ x, y: 0, z: -1 }, 1);
    clear({ x, y: 0, z: 4 }, 1);
    clear({ x, y: 0, z: 10 }, 1);
  }

  const fire: FireState = {
    position: firePos,
    intensity: conditions.fireInitialIntensity,
    spreadRate: conditions.fireSpreadRate,
    smoke: conditions.smokeDensity,
    suppressed: false,
  };

  return {
    world: { fire, extinguisherPos, hosePos, obstacles },
    grid,
    spawn,
  };
}

function buildMineWorld(
  conditions: ExperimentConditions,
  rng: () => number
): { world: MissionWorldState; grid: NavGrid; spawn: Vec3 } {
  const grid = new NavGrid(60, 60, 1, -10, -10);
  const obstacles: { position: Vec3; radius: number }[] = [];

  // Tunnel walls — carve a main corridor and side rooms
  for (let z = 0; z < 60; z++) {
    for (let x = 0; x < 60; x++) {
      const wx = grid.originX + x;
      const wz = grid.originZ + z;
      const mainCorridor = Math.abs(wz - 8) < 2.6 && wx > -8 && wx < 42;
      const side =
        Math.abs(wx - 20) < 2.6 && wz > 6 && wz < 38 + conditions.tunnelAccessibility * 8;
      const chamber = wx > 15 && wx < 30 && wz > 28 && wz < 44;
      const blockedAccess =
        conditions.tunnelAccessibility < 0.5 &&
        wz > 22 &&
        wz < 26 &&
        Math.abs(wx - 20) < 2.6;
      if (!(mainCorridor || side || chamber) || blockedAccess) {
        grid.setBlocked(x, z, true);
      }
    }
  }

  const rockCount = Math.round(2 + conditions.obstacleShift * 4 + conditions.terrainDifficulty * 3);
  for (let i = 0; i < rockCount; i++) {
    const ox = 8 + i * 5 + conditions.obstacleShift * (rng() - 0.5) * 2;
    const oz = 9.2;
    if (grid.isBlocked(grid.worldToCell(ox, oz).x, grid.worldToCell(ox, oz).z)) continue;
    obstacles.push({ position: { x: ox, y: 0.4, z: oz }, radius: 0.4 });
    grid.blockCircle(ox, oz, 0.45);
  }

  const depositBase = {
    x: 22 + conditions.depositRelocation * (rng() - 0.5) * 4,
    y: 0.3,
    z: 36 + conditions.depositRelocation * (rng() - 0.5) * 3,
  };
  const clear = (p: { x: number; z: number }) => {
    const c = grid.worldToCell(p.x, p.z);
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++)
        grid.setBlocked(c.x + dx, c.z + dz, false);
  };
  clear(depositBase);
  clear({ x: 0, z: 8 });
  clear({ x: 32, z: 8 });

  const deposits: MineralDeposit[] = [
    {
      id: "ore-alpha",
      position: { ...depositBase, y: 0.3 },
      quantityKg: 2 * conditions.materialQuantity,
      identified: false,
      extractedKg: 0,
    },
    {
      id: "ore-decoy",
      position: {
        x: depositBase.x - 4,
        y: 0.3,
        z: depositBase.z - 2,
      },
      quantityKg: 0.5,
      identified: false,
      extractedKg: 0,
    },
  ];
  clear({ x: deposits[1].position.x, z: deposits[1].position.z });

  const collectionPoint: Vec3 = { x: 32, y: 0, z: 8 };
  const spawn: Vec3 = { x: 0, y: 0, z: 8 };

  return {
    world: { deposits, collectionPoint, obstacles },
    grid,
    spawn,
  };
}

function setState(agent: Agent, state: RobotState, time: number, detail?: string) {
  if (agent.telemetry.state === state) return;
  agent.telemetry.state = state;
  agent.telemetry.timeline.push(
    event(time, "state", detail ?? state)
  );
}

function completeObjective(agent: Agent, obj: string, time: number) {
  if (agent.telemetry.objectivesCompleted.includes(obj)) return;
  agent.telemetry.objectivesCompleted.push(obj);
  agent.telemetry.timeline.push(event(time, "objective", obj));
}

function tryMove(
  agent: Agent,
  target: { x: number; z: number },
  speed: number,
  grid: NavGrid,
  world: MissionWorldState,
  conditions: ExperimentConditions,
  rng: () => number,
  time: number
): void {
  const profile = getRobot(agent.robotId).simulation;
  const pos = agent.telemetry.position;
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.08) {
    agent.telemetry.velocity = 0;
    return;
  }

  const desiredHeading = Math.atan2(dx, dz);
  let headingDiff = desiredHeading - agent.telemetry.heading;
  while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
  while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
  const turn = clamp(headingDiff, -profile.turnSpeed * DT, profile.turnSpeed * DT);
  agent.telemetry.heading += turn;

  const visibilityFactor = clamp(
    1 - (1 - conditions.visibility) * 0.35 - conditions.smokeDensity * 0.2,
    0.45,
    1
  );
  const step = speed * DT * visibilityFactor;

  const nx = pos.x + Math.sin(agent.telemetry.heading) * step;
  const nz = pos.z + Math.cos(agent.telemetry.heading) * step;
  const cell = grid.worldToCell(nx, nz);

  let blocked = grid.isBlocked(cell.x, cell.z);
  for (const o of world.obstacles) {
    if (Math.hypot(nx - o.position.x, nz - o.position.z) < o.radius + 0.35) {
      blocked = true;
      break;
    }
  }

  // Missed obstacle detection under smoke / latency (rare, only when actually near obstacles)
  const nearObstacle = world.obstacles.some(
    (o) => Math.hypot(pos.x - o.position.x, pos.z - o.position.z) < o.radius + 1.8
  );
  const perceptionMiss =
    nearObstacle &&
    rng() < (profile.reactionLatencyMs / 12000) * (1.1 - profile.obstacleAvoidance) * (0.5 + conditions.smokeDensity);

  if (blocked || perceptionMiss) {
    agent.telemetry.collisions += 1;
    // Wall-slide: try strafing toward the goal instead of full stop
    const sideA = {
      x: pos.x + Math.sin(agent.telemetry.heading + 0.7) * step * 0.7,
      z: pos.z + Math.cos(agent.telemetry.heading + 0.7) * step * 0.7,
    };
    const sideB = {
      x: pos.x + Math.sin(agent.telemetry.heading - 0.7) * step * 0.7,
      z: pos.z + Math.cos(agent.telemetry.heading - 0.7) * step * 0.7,
    };
    const free = (p: { x: number; z: number }) => {
      const c = grid.worldToCell(p.x, p.z);
      if (grid.isBlocked(c.x, c.z)) return false;
      return !world.obstacles.some(
        (o) => Math.hypot(p.x - o.position.x, p.z - o.position.z) < o.radius + 0.35
      );
    };
    if (free(sideA)) {
      pos.x = sideA.x;
      pos.z = sideA.z;
      agent.telemetry.heading += 0.35;
      agent.telemetry.distanceTraveled += step * 0.7;
      agent.telemetry.velocity = (step * 0.7) / DT;
    } else if (free(sideB)) {
      pos.x = sideB.x;
      pos.z = sideB.z;
      agent.telemetry.heading -= 0.35;
      agent.telemetry.distanceTraveled += step * 0.7;
      agent.telemetry.velocity = (step * 0.7) / DT;
    } else {
      agent.telemetry.velocity = 0;
      agent.telemetry.heading += (rng() - 0.5) * 1.2;
    }
    const fallChance =
      (1 - profile.balanceTolerance) * 0.05 +
      conditions.terrainDifficulty * 0.03 +
      conditions.incline * 0.05;
    if (agent.fallCooldown <= 0 && rng() < fallChance) {
      agent.telemetry.falls += 1;
      agent.fallCooldown = 0.9 + (1 - profile.recoveryCapability) * 0.6;
      setState(agent, "RECOVERING", time, "fall recovery");
    }
    return;
  }

  const moved = Math.hypot(nx - pos.x, nz - pos.z);
  pos.x = nx;
  pos.z = nz;
  agent.telemetry.velocity = moved / DT;
  agent.telemetry.distanceTraveled += moved;
  agent.telemetry.energy = clamp(
    agent.telemetry.energy - profile.energyDrainPerSecond * DT * (1 + conditions.terrainDifficulty),
    0,
    1
  );
}

function followPath(
  agent: Agent,
  speed: number,
  grid: NavGrid,
  world: MissionWorldState,
  conditions: ExperimentConditions,
  rng: () => number,
  time: number
): boolean {
  if (agent.path.length === 0 || agent.pathIndex >= agent.path.length) return true;
  const wp = agent.path[agent.pathIndex];
  // Skip waypoints that are already behind / too close
  if (dist2(agent.telemetry.position, wp) < 0.7) {
    agent.pathIndex += 1;
    return agent.pathIndex >= agent.path.length;
  }
  tryMove(agent, wp, speed, grid, world, conditions, rng, time);
  if (dist2(agent.telemetry.position, wp) < 0.7) {
    agent.pathIndex += 1;
  }
  return agent.pathIndex >= agent.path.length;
}

function planPath(
  agent: Agent,
  grid: NavGrid,
  goal: { x: number; z: number }
): void {
  agent.path = grid.findPath(
    agent.telemetry.position.x,
    agent.telemetry.position.z,
    goal.x,
    goal.z
  );
  agent.pathIndex = 0;
  let ideal = 0;
  for (let i = 1; i < agent.path.length; i++) {
    ideal += dist2(agent.path[i - 1], agent.path[i]);
  }
  agent.idealDistance = Math.max(agent.idealDistance, ideal);
}

function tickFireRescue(
  agent: Agent,
  world: MissionWorldState,
  grid: NavGrid,
  conditions: ExperimentConditions,
  rng: () => number,
  time: number
): void {
  const profile = getRobot(agent.robotId).simulation;
  const fire = world.fire!;
  const speed = profile.walkSpeed * (0.85 + profile.obstacleAvoidance * 0.15);

  if (agent.fallCooldown > 0) {
    agent.fallCooldown -= DT;
    if (agent.fallCooldown <= 0) {
      setState(agent, "NAVIGATING", time, "recovered");
      agent.path = [];
    }
    return;
  }

  if (agent.telemetry.missionComplete || agent.telemetry.missionFailed) return;

  if (agent.telemetry.energy <= 0) {
    agent.telemetry.missionFailed = true;
    setState(agent, "FAILED", time, "energy depleted");
    return;
  }

  // Phase machine
  // 0: go to extinguisher
  // 1: pick up
  // 2: go toward fire / hose area
  // 3: suppress
  // 4: confirm + complete

  if (agent.phase === 0) {
    setState(agent, "NAVIGATING", time);
    if (agent.path.length === 0 || agent.pathIndex >= agent.path.length) {
      planPath(agent, grid, world.extinguisherPos!);
    }
    const done = followPath(agent, speed, grid, world, conditions, rng, time);
    if (done || dist(agent.telemetry.position, world.extinguisherPos!) < 1.2) {
      agent.phase = 1;
      agent.interactionTimer = 0.8;
      setState(agent, "INTERACTING", time, "acquiring extinguisher");
      completeObjective(agent, "deployed", time);
      completeObjective(agent, "navigate_to_equipment", time);
    }
  } else if (agent.phase === 1) {
    agent.interactionTimer -= DT;
    if (agent.interactionTimer <= 0) {
      const success = rng() < profile.gripSuccess;
      agent.telemetry.equipmentInteractions += 1;
      if (success) {
        agent.hasExtinguisher = true;
        completeObjective(agent, "equipment_acquired", time);
        agent.phase = 2;
        agent.path = [];
        planPath(agent, grid, fire.position);
        setState(agent, "SEARCHING", time, "locating fire");
      } else {
        agent.interactionTimer = 0.6;
      }
    }
  } else if (agent.phase === 2) {
    if (agent.telemetry.timeToLocateFire == null && dist(agent.telemetry.position, fire.position) < 12) {
      agent.telemetry.timeToLocateFire = time;
      completeObjective(agent, "fire_located", time);
    }
    if (
      agent.path.length === 0 ||
      agent.pathIndex >= agent.path.length ||
      (agent.interactionTimer > 8 && dist(agent.telemetry.position, fire.position) > 3)
    ) {
      planPath(agent, grid, fire.position);
      agent.interactionTimer = 0;
    }
    agent.interactionTimer += DT;
    // Direct seek assist when close enough to fire for local approach
    if (dist(agent.telemetry.position, fire.position) < 8) {
      tryMove(agent, fire.position, speed, grid, world, conditions, rng, time);
    } else {
      followPath(agent, speed, grid, world, conditions, rng, time);
    }
    if (dist(agent.telemetry.position, fire.position) < 2.8) {
      if (agent.telemetry.timeToReachFire == null) {
        agent.telemetry.timeToReachFire = time;
        completeObjective(agent, "fire_reached", time);
      }
      agent.phase = 3;
      agent.suppressing = true;
      agent.interactionTimer = 0;
      setState(agent, "SUPPRESSING", time, "suppressing fire");
      completeObjective(agent, "suppression_started", time);
    }
  } else if (agent.phase === 3) {
    // Face fire and suppress
    const dx = fire.position.x - agent.telemetry.position.x;
    const dz = fire.position.z - agent.telemetry.position.z;
    agent.telemetry.heading = Math.atan2(dx, dz);
    agent.suppressing = true;
    const suppressRate =
      0.55 *
      (0.75 + profile.gripSuccess * 0.35) *
      (1 - conditions.smokeDensity * 0.15);
    fire.intensity = clamp(fire.intensity - suppressRate * DT, 0, 2);
    agent.telemetry.waterUsed += suppressRate * DT * 2;
    agent.telemetry.energy -= profile.energyDrainPerSecond * DT * 1.5;
    agent.interactionTimer += DT;
    agent.telemetry.suppressionTime = (agent.telemetry.suppressionTime ?? 0) + DT;
    agent.telemetry.equipmentInteractions = Math.max(
      agent.telemetry.equipmentInteractions,
      2
    );

    if (fire.intensity <= 0.15) {
      fire.suppressed = true;
      fire.intensity = 0;
      fire.smoke = Math.max(0.1, fire.smoke * 0.5);
      completeObjective(agent, "fire_suppressed", time);
      agent.phase = 4;
      agent.suppressing = false;
      setState(agent, "COMPLETED", time, "mission complete");
      agent.telemetry.missionComplete = true;
      completeObjective(agent, "mission_complete", time);
    } else if (agent.interactionTimer > 25) {
      agent.telemetry.missionFailed = true;
      setState(agent, "FAILED", time, "suppression timeout");
    }
  }
}

function tickDeepMine(
  agent: Agent,
  world: MissionWorldState,
  grid: NavGrid,
  conditions: ExperimentConditions,
  rng: () => number,
  time: number
): void {
  const profile = getRobot(agent.robotId).simulation;
  const speed =
    profile.walkSpeed *
    (0.8 + profile.obstacleAvoidance * 0.15) *
    (1 - conditions.incline * 0.35);

  if (agent.fallCooldown > 0) {
    agent.fallCooldown -= DT;
    if (agent.fallCooldown <= 0) {
      setState(agent, "NAVIGATING", time, "recovered");
      agent.path = [];
    }
    return;
  }
  if (agent.telemetry.missionComplete || agent.telemetry.missionFailed) return;
  if (agent.telemetry.energy <= 0) {
    agent.telemetry.missionFailed = true;
    setState(agent, "FAILED", time, "energy depleted");
    return;
  }

  const deposits = world.deposits!;
  const targetDeposit = deposits[0];
  const collection = world.collectionPoint!;

  // 0 navigate to exploration area
  // 1 search/identify
  // 2 extract
  // 3 carry to collection
  // 4 deposit

  if (agent.phase === 0) {
    setState(agent, "NAVIGATING", time);
    completeObjective(agent, "enter_mine", time);
    if (
      agent.path.length === 0 ||
      agent.pathIndex >= agent.path.length ||
      agent.interactionTimer > 8
    ) {
      planPath(agent, grid, targetDeposit.position);
      agent.interactionTimer = 0;
    }
    agent.interactionTimer += DT;
    followPath(agent, speed, grid, world, conditions, rng, time);
    if (dist(agent.telemetry.position, targetDeposit.position) < 3) {
      agent.phase = 1;
      agent.interactionTimer = 1.0;
      setState(agent, "SEARCHING", time, "scanning deposits");
    }
  } else if (agent.phase === 1) {
    agent.interactionTimer -= DT;
    if (agent.interactionTimer <= 0) {
      const accuracy =
        profile.obstacleAvoidance * 0.5 +
        (1 - (1 - conditions.lighting) * 0.4) * 0.5;
      const correct = rng() < accuracy + 0.25;
      targetDeposit.identified = true;
      if (agent.telemetry.timeToIdentifyDeposit == null) {
        agent.telemetry.timeToIdentifyDeposit = time;
      }
      completeObjective(agent, "deposit_identified", time);
      agent.telemetry.equipmentInteractions += 1;
      if (correct) {
        agent.phase = 2;
        agent.interactionTimer = 1.5;
        setState(agent, "INTERACTING", time, "extracting mineral");
        planPath(agent, grid, targetDeposit.position);
      } else {
        // Wrong ID — go to decoy briefly then recover
        agent.phase = 1.5 as unknown as number;
        planPath(agent, grid, deposits[1].position);
        setState(agent, "SEARCHING", time, "re-evaluating deposit");
      }
    }
  } else if ((agent.phase as number) === 1.5) {
    followPath(agent, speed, grid, world, conditions, rng, time);
    if (dist(agent.telemetry.position, deposits[1].position) < 1.5) {
      agent.phase = 2;
      agent.interactionTimer = 1.5;
      planPath(agent, grid, targetDeposit.position);
      setState(agent, "INTERACTING", time, "correcting extraction target");
    }
  } else if (agent.phase === 2) {
    if (dist(agent.telemetry.position, targetDeposit.position) > 1.2) {
      followPath(agent, speed, grid, world, conditions, rng, time);
      return;
    }
    agent.interactionTimer -= DT;
    if (agent.interactionTimer <= 0) {
      const grip = rng() < profile.gripSuccess;
      agent.telemetry.equipmentInteractions += 1;
      if (grip) {
        const take = Math.min(targetDeposit.quantityKg, 2 * conditions.materialQuantity);
        targetDeposit.extractedKg += take;
        targetDeposit.quantityKg -= take;
        agent.carryingDepositId = targetDeposit.id;
        agent.telemetry.carrying = true;
        agent.telemetry.carriedMassKg = take;
        completeObjective(agent, "material_extracted", time);
        agent.phase = 3;
        agent.path = [];
        planPath(agent, grid, collection);
        setState(agent, "CARRYING", time, "transporting material");
      } else {
        agent.interactionTimer = 0.8;
      }
    }
  } else if (agent.phase === 3) {
    if (
      agent.path.length === 0 ||
      agent.pathIndex >= agent.path.length ||
      agent.interactionTimer > 6
    ) {
      planPath(agent, grid, collection);
      agent.interactionTimer = 0;
    }
    agent.interactionTimer += DT;
    followPath(agent, speed * 0.9, grid, world, conditions, rng, time);
    if (dist(agent.telemetry.position, collection) < 2.2) {
      agent.phase = 4;
      agent.interactionTimer = 0.6;
      setState(agent, "INTERACTING", time, "depositing material");
    }
  } else if (agent.phase === 4) {
    agent.interactionTimer -= DT;
    if (agent.interactionTimer <= 0) {
      agent.telemetry.materialRecoveredKg =
        (agent.telemetry.materialRecoveredKg ?? 0) + agent.telemetry.carriedMassKg;
      agent.telemetry.carrying = false;
      agent.telemetry.carriedMassKg = 0;
      agent.carryingDepositId = null;
      completeObjective(agent, "material_deposited", time);
      agent.telemetry.missionComplete = true;
      setState(agent, "COMPLETED", time, "mission complete");
      completeObjective(agent, "mission_complete", time);
    }
  }
}

function runSingleRobot(
  mission: MissionId,
  robotId: RobotId,
  conditions: ExperimentConditions,
  baseSeed: number
): { telemetry: RobotTelemetry; world: MissionWorldState; durationSec: number; snapshots: { time: number; telemetry: RobotTelemetry; world: MissionWorldState }[] } {
  // Identical seed per robot for fair sequential comparison
  const rng = createRng(hashSeed(baseSeed, mission, "world"));
  const built =
    mission === "fire-rescue"
      ? buildFireWorld(conditions, rng)
      : buildMineWorld(conditions, rng);
  const { world, grid, spawn } = built;
  // Per-robot controller RNG (profile differences only)
  const agentRng = createRng(hashSeed(baseSeed, mission, robotId));

  const agent: Agent = {
    robotId,
    telemetry: makeTelemetry(robotId, { ...spawn }),
    path: [],
    pathIndex: 0,
    phase: 0,
    hasExtinguisher: false,
    suppressing: false,
    carryingDepositId: null,
    fallCooldown: 0,
    interactionTimer: 0,
    idealDistance: 0,
    lastPos: { ...spawn },
  };

  const snapshots: { time: number; telemetry: RobotTelemetry; world: MissionWorldState }[] = [];
  let time = 0;
  let tick = 0;
  const maxTicks = Math.floor(MAX_SECONDS / DT);

  while (tick < maxTicks) {
    if (world.fire && !world.fire.suppressed && world.fire.intensity > 0) {
      if (!agent.suppressing) {
        world.fire.intensity = clamp(
          world.fire.intensity + world.fire.spreadRate * DT * 0.15,
          0,
          1.5
        );
      }
      world.fire.smoke = clamp(
        conditions.smokeDensity * 0.5 + world.fire.intensity * 0.5,
        0,
        1
      );
    }

    if (mission === "fire-rescue") {
      tickFireRescue(agent, world, grid, conditions, agentRng, time);
    } else {
      tickDeepMine(agent, world, grid, conditions, agentRng, time);
    }

    if (agent.idealDistance > 0) {
      agent.telemetry.pathEfficiency = clamp(
        agent.idealDistance /
          Math.max(agent.idealDistance, agent.telemetry.distanceTraveled),
        0.2,
        1
      );
    }

    time += DT;
    tick += 1;

    if (tick % 15 === 0) {
      snapshots.push({
        time,
        telemetry: structuredClone(agent.telemetry),
        world: structuredClone(world),
      });
    }

    if (agent.telemetry.missionComplete || agent.telemetry.missionFailed) break;
  }

  const { score, categoryScores } = computeMissionScore(
    mission,
    agent.telemetry,
    time
  );
  agent.telemetry.score = score;
  agent.telemetry.categoryScores = categoryScores;

  snapshots.push({
    time,
    telemetry: structuredClone(agent.telemetry),
    world: structuredClone(world),
  });

  return {
    telemetry: structuredClone(agent.telemetry),
    world: structuredClone(world),
    durationSec: time,
    snapshots,
  };
}

export function runExperiment(config: ExperimentConfig): ExperimentResult {
  const conditions = { ...DEFAULT_CONDITIONS, ...config.conditions };
  const baseSeed = conditions.seed;

  // Sequential fair runs with identical world seeds (Arena-style compare)
  const perRobot = config.robotIds.map((robotId) =>
    runSingleRobot(config.mission, robotId, conditions, baseSeed)
  );

  const durationSec = Math.max(...perRobot.map((r) => r.durationSec), 0.1);
  const globalEvents: TelemetryEvent[] = [
    event(0, "experiment_start", `${config.mission} seed=${conditions.seed}`),
    event(0, "execution_model", "sequential identical-seed trials"),
  ];

  // Build synchronized replay snapshots (interpolate by time index)
  const snapshots: SimulationSnapshot[] = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = (durationSec * i) / steps;
    const robots = perRobot.map((run) => {
      let best = run.snapshots[0];
      for (const s of run.snapshots) {
        if (s.time <= t) best = s;
        else break;
      }
      // Offset robots visually so all three appear in the same replay
      const idx = config.robotIds.indexOf(run.telemetry.robotId);
      const tel = structuredClone(best.telemetry);
      tel.position = {
        ...tel.position,
        x: tel.position.x + idx * 1.6,
      };
      return tel;
    });
    snapshots.push({
      tick: i,
      time: t,
      mission: config.mission,
      robots,
      world: structuredClone(perRobot[0].snapshots[perRobot[0].snapshots.length - 1]?.world ?? perRobot[0].world),
      // Prefer live world from first robot's nearest snapshot for fire viz
      events: globalEvents,
      complete: i === steps,
    });
  }

  // Fix world in snapshots to track fire/mine from the leading robot's timeline
  for (let i = 0; i <= steps; i++) {
    const t = (durationSec * i) / steps;
    let bestWorld = perRobot[0].world;
    for (const run of perRobot) {
      for (const s of run.snapshots) {
        if (s.time <= t) bestWorld = s.world;
      }
    }
    // Use G1/first robot world progression for shared viz
    let w = perRobot[0].snapshots[0]?.world ?? perRobot[0].world;
    for (const s of perRobot[0].snapshots) {
      if (s.time <= t) w = s.world;
    }
    snapshots[i].world = structuredClone(w);
    void bestWorld;
  }

  const finalRobots = perRobot.map((r, idx) => {
    const tel = structuredClone(r.telemetry);
    tel.position = {
      ...tel.position,
      x: tel.position.x + idx * 1.6,
    };
    return tel;
  });

  const final: SimulationSnapshot = {
    tick: steps,
    time: durationSec,
    mission: config.mission,
    robots: finalRobots,
    world: structuredClone(perRobot[0].world),
    events: [
      ...globalEvents,
      event(durationSec, "experiment_end", `duration=${durationSec.toFixed(2)}s`),
    ],
    complete: true,
  };
  snapshots[snapshots.length - 1] = final;

  const sorted = [...finalRobots].sort((a, b) => b.score - a.score);
  const rankings = sorted.map((t, i) => ({
    robotId: t.robotId,
    score: t.score,
    rank: i + 1,
  }));

  return {
    config,
    snapshots,
    final,
    rankings,
    durationSec,
    completedAt: new Date().toISOString(),
  };
}

export function createExperimentConfig(partial: {
  mission: MissionId;
  robotIds: RobotId[];
  conditions?: Partial<ExperimentConditions>;
  mode?: ExperimentConfig["mode"];
  parentExperimentId?: string;
  hypothesis?: string;
}): ExperimentConfig {
  return {
    id: `exp_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
    mission: partial.mission,
    robotIds: partial.robotIds,
    conditions: { ...DEFAULT_CONDITIONS, ...partial.conditions },
    mode: partial.mode ?? "autonomous",
    parentExperimentId: partial.parentExperimentId,
    hypothesis: partial.hypothesis,
    createdAt: new Date().toISOString(),
  };
}

export { DT, MAX_SECONDS };

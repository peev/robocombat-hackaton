import { NextResponse } from "next/server";
import { DEFAULT_CONDITIONS, CONDITION_LIMITS } from "@/lib/simulation/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    scenarios: [
      {
        id: "fire-rescue",
        name: "Fire Rescue",
        description:
          "Cargo ship fire containment. Navigate, acquire suppression gear, extinguish fire.",
      },
      {
        id: "deep-mine",
        name: "Deep Mine",
        description:
          "Underground mineral extraction. Navigate tunnels, identify ore, extract and deliver.",
      },
    ],
    defaultConditions: DEFAULT_CONDITIONS,
    conditionLimits: CONDITION_LIMITS,
  });
}

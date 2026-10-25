import { NextResponse } from "next/server";
import { getRankings } from "@/lib/persistence/store";
import { DISCLAIMER } from "@/lib/robots/profiles";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    title: "ROBOCOMBAT RANKINGS",
    disclaimer: DISCLAIMER,
    simulated: true,
    rankings: getRankings(),
  });
}
